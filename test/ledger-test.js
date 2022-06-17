const { expect } = require("chai");
const { ethers } = require("hardhat");

const IERC20_SOURCE = "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20";
const USDC_WHALE = '0x22ffda6813f4f34c520bf36e5ea01167bc9df159'
const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'; //usdc and eth whale address

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || "Assertion failed");
    }
}

describe("Ledger", function () {

  //ledger tests for one user
  describe("Setup for ledger functionality", function () {
    it("Should deploy ledger contract", async function () {
        const Ledger = await ethers.getContractFactory("Ledger");
        const ledger = await Ledger.deploy();
        await ledger.deployed();
    });

    it("Should have a user own an NFT", async function () {
        const accounts = await hre.ethers.getSigners();
        const account1 = accounts[0]

        const NFT = await ethers.getContractFactory("NFT");
        const nft = await NFT.deploy();
        await nft.deployed();

        nft.mintToken(account1.address);

        assert(await nft.balanceOf(account1.address) == 1);
        assert((await nft.ownerOf(0)) == (account1.address));

    });

    it("Should read amount of USDC from whale wallet", async function () {
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [USDC_WHALE],
        });

        const signer = await ethers.provider.getSigner(USDC_WHALE);
        
        let usdcContract = await hre.ethers.getContractAt(IERC20_SOURCE, USDC_ADDRESS, signer);
        usdcContract = usdcContract.connect(signer);

        // console.log("Signer USDC balance", await usdcContract.balanceOf(signer._address));
        await hre.network.provider.request({
            method: "hardhat_stopImpersonatingAccount",
            params: [USDC_WHALE],
        });

        assert(await usdcContract.balanceOf(signer._address) > 1_000_000_000);

        

    });

    it("Should send USDC from whale wallet to ledger to fund ledger with USDC", async function () {
        const Ledger = await ethers.getContractFactory("Ledger");
        const ledger = await Ledger.deploy();
        await ledger.deployed();

        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [USDC_WHALE],
        });

        const signer = await ethers.provider.getSigner(USDC_WHALE);
        
        let usdcContract = await hre.ethers.getContractAt(IERC20_SOURCE, USDC_ADDRESS, signer);
        usdcContract = usdcContract.connect(signer);

        console.log("Signer USDC balance", await usdcContract.balanceOf(signer._address));

        const usdcInDollars = '1000';
        const usdcCentsRemainder = '00';
        await usdcContract.transfer(ledger.address, usdcInDollars + usdcCentsRemainder + "000000");

        await hre.network.provider.request({
            method: "hardhat_stopImpersonatingAccount",
            params: [USDC_WHALE],
        });

        console.log("Signer USDC balance", await usdcContract.balanceOf(ledger.address));

        
    });
  });

  describe("Ledger functionality", function () {

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

  

});
