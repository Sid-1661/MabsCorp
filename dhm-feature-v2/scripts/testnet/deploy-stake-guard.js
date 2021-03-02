// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");
const { ethers } = hre;

const D18 = ethers.BigNumber.from("1000000000000000000");
const D6 = ethers.BigNumber.from(1000000);
const D8 = ethers.BigNumber.from("100000000");
const DHM_SUPPLY = D18.mul(ethers.BigNumber.from(1000000));
// const USDT_TOTAL = D6.mul(ethers.BigNumber.from("10000000000000000000"));
// const WBTC_TOTAL = D8.mul(100000000);

const fs = require("fs");
const overrides = {
  // gasPrice: ethers.utils.parseUnits("1", "gwei"),
};

async function main() {
  const [deployer, zeus] = await ethers.getSigners();
  const StakeGuard = await ethers.getContractFactory("StakeGuard");
  const stakeAddr = "0xb9Bb1DAf6027Dfb6E04f78E10FCd6E61C5872034";
  const stakeGuard = await StakeGuard.deploy(stakeAddr);
  console.log(stakeGuard.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
