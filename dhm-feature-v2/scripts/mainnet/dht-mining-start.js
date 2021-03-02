const hre = require("hardhat");
const { ethers } = hre;

const D18 = ethers.BigNumber.from("1000000000000000000");
const D6 = ethers.BigNumber.from(1000000);
const D8 = ethers.BigNumber.from("100000000");
const DHM_SUPPLY = D18.mul(ethers.BigNumber.from(1000000));
const USDT_TOTAL = D8.mul(ethers.BigNumber.from("10000000000000000000"));
const WBTC_TOTAL = D18.mul(100000000);

const DHT_TOTAL = D18.mul(ethers.BigNumber.from("10000000"));

const fs = require("fs");
const overrides = {
  // gasPrice: ethers.utils.parseUnits("1", "gwei"),
};

async function main() {
  const [deployer, zeus] = await ethers.getSigners();
  const DHM = await ethers.getContractFactory("DHM");
  const StakingToken = await ethers.getContractFactory("StakingToken");
  const StakeDHM = await ethers.getContractFactory("StakeDHM");
  const DHT = await ethers.getContractFactory("StakingToken");
  const DHTMining = await ethers.getContractFactory("DHTMining");
  const Distributor = await ethers.getContractFactory("RewardDistribution");

  const distributor = await Distributor.attach(
    "0x5ADc525eD756b94Fe333D80120fec2d09f3687dB"
  );

  await distributor.nextPeriod();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
