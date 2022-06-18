//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "./NFT.sol";

contract Ledger is Ownable, IERC721Receiver {

    mapping(address => bool) public sent_something;
    
    NFT nft;

    constructor(NFT _nft) {
        nft = _nft;
    }

    function deposit() external payable {
        sent_something[msg.sender] = true;
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