//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract Ledger is Ownable, IERC721Receiver {

    mapping(address => bool) public sent_something;

    

    constructor() {

    }

    function deposit() external payable {
        sent_something[msg.sender] = true;
    }

    function sentSomething(address addr) external view returns (bool) {
        return sent_something[addr];
    }

    function onERC721Received(
        address,
        address from,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
      return IERC721Receiver.onERC721Received.selector;
    }

}