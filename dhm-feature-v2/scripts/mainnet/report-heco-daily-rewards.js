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
  const StakeDHMAddress = "0xF556c4E69dCa6d6fB6d3851eAAa4BdAFe17d138E";

  const stakeDHM = StakeDHM.attach(StakeDHMAddress);
  const epoch_length = 86400;
  let epoch_start = ethers.BigNumber.from(
    await stakeDHM.latest_reported_epoch()
  );

  // console.log("latest_reported_epoch:", epoch_start.toString());
  // console.log((await stakeDHM.total_rewarded()).toString());

  const rewards = ethers.BigNumber.from("117252637574000000");
  const ts = 1612573878;
  await stakeDHM.report_timestamp_reward(ts, rewards, false);

  // if (epoch_start.eq(0)) {
  //   epoch_start = ethers.BigNumber.from(await stakeDHM.default_epoch());
  //   console.log("report default:");
  //   await stakeDHM.report_timestamp_reward(
  //     epoch_start.mul(epoch_length),
  //     0,
  //     true
  //   );
  // }
  // const current = ethers.BigNumber.from(
  //   Math.floor(new Date().getTime() / epoch_length)
  // );
  // const rewards = ethers.BigNumber.from("22144290395765100");
  // for (let i = epoch_start.add(1); i <= current; i = i.add(1)) {
  //   console.log("report in:", i.toString());
  //   await stakeDHM.report_timestamp_reward(i.mul(epoch_length), 0, true);
  // }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
