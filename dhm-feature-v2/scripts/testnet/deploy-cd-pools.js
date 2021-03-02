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
  gasLimit: 8000000,
};

const cPoolSchedule = [
  ["604800", "8652638713609690000000"],
  //
  ["1987200", "25587088767388700000000"],
  //
  ["2592000", "24029613798938900000000"],
  ["5184000", "30037017248673600000000"],
  ["7776000", "40549973285709500000000"],
  ["7776000", "36494975957138500000000"],
  ["7776000", "32845478361424600000000"],
  ["7776000", "29560930525282100000000"],
  ["7776000", "26604837472754000000000"],
  ["7776000", "23944353725478500000000"],
  ["7776000", "21549918352930700000000"],
  //
  ["7776000", "19394926517637700000000"],
  ["7776000", "19394926517637700000000"],
  ["7776000", "19394926517637700000000"],
  ["7776000", "19394926517637700000000"],
  ["7776000", "19394926517637700000000"],
  ["7776000", "19394926517637700000000"],
  ["7776000", "19394926517637700000000"],
  ["7776000", "19394926517637700000000"],
  ["7776000", "19394926517637700000000"],
  ["7776000", "19394926517637700000000"],
  ["7776000", "19394926517637700000000"],
  // last
  ["5184000", "12929951011758400000000"],
];

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

  let tx;

  const pairAddress = "0x474026D0a700361eead9d4BCF74B804f75D3FD70";

  const dht = StakingToken.attach("0x8c69e0D3a7Adeaa06A31D0C38d3B7b9bF2E2804B");
  const usdt = StakingToken.attach(
    "0xBb26d8d7F0f2Fd3Dc1Cf106403aE9303d0553725"
  );
  const wbtc = StakingToken.attach(
    "0x8A366D1825a626526Ac6C5A37E695ec106fF71b2"
  );
  const wht = StakingToken.attach("0x824bbED9422ced34628ca7990296ACD8eEC33fCe");
  const husd = StakingToken.attach(
    "0xe65F781a77d8AB381fB340953B3571cce511D249"
  );
  const heth = StakingToken.attach(
    "0x09CfD5D24cf6A8Fe82e1E5Ca2CBc53f3F20677b3"
  );

  let compositMining = await DHTCompositMining.deploy(overrides);
  const compositMiningProxy = await Proxy.deploy(
    compositMining.address,
    deployer.address,
    [],
    overrides
  );
  compositMining = DHTCompositMining.attach(
    compositMiningProxy.address
  ).connect(manager);
  await compositMining.initialize(
    manager.address,
    dht.address,
    cPoolSchedule,
    wht.address,
    overrides
  );
  console.log("compositMining:", compositMining.address);

  tx = await compositMining.newPool(wht.address, 3200, overrides);
  await tx.wait(1);
  tx = await compositMining.newPool(wbtc.address, 1700, overrides);
  await tx.wait(1);
  tx = await compositMining.newPool(usdt.address, 1700, overrides);
  await tx.wait(1);
  tx = await compositMining.newPool(husd.address, 1700, overrides);
  await tx.wait(1);
  tx = await compositMining.newPool(heth.address, 1700, overrides);
  await tx.wait(1);

  console.log("wht pool:", await compositMining.LP2Pool(wht.address));
  console.log("husd pool:", await compositMining.LP2Pool(husd.address));
  console.log("wbtc pool:", await compositMining.LP2Pool(wbtc.address));
  console.log("usdt pool:", await compositMining.LP2Pool(usdt.address));
  console.log("heth pool:", await compositMining.LP2Pool(heth.address));

  const group = await GroupNextPeriod.deploy(overrides);
  console.log("group nextPeriod:", group.address);
  const dDistr = await Distributor.deploy(23, overrides);
  console.log("distr for dpool: ", dDistr.address);
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
  await group.add(dDistr.address, overrides);
  await group.add(compositMining.address, overrides);
  await compositMining.updatePeriodControl(group.address, overrides);
  tx = await dDistr.transferOwnership(group.address, overrides);
  await tx.wait(2);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
