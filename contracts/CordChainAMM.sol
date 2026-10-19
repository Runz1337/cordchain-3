// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IERC20.sol";
import "./CordChainStockToken.sol";

/**
 * @title CordChainAMM
 * @dev Automated Market Maker and Bonding Curve Liquidity Pool for Discord Server Stocks on Base Sepolia.
 */
contract CordChainAMM {
    address public owner;
    address public relayer;

    struct StockPool {
        address tokenAddress;
        string ticker;
        uint256 reserveStock;
        uint256 reserveCred;
        uint256 baseSpotPriceWei; // 18-decimal price in CRED
        bool isActive;
    }

    mapping(address => StockPool) public pools;
    mapping(string => address) public tickerToToken;
    address[] public registeredTokens;

    event PoolInitialized(address indexed token, string ticker, uint256 initialPriceWei);
    event TradeExecuted(
        address indexed trader,
        address indexed token,
        string side,
        uint256 shares,
        uint256 pricePerShareWei,
        uint256 totalCredWei,
        uint256 timestamp
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(address _relayer) {
        owner = msg.sender;
        relayer = _relayer;
    }

    function registerStockPool(
        address tokenAddress,
        string memory ticker,
        uint256 initialSpotPriceWei,
        uint256 initialReserveStock,
        uint256 initialReserveCred
    ) external onlyOwner {
        require(tokenAddress != address(0), "Invalid token");
        pools[tokenAddress] = StockPool({
            tokenAddress: tokenAddress,
            ticker: ticker,
            reserveStock: initialReserveStock * 10**18,
            reserveCred: initialReserveCred * 10**18,
            baseSpotPriceWei: initialSpotPriceWei,
            isActive: true
        });
        tickerToToken[ticker] = tokenAddress;
        registeredTokens.push(tokenAddress);

        emit PoolInitialized(tokenAddress, ticker, initialSpotPriceWei);
    }

    /**
     * @dev Calculates spot price per share given current reserves (constant-product / hyperbolic curve).
     */
    function getSpotPrice(address tokenAddress) public view returns (uint256) {
        StockPool memory pool = pools[tokenAddress];
        require(pool.isActive, "Pool not active");
        if (pool.reserveStock == 0) return pool.baseSpotPriceWei;
        return (pool.reserveCred * 10**18) / pool.reserveStock;
    }

    /**
     * @dev Quote trade cost / proceeds with slippage calculation.
     */
    function getQuote(
        address tokenAddress,
        uint256 shares,
        bool isBuy
    ) public view returns (uint256 totalCostWei, uint256 slippageBps) {
        StockPool memory pool = pools[tokenAddress];
        require(pool.isActive, "Pool not active");

        uint256 currentPrice = getSpotPrice(tokenAddress);
        uint256 baseCost = shares * currentPrice;

        // Dynamic hyperbolic slippage model (capped at ~12% max swing)
        uint256 impactBps = (shares * 10_000) / (pool.reserveStock / 10**18 + shares + 100);
        if (impactBps > 1200) impactBps = 1200; // max 12%

        if (isBuy) {
            totalCostWei = baseCost + (baseCost * impactBps) / 10_000;
        } else {
            totalCostWei = baseCost - (baseCost * impactBps) / 10_000;
        }
        slippageBps = impactBps;
    }

    /**
     * @dev Buy shares through the AMM router. Mints tokens to recipient address.
     */
    function buyShares(
        address tokenAddress,
        uint256 shares,
        address recipient
    ) external payable returns (uint256 totalCostWei) {
        StockPool storage pool = pools[tokenAddress];
        require(pool.isActive, "Pool not active");
        require(shares > 0, "Shares must be > 0");

        (totalCostWei, ) = getQuote(tokenAddress, shares, true);
        uint256 pricePerShareWei = totalCostWei / shares;

        // Update reserves
        pool.reserveCred += totalCostWei;
        pool.reserveStock += (shares * 10**18);

        // Mint real ERC-20 stock tokens to the trader's on-chain wallet
        CordChainStockToken(tokenAddress).mint(recipient, shares * 10**18);

        emit TradeExecuted(
            recipient,
            tokenAddress,
            "BUY",
            shares,
            pricePerShareWei,
            totalCostWei,
            block.timestamp
        );
    }

    /**
     * @dev Sell shares through the AMM router. Burns tokens from seller address.
     */
    function sellShares(
        address tokenAddress,
        uint256 shares,
        address seller
    ) external returns (uint256 totalPayoutWei) {
        StockPool storage pool = pools[tokenAddress];
        require(pool.isActive, "Pool not active");
        require(shares > 0, "Shares must be > 0");

        (totalPayoutWei, ) = getQuote(tokenAddress, shares, false);
        uint256 pricePerShareWei = totalPayoutWei / shares;

        require(pool.reserveCred >= totalPayoutWei, "Insufficient pool liquidity");

        // Burn stock tokens from seller
        CordChainStockToken(tokenAddress).burn(seller, shares * 10**18);

        // Update reserves
        pool.reserveCred -= totalPayoutWei;
        if (pool.reserveStock > shares * 10**18) {
            pool.reserveStock -= (shares * 10**18);
        }

        emit TradeExecuted(
            seller,
            tokenAddress,
            "SELL",
            shares,
            pricePerShareWei,
            totalPayoutWei,
            block.timestamp
        );
    }
}
