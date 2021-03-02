const hre = require("hardhat");
const { ethers } = hre;

const D18 = ethers.BigNumber.from("1000000000000000000");
const D6 = ethers.BigNumber.from(1000000);
const D8 = ethers.BigNumber.from("100000000");
const DHM_SUPPLY = D18.mul(ethers.BigNumber.from(1000000));
const USDT_TOTAL = D6.mul(ethers.BigNumber.from("10000000000000000000"));
const WBTC_TOTAL = D8.mul(100000000);

const fs = require("fs");
const overrides = {
  // gasPrice: ethers.utils.parseUnits("1", "gwei"),
};

async function main() {
  const [deployer, zeus] = await ethers.getSigners();
  const DHM = await ethers.getContractFactory("DHM");
  const StakingToken = await ethers.getContractFactory("StakingToken");
  const StakeDHM = await ethers.getContractFactory("StakeDHM");
  const StakeDHMAddress = "0xb9Bb1DAf6027Dfb6E04f78E10FCd6E61C5872034";

  const stakeDHM = StakeDHM.attach(StakeDHMAddress);

  console.log(await stakeDHM.reward_reporter());
  // await stakeDHM.set_reward_reporter(
  //   "0x0Ea5Ef3A6dAd3Ae7802e88014e92697e7C86988D"
  // );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
