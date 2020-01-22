# Towards a meta-transaction standard

tldr; We propose a single function, isMetaTransactionApproved(), that can be included in any smart contract. We have three different replay protection proposals, Bitflip, Bitflip-ordering and MultiNonce, that can be implemented in this function. Our goal is to support concurrent in-flight meta-transactions with minimum storage requirements. Afterwards, we provide an overview of the any.sender architecture that is close to ready for launch. 

## Problem Statement

A meta-transaction lets a third party, the relayer, to pay the gas fee on behalf of someone else, the signer. This is useful when the user lacks access to the network's native token (e.g. ether), but they want to perform some execution on the network (e.g. transfer an ERC20 token). The problem focuses on how a dapp developer can make minimal changes to their smart contract in order to support meta-transactions. 

## Standard Approach: Replace-by-version

To the best of our knowledge, the standard approach for replay protection is to increment a nonce for every new meta-transaction. 

Generally speaking, the contract stores the latest nonce: 

```mapping(address => uint) nonces```

Signer signs the meta-transaction and forwards it to the relayer: 

``` user_sig = Sign(nonce, contractID, data). ```

Relayer submits the meta-transaction (signature, nonce, calldata) to the meta-transaction enabled smart contract: 

```
function executeMetaTransaction(string _data, uint _nonce, address _user, bytes _user_sig) public { 

   /// Verify the user's signature 
   require(verifySig(_user, nonce, data, _user_sig));
   
   // Check the nonce is largest seen so far
   require(_nonce > nonces[user]);
   
   // Store nonce and perform action
   nonces[_user] =_nonce; 
   
   // Rest of code using _data 

}
```

The nonce approach requires minimal storage (1 map entry, great!), but it requires all meta-transactions to be processed one-by-one. This is problematic for smart contract applications and relay service providers.

**Application problems**: The signer may issue tens (or hundreds) of meta-transactions at once and it does not matter the order in which the meta-transactions are processed by the blockchain (e.g. withdrawals).  If the replay protection implemented requires all meta-transactions to be processed in order of issuance, then a single meta-transaction encapsualted in a low-fee paying transaction will prevent all other meta-transactions getting in. Worse, if the transactions are spread across several relayers, then the meta-transactions may invalidate other meta-transactions (e.g. nonce=5 gets in before nonce=1, thus nonce=1 is invalid). 

**Relay service problems**: Relayers who offer meta-transactions as a service face a load-balancing problem. Given a list of incoming meta-transactions jobs and a list of signing keys, what is the best way to manage the jobs amongst the keys? The problem gets more difficult when we take into account gas requirements of a meta-transaction and the fee paid per transaction. For example, let's say we have a new meta-transaction that consumes 200k gas. Should we place it at the end of a queue that already has 62 pending meta transactions? Or should we forward it to a new signing key with an empty queue? If meta-transaction ordering is enforced due to the replay protection implemented (and not the application), we may be forced to put it in the long queue. Clearly, it can be sub-optimal for applications when the order in which meta-transactions are processed does not matter. 

Our focus is to alleivate the above problems by **supporting concurrent in-flight meta transactions** as opposed to requiring all meta-transactions to be processed-one-by-one. 


## Our contribution 

We propose three approaches for replay protection of meta-transactions, but with a twist: 

