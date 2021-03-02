//SPDX-License-Identifier: MIT

pragma solidity >=0.4.22 <0.8.0;

contract OnlyOnce {
    bool internal _fired;

    modifier onlyOnce() {
        require(!_fired, "only once");
        _fired = true;
        _;
    }
}
