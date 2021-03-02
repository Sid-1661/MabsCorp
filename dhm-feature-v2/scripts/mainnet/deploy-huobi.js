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
  const DHM = await ethers.getContractFactory("DHM");
  const StakingToken = await ethers.getContractFactory("StakingToken");
  const StakeDHM = await ethers.getContractFactory("StakeDHM");

  const dhm = await DHM.deploy(
    deployer.address,
    "Decentralized Hash Power",
    "DHM",
    DHM_SUPPLY,
    DHM_SUPPLY.div(10),
    overrides
  );
  console.log("DHM deployed to:", dhm.address);
  // const usdt = await StakingToken.deploy(
  //   "USDT",
  //   "USDT",
  //   6,
  //   USDT_TOTAL,
  //   USDT_TOTAL,
  //   overrides
  // );
  // console.log("USDT deployed to:", usdt.address);
  // const wbtc = await StakingToken.deploy(
  //   "WBTC",
  //   "WBTC",
  //   8,
  //   WBTC_TOTAL,
  //   WBTC_TOTAL,
  //   overrides
  // );
  // console.log("WBTC deployed to:", wbtc.address);
  const husd = "0x0298c2b32eae4da002a15f36fdf7615bea3da047";
  const hbtc = "0x66a79d23e58475d2738179ca52cd0b41d73f0bea";
  const stakeDHM = await StakeDHM.deploy(deployer.address, dhm.address, hbtc, {
    gasLimit: 3000000,
  });
  console.log("StakeDHM deployed to:", stakeDHM.address);

  const sell_price = ethers.BigNumber.from("7000000");
  const recycle_price = ethers.BigNumber.from("0");
  await dhm.update_usdt(husd);
  await dhm.update_sell_price(sell_price);
  await dhm.update_recycle_price(recycle_price);
  await dhm.update_minter(stakeDHM.address);
  await stakeDHM.set_reward_reporter(deployer.address);
  await stakeDHM.set_epoch_length(86400);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
