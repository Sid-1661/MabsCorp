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

describe("StakeDHM Guard", function () {
  const D18 = ethers.BigNumber.from("1000000000000000000");
  const D8 = ethers.BigNumber.from("100000000");
  const D6 = ethers.BigNumber.from("1000000");
  const SUPPLY = D18.mul(ethers.BigNumber.from("1000000"));
  const USDT_TOTAL = D8.mul(ethers.BigNumber.from("100000000"));
  const WBTC_TOTAL = D18.mul(ethers.BigNumber.from("100000000"));

  beforeEach(async function () {
    const [deployer, zeus, other1, other2, other3] = await ethers.getSigners();
    const DHM = await ethers.getContractFactory("DHM");
    const Token = await ethers.getContractFactory("StakingToken");
    const StakeDHM = await ethers.getContractFactory("StakeDHM");
    const Proxy = await ethers.getContractFactory(
      "TransparentUpgradeableProxy"
    );

    this.dhm = await DHM.deploy(
      zeus.address,
      "DHash Mining",
      "DHM",
      SUPPLY,
      SUPPLY.div(10)
    );
    this.usdt = await Token.deploy("USDT", "USDT", 8, USDT_TOTAL, USDT_TOTAL);
    this.wbtc = await Token.deploy("WBTC", "WBTC", 18, WBTC_TOTAL, WBTC_TOTAL);
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
    this.dhm = await this.dhm.connect(zeus);
    await this.dhm.connect(zeus).update_minter(this.stakeDHM.address);

    await this.dhm.update_usdt(this.usdt.address);
    await this.dhm.update_sell_price(sell_price);
    await this.dhm.update_recycle_price(recycle_price);
    await this.stakeDHM.set_reward_reporter(zeus.address);
    await this.stakeDHM.set_epoch_length(CK); // every 1000 seconds
    await this.dhm.unpause();
    await this.stakeDHM.unpause();

    const StakeGuard = await ethers.getContractFactory("StakeGuard");
    this.stakeGuard = await StakeGuard.deploy(this.stakeDHM.address);

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
  });

  it("stake works", async function () {
    const [deployer, zeus, other1, other2, other3] = await ethers.getSigners();
    const usdt_balance = D8.mul(65);
    const dhm_balance = D18.mul(10);

    await this.usdt.connect(other1).approve(this.dhm.address, usdt_balance);
    await this.dhm.connect(other1).buy(dhm_balance);
    await this.dhm
      .connect(other1)
      .approve(this.stakeGuard.address, dhm_balance);
    await this.stakeGuard.connect(other1).stake(dhm_balance);

    expect(await this.stakeDHM.get_stake(other1.address)).to.equal(dhm_balance);
    expect(await this.stakeDHM.current_total_stakes()).to.equal(dhm_balance);
  });

  it("two stakes in one epoch", async function () {
    const [deployer, zeus, other1, other2, other3] = await ethers.getSigners();
    const usdt_balance = D8.mul(65);
    const dhm_balance = D18.mul(10);

    await this.usdt.connect(other1).approve(this.dhm.address, usdt_balance);
    await this.dhm.connect(other1).buy(dhm_balance);
    await this.dhm
      .connect(other1)
      .approve(this.stakeGuard.address, dhm_balance);
    await this.stakeGuard.connect(other1).stake(dhm_balance);

    expect(await this.stakeDHM.get_stake(other1.address)).to.equal(dhm_balance);
    expect(await this.stakeDHM.current_total_stakes()).to.equal(dhm_balance);

    await this.usdt.connect(other1).approve(this.dhm.address, usdt_balance);
    await this.dhm.connect(other1).buy(dhm_balance);
    await this.dhm
      .connect(other1)
      .approve(this.stakeGuard.address, dhm_balance);
    await expect(
      this.stakeGuard.connect(other1).stake(dhm_balance)
    ).to.be.revertedWith("StakeDHM: please stake tomorrow");
  });

  it("clear with new epoch", async function () {
    const [deployer, zeus, other1, other2, other3] = await ethers.getSigners();
    const usdt_balance = D8.mul(65);
    const dhm_balance = D18.mul(10);

    await this.usdt.connect(other1).approve(this.dhm.address, usdt_balance);
    await this.dhm.connect(other1).buy(dhm_balance);
    await this.dhm
      .connect(other1)
      .approve(this.stakeGuard.address, dhm_balance);
    await this.stakeGuard.connect(other1).stake(dhm_balance);

    await this.usdt.connect(other1).approve(this.dhm.address, usdt_balance);
    await this.dhm.connect(other1).buy(dhm_balance);
    await this.dhm
      .connect(other1)
      .approve(this.stakeGuard.address, dhm_balance);
    await expect(
      this.stakeGuard.connect(other1).stake(dhm_balance)
    ).to.be.revertedWith("StakeDHM: please stake tomorrow");

    await increaseTime(1000);
    await mineBlocks(1);

    await this.stakeGuard.connect(other1).stake(dhm_balance);
  });
});
