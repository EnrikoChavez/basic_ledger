
npm dependencies:
npm install --save-dev @openzeppelin/contracts

TODO: Consider checking if it is possible to mint from the original USDC address to not rely on whale amount

Ledger will be for 1 nft collection. Not for any NFT collection

Steps to test:

- have node -v -> 16
- npm -v -> 8.5.0
- npx -v -> 8.5.0
- run "npm install --save-dev hardhat"
- run "npm install --save-dev @openzeppelin/hardhat-upgrades"
- run "npx hardhat test"

  //Scaling ideas:
  // - allow multiple users to loan
  // - allow a user to collateralize multiple nfts, this would just require keeping track of each loan per user, when each loan happened


