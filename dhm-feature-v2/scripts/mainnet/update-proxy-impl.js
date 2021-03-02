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

  const husd = "0x0298c2b32eae4da002a15f36fdf7615bea3da047";
  const hbtc = "0x66a79d23e58475d2738179ca52cd0b41d73f0bea";
  const dhm = DHM.attach("0xca757A8fc34c5d65f38792f329b05E7d9ca8b18E");
  const stake = StakeDHM.attach("0xF556c4E69dCa6d6fB6d3851eAAa4BdAFe17d138E");
  const Proxy = await ethers.getContractFactory("TransparentUpgradeableProxy");
  const DHTMining = await ethers.getContractFactory("DHTMining");

  const newImpl = await DHTMining.deploy();
  const dt = Proxy.attach("0xD0aFcb55e0d7e234B5D772eD7f67984F2b4B27F6");
  await dt.upgradeTo(newImpl.address);

  // await stake.set_reward_reporter("0x0Ea5Ef3A6dAd3Ae7802e88014e92697e7C86988D");
  // const recycle_price = ethers.BigNumber.from("6000000");
  // await dhm.update_minter(deployer.address);
  // await stake.stop_mint();
  // await stake.start_mint();
  // await dhm.update_sell_price(sell_price);
  // await dhm.pause();
  // await stake.unpause();
  // await dhm.update_usdt(husd);
  // await dhm.update_wbtc(hbtc);
  // await dhm.update_sell_price(sell_price);
  // await dhm.update_recycle_price(0);
  // await dhm.update_minter(stakeDHM.address);
  // await stakeDHM.set_reward_token(hbtc);
  // await stakeDHM.set_epoch_length(86400);

  // await dhm.pause();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
