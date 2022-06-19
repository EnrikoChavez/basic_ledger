const { expect } = require("chai");
const { ethers } = require("hardhat");

const IERC20_SOURCE = "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20";
const USDC_WHALE = '0x22ffda6813f4f34c520bf36e5ea01167bc9df159' //usdc and eth whale address in eth mainnet, if address is no longer whale, will need to change
const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'; //usdc address in eth mainnet

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
const tokenId = [];
let currentTokenId = 1;

describe("Ledger", function () {

  describe("Setup for ledger functionality", function () {

    it("Have users own NFTs", async function () {
        //get account addresses
        account = await hre.ethers.getSigners();

        //get nft contract instance
        NFT = await ethers.getContractFactory("NFT");
        nft = await NFT.deploy();
        await nft.deployed();

        //create nfts for accounts
        nft.mintToken(account[0].address);
        tokenId.push(currentTokenId++)
        nft.mintToken(account[0].address);
        tokenId.push(currentTokenId++)
        nft.mintToken(account[1].address);
        tokenId.push(currentTokenId++)

        expect(await nft.balanceOf(account[0].address)).to.equal(2);
        expect(await nft.ownerOf(tokenId[0])).to.equal(account[0].address);
        expect(await nft.ownerOf(tokenId[1])).to.equal(account[0].address)
        expect(await nft.ownerOf(tokenId[2])).to.equal(account[1].address)

    });

    it("Deploy ledger contract, and set approvals to smart contract", async function () {
        //get ledger contract instance
        Ledger = await ethers.getContractFactory("Ledger");
        ledger = await Ledger.deploy(nft.address);
        await ledger.deployed();

        //approve for smart contract to transfer nfts on behalf of caller
        await nft.setApprovalForAll(ledger.address, true);
        assert((await nft.isApprovedForAll(account[0].address, ledger.address)) == true);
    });

    it("Read amount of USDC from whale wallet and ensure whale wallet has eth too for gas fees", async function () {

        //transactions for usdc contract will now be signed by whale
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

    it("Send usdc to addresses to pay back debt and send USDC from whale wallet to ledger to fund ledger with USDC", async function () {

        let usdcInDollars = '1000000';
        //sending 1 million usdc to addresses 0 and 1
        await usdcContract.transfer(account[0].address, usdcInDollars + "000000");
        await usdcContract.transfer(account[1].address, usdcInDollars + "000000");

        //sending 1 million usdc to ledger
        await usdcContract.transfer(ledger.address, usdcInDollars + "000000");
        assert(await usdcContract.balanceOf(ledger.address) == 1_000_000_000_000);

        //stop impersonating whale address and go back to default address 0 impersonation
        await hre.network.provider.request({
            method: "hardhat_stopImpersonatingAccount",
            params: [USDC_WHALE],
        });
        const account0_signer = ethers.provider.getSigner(account[0].address)
        usdcContract = await usdcContract.connect(account0_signer)
    });
  });

  describe("Ledger functionality", function () {

    it("account[0] borrows USDC by sending NFT as collateral", async function () {
        
        //checking before balances
        assert(await usdcContract.balanceOf(account[0].address) == 1_000_000_000_000);
        assert(await nft.balanceOf(ledger.address) == 0);
        assert(await nft.balanceOf(account[0].address) == 2);

        const amountToBorrow = 1; //up to 70 usdc can be borrowed since nft is 100 usdc
        await ledger.borrowUSDC(tokenId[0], usdcToUnits(amountToBorrow));

        //checking after balances
        assert(await usdcContract.balanceOf(account[0].address) == (1_000_000_000_000 + usdcToUnits(amountToBorrow)));
        assert(await nft.balanceOf(ledger.address) == 1);
        assert(await nft.balanceOf(account[0].address) == 1);

    });

    it("The user can payback with USDC to retrieve NFT", async function () {

        const slippage = 3; //amount owed increases every second during the grace period, offer some slippage
        const amountAvailableToPay = unitsToUsdc(await ledger.amountOwed(tokenId[0])) + slippage;

        //calculate difference in amounts to see how much they change after the transfer
        const account0BalanceBeforePay = await usdcContract.balanceOf(account[0].address)
        const deltaAmountBeforePay = (await usdcContract.balanceOf(ledger.address)) - (await usdcContract.balanceOf(account[0].address))

        //pay back usdc plus interest
        await usdcContract.approve(ledger.address, Number.MAX_SAFE_INTEGER - 1); //account[0] approves of smart contract transfering usdc for them
        await ledger.payForNFT(tokenId[0], usdcToUnits(amountAvailableToPay));

        //calculate amount paid by checking usdc difference of accounts after payment
        const deltaAmountAfterPay = (await usdcContract.balanceOf(ledger.address)) - (await usdcContract.balanceOf(account[0].address))
        const amountPaid = (deltaAmountAfterPay - deltaAmountBeforePay) / 2

        //make sure balances are what they are supposed to be
        assert(await nft.balanceOf(ledger.address) == 0);
        assert(await nft.balanceOf(account[0].address) == 2);
        assert(await usdcContract.balanceOf(account[0].address) == account0BalanceBeforePay - amountPaid);

    });

    it("Fail to buy an NFT from another user, until waiting longer", async function () {
        
        //start a borrow from account[0]
        const amountToBorrow = 1; 
        await ledger.borrowUSDC(tokenId[0], usdcToUnits(amountToBorrow));
        assert(await nft.balanceOf(ledger.address) == 1);
        assert(await nft.balanceOf(account[0].address) == 1);

        //connect as account[1]
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [account[1].address],
        });
        const account1_signer = ethers.provider.getSigner(account[1].address);
        ledger = await ledger.connect(account1_signer);
        usdcContract = await usdcContract.connect(account1_signer);
        await usdcContract.approve(ledger.address, Number.MAX_SAFE_INTEGER - 1);

        //account[1] tries to buy nft, but shouldnt because owner still has time to pay
        const slippage = 10;
        const amountAvailableToPay = unitsToUsdc(await ledger.amountOwed(tokenId[0])) + slippage;
        assert(await nft.balanceOf(ledger.address) == 1);
        assert(await nft.balanceOf(account[1].address) == 1);
        try{
            await ledger.payForNFT(tokenId[0], usdcToUnits(amountAvailableToPay))
            assert(false)
        }
        catch(err){
        }
        assert(await nft.balanceOf(ledger.address) == 1);
        assert(await nft.balanceOf(account[1].address) == 1);

        //waiting for grace period (5 seconds to pay back) to end
        await new Promise(resolve => setTimeout(resolve, 5000)); 

        //now account[1] can buy NFT from account[0] that failed to pay in time
        await ledger.payForNFT(tokenId[0], usdcToUnits(amountAvailableToPay));
        assert(await nft.balanceOf(ledger.address) == 0);
        assert(await nft.balanceOf(account[1].address) == 2);

        //go back to default account[0] signer
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

  describe("Ledger functionality - multiple users", function () {

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
