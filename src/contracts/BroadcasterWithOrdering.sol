pragma solidity ^0.5.11;
pragma experimental ABIEncoderV2;

import "./BitFlipWalletWithOrdering.sol";

contract BroadcasterWithOrdering is BitFlipMetaTransactionWithOrdering {

    event PublicBroadcast(string message);

    function publicBroadcast(string memory _message, address _addr, uint _index, uint _toFlip, bytes memory _sig) public {
        isMetaTransactionApproved("functionName", keccak256(abi.encode(_message)), _addr, _index, _toFlip, _sig);

        emit PublicBroadcast(_message);
    }
}
