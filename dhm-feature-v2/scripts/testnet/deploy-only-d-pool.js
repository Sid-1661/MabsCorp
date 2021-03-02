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
  gasPrice: ethers.utils.parseUnits("1", "gwei"),
  gasLimit: 3200000,
};

const dPoolSchedule = [
  ["604800", "25957916140829100000000"],
  //
  ["1987200", "76761266302166000000000"],
  //
  ["2592000", "96118455195755700000000"],
  ["5184000", "210259120740715000000000"],
  ["7776000", "283849812999966000000000"],
  ["7776000", "255464831699970000000000"],
  ["7776000", "229918348529972000000000"],
  ["7776000", "206926513676975000000000"],
  ["7776000", "186233862309277000000000"],
  ["7776000", "167610476078350000000000"],
  ["7776000", "150849428470515000000000"],
  //
  ["7776000", "135764485623463000000000"],
  ["7776000", "135764485623463000000000"],
  ["7776000", "135764485623463000000000"],
  ["7776000", "135764485623463000000000"],
  ["7776000", "135764485623463000000000"],
  ["7776000", "135764485623463000000000"],
  ["7776000", "135764485623463000000000"],
  ["7776000", "135764485623463000000000"],
  ["7776000", "135764485623463000000000"],
  ["7776000", "135764485623463000000000"],
  ["7776000", "135764485623463000000000"],
  // last
  ["5184000", "90509657082308900000000"],
];

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
  const GroupNextPeriod = await ethers.getContractFactory("GroupNextPeriod");
  const DHTCompositMining = await ethers.getContractFactory(
    "DHTCompositMining"
  );
  const DHTCompositMiningPool = await ethers.getContractFactory(
    "DHTCompositMiningPool"
  );

  // placeholder
  const pairAddress = "0xFE310b3EAcCa86EECbF7aBd6B60C9326B18B8D52";

  const dht = StakingToken.attach("0x3038dE6c624b49FB252B19eCb67d926F0477E370");
  const usdt = StakingToken.attach(
    "0xAa97F4b11615D7bB7e06ba9A0A87202bA0044933"
  );
  const wbtc = StakingToken.attach(
    "0xBAb6be22D1598d6B84F47db8295739F954C0d194"
  );
  const wht = StakingToken.attach("0x4ce287F5Debed6bFDA72161441e6762b7899de0A");
  const husd = StakingToken.attach(
    "0xC13cCfC4dbE28E0aB3836D45f4C1EEd692E1D1c5"
  );
  const heth = StakingToken.attach(
    "0x5dDC78fcF02BD19fA153E762518AbEfD68C6A493"
  );

  const group = GroupNextPeriod.attach(
    "0x62e77DA322BAb0b8A513eE8A87923cB99daC224B"
  );
  const dDistr = Distributor.attach(
    "0x36144367a47c395eCD17B25A71371ad9Bc8BdB2F"
  );
  let dPool = await DHTCompositMiningPool.deploy(overrides);
  const dPoolProxy = await Proxy.deploy(
    dPool.address,
    deployer.address,
    [],
    overrides
  );
  dPool = DHTCompositMiningPool.attach(dPoolProxy.address).connect(manager);
  await dDistr.addPool(dPool.address, dPoolSchedule, overrides);
  await dPool.initialize(
    manager.address,
    dht.address,
    pairAddress,
    dDistr.address,
    overrides
  );
  console.log("dpool:", dPool.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
