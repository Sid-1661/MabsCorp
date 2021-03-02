//SPDX-License-Identifier: MIT

pragma solidity >=0.4.22 <0.8.0;

pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/proxy/TransparentUpgradeableProxy.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./ERC20NoConstructor.sol";
import "./InitializeOwnable.sol";

interface IDHM {
    function totalSupply() external view returns (uint256);

    function cap() external view returns (uint256);

    function mint(uint256 amount_) external;
}

interface IDecimals {
    function decimals() external view returns (uint8);
}

struct CachedEpoch {
    uint256 epoch;
    uint256 amount;
}

struct EpochReward {
    bool valid;
    uint256 reward;
}

struct StakesSnapshot {
    bool valid;
    uint256 amount;
}

// T+1: accounting
// T+2: revenue
contract StakeDHM is ERC20NoConstructor, Pausable, InitializeOwnable, OnlyOnce {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // stake token address
    address public stake_token;

    // reward token address
    address public reward_token;

    // account who is designated as the only one who can report an EPOCH wbtc reward
    address public reward_reporter;

    // default to 86400 on production
    uint256 public epoch_length;

    // the latest epoch that has a reward reported
    uint256 public latest_reported_epoch;

    // maybe a ongoing epoch that yet waiting for a reward report
    uint256 public latest_seen_epoch;

    // current_total_stakes has two roles:
    // - if there is no new stakes for current EPOCH, this means all effective total stakes
    // - otherwise this contains both effective and not effective stakes
    uint256 public current_total_stakes;

    // total amount of reported rewards
    uint256 public total_rewarded;

    // rewards amount checkpoints by EPOCH
    mapping(uint256 => EpochReward) public rewards_each_epoch;

    // user's last claimed epoch
    mapping(address => uint256) public last_claim_epochs;

    // when a user who has effective stakes makes a new stake,
    // we auto claim his former rewards for him.
    // but there is a gap EPOCH which is the current epoch and in such situation,
    // the gap will be cached here with adjustment set to the user's last claimed epoch.
    // then user's stakes amount will be counted as a whole from after the next EPOCH.
    mapping(address => CachedEpoch) public cached_epochs;

    // tracking the user stakes amount
    mapping(address => uint256) stakes;

    // keep a record of user's new stake within current epoch
    mapping(address => CachedEpoch) user_epoch_stakes;

    // when total stakes changing, we update the snapshot for that EPOCH
    // so it is only a cache,
    // but when the next EPOCH coming, the current EPOCH is finalized
    mapping(uint256 => StakesSnapshot) stakes_epoch_snapshots;

    // convinent 1000000000000000000
    uint256 stake_decimals;

    // convinent 100000000
    uint256 reward_decimals;

    // the epoch when the project is deployed
    uint256 public default_epoch;

    // the DHM minting strategy is tied with staking percentage.
    // so when the time comes, there will be no more to mint,
    // just stop.
    bool _stop_mint;

    modifier onlyReporter() {
        if (reward_reporter != address(0)) {
            require(msg.sender == reward_reporter, "StakeDHM: not allowed");
        }
        _;
    }

    event Stake(address who, uint256 amount);
    event Claim(address who, uint256 rewards);
    event Withdraw(address who, uint256 amount, uint256 rewards);

    // after construction, the contract will be paused
    function initialize(
        address zeus_,
        address stake_token_,
        address reward_token_,
        string memory name,
        string memory symbol
    ) public onlyOnce {
        initializeOwner(zeus_);
        initializeERC20(name, symbol, 18);

        stake_token = stake_token_;
        reward_token = reward_token_;

        stake_decimals = 10**IDecimals(stake_token_).decimals();
        reward_decimals = 10**IDecimals(reward_token_).decimals(); // wbtc decimals
        epoch_length = 86400;

        setOwner(zeus_);

        default_epoch = _to_epoch(block.timestamp);

        stakes_epoch_snapshots[default_epoch] = StakesSnapshot({
            valid: true,
            amount: 0
        });

        _stop_mint = false;

        reward_reporter = zeus_;

        _pause();
    }

    function mint_stopped() public view returns (bool) {
        return _stop_mint;
    }

    function get_stake(address user) public view returns (uint256) {
        return stakes[user];
    }

    function get_effective_stake(address user_) public view returns (uint256) {
        uint256 current_epoch = _to_epoch(block.timestamp);
        uint256 total = stakes[user_];
        CachedEpoch storage uneffectives = user_epoch_stakes[user_];
        if (current_epoch == uneffectives.epoch) {
            return total.sub(uneffectives.amount);
        }
        return total;
    }

    function evacuate_reward(address u, uint256 amount) public onlyOwner {
        IERC20(reward_token).safeTransfer(u, amount);
    }

    function evacuate_eth() public onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    // NOTE: this only serves as a last resort for rescuing user's stakes,
    // and only works when paused
    function evacuate_stake(address u) public onlyOwner whenPaused {
        uint256 amt = stakes[u];
        delete (stakes[u]);
        IERC20(stake_token).safeTransfer(u, amt);
    }

    function pause() public onlyOwner whenNotPaused {
        _pause();
    }

    function unpause() public onlyOwner whenPaused {
        _unpause();
    }

    function start_mint() public onlyOwner {
        _stop_mint = false;
    }

    function stop_mint() public onlyOwner {
        _stop_mint = true;
    }

    function set_reward_token(address token) public onlyOwner {
        reward_token = token;
    }

    function set_reward_reporter(address r) public onlyOwner {
        reward_reporter = r;
    }

    function set_epoch_length(uint256 l) public onlyOwner whenPaused {
        delete (stakes_epoch_snapshots[default_epoch]);

        epoch_length = l;
        // renew default epoch
        default_epoch = _to_epoch(block.timestamp);

        stakes_epoch_snapshots[default_epoch] = StakesSnapshot({
            valid: true,
            amount: 0
        });
    }

    function reset_epochs() public onlyOwner whenPaused {
        default_epoch = _to_epoch(block.timestamp);
        // safe zone
        delete (stakes_epoch_snapshots[default_epoch - 1]);
        delete (stakes_epoch_snapshots[default_epoch - 2]);
        delete (stakes_epoch_snapshots[default_epoch - 3]);
        // safe zone
        stakes_epoch_snapshots[default_epoch] = StakesSnapshot({
            valid: true,
            amount: 0
        });
    }

    // a fresh stake will make all former unclaimed reward claimed automatically
    function stake(uint256 amount_) public whenNotPaused {
        _stake_(msg.sender, msg.sender, amount_);
        _totalSupply = _totalSupply.add(amount_);
        _balances[msg.sender] = _balances[msg.sender].add(amount_);
        emit Stake(msg.sender, amount_);
    }

    // allow some delegates to *STAKE* for others
    // the tokens which will be staked will come from msg.sender's account
    function stake_for(address u_, uint256 amount_) public whenNotPaused {
        _stake_(msg.sender, u_, amount_);
        _totalSupply = _totalSupply.add(amount_);
        _balances[u_] = _balances[u_].add(amount_);
        emit Stake(u_, amount_);
    }

    // internal universal implementation for *STAKE*
    function _stake_(
        address staker_,
        address beneficial_,
        uint256 amt_
    ) internal {
        uint256 current_epoch = _to_epoch(block.timestamp);
        _snapshot(current_epoch);

        if (stakes[beneficial_] == 0) {
            // T+1
            last_claim_epochs[beneficial_] = current_epoch + 1;
        }

        // auto claim former rewards
        (uint256 cached_amount, uint256 collected_amount) =
            _claim(beneficial_, current_epoch);

        uint256 effectives = get_effective_stake(beneficial_);
        if (
            (cached_epochs[beneficial_].epoch == 0 &&
                cached_epochs[beneficial_].amount == 0) && effectives > 0
        ) {
            // user's current stake will be counted as a whole for next EPOCH
            // this has to be called before adding user stakes
            _cache_next_epoch(beneficial_, current_epoch, effectives);
        }

        // coming stake will be effective from the next EPOCH
        // this stake has no effects on current EPOCH
        // safely assume snapshot for next EPOCH has been set up by `_snapshot()`
        _add_stakes(beneficial_, current_epoch, amt_);

        IERC20(stake_token).safeTransferFrom(staker_, address(this), amt_);

        // some bookkeeper works
        _update_seen_epoch(current_epoch);

        if (!_stop_mint) {
            _mint_(current_total_stakes);
        }
    }

    // withdraw will remove the user's current stake from effective immediately
    function withdraw() public whenNotPaused {
        (uint256 amount, uint256 rewards) = _withdraw_(msg.sender);
        _totalSupply = _totalSupply.sub(amount);
        _balances[msg.sender] = _balances[msg.sender].sub(amount);
        emit Withdraw(msg.sender, amount, rewards);
    }

    // internal universal implementation for *WITHDRAW*
    function _withdraw_(address u_)
        internal
        returns (uint256 amount, uint256 rewards)
    {
        uint256 current_epoch = _to_epoch(block.timestamp);
        _snapshot(current_epoch);

        uint256 user_stakes = stakes[u_];
        require(user_stakes > 0, "StakeDHM: no stakes");

        // claim current rewards
        (uint256 cached, uint256 collected) = _claim(u_, current_epoch);

        // NOTE: ajust the current snapshot and the next snapshot
        _remove_stakes(u_, current_epoch, user_stakes);

        // give back user's stake tokens
        IERC20(stake_token).safeTransfer(u_, user_stakes);

        _update_seen_epoch(current_epoch);

        return (user_stakes, cached + collected);
    }

    function claim(uint256 epochs) public whenNotPaused {
        uint256 current_epoch = _to_epoch(block.timestamp);
        _snapshot(current_epoch);

        uint256 collected;
        uint256 cached;
        if (epochs == 0) {
            (cached, collected) = _claim(msg.sender, current_epoch);
        } else {
            uint256 last_claim_epoch =
                _user_last_claim_epoch(msg.sender, current_epoch);

            // claim from [last_claim_epoch +1, last_claim_epoch + epochs]
            (cached, collected) = _claim(msg.sender, last_claim_epoch + epochs);
        }

        _update_seen_epoch(current_epoch);

        if (cached + collected > 0) {
            emit Claim(msg.sender, cached + collected);
        }
    }

    function cached_epoch_reward(address user_) public view returns (uint256) {
        uint256 epoch = cached_epochs[user_].epoch;
        uint256 amount = cached_epochs[user_].amount;

        if (epoch <= default_epoch || amount == 0) {
            return 0;
        }
        return
            amount.mul(rewards_each_epoch[epoch].reward).div(
                stakes_epoch_snapshots[epoch - 1].amount
            );
    }

    // this can fix any missing snapshot checkpoint,
    // ${epoch_} = 0 means current epoch
    function snapshot(uint256 epoch_) public onlyOwner {
        uint256 epoch_to_snapshot = epoch_;
        if (epoch_ == 0) {
            epoch_to_snapshot = _to_epoch(block.timestamp);
        }
        _snapshot(epoch_to_snapshot);
    }

    function rewards_to_claim(address u)
        public
        view
        whenNotPaused
        returns (uint256)
    {
        uint256 total_;
        uint256 current_epoch = _to_epoch(block.timestamp);

        if (cached_epochs[u].amount > 0) {
            if (current_epoch >= cached_epochs[u].epoch) {
                total_ = total_.add(cached_epoch_reward(u));
            }
        }

        (uint256 c, ) = _collect_profits(u, current_epoch);
        total_ = total_.add(c);

        return total_;
    }

    // for the sake of ease, just provide timestamp
    function report_timestamp_reward(
        uint256 timestamp_,
        uint256 data,
        bool override_
    ) public onlyReporter {
        uint256 epc = _to_epoch(timestamp_);
        require(
            epc >= default_epoch,
            "StakeDHM: epoch should be greater than default"
        );

        // TODO: we might want to disable the future telling

        if (!rewards_each_epoch[epc].valid) {
            rewards_each_epoch[epc] = EpochReward({valid: true, reward: data});
            total_rewarded = total_rewarded.add(data);
        } else {
            require(override_, "StakeDHM: report existed");
            total_rewarded = total_rewarded.sub(rewards_each_epoch[epc].reward);
            rewards_each_epoch[epc] = EpochReward({valid: true, reward: data});
            total_rewarded = total_rewarded.add(data);
        }

        if (epc > latest_reported_epoch) {
            latest_reported_epoch = epc;
        }

        _update_seen_epoch(epc);
    }

    function is_epoch_reported(uint256 epoch_) public view returns (bool) {
        return rewards_each_epoch[epoch_].valid;
    }

    // * requires only one cache for one user
    //
    // cache the next epoch because of T+1
    // move last claimed one epoch further when cache happens
    function _cache_next_epoch(
        address user_,
        uint256 epoch_,
        uint256 stake_amount_
    ) internal {
        cached_epochs[user_] = CachedEpoch({
            epoch: epoch_ + 1,
            amount: stake_amount_
        });
        last_claim_epochs[user_] = epoch_ + 1;
    }

    function _get_epoch_reward(
        uint256 amount_,
        uint256 epoch_,
        uint256 last_claimed_
    ) internal view returns (uint256) {
        uint256 total_stakes_at_epoch;

        // days before our lives
        if (epoch_ - 2 < default_epoch) {
            return 0;
        }

        // total stakes effective for reward in the this epoch is recorded in the previous epoch
        //
        // for example:
        //   - last_claimed: 1611198
        //   - epoch: 1611199
        //   then we should get total stakes from epoch 1611198, for calculating rewards,
        //   because the snapshot is definitely made on {last_claimed_} epoch
        //
        for (uint256 i = epoch_ - 1; i >= last_claimed_; i--) {
            if (stakes_epoch_snapshots[i].valid) {
                total_stakes_at_epoch = stakes_epoch_snapshots[i].amount;
                break;
            }
        }

        if (total_stakes_at_epoch == 0) {
            return 0;
        }

        return
            amount_.mul(rewards_each_epoch[epoch_].reward).div(
                total_stakes_at_epoch
            );
    }

    // _collect_profits must collect every single epoch before ${epoch},
    // within the range, any unreported epoch will fail the collection.
    //
    // collect profits accounting by stakes[user], ignoring cached
    // collect all profits before param epoch, including
    function _collect_profits(address user_, uint256 epoch)
        internal
        view
        returns (uint256 total_reward, uint256 last_epoch_claimed)
    {
        uint256 last_epoch = _user_last_claim_epoch(user_, epoch);
        if (epoch <= last_epoch) {
            return (0, last_epoch);
        }

        uint256 stake_amount = stakes[user_];
        // collect all the rewards within range (last_epoch, epoch]
        for (uint256 i = last_epoch + 1; i <= epoch; i++) {
            if (!is_epoch_reported(i)) {
                break;
            }
            total_reward = total_reward.add(
                _get_epoch_reward(stake_amount, i, last_epoch)
            );
            last_epoch_claimed = i;
        }

        // make sure we don't close staker's window without collecting the reward fully
        // or grant unintended collection
        // require(
        //     epoch == last_epoch_claimed,
        //     "StakeDHM: fail to collect all available epochs"
        // );

        return (total_reward, last_epoch_claimed);
    }

    function _transfer_reward(address user_, uint256 amount_) internal {
        IERC20(reward_token).safeTransfer(user_, amount_);
    }

    // this will transfer the collected rewards to the stake holder,
    // remove cached ${epoch_} reward
    // and update his last_claim_epochs
    function _claim(address user_, uint256 epoch_)
        internal
        returns (uint256 _cached, uint256 _collected)
    {
        uint256 last_epoch_claimed = _user_last_claim_epoch(user_, epoch_);
        // check if formerly cached epoch has been unlocked
        if (
            cached_epochs[user_].amount > 0 &&
            epoch_ >= cached_epochs[user_].epoch
        ) {
            _cached = cached_epoch_reward(user_);
            delete (cached_epochs[user_]);
        }

        (_collected, last_epoch_claimed) = _collect_profits(user_, epoch_);

        require(
            last_epoch_claimed >= epoch_,
            "StakeDHM: missing epoch reports"
        );

        // align last claim epoch right after cached epoch
        last_claim_epochs[user_] = last_epoch_claimed;

        if (_cached.add(_collected) > 0) {
            _transfer_reward(user_, _cached.add(_collected));
        }

        return (_cached, _collected);
    }

    // floor the timestmap by day
    function _to_epoch(uint256 timestamp_) internal view returns (uint256) {
        uint256 epoch = timestamp_.div(epoch_length);
        return epoch;
    }

    function _user_last_claim_epoch(address user_, uint256 epoch_)
        internal
        view
        returns (uint256)
    {
        if (last_claim_epochs[user_] < default_epoch) {
            // T+1
            return epoch_ + 1;
        }
        return last_claim_epochs[user_];
    }

    // this will try to make a snapshot for ${epoch_},
    // this happens before the new stakes happens,
    // so just copy a former snapshot will be enough,
    // always contains effective stake amount for an EPOCH
    function _snapshot(uint256 epoch_) internal {
        // we don't have to go back all the way to find the last valid snapshot
        if (!stakes_epoch_snapshots[epoch_].valid) {
            stakes_epoch_snapshots[epoch_] = StakesSnapshot({
                valid: true,
                amount: current_total_stakes
            });
        }

        // set up next snapshot cache for T+1
        if (
            stakes_epoch_snapshots[epoch_].valid &&
            !stakes_epoch_snapshots[epoch_ + 1].valid
        ) {
            stakes_epoch_snapshots[epoch_ + 1] = StakesSnapshot({
                valid: true,
                amount: stakes_epoch_snapshots[epoch_].amount
            });
        }
    }

    // NOTE: ${epoch_ + 1} should have been set up by `_snapshot()`
    // add ${amt_} to ${epoch_ + 1}
    function _add_stakes(
        address user_,
        uint256 epoch_,
        uint256 amt_
    ) internal {
        uint256 next_ = epoch_ + 1;

        require(stakes_epoch_snapshots[next_].valid);

        if (user_epoch_stakes[user_].epoch < epoch_) {
            // update uneffective stakes
            user_epoch_stakes[user_] = CachedEpoch({
                epoch: epoch_,
                amount: amt_
            });
        } else {
            // accumulate user's current epoch uneffective stakes
            user_epoch_stakes[user_].amount = user_epoch_stakes[user_]
                .amount
                .add(amt_);
        }

        // update user's stake balance
        stakes[user_] = amt_.add(stakes[user_]);

        stakes_epoch_snapshots[next_].amount = stakes_epoch_snapshots[next_]
            .amount
            .add(amt_);
        current_total_stakes = current_total_stakes.add(amt_);
    }

    // remove ${amt_} from ${epoch_} and ${epoch_ + 1}
    function _remove_stakes(
        address user_,
        uint256 epoch_,
        uint256 amt_
    ) internal {
        uint256 next_ = epoch_ + 1;

        require(stakes_epoch_snapshots[epoch_].valid);
        require(stakes_epoch_snapshots[next_].valid);

        uint256 uneffective_stakes;
        if (user_epoch_stakes[user_].epoch == epoch_) {
            uneffective_stakes = user_epoch_stakes[user_].amount;
        }

        stakes_epoch_snapshots[epoch_].amount = stakes_epoch_snapshots[epoch_]
            .amount
            .sub(
            amt_.sub(
                uneffective_stakes,
                "StakeDHM: too much uneffective_stakes"
            ),
            "StakeDHM: removing effective stakes"
        );
        stakes_epoch_snapshots[next_].amount = stakes_epoch_snapshots[next_]
            .amount
            .sub(amt_, "StakeDHM: removing next epoch stakes");

        // remove user stakes
        current_total_stakes = current_total_stakes.sub(
            amt_,
            "StakeDHM: removing current total"
        );

        delete (user_epoch_stakes[user_]);
        stakes[user_] = 0;
        delete (stakes[user_]);
        // remove cached stakes before the cached epoch becomes effective
        delete (cached_epochs[user_]);
    }

    function _update_seen_epoch(uint256 e) internal {
        if (latest_seen_epoch < e) {
            latest_seen_epoch = e;
        }
    }

    function _mint_(uint256 staked_) internal {
        address null_ = address(0);
        uint256 supply = IDHM(stake_token).totalSupply();
        uint256 burnt = IERC20(stake_token).balanceOf(null_);
        uint256 available_supply = supply.sub(burnt);
        if (available_supply.sub(staked_) <= staked_) {
            IDHM(stake_token).mint(IDHM(stake_token).cap().div(10));
        }
    }
}
