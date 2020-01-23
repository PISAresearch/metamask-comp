pragma solidity ^0.5.11;
pragma experimental ABIEncoderV2;

import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/cryptography/ECDSA.sol";

contract BitFlipMetaTransaction {
    mapping(address => mapping(uint => uint)) public bitmaps;

    /**
     * Supports unlimited number of concurrent meta-transactions with minimal storage requirements.
     * @param _signer Approver's address
     * @param _h Application-specific content
     * @param _index Bitmap index
     * @param _toFlip Bit in the bitmap
     * @param _sig Signature
     */
    function isMetaTransactionApproved(bytes32 _h, address _signer, uint _index, uint _toFlip, bytes memory _sig) public {

        // EIP712 can be included in "h", no need to enforce in standard.
        verifySignature(_signer, _h, keccak256(abi.encode(_signer, _index, _toFlip), _sig));
        replayProtection(_signer, _index, _toFlip); 
    }

    function verifySignature(address _signer, bytes32 _data, bytes32 _replayprotection, bytes _sig, ) public {
        bytes32 h = keccak256(abi.encode(address(this), _data, _replayprotection));
        require(_signer == ECDSA.recover(ECDSA.toEthSignedMessageHash(h), _sig), "Bad signature");
    }

    function replayProtection(address _signer, uint _index, uint _toFlip) { 
        require(bitmaps[_signer][_index] & _toFlip != _toFlip, "Nonce already flipped.");

        bitmaps[_signer][_index] = bitmaps[_signer][_index] | _toFlip;
    }

    // Used for simple testing. Not production-code.
    function isBitmapSet(address _signer, uint _index, uint _flip) public view returns (bool) {
        return bitmaps[_signer][_index] & _flip == _flip;
    }

}
