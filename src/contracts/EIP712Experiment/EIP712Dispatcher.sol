pragma solidity ^0.5.11;

import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/cryptography/ECDSA.sol";
import "./ReplayProtection.sol";
import "./Lib.sol";


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

    // helper domain functions
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
                    StringUtils.toSlice("encode_"), StringUtils.toSlice(functionSignature))
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