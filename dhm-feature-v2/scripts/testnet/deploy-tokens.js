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
const HUSD_TOTAL = D8.mul(ethers.BigNumber.from("10000000000000000000"));
const USDT_TOTAL = D18.mul(ethers.BigNumber.from("10000000000000000000"));
const HBTC_TOTAL = D18.mul(100000000);
const WHT_TOTAL = D18.mul(100000000000);
const HETH_TOTAL = D18.mul(100000000);
const DHT_TOTAL = D18.mul(ethers.BigNumber.from("10000000"));
const DHM_SUPPLY = D18.mul(ethers.BigNumber.from(1000000));

const fs = require("fs");
const overrides = {
  gasPrice: ethers.utils.parseUnits("2", "gwei"),
  gasLimit: 8000000,
};

async function main() {
  const [deployer, zeus] = await ethers.getSigners();
  const StakingToken = await ethers.getContractFactory("StakingToken");
  const WHT = await ethers.getContractFactory("WHT");
  const DHM = await ethers.getContractFactory("DHM");
  const DHT = await ethers.getContractFactory("StakingToken");

  const dhm = await DHM.deploy(
    deployer.address,
    "Decentralized Hash Power",
    "DHM",
    DHM_SUPPLY,
    DHM_SUPPLY.div(10),
    overrides
  );
  await dhm.deployed();
  console.log("DHM deployed to:", dhm.address);

  const dht = await DHT.deploy("DHT", "DHT", 18, DHT_TOTAL, DHT_TOTAL);
  await dht.deployed();
  console.log("DHT deployed to:", dht.address);

  const wht = await WHT.deploy(overrides);
  await wht.deployed();
  console.log("WHT deployed to:", wht.address);

  const husd = await StakingToken.deploy(
    "HUSD",
    "HUSD",
    8,
    HUSD_TOTAL,
    HUSD_TOTAL,
    overrides
  );
  await husd.deployed();
  console.log("HUSD deployed to:", husd.address);

  const hbtc = await StakingToken.deploy(
    "HBTC",
    "HBTC",
    18,
    HBTC_TOTAL,
    HBTC_TOTAL,
    overrides
  );
  await hbtc.deployed();
  console.log("HBTC deployed to:", hbtc.address);

  const usdt = await StakingToken.deploy(
    "USDT",
    "USDT",
    18,
    USDT_TOTAL,
    USDT_TOTAL,
    overrides
  );
  console.log("USDT deployed to:", usdt.address);
  await usdt.deployed();

  const heth = await StakingToken.deploy(
    "HETH",
    "HETH",
    18,
    HETH_TOTAL,
    HETH_TOTAL,
    overrides
  );
  await heth.deployed();
  console.log("HETH deployed to:", heth.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
