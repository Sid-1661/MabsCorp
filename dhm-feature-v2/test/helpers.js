const { ethers } = require("hardhat");

const provider = new ethers.providers.JsonRpcProvider();

async function getBlockNumber() {
  return await provider.getBlockNumber();
}

async function mineBlocks(number) {
  for (let i = 0; i < number; i++) {
    await provider.send("evm_mine");
  }
}

function getCurrentTimestamp() {
  return Math.floor(new Date().getTime() / 1000);
}

async function getBlockTimestamp() {
  let block = await provider.getBlock(await getBlockNumber());
  return block.timestamp;
}

async function increaseTime(ts) {
  await provider.send("evm_increaseTime", [ts]);
}

async function setBlockTime(ts) {
  await provider.send("evm_setNextBlockTimestamp", [ts]);
}

module.exports = {
  getBlockNumber,
  mineBlocks,
  setBlockTime,
  increaseTime,
  getBlockTimestamp,
  sync: {
    getCurrentTimestamp,
  },
};
