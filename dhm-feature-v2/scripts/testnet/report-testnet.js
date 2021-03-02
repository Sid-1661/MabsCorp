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

  // const stakeDHM = StakeDHM.attach("");
  const stakeDHMv2 = StakeDHM.attach(
    "0xfe49A60244cd886c6a8FF8510FEAbA349b739c8b"
  ).connect(zeus);
  const stakeLP = StakeDHM.attach(
    "0xa47520d705CBb2D330dB07d4C09965620B21AdB0"
  ).connect(zeus);
  const contractReporter = "0xB46F43f68B04F88cBEA9fe8A19F9294C9727f3E9";

  // await stakeDHM.set_reward_reporter(zeus.address);
  await stakeDHMv2.set_reward_reporter(zeus.address);
  await stakeLP.set_reward_reporter(zeus.address);

  let tx;

  let epoch_start = ethers.BigNumber.from(
    await stakeDHMv2.latest_reported_epoch()
  );
  if (epoch_start.eq(0)) {
    epoch_start = ethers.BigNumber.from(await stakeDHM.default_epoch());
    console.log("report default:");
    // await stakeDHM
    //   .connect(zeus)
    //   .report_timestamp_reward(epoch_start.mul(1000), 0, false);
    await stakeDHMv2.report_timestamp_reward(epoch_start.mul(1000), 0, false);
    await stakeLP.report_timestamp_reward(epoch_start.mul(1000), 0, false);
  }

  const current = ethers.BigNumber.from(
    Math.floor(new Date().getTime() / 1000)
  );

  for (let i = epoch_start.add(1); i <= current; i = i.add(1)) {
    console.log("report in:", i.toString());
    // await stakeDHM.connect(zeus).report_timestamp_reward(i.mul(1000), 0, false);
    await stakeDHMv2.report_timestamp_reward(i.mul(1000), 0, false);
    tx = await stakeLP.report_timestamp_reward(i.mul(1000), 0, false);
    await tx.wait(1);
  }
  // const i = 1612932;
  // await stakeDHM.connect(zeus).report_timestamp_reward(i * 1000, 0, false);
  // await stakeDHMv2.connect(zeus).report_timestamp_reward(i * 1000, 0, false);
  // await stakeLP.connect(zeus).report_timestamp_reward(i * 1000, 0, false);
  // for (let i = 1612876; i < 1612937; i++) {
  //   console.log("report in:", i.toString());
  //   await stakeDHM.connect(zeus).report_timestamp_reward(i * 1000, 0, false);
  //   await stakeDHMv2.connect(zeus).report_timestamp_reward(i * 1000, 0, false);
  //   await stakeLP.connect(zeus).report_timestamp_reward(i * 1000, 0, false);
  // }

  // await stakeDHM.set_reward_reporter(contractReporter);
  await stakeDHMv2.set_reward_reporter(contractReporter);
  await stakeLP.set_reward_reporter(contractReporter);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
