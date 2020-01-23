pragma solidity ^0.5.11;

import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/cryptography/ECDSA.sol";

// taken from
// https://github.com/Arachnid/solidity-stringutils/blob/master/src/strings.sol
library StringUtils {
    struct slice {
        uint _len;
        uint _ptr;
    }

    function memcpy(uint dest, uint src, uint len) private pure {
        // Copy word-length chunks while possible
        for(; len >= 32; len -= 32) {
            assembly {
                mstore(dest, mload(src))
            }
            dest += 32;
            src += 32;
        }

        // Copy remaining bytes
        uint mask = 256 ** (32 - len) - 1;
        assembly {
            let srcpart := and(mload(src), not(mask))
            let destpart := and(mload(dest), mask)
            mstore(dest, or(destpart, srcpart))
        }
    }


        /*
     * @dev Copies a slice to a new string.
     * @param self The slice to copy.
     * @return A newly allocated string containing the slice's text.
     */
    function toString(slice memory self) internal pure returns (string memory) {
        string memory ret = new string(self._len);
        uint retptr;
        assembly { retptr := add(ret, 32) }

        memcpy(retptr, self._ptr, self._len);
        return ret;
    }

     /*
     * @dev Returns a newly allocated string containing the concatenation of
     *      `self` and `other`.
     * @param self The first slice to concatenate.
     * @param other The second slice to concatenate.
     * @return The concatenation of the two strings.
     */
    function concat(slice memory self, slice memory other) internal pure returns (string memory) {
        string memory ret = new string(self._len + other._len);
        uint retptr;
        assembly { retptr := add(ret, 32) }
        memcpy(retptr, self._ptr, self._len);
        memcpy(retptr + self._len, other._ptr, other._len);
        return ret;
    }

     /*
     * @dev Returns a slice containing the entire string.
     * @param self The string to make a slice from.
     * @return A newly allocated slice containing the entire string.
     */
    function toSlice(string memory self) internal pure returns (slice memory) {
        uint ptr;
        assembly {
            ptr := add(self, 0x20)
        }
        return slice(bytes(self).length, ptr);
    }
}

// Goals:
// 1. Supports standard transactions
// An implementing contract will likely want to continue supporting standard transactions
// even if it support meta transactions. As such the framework should allow this easily, indeed
// the development experience should change as little as possible. Ethereum transactions are
// signed using the eth_sign message, and cannot be signed using the eth_signTypedData method. As such
// existing functions should not try to valid data as if it had been encoded with the `encodeData` function
// specified in 712.
// These standard methods must also still exist so that they can be called by other contracts.

// Solution:
// Function are access in the normal way, by calling them directly with standard transactions

// 2. Support meta transactions - with EIP 712 encoding
// Meta transactions require at, a minimum,authorisation (in the form of a signature), 
// and replay protection. An implementing contract should be provided with standardised ways of doing both.
// The `encodeData` function described in 712 encodes type data at every level of a nested type. There
// is currently no general way to map from a ABI encoded type to a 712 encoded type. So the only
// option for a developer is to write hard coded encoding functions for each of their types. Hopefully
// Solidity could provide a native method, (or enough native behave to do so generally) for 712 encoding
// function in future as writing the encoding functions adds significant overhead to the development process.

// Solution:
// Functions are access via a dispatcher method which checks authorisation and replay protect.
// Types of replay protection is discussed elsewhere in this repo, any of the methods described are compatible with this contract.
// All that is noted here is that the protection must be encoded into a 712 type.

// In order to correctly check authorisation the dispatch method must encode the provided data and check the signature.
// Since the 712 encoding currently requires a hard coded encoding function for each of the types
// employed. In the context of a contract that corresponds to a type for each unique
// argument signature employed by the contract. For simplicity we enforce that all functions
// that can be called from dispatch have a corresponding encoding function. A Dapp developer
// is responsible for implementing these encoded functions, called here "sidecar" functions.
// These sidecar functions must be named by applying a specific prefix "encode_" to function
// they augment. They must also have the the same arguments.

// eg. function transfer(uint amount, address to)
// has sidecar:
// function encode_transfer(uint amount, address to)
// The sidecar function should encode and hash the provided data in an EIP 712 manner.

// 3. Msg.sender lookup
// Supporting meta transaction AND standard transactions adds the additional complexity of an unknown
// msg sender. If the a function was accessed by another contract or a standard ethereum transaction
// then the propertie msg.sender provides authenticated access to the original caller. However if a
// meta-transaction was used to access the function, the msg.sender would correspond to the relayer
// not the authenticating authority. This makes msg.sender no longer reliable for use. As such we need
// to provide a consolidated way for Dapp devs to access the transaction sender.

// Solution:
// msg.sender should no longer be used. Instead, we use the GSN/OpenZeppelin method of appending the msg sender
// to the call data and extracting it if we detect this is a meta transaction call. In the GSN they detect this
// by knowing the relayer contract, in this contract we detect that by assuming that if the calling contract is 
// "this" contract then it was a meta transaction. This means that those functions cannot be called internally using
// the "this" keyword, or "call", they can have however be invoked directly without the "this" keyword as this doesnt
// change msg.sender. Eg testFunction();


