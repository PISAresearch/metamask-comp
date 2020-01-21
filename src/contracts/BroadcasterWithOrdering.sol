pragma solidity ^0.5.11;
pragma experimental ABIEncoderV2;

import "./BitFlipWalletWithOrdering.sol";

contract BroadcasterWithOrdering is BitFlipMetaTransactionWithOrdering {

    event PublicBroadcast(string message);

    function publicBroadcast(string memory _message, address _sender, uint _index, uint _toFlip, bytes memory _sig) public {

        // To support ERC712, we can remove signature from replay protection
        // and include it as a field in ERC712.
        isMetaTransactionApproved(keccak256(abi.encode(_message)), _sender, _index, _toFlip, _sig);

        emit PublicBroadcast(_message);
    }


}
