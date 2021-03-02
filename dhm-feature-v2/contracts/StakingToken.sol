// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.7.0;

// import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
// import "@openzeppelin/contracts/token/ERC20/ERC20Capped.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/GSN/Context.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract StakingToken is Context, IERC20, ReentrancyGuard {
    using Address for address;
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    uint256 private _totalSupply;
    string private _name;
    string private _symbol;
    uint8 private _decimals;
    uint256 private _cap;
    uint256 private _softcap;
    address private _owner; // the supervisor with total authority
    address private _mint_account; // account which is allowed to mint new tokens

    uint256 public epoch; // the timestamp this token becomes alive

    mapping(address => uint256) internal _balances;
    mapping(address => uint256) internal _reserved_balances;
    mapping(address => mapping(address => uint256)) internal _allowances;

    /// @notice A record of each accounts delegate
    mapping(address => address) public delegates;

    /// @notice A checkpoint for marking number of votes from a given block
    struct Checkpoint {
        uint256 fromBlock;
        uint256 votes;
    }

    /// @notice A record of votes checkpoints for each account, by index
    mapping(address => mapping(uint256 => Checkpoint)) public checkpoints;

    /// @notice The number of checkpoints for each account
    mapping(address => uint256) public numCheckpoints;

    event BalanceReserved(address who, uint256 amount);
    event BalanceUnreserved(address who, uint256 amount);

    /// @notice An event thats emitted when an account changes its delegate
    event DelegateChanged(
        address indexed delegator,
        address indexed fromDelegate,
        address indexed toDelegate
    );

    /// @notice An event thats emitted when a delegate account's vote balance changes
    event DelegateVotesChanged(
        address indexed delegate,
        uint256 previousBalance,
        uint256 newBalance
    );

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals,
        uint256 softcap,
        uint256 cap
    ) public {
        _mint_account = _msgSender();
        _owner = _msgSender();
        _name = name;
        _symbol = symbol;
        _decimals = decimals;
        _softcap = softcap;
        _cap = cap;
    }

    modifier isAlive {
        require(epoch > 0 && block.timestamp > epoch);
        _;
    }

    modifier owner_only {
        require(_msgSender() == _owner, "StakingToken: Owner only");
        _;
    }

    modifier mint_auth_required {
        require(
            _msgSender() == _mint_account || _msgSender() == _owner,
            "StakingToken: Invalid mint request"
        );
        _;
    }

    function transfer_ownership(address new_owner)
        public
        owner_only
        nonReentrant
    {
        _owner = new_owner;
    }

    function owner() public view returns (address) {
        return _owner;
    }

    function set_epoch(uint256 ts) public owner_only nonReentrant {
        epoch = ts;
    }

    function mint_account() public view returns (address) {
        return _mint_account;
    }

    function name() public view returns (string memory) {
        return _name;
    }

    function symbol() public view returns (string memory) {
        return _symbol;
    }

    function decimals() public view returns (uint8) {
        return _decimals;
    }

    function totalSupply() public view override returns (uint256) {
        return _totalSupply;
    }

    function cap() public view returns (uint256) {
        return _cap;
    }

    function softCap() public view returns (uint256) {
        return _softcap;
    }

    function setSoftCap(uint256 n) public owner_only nonReentrant {
        require(n <= _cap, "StakingToken: softcap overflows cap");
        require(
            n >= _totalSupply,
            "StakingToken: softcap must be higher than total supply"
        );
        _softcap = n;
    }

    function balanceOf(address account)
        public
        view
        override
        returns (uint256 free)
    {
        return _balances[account];
    }

    function transfer(address recipient, uint256 amount)
        public
        virtual
        override
        nonReentrant
        returns (bool)
    {
        _transfer(_msgSender(), recipient, amount);
        return true;
    }

    function allowance(address account_owner, address spender)
        public
        view
        virtual
        override
        returns (uint256)
    {
        return _allowances[account_owner][spender];
    }

    function approve(address spender, uint256 amount)
        public
        virtual
        override
        nonReentrant
        returns (bool)
    {
        _approve(_msgSender(), spender, amount);
        return true;
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public virtual override nonReentrant returns (bool) {
        _transfer(sender, recipient, amount);
        _approve(
            sender,
            _msgSender(),
            _allowances[sender][_msgSender()].sub(
                amount,
                "ERC20: transfer amount exceeds allowance"
            )
        );
        return true;
    }

    function increaseAllowance(address spender, uint256 addedValue)
        public
        virtual
        nonReentrant
        returns (bool)
    {
        _approve(
            _msgSender(),
            spender,
            _allowances[_msgSender()][spender].add(addedValue)
        );
        return true;
    }

    function decreaseAllowance(address spender, uint256 subtractedValue)
        public
        virtual
        nonReentrant
        returns (bool)
    {
        _approve(
            _msgSender(),
            spender,
            _allowances[_msgSender()][spender].sub(
                subtractedValue,
                "ERC20: decreased allowance below zero"
            )
        );
        return true;
    }

    function mint(uint256 amount)
        public
        virtual
        nonReentrant
        mint_auth_required
        returns (bool)
    {
        _mint(_msgSender(), amount);
        return true;
    }

    function burn(uint256 amount) public virtual nonReentrant returns (bool) {
        _burn(_msgSender(), amount);
        return true;
    }

    function burnFrom(address account, uint256 amount)
        public
        virtual
        nonReentrant
    {
        uint256 decreasedAllowance =
            allowance(account, _msgSender()).sub(
                amount,
                "ERC20: burn amount exceeds allowance"
            );

        _approve(account, _msgSender(), decreasedAllowance);
        _burn(account, amount);
    }

    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal virtual {
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != address(0), "ERC20: transfer to the zero address");

        _beforeTokenTransfer(sender, recipient, amount);

        _balances[sender] = _balances[sender].sub(
            amount,
            "ERC20: transfer amount exceeds balance"
        );
        _balances[recipient] = _balances[recipient].add(amount);
        emit Transfer(sender, recipient, amount);

        _afterTokenTransfer(sender, recipient, amount);
    }

    function _mint(address account, uint256 amount) internal virtual {
        require(account != address(0), "ERC20: mint to the zero address");

        _beforeTokenTransfer(address(0), account, amount);

        _totalSupply = _totalSupply.add(amount);
        _balances[account] = _balances[account].add(amount);
        emit Transfer(address(0), account, amount);

        _afterTokenTransfer(address(0), account, amount);
    }

    function _burn(address account, uint256 amount) internal virtual {
        require(account != address(0), "ERC20: burn from the zero address");

        _beforeTokenTransfer(account, address(0), amount);

        _balances[account] = _balances[account].sub(
            amount,
            "ERC20: burn amount exceeds balance"
        );
        _totalSupply = _totalSupply.sub(amount);
        emit Transfer(account, address(0), amount);

        _afterTokenTransfer(account, address(0), amount);
    }

    function _approve(
        address account_owner,
        address spender,
        uint256 amount
    ) internal virtual {
        require(
            account_owner != address(0),
            "ERC20: approve from the zero address"
        );
        require(spender != address(0), "ERC20: approve to the zero address");

        _allowances[account_owner][spender] = amount;
        emit Approval(account_owner, spender, amount);
    }

    function _setupDecimals(uint8 decimals_) internal {
        _decimals = decimals_;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual {
        if (from == address(0)) {
            // When minting tokens
            uint256 newSupply = totalSupply().add(amount);
            require(
                newSupply <= _softcap && newSupply <= _cap,
                "ERC20Capped: cap exceeded"
            );
        }
    }

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual {
        _moveDelegates(from, to, amount);
    }

    // end of ERC20 implementation

    function _reserve(address who, uint256 amount) internal returns (bool) {
        // make sure 'who' has enough tokens in his pocket
        require(
            _balances[who] >= amount,
            "StakingToken: user's free balance is not enough"
        );

        // move from balance into reserved_balance
        _balances[who] = _balances[who].sub(amount);
        _reserved_balances[who] = _reserved_balances[who].add(amount);

        emit BalanceReserved(who, amount);

        return true;
    }

    function _unreserve(address who, uint256 amount) internal returns (bool) {
        require(
            _reserved_balances[who] >= amount,
            "StakingToken: not enough reserved balance"
        );

        // move from reserved_balance into balance
        _reserved_balances[who] = _reserved_balances[who].sub(amount);
        _balances[who] = _balances[who].add(amount);

        emit BalanceUnreserved(who, amount);

        return true;
    }

    function reservedOf(address account) public view returns (uint256) {
        return _reserved_balances[account];
    }

    function actualBalanceOf(address account)
        public
        view
        returns (uint256 free_balance, uint256 reserved_balance)
    {
        return (_balances[account], _reserved_balances[account]);
    }

    function reserve_from(address who, uint256 amount)
        public
        mint_auth_required
        nonReentrant
        returns (bool)
    {
        return _reserve(who, amount);
    }

    function unreserve_from(address who, uint256 amount)
        public
        mint_auth_required
        nonReentrant
        returns (bool)
    {
        return _unreserve(who, amount);
    }

    function set_mint_account(address account) public owner_only nonReentrant {
        _mint_account = account;
    }

    function _moveDelegates(
        address srcRep,
        address dstRep,
        uint256 amount
    ) internal {
        if (srcRep != dstRep && amount > 0) {
            if (srcRep != address(0)) {
                uint256 srcRepNum = numCheckpoints[srcRep];
                uint256 srcRepOld =
                    srcRepNum > 0
                        ? checkpoints[srcRep][srcRepNum - 1].votes
                        : 0;
                uint256 srcRepNew = srcRepOld.sub(amount);
                _writeCheckpoint(srcRep, srcRepNum, srcRepOld, srcRepNew);
            }

            if (dstRep != address(0)) {
                uint256 dstRepNum = numCheckpoints[dstRep];
                uint256 dstRepOld =
                    dstRepNum > 0
                        ? checkpoints[dstRep][dstRepNum - 1].votes
                        : 0;
                uint256 dstRepNew = dstRepOld.add(amount);
                _writeCheckpoint(dstRep, dstRepNum, dstRepOld, dstRepNew);
            }
        }
    }

    function _writeCheckpoint(
        address delegatee,
        uint256 nCheckpoints,
        uint256 oldVotes,
        uint256 newVotes
    ) internal {
        if (
            nCheckpoints > 0 &&
            checkpoints[delegatee][nCheckpoints - 1].fromBlock == block.number
        ) {
            checkpoints[delegatee][nCheckpoints - 1].votes = newVotes;
        } else {
            checkpoints[delegatee][nCheckpoints] = Checkpoint(
                block.number,
                newVotes
            );
            numCheckpoints[delegatee] = nCheckpoints + 1;
        }

        emit DelegateVotesChanged(delegatee, oldVotes, newVotes);
    }

    function getChainId() internal pure returns (uint256) {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        return chainId;
    }

    /**
     * @notice Delegate votes from `msg.sender` to `delegatee`
     * @param delegatee The address to delegate votes to
     */
    function delegate(address delegatee) public nonReentrant {
        return _delegate(msg.sender, delegatee);
    }

    /**
     * @notice Gets the current votes balance for `account`
     * @param account The address to get votes balance
     * @return The number of current votes for `account`
     */
    function getCurrentVotes(address account) external view returns (uint256) {
        uint256 nCheckpoints = numCheckpoints[account];
        return
            nCheckpoints > 0 ? checkpoints[account][nCheckpoints - 1].votes : 0;
    }

    /**
     * @notice Determine the prior number of votes for an account as of a block number
     * @dev Block number must be a finalized block or else this function will revert to prevent misinformation.
     * @param account The address of the account to check
     * @param blockNumber The block number to get the vote balance at
     * @return The number of votes the account had as of the given block
     */
    function getPriorVotes(address account, uint256 blockNumber)
        public
        view
        returns (uint256)
    {
        require(blockNumber < block.number, "StakingToken: not yet determined");

        uint256 nCheckpoints = numCheckpoints[account];
        if (nCheckpoints == 0) {
            return 0;
        }

        // First check most recent balance
        if (checkpoints[account][nCheckpoints - 1].fromBlock <= blockNumber) {
            return checkpoints[account][nCheckpoints - 1].votes;
        }

        // Next check implicit zero balance
        if (checkpoints[account][0].fromBlock > blockNumber) {
            return 0;
        }

        uint256 lower = 0;
        uint256 upper = nCheckpoints - 1;
        while (upper > lower) {
            uint256 center = upper - (upper - lower) / 2; // ceil, avoiding overflow
            Checkpoint memory cp = checkpoints[account][center];
            if (cp.fromBlock == blockNumber) {
                return cp.votes;
            } else if (cp.fromBlock < blockNumber) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        return checkpoints[account][lower].votes;
    }

    function _delegate(address delegator, address delegatee) internal {
        address currentDelegate = delegates[delegator];
        uint256 delegatorBalance = _balances[delegator];
        delegates[delegator] = delegatee;

        emit DelegateChanged(delegator, currentDelegate, delegatee);

        _moveDelegates(currentDelegate, delegatee, delegatorBalance);
    }

    function mint_and_lock(
        address to_whom,
        uint256 amount,
        uint256 lockspan,
        uint256 frozen_hell
    ) public mint_auth_required nonReentrant {
        require(llocks[to_whom].remains_in_lock == 0);

        LinearLockWithFrozenHell storage lk = llocks[to_whom];

        lk.total_amount = amount;
        lk.lock_span = lockspan;
        lk.frozen_hell = frozen_hell;
        lk.created_timestamp = block.timestamp;
        lk.remains_in_lock = amount;
        lk.latest_claim = block.timestamp;

        _mint(address(this), amount);
        _transferToReserved(address(this), to_whom, amount);
    }

    function can_claim() public view isAlive returns (uint256) {
        if (_reserved_balances[_msgSender()] == 0) {
            return 0;
        }
        if (llocks[_msgSender()].remains_in_lock == 0) {
            return 0;
        }

        LinearLockWithFrozenHell storage llwf = llocks[_msgSender()];

        uint256 begins = _releaseBegins(_msgSender());
        if (block.timestamp < begins) {
            return 0;
        }

        uint256 released_span = block.timestamp - begins;
        if (llwf.latest_claim > begins) {
            released_span = block.timestamp - llwf.latest_claim;
        }
        uint256 released_amount =
            llwf.total_amount.div(llwf.lock_span).mul(released_span);

        return released_amount;
    }

    function claim() public nonReentrant isAlive {
        require(
            _reserved_balances[_msgSender()] > 0,
            "StakingToken::claim: sender has no reserved balance"
        );
        require(
            llocks[_msgSender()].remains_in_lock > 0,
            "StakingToken::claim: sender has no locks"
        );

        LinearLockWithFrozenHell storage llwf = llocks[_msgSender()];

        uint256 begins = _releaseBegins(_msgSender());
        require(
            block.timestamp > begins,
            "StakingToken::claim: release has not begin yet"
        );

        uint256 released_span = block.timestamp - begins;
        if (llwf.latest_claim > begins) {
            released_span = block.timestamp - llwf.latest_claim;
        }
        uint256 released_amount =
            llwf.total_amount.div(llwf.lock_span).mul(released_span);

        if (llwf.remains_in_lock <= released_amount) {
            released_amount = llwf.remains_in_lock;
            llwf.remains_in_lock = 0;
        } else {
            llwf.remains_in_lock = llwf.remains_in_lock.sub(released_amount);
        }

        llwf.latest_claim = block.timestamp;

        _unreserve(_msgSender(), released_amount);
    }

    struct LinearLockWithFrozenHell {
        uint256 total_amount;
        uint256 lock_span;
        uint256 frozen_hell;
        uint256 latest_claim;
        uint256 created_timestamp;
        uint256 remains_in_lock;
    }

    mapping(address => LinearLockWithFrozenHell) public llocks;

    function _transferToReserved(
        address sender,
        address recipient,
        uint256 amount
    ) internal virtual {
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != address(0), "ERC20: transfer to the zero address");

        _beforeTokenTransfer(sender, recipient, amount);

        _balances[sender] = _balances[sender].sub(
            amount,
            "ERC20: transfer amount exceeds balance"
        );
        _reserved_balances[recipient] = _reserved_balances[recipient].add(
            amount
        );

        emit Transfer(sender, recipient, amount);
        emit BalanceReserved(recipient, amount);

        _afterTokenTransfer(sender, recipient, amount);
    }

    function _releaseBegins(address who) internal view returns (uint256) {
        LinearLockWithFrozenHell storage llwf = llocks[who];
        uint256 begins = 0;
        if (llwf.created_timestamp > epoch) {
            begins = llwf.created_timestamp;
        } else {
            begins = epoch;
        }
        if (llwf.frozen_hell > 0) {
            begins = begins.add(llwf.frozen_hell);
        }
        return begins;
    }
}
