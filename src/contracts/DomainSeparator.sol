pragma solidity ^0.5.11;
pragma experimental ABIEncoderV2;

contract DomainSeparator {

    string public constant name  = "Public Broadcast Service";
    string public constant version = "v0.1";
    uint public constant chainId = 1;

    function getDomainSeparator() public view returns(bytes32) {
        return keccak256(abi.encode(
        keccak256(bytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")),
        keccak256(bytes(name)),
        keccak256(bytes(version)),
        chainId,
        address(this)));
    }

    function getDigest(bytes memory encoded) public view returns(bytes32) {

        return keccak256(abi.encodePacked(
                "\x19\x01",
                getDomainSeparator(),
                keccak256(encoded)
        ));
    }
}