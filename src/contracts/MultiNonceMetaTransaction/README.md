
## Proposal 3: MultiNonce 

The problem with the Bitflip ordering approach: 
* It cannot sustain N concurrent and in-flight meta-transactions at any time. (e.g. it supports up to 256-bit metatransactions before a reset is required). 

To overcome that issue, we propose MultiNonce. A good way to conceptualise MultiNonce is that nonce1 is used to create a concurrency slots [0,...,N] (i.e. like a highway) and nonce2 is the job's queue number for a given slot (i.e. the 3rd car in the queue for highway 1). 

Let's illustrate it with an example: 

```
Slot        Nonce  
[0]   ---->    2
[1]   ---->   3
[2]   ---->    0
 
```
Note: slot = nonce1, and nonce = 2. 

If we want to send a meta-transaction using slot [0], then nonce1=0 and nonce2=3. This is because the largest nonce seen so far by the contract for slot [0] is nonce 2. So we need a larger nonce before sending the meta-transaction. 

What is nice about the proposal is that we can send up to N concurrent and in-flight meta transactions at any given time. Whenever a job completes for a given slot, we can send a new job down that slot. Very useful for high throughput signers. 

## How does the replay protection work? 

We have two nonces:

- *nonce1:* Concurrency slot. 
- *nonce2:* The ith job in a given slot. 

In the contract, it is implemented:

```
mapping(address => mapping(uint => uint)) public multiNonce;
```

When the replay protection contract receives a new meta-transaction, it performs:

```
For the slot, nonce1, is nonce2 the largest nonce witnessed so far?
````

So in a way, it is essentially the same as the Nonce standard. Order is perserved per slot, but with the option to perform concurrent and in-flight meta-tranasactions using the slots. 

We implement it: 

```
    /**
     * Supports concurrent transactions and order.
     * - Concurrency is achieved with nonce1
     * - Order is achieved with nonce2
     * @param _signer Approver's address
     * @param _msgHash Application-specific content
     * @param _nonce1 Keeps track of latest nonce2
     * @param _nonce2 Replace-by-version
     * @param _sig Signature
     */
    function isMetaTransactionApproved(bytes32 _msgHash, address _signer, uint _nonce1,
    uint _nonce2, bytes memory _sig) public {

        bytes32 h = keccak256(abi.encode(address(this), _msgHash, _nonce1, _nonce2));
        require(_signer == ECDSA.recover(ECDSA.toEthSignedMessageHash(h), _sig), "Bad signature");
        
        // If we want to enforce one-by-one acceptance. Otherwise can just do _nonce2 > ...
        require(_nonce2 == multiNonce[_signer][_nonce1]+1, "Nonce2 is too small");

        multiNonce[_signer][_nonce1] = _nonce2;
    }
```

