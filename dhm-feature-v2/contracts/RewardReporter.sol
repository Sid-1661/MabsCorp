//SPDX-License-Identifier: MIT

pragma solidity >=0.4.22 <0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

interface IRewardReportRecv {
    function report_timestamp_reward(
        uint256 timestamp,
        uint256 amt,
        bool override_
    ) external;
}

contract RewardReporter is Ownable {
    using SafeMath for uint256;

    uint256 public decimals = 4;
    address public reporter;

    mapping(address => uint256) public poolShare;
    address[] public pools;

    constructor(address _reporter) {
        reporter = _reporter;
        decimals = 4;
    }

    function deconstruct() public onlyOwner {
        selfdestruct(payable(msg.sender));
    }

    function addPool(address pool, uint256 share) public onlyOwner {
        pools.push(pool);
        poolShare[pool] = share;
    }

    function updatePool(address pool, uint256 share) public onlyOwner {
        bool existed = false;
        for (uint256 i = 0; i < pools.length; i++) {
            if (pool == pools[i]) {
                existed = true;
                break;
            }
        }
        require(existed, "can not update unknown pool");
        poolShare[pool] = share;
    }

    function poolsLength() public view returns (uint256) {
        return pools.length;
    }

    function report(uint256 amount) public {
        require(msg.sender == reporter, "only reporter");

        uint256 share = 0;
        uint256 amountForPool = 0;
        for (uint256 i = 0; i < pools.length; i++) {
            share = poolShare[pools[i]];
            amountForPool = amount.mul(share).div(10000);
            IRewardReportRecv(pools[i]).report_timestamp_reward(
                block.timestamp,
                amountForPool,
                false
            );
            share = 0;
            amountForPool = 0;
        }
    }
}
