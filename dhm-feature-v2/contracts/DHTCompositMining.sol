//SPDX-License-Identifier: MIT

pragma solidity >=0.4.22 <0.8.0;

pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/proxy/TransparentUpgradeableProxy.sol";

import "./OnlyOnce.sol";
import "./InitializeOwnable.sol";
import "./DHTCompositMiningPool.sol";

struct Schedule {
    uint256 duration;
    uint256 reward;
}

interface IDHTCompositMiningPool {
    function newPeriod(uint256, uint256) external;

    function stakeFor(address, uint256) external;
}

interface IWrappedHT {
    function deposit() external payable;
}

contract DHTCompositMining is Context, OnlyOnce, InitializeOwnable {
    using SafeMath for uint256;
    using Address for address;
    using SafeERC20 for IERC20;

    mapping(address => bool) public LPSwitch;

    mapping(address => address) public LP2Pool;

    // profit ratio can only be changed between periods
    mapping(address => uint256) public LPProfitRatio;

    address public rewardToken;
    address[] public LPs;
    address[] public pools;
    int256 public period;
    uint256 public periodStart;
    uint256 public periodFinish;

    uint256 public constant ProfitRatioScale = 10000;

    // Wrapped HT address
    address public WHTAddress;

    address public periodControl;

    Schedule[] schedule;

    modifier LPNotExists(address p) {
        require(LP2Pool[p] == address(0), "LP already existed");
        _;
    }

    modifier LPExists(address p) {
        require(LP2Pool[p] != address(0), "LP doesn't exist");
        _;
    }

    modifier LPOpened(address p) {
        require(LPSwitch[p], "LP is not opened");
        _;
    }

    modifier LPClosed(address p) {
        require(!LPSwitch[p], "LP is not closed");
        _;
    }

    modifier isBetweenPeriods() {
        require(betweenPeriods(), "current period is running");
        _;
    }

    modifier onlyPeriodControl() {
        require(msg.sender == periodControl, "only periodcontrol");
        _;
    }

    function initialize(
        address _owner,
        address _rewardToken,
        Schedule[] memory s,
        address _wht
    ) public onlyOnce {
        rewardToken = _rewardToken;
        period = -1;

        for (uint256 i = 0; i < s.length; i++) {
            schedule.push(
                Schedule({duration: s[i].duration, reward: s[i].reward})
            );
        }

        initializeOwner(_owner);
        periodControl = _owner;
        WHTAddress = _wht;
    }

    function updatePeriodControl(address _who) public onlyOwner {
        periodControl = _who;
    }

    function LPsLength() public view returns (uint256) {
        return LPs.length;
    }

    function poolsLength() public view returns (uint256) {
        return pools.length;
    }

    function betweenPeriods() public view returns (bool) {
        return block.timestamp >= periodFinish || block.timestamp < periodStart;
    }

    function newPool(address lp, uint256 _ratio)
        public
        onlyOwner
        LPNotExists(lp)
        isBetweenPeriods
    {
        DHTCompositMiningPool newpool = new DHTCompositMiningPool();
        newpool.initialize(msg.sender, rewardToken, lp, address(this));

        LPSwitch[lp] = true;
        LP2Pool[lp] = address(newpool);
        LPs.push(lp);
        pools.push(address(newpool));
        LPProfitRatio[lp] = _ratio;
    }

    // newSchedule will remove former schedule completely
    function newSchedule(Schedule[] memory s) public onlyOwner {
        delete (schedule);

        for (uint256 i = 0; i < s.length; i++) {
            schedule.push(
                Schedule({duration: s[i].duration, reward: s[i].reward})
            );
        }
    }

    function openPool(address lp)
        public
        onlyOwner
        LPExists(lp)
        isBetweenPeriods
    {
        LPSwitch[lp] = true;
    }

    function closePool(address lp)
        public
        onlyOwner
        LPExists(lp)
        isBetweenPeriods
    {
        LPSwitch[lp] = false;
    }

    function setPoolShare(address lp, uint256 _ratio)
        public
        onlyOwner
        LPExists(lp)
        isBetweenPeriods
    {
        LPProfitRatio[lp] = _ratio;
    }

    function nextPeriod() public onlyPeriodControl isBetweenPeriods {
        uint256 _next = uint256(period + 1);
        require(_next < schedule.length);
        address _lp;
        uint256 _poolRewards;
        bool _hasPoolsOpened;
        for (uint256 i = 0; i < LPs.length; i++) {
            _lp = LPs[i];
            if (!LPSwitch[_lp]) {
                continue;
            }
            _poolRewards = schedule[_next].reward.mul(LPProfitRatio[_lp]).div(
                ProfitRatioScale
            );
            IERC20(rewardToken).safeTransfer(LP2Pool[_lp], _poolRewards);
            IDHTCompositMiningPool(LP2Pool[_lp]).newPeriod(
                schedule[_next].duration,
                _poolRewards
            );
            _hasPoolsOpened = true;
        }
        require(_hasPoolsOpened, "no opened pools");

        periodStart = block.timestamp;
        periodFinish = block.timestamp.add(schedule[_next].duration);
        period = int256(_next);
    }

    function stake(address lp, uint256 amount) public payable {
        require(
            !(lp == address(0) && WHTAddress == address(0)),
            "lp & wht can't both be zero"
        );
        if (lp == address(0)) {
            IWrappedHT(WHTAddress).deposit{value: msg.value}();
            lp = WHTAddress;
            amount = msg.value;
        } else {
            IERC20(lp).safeTransferFrom(msg.sender, address(this), amount);
        }
        require(LPSwitch[lp], "LP is not opened");
        IERC20(lp).approve(LP2Pool[lp], amount);
        IDHTCompositMiningPool(LP2Pool[lp]).stakeFor(msg.sender, amount);
    }
}
