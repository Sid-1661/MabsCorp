const { expect } = require("chai");

const {
  getBlockTimestamp,
  setBlockTime,
  increaseTime,
  mineBlocks,
  sync: { getCurrentTimestamp },
} = require("./helpers.js");

const CK = 1000;
const sell_price = ethers.BigNumber.from("6500000");
const recycle_price = ethers.BigNumber.from("5000000");

const schedule = [
  ["604800", "8652638713609689497600"],
  //
  ["1987200", "25587088767388700000000"],
  //
  ["7776000", "90111051746021000000000"],
  ["7776000", "81099946571418900000000"],
  ["7776000", "72989951914277000000000"],
  ["7776000", "65690956722849300000000"],
  ["7776000", "59121861050564400000000"],
  ["7776000", "53209674945507900000000"],
  ["7776000", "47888707450957100000000"],
  ["7776000", "43099836705861400000000"],
  //
  ["7776000", "38789853035275260000000"],
  ["7776000", "38789853035275260000000"],
  ["7776000", "38789853035275260000000"],
  ["7776000", "38789853035275260000000"],
  ["7776000", "38789853035275260000000"],
  ["7776000", "38789853035275260000000"],
  ["7776000", "38789853035275260000000"],
  ["7776000", "38789853035275260000000"],
  ["7776000", "38789853035275260000000"],
  ["7776000", "38789853035275260000000"],
  ["7776000", "38789853035275260000000"],
  // last
  ["5184000", "25859902023516840000000"],
];

