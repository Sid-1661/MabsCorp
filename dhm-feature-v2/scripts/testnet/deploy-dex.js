// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");
const { ethers } = hre;

const overrides = {
  gasPrice: ethers.utils.parseUnits("1", "gwei"),
  gasLimit: 8000000,
};

const D18 = ethers.BigNumber.from("1000000000000000000");
const USDT_TOTAL = D18.mul(ethers.BigNumber.from("10000000000000000000"));
const HBTC_TOTAL = D18.mul(100000000);
const WHT_TOTAL = D18.mul(100000000000);
const HETH_TOTAL = D18.mul(100000000);
const DHT_TOTAL = D18.mul(ethers.BigNumber.from("10000000"));
const DHM_SUPPLY = D18.mul(ethers.BigNumber.from(1000000));

async function main() {
  const [deployer, manager] = await ethers.getSigners();

  const StakingToken = await ethers.getContractFactory("StakingToken");
  const DHM = await ethers.getContractFactory("DHM");
  const UniswapFactory = await ethers.getContractFactory("UniswapV2Factory");
  const UniswapPair = await ethers.getContractFactory(
    "contracts/UniswapFactoryV2.sol:UniswapV2Pair"
  );

  let tx;

  const dhm = await StakingToken.attach(
    "0x847B29E404D0adb1634165DAAD4EBc4FC2365c37"
  );
  const dht = await StakingToken.attach(
    "0x8c69e0D3a7Adeaa06A31D0C38d3B7b9bF2E2804B"
  );
  const usdt = await StakingToken.attach(
    "0xBb26d8d7F0f2Fd3Dc1Cf106403aE9303d0553725"
  );

  const factory = await UniswapFactory.deploy(deployer.address);
  console.log("factory address:", factory.address);
  tx = await factory.createPair(dhm.address, usdt.address, overrides);
  await tx.wait(1);
  const dhmPairAddress = await factory.getPair(dhm.address, usdt.address);
  console.log("dhm pair:", dhmPairAddress);
  tx = await factory.createPair(dht.address, usdt.address, overrides);
  await tx.wait(1);
  const dhtPairAddress = await factory.getPair(dht.address, usdt.address);
  console.log("dht pair:", dhtPairAddress);

  const dhtAmount = D18.mul(100000);
  console.log("minting dht");
  tx = await dht.mint(dhtAmount, overrides);
  await tx.wait(1);
  const usdtAmount = D18.mul(300000);
  console.log("minting usdt");
  tx = await usdt.mint(usdtAmount, overrides);
  await tx.wait(1);

  console.log("transfer dht to pair");
  tx = await dht.transfer(dhtPairAddress, dhtAmount, overrides);
  await tx.wait(1);
  console.log("transfer usdt to pair");
  tx = await usdt.transfer(dhtPairAddress, usdtAmount, overrides);
  await tx.wait(1);
  const dhtpair = UniswapPair.attach(dhtPairAddress);

  tx = await dhtpair.mint(manager.address, overrides);
  await tx.wait(1);

  console.log(
    "dhtusdt lp:",
    (await dhtpair.balanceOf(manager.address)).toString()
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
