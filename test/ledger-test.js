const { expect } = require("chai");
const { ethers } = require("hardhat");

const IERC20_SOURCE = "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20";
const USDC_WHALE = '0x0a59649758aa4d66e25f08dd01271e891fe52199'
const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

describe("Ledger", function () {

  //ledger tests for one user
  xit("Should deploy ledger contract", async function () {
    const Ledger = await ethers.getContractFactory("Ledger");
    const ledger = await Ledger.deploy("");
    await ledger.deployed();
  });

  xit("Should deploy NFT contract", async function () {
    const NFT = await ethers.getContractFactory("NFT");
    const nft = await NFT.deploy();
    await nft.deployed();
  });

  it("Should read amount of USDC from whale wallet", async function () {
    // const Ledger = await ethers.getContractFactory("Ledger");
    // const ledger = await Ledger.deploy("");
    // await ledger.deployed();

    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [USDC_WHALE],
    });

    const signer = await ethers.provider.getSigner(USDC_WHALE);
    
    let usdcContract = await hre.ethers.getContractAt(IERC20_SOURCE, USDC_ADDRESS, signer);
    usdcContract = usdcContract.connect(signer);

    console.log("Signer USDC balance", await usdcContract.balanceOf(signer._address));

    await hre.network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [USDC_WHALE],
      });

  });

  xit("Should be able to allow 1 user to borrow USDC by sending an NFT as collateral ", async function () {

    const Ledger = await ethers.getContractFactory("");
    const ledger = await Ledger.deploy("");
    await ledger.deployed();

    const NFT = await ethers.getContractFactory("NFT");
    const nft = await NFT.deploy();
    await nft.deployed();



    expect(await ledger.greet()).to.equal("Hello, world!");

    const setGreetingTx = await ledger.setGreeting("Hola, mundo!");

    // wait until the transaction is mined
    await setGreetingTx.wait();

    expect(await ledger.greet()).to.equal("Hola, mundo!");

  });

  xit("", async function () {

  });

  xit("", async function () {

  });

});
