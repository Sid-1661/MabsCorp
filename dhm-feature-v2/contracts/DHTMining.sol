//SPDX-License-Identifier: MIT

pragma solidity >=0.4.22 <0.8.0;

import "@openzeppelin/contracts/GSN/Context.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/proxy/TransparentUpgradeableProxy.sol";

import "./OnlyOnce.sol";
import "./LPTokenWrapper.sol";
import "./InitializeOwnable.sol";

contract DHTMining is LPTokenWrapper, Context, OnlyOnce, InitializeOwnable {
    using Address for address;
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IERC20 public rewardToken;
    uint256 public duration; // making it not a constant is less gas efficient, but portable

    address[] public stakers;
    mapping(address => bool) public stakerExists;
    uint256 public stakers_length;

    uint256 public periodFinish = 0;
    uint256 public rewardRate = 0;
    uint256 public periodStart;
    uint256 public rewardPerTokenStored;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    bool public stopped = false;

    address rewardDistributor;

    event NewPeriod(uint256 duration, uint256 reward);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event RewardDenied(address indexed user, uint256 reward);

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        periodStart = lastTimeRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    modifier notStopped() {
        require(!stopped, "the pool has been stopped");
        _;
    }

    modifier onlyStopped() {
        require(stopped, "the pool is not stopped yet");
        _;
    }

    modifier onlyRewardDistribution() {
        require(
            _msgSender() == rewardDistributor,
            "caller is not reward distributor"
        );
        _;
    }

    function setRewardDistribution(address _who) public onlyOwner {
        rewardDistributor = _who;
    }

    function initialize(
        address _owner,
        address _rewardToken,
        address _lpToken,
        address _rewardDistributor
    ) public onlyOnce {
        rewardToken = IERC20(_rewardToken);
        lpToken = IERC20(_lpToken);
        rewardDistributor = _rewardDistributor;
        super.initializeOwner(_owner);
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return Math.min(block.timestamp, periodFinish);
    }

    function rewardPerToken() public view returns (uint256) {
        if (totalSupply() == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored.add(
                lastTimeRewardApplicable()
                    .sub(periodStart)
                    .mul(rewardRate)
                    .mul(1e18)
                    .div(totalSupply())
            );
    }

    function earned(address account) public view returns (uint256) {
        return
            balanceOf(account)
                .mul(rewardPerToken().sub(userRewardPerTokenPaid[account]))
                .div(1e18)
                .add(rewards[account]);
    }

    // stake visibility is public as overriding LPTokenWrapper's stake() function
    function stake(uint256 amount)
        public
        override
        notStopped
        updateReward(msg.sender)
    {
        require(amount > 0, "Cannot stake 0");
        if (!stakerExists[msg.sender]) {
            stakers.push(msg.sender);
            stakers_length = stakers_length.add(1);
            stakerExists[msg.sender] = true;
        }
        super.stake(amount);
        emit Staked(msg.sender, amount);
    }

    function withdraw(uint256 amount)
        public
        override
        notStopped
        updateReward(msg.sender)
    {
        require(amount > 0, "Cannot withdraw 0");
        super.withdraw(amount);
        emit Withdrawn(msg.sender, amount);
    }

    function exit() external notStopped {
        withdraw(balanceOf(msg.sender));
        getReward();
        stakerExists[msg.sender] = false;
    }

    /// A push mechanism for accounts that have not claimed their rewards for a long time.
    /// The implementation is semantically analogous to getReward(), but uses a push pattern
    /// instead of pull pattern.
    function pushReward(address recipient)
        public
        updateReward(recipient)
        onlyRewardDistribution
    {
        uint256 reward = earned(recipient);
        if (reward > 0) {
            rewards[recipient] = 0;
            // If it is a normal user and not smart contract,
            // then the requirement will pass
            // If it is a smart contract, then
            // make sure that it is not on our greyList.
            if (!recipient.isContract()) {
                rewardToken.safeTransfer(recipient, reward);
                emit RewardPaid(recipient, reward);
            } else {
                emit RewardDenied(recipient, reward);
            }
        }
    }

    function getReward() public notStopped updateReward(msg.sender) {
        uint256 reward = earned(msg.sender);
        if (reward > 0) {
            rewards[msg.sender] = 0;
            // If it is a normal user and not smart contract,
            // then the requirement will pass
            // If it is a smart contract, then
            // make sure that it is not on our greyList.
            if (tx.origin == msg.sender) {
                rewardToken.safeTransfer(msg.sender, reward);
                emit RewardPaid(msg.sender, reward);
            } else {
                emit RewardDenied(msg.sender, reward);
            }
        }
    }

    function newPeriod(uint256 _duration, uint256 _reward)
        public
        onlyRewardDistribution
        notStopped
        updateReward(address(0))
    {
        if (block.timestamp >= periodFinish) {
            rewardRate = _reward.div(_duration);
        } else {
            uint256 remaining = periodFinish.sub(block.timestamp);
            uint256 leftover = remaining.mul(rewardRate);
            rewardRate = _reward.add(leftover).div(_duration);
        }
        periodStart = block.timestamp;
        periodFinish = block.timestamp.add(_duration);
        duration = _duration;

        emit NewPeriod(_duration, _reward);
    }

    function stop() public onlyOwner {
        stopped = true;
        if (periodFinish > block.timestamp) {
            periodFinish = block.timestamp;
        }
    }

    function evacuate(
        address token,
        uint256 amount,
        address recv
    ) public onlyOwner onlyStopped {
        IERC20(token).safeTransfer(recv, amount);
    }
}
