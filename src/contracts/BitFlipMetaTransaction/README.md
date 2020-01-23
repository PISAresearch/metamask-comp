
# Proposal 1: Bitflip MetaTransactions

Our contract maintaisn a list of bitmaps and all meta-transactions reserve a single bit in a map. When a meta-transaction is processed, it will flip a bit for the on-chain bitmap. Because the bit is flipped, it can never be processed again. Our approach supports unlimited number of concurrent and in-flight meta-transactions. But it does linearly increase on-chain storage costs by 1 bit. 

We'll provide some background on bitwise operations before describing the replay contract. 

## Background on bitwise operations

### How do bitwise operations work? 

Just a reminder of the bitwise operations: 

``` 
AND: Both bits must be 1 to be true
OR: At least one of the bits have to be 1 (true)

```

### How do we flip bits in Solidity? 

A very good in-depth explanation can be found [here](https://medium.com/@imolfar/bitwise-operations-and-bit-manipulation-in-solidity-ethereum-1751f3d2e216). 

To perform an AND operation:

``` 
uint oldBitmap = 0; // "00000.....00000"
uint toFlip = 1; // "00000.....00001"
uint newBitmap = oldBitmap & toFlip;  // "00000....000000"
``` 

To perform an OR operation: 

``` 
uint oldBitmap = 0; // "00000.....00000"
uint toFlip = 1; // "00000.....00001"
uint newBitmap = oldBitmap | toFlip; // "00000....000001"
``` 

### How do we prepare the "bit to flip" in Javascript? 

In order to flip a "0" bit to a "1" bit, we only need to perform two operations. An exponentiation and an addition. We've provided an example below: 

``` 
   /**
   * Flip a bit!
   * @param bitmap 256 bits
   * @param toFlip index to flip (0,...,255)
   */
  function flipBit(bitmap: BigNumber, indexToFlip: BigNumber): BigNumber {
    return new BigNumber(bits).add(new BigNumber(2).pow(indexToFlip));
  }
```

Given a bitmap and an index, we can flip the bit from "0" to "1". 

[We have also included unit tests to verify that everything works as intended.](https://github.com/PISAresearch/metamask-comp/blob/master/test/contracts/BitFlipWallet.test.ts)


## How does the replay protection contract work?

The contract stores a list of bitmaps;  

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
e

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
