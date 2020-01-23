# Addendum - EIP 712 Experiment

## Implementers guidelines

To implement MetaTransactions in your contract, do the following
0. Inherit from EIP712Dispatcher
1. Inherit from a replay protect contract matching IReplayProtection
1. Implement a side car function for every public function that you wish to have metatransaction support.
2. Use _msgSender instead of msg.sender to get the sender in all functions
3. Remove any function calls of the form `this.function()` and `this.call()`. Public functions cannot be called internally using call instructions or this. syntax. Instead the function must be invoked directly. eg `function()`


## EIP712Dispatcher Goals and Solution

### 1. Support standard transactions
**Goal:** An implementing contract will likely want to continue supporting standard transactions even if it support meta transactions. As such the framework should allow this easily, indeed the development experience should change as little as possible. Ethereum transactions are signed using the eth_sign message, and cannot be signed using the eth_signTypedData method. As such existing functions should not try to valid data as if it had been encoded with the `encodeData` function specified in 712. These standard methods must also still exist so that they can be called by other contracts.

**Solution:** Function are access in the normal way, by calling them directly with standard transactions

### 2. Support meta transactions - with EIP 712 encoding
**Goal:** Meta transactions require at, a minimum,authorisation (in the form of a signature), and replay protection. An implementing contract should be provided with standardised ways of doing both. The `encodeData` function described in 712 encodes type data at every level of a nested type. There is currently no general way to map from a ABI encoded type to a 712 encoded type. So the only option for a developer is to write hard coded encoding functions for each of their types. Hopefully Solidity could provide a native method, (or enough native behave to do so generally) for 712 encoding function in future as writing the encoding functions adds significant overhead to the development process.

**Solution:** Functions are access via a dispatcher method which checks authorisation and replay protect. Types of replay protection is discussed elsewhere in this repo, any of the methods described are compatible with this contract.
All that is noted here is that the protection must be encoded into a 712 type.

In order to correctly check authorisation the dispatch method must encode the provided data and check the signature. Since the 712 encoding currently requires a hard coded encoding function for each of the types employed. In the context of a contract that corresponds to a type for each unique argument signature employed by the contract. For simplicity we enforce that all functions that can be called from dispatch have a corresponding encoding function. A Dapp developer is responsible for implementing these encoded functions, called here "sidecar" functions. These sidecar functions must be named by applying a specific prefix "encode_" to function they augment. They must also have the the same arguments.

eg. function transfer(uint amount, address to)
has sidecar:
function encode_transfer(uint amount, address to)
The sidecar function should encode and hash the provided data in an EIP 712 manner.

### 3. Msg.sender lookup
**Goal:** Supporting meta transaction AND standard transactions adds the additional complexity of an unknown msg sender. If the a function was accessed by another contract or a standard ethereum transaction then the propertie msg.sender provides authenticated access to the original caller. However if a meta-transaction was used to access the function, the msg.sender would correspond to the relayer not the authenticating authority. This makes msg.sender no longer reliable for use. As such we need to provide a consolidated way for Dapp devs to access the transaction sender.

**Solution:** msg.sender should no longer be used. Instead, we use the GSN/OpenZeppelin method of appending the msg sender to the call data and extracting it if we detect this is a meta transaction call. In the GSN they detect this by knowing the relayer contract, in this contract we detect that by assuming that if the calling contract is "this" contract then it was a meta transaction. This means that those functions cannot be called internally using the "this" keyword, or "call", they can have however be invoked directly without the "this" keyword as this doesnt change msg.sender. Eg testFunction();