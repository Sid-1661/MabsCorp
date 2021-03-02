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

  const husd = "0xe65F781a77d8AB381fB340953B3571cce511D249";
  const hbtc = "";
  const dhm = DHM.attach("0x847B29E404D0adb1634165DAAD4EBc4FC2365c37");
  // const stake = StakeDHM.attach("");
  const sell_price = ethers.BigNumber.from("1000000");

  // const sk = StakeDHM.attach("0xaf3aDb3C926b73A907dE20d6086f98995a6b2b32");
  // await sk.connect(zeus).stop_mint();

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
  await dhm.update_sell_price(sell_price);
  await dhm.update_usdt(husd);
  // await dhm.update_recycle_price(0);
  // await dhm.update_minter(stakeDHM.address);
  // await stakeDHM.set_reward_token(hbtc);
  // await stakeDHM.set_epoch_length(86400);

  await dhm.unpause();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
