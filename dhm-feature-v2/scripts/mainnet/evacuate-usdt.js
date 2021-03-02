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
  const StakeDHM = await ethers.getContractFactory("StakeDHM");
  const Token = await ethers.getContractFactory("StakingToken");

  const husd = "0x0298c2b32eae4da002a15f36fdf7615bea3da047";
  const hbtc = "0x66a79d23e58475d2738179ca52cd0b41d73f0bea";
  const dhm = DHM.attach("0xca757A8fc34c5d65f38792f329b05E7d9ca8b18E");
  const stake = StakeDHM.attach("0xF556c4E69dCa6d6fB6d3851eAAa4BdAFe17d138E");
  const token = Token.attach(husd);

  // console.log((await token.decimals()).toString());
  await dhm.evacuate_usdt(
    "0xaccd477a96cd7205369f3caa2be8e66d76846d24",
    // "0x0709ed3b3ee9148d7a1a86b79f87701aa4551390",
    // "0x0ef47c481572e6763c4d288c2d65d5371007719d",
    // ethers.BigNumber.from("10957680000000")
    await token.balanceOf(dhm.address)
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
