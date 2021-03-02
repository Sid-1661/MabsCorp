//SPDX-License-Identifier: MIT

pragma solidity >=0.4.22 <0.8.0;

pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./StakeDHM.sol";

contract StakeGuard is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    mapping(address => uint256) public stake_epochs;
    address public stake_contract;

    constructor(address stake_contract_) {
        stake_contract = stake_contract_;
    }

    function stake(uint256 amount_) public {
        uint256 epoch_length = StakeDHM(stake_contract).epoch_length();
        uint256 current_epoch = block.timestamp.div(epoch_length);
        require(
            stake_epochs[msg.sender] < current_epoch,
            "StakeDHM: please stake tomorrow"
        );
        stake_epochs[msg.sender] = current_epoch;
        IERC20(StakeDHM(stake_contract).stake_token()).safeTransferFrom(
            msg.sender,
            address(this),
            amount_
        );
        IERC20(StakeDHM(stake_contract).stake_token()).approve(
            stake_contract,
            amount_
        );
        StakeDHM(stake_contract).stake_for(msg.sender, amount_);
    }
}
