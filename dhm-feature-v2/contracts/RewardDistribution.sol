//SPDX-License-Identifier: MIT

pragma solidity >=0.4.22 <0.8.0;

pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";

struct Schedule {
    uint256 duration;
    uint256 reward;
}

interface INewPeriod {
    function newPeriod(uint256 duration, uint256 reward) external;
}

contract RewardDistribution is Ownable {
    address[] public pools;
    int256 public period = -1;
    uint256 public periodLimit;
    mapping(address => Schedule[]) public schedules;

    mapping(address => uint256) _durations;
    mapping(address => uint256) _rewards;

    constructor(uint256 _periodLimit) {
        periodLimit = _periodLimit;
    }

    function addPool(address pool, Schedule[] memory schedule)
        public
        onlyOwner
    {
        require(schedules[pool].length == 0);

        pools.push(pool);

        for (uint256 i = 0; i < schedule.length; i++) {
            schedules[pool].push(
                Schedule({
                    duration: schedule[i].duration,
                    reward: schedule[i].reward
                })
            );
        }
    }

    function nextPeriod() public onlyOwner {
        uint256 _next = uint256(period + 1);
        require(_next <= periodLimit);

        uint256 thisDuration;
        uint256 thisReward;

        for (uint256 i = 0; i < pools.length; i++) {
            if (_next >= schedules[pools[i]].length) {
                thisDuration = _durations[pools[i]];
                thisReward = _rewards[pools[i]];
            } else {
                thisDuration = schedules[pools[i]][_next].duration;
                thisReward = schedules[pools[i]][_next].reward;
                _durations[pools[i]] = thisDuration;
                _rewards[pools[i]] = thisReward;
            }
            INewPeriod(pools[i]).newPeriod(thisDuration, thisReward);
        }

        period = int256(_next);
    }
}
