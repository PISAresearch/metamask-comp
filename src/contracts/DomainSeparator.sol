pragma solidity ^0.5.11;
pragma experimental ABIEncoderV2;

contract DomainSeparator {

    string public constant name  = "Public Broadcast Service";
    string public constant version = "v0.1";
    uint public constant chainId = 1;

    function getDomainSeparator(string memory EIP712Domain) public view returns(bytes32) {
        return keccak256(abi.encode(
        keccak256(bytes(EIP712Domain)),
        keccak256(bytes(name)),
        keccak256(bytes(version)),
        chainId,
        address(this)));
    }
}