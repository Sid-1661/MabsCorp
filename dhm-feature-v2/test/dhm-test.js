const { expect } = require("chai");

describe("DHM", function () {
  const D18 = ethers.BigNumber.from("1000000000000000000");
  const D8 = ethers.BigNumber.from("100000000");
  const D6 = ethers.BigNumber.from("1000000");
  const SUPPLY = D18.mul(1000000);
  const USDT_TOTAL = ethers.BigNumber.from("100000000000").mul(D8);
  const INIT_SUPPLY = D18.mul(100000);
  const sell_price = ethers.BigNumber.from(65).mul(D6).div(10);
  const recycle_price = ethers.BigNumber.from(5).mul(D6);

  beforeEach(async function () {
    const [deployer, zeus, other1, other2, other3] = await ethers.getSigners();
    const DHM = await ethers.getContractFactory("DHM");
    const USDT = await ethers.getContractFactory("StakingToken");

    this.dhm = await DHM.deploy(
      zeus.address,
      "DHash Mining",
      "DHM",
      SUPPLY,
      INIT_SUPPLY
    );
    this.dhm = this.dhm.connect(zeus);
    this.usdt = await USDT.deploy("USDT", "USDT", 8, USDT_TOTAL, USDT_TOTAL);
    await this.dhm.update_usdt(this.usdt.address);
    await this.dhm.unpause();

    const balance = USDT_TOTAL.div(100);
    {
      await this.usdt.mint(balance);
      await this.usdt.transfer(other1.address, balance);
    }
    {
      await this.usdt.mint(balance);
      await this.usdt.transfer(other2.address, balance);
    }
    {
      await this.usdt.mint(balance);
      await this.usdt.transfer(other3.address, balance);
    }
  });

  it("initial supply", async function () {
    const [deployer, zeus, other1, other2, other3] = await ethers.getSigners();
    expect(await this.dhm.balanceOf(this.dhm.address)).to.equal(INIT_SUPPLY);
  });

  it("feed new sell price", async function () {
    const [deployer, zeus, other1, other2, other3] = await ethers.getSigners();

    await this.dhm.update_sell_price(sell_price);

    const balance = sell_price.mul(10).mul(100);
    await this.usdt.connect(other1).approve(this.dhm.address, balance);
    await this.dhm.connect(other1).buy(D18.mul(10));

    expect(await this.dhm.balanceOf(other1.address)).to.equal(D18.mul(10));
  });

  it("recycle works", async function () {
    const [deployer, zeus, other1, other2, other3] = await ethers.getSigners();

    await this.dhm.update_sell_price(sell_price);
    await this.dhm.update_recycle_price(recycle_price);

    const balance = sell_price.mul(10).mul(100);
    await this.usdt.connect(other1).approve(this.dhm.address, balance);
    await this.dhm.connect(other1).buy(D18.mul(10));

    expect(await this.dhm.balanceOf(other1.address)).to.equal(D18.mul(10));

    await this.dhm.connect(other1).recycle(D18, recycle_price);

    expect(await this.dhm.balanceOf(other1.address)).to.equal(D18.mul(9));
    expect(
      await this.dhm.balanceOf("0x0000000000000000000000000000000000000000")
    ).to.equal(D18.div(2));
    expect(await this.dhm.totalSupply()).to.equal(INIT_SUPPLY);
  });

  it("half of recycling is burnt", async function () {
    const [deployer, zeus, other1, other2, other3] = await ethers.getSigners();

    await this.dhm.update_sell_price(sell_price);
    await this.dhm.update_recycle_price(recycle_price);

    const balance = sell_price.mul(10).mul(100);
    await this.usdt.connect(other1).approve(this.dhm.address, balance);
    await this.dhm.connect(other1).buy(D18.mul(10));
    await this.dhm.connect(other1).recycle(D18.mul(10), recycle_price);

    expect(await this.dhm.totalSupply()).to.equal(INIT_SUPPLY);
  });

  it("over issuance", async function () {
    const [deployer, zeus, other1, other2, other3] = await ethers.getSigners();
    await this.dhm.mint(SUPPLY.add(1));
    expect(await this.dhm.totalSupply()).to.equal(SUPPLY);
  });

  // it("calculate recycling price", async function () {});
});
