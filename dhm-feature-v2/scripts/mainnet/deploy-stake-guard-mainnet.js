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
  const stakeAddr = "0xF556c4E69dCa6d6fB6d3851eAAa4BdAFe17d138E";
  const stakeGuard = await StakeGuard.deploy(stakeAddr);
  console.log(stakeGuard.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
