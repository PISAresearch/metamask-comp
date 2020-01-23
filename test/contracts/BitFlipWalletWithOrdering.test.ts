import "mocha";
import * as chai from "chai";
import {
  solidity,
  deployContract,
  createMockProvider,
  getWallets,
  loadFixture
} from "ethereum-waffle";
import * as Broadcaster from "../../build/BroadcasterWithOrdering.json";
import { BigNumber, arrayify, defaultAbiCoder, keccak256 } from "ethers/utils";
import { Provider, JsonRpcProvider } from "ethers/providers";
import { Wallet, Contract } from "ethers";

const expect = chai.expect;
chai.use(solidity);

describe("BitFlip with optional ordering MetaTransaction", () => {
  const provider = createMockProvider();
  const [wallet] = getWallets(provider);

  async function deployBroadcaster(provider: Provider, [signer]: Wallet[]) {
    const broadcaster = await deployContract(
      wallet, // a wallet to sign transactions
      Broadcaster
    );

    return {
      provider: provider as JsonRpcProvider,
      signer,
      broadcaster
    }; // an ethers 'Contract' class instance
  }

  async function flip5And10And225(provider: Provider, [signer]: Wallet[]) {
    const { broadcaster } = await deployBroadcaster(provider, [signer]);
    // Fresh nonce
    const nonce = new BigNumber("1");
    const toFlip = [
      new BigNumber("5"),
      new BigNumber("10"),
      new BigNumber("255")
    ];

    let bitmap = new BigNumber("0");

    for (let i = 0; i < toFlip.length; i++) {
      const flipped = await setupFlip(
        nonce,
        bitmap,
        toFlip[i],
        broadcaster,
        signer
      );

      bitmap = flipped;
    }

    return {
      provider: provider as JsonRpcProvider,
      signer,
      broadcaster
    };
  }

  async function setupFlip(
    nonce: BigNumber,
    bitmap: BigNumber,
    index: BigNumber,
    broadcaster: Contract,
    signer: Wallet
  ): Promise<BigNumber> {
    const flipped = flipBit(bitmap, index);

    // Signer issues a command for the 0th index of the nonce
    const encoded = defaultAbiCoder.encode(
      ["address", "bytes32", "uint", "uint"],
      [
        broadcaster.address,
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        nonce,
        flipped
      ]
    );
    const h = keccak256(encoded);
    const sig = await signer.signMessage(arrayify(h));
    await broadcaster.isMetaTransactionApproved(
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      signer.address,
      nonce,
      flipped,
      sig,
      { gasLimit: 2000000 }
    );

    return flipped;
  }

  it("transaction reverts as the signer did not try to flip a bit ", async () => {
    const { signer, broadcaster } = await loadFixture(deployBroadcaster);

    // Flip the 0th index.
    const nonce = new BigNumber("0");
    const bitmap = new BigNumber("0");

    // Signer issues a command for the 0th index of the nonce
    const encoded = defaultAbiCoder.encode(
      ["address", "bytes32", "uint", "uint"],
      [
        broadcaster.address,
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        nonce,
        bitmap
      ]
    );
    const h = keccak256(encoded);
    const sig = await signer.signMessage(arrayify(h));

    await expect(
      broadcaster.isMetaTransactionApproved(
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        signer.address,
        nonce,
        bitmap,
        sig
      )
    ).to.be.reverted;
  }).timeout(5000);

  it("sets the flipbit correctly. pass (hardcoded) ", async () => {
    const { signer, broadcaster } = await loadFixture(deployBroadcaster);

    // Flip the 0th index.
    const nonce = new BigNumber("0");
    const bitmap = new BigNumber("0");
    const indexToFlip = new BigNumber("0");
    const flipped = await setupFlip(
      nonce,
      bitmap,
      indexToFlip,
      broadcaster,
      signer
    );

    expect(await broadcaster.isBitmapSet(signer.address, nonce, flipped)).to.be
      .true;
  }).timeout(5000);

  it("fails to flip the same bit twice.", async () => {
    const { signer, broadcaster } = await loadFixture(deployBroadcaster);

    // Fresh nonce
    let nonce = new BigNumber("0");

    // Flip the 0th index.
    let update = flipBit(new BigNumber("0"), new BigNumber("1"));

    // Signer issues a command for the 0th index of the nonce
    let encoded = defaultAbiCoder.encode(
      ["address", "bytes32", "uint", "uint"],
      [
        broadcaster.address,
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        nonce,
        update
      ]
    );
    let h = keccak256(encoded);
    const sig = await signer.signMessage(arrayify(h));
    await broadcaster.isMetaTransactionApproved(
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      signer.address,
      nonce,
      update,
      sig
    );

    // Issue the command like a boyo.
    expect(await broadcaster.isBitmapSet(signer.address, nonce, update)).to.be
      .true;

    // Should fail as bitmap is already set
    await expect(
      broadcaster.isMetaTransactionApproved(
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        signer.address,
        nonce,
        update,
        sig
      )
    ).to.be.reverted;
  }).timeout(5000);

  it("all bits already set", async () => {
    const { signer, broadcaster } = await loadFixture(flip5And10And225);

    // Flip the 0th index.
    const nonce = new BigNumber("1");
    const bitmap = new BigNumber("0");
    const toFlip = [5, 10, 255];

    // Check individual bits
    for (let i = 0; i < toFlip.length; i++) {
      let indexToFlip = new BigNumber(toFlip[i]);
      const flipped = flipBit(bitmap, indexToFlip);

      // Issue the command like a boyo.
      expect(await broadcaster.isBitmapSet(signer.address, nonce, flipped)).to
        .be.true;
    }

    // Check combined bits
    let bits = bitmap;
    for (let i = 0; i < toFlip.length; i++) {
      let indexToFlip = new BigNumber(toFlip[i]);
      bits = flipBit(bits, indexToFlip);
    }

    // Issue the command like a boyo.
    expect(await broadcaster.isBitmapSet(signer.address, nonce, bits)).to.be
      .true;
  }).timeout(5000);

  it("some bits preset, but can still detect new flips", async () => {
    const { signer, broadcaster } = await loadFixture(flip5And10And225);

    // Flip the 0th index.
    const nonce = new BigNumber("0");
    let bitmap = new BigNumber("0");

    const toFlip = [5, 11, 252];
    for (let i = 0; i < toFlip.length; i++) {
      let indexToFlip = new BigNumber(toFlip[i]);
      bitmap = flipBit(bitmap, indexToFlip);
    }

    // Issue the command like a boyo.
    expect(await broadcaster.isBitmapSet(signer.address, nonce, bitmap)).to.be
      .false;
  }).timeout(5000);

  it("meta-transaction failed as nonce is too far in future (nonce=3)", async () => {
    const { signer, broadcaster } = await loadFixture(flip5And10And225);

    // Flip the 0th index.
    const nonce = new BigNumber("3");
    const bitmap = new BigNumber("0");
    const indexToFlip = new BigNumber("44");
    const flipped = flipBit(bitmap, indexToFlip);

    // Signer issues a command for the 0th index of the nonce
    const encoded = defaultAbiCoder.encode(
      ["address", "bytes32", "uint", "uint"],
      [
        broadcaster.address,
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        nonce,
        flipped
      ]
    );
    const h = keccak256(encoded);
    const sig = await signer.signMessage(arrayify(h));

    await expect(
      broadcaster.isMetaTransactionApproved(
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        signer.address,
        nonce,
        flipped,
        sig
      )
    ).to.be.reverted;
  }).timeout(5000);

  it("new nonce (nonce=2) accepted, and bitmap for nonce=1 wiped. ", async () => {
    const { signer, broadcaster } = await loadFixture(flip5And10And225);

    // Flip the 0th index.
    const nonce = new BigNumber("2");
    const bitmap = new BigNumber("0");
    const indexToFlip = new BigNumber("44");
    const flipped = await setupFlip(
      nonce,
      bitmap,
      indexToFlip,
      broadcaster,
      signer
    );

    expect(await broadcaster.isBitmapSet(signer.address, nonce, flipped)).to.be
      .true;

    // Lets check if '5' for nonce 1 is still flipped
    const oldFlip = flipBit(new BigNumber("1"), new BigNumber("5"));
    expect(
      await broadcaster.isBitmapSet(signer.address, new BigNumber("1"), oldFlip)
    ).to.be.false;
  }).timeout(5000);

  it("new nonce (nonce=2) accepted, and bitmap for nonce=1 wiped. ", async () => {
    const { signer, broadcaster } = await loadFixture(flip5And10And225);
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
