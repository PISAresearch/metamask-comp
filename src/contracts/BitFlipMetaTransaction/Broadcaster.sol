
pragma solidity ^0.5.11;
pragma experimental ABIEncoderV2;

import "./BitFlipWallet.sol";

contract Broadcaster is BitFlipMetaTransaction {

    event PublicBroadcast(string message);

    function publicBroadcast(string memory _message, address _addr, uint _nonce1, uint _nonce2, bytes memory _sig) public {
        isMetaTransactionApproved(keccak256(abi.encode(_message)), _addr, _nonce1, _nonce2, _sig);

        emit PublicBroadcast(_message);
    }
}
