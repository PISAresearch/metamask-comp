pragma solidity ^0.5.11;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/cryptography/ECDSA.sol";

contract MultiNonceMetaTransaction {
    mapping(address => mapping(uint => uint)) public multiNonce;

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
        require(_nonce2 == (multiNonce[_signer][_nonce1]+1), "One-at-a-time order enforced. Nonce2 is too small");

        multiNonce[_signer][_nonce1] = _nonce2;
    }

    // Used for simple testing. Not production-code.
    function getNonce(address _signer, uint _nonce1) public view returns (uint) {
        return multiNonce[_signer][_nonce1];
    }

}
