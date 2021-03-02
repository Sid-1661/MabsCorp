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

describe("StakeDHM", function () {
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
    this.dhm = await this.dhm.connect(zeus);

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
    await this.dhm.update_minter(this.stakeDHM.address);

    await this.dhm.update_usdt(this.usdt.address);
    await this.dhm.update_sell_price(sell_price);
    await this.dhm.update_recycle_price(recycle_price);
    // await this.stakeDHM.set_reward_reporter(zeus.address);
    await this.stakeDHM.set_epoch_length(CK); // every 1000 seconds
    await this.dhm.unpause();
    await this.stakeDHM.unpause();

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
    await this.dhm.connect(other1).approve(this.stakeDHM.address, dhm_balance);
    await this.stakeDHM.connect(other1).stake(dhm_balance);

    expect(await this.stakeDHM.get_stake(other1.address)).to.equal(dhm_balance);
    expect(await this.stakeDHM.current_total_stakes()).to.equal(dhm_balance);
  });

  it("withdraw works", async function () {
    const [deployer, zeus, other1, other2, other3] = await ethers.getSigners();
    const usdt_balance = D8.mul(65);
    const dhm_balance = D18.mul(10);

    const last_claim = await this.stakeDHM.last_claim_epochs(other1.address);
    expect(last_claim).to.equal(0);

    await this.usdt.connect(other1).approve(this.dhm.address, usdt_balance);
    await this.dhm.connect(other1).buy(dhm_balance);
    await this.dhm.connect(other1).approve(this.stakeDHM.address, dhm_balance);
    await this.stakeDHM.connect(other1).stake(dhm_balance);
    expect(await this.stakeDHM.get_stake(other1.address)).to.equal(dhm_balance);
    expect(await this.stakeDHM.current_total_stakes()).to.equal(dhm_balance);

    await this.stakeDHM.connect(other1).withdraw();
    expect(await this.stakeDHM.get_stake(other1.address)).to.equal(0);
    expect(await this.stakeDHM.current_total_stakes()).to.equal(0);

    await this.dhm.connect(other1).approve(this.stakeDHM.address, dhm_balance);
    await this.stakeDHM.connect(other1).stake(dhm_balance);

    await increaseTime(CK);
    await mineBlocks(1);

    await this.stakeDHM.connect(other1).withdraw();

    expect(await this.stakeDHM.last_claim_epochs(other1.address)).to.equal(
      (await this.stakeDHM.default_epoch()).add(1)
    );
  });

  it("stake & report & rewards_to_claim", async function () {
    const [deployer, zeus, other1, other2, other3] = await ethers.getSigners();
    const usdt_balance = D8.mul(65);
    const dhm_balance = D18.mul(10);

    await this.usdt.connect(other1).approve(this.dhm.address, usdt_balance);
    await this.dhm.connect(other1).buy(dhm_balance);
    await this.dhm.connect(other1).approve(this.stakeDHM.address, dhm_balance);
    // stake 1 DHM
    await this.stakeDHM.report_timestamp_reward(
      await getBlockTimestamp(),
      100000000,
      false
    );
    await this.stakeDHM.connect(other1).stake(D18);
    expect(await this.stakeDHM.rewards_to_claim(other1.address)).to.equal(0);

    await increaseTime(CK);
    await mineBlocks(1);
    await this.stakeDHM.report_timestamp_reward(
      await getBlockTimestamp(),
      100000000,
      false
    );
    await increaseTime(CK);
    await mineBlocks(1);
    await this.stakeDHM.report_timestamp_reward(
      await getBlockTimestamp(),
      100000000,
      false
    );
    expect(await this.stakeDHM.rewards_to_claim(other1.address)).to.equal(
      ethers.BigNumber.from(100000000)
    );
  });

  it("claim works", async function () {
    const [deployer, zeus, other1, other2, other3] = await ethers.getSigners();
    const usdt_balance = D8.mul(65);
    const dhm_balance = D18.mul(10);

    await this.usdt.connect(other1).approve(this.dhm.address, usdt_balance);
    await this.dhm.connect(other1).buy(dhm_balance);
    await this.dhm.connect(other1).approve(this.stakeDHM.address, dhm_balance);

    const reward = ethers.BigNumber.from(100000000);
    // stake 1 DHM
    await this.stakeDHM.report_timestamp_reward(
      await getBlockTimestamp(),
      0,
      false
    );
    await this.stakeDHM.connect(other1).stake(D18);
    expect(
      (await this.stakeDHM.last_claim_epochs(other1.address)).sub(
        await this.stakeDHM.default_epoch()
      )
    ).to.equal(1);
    expect(await this.stakeDHM.rewards_to_claim(other1.address)).to.equal(0);

    await increaseTime(CK);
    await mineBlocks(1);
    await this.stakeDHM.report_timestamp_reward(
      await getBlockTimestamp(),
      reward,
      false
    );
    await increaseTime(CK);
    await mineBlocks(1);
    await this.stakeDHM.report_timestamp_reward(
      await getBlockTimestamp(),
      reward,
      false
    );

    // 2 epochs passed , 1 reward can be claimed
    // other1 doesn't take any part in the first epoch
    // so claiming starts from the second epoch
    expect(await this.stakeDHM.rewards_to_claim(other1.address)).to.equal(
      reward
    );

    const claimed_epoch = await this.stakeDHM.last_claim_epochs(other1.address);
    await this.stakeDHM.connect(other1).claim(0); // claim all I can claim
    expect(
      (await this.stakeDHM.last_claim_epochs(other1.address)).sub(claimed_epoch)
    ).to.equal(1);

    expect(await this.wbtc.balanceOf(other1.address)).to.equal(100000000);
    expect(await this.wbtc.balanceOf(this.stakeDHM.address)).to.equal(
      WBTC_TOTAL.div(100).sub(100000000)
    );

    await increaseTime(CK);
    await mineBlocks(1);
    await this.stakeDHM.report_timestamp_reward(
      await getBlockTimestamp(),
      reward,
      false
    );

    expect(await this.stakeDHM.rewards_to_claim(other1.address)).to.equal(
      reward
    );
  });

  it("auto claim before withdraw", async function () {
    const [deployer, zeus, other1, other2, other3] = await ethers.getSigners();
    const usdt_balance = D8.mul(65);
    const dhm_balance = D18.mul(10);

    await this.usdt.connect(other1).approve(this.dhm.address, usdt_balance);
    await this.dhm.connect(other1).buy(dhm_balance);
    await this.dhm.connect(other1).approve(this.stakeDHM.address, dhm_balance);
    // stake 1 DHM
    await this.stakeDHM.report_timestamp_reward(
      await getBlockTimestamp(),
      100000000,
      false
    );
    await this.stakeDHM.connect(other1).stake(D18);

    await increaseTime(CK);
    await mineBlocks(1);
    await this.stakeDHM.report_timestamp_reward(
      await getBlockTimestamp(),
      100000000,
      false
    );
    await increaseTime(CK);
    await mineBlocks(1);
    await this.stakeDHM.report_timestamp_reward(
      await getBlockTimestamp(),
      100000000,
      false
    );

    expect(await this.stakeDHM.rewards_to_claim(other1.address)).to.equal(
      ethers.BigNumber.from(100000000)
    );

    const claimed_epoch = await this.stakeDHM.last_claim_epochs(other1.address);
    await this.stakeDHM.connect(other1).withdraw();
    expect(
      claimed_epoch.sub(await this.stakeDHM.last_claim_epochs(other1.address))
    ).to.equal(-1);

    expect(await this.wbtc.balanceOf(other1.address)).to.equal(100000000);
  });

  it("auto claim before stake", async function () {
    const [deployer, zeus, other1, other2, other3] = await ethers.getSigners();
    const usdt_balance = D8.mul(65);
    const dhm_balance = D18.mul(10);

    await this.usdt.connect(other1).approve(this.dhm.address, usdt_balance);
    await this.dhm.connect(other1).buy(dhm_balance);
    await this.dhm.connect(other1).approve(this.stakeDHM.address, dhm_balance);

    await this.usdt.connect(other2).approve(this.dhm.address, usdt_balance);
    await this.dhm.connect(other2).buy(dhm_balance);
    await this.dhm.connect(other2).approve(this.stakeDHM.address, dhm_balance);

    await this.usdt.connect(other3).approve(this.dhm.address, usdt_balance);
    await this.dhm.connect(other3).buy(dhm_balance);
    await this.dhm.connect(other3).approve(this.stakeDHM.address, dhm_balance);

    // stake 1 DHM
    await this.stakeDHM.connect(other1).stake(D18);
    await this.stakeDHM.connect(other2).stake(D18);
    await this.stakeDHM.connect(other3).stake(D18);

    const reward = ethers.BigNumber.from(100000000);
    {
      // move a epoch further
      await increaseTime(CK);
      await mineBlocks(1);
      await this.stakeDHM.report_timestamp_reward(
        await getBlockTimestamp(),
        reward,
        false
      );
      expect(await this.stakeDHM.rewards_to_claim(other1.address)).to.equal(0);
      await increaseTime(CK);
      await mineBlocks(1);
      await this.stakeDHM.report_timestamp_reward(
        await getBlockTimestamp(),
        reward,
        false
      );
      expect(await this.stakeDHM.rewards_to_claim(other1.address)).to.equal(
        reward.div(3)
      );
    }
    {
      // move a epoch further
      await increaseTime(CK);
      await mineBlocks(1);
      await this.stakeDHM.report_timestamp_reward(
        await getBlockTimestamp(),
        reward,
        false
      );
      expect(await this.stakeDHM.rewards_to_claim(other2.address)).to.equal(
        ethers.BigNumber.from(reward.mul(2).div(3))
      );
    }
    {
      // move a epoch further
      await increaseTime(CK);
      await mineBlocks(1);
      await this.stakeDHM.report_timestamp_reward(
        await getBlockTimestamp(),
        reward,
        false
      );
      expect(
        (await this.stakeDHM.rewards_to_claim(other2.address))
          .div(reward)
          .abs() <= 1
      ).to.equal(true);
    }
  });

  it("makeup for missing epochs", async function () {
    const [deployer, zeus, other1, other2, other3] = await ethers.getSigners();
    const usdt_balance = D8.mul(65);
    const dhm_balance = D18.mul(10);

    await this.usdt.connect(other1).approve(this.dhm.address, usdt_balance);
    await this.dhm.connect(other1).buy(dhm_balance);
    await this.dhm.connect(other1).approve(this.stakeDHM.address, dhm_balance);

    await this.usdt.connect(other2).approve(this.dhm.address, usdt_balance);
    await this.dhm.connect(other2).buy(dhm_balance);
    await this.dhm.connect(other2).approve(this.stakeDHM.address, dhm_balance);

    await this.usdt.connect(other3).approve(this.dhm.address, usdt_balance);
    await this.dhm.connect(other3).buy(dhm_balance);
    await this.dhm.connect(other3).approve(this.stakeDHM.address, dhm_balance);

    // stake 1 DHM
    await this.stakeDHM.connect(other1).stake(D18);
    await this.stakeDHM.connect(other2).stake(D18);
    await this.stakeDHM.connect(other3).stake(D18);

    const reward = ethers.BigNumber.from(100000000);
    {
      // move a epoch further
      await increaseTime(CK);
      await mineBlocks(1);
      await this.stakeDHM.report_timestamp_reward(
        await getBlockTimestamp(),
        reward,
        false
      );
      await increaseTime(CK);
      await mineBlocks(1);
      await this.stakeDHM.report_timestamp_reward(
        await getBlockTimestamp(),
        reward,
        false
      );
      expect(await this.stakeDHM.rewards_to_claim(other1.address)).to.equal(
        reward.div(3)
      );
    }
    {
      // move 2 epoch further
      await increaseTime(CK * 2);
      await mineBlocks(1);
      await this.stakeDHM.report_timestamp_reward(
        await getBlockTimestamp(),
        reward,
        false
      );
      expect(await this.stakeDHM.rewards_to_claim(other2.address)).to.equal(
        reward.div(3)
      );

      await this.stakeDHM.report_timestamp_reward(
        ethers.BigNumber.from(await getBlockTimestamp()).sub(CK),
        reward,
        false
      );
      expect(
        (await this.stakeDHM.rewards_to_claim(other2.address))
          .sub(reward)
          .abs() <= 1
      ).to.equal(true);
    }
  });

  it("staking 50%, mint 10%", async function () {
    const [deployer, zeus, other1, other2, other3] = await ethers.getSigners();
    const usdt_balance = D8.mul(65);
    const dhm_balance = D18.mul(10);

    const half_supply = (await this.dhm.totalSupply()).div(2);
    const usdt_needed = half_supply.mul(sell_price).mul(100).div(D18);

    await this.usdt.connect(other1).approve(this.dhm.address, usdt_needed);
    await this.dhm.connect(other1).buy(half_supply);
    await this.dhm.connect(other1).approve(this.stakeDHM.address, half_supply);
    await this.stakeDHM.connect(other1).stake(half_supply);

    // second mint
    // expect(await this.dhm.totalSupply()).to.equal(half_supply.mul(4));

    // expect(await this.dhm.balanceOf(other1.address)).to.equal(0);

    // await this.usdt.connect(other1).approve(this.dhm.address, usdt_needed);
    // await this.dhm.connect(other1).buy(half_supply);

    // await this.dhm.connect(other1).recycle(half_supply, recycle_price);

    // const _null = "0x0000000000000000000000000000000000000000";
    // const avail_total = (await this.dhm.totalSupply()).sub(
    //   await this.dhm.balanceOf(_null)
    // );

    // const new_half = avail_total.div(2);

    // expect(new_half < (await this.dhm.totalSupply()));

    // await this.usdt
    //   .connect(other1)
    //   .approve(this.dhm.address, new_half.mul(sell_price).div(D18));
    // await this.dhm.connect(other1).buy(new_half);

    // await this.dhm.connect(other1).approve(this.stakeDHM.address, new_half);
    // await this.stakeDHM.connect(other1).stake(new_half);

    // // third mint
    // expect(await this.dhm.totalSupply()).to.equal(half_supply.mul(6));
  });
});
