pragma solidity ^0.5.11;
pragma experimental ABIEncoderV2;

import "./BitFlipWithOrderingMetaTransaction.sol";

contract BroadcasterWithOrdering is BitFlipMetaWithOrderingTransaction {

    event PublicBroadcast(string message);

    function publicBroadcast(string memory _message, address _sender, uint _index, uint _toFlip, bytes memory _sig) public {

        // Throws if meta-transaction is not approved.
        isMetaTransactionApproved(keccak256(abi.encode(_message)), _sender, _index, _toFlip, _sig);

        emit PublicBroadcast(_message);
    }


}
