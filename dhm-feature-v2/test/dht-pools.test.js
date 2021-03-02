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

describe("DHT pools", function () {
  const D18 = ethers.BigNumber.from("1000000000000000000");
  const D6 = ethers.BigNumber.from(1000000);
  const D8 = ethers.BigNumber.from("100000000");
  const DHM_SUPPLY = D18.mul(ethers.BigNumber.from(1000000));
  const USDT_TOTAL = D8.mul(ethers.BigNumber.from("10000000000000000000"));
  const WBTC_TOTAL = D18.mul(100000000);

  const DHT_TOTAL = D18.mul(ethers.BigNumber.from("10000000"));

  beforeEach(async function () {
    const [deployer, zeus, other1, other2, other3] = await ethers.getSigners();

    const DHM = await ethers.getContractFactory("DHM");
    const StakingToken = await ethers.getContractFactory("StakingToken");
    const StakeDHM = await ethers.getContractFactory("StakeDHM");
    const DHT = await ethers.getContractFactory("StakingToken");
    const DHTMining = await ethers.getContractFactory("DHTMining");
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

    this.distributor = await Distributor.deploy(22);

    const poolA = await DHTMining.deploy();
    const poolAProxy = await Proxy.deploy(poolA.address, deployer.address, []);
    this.poolA = DHTMining.attach(poolAProxy.address).connect(zeus);
    await this.poolA.initialize(
      zeus.address,
      this.dht.address,
      this.stakeDHM.address,
      this.distributor.address
    );
    // const pairAddress = "";
    // this.poolB = await PoolA.deploy(
    //   this.dht.address,
    //   pairAddress,
    //   this.distributor.address
    // );

    const paSchedule = [
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
    await this.distributor.addPool(this.poolA.address, paSchedule);

    const sell_price = ethers.BigNumber.from(7000000);
    // const recycle_price = ethers.BigNumber.from(6000000);
    await this.dhm.update_usdt(this.usdt.address);
    await this.dhm.update_sell_price(sell_price);
    // await dhm.update_recycle_price(recycle_price);
    await this.dhm.update_minter(this.stakeDHM.address);
    // await this.stakeDHM.set_reward_reporter(other1.address);
    await this.stakeDHM.set_epoch_length(100);
    await this.dhm.unpause();
    await this.stakeDHM.unpause();
    // await stakeDHM.set_reward_reporter(zeus.address);

    await this.dht.mint(D18.mul(1000000));
    await this.dht.transfer(this.poolA.address, D18.mul(1000000));

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

    console.log(await this.stakeDHM.reward_reporter());
  });

  it("start a-pool mining", async function () {
    const [deployer, zeus, other1, other2, other3] = await ethers.getSigners();

    // get 100 DHM
    const balance = sell_price.mul(100).mul(100);
    await this.usdt.connect(other1).approve(this.dhm.address, balance);
    await this.dhm.connect(other1).buy(D18.mul(10));
    await this.dhm.connect(other1).approve(this.stakeDHM.address, D18.mul(10));
    await this.stakeDHM.connect(other1).stake(D18.mul(10));

    await this.usdt.connect(other2).approve(this.dhm.address, balance);
    await this.dhm.connect(other2).buy(D18.mul(10));
    await this.dhm.connect(other2).approve(this.stakeDHM.address, D18.mul(10));
    await this.stakeDHM.connect(other2).stake(D18.mul(10));

    const lp_balance = await this.stakeDHM.balanceOf(other1.address);
    await this.stakeDHM.connect(other1).approve(this.poolA.address, lp_balance);
    await this.poolA.connect(other1).stake(lp_balance);

    await this.distributor.nextPeriod();
    console.log(
      (await this.poolA.connect(other1).earned(other1.address)).toString()
    );
    await increaseTime(86400 / 2);
    await mineBlocks(1);
    console.log(
      (await this.poolA.connect(other1).earned(other1.address)).toString()
    );
    await increaseTime(100);
    await mineBlocks(1);
    console.log((await this.poolA.rewardPerToken()).toString());
    await this.stakeDHM.connect(other2).approve(this.poolA.address, lp_balance);
    await this.poolA.connect(other2).stake(lp_balance);
    await increaseTime(86400 / 2);
    await mineBlocks(1);
    console.log(
      (await this.poolA.connect(other1).earned(other1.address)).toString()
    );
    console.log(
      (await this.poolA.connect(other1).earned(other2.address)).toString()
    );

    await increaseTime(864000);
    await mineBlocks(1);
    console.log(
      (await this.poolA.connect(other1).earned(other1.address)).toString()
    );
    await increaseTime(864000);
    await mineBlocks(1);
    await this.poolA.connect(other1).exit();
    console.log(await this.poolA.stakers_length());
    console.log(await this.poolA.stakerExists(other1.address));
  });

  it("evacuate", async function () {
    const [deployer, zeus, other1, other2, other3] = await ethers.getSigners();

    // get 100 DHM
    const balance = sell_price.mul(100).mul(100);
    await this.usdt.connect(other1).approve(this.dhm.address, balance);
    await this.dhm.connect(other1).buy(D18.mul(10));
    await this.dhm.connect(other1).approve(this.stakeDHM.address, D18.mul(10));
    await this.stakeDHM.connect(other1).stake(D18.mul(10));

    const lp_balance = await this.stakeDHM.balanceOf(other1.address);
    await this.stakeDHM.connect(other1).approve(this.poolA.address, lp_balance);
    await this.poolA.connect(other1).stake(lp_balance);

    await this.distributor.nextPeriod();

    await expect(
      this.poolA.evacuate(this.dhm.address, D18.mul(10), other1.address)
    ).to.be.revertedWith("the pool is not stopped yet");
    await expect(
      this.poolA
        .connect(other1)
        .evacuate(this.dhm.address, D18.mul(10), other1.address)
    ).to.be.revertedWith("caller is not owner");

    await this.poolA.stop();
    await expect(this.distributor.nextPeriod()).to.be.revertedWith(
      "the pool has been stopped"
    );

    await expect(this.stakeDHM.connect(other1).withdraw()).to.be.revertedWith(
      "SafeMath: subtraction overflow"
    );

    await this.poolA.evacuate(
      this.stakeDHM.address,
      D18.mul(10),
      other1.address
    );
    expect(await this.stakeDHM.balanceOf(other1.address)).to.equal(D18.mul(10));
    await this.stakeDHM.connect(other1).withdraw();
    expect(await this.stakeDHM.balanceOf(other1.address)).to.equal(0);
  });
});
