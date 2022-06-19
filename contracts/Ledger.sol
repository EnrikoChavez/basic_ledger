//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "./NFT.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract Ledger is Ownable, IERC721Receiver {

    NFT nft;
    uint256 nftPrice = usdcToUnits(100);
    mapping(uint256 => collatNFT) private tokenIdToNFT;
    address public usdcToken = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    uint256 public timeToRepayLoanInSeconds = 100;

    struct collatNFT {
        uint256 tokenId;
        uint256 timestamp;
        address owner;
        uint256 amountBorrowed; 
    }

    constructor(NFT _nft) {
        nft = _nft;
        IERC20(usdcToken).approve(address(this), type(uint256).max);
    }

    function borrowUSDC(uint256 tokenId, uint256 amount) external {

        require(IERC20(usdcToken).balanceOf(address(this)) >= amount, "ledger does not have enough usdc, we have lent too much already! Come back later");
        require(amount <= (nftPrice * 7 / 10), "amount to borrow cannot be more than 70% of nft price");
        require(nft.ownerOf(tokenId) == msg.sender, "token is not owned by function caller");
        require(tokenIdToNFT[tokenId].tokenId == 0, "token is already owned my ledger"); //extra guard, should not get here
        require(amount > 0, "send a positive amount");

        //deposit NFT
        nft.safeTransferFrom(msg.sender, address(this), tokenId);
        tokenIdToNFT[tokenId] = collatNFT({
            tokenId: tokenId,
            timestamp: block.timestamp,
            owner: msg.sender,
            amountBorrowed: amount
        });

        //lend USDC
        IERC20(usdcToken).transferFrom(address(this), msg.sender, amount);
    }

    function payForNFT(uint256 tokenId, uint256 amount) external {

        require(amount > 0, "send a positive amount");
        require(amount >= amountOwed(tokenId), string.concat("payment is not enough, amount in usdc required is ", Strings.toString(unitsToUsdc(amountOwed(tokenId))), ". Add a buffer amount to amount required, we will only accept the amount explicitly required"));
        require(nft.ownerOf(tokenId) == address(this), "token is not owned by contract");
        require(tokenIdToNFT[tokenId].tokenId > 0, "token is not owned by ledger");  //extra guard, should not get here

        if ((block.timestamp - tokenIdToNFT[tokenId].timestamp) <= timeToRepayLoanInSeconds){
            require(msg.sender == tokenIdToNFT[tokenId].owner, "only owner of nft can get nft back before grace period");
            _payForNFT(tokenId, amount);
            
        }
        else {
            _payForNFT(tokenId, amount);
        }

    }

    function _payForNFT (uint256 tokenId, uint256 amount) private {
        //pay USDC
        IERC20(usdcToken).transferFrom(msg.sender, address(this), amountOwed(tokenId));

        //give back NFT
        nft.safeTransferFrom(address(this), msg.sender, tokenId);
        tokenIdToNFT[tokenId] = collatNFT({
            tokenId: 0,
            timestamp: block.timestamp,
            owner: msg.sender,
            amountBorrowed: amount
        });
    }

    function amountOwed(uint256 tokenId) public view returns (uint256) {
        return tokenIdToNFT[tokenId].amountBorrowed + interest(tokenId);
    }

    function usdcToUnits(uint256 usdc) private pure returns (uint256) {
        return usdc * 1000000;
    }

    function unitsToUsdc(uint256 units) private pure returns (uint256) {
        return units / 1000000;
    }

    function interest(uint256 tokenId) private view returns (uint256) {
        return tokenIdToNFT[tokenId].amountBorrowed;
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
      return IERC721Receiver.onERC721Received.selector;
    }

}