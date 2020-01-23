import "mocha";
import * as chai from "chai";
import {
  solidity,
  deployContract,
  createMockProvider,
  getWallets,
  loadFixture
} from "ethereum-waffle";
import * as Broadcaster from "../../build/BroadcasterMN.json";
import { BigNumber, arrayify, defaultAbiCoder, keccak256 } from "ethers/utils";
import { Provider, JsonRpcProvider } from "ethers/providers";
import { Wallet } from "ethers";

const expect = chai.expect;
chai.use(solidity);

describe("MultiNonce MetaTransaction", () => {
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

  async function getMetaTxSig(
    address: string,
    message: string,
    nonce1: BigNumber,
    nonce2: BigNumber,
    signer: Wallet
  ): Promise<string> {
    // Signer issues a command for the 0th index of the nonce
    const encoded = defaultAbiCoder.encode(
      ["address", "bytes32", "uint", "uint"],
      [address, message, nonce1, nonce2]
    );
    const h = keccak256(encoded);
    return await signer.signMessage(arrayify(h));
  }

  it("accepts multiple nonce1 ", async () => {
    const { signer, broadcaster } = await loadFixture(deployBroadcaster);

    // Flip the 0th index.
    let nonce1 = new BigNumber("1");
    let fetchNonce = await broadcaster.getNonce(signer.address, nonce1);
    let nonce2 = fetchNonce.add(new BigNumber("1"));

    const message =
      "0x0000000000000000000000000000000000000000000000000000000000000000";

    let sig = await getMetaTxSig(
      broadcaster.address,
      message,
      nonce1,
      nonce2,
      signer
    );

    await broadcaster.isMetaTransactionApproved(
      message,
      signer.address,
      nonce1,
      nonce2,
      sig
    );

    fetchNonce = await broadcaster.getNonce(signer.address, nonce1);
    expect(fetchNonce.toString()).to.eq(nonce2.toString());

    nonce1 = new BigNumber("2");
    fetchNonce = await broadcaster.getNonce(signer.address, nonce1);
    nonce2 = fetchNonce.add(new BigNumber("1"));

    sig = await getMetaTxSig(
      broadcaster.address,
      message,
      nonce1,
      nonce2,
      signer
    );

    await broadcaster.isMetaTransactionApproved(
      message,
      signer.address,
      nonce1,
      nonce2,
      sig
    );

    fetchNonce = await broadcaster.getNonce(signer.address, nonce1);
    expect(fetchNonce.toString()).to.eq(nonce2.toString());
  }).timeout(5000);

  it("accepts large nonce2, rejects small nonce2", async () => {
    const { signer, broadcaster } = await loadFixture(deployBroadcaster);

    // Flip the 0th index.
    const nonce1 = new BigNumber("1");
    let fetchNonce = await broadcaster.getNonce(signer.address, nonce1);
    const oldNonce2 = fetchNonce.add(new BigNumber("1"));

    const message =
      "0x0000000000000000000000000000000000000000000000000000000000000000";
    let sig = await getMetaTxSig(
      broadcaster.address,
      message,
      nonce1,
      oldNonce2,
      signer
    );

    await broadcaster.isMetaTransactionApproved(
      message,
      signer.address,
      nonce1,
      oldNonce2,
      sig
    );

    fetchNonce = await broadcaster.getNonce(signer.address, nonce1);
    expect(fetchNonce.toString()).to.eq(oldNonce2.toString());

    fetchNonce = await broadcaster.getNonce(signer.address, nonce1);
    const tooSmall2 = fetchNonce.sub(new BigNumber("1"));

    sig = await getMetaTxSig(
      broadcaster.address,
      message,
      nonce1,
      tooSmall2,
      signer
    );

    await expect(
      broadcaster.isMetaTransactionApproved(
        message,
        signer.address,
        nonce1,
        tooSmall2,
        sig
      )
    ).to.be.reverted;

    fetchNonce = await broadcaster.getNonce(signer.address, nonce1);
    expect(fetchNonce.toString()).to.eq(oldNonce2.toString());

    fetchNonce = await broadcaster.getNonce(signer.address, nonce1);
    const tooLarge2 = fetchNonce.add(new BigNumber("2"));

    sig = await getMetaTxSig(
      broadcaster.address,
      message,
      nonce1,
      tooLarge2,
      signer
    );

    await expect(
      broadcaster.isMetaTransactionApproved(
        message,
        signer.address,
        nonce1,
        tooLarge2,
        sig
      )
    ).to.be.reverted;

    fetchNonce = await broadcaster.getNonce(signer.address, nonce1);
    expect(fetchNonce.toString()).to.eq(oldNonce2.toString());
  }).timeout(5000);
});
