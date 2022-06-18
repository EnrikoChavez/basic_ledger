const { expect } = require("chai");
const { ethers } = require("hardhat");

const IERC20_SOURCE = "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20";
const USDC_WHALE = '0x22ffda6813f4f34c520bf36e5ea01167bc9df159'
const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'; //usdc and eth whale address, if address is no longer whale, will need to change

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || "Assertion failed");
    }
}

let Ledger;
let ledger;
let NFT;
let nft;
let usdcContract;
let whale_signer;
let accounts;
let account1;
let account1nftId

describe("Ledger", function () {

  //ledger tests for one user
  describe("Setup for ledger functionality", function () {

    it("Should deploy ledger contract", async function () {
        Ledger = await ethers.getContractFactory("Ledger");
        ledger = await Ledger.deploy();
        await ledger.deployed();
    });

    //TODO: look into expanding to 3 users
    it("Should have a user own an NFT", async function () {
        accounts = await hre.ethers.getSigners();
        account1 = accounts[0];

        NFT = await ethers.getContractFactory("NFT");
        nft = await NFT.deploy();
        await nft.deployed();

        nft.mintToken(account1.address);

        account1nftId = 1;

        expect(await nft.balanceOf(account1.address)).to.equal(1);
        expect(await nft.ownerOf(1)).to.equal(account1.address);

    });

    it("Should read amount of USDC from whale wallet, ensure wallet has eth too for gas fees", async function () {
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [USDC_WHALE],
        });

        whale_signer = await ethers.provider.getSigner(USDC_WHALE);
        
        usdcContract = await hre.ethers.getContractAt(IERC20_SOURCE, USDC_ADDRESS, whale_signer);
        usdcContract = await usdcContract.connect(whale_signer);

        assert(await usdcContract.balanceOf(USDC_WHALE) > 1_000_000_000); //arbitrary amount (1000 usdc)
        assert(await ethers.provider.getBalance(USDC_WHALE) > 1_000_000_000_000_000_000); //arbitrary amount (1 ether)
    });

    it("Should send USDC from whale wallet to ledger to fund ledger with USDC", async function () {

        const usdcInDollars = '1000';
        const usdcCentsRemainder = '00';
        await usdcContract.transfer(ledger.address, usdcInDollars + usdcCentsRemainder + "000000");

        await hre.network.provider.request({
            method: "hardhat_stopImpersonatingAccount",
            params: [USDC_WHALE],
        });

        assert(await usdcContract.balanceOf(ledger.address) == 100_000_000_000);
        
    });
  });

  describe("Ledger functionality", function () {

    it("Should be able to allow 1 user to borrow USDC by sending an NFT as collateral ", async function () {

        await nft['safeTransferFrom(address,address,uint256)'](account1.address, ledger.address, account1nftId);
        expect(await nft.balanceOf(ledger.address)).to.equal(1);

    });

    xit("", async function () {
    });

  });

  describe("Test Wrong Interactions", function () {
    //only allow 1 loan at a time per user
    //prevent re-entrency attacks by updating the state before any actual transfers
    //user can only pay once and contract has to receive enough funds before letting nft go

    //user has to send NFT to get

  });

  //Scaling ideas:
  // - allow multiple users to loan
  // - allow a user to collateralize multiple nfts, this would just require keeping track of each loan per user, when each loan happened

  

});
