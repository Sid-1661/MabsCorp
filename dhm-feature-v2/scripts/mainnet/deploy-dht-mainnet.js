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
  gasPrice: ethers.utils.parseUnits("10", "gwei"),
  gasLimit: 8640000,
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
    "0xF556c4E69dCa6d6fB6d3851eAAa4BdAFe17d138E"
  );

  await StakeDHM.attach("0xaf3aDb3C926b73A907dE20d6086f98995a6b2b32")
    .connect(manager)
    .unpause();
  await StakeDHM.attach("0x711Ad88C2D3b93195A6852617c9e03804F952208")
    .connect(manager)
    .unpause();
  await Distributor.attach(
    "0x5ADc525eD756b94Fe333D80120fec2d09f3687dB"
  ).nextPeriod();
  return;

  const dhm = DHM.attach("0xca757A8fc34c5d65f38792f329b05E7d9ca8b18E");
  const usdt = StakingToken.attach(
    "0x0298c2b32eae4da002a15f36fdf7615bea3da047"
  );
  const wbtc = StakingToken.attach(
    "0x66a79d23e58475d2738179ca52cd0b41d73f0bea"
  );
  const stakeDHM = await StakeDHM.deploy(overrides);
  const stakeDHMProxy = await Proxy.deploy(
    stakeDHM.address,
    deployer.address,
    [],
    overrides
  );
  console.log("StakeDHMv2 deployed to:", stakeDHM.address);
  console.log("StakeDHMProxy deployed to:", stakeDHMProxy.address);
  const proxiedStakeDHMv2 = StakeDHM.attach(stakeDHMProxy.address).connect(
    manager
  );
  await proxiedStakeDHMv2.initialize(
    manager.address,
    dhm.address,
    wbtc.address,
    "Stake DHM Mine BTC",
    "stake_dhm_lp",
    overrides
  );
  console.log("init stakedhm v2");

  const dht = await DHT.deploy(
    "DHT",
    "DHT",
    18,
    DHT_TOTAL,
    DHT_TOTAL,
    overrides
  );
  console.log("DHT deployed to:", dht.address);

  const distributor = await Distributor.deploy(22);
  console.log("distributor deployed to:", distributor.address);

  // const poolA = await PoolA.deploy(
  //   dht.address,
  //   stakeDHM.address,
  //   distributor.address,
  //   overrides
  // );
  // console.log("poolA:", poolA.address);

  const pairLP = "0xe38213d35e73d6b8abe10da027ad7523f0b8728c";
  const stakeDHMUSDT = await StakeDHM.deploy(overrides);
  const stakeDHMUSDTProxy = await Proxy.deploy(
    stakeDHMUSDT.address,
    deployer.address,
    [],
    overrides
  );
  console.log("StakeDHMUSDT deployed to:", stakeDHMUSDT.address);
  console.log("StakeDHMUSDTProxy deployed to:", stakeDHMUSDTProxy.address);
  const proxiedStakeDHMUSDT = StakeDHM.attach(
    stakeDHMUSDTProxy.address
  ).connect(manager);
  await proxiedStakeDHMUSDT.initialize(
    manager.address,
    pairLP,
    wbtc.address,
    "Stake LP Mine BTC",
    "dhm_mdex_lp",
    overrides
  );
  console.log("init stake dhmusdt");

  const poolB = await DHTMining.deploy(overrides);
  console.log("poolB:", poolB.address);
  const poolBProxy = await Proxy.deploy(
    poolB.address,
    deployer.address,
    [],
    overrides
  );
  console.log("poolBProxy:", poolBProxy.address);
  const proxiedPoolB = DHTMining.attach(poolBProxy.address).connect(manager);
  await proxiedPoolB.initialize(
    manager.address,
    dht.address,
    proxiedStakeDHMUSDT.address,
    distributor.address,
    overrides
  );
  console.log("init poolb");

  const contractReporter = await Reporter.deploy(reporter.address, overrides);
  console.log("reward reporter deployed: ", contractReporter.address);
  console.log("set stake btc reward shares:");
  await contractReporter.addPool(stakeDHMv1.address, 0, overrides);
  await contractReporter.addPool(proxiedStakeDHMv2.address, 2450, overrides);
  await contractReporter.addPool(proxiedStakeDHMUSDT.address, 4550, overrides);
  console.log("set stakeDHMv1 reporter:");
  await stakeDHMv1.set_reward_reporter(contractReporter.address, overrides);

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
  await proxiedStakeDHMv2.report_timestamp_reward(ts, 0, false, overrides);
  await proxiedStakeDHMv2.set_reward_reporter(
    contractReporter.address,
    overrides
  );
  // await proxiedStakeDHMv2.unpause();

  console.log("setup StakeDHMUSDT:");
  await proxiedStakeDHMUSDT.report_timestamp_reward(ts, 0, false, overrides);
  await proxiedStakeDHMUSDT.set_reward_reporter(
    contractReporter.address,
    overrides
  );
  // await proxiedStakeDHMUSDT.unpause();

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
