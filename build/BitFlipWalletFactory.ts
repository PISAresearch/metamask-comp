/* Generated by ts-generator ver. 0.0.8 */
/* tslint:disable */

import { Contract, ContractFactory, Signer } from "ethers";
import { Provider } from "ethers/providers";
import { UnsignedTransaction } from "ethers/utils/transaction";

import { BitFlipWallet } from "./BitFlipWallet";

export class BitFlipWalletFactory extends ContractFactory {
  constructor(signer?: Signer) {
    super(_abi, _bytecode, signer);
  }

  deploy(): Promise<BitFlipWallet> {
    return super.deploy() as Promise<BitFlipWallet>;
  }
  getDeployTransaction(): UnsignedTransaction {
    return super.getDeployTransaction();
  }
  attach(address: string): BitFlipWallet {
    return super.attach(address) as BitFlipWallet;
  }
  connect(signer: Signer): BitFlipWalletFactory {
    return super.connect(signer) as BitFlipWalletFactory;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): BitFlipWallet {
    return new Contract(address, _abi, signerOrProvider) as BitFlipWallet;
  }
}

const _abi = [
  {
    constant: false,
    inputs: [
      {
        internalType: "bytes32",
        name: "_h",
        type: "bytes32"
      },
      {
        internalType: "address",
        name: "_signer",
        type: "address"
      },
      {
        internalType: "uint256",
        name: "_index",
        type: "uint256"
      },
      {
        internalType: "uint256",
        name: "_flip",
        type: "uint256"
      },
      {
        internalType: "bytes",
        name: "_sig",
        type: "bytes"
      }
    ],
    name: "isMetaTransactionApproved",
    outputs: [],
    payable: false,
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    constant: true,
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address"
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
      }
    ],
    name: "bitmaps",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
      }
    ],
    payable: false,
    stateMutability: "view",
    type: "function"
  },
  {
    constant: true,
    inputs: [
      {
        internalType: "address",
        name: "_signer",
        type: "address"
      },
      {
        internalType: "uint256",
        name: "_index",
        type: "uint256"
      },
      {
        internalType: "uint256",
        name: "_flip",
        type: "uint256"
      }
    ],
    name: "isBitmapSet",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool"
      }
    ],
    payable: false,
    stateMutability: "view",
    type: "function"
  },
  {
    constant: false,
    inputs: [
      {
        internalType: "string",
        name: "_message",
        type: "string"
      },
      {
        internalType: "address",
        name: "_addr",
        type: "address"
      },
      {
        internalType: "uint256",
        name: "_index",
        type: "uint256"
      },
      {
        internalType: "uint256",
        name: "_flip",
        type: "uint256"
      },
      {
        internalType: "bytes",
        name: "_sig",
        type: "bytes"
      }
    ],
    name: "publicBroadcast",
    outputs: [],
    payable: false,
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "string",
        name: "message",
        type: "string"
      }
    ],
    name: "PublicBroadcast",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "stored",
        type: "uint256"
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "flip",
        type: "uint256"
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "result",
        type: "uint256"
      }
    ],
    name: "test",
    type: "event"
  }
];

