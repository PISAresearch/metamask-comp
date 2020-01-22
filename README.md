# metamask-comp

tldr; We propose three different replay protection mechanisms. Afterwards we give an overview of the any.sender replay strategy. 

## Problem Statement

A meta-transaction lets a third party, relayer, to pay the gas price on behalf of someone else, the signer. It is useful when a user does not have access to the network’s native token (e.g. ether), but they want to perform some execution the network (e.g. transfer an ERC20 token).  

This competition seeks to propose a new standard function, isMetaTransactionApproved, that can be included in any new smart contract. 

## Standard Approach 


To the best of our knowledge, the standard way to support meta-transactions is to have a user sign the following message: 

``` Sig = Sign(nonce, contractAddress, calldata). ```

And for the contract to maintain a mapping of nonces: 

``` mapping(address => uint) nonces ```

## Our contribution 

We propose three approaches for replay protection of meta-transactions, but with a twist: 

* **Bitflip:** Smart contract maintains a bitmap and every new meta-transaction will flip a bit in the map. 
* **Bitflip with ordering:** Smart contract maintains a 256-bit bitmap that can be reset. Supports up to 256 concurrent transactions before a new nonce is required. 
* **MultiNonce** Supports unlimited concurrent transactions, but requires a storage overhead. 

## Proposal 1: Bitflip 

## Proposal 2: Bitflip with ordering 

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

**Concurrency*. All three proposed schemes support concurrency in slightly different ways. Bitflip offers the most flexibility as each transaction simply reserves a bit in the bitmap. So the user can publish 1, or 1000 transactions, and they will all be accepted in different orders. However the storage is always increasing by 1 bit per transaction and it cannot be deleted. This brings us to Bitflip-ordering which essentially lets us reset the bitmap periodically. So the user can authorise up to 256 meta-transactions and then reset the bitmap after they are all accepted. Finally, MultiNonce can support unlimited concurrent transactions, but we must store two integers (2*uints) per concurrent job. So if we want to support up to 50 concurrent jobs, then we need to store 100 integers forever. 

**Storage & Growth* Both Nonce (256-bit) and Bit-flip ordering (512 bit) have constant storage. Bit-flip ordering has the advantage that it can support up to 256 concurrent transactions, whereas nonce cannot. Bitflip's storage will always increase by 1 bit per metatransaction, whereas MultiNonce will have constant storage based on the maximum capacity of concurrent jobs required. 

Overall, while the nonce approach requires the least storage, it does not support concurrent jobs. Bitflip-ordering supports both ordered and concurrent jobs with just double the storage requirement of nonce. As well, MultiNonce supports both ordering & concurrency, but there is a tradeoff between storage requirements and the total number of in-flight meta-transactions. 
