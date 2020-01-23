import "./EIP712Dispatcher.sol";

contract TestImplementation is 
    // is an EIP 712 Dispatcher
    EIP712Dispatcher, 
    // GSN msg sender functionality
    GSNMsgSender, 
    // choose the replay protection
    BitFlipReplayProtection {
    
    // overrides
    string public constant name  = "Test implementation";
    string public constant version = "v0.1";
    uint public constant chainId = 1;
    
    
    //////////////////////////////
    // EIP712Dispatcher sidecar //
    // type
    string public constant TEST_FUNCTION_TYPE = "testFunction(address sender,uint amount,address to)";

    // content hash
    function encode_testFunction(uint amount, address to) public pure 
    returns(bytes32 contentHash, string memory contentType) {
        contentHash = keccak256(abi.encode(keccak256(abi.encodePacked(TEST_FUNCTION_TYPE)), amount, to));
        contentType = TEST_FUNCTION_TYPE;
    }
    // EIP712Dispatcher sidecar //
    //////////////////////////////

    
    mapping(address => uint) balances;
    function testFunction(uint amount, address to) public {
        address sender = _msgSender();
        require(balances[sender] >= amount, "Not enough balance");
        require(balances[to] + amount >= balances[to], "Overflow");
        balances[sender] = balances[sender] - amount;
        balances[to] = balances[to] + amount;
    }
}