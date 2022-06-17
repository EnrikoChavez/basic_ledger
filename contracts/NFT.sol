// SPDX-License-Identifier:UNLICENSED
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract NFT is Ownable, ERC721("HeNFT", "HNFT"){

    uint tokenId;
    mapping(address=>tokenMetaData[]) public ownershipRecord;

    struct tokenMetaData{
        uint tokenId;
        uint timeStamp;
        string tokenURI;
    }

    function mintToken(address recipient) onlyOwner public {
        _safeMint(recipient, tokenId);
        ownershipRecord[recipient].push(tokenMetaData(tokenId, block.timestamp, "https://ibb.co/gt4mQ7D"));
        tokenId = tokenId + 1;
    }
}