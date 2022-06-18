//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "./NFT.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Ledger is Ownable, IERC721Receiver {

    NFT nft;
    uint128 nftPrice = 1000000; //1 usdc
    mapping(address => bool) public sent_something;
    mapping(uint256 => collatNFT) public tokenIdToNFT;
    address public usdcToken = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    struct collatNFT {
        uint24 tokenId;
        uint48 timestamp;
        address owner;
        uint24 amountBorrowed; 
    }

    constructor(NFT _nft) {
        nft = _nft;
        IERC20(usdcToken).approve(address(this), type(uint256).max);
    }

    function borrow(uint256 tokenId, uint128 amount) external payable {

        
        require(IERC20(usdcToken).balanceOf(address(this)) >= amount, "ledger does not have enough usdc, we have lent too much already! Come back later");
        require(amount <= (nftPrice * 7 / 10), "amount to borrow cannot be more than 70% of nft price");
        require(nft.ownerOf(tokenId) == msg.sender, "token is not owned by function caller");

        //deposit NFT
        nft.safeTransferFrom(msg.sender, address(this), tokenId);
        tokenIdToNFT[tokenId] = collatNFT({
            tokenId: uint24(tokenId),
            timestamp: uint48(block.timestamp),
            owner: msg.sender,
            amountBorrowed: uint24(amount)
        });

        //lend USDC
        IERC20(usdcToken).transferFrom(address(this), msg.sender, amount);
    }

    function sentSomething(address addr) external view returns (bool) {
        return sent_something[addr];
    }

    function sendNFT(address from, address to, uint128 tokenId) external{
        nft.safeTransferFrom(from, to, tokenId);
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