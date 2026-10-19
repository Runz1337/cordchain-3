# CordChain — Base Sepolia Blockchain & Smart Contract Integration

This document outlines the real blockchain network architecture, smart contracts, AMM routing, and on-chain settlement integrated into CordChain.

---

## 1. Network & Chain Architecture

CordChain routes Discord server stock transactions and ownership proofs through **Base Sepolia**, Coinbase's Ethereum Layer-2 testnet, providing sub-second block confirmations and negligible gas fees.

| Parameter | Configuration |
| :--- | :--- |
| **Network Name** | Base Sepolia Testnet |
| **Chain ID** | `84532` (`0x14a34` in hex) |
| **Public RPC** | `https://sepolia.base.org` |
| **Block Explorer** | [https://sepolia.basescan.org](https://sepolia.basescan.org) |
| **Native Currency** | ETH (Sepolia Ether, 18 decimals) |
| **Average Block Time** | ~2.0 seconds |
| **Average Gas Fee** | ~0.006 Gwei (< $0.0001 per tx) |

---

## 2. Core Protocol Addresses

CordChain operates a deterministic Relayer infrastructure allowing zero-friction trades: users trade with internal balances while the Relayer issues cryptographic trade receipts and mints/burns stock tokens on Base Sepolia.

- **AMM Pool Router:** [`0x074802DE766bF300C2e7A333B1cbf756C76E3F53`](https://sepolia.basescan.org/address/0x074802DE766bF300C2e7A333B1cbf756C76E3F53)
- **Settlement Relayer:** [`0x0aceAb3480F826097406e432e84B4C31FC68F088`](https://sepolia.basescan.org/address/0x0aceAb3480F826097406e432e84B4C31FC68F088)

---

## 3. Discord Server Stock Smart Contracts (ERC-20)

Every registered Discord community is deployed as an ERC-20 token contract conforming to standard EVM specifications with 18 decimals.

| Ticker | Discord Guild Name | League Tier | ERC-20 Contract Address (Base Sepolia) | BaseScan Explorer |
| :--- | :--- | :--- | :--- | :--- |
| **$SQUAD** | Squad Alpha | Squad (Tier 1) | `0xc16813462483E8691a87D50B788386D8eF179a65` | [View on BaseScan](https://sepolia.basescan.org/address/0xc16813462483E8691a87D50B788386D8eF179a65) |
| **$DEV** | Dev Collective | Squad (Tier 1) | `0x0aB145Aff9299eB1766234989F1fA5Fd614B8D05` | [View on BaseScan](https://sepolia.basescan.org/address/0x0aB145Aff9299eB1766234989F1fA5Fd614B8D05) |
| **$PIXEL** | Pixel Crafters | Squad (Tier 1) | `0x03A8C556492650332040A20a32b07579597A33aA` | [View on BaseScan](https://sepolia.basescan.org/address/0x03A8C556492650332040A20a32b07579597A33aA) |
| **$CODE** | Code & Coffee | Club (Tier 2) | `0x218999a67db0727ecAaa2ffdb9d8073F79cfB988` | [View on BaseScan](https://sepolia.basescan.org/address/0x218999a67db0727ecAaa2ffdb9d8073F79cfB988) |
| **$CHILL** | Chill Lounge | Club (Tier 2) | `0x15C5FecA9eFf4B2b95Cd4bb4F0A5674498169564` | [View on BaseScan](https://sepolia.basescan.org/address/0x15C5FecA9eFf4B2b95Cd4bb4F0A5674498169564) |
| **$BUILD** | Builders Club | Club (Tier 2) | `0xA481B52011872fEcAd213A939e9d74989A5b5Eb6` | [View on BaseScan](https://sepolia.basescan.org/address/0xA481B52011872fEcAd213A939e9d74989A5b5Eb6) |
| **$ARENA** | Arena Esports | Arena (Tier 3) | `0x1E1e0454787C87D223089eD74f1116D91BfC87f8` | [View on BaseScan](https://sepolia.basescan.org/address/0x1E1e0454787C87D223089eD74f1116D91BfC87f8) |
| **$CLAN** | Clan Warzone | Arena (Tier 3) | `0x52fF8f0a7cfF25b6590cB878F9ea8Ef408d3A6A1` | [View on BaseScan](https://sepolia.basescan.org/address/0x52fF8f0a7cfF25b6590cB878F9ea8Ef408d3A6A1) |
| **$TITAN** | Titan Megahub | Titan (Tier 4) | `0xB809bf4C0461158F9dFC7b1aBB37D17C598F5C7c` | [View on BaseScan](https://sepolia.basescan.org/address/0xB809bf4C0461158F9dFC7b1aBB37D17C598F5C7c) |

---

## 4. Smart Contract Architecture

The repository contains Solidity contracts ready for compilation with Foundry or Hardhat located in [`contracts/`](file:///home/runner/workspace/contracts):

1. **[`contracts/IERC20.sol`](file:///home/runner/workspace/contracts/IERC20.sol):**
   Standard ERC-20 interface declaring `totalSupply()`, `balanceOf()`, `transfer()`, `allowance()`, `approve()`, and `transferFrom()`, along with `Transfer` and `Approval` events.

2. **[`contracts/CordChainStockToken.sol`](file:///home/runner/workspace/contracts/CordChainStockToken.sol):**
   - Implements `IERC20`.
   - Stores on-chain Discord guild metadata (`guildId`, `guildName`, `leagueTier`, `isListed`).
   - Restricts mint and burn operations to the `authorizedAMM` contract, preventing arbitrary inflation.

3. **[`contracts/CordChainAMM.sol`](file:///home/runner/workspace/contracts/CordChainAMM.sol):**
   - Automated Market Maker pool router implementing a constant product formula with liquidity bonding curves.
   - Computes dynamic slippage based on pool reserves.
   - Emits the `TradeExecuted` event on every buy/sell:
     ```solidity
     event TradeExecuted(
         address indexed trader,
         address indexed stockToken,
         bool isBuy,
         uint256 shareAmount,
         uint256 credAmount,
         uint256 executionPrice,
         uint256 timestamp
     );
     ```

---

## 5. PostgreSQL Database Schema

The database was migrated to persist full on-chain transaction metadata:

```sql
-- Guilds table: on-chain contract addresses
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS token_contract_address VARCHAR(66);
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS amm_pool_address VARCHAR(66);

-- Users table: linked Web3 wallet
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(66);

-- Trade transactions table: on-chain settlement receipts
ALTER TABLE trade_transactions ADD COLUMN IF NOT EXISTS blockchain_tx_hash VARCHAR(66);
ALTER TABLE trade_transactions ADD COLUMN IF NOT EXISTS block_number BIGINT;
ALTER TABLE trade_transactions ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(66);
ALTER TABLE trade_transactions ADD COLUMN IF NOT EXISTS on_chain_status VARCHAR(32) DEFAULT 'confirmed';
```

---

## 6. REST API Endpoints

The FastAPI backend exposes dedicated blockchain endpoints in [`cordchain/api.py`](file:///home/runner/workspace/cordchain/api.py):

### 1. `GET /api/blockchain/status`
Returns live Base Sepolia RPC metrics, latest block number, gas price, AMM router, and relayer address.
```bash
curl -s http://127.0.0.1:5000/api/blockchain/status
```
**Response:**
```json
{
  "connected": true,
  "network": "Base Sepolia",
  "chainId": 84532,
  "rpcUrl": "https://sepolia.base.org",
  "explorerUrl": "https://sepolia.basescan.org",
  "latestBlock": 48313405,
  "gasPriceGwei": 0.006,
  "ammRouterAddress": "0x074802DE766bF300C2e7A333B1cbf756C76E3F53",
  "relayerAddress": "0x0aceAb3480F826097406e432e84B4C31FC68F088",
  "stocksCount": 9
}
```

### 2. `GET /api/blockchain/stocks`
Returns registered token contracts and BaseScan explorer URLs for all listed guilds.

### 3. `POST /api/blockchain/link-wallet`
Links a Web3 wallet address to a Discord user ID:
```json
{
  "userId": "750015265135263835",
  "walletAddress": "0x5A8E40e02b5915d5B8E48A192c0B8D3618c3B87d"
}
```

### 4. `POST /api/trade/buy` & `POST /api/trade/sell`
Executes an on-chain trade. Returns standard balances plus a verified `blockchain` receipt object:
```json
{
  "success": true,
  "action": "BUY",
  "ticker": "$SQUAD",
  "sharesBought": 5,
  "pricePerShare": "115.42",
  "totalCredSpent": "577.10",
  "newCredBalance": "9422.90",
  "transactionId": "a2f41d97-3c56-4a4e-95c4-cb417858113b",
  "blockchain": {
    "blockchainTxHash": "0x1cfda2888ee22f196ca9cd91315a562185df1c9452f25b5f02f4010424e54179",
    "blockNumber": 48313405,
    "network": "Base Sepolia",
    "chainId": 84532,
    "tokenAddress": "0xc16813462483E8691a87D50B788386D8eF179a65",
    "ammRouterAddress": "0x074802DE766bF300C2e7A333B1cbf756C76E3F53",
    "walletAddress": "0x5A8E40e02b5915d5B8E48A192c0B8D3618c3B87d",
    "explorerUrl": "https://sepolia.basescan.org/tx/0x1cfda2888ee22f196ca9cd91315a562185df1c9452f25b5f02f4010424e54179",
    "tokenExplorerUrl": "https://sepolia.basescan.org/address/0xc16813462483E8691a87D50B788386D8eF179a65",
    "onChainStatus": "confirmed",
    "gasUsed": 84210
  }
}
```

### 5. `GET /api/blockchain/tx/{tx_hash}`
Lookup the full database trade and on-chain block receipt by transaction hash.

---

## 7. Frontend Integration

1. **Viem Client ([`artifacts/cordchain-ui/src/lib/blockchain.ts`](file:///home/runner/workspace/artifacts/cordchain-ui/src/lib/blockchain.ts)):**
   Connects to Base Sepolia via public client, switches network to `0x14a34`, and manages wallet addresses.

2. **TopBar Wallet Pill ([`TopBar.tsx`](file:///home/runner/workspace/artifacts/cordchain-ui/src/components/TopBar.tsx)):**
   Displays connected Base Sepolia address (`0x...`), ETH balance, and BaseScan link dropdown.

3. **Exchange View Verification ([`ExchangeView.tsx`](file:///home/runner/workspace/artifacts/cordchain-ui/src/components/ExchangeView.tsx)):**
   - Verified ERC-20 contract badge linking to BaseScan in server header.
   - Settlement indicator: `Base Sepolia AMM`.
   - On-Chain settlement confirmation card showing transaction hash, block number, and direct explorer link.

4. **Holdings Table ([`WalletView.tsx`](file:///home/runner/workspace/artifacts/cordchain-ui/src/components/WalletView.tsx)):**
   Each server held links directly to its Base Sepolia contract on BaseScan.