* **[Bitflip:](https://github.com/PISAresearch/metamask-comp/tree/master/src/contracts/BitFlipMetaTransaction/README.md)** The smart contract has a bitmap and every meta-transaction will flip a bit in the map. 
* **[Bitflip with ordering:](https://github.com/PISAresearch/metamask-comp/blob/master/src/contracts/BitFlipWithOrderingMetaTransaction/README.md)** Again, the smart contract maintains a 256-bit bitmap and it will reset the bitmap when 256 meta-transactions are processed. Supports up to 256 meta-transactions at a time, in any order.
* **[MultiNonce:](https://github.com/PISAresearch/metamask-comp/tree/master/src/contracts/MultiNonceMetaTransaction)** Supports unlimited concurrent and ordered transactions, but its storage overhead is 512-bit for each concurrent transaction. 

We have placed the concrete proposal for each relay protection implementation in its respective folder (src/contract) and it can easily be accessed by clicking the links above. For the rest of this document, we'll cover our proposed interface, an overview of all three proposals and then a discussion/comparison. 

## Interface for MetaTransaction Proposals

```
isMetaTransactionApproved(bytes32 _h, address _signer, uint _nonce1, uint _nonce2, bytes memory _sig) public {
```

All proposed replay protection mechanisms can re-use the same interface. Give or take, we rename nonce1 and nonce2 when applicable, but its just a uint. 

- **h** represents a hash of the meta-transaction data.
- **signer, nonce1, nonce2** represents the replay protection mechanism.
- **sig** is required as we will verify if the meta-transaction is approved. 

It is a single function interface that can be used in any smart contract to support meta-transactions with minimal effort. 

Additional two points: 

* **Generic replay protection support**:  I is easy to encode it into a *bytes replayProtection*  and then decode the relevant values in the replay protection contract. As such, the replay protection function is agnostic to the mechanism. For sake of clarity, we haven't done it here. 
* **EIP712 standard support**: We will need to remove the signature check from the replay protection and instead verify the signature of the signTypeV4. 

## Replay protection proposals 

We'll briefly cover each proposal and recommend that you check out the in-depth version in the respective /src/contract folder. Links provided throughout. 

### Bitflip

The replay protection contract stores a list of bitmaps: 

```
mapping(uint => uint) bitmaps; 

uint bitmap[nonce1] = 00000000....000000000
```

When authorising a new meta-transaction, we simply include a new bitmap that flips a single bit: 

```
bytes _h = "0x0...";
address signer = "0x0....":
uint nonce1 (index) = 0;
uint nonce2 (bitmap) = "0000000000100000"; 
bytes sig = "0x00....";

```

The transaction meta-transaction is reserved for the 11th bit of the 0th bitmap. There is no ordering, so it does not matter if the 9th or 12th bit is flipped, all we care about is the 10th bit. 

[Check the detailed writeup including how to check bits flipped & perform bit flipping on-chain.](https://github.com/PISAresearch/metamask-comp/tree/master/src/contracts/BitFlipMetaTransaction)

Benefits:
- *Minimal storage:* 1 bit per meta-transaction (chunks of uint)
- *Fully concurrent:* no dependency for other meta-transactions to be accepted
- *Minimal execution costs:* bitwise operations are natively supported & cheap on gas. 

Problems: 
- *Linear storage:* It is not "constant" storage requirements. 
- *No ordering:* It does not support ordered transactions which can be desirable. (e.g. successful ENS bid before revealing it). 


### Bitflip with ordering

Of course, we can fix both of the problems with the Bitflip approach by taking the best of both worlds of the standard Nonce and Bitflip. 


This replay protection contract stores both a bitmap and the largest nonce seen so far: 

```
mapping(address => address(uint => uint)) bitmaps; 
mapping(address => uint) nonce; 
```

When authorising a new meta-transaction, the signer can chose: 
 * Increment the nonce, delete the old bitmap and create a fresh bitmap 
 * Re-use the same nonce and flip a bit in the bitmap. 
 
The code for enforcing the ordering & resetting bitmaps: 
 
```
if(_nonce == nonces[_signer]+1) {
   delete bitmaps[_signer][_nonce-1];
   nonces[_signer] = _nonce;
}
```

Benefits: 
- *Constant straoge:* Only 3 uints per user. One for the largest nonce so far, and one for the mapping to the bitmap. 
- *Ordered transactions:* Just increment the nonce for every new transaction. 
- *Concurrent transactions:* Up to 256 concurrent and in-flight meta transactions at a time. 
- *Invalidate transactions:* Can invalidate issued meta-transactions by incrementing the nonce (e.g. increment to nonce=3, then the bitmap for nonce=2 are now invalid). 

Problems: 
- *Continuous capacity:* Cannot sustain a maximum concurrent capacity (e.g. 256 concurrent in-flight transactions at all times). 

[Check the detailed writeup alongside the contract implementation.](https://github.com/PISAresearch/metamask-comp/tree/master/src/contracts/BitFlipWithOrderingMetaTransaction)

### MultiNonce 

Of course, as demonstrated in our implementation, all replay protections can be extended to multi-user by modifying the mapping:

```
mapping(address => mapping(uint => uint)) nonces; 
```

## Discussion & Comparison 

| Proposal | Ordered | Concurrency | Storage | Storage Growth |
| ------------- | ------------- | ------------- | ------------- | ------------- |
| Nonce  | Yes  | No | 256-bit | None |
| Bitflip  | No  | Yes | Number of Tx | 1 bit per tx*  |
| Bitflip-Ordering  | Yes  | Yes | 256-bit | Nonce |
| MultiNonce | Yes | Yes | 256-bit*Max Concurrency | None |

We'll provide a short comparison of the above schemes. 

**Ordered.** Every scheme except Bitflip lets the user order their transactions to ensure they are processed one-by-one. Both Bitflip-ordering and MultiNonce approaches are essentially the same as the nonce approach. e.g. every time there is a new meta-transaction, we increment the primary nonce by one. 

**Concurrency**. All three proposed schemes support concurrency in slightly different ways. Bitflip offers the most flexibility as each transaction simply reserves a bit in the bitmap. So the user can publish 1, or 1000 transactions, and they will all be accepted in different orders. However the storage is always increasing by 1 bit per transaction and it cannot be deleted. This brings us to Bitflip-ordering which essentially lets us reset the bitmap periodically. So the user can authorise up to 256 meta-transactions and then reset the bitmap after they are all accepted. Finally, MultiNonce can support unlimited concurrent transactions, but we must store two integers (2*uints) per concurrent job. So if we want to support up to 50 concurrent jobs, then we need to store 100 integers forever. 

**Storage** & Growth* Both Nonce (256-bit) and Bit-flip ordering (512 bit) have constant storage. Bit-flip ordering has the advantage that it can support up to 256 concurrent transactions, whereas nonce cannot. Bitflip's storage will always increase by 1 bit per metatransaction, whereas MultiNonce will have constant storage based on the maximum capacity of concurrent jobs required. 

Overall, the type of replay protection chosen really depends on:

- Does the user want to issue transactions one-by-one and guarantee their order? 
- Does the user want to issue concurrent in-flight meta-transactions?
- What quantity of transactions does the user want to perform? 

If the user wants ordered transactions with minimal storage, then Nonce is the best choice.

If the user wants ordered and concurrent transactions, but they are willing to wait for a batch of 256 concurrent in-flight meta-transactions to be processed before startign the next batch, then bitflip-ordering is the best choice. 

If the user wants ordered and concurrent transactions, but with a limit of 3 concurrent in-flight meta-transactions, then MultiNonce might be the best choice.

If the user does not care for ordering, but wants no ceiling on the number of concurrent in-flight meta-transactions, then Bitflip is the best choice. 