const _bytecode =
  "0x608060405234801561001057600080fd5b50610cf0806100206000396000f3fe608060405234801561001057600080fd5b506004361061004c5760003560e01c8063066fd95d14610051578063129d2a711461006d578063e431c2e91461009d578063f5c24915146100cd575b600080fd5b61006b600480360361006691908101906106a1565b6100e9565b005b61008760048036036100829190810190610616565b61031e565b6040516100949190610ae5565b60405180910390f35b6100b760048036036100b29190810190610652565b610343565b6040516100c49190610a03565b60405180910390f35b6100e760048036036100e29190810190610730565b6103a2565b005b60003086858560405160200161010294939291906109be565b60405160208183030381529060405280519060200120905061012c61012682610413565b83610443565b73ffffffffffffffffffffffffffffffffffffffff168573ffffffffffffffffffffffffffffffffffffffff1614610199576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161019090610ac5565b60405180910390fd5b60008314156101dd576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016101d490610a85565b60405180910390fd5b82836000808873ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600087815260200190815260200160002054161415610271576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161026890610aa5565b60405180910390fd5b826000808773ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600086815260200190815260200160002054176000808773ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600086815260200190815260200160002081905550505050505050565b6000602052816000526040600020602052806000526040600020600091509150505481565b600081826000808773ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600086815260200190815260200160002054161490509392505050565b6103d5856040516020016103b69190610a63565b60405160208183030381529060405280519060200120858585856100e9565b7f60705fd48aef44d339a626ea808513f0eddffd91542f10945507c135acabc6db856040516104049190610a63565b60405180910390a15050505050565b6000816040516020016104269190610998565b604051602081830303815290604052805190602001209050919050565b600060418251146104575760009050610529565b60008060006020850151925060408501519150606085015160001a90507f7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a08260001c11156104ab5760009350505050610529565b601b8160ff16141580156104c35750601c8160ff1614155b156104d45760009350505050610529565b600186828585604051600081526020016040526040516104f79493929190610a1e565b6020604051602081039080840390855afa158015610519573d6000803e3d6000fd5b5050506020604051035193505050505b92915050565b60008135905061053e81610c68565b92915050565b60008135905061055381610c7f565b92915050565b600082601f83011261056a57600080fd5b813561057d61057882610b2d565b610b00565b9150808252602083016020830185838301111561059957600080fd5b6105a4838284610c0b565b50505092915050565b600082601f8301126105be57600080fd5b81356105d16105cc82610b59565b610b00565b915080825260208301602083018583830111156105ed57600080fd5b6105f8838284610c0b565b50505092915050565b60008135905061061081610c96565b92915050565b6000806040838503121561062957600080fd5b60006106378582860161052f565b925050602061064885828601610601565b9150509250929050565b60008060006060848603121561066757600080fd5b60006106758682870161052f565b935050602061068686828701610601565b925050604061069786828701610601565b9150509250925092565b600080600080600060a086880312156106b957600080fd5b60006106c788828901610544565b95505060206106d88882890161052f565b94505060406106e988828901610601565b93505060606106fa88828901610601565b925050608086013567ffffffffffffffff81111561071757600080fd5b61072388828901610559565b9150509295509295909350565b600080600080600060a0868803121561074857600080fd5b600086013567ffffffffffffffff81111561076257600080fd5b61076e888289016105ad565b955050602061077f8882890161052f565b945050604061079088828901610601565b93505060606107a188828901610601565b925050608086013567ffffffffffffffff8111156107be57600080fd5b6107ca88828901610559565b9150509295509295909350565b6107e081610bac565b82525050565b6107ef81610bbe565b82525050565b6107fe81610bca565b82525050565b61081561081082610bca565b610c4d565b82525050565b600061082682610b85565b6108308185610b90565b9350610840818560208601610c1a565b61084981610c57565b840191505092915050565b6000610861601c83610ba1565b91507f19457468657265756d205369676e6564204d6573736167653a0a3332000000006000830152601c82019050919050565b60006108a1602e83610b90565b91507f5369676e6572206d75737420626520747279696e6720746f20666c697020617460008301527f206c65617374206f6e65206269740000000000000000000000000000000000006020830152604082019050919050565b6000610907601683610b90565b91507f4e6f6e636520616c726561647920666c69707065642e000000000000000000006000830152602082019050919050565b6000610947600d83610b90565b91507f426164207369676e6174757265000000000000000000000000000000000000006000830152602082019050919050565b61098381610bf4565b82525050565b61099281610bfe565b82525050565b60006109a382610854565b91506109af8284610804565b60208201915081905092915050565b60006080820190506109d360008301876107d7565b6109e060208301866107f5565b6109ed604083018561097a565b6109fa606083018461097a565b95945050505050565b6000602082019050610a1860008301846107e6565b92915050565b6000608082019050610a3360008301876107f5565b610a406020830186610989565b610a4d60408301856107f5565b610a5a60608301846107f5565b95945050505050565b60006020820190508181036000830152610a7d818461081b565b905092915050565b60006020820190508181036000830152610a9e81610894565b9050919050565b60006020820190508181036000830152610abe816108fa565b9050919050565b60006020820190508181036000830152610ade8161093a565b9050919050565b6000602082019050610afa600083018461097a565b92915050565b6000604051905081810181811067ffffffffffffffff82111715610b2357600080fd5b8060405250919050565b600067ffffffffffffffff821115610b4457600080fd5b601f19601f8301169050602081019050919050565b600067ffffffffffffffff821115610b7057600080fd5b601f19601f8301169050602081019050919050565b600081519050919050565b600082825260208201905092915050565b600081905092915050565b6000610bb782610bd4565b9050919050565b60008115159050919050565b6000819050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000819050919050565b600060ff82169050919050565b82818337600083830152505050565b60005b83811015610c38578082015181840152602081019050610c1d565b83811115610c47576000848401525b50505050565b6000819050919050565b6000601f19601f8301169050919050565b610c7181610bac565b8114610c7c57600080fd5b50565b610c8881610bca565b8114610c9357600080fd5b50565b610c9f81610bf4565b8114610caa57600080fd5b5056fea365627a7a72315820a175a77cd8592005a9f4cb5b25dbadedb55910d84b53cb20d6b02566e983d2756c6578706572696d656e74616cf564736f6c634300050b0040";
