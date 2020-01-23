import "./Lib.sol";


interface IReplayProtection {
    function replayProtection(address sender, uint nonce1, uint nonce2) external;
}

// The simplest replay protection - others are available in this repo.
contract BitFlipReplayProtection is IReplayProtection {
    mapping(address => mapping(uint => uint)) public bitmaps;

    function replayProtection(address _signer, uint _index, uint _toFlip) public {
        require(bitmaps[_signer][_index] & _toFlip != _toFlip, "Nonce already flipped.");
        bitmaps[_signer][_index] = bitmaps[_signer][_index] | _toFlip;
    }
}

contract BitFlipSlidingWindow is IReplayProtection {
    uint[3] nonce1s;
    uint[3] nonce2s;
    uint constant MAX_UINT = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
    
    constructor() public {
        nonce1s[1] = 1;
    }
    
    function replayProtection(address signer, uint16 index, uint nonce2) public {
        uint prevIndex = index + 2 % 3;
        uint nextIndex = index + 1 % 3;
        
        // the next index must already be incremented before we can use this index
        require(nonce1s[nextIndex] == nonce1s[index] + 1, "Next nonce not incremented.");
        
        // require that the nonce2 has yet to be used
        require(nonce2s[index] & nonce2 != nonce2, "Nonce2 already used.");
        
        // try to increment the previous nonce
        if(nonce2s[prevIndex] == MAX_UINT) {
            nonce2s[prevIndex] = 0;
            nonce1s[prevIndex] = nonce1s[prevIndex] + 1;
        }
    }
}