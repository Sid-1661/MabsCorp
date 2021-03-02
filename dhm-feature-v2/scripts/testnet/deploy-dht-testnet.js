const hre = require("hardhat");
const { ethers } = hre;

const D18 = ethers.BigNumber.from("1000000000000000000");
const D6 = ethers.BigNumber.from(1000000);
const D8 = ethers.BigNumber.from("100000000");
const DHM_SUPPLY = D18.mul(ethers.BigNumber.from(1000000));
const USDT_TOTAL = D8.mul(ethers.BigNumber.from("10000000000000000000"));
const BTC_TOTAL = D18.mul(100000000);

const DHT_TOTAL = D18.mul(ethers.BigNumber.from("10000000"));

const fs = require("fs");
const overrides = {
  gasPrice: ethers.utils.parseUnits("2", "gwei"),
  gasLimit: 8000000,
};

async function main() {
  const [deployer, manager, reporter] = await ethers.getSigners();
  const DHM = await ethers.getContractFactory("DHM");
  const StakingToken = await ethers.getContractFactory("StakingToken");
  const StakeDHM = await ethers.getContractFactory("StakeDHM");
  const DHT = await ethers.getContractFactory("StakingToken");
  const DHTMining = await ethers.getContractFactory("DHTMining");
  const Distributor = await ethers.getContractFactory("RewardDistribution");
  const Proxy = await ethers.getContractFactory("TransparentUpgradeableProxy");
  const Reporter = await ethers.getContractFactory("RewardReporter");
  const stakeDHMv1 = StakeDHM.attach(
    "0x2A54Af4929C0fa1343FE05aa193edd7ca9a22b06"
  );

  let tx;

  const dhm = DHM.attach("0x847B29E404D0adb1634165DAAD4EBc4FC2365c37");
  const btc = StakingToken.attach("0x8A366D1825a626526Ac6C5A37E695ec106fF71b2");
  const dht = StakingToken.attach("0x8c69e0D3a7Adeaa06A31D0C38d3B7b9bF2E2804B");
  const stakeDHM = await StakeDHM.deploy(overrides);
  await stakeDHM.deployed();
  const stakeDHMProxy = await Proxy.deploy(
    stakeDHM.address,
    deployer.address,
    [],
    overrides
  );
  await stakeDHMProxy.deployed();
  console.log("StakeDHMv2 deployed to:", stakeDHM.address);
  console.log("StakeDHMProxy deployed to:", stakeDHMProxy.address);
  const proxiedStakeDHMv2 = StakeDHM.attach(stakeDHMProxy.address).connect(
    manager
  );
  await proxiedStakeDHMv2.initialize(
    manager.address,
    dhm.address,
    btc.address,
    "Stake DHM Mine BTC",
    "stake_dhm_lp",
    overrides
  );

  // const dht = await DHT.deploy("DHT", "DHT", 18, DHT_TOTAL, DHT_TOTAL);
  // console.log("DHT deployed to:", dht.address);

  const distributor = await Distributor.deploy(22, overrides);
  await distributor.deployed();
  console.log("distributor deployed to:", distributor.address);

  // const poolA = await PoolA.deploy(
  //   dht.address,
  //   stakeDHM.address,
  //   distributor.address,
  //   overrides
  // );
  // console.log("poolA:", poolA.address);

  const pairLP = "0x0012709C5b9A5bc774d8563400B9ec4A1D0AE8eD";
  const stakeDHMUSDT = await StakeDHM.deploy(overrides);
  await stakeDHMUSDT.deployed();
  console.log("StakeDHMUSDT deployed to:", stakeDHMUSDT.address);
  const stakeDHMUSDTProxy = await Proxy.deploy(
    stakeDHMUSDT.address,
    deployer.address,
    [],
    overrides
  );
  await stakeDHMUSDTProxy.deployed();
  console.log("StakeDHMUSDTProxy deployed to:", stakeDHMUSDTProxy.address);
  const proxiedStakeDHMUSDT = StakeDHM.attach(
    stakeDHMUSDTProxy.address
  ).connect(manager);
  await proxiedStakeDHMUSDT.initialize(
    manager.address,
    pairLP,
    btc.address,
    "Stake LP Mine BTC",
    "dhm_mdex_lp",
    overrides
  );

  const poolB = await DHTMining.deploy(overrides);
  await poolB.deployed();
  console.log("poolB:", poolB.address);
  const poolBProxy = await Proxy.deploy(
    poolB.address,
    deployer.address,
    [],
    overrides
  );
  await poolBProxy.deployed();
  console.log("poolBProxy:", poolBProxy.address);
  const proxiedPoolB = DHTMining.attach(poolBProxy.address).connect(manager);
  await proxiedPoolB.initialize(
    manager.address,
    dht.address,
    proxiedStakeDHMUSDT.address,
    distributor.address,
    overrides
  );

  const contractReporter = await Reporter.deploy(reporter.address, overrides);
  await contractReporter.deployed();
  console.log("reward reporter deployed: ", contractReporter.address);
  console.log("set stake distribution shares:");
  tx = await contractReporter.addPool(stakeDHMv1.address, 0, overrides);
  await tx.wait(1);
  tx = await contractReporter.addPool(
    proxiedStakeDHMv2.address,
    2450,
    overrides
  );
  await tx.wait(1);
  tx = await contractReporter.addPool(
    proxiedStakeDHMUSDT.address,
    4550,
    overrides
  );
  await tx.wait(1);
  console.log("set stakeDHMv1 reporter:");
  tx = await stakeDHMv1.set_reward_reporter(
    contractReporter.address,
    overrides
  );
  await tx.wait(1);

  // const paSchedule = [
  //   ["604800", "8652638713609689497600"],
  //   //
  //   ["1987200", "25587088767388700000000"],
  //   //
  //   ["7776000", "90111051746021000000000"],
  //   ["7776000", "81099946571418900000000"],
  //   ["7776000", "72989951914277000000000"],
  //   ["7776000", "65690956722849300000000"],
  //   ["7776000", "59121861050564400000000"],
  //   ["7776000", "53209674945507900000000"],
  //   ["7776000", "47888707450957100000000"],
  //   ["7776000", "43099836705861400000000"],
  //   //
  //   ["7776000", "38789853035275260000000"],
  //   ["7776000", "38789853035275260000000"],
  //   ["7776000", "38789853035275260000000"],
  //   ["7776000", "38789853035275260000000"],
  //   ["7776000", "38789853035275260000000"],
  //   ["7776000", "38789853035275260000000"],
  //   ["7776000", "38789853035275260000000"],
  //   ["7776000", "38789853035275260000000"],
  //   ["7776000", "38789853035275260000000"],
  //   ["7776000", "38789853035275260000000"],
  //   ["7776000", "38789853035275260000000"],
  //   // last
  //   ["5184000", "25859902023516840000000"],
  // ];
  // await distributor.addPool(poolA.address, paSchedule, overrides);

  const pbSchedule = [
    ["604800", "27688443883551000000000"],
    //
    ["1987200", "81878684055643700000000"],
    //
    ["7776000", "288355365587267000000000"],
    ["7776000", "259519829028540000000000"],
    ["7776000", "233567846125686000000000"],
    ["7776000", "210211061513118000000000"],
    ["7776000", "189189955361806000000000"],
    ["7776000", "170270959825625000000000"],
    ["7776000", "153243863843063000000000"],
    ["7776000", "137919477458757000000000"],
    //
    ["7776000", "124127529712880400000000"],
    ["7776000", "124127529712880400000000"],
    ["7776000", "124127529712880400000000"],
    ["7776000", "124127529712880400000000"],
    ["7776000", "124127529712880400000000"],
    ["7776000", "124127529712880400000000"],
    ["7776000", "124127529712880400000000"],
    ["7776000", "124127529712880400000000"],
    ["7776000", "124127529712880400000000"],
    ["7776000", "124127529712880400000000"],
    ["7776000", "124127529712880400000000"],
    // last
    ["5184000", "82751686475253600000000"],
  ];
  await distributor.addPool(proxiedPoolB.address, pbSchedule, overrides);

  // const sell_price = ethers.BigNumber.from(10000000);
  // const recycle_price = ethers.BigNumber.from(6000000);
  // await dhm.update_usdt(usdt.address);
  // await dhm.update_sell_price(sell_price);
  // await dhm.update_recycle_price(recycle_price);
  // await dhm.update_minter(stakeDHM.address);
  // await dhm.unpause();

  const ts = ethers.BigNumber.from(new Date().getTime()).div(1000);
  console.log("setup StakeDHMv2:");
  await proxiedStakeDHMv2.set_epoch_length(1000, overrides);
  await proxiedStakeDHMv2.report_timestamp_reward(ts, 0, false, overrides);
  await proxiedStakeDHMv2.set_reward_reporter(
    contractReporter.address,
    overrides
  );
  await proxiedStakeDHMv2.unpause(overrides);

  console.log("setup StakeDHMUSDT:");
  await proxiedStakeDHMUSDT.set_epoch_length(1000, overrides);
  await proxiedStakeDHMUSDT.report_timestamp_reward(ts, 0, false, overrides);
  await proxiedStakeDHMUSDT.set_reward_reporter(
    contractReporter.address,
    overrides
  );
  tx = await proxiedStakeDHMUSDT.stop_mint(overrides);
  await tx.wait(1);
  tx = await proxiedStakeDHMUSDT.unpause(overrides);
  await tx.wait(1);

  console.log("check reporter:");
  console.log(await proxiedStakeDHMv2.reward_reporter());
  console.log(await proxiedStakeDHMUSDT.reward_reporter());
  console.log(await stakeDHMv1.reward_reporter());

  // await usdt.mint(ethers.BigNumber.from(D8.mul(100000000)));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
