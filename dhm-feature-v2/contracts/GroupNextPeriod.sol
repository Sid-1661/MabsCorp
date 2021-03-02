//SPDX-License-Identifier: MIT

pragma solidity >=0.4.22 <0.8.0;

pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";

interface INextPeriod {
    function nextPeriod() external;
}

contract GroupNextPeriod is Ownable {
    address public periodControl;
    address[] public items;

    modifier onlyPeriodControl() {
        require(msg.sender == periodControl, "only period control");
        _;
    }

    function updatePeriodControl(address who) public onlyOwner {
        periodControl = who;
    }

    constructor() {
        periodControl = msg.sender;
    }

    function add(address p) public onlyOwner {
        items.push(p);
    }

    function nextPeriod() public onlyOwner {
        for (uint256 i = 0; i < items.length; i++) {
            INextPeriod(items[i]).nextPeriod();
        }
    }
}