describe("DHT freestake pools", function () {
  const D18 = ethers.BigNumber.from("1000000000000000000");
  const D6 = ethers.BigNumber.from(1000000);
  const D8 = ethers.BigNumber.from("100000000");
  const DHM_SUPPLY = D18.mul(ethers.BigNumber.from(1000000));
  const USDT_TOTAL = D8.mul(ethers.BigNumber.from("10000000000000000000"));
  const WBTC_TOTAL = D18.mul(100000000);
  const WHT_TOTAL = D18.mul(100000000000);

  const DHT_TOTAL = D18.mul(ethers.BigNumber.from("10000000"));

  beforeEach(async function () {
    const [deployer, zeus, other1, other2, other3] = await ethers.getSigners();

    const DHM = await ethers.getContractFactory("DHM");
    const StakingToken = await ethers.getContractFactory("StakingToken");
    const StakeDHM = await ethers.getContractFactory("StakeDHM");
    const DHT = await ethers.getContractFactory("StakingToken");
    const WHT = await ethers.getContractFactory("WHT");
    const DHTCompositMining = await ethers.getContractFactory(
      "DHTCompositMining"
    );
    const Proxy = await ethers.getContractFactory(
      "TransparentUpgradeableProxy"
    );
    const Distributor = await ethers.getContractFactory("RewardDistribution");

    this.dhm = await DHM.deploy(
      deployer.address,
      "Decentralized Hash Power",
      "DHM",
      DHM_SUPPLY,
      DHM_SUPPLY.div(10)
    );
    this.usdt = await StakingToken.deploy(
      "USDT",
      "USDT",
      8,
      USDT_TOTAL,
      USDT_TOTAL
    );
    this.wbtc = await StakingToken.deploy(
      "WBTC",
      "WBTC",
      18,
      WBTC_TOTAL,
      WBTC_TOTAL
    );
    this.wht = await WHT.deploy();

    const stakeDHM = await StakeDHM.deploy();
    const stakeDHMProxy = await Proxy.deploy(
      stakeDHM.address,
      deployer.address,
      []
    );
    this.stakeDHM = StakeDHM.attach(stakeDHMProxy.address).connect(zeus);
    this.stakeDHM.initialize(
      zeus.address,
      this.dhm.address,
      this.wbtc.address,
      "stakedhm",
      "stakedhm"
    );

    this.dht = await DHT.deploy("DHT", "DHT", 18, DHT_TOTAL, DHT_TOTAL);

    // this.distributor = await Distributor.deploy(22);
    // await this.distributor.addPool(this.poolA.address, paSchedule);

    const compositMining = await DHTCompositMining.deploy();
    const compositMiningProxy = await Proxy.deploy(
      compositMining.address,
      deployer.address,
      []
    );
    this.compositMining = DHTCompositMining.attach(
      compositMiningProxy.address
    ).connect(zeus);
    this.compositMining.initialize(
      zeus.address,
      this.dht.address,
      schedule,
      this.wht.address
    );

    const sell_price = ethers.BigNumber.from(10000000);
    await this.dhm.update_usdt(this.usdt.address);
    await this.dhm.update_sell_price(sell_price);
    await this.stakeDHM.set_epoch_length(100);
    await this.stakeDHM.stop_mint();
    await this.dhm.unpause();
    await this.stakeDHM.unpause();
    // await stakeDHM.set_reward_reporter(zeus.address);

    await this.dht.mint(D18.mul(10000000));
    await this.dht.transfer(this.compositMining.address, D18.mul(3200000));

    await this.usdt.mint(ethers.BigNumber.from(D8.mul(100000000)));

    {
      const balance = USDT_TOTAL.div(100);
      await this.usdt.mint(balance);
      await this.usdt.transfer(other1.address, balance);
    }
    {
      const balance = USDT_TOTAL.div(100);
      await this.usdt.mint(balance);
      await this.usdt.transfer(other2.address, balance);
    }
    {
      const balance = USDT_TOTAL.div(100);
      await this.usdt.mint(balance);
      await this.usdt.transfer(other3.address, balance);
    }
    {
      const balance = WBTC_TOTAL.div(100);
      await this.wbtc.mint(balance);
      await this.wbtc.transfer(this.stakeDHM.address, balance);
    }
    {
      const balance = D18.mul(100);
      await this.wbtc.mint(balance);
      await this.wbtc.transfer(other3.address, balance);
    }
  });

  it("DHTCompositMiningPool owner", async function () {
    const [deployer, zeus, other1, other2, other3] = await ethers.getSigners();
    await this.compositMining.newPool(this.wbtc.address, 2000);
    const wbtcPool = await this.compositMining.LP2Pool(this.wbtc.address);
    const DHTCompositMiningPool = await ethers.getContractFactory(
      "DHTCompositMiningPool"
    );
    expect(await DHTCompositMiningPool.attach(wbtcPool).owner()).to.equal(
      zeus.address
    );
  });

  it("periods don't cross", async function () {
    const [deployer, zeus, other1, other2, other3] = await ethers.getSigners();
    await this.compositMining.newPool(this.wbtc.address, 2000);
    const wbtcPool = await this.compositMining.LP2Pool(this.wbtc.address);
    expect(await this.compositMining.pools(0)).to.equal(wbtcPool);
    await this.compositMining.nextPeriod();
    await expect(this.compositMining.nextPeriod()).to.be.revertedWith(
      "current period is running"
    );
  });

  it("update schedule works", async function () {
    const DHTCompositMiningPool = await ethers.getContractFactory(
      "DHTCompositMiningPool"
    );
    const [deployer, zeus, other1, other2, other3] = await ethers.getSigners();
    let tx;
    const newSchedule = [["1000000", "10000000000000000000000"]];
    tx = await this.compositMining.newSchedule(newSchedule);
    await tx.wait(1);
    tx = await this.compositMining.newPool(this.wbtc.address, 10000);
    await tx.wait(1);
    const wbtcPool = await this.compositMining.LP2Pool(this.wbtc.address);
    tx = await this.compositMining.nextPeriod();
    await tx.wait(1);
    const rewardRate = await DHTCompositMiningPool.attach(
      wbtcPool
    ).rewardRate();
    expect(rewardRate).to.equal(
      ethers.BigNumber.from(newSchedule[0][1]).div(newSchedule[0][0])
    );
  });

  it("stake by DHTCompositMining", async function () {
    const [deployer, zeus, other1, other2, other3] = await ethers.getSigners();
    await this.compositMining.newPool(this.wbtc.address, 2000);
    const wbtcPool = await this.compositMining.LP2Pool(this.wbtc.address);
    const DHTCompositMiningPool = await ethers.getContractFactory(
      "DHTCompositMiningPool"
    );

    await this.wbtc.connect(other3).approve(this.compositMining.address, D18);
    await this.compositMining.connect(other3).stake(this.wbtc.address, D18);
    await this.compositMining.nextPeriod();

    const rewards = ethers.BigNumber.from(schedule[0][1]).div(5);
    expect(await this.dht.balanceOf(wbtcPool)).to.equal(rewards);

    await increaseTime(ethers.BigNumber.from(schedule[0][0]).toNumber());
    await mineBlocks(1);
    await DHTCompositMiningPool.attach(wbtcPool).connect(other3).getReward();

    // there might left some zhazha
    expect(
      (await this.dht.balanceOf(other3.address)).add(
        await this.dht.balanceOf(wbtcPool)
      )
    ).to.equal(rewards);

    expect(rewards.sub(await this.dht.balanceOf(other3.address))).to.lt(100000);
  });

  it("stake into a stopped pool & evacuate dht", async function () {
    const [deployer, zeus, other1, other2, other3] = await ethers.getSigners();
    await this.compositMining.newPool(this.wbtc.address, 2000);
    const wbtcPool = await this.compositMining.LP2Pool(this.wbtc.address);
    const DHTCompositMiningPool = await ethers.getContractFactory(
      "DHTCompositMiningPool"
    );

    await this.compositMining.nextPeriod();

    await DHTCompositMiningPool.attach(wbtcPool).connect(zeus).stop();

    await this.wbtc.connect(other3).approve(this.compositMining.address, D18);
    await expect(
      this.compositMining.connect(other3).stake(this.wbtc.address, D18)
    ).to.be.revertedWith("the pool has been stopped");

    const rewards = ethers.BigNumber.from(schedule[0][1]).div(5);
    await DHTCompositMiningPool.attach(wbtcPool)
      .connect(zeus)
      .evacuate(this.dht.address, rewards, other3.address);
    expect(await this.dht.balanceOf(other3.address)).to.equal(rewards);

    await expect(
      this.compositMining.closePool(this.wbtc.address)
    ).to.be.revertedWith("current period is running");
  });

  it("no opened pools no new period", async function () {
    await expect(this.compositMining.nextPeriod()).to.be.revertedWith(
      "no opened pools"
    );
  });

  it("stake HT", async function () {
    const [deployer, zeus, other1, other2, other3] = await ethers.getSigners();
    await this.compositMining.newPool(this.wht.address, 2000);
    const whtPool = await this.compositMining.LP2Pool(this.wht.address);
    const DHTCompositMiningPool = await ethers.getContractFactory(
      "DHTCompositMiningPool"
    );

    // await this.wht.connect(other3).approve(this.compositMining.address, D18);
    await this.compositMining
      .connect(other3)
      .stake("0x0000000000000000000000000000000000000000", 0, { value: D18 });
    await this.compositMining.nextPeriod();

    const rewards = ethers.BigNumber.from(schedule[0][1]).div(5);
    expect(await this.dht.balanceOf(whtPool)).to.equal(rewards);

    await increaseTime(ethers.BigNumber.from(schedule[0][0]).toNumber());
    await mineBlocks(1);
    await DHTCompositMiningPool.attach(whtPool).connect(other3).getReward();

    // there might left some zhazha
    expect(
      (await this.dht.balanceOf(other3.address)).add(
        await this.dht.balanceOf(whtPool)
      )
    ).to.equal(rewards);

    expect(rewards.sub(await this.dht.balanceOf(other3.address))).to.lt(100000);
  });
});
