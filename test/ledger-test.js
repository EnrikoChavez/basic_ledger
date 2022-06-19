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

function usdcToUnits(usdc){
    return usdc * 1000000
}

function unitsToUsdc(usdc){
    return usdc / 1000000
}

let Ledger;
let ledger;
let NFT;
let nft;
let usdcContract;
let account;
let tokenId1;

describe("Ledger", function () {

  //ledger tests for one user
  describe("Setup for ledger functionality", function () {

    //TODO: look into expanding to 2 users
    it("Should have a user own an NFT", async function () {
        account = await hre.ethers.getSigners();

        NFT = await ethers.getContractFactory("NFT");
        nft = await NFT.deploy();
        await nft.deployed();

        nft.mintToken(account[0].address);

        tokenId1 = 1

        expect(await nft.balanceOf(account[0].address)).to.equal(1);
        expect(await nft.ownerOf(tokenId1)).to.equal(account[0].address);

    });

    it("Should deploy ledger contract, and set approvals to smart contract", async function () {
        Ledger = await ethers.getContractFactory("Ledger");
        ledger = await Ledger.deploy(nft.address);
        await ledger.deployed();

        await nft.setApprovalForAll(ledger.address, true); //this way smart contract can transfer nfts as well
        assert((await nft.isApprovedForAll(account[0].address, ledger.address)) == true);
    });

    it("Should read amount of USDC from whale wallet, ensure wallet has eth too for gas fees", async function () {
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [USDC_WHALE],
        });

        const whale_signer = ethers.provider.getSigner(USDC_WHALE);
        
        usdcContract = await hre.ethers.getContractAt(IERC20_SOURCE, USDC_ADDRESS, whale_signer);
        usdcContract = await usdcContract.connect(whale_signer);

        assert(await usdcContract.balanceOf(USDC_WHALE) > 1_000_000_000_000); //arbitrary amount (1,000,000 usdc)
        assert(await ethers.provider.getBalance(USDC_WHALE) > 1_000_000_000_000_000_000); //arbitrary amount (1 ether)
    });

    it("Should send USDC from whale wallet to ledger to fund ledger with USDC, also send usdc to addresses to pay back debt", async function () {

        let usdcInDollars = '1000000';
        await usdcContract.transfer(ledger.address, usdcInDollars + "000000");
        await usdcContract.transfer(account[0].address, usdcInDollars + "000000");
        await usdcContract.transfer(account[1].address, usdcInDollars + "000000");

        await hre.network.provider.request({
            method: "hardhat_stopImpersonatingAccount",
            params: [USDC_WHALE],
        });
        account0_signer = ethers.provider.getSigner(account[0].address)
        usdcContract = await usdcContract.connect(account0_signer)

        assert(await usdcContract.balanceOf(ledger.address) == 1_000_000_000_000);
        
    });
  });

  describe("Ledger functionality", function () {

    it("The user can borrow USDC by sending NFT as collateral", async function () {
        
        //token id 1 is owned by account 1 at this moment
        assert(await usdcContract.balanceOf(account[0].address) == 1_000_000_000_000);
        assert(await nft.balanceOf(ledger.address) == 0);
        assert(await nft.balanceOf(account[0].address) == 1);
        const amountToBorrow = 1; //up to 70
        await ledger.borrowUSDC(tokenId1, usdcToUnits(amountToBorrow));
        assert(await usdcContract.balanceOf(account[0].address) == (1_000_000_000_000 + usdcToUnits(amountToBorrow)));
        assert(await nft.balanceOf(ledger.address) == 1);
        assert(await nft.balanceOf(account[0].address) == 0);

    });

    it("The user can payback with USDC to retrieve NFT", async function () {

        const slippage = 3; //amount owed increases every second during the grace period, offer some slippage
        const amountAvailableToPay = unitsToUsdc(await ledger.amountOwed(tokenId1)) + slippage;

        const account0BalanceBeforePay = await usdcContract.balanceOf(account[0].address)
        const deltaAmountBeforePay = (await usdcContract.balanceOf(ledger.address)) - (await usdcContract.balanceOf(account[0].address))

        await usdcContract.approve(ledger.address, Number.MAX_SAFE_INTEGER - 1);
        await ledger.payForNFT(tokenId1, usdcToUnits(amountAvailableToPay));

        const deltaAmountAfterPay = (await usdcContract.balanceOf(ledger.address)) - (await usdcContract.balanceOf(account[0].address))
        const amountPaid = (deltaAmountAfterPay - deltaAmountBeforePay) / 2

        assert(await nft.balanceOf(ledger.address) == 0);
        assert(await nft.balanceOf(account[0].address) == 1);
        assert(await usdcContract.balanceOf(account[0].address) == account0BalanceBeforePay - amountPaid);

    });

    it("Fail to buy an NFT from another user, until waiting longer", async function () {
        
        const amountToBorrow = 1; 
        await ledger.borrowUSDC(tokenId1, usdcToUnits(amountToBorrow));
        assert(await nft.balanceOf(ledger.address) == 1);
        assert(await nft.balanceOf(account[0].address) == 0);

        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [account[1].address],
        });
        const account1_signer = ethers.provider.getSigner(account[1].address);
        ledger = await ledger.connect(account1_signer);
        usdcContract = await usdcContract.connect(account1_signer);
        await usdcContract.approve(ledger.address, Number.MAX_SAFE_INTEGER - 1);

        const slippage = 20;
        const amountAvailableToPay = unitsToUsdc(await ledger.amountOwed(tokenId1)) + slippage;
        assert(await nft.balanceOf(ledger.address) == 1);
        assert(await nft.balanceOf(account[1].address) == 0);
        try{
            await ledger.payForNFT(tokenId1, usdcToUnits(amountAvailableToPay))
            assert(false)
        }
        catch(err){
        }
        assert(await nft.balanceOf(ledger.address) == 1);
        assert(await nft.balanceOf(account[1].address) == 0);

        await new Promise(resolve => setTimeout(resolve, 10000));

        await ledger.payForNFT(tokenId1, usdcToUnits(amountAvailableToPay));
        assert(await nft.balanceOf(ledger.address) == 0);
        assert(await nft.balanceOf(account[1].address) == 1);

        await hre.network.provider.request({
            method: "hardhat_stopImpersonatingAccount",
            params: [account[1].address],
        });
        const account0_signer = ethers.provider.getSigner(account[0].address);
        ledger = await ledger.connect(account0_signer);
        usdcContract = await usdcContract.connect(account0_signer);

    });

    xit("", async function () {

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
