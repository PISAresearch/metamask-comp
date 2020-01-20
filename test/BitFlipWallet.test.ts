import "mocha";
import * as chai from "chai";
import {
  solidity,
  deployContract,
  createMockProvider,
  getWallets,
  loadFixture
} from "ethereum-waffle";
import * as BitFlipWalletJson from "../build/BitFlipWallet.json";
import { BigNumber, arrayify, defaultAbiCoder, keccak256 } from "ethers/utils";
import { Provider, JsonRpcProvider } from "ethers/providers";
import { Wallet, Contract } from "ethers";

const expect = chai.expect;
chai.use(solidity);

describe("Replay Protection", () => {
  const provider = createMockProvider();
  const [wallet] = getWallets(provider);

  async function deployBitFlipWallet(provider: Provider, [signer]: Wallet[]) {
    const bitFlipWallet = await deployContract(
      wallet, // a wallet to sign transactions
      BitFlipWalletJson
    );

    return {
      provider: provider as JsonRpcProvider,
      signer,
      bitFlipWallet
    }; // an ethers 'Contract' class instance
  }

  async function flip5And10And225(provider: Provider, [signer]: Wallet[]) {
    const { bitFlipWallet } = await deployBitFlipWallet(provider, [signer]);

    const toFlip = [
      new BigNumber("5"),
      new BigNumber("10"),
      new BigNumber("255")
    ];

    let bitmap = new BigNumber("0");

    for (let i = 0; i < toFlip.length; i++) {
      // Fresh nonce
      const nonce = new BigNumber("0");

      const flipped = await setupFlip(
        nonce,
        bitmap,
        toFlip[i],
        bitFlipWallet,
        signer
      );

      bitmap = flipped;
    }

    return {
      provider: provider as JsonRpcProvider,
      signer,
      bitFlipWallet
    };
  }

  async function setupFlip(
    nonce: BigNumber,
    bitmap: BigNumber,
    index: BigNumber,
    bitFlipWallet: Contract,
    signer: Wallet
  ): Promise<BigNumber> {
    const flipped = flipBit(bitmap, index);

    // Signer issues a command for the 0th index of the nonce
    const encoded = defaultAbiCoder.encode(
      ["address", "bytes32", "uint", "uint"],
      [
        bitFlipWallet.address,
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        nonce,
        flipped
      ]
    );
    const h = keccak256(encoded);
    const sig = await signer.signMessage(arrayify(h));
    await bitFlipWallet.isMetaTransactionApproved(
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      signer.address,
      nonce,
      flipped,
      sig
    );

    return flipped;
  }

  it("sets the flipbit correctly. pass (hardcoded) ", async () => {
    const { signer, bitFlipWallet } = await loadFixture(deployBitFlipWallet);

    // Flip the 0th index.
    const nonce = new BigNumber("0");
    const bitmap = new BigNumber("0");
    const indexToFlip = new BigNumber("0");
    const flipped = await setupFlip(
      nonce,
      bitmap,
      indexToFlip,
      bitFlipWallet,
      signer
    );

    expect(await bitFlipWallet.isBitmapSet(signer.address, nonce, flipped)).to
      .be.true;
  }).timeout(5000);

  it("fails to flip the same bit twice.", async () => {
    const { signer, bitFlipWallet } = await loadFixture(deployBitFlipWallet);

    // Fresh nonce
    let nonce = new BigNumber("0");

    // Flip the 0th index.
    let update = flipBit(new BigNumber("0"), new BigNumber("1"));

    // Signer issues a command for the 0th index of the nonce
    let encoded = defaultAbiCoder.encode(
      ["address", "bytes32", "uint", "uint"],
      [
        bitFlipWallet.address,
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        nonce,
        update
      ]
    );
    let h = keccak256(encoded);
    const sig = await signer.signMessage(arrayify(h));
    await bitFlipWallet.isMetaTransactionApproved(
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      signer.address,
      nonce,
      update,
      sig
    );

    // Issue the command like a boyo.
    expect(await bitFlipWallet.isBitmapSet(signer.address, nonce, update)).to.be
      .true;

    // Should fail as bitmap is already set
    await expect(
      bitFlipWallet.isMetaTransactionApproved(
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        signer.address,
        nonce,
        update,
        sig
      )
    ).to.be.reverted;
  }).timeout(5000);

  it("all bits already set", async () => {
    const { signer, bitFlipWallet } = await loadFixture(flip5And10And225);

    // Flip the 0th index.
    const nonce = new BigNumber("0");
    const bitmap = new BigNumber("0");
    const toFlip = [5, 10, 255];

    // Check individual bits
    for (let i = 0; i < toFlip.length; i++) {
      let indexToFlip = new BigNumber(toFlip[i]);
      const flipped = flipBit(bitmap, indexToFlip);

      // Issue the command like a boyo.
      expect(await bitFlipWallet.isBitmapSet(signer.address, nonce, flipped)).to
        .be.true;
    }

    // Check combined bits
    let bits = bitmap;
    for (let i = 0; i < toFlip.length; i++) {
      let indexToFlip = new BigNumber(toFlip[i]);
      bits = flipBit(bits, indexToFlip);
    }

    // Issue the command like a boyo.
    expect(await bitFlipWallet.isBitmapSet(signer.address, nonce, bits)).to.be
      .true;
  }).timeout(5000);

  it("some bits preset, but can still detect new flips", async () => {
    const { signer, bitFlipWallet } = await loadFixture(flip5And10And225);

    // Flip the 0th index.
    const nonce = new BigNumber("0");
    let bitmap = new BigNumber("0");

    const toFlip = [5, 11, 252];
    for (let i = 0; i < toFlip.length; i++) {
      let indexToFlip = new BigNumber(toFlip[i]);
      bitmap = flipBit(bitmap, indexToFlip);
    }

    // Issue the command like a boyo.
    expect(await bitFlipWallet.isBitmapSet(signer.address, nonce, bitmap)).to.be
      .false;
  }).timeout(5000);

  /**
   * Flip a bit!
   * @param bits 256 bits
   * @param toFlip index to flip (0,...,255)
   */
  function flipBit(bits: BigNumber, indexToFlip: BigNumber): BigNumber {
    return new BigNumber(bits).add(new BigNumber(2).pow(indexToFlip));
  }
});
