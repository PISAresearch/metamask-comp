
# Proposal 2: Bitflip with ordering 

The problem with the Bitflip approach:
* No meta-transaction ordering at all.
* State grows 1 bit per job (in chunks of 256 bits). 

Our second proposal, Bitflip with ordering, tries to combine the best of both worlds for Nonce and Bitflip. 

**Benefit of approach:** Bitflip supports ordered transactions (like Nonce) and up to 256-bit concurrent and in-flight meta transactions (using bitmaps like in Bitflip). 

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

Super easy. Just one 2^index and an addition. 

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

Given a bitmap and an index, we can simply flip the bit. 

[We have also included unit tests to verify that everything works as intended.](https://github.com/PISAresearch/metamask-comp/blob/master/test/contracts/BitFlipWalletWithOrdering.test.ts)


### Record latest nonce and bitmap 

The replay protection contract stores a mapping of the bitmaps and a mapping for the latest nonce: 

```
mapping(address => mapping(uint => uint)) bitmaps; 
mapping(address => uint) nonces; 

bitmaps[nonce1] = 0000000......0000000000;
```

### Enforcing order for meta-transactions

Unlike proposal 1, there is a nonce for ordering and we require it to be incremented one-at-a-time. 

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

We have a demo on how to extend it into a sliding-window approach to support more than 256 concurrent transactions, but it doesn't explain the idea as clearly as above. 
