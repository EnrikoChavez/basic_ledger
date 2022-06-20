Ledger will be for 1 nft collection. Not for any NFT collection

Basic Ledger as described by assignment:

Features of this ledger are:
-   the period a user has to buy back an nft is 5 seconds (can be modified, but done for testing purposes)
-   The interest rate grows linearly every second until it hits 5 seconds, where the interest rate is half the amount borrowed
-   a user can collateralize multiple nfts that all have their own deadline to buy back depending on when they were collateralized
-   multiple users can use the ledger
-   the nft's price is 100 usdc

Considerations:
-   To get USDC, I forked the ethereum mainnet and grabbed its smart contract
-   To fund ledger and accounts with USDC, I grabbed an account with the most USDC on the ethereum mainnet and impersonated it to send USDC to local accounts
-   I created a very basic NFT class that is used as the collection that users have and that the ledger accepts as collateral

Testing:
-   all the testing is done on ledger-test.js, where it mimicks interactions with the ledger contract on the of the hardhat local blockchain
-   Much of the testing is commented, but can go over it in person/zoom and talk about how to add more test cases

Requirements to test:

- node -v -> 16 (14 and 12 may work, not very sure)
- download node version 16 here https://nodejs.org/en/download/

- npm -v -> 8 (other versions may work, but not very certain)
- npx -v -> 8 (other versions may work, but not very certain)

- clone bundle and cd into project (git clone -b main (bundle) (dir)) (main branch is called "main")

- hardhat (run "npm install --save-dev hardhat")
- (if not installed) openzeppelin (npm install --save-dev @openzeppelin/contracts)


To test:
- run "npx hardhat test"


Example test output:

- npx hardhat test

  Ledger

    Setup for ledger functionality

      ✔ Have account[0] and account[1] own NFTs (2298ms)

      ✔ Deploy ledger contract and set approvals for smart contract to send NFTs for default account[0] (727ms)

      ✔ Read amount of USDC from whale wallet and ensure whale wallet has eth too for gas fees (187ms)

      ✔ Send usdc to addresses to pay back debt and send USDC to ledger so it can lend USDC (416ms)

    Ledger functionality - Basic interactions

      ✔ account[0] borrows USDC by sending an NFT as collateral (167ms)

      ✔ account[0] pays back with USDC to retrieve NFT (198ms)

      ✔ account[1] fails to buy an NFT from account[0], until waiting longer (5285ms)

    Ledger functionality - Advanced interactions

      ✔ account[1] collateralizes 2 different nfts at different times (4189ms)

      ✔ account[0] buys one nft but cannot buy the other nft from account[1] because of 1 of the nft's grace periods (2115ms)

      ✔ account[1] tries to buy both nfts back but can only buy 1 since account[0] bought back one of their nfts (205ms)

    Ledger functionality - Requirements

      ✔ account[0] cannot borrow more than 70% of nft's price (89ms)

      ✔ interest of account[0]'s token increases over time (5069ms)

  12 passing (21s)
