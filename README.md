Submission by Chris Buckland (yahgwai) & Patrick McCorry (stonecoldpat), PISA. 

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

* **Generic replay protection support**:  We can easily encode nonce1, nonce2 a *bytes replayProtection*  and then decode the relevant values in the replay protection contract. As such, the replay protection function is agnostic to the mechanism and can extended to other mechanisms. For sake of clarity, we haven't done it here. 
* **EIP712 standard support**: We will need to remove the signature check from the replay protection and instead verify the signature of the signTypeV4. As well, we could include the arguments in this function and check everything for a single signature. 

## Replay protection proposals 

We'll briefly cover each proposal and recommend that you check out the in-depth version in the respective /src/contract folder. Links provided throughout. 

### Bitflip

The replay protection contract stores a list of bitmaps: 

```
mapping(uint => uint) bitmaps; 

uint bitmap[nonce1] = 00000000....000000000; // In reality, its a uint number, but expressing in bits for clarity
```

When authorising a new meta-transaction, we simply include a new bitmap that flips a single bit: 

```
bytes _h = "0x0...";
address signer = "0x0....":
uint nonce1 (index) = 0;
uint nonce2 (bitmap) = "0000000000100000"; // In reality, its a uint number, but expressing in bits for clarity
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

When authorising a new meta-transaction, the signer can choose: 
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
- *Constant storage:* Only 3 uints per user. One for the largest nonce so far, and one for the bitmap mapping.
- *Ordered transactions:* Just increment the nonce for every new transaction. 
- *Concurrent transactions:* Up to 256 concurrent and in-flight meta transactions at a time. 
- *Invalidate transactions:* Can invalidate issued meta-transactions by incrementing the nonce (e.g. increment to nonce=3, then the bitmap for nonce=2 are now invalid). 

Problems: 
- *Continuous capacity:* Cannot sustain a maximum concurrent capacity (e.g. 256 concurrent in-flight transactions at all times). 

The continuous capacity sounds like a weird problem. But it is a real problem. For example, an exchange may wish to process ~100 withdrawals at any given time, we need a method that can sustain that throughput. While the original bitflip can do it, there is another approach that can achieve constant storage costs... 

[Check the detailed writeup alongside the contract implementation.](https://github.com/PISAresearch/metamask-comp/tree/master/src/contracts/BitFlipWithOrderingMetaTransaction)

### MultiNonce 

Of course, we can fix the problem with continuous capacity (otherwise we would not mention it, jk). 

This replay protection contract stores a single mapping for nonce -> nonce. 

```
mapping(address => mapping(uint => uint)) nonces; 
```

When authorising a new meta-transaction, we can decide to increment nonce1 or nonce2. 

```
bytes _h = "0x0...";
address signer = "0x0....":
uint nonce1 = 0;
uint nonce2 = "10"; 
bytes sig = "0x00....";

```

The meta-transaction in the above example, it is the 10th transaction for concurrent slot 0. But what does that really mean? 
 - Nonce 1: We increase the capacity of our concurrent transactions 
 - Nonce 2: Replace-by-version, we just process the meta-transactions in order. 
 
What if we want to fulfil 40 concurrent and in-flight meta-transactions at any time, then we use the slots (nonce1) 0,...,40 and every time a new-metatransaction is confirmed for a slot, we simply increment nonce2. 

Benefits:
- *Concurrent tx:* We can support any number of concurrent transactions.
- *Continuous concurrency:* We can sustain a capacity of N concurrent transactions at any given time (and this can be increased at any time). 
- *Ordered transactions:* We can simply default to the standard Nonce approach for a given slot. So all meta-transactions for a given nonce1 will be ordered. 
- *Invalidate transactions:* We can invalidate transactions by simply re-using the nonce1 & nonce2 for another meta-transaction. 

Problems: 
- *Constant and high storage cost:* Two unit for an additional concurrent transaction. 

[Check the detailed writeup alongside the contract implementation.](https://github.com/PISAresearch/metamask-comp/tree/master/src/contracts/MultiNonceMetaTransaction)

## Discussion & Comparison 

| Proposal | Ordered | Concurrency | Storage | Storage Growth |
| ------------- | ------------- | ------------- | ------------- | ------------- |
| Nonce  | Yes  | No | 256-bit | None |
| Bitflip  | No  | Yes | Number of Tx | 1 bit per tx*  |
| Bitflip-Ordering  | Yes  | Yes | 512-bit | Nonce |
| MultiNonce | Yes | Yes | 512-bit*Max Concurrency | None |

Thank you for making it this far and evaluating the three new replay protection mechanisms. We provide a short comparison of all schemes. 

**Ordered meta-transactions.** Every scheme except Bitflip lets the signer enforce that their meta-transactions are procesed one-by-one. Of course, both Bitflip-ordering and MultiNonce approaches are the same as the nonce approach. e.g. every time there is a new meta-transaction, we an increment a nonce by one. 

**Concurrent and in-flight meta-transactions.** All three proposed schemes support concurrent transactions. Bitflip offers the most flexibility as each meta-transaction simply reserves a bit in the bitmap. There is no limit on the number of concurrent transactions or how many can be in-flight at any given time. However, storage always increases by 1 per bit and it cannot be deleted. MultiNonce also supports unlimited concurrent and in-flight transactions, but we must store two integers (2 * uint) per concurrent job. Finally Bitflip-ordering supports 256 concurrent transactions before a reset is required. This can be extended with a sliding window, but not included here. (inquire and a copy can sent)

**Storage.** We need to take care not to bloat the network. Both Nonce (256-bit) and Bitflip ordering (512 bit) have constant storage. Bit-flip is advantagous over Nonce as it can also support up to 256 in-flight meta-transactions, whereas Nonce cannot. As well, MultiNonce can have constant storage based on the maximum capacity of concurrent jobs required. The only proposal with linear growth is Bitflip with 1 bit per meta-transaction, but this seems reasonable for a signer issuing hundreds of jobs over its lifetime. 

We have also framed the following questions to help illustrate when a replay protection is better suited to a specific signer.

### Which replay protection should we implement as a standard?

All, one or none. Because the function interface is agnostic to the mechanism, the dapp developer can select the replay protection that suits their needs. Patrick prefers Bitflip-ordering, 

### Does the user want to issue transactions one-by-one and guarantee their order? 

If the user never wants concurrency, then Nonce is perfect. Although Bitflip requires double the storage and supports concurrent. Small tradeoff in storage for increased flexibility. 

 ### Does the user want to issue concurrent in-flight meta-transactions?

If the user can tolerate:

- Waiting for a batch of up to 256 in-flight metatransactions to be proecessed before starting the next batch, then bit-flip ordering is the best choice.
- Wants to support 2 (or more) concurrent and in-flight meta transactions at any given time, then MultiNonce might be the best choice. 
- If the user does not care for ordering, but wants no ceiling on the number of concurrent in-flight meta-transactions, then Bitflip is the best choice. 

 ### What quantity of transactions does the user want to perform? 

Only BitFlip poses a problem as it has linear storage increase. If the signer wants to perform 100k+ transactions, then the storage cost will get large over time. All other proposals have constant storage. 


## Addendum - EIP Experiment
As a side effort, as part of this contest we experimented with using the EIP712 encoding format, and what impact
that would have on a meta transaction recipient contract. Our solution isnt fully complete - it lacks tests. More
details can be found [here](./src/contracts.EIP712Experiment); 

