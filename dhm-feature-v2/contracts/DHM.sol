//SPDX-License-Identifier: MIT

pragma solidity >=0.4.22 <0.8.0;

pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./ERC20.sol";

interface IPriceFeed {
    function get_sell_price() external returns (uint256);

    function get_recycle_price() external returns (uint256);
}

interface IDecimals {
    function decimals() external view returns (uint8);
}

contract DHM is ERC20Capped, Pausable, Ownable {
    using SafeMath for uint256;
    using Address for address;
    using SafeERC20 for IERC20;

    IERC20 public USDT;

    uint256 public sell_price;
    uint256 public recycle_price;
    address public price_feed;

    uint256 constant D18 = 10**18;
    uint256 constant D8 = 10**8;
    uint256 constant price_decimals = 10**6;

    address public minter;

    modifier onlyMinter() {
        require(msg.sender == minter, "DHM: only minter");
        _;
    }

    modifier saleOpened() {
        require(sell_price > 0, "DHM: sale closed");
        _;
    }

    modifier recycleOpened() {
        require(recycle_price > 0, "DHM: recycle closed");
        _;
    }

    modifier minBought(uint256 amt) {
        require(amt.mul(10**10) >= D18, "DHM: require min amount");
        _;
    }

    event RecyclePriceChanged(uint256);
    event SellPriceChanged(uint256);
    event MinterChanged(address);

    constructor(
        address zeus_,
        string memory name_,
        string memory symbol_,
        uint256 cap_,
        uint256 init_supply_
    ) ERC20Capped(cap_) ERC20(name_, symbol_) {
        _mint(address(this), init_supply_);
        minter = zeus_;
        transferOwnership(zeus_);
        _pause();
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function update_usdt(address usdt_) public onlyOwner {
        USDT = IERC20(usdt_);
    }

    function update_sell_price(uint256 price_) public onlyOwner {
        if (price_feed != address(0)) {
            sell_price = IPriceFeed(price_feed).get_sell_price();
        } else {
            sell_price = price_;
        }
        emit SellPriceChanged(sell_price);
    }

    function update_recycle_price(uint256 price_) public onlyOwner {
        if (price_feed != address(0)) {
            recycle_price = IPriceFeed(price_feed).get_recycle_price();
        } else {
            recycle_price = price_;
        }
        emit RecyclePriceChanged(recycle_price);
    }

    function update_minter(address u) public onlyOwner {
        minter = u;
        emit MinterChanged(u);
    }

    function mint(uint256 amount_) public onlyMinter {
        uint256 _cap = cap();
        uint256 _supply = totalSupply();
        if (paused() || _cap == _supply) {
            return;
        }
        if (_cap.sub(_supply) < amount_) {
            amount_ = _cap.sub(_supply);
        }
        _mint(address(this), amount_);
        return;
    }

    // buy DHM
    function buy(uint256 amount_)
        public
        whenNotPaused
        saleOpened
        minBought(amount_)
    {
        // (usdt_amount / D8) / (amount_ / D18) == sell_price / price_decimals;
        uint8 usdt_decimals = IDecimals(address(USDT)).decimals();
        uint256 decimals_scale = 10**usdt_decimals;
        uint256 usdt_amount =
            sell_price.mul(amount_).mul(decimals_scale).div(price_decimals).div(
                D18
            );
        USDT.safeTransferFrom(msg.sender, address(this), usdt_amount);
        IERC20(address(this)).safeTransfer(msg.sender, amount_);
    }

    // return DHM back
    function recycle(uint256 amount_, uint256 at_price)
        public
        whenNotPaused
        recycleOpened
        minBought(amount_)
    {
        uint256 r_price = calculate_recycle_price();
        require(r_price == at_price, "DHM: recycling price has changed");

        uint8 usdt_decimals = IDecimals(address(USDT)).decimals();
        uint256 decimals_scale = 10**usdt_decimals;

        uint256 usdt_amount =
            r_price.mul(amount_).mul(decimals_scale).div(price_decimals).div(
                D18
            );
        USDT.safeTransfer(msg.sender, usdt_amount);

        uint256 to_burn = amount_.div(2);
        // uint256 to_recycle = amount_.sub(to_burn);
        _transfer(msg.sender, address(this), amount_);
        _burn(address(this), to_burn);
    }

    function evacuate_usdt(address recv, uint256 amount_) public onlyOwner {
        USDT.safeTransfer(recv, amount_);
    }

    function evacuate_eth() public onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    function calculate_recycle_price() public view returns (uint256 r_price_) {
        return recycle_price;
    }

    function burn(uint256 amount) public {
        _burn(_msgSender(), amount);
    }

    function burnFrom(address account, uint256 amount) public {
        uint256 decreasedAllowance =
            allowance(account, _msgSender()).sub(
                amount,
                "ERC20: burn amount exceeds allowance"
            );

        _approve(account, _msgSender(), decreasedAllowance);
        _burn(account, amount);
    }

    function _burn(address account, uint256 amount) internal override {
        require(account != address(0), "ERC20: burn from the zero address");

        _beforeTokenTransfer(account, address(0), amount);

        _balances[account] = _balances[account].sub(
            amount,
            "ERC20: burn amount exceeds balance"
        );

        _balances[address(0)] = _balances[address(0)].add(amount);

        emit Transfer(account, address(0), amount);
    }
}
