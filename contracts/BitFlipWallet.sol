pragma solidity ^0.5.11;
pragma experimental ABIEncoderV2;

import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/cryptography/ECDSA.sol";

contract BitFlipWallet {
    mapping(address => mapping(uint => uint)) public bitmaps;

    event PublicBroadcast(string message);
    event test(uint stored, uint flip, uint result);

    /**
     * Supports unlimited number of concurrent meta-transactions with minimal storage requirements.
     * @param _signer Approver's address
     * @param _h Application-specific content
     * @param _index Bitmap index
     * @param _flip Bit in the bitmap
     * @param _sig Signature
     */
    function isMetaTransactionApproved(bytes32 _h, address _signer, uint _index, uint _flip, bytes memory _sig) public {

        // EIP712 can be included in "h", no need to enforce in standard.
        bytes32 h = keccak256(abi.encode(address(this), _h, _index, _flip));
        require(_signer == ECDSA.recover(ECDSA.toEthSignedMessageHash(h), _sig), "Bad signature");
        require(_flip != 0, "Signer must be trying to flip at least one bit");
        require(bitmaps[_signer][_index] & _flip != _flip, "Nonce already flipped.");

        bitmaps[_signer][_index] = bitmaps[_signer][_index] | _flip;
    }

    // Used for simple testing. Not production-code.
    function isBitmapSet(address _signer, uint _index, uint _flip) public view returns (bool) {
        return bitmaps[_signer][_index] & _flip == _flip;
    }

    function publicBroadcast(string memory _message, address _addr, uint _index, uint _flip, bytes memory _sig) public {
        isMetaTransactionApproved(keccak256(abi.encode(_message)), _addr, _index, _flip, _sig);

        emit PublicBroadcast(_message);
    }

}
