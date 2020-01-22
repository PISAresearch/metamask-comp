# Towards a meta-transaction standard

tldr; We propose a single function, isMetaTransactionApproved(), that can be included in any smart contract. We have three different replay protection proposals, Bitflip, Bitflip-ordering and MultiNonce, that can be implemented in this function. Our goal is to support concurrent in-flight meta-transactions with minimum storage requirements. Afterwards, we provide an overview of the any.sender architecture that is close to ready for launch. 

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

* **[Bitflip:](https://github.com/PISAresearch/metamask-comp/tree/master/src/contracts/BitFlipMetaTransaction/README.md)** The smart contract has a bitmap and every meta-transaction will flip a bit in the map. 
* **[Bitflip with ordering:](https://github.com/PISAresearch/metamask-comp/blob/master/src/contracts/BitFlipWithOrderingMetaTransaction/README.md)** Again, the smart contract maintains a 256-bit bitmap and it will reset the bitmap when 256 meta-transactions are processed. Supports up to 256 meta-transactions at a time, in any order.
* **[MultiNonce:](https://github.com/PISAresearch/metamask-comp/tree/master/src/contracts/MultiNonceMetaTransaction)** Supports unlimited concurrent and ordered transactions, but its storage overhead is 512-bit for each concurrent transaction. 

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


## Overview of our replay protection proposals. 

Our goal is to support concurrent 


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