// adapted from https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/GSN/GSNRecipient.sol
contract GSNMsgSender {
       /**
     * @dev Replacement for msg.sender. Returns the actual sender of a transaction: msg.sender for regular transactions,
     * and the end-user for GSN relayed calls (where msg.sender is actually `RelayHub`).
     *
     * IMPORTANT: Contracts derived from {GSNRecipient} should never use `msg.sender`, and use {_msgSender} instead.
     */
    function _msgSender() internal view returns (address payable) {
        if (msg.sender != address(this)) {
            return msg.sender;
        } else {
            return _getRelayedCallSender();
        }
    }

    function _getRelayedCallSender() private pure returns (address payable result) {
        // We need to read 20 bytes (an address) located at array index msg.data.length - 20. In memory, the array
        // is prefixed with a 32-byte length value, so we first add 32 to get the memory read index. However, doing
        // so would leave the address in the upper 20 bytes of the 32-byte word, which is inconvenient and would
        // require bit shifting. We therefore subtract 12 from the read index so the address lands on the lower 20
        // bytes. This can always be done due to the 32-byte prefix.

        // The final memory read index is msg.data.length - 20 + 32 - 12 = msg.data.length. Using inline assembly is the
        // easiest/most-efficient way to perform this operation.

        // These fields are not accessible from assembly
        bytes memory array = msg.data;
        uint256 index = msg.data.length;

        // solhint-disable-next-line no-inline-assembly
        assembly {
            // Load the 32 bytes word from memory with the address on the lower 20 bytes, and mask those.
            result := and(mload(add(array, index)), 0xffffffffffffffffffffffffffffffffffffffff)
        }
        return result;
    }
}

interface IReplayProtection {
    function replayProtection(address sender, uint nonce1, uint nonce2) external;
}

contract BitFlipReplayProtection is IReplayProtection {
    mapping(address => mapping(uint => uint)) public bitmaps;

    function replayProtection(address _signer, uint _index, uint _toFlip) public {
        require(bitmaps[_signer][_index] & _toFlip != _toFlip, "Nonce already flipped.");
        bitmaps[_signer][_index] = bitmaps[_signer][_index] | _toFlip;
    }
}

/**
 * Base EIP712 Dispatcher contract
 *
 * Implementers guidlines
 * 1. Implement a side car function for every public function that you wish to have metatransaction support.
 * 2. Use _msgSender instead of msg.sender to get the sender
 * 3. Public functions cannot be called internally using call instructions or this. syntax. Instead the function
 *    must be invoked directly.
 */
contract EIP712Dispatcher is IReplayProtection {
    uint chainId;
    string version;
    string name;

    function getDomainSeparator() public view returns(bytes32) {
        return keccak256(abi.encode(
        keccak256(bytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")),
        keccak256(bytes(name)),
        keccak256(bytes(version)),
        chainId,
        address(this)));
    }

    function getDigest(bytes32 dataHash) public view returns(bytes32) {
        return keccak256(abi.encodePacked(
                "\x19\x01",
                getDomainSeparator(),
                dataHash
        ));
    }

    string constant DISPATCH_TYPE = "Dispatch(address signer,uint256 nonce1,uint256 nonce2,string functionSignature)";

    function dispatch(
        address signer,
        uint nonce1,
        uint nonce2,
        string memory functionSignature,
        bytes memory content,
        bytes memory signature
    ) public {
        // =============
        // AUTHORISATION
        // =============
        // create the digest and check the sig

        // locate the sidecar function
        bytes4 sidecarFunctionSignature = bytes4(keccak256(
            abi.encodePacked(
                StringUtils.concat(
                    StringUtils.toSlice(functionSignature), StringUtils.toSlice("encode_"))
                )
            )
        );
        
        // use the side car to hash the content and extract the contentAddress
        (bool success, bytes memory result) = address(this).call(abi.encodePacked(sidecarFunctionSignature, content));
        require(success, "Content hasher threw an error.");
        
        // the sidecar returns the content hash and an extracted content address
        (bytes32 contentHash, string memory contentType) = abi.decode(result, (bytes32, string));

        // we need the full typehas to create the dispatch typehash
        string memory dispatcherTypeHash = StringUtils.concat(StringUtils.toSlice(DISPATCH_TYPE), StringUtils.toSlice(contentType));
        
        bytes32 digest = keccak256(abi.encode(
            dispatcherTypeHash,
            signer,
            nonce1,
            nonce2,
            functionSignature,
            contentHash
        ));
        // validate the signature
        require(signer == ECDSA.recover(ECDSA.toEthSignedMessageHash(digest), signature), "Invalid signature.");


        // =================
        // REPLAY PREVENTION
        // =================
        // choose whatever replay protection has been inherited
        IReplayProtection(this).replayProtection(signer, nonce1, nonce2);


        // =============
        // MSGSENDER SET
        // =============        
        // Appending the from address as GSN do: https://github.com/openeth-dev/gsn/blob/master/contracts/RelayHub.sol#L319
        bytes memory contentAndSigner = abi.encodePacked(content, signer);
        

        // ========
        // DISPATCH
        // ========
        // find the target, and call with the content
        bytes4 targetFunction = bytes4(keccak256(abi.encodePacked(functionSignature)));
        address(this).call(abi.encodePacked(targetFunction, contentAndSigner));
    }
}