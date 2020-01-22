# Towards a meta-transaction standard

tldr; We propose a single function, isMetaTransactionApproved(), that can be included in any smart contract. We have three replay protection protocols that can be implemented in the function. We also provide an overview of the any.sender architecture and replay strategy. 

## Problem Statement

A meta-transaction lets a third party, the relayer, to pay the gas fee on behalf of someone else, the signer. This is useful when the user lacks access to the network's native token (e.g. ether), but they want to perform some execution on the network (e.g. transfer an ERC20 token). The problem focuses on how a dapp developer can make minimal changes to their smart contract in order to support meta-transactions. 

## Standard Approach: Replace-by-version

To the best of our knowledge, the standard approach for replay protection is to increment a nonce for every new transaction message. Generally speaking, the contract stores the latest nonce: 

```mapping(address => uint) nonces```

The user will sign a message that is forwarded to the relayer: 

``` user_sig = Sign(nonce, contractID, data). ```

The relayer will submit the user's signature, nonce and calldata to the meta-transaction enabled smart contract: 

```
function performAction(string _data, uint _nonce, address _user, bytes _user_sig) public { 

   /// Verify the user's signature 
   require(verifySig(_user, nonce, data, _user_sig));
   
   // Check the nonce is largest seen so far
   require(_nonce > nonces[user]);
   
   // Store nonce and perform action
   nonces[_user] =_nonce; 
   
   // Rest of code using _data 

}
```

The nonce approach is easy with minimal storage (256-bits), but it requires all meta-transactions to be processed one-by-one. This is problematic for several applications, namely withdrawals, benefit greatly from concurrent transactions. 

## Our contribution 

We propose three approaches for replay protection of meta-transactions, but with a twist: 

* **Bitflip:** The smart contract has a bitmap and every meta-transaction will flip a bit in the map. 
* **Bitflip with ordering:** Again, the smart contract maintains a 256-bit bitmap and it will reset the bitmap when 256 meta-transactions are processed. Supports up to 256 meta-transactions at a time, in any order.
* **MultiNonce** Supports unlimited concurrent and ordered transactions, but its storage overhead is 512-bit for each concurrent transaction. 

We'll go through each proposal one-by-one with a high-level description and links to the code. 

## Interface for MetaTransaction Proposals

```
isMetaTransactionApproved(bytes32 _h, address _signer, uint _nonce1, uint _nonce2, bytes memory _sig) public {
```

All proposed replay protection mechanisms can re-use the same interface. 

- **h** represents a hash of the meta-transaction data. This can be a hash of the original function parameters. 
- **signer, nonce1, nonce2** represents the replay protection mechanism. Note it is easy to encode it into a *bytes replayProtection* to support other mechanisms. For sake of clarity, we haven't done it here. 
- **sig** is required as we will verify if the meta-transaction is approved. For an EIP712 standard, this could be moved elsewhere. 

It is a single function interface that can be used in any smart contract to support meta-transactions with minimal effort. 


## Proposal 1: Bitflip 

Our contract will maintain a list of bitmaps and each meta-transaction will reserve a single bit in a map. 

The benefit of this approach is that it can support an unlimited number of concurrent in-flight meta-transactions as each job will simplify flip their reserved bit.

As mentioned, the contract stores a list of bitmaps;  

```
mapping(uint => uint) bitmaps; 

bitmaps[_nonce1] = 0000000......0000000000;
```

To reserve a bit for the meta-transaction:
 * **nonce1** - Index for destined on-chain bitmap 
 * **nonce2** - A bitmap with the flipped bit 

For sake of clarity in this section, we will call *nonce1 -> index* and *nonce2 -> toFlip*. 

We will break the descriptio into two parts
- How does the on-chain contract verify if a bit has been flipped? 
- How does the on-chain contract flip a bit in the bitmap? 

### Reminder of bitwise operations

Just a reminder of the bitwise operations: 

``` 
AND: Both bits must be 1 to be true
OR: At least one of the bits have to be 1 (true)
```

### How to verify on-chain that a bit is not flipped

We use the following AND operation to check if the bitmap is flipped:

``` 
uint bitmap = bitmaps[_nonce1]; // for clarity
uint toFlip = _nonce2;  // for clarity
require(bitmap & toFlip != toFlip); 
``` 

We'll consider three cases to illustrate the verification will always pass if toFlip has at least one bit that is not already flipped on-chain. 

*Case 1:* The bit has already been flipped on-chain. e.g. malicious replay

```
bitmap: 000000100000010000
toFlip: 000000000000010000
AND:    000000000000010000
```

The result is toFlip == AND so our precondition will reject it. 


*Case 2:* The bit has not already been flipped on-chain. e.g. the happy case

```
bitmap: 000000100000010000
toFlip: 000000000100000000
AND:    000000000000000000
```

The result is toFlip != AND. 

The contract confirms the bit still needs to be flipped and thus the meta-transaction can be executed. 

*Case 3:* Attacker tries to mix up flipped and non-flipped bits. 

```
bitmap: 000000100000010000
toFlip: 000000100100000000
AND:    000000100000000000
```

The result is toFlip != AND.

So there are some bits that still need to be flipped. Outcome for an attacker is that they simply waste their bits, e.g. flip more than 1 bit at a time. 

### How to perform the on-chain flip 

Performing the flip is easy. We juse use the OR peration: 

```
bitmap: 000000100000010000
toFlip: 000000000100000000
OR:     000000100100010000
```

This aggregates all the flipped bits into a single bitmap OR. Our solidity code: 

``` 
bitmaps[_signer][_index] = bitmaps[_signer][_index] | _toFlip;
```

## Proposal 2: Bitflip with ordering 

The problem with the Bitflip approach:
* No meta-transaction ordering at all.
* State grows 1 bit per job (in chunks of 256 bits). 

Our second proposal, Bitflip with ordering, tries to combine the best of both worlds for Nonce and Bitflip. 

The replay protection contract stores a mapping of the bitmaps and a mapping for the latest nonce: 

```
mapping(uint => uint) bitmaps; 
mapping(address => uint) nonces; 

bitmaps[nonce1] = 0000000......0000000000;
```

Again, both checking if a bit is flipped and flipping the bit is identical to the first Bitflip proposal. 

### Enforcing order for meta-transactions

Unlike proposal 1, this time we require the nonce is incremented one-at-a-time. 

```
require(_nonce1 == nonces[_signer] || _nonce == nonces[_signer]+1, "Nonce must be the same or incremented by one");
```
Every time nonce1 is incremented, we will delete the previous bitmap: 

```
// Delete old bitmap, keep new nonce
if(_nonce == nonces[_signer]+1) {
   delete bitmaps[_signer][_nonce-1];
   nonces[_signer] = _nonce;
}
```

As a result, there is only one bitmap in action at any time. So the replay protection can support:
- Ordered transactions (1,2,3....,)
- 256 concurrent and in-flight meta-transactions 

We had a demo of how to change this into a sliding-window approach to support more than 256 concurrent transactions, but it doesn't explain the idea as clearly as above. 


## Proposal 3: Multinonce 




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

