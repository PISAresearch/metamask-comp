
## Proposal 3: MultiNonce 

The problem with the Bitflip ordering approach: 
* It cannot sustain N concurrent and in-flight meta-transactions at any time. (e.g. it supports up to 256-bit metatransactions before a reset is required). 

To overcome that issue, we propose MultiNonce. A good way to conceptualise MultiNonce is that nonce1 is used to create a concurrency slots [0,...,N] (i.e. like a highway) and nonce2 is the job's queue number for a given slot (i.e. the 3rd car in the queue for highway 1). 

Let's illustrate it with an example: 

```
Slot(nonce1) Nonce (nonce2)  
[0]   ---->    2
[1]   ---->.   3
[2]   ---->    0
 
```

If we want to send a meta-transaction using slot [0], then nonce1=0 and nonce2=3. This is because the largest nonce seen so far by the contract for slot [0] is nonce 2. So we need a larger nonce before sending the meta-transaction. 

What is nice about the proposal is that we can send up to N concurrent and in-flight meta transactions at any given time. Whenever a job completes for a given slot, we can send a new job down that slot. Very useful for high throughput signers. 

## How does the replay protection work? 

As mentioned, we have both a nonce and a bitmap. The former lets us order transactions, the latter lets us support concurrent and in-flight meta-transactions. 

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
