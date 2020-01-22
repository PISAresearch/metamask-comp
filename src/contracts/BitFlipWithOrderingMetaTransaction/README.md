
## Proposal 2: Bitflip with ordering 

The problem with the Bitflip approach:
* No meta-transaction ordering at all.
* State grows 1 bit per job (in chunks of 256 bits). 

Our second proposal, Bitflip with ordering, tries to combine the best of both worlds for Nonce and Bitflip. 

### Record latest nonce and bitmap 

The replay protection contract stores a mapping of the bitmaps and a mapping for the latest nonce: 

```
mapping(address => mapping(uint => uint)) bitmaps; 
mapping(address => uint) nonces; 

bitmaps[nonce1] = 0000000......0000000000;
```


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

We have a demo on how to extend it into a sliding-window approach to support more than 256 concurrent transactions, but it doesn't explain the idea as clearly as above. 
