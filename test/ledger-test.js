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
    return Math.round(usdc / 1000000) //ideally not use division, but only multiplication when working with weis and money
}

let Ledger;
let ledger;
let NFT;
let nft;
let usdcContract;
let account;
let account0initialBalance;
let ledgerInitialBalance;
const tokenId = [];
let currentTokenId = 1;

describe("Ledger", function () {

  describe("Setup for ledger functionality", function () {

    it("Have account[0] and account[1] own NFTs", async function () {
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

    it("Deploy ledger contract and set approvals for smart contract to send NFTs for default account[0]", async function () {
        //get ledger contract instance
        Ledger = await ethers.getContractFactory("Ledger");
        ledger = await Ledger.deploy(nft.address);
        await ledger.deployed();

        //approve for smart contract to transfer nfts on behalf of account[0]
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

    it("Send usdc to addresses to pay back debt and send USDC to ledger so it can lend USDC", async function () {

        account0initialBalance = await usdcContract.balanceOf(account[0].address)
        ledgerInitialBalance = await usdcContract.balanceOf(ledger.address)

        let usdcInDollars = '1000000';
        //sending 1 million usdc to addresses 0 and 1
        
        await usdcContract.transfer(account[0].address, usdcInDollars + "000000");
        await usdcContract.transfer(account[1].address, usdcInDollars + "000000");

        //sending 1 million usdc to ledger
        await usdcContract.transfer(ledger.address, usdcInDollars + "000000");

        expect(await usdcContract.balanceOf(ledger.address)).to.equal(ledgerInitialBalance.toNumber() + 1_000_000_000_000)

        //stop impersonating whale address and go back to default address 0 impersonation
        await hre.network.provider.request({
            method: "hardhat_stopImpersonatingAccount",
            params: [USDC_WHALE],
        });
        usdcContract = await usdcContract.connect(account[0])
    });
  });

  describe("Ledger functionality - Basic interactions", function () {

    it("account[0] borrows USDC by sending an NFT as collateral", async function () {
        
        //checking before balances
        expect(await usdcContract.balanceOf(ledger.address)).to.equal(ledgerInitialBalance + 1_000_000_000_000) //this is different, 
        assert(await nft.balanceOf(ledger.address) == 0);
        assert(await nft.balanceOf(account[0].address) == 2);

        const amountToBorrow = 1;
        await ledger.borrowUSDC(tokenId[0], usdcToUnits(amountToBorrow));

        //checking after balances
        expect(await usdcContract.balanceOf(account[0].address)).to.equal(account0initialBalance.toNumber() + 1_000_000_000_000 + usdcToUnits(amountToBorrow))
        assert(await nft.balanceOf(ledger.address) == 1);
        assert(await nft.balanceOf(account[0].address) == 1);

    });

    it("account[0] pays back with USDC to retrieve NFT", async function () {

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
        assert(await usdcContract.balanceOf(account[0].address) == account0BalanceBeforePay - amountPaid); //balance does not depend on slippage (amountAvailableToPay)

    });

    it("account[1] fails to buy an NFT from account[0], until waiting longer", async function () {
        
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
        ledger = await ledger.connect(account[1]);
        usdcContract = await usdcContract.connect(account[1]);
        await usdcContract.approve(ledger.address, Number.MAX_SAFE_INTEGER - 1);

        //account[1] tries to buy nft, but shouldnt because owner still has time to pay
        const slippage = 10;
        const amountAvailableToPay = unitsToUsdc(await ledger.amountOwed(tokenId[0])) + slippage;
        assert(await nft.balanceOf(ledger.address) == 1);
        assert(await nft.balanceOf(account[1].address) == 1);
        try{
            await ledger.payForNFT(tokenId[0], usdcToUnits(amountAvailableToPay))
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
        ledger = await ledger.connect(account[0]);
        usdcContract = await usdcContract.connect(account[0]);

    });

  });

  describe("Ledger functionality - Advanced interactions", function () {

    it("account[1] collateralizes 2 different nfts at different times", async function () {

        //impersonate account[1]
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [account[1].address],
        });
        ledger = await ledger.connect(account[1]);
        nft = await nft.connect(account[1])

        //approve for smart contract to transfer nfts on behalf of account[0]
        await nft.setApprovalForAll(ledger.address, true);

        //checking before balances
        assert(await nft.balanceOf(ledger.address) == 0);
        assert(await nft.balanceOf(account[1].address) == 2);

        //collateralize 2 different nfts at 2 different times
        const amountToBorrow = 1; 
        await ledger.borrowUSDC(tokenId[0], usdcToUnits(amountToBorrow));
        await new Promise(resolve => setTimeout(resolve, 4000)); 
        await ledger.borrowUSDC(tokenId[2], usdcToUnits(amountToBorrow));

        //checking after balances
        assert(await nft.balanceOf(ledger.address) == 2);
        assert(await nft.balanceOf(account[1].address) == 0);

        //go back to default account[0] signer
        await hre.network.provider.request({
            method: "hardhat_stopImpersonatingAccount",
            params: [account[1].address],
        });
        ledger = await ledger.connect(account[0]);
        nft = await nft.connect(account[0])
    });

    it("account[0] buys one nft but cannot buy the other nft from account[1] because of 1 of the nft's grace periods", async function () {
        //checking before balance
        assert(await nft.balanceOf(account[0].address) == 1);
        await new Promise(resolve => setTimeout(resolve, 2000));

        const slippage = 10;
        const amountAvailableToPayToken0 = unitsToUsdc(await ledger.amountOwed(tokenId[0])) + slippage;
        const amountAvailableToPayToken2 = unitsToUsdc(await ledger.amountOwed(tokenId[2])) + slippage;

        //can buy tokenId[0] since grace period has ellapsed
        await ledger.payForNFT(tokenId[0], usdcToUnits(amountAvailableToPayToken0));

        //cannot buy tokenId[2] since grace period has not ellapsed
        try{
            await ledger.payForNFT(tokenId[2], usdcToUnits(amountAvailableToPayToken2));
        }
        catch(err){
        }

        //account[0] should only have 1 more nft
        assert(await nft.balanceOf(account[0].address) == 2);

    });

    it("account[1] tries to buy both nfts back but can only buy 1 since account[0] bought back one of their nfts", async function () {

        //impersonate account[1]
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [account[1].address],
        });
        ledger = await ledger.connect(account[1]);

        const slippage = 10;
        const amountAvailableToPayToken0 = unitsToUsdc(await ledger.amountOwed(tokenId[0])) + slippage;
        const amountAvailableToPayToken2 = unitsToUsdc(await ledger.amountOwed(tokenId[2])) + slippage;

        //cannot buy tokenId[0] because account[0] already bought it
        try{
            await ledger.payForNFT(tokenId[0], usdcToUnits(amountAvailableToPayToken2));
        }
        catch(err){
        }

        //can buy tokenId[2] because account[0] could not have bought it
        await ledger.payForNFT(tokenId[2], usdcToUnits(amountAvailableToPayToken0));
        
        //account[1] should have 1 nft, since they collateralized 2 when they had 2 NFTs
        assert(await nft.balanceOf(account[1].address) == 1);

        //go back to default account[0] signer
        await hre.network.provider.request({
            method: "hardhat_stopImpersonatingAccount",
            params: [account[1].address],
        });
        ledger = await ledger.connect(account[0]);
    });

  });

  describe("Ledger functionality - Requirements", function () {
    it("account[0] cannot borrow more than 70% of nft's price", async function () {
        //checking before balances
        assert(await nft.balanceOf(ledger.address) == 0);
        assert(await nft.balanceOf(account[0].address) == 2);

        //try to borrow large amount then lower ask
        let amountToBorrow = 71; //up to 70 usdc can be borrowed since nft is 100 usdc
        try{
            await ledger.borrowUSDC(tokenId[0], usdcToUnits(amountToBorrow));
        }
        catch(err){
        }
        amountToBorrow = 70;
        await ledger.borrowUSDC(tokenId[0], usdcToUnits(amountToBorrow));

        //checking after balances
        assert(await nft.balanceOf(ledger.address) == 1);
        assert(await nft.balanceOf(account[0].address) == 1);
    });

    it("interest of account[0]'s token increases over time", async function () {
        const amountOwed1 = await ledger.amountOwed(tokenId[0])

        //wait for interest to increase
        await new Promise(resolve => setTimeout(resolve, 5000)); 

        //dummy transaction to update block.timestamp
        await ledger.borrowUSDC(tokenId[1], usdcToUnits(1));

        const amountOwed2 = await ledger.amountOwed(tokenId[0])
        
        assert(amountOwed2.toNumber() > amountOwed1.toNumber());

    });

  });

});

// xit("", async function () {

// });
