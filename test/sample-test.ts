import { expect } from "chai";
import chai from "chai";
import {Address, Contract, lockliftChai, Signer, toNano, WalletTypes} from "locklift";
import { FactorySource } from "../build/factorySource";
import { Account } from "locklift/build/factory";
import exp from "constants";

chai.use(lockliftChai);

let oracle: Contract<FactorySource["SimpleOracle"]>;
let signer: Signer;
let localGiver: Address;

const TEST_CONTENT_1 = '{"apy":0.0672, "tvl": 123456789, "stakeholders": 10024, "depools": 40, "undistributed": 22567143}';
const TEST_CONTENT_2 = '{"apy":0.13, "tvl": 123456789, "stakeholders": 10024, "depools": 50, "undistributed": 22567143}';

describe("Test SimpleOracle contract", async function () {
  before(async () => {
    signer = (await locklift.keystore.getSigner("0"))!;
    let account = (await locklift.factory.accounts.addNewAccount({
      type: WalletTypes.WalletV3, // or WalletTypes.HighLoadWallet,
      //Value which will send to the new account from a giver
      value: toNano(10),
      //owner publicKey
      publicKey: signer.publicKey
    }));
    localGiver = account.account.address;

    console.log("\n    Deployed giver at: " + localGiver.toString() +"\n");
  });
  describe("Contracts", async function () {
    it("Load contract factory", async function () {
      const sampleData = await locklift.factory.getContractArtifacts("SimpleOracle");

      expect(sampleData.code).not.to.equal(undefined, "Code should be available");
      expect(sampleData.abi).not.to.equal(undefined, "ABI should be available");
      expect(sampleData.tvc).not.to.equal(undefined, "tvc should be available");
    });

    it("Deploy contract", async function () {
      const INIT_STATE = 0;
      const { contract } = await locklift.factory.deployContract({
        contract: "SimpleOracle",
        publicKey: signer.publicKey,
        initParams: {
          nonce: locklift.utils.getRandomNonce(),
        },
        constructorParams: {
          owner: localGiver,
        },
        value: locklift.utils.toNano(2),
      });
      oracle = contract;

      expect(await locklift.provider.getBalance(oracle.address).then(balance => Number(balance))).to.be.above(0);
    });

    it("Store initial content", async function () {
      const response1 = await locklift.tracing.trace(oracle.methods.store({"content": TEST_CONTENT_1}).send({
        from: localGiver,
        amount: "2000000000",
        bounce: true
      }));

      expect(response1.traceTree).to.emit("SimpleOracleUpdated").not.to.have.error();

      const response2 = await oracle.methods.read({}).call();
      expect(response2.content).to.be.equal(String(TEST_CONTENT_1), "Content wasn't set");
    });

    it("Update content", async function () {
      const response1 = await locklift.tracing.trace(oracle.methods.store({"content": TEST_CONTENT_2}).send({
        from: localGiver,
        amount: "2000000000",
        bounce: true
      }));

      expect(response1.traceTree).to.emit("SimpleOracleUpdated").not.to.have.error();

      const response2 = await oracle.methods.read({}).call();
      expect(response2.content).to.be.equal(String(TEST_CONTENT_2), "Content wasn't set");
    });
  });
});
