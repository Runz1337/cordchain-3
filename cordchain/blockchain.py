"""CordLedger Bridge & Compatibility Layer.

Replaces real EVM/Base Sepolia blockchain integration with the local
tamper-evident CordLedger. No Web3, no gas, no RPCs, no testnets.
"""

from typing import Optional
from cordchain.db import query, query_one, execute
from cordchain.ledger import (
    append_ledger_entry,
    produce_block,
    verify_ledger_integrity,
    generate_daily_checkpoint,
    SERVER_PUBKEY_HEX,
)

# CordScan Local Explorer Configuration
CORDSCAN_NETWORK = "CordLedger Local Chain"
CORDSCAN_CHAIN_ID = 424242
CORDSCAN_EXPLORER_BASE = "/scan"

def get_blockchain_status() -> dict:
    """Fetch live status of the CordLedger tamper-evident chain."""
    audit = verify_ledger_integrity()
    latest_block = query_one("SELECT * FROM cord_blocks ORDER BY height DESC LIMIT 1")
    latest_entry = query_one("SELECT * FROM cord_ledger ORDER BY entry_index DESC LIMIT 1")
    stocks_cnt = query_one("SELECT count(*) as cnt FROM guilds") or {}

    return {
        "connected": True,
        "network": CORDSCAN_NETWORK,
        "chainId": CORDSCAN_CHAIN_ID,
        "explorerUrl": CORDSCAN_EXPLORER_BASE,
        "latestBlock": int(latest_block["height"]) if latest_block else 0,
        "latestBlockHash": str(latest_block["block_hash"]) if latest_block else "0" * 64,
        "merkleRoot": str(latest_block["merkle_root"]) if latest_block else "0" * 64,
        "totalEntries": int(audit.get("checkedEntries", 0)),
        "totalBlocks": int(audit.get("checkedBlocks", 0)),
        "latestEntryHash": str(latest_entry["hash"]) if latest_entry else "0" * 64,
        "signerPubkey": SERVER_PUBKEY_HEX,
        "tamperEvident": True,
        "tamperEvidentStatus": audit.get("tamperEvidentStatus", "VERIFIED_TAMPER_FREE"),
        "currency": "$CRED",
        "stocksCount": stocks_cnt.get("cnt", 0),
    }

def get_stock_token_info(ticker: str) -> dict:
    """Resolve guild token metadata on CordLedger."""
    cleaned = ticker.strip().upper()
    if not cleaned.startswith("$"):
        cleaned = f"${cleaned}"
    row = query_one("SELECT name, ticker, guild_id, stock_price, fixed_supply, circulating_shares FROM guilds WHERE UPPER(ticker) = :t", t=cleaned)
    if not row:
        name = f"{cleaned[1:]} Stock Token"
        gid = None
        price = "1.00"
        supply = 1_000_000
    else:
        name = row["name"]
        gid = row["guild_id"]
        price = str(row["stock_price"])
        supply = row.get("fixed_supply", 1_000_000)

    token_hash = f"cc_token_{cleaned[1:].lower()}_{gid}" if gid else None
    return {
        "ticker": cleaned,
        "name": name,
        "symbol": cleaned[1:],
        "tokenHash": token_hash,
        "fixedSupply": supply,
        "circulatingShares": row.get("circulating_shares", 750_000) if row else 750_000,
        "tokenDeployed": True,
        "explorerUrl": f"/scan/token/{gid}" if gid else None,
        "network": CORDSCAN_NETWORK,
        "chainId": CORDSCAN_CHAIN_ID,
        "priceCred": price,
    }

def record_on_chain_trade(
    user_id: str,
    guild_id: str,
    ticker: str,
    action: str,
    shares: int,
    price_per_share: float,
    total_cred: float,
    user_wallet_address: Optional[str] = None,
) -> dict:
    """Record trade instantly on the append-only CordLedger with SHA-256 hash chaining."""
    payload = {
        "action": action.upper(),
        "ticker": ticker,
        "shares": shares,
        "price_per_share": round(price_per_share, 6),
        "total_cred": round(total_cred, 2),
        "settlement": "CordLedger Constant-Product AMM",
    }
    entry = append_ledger_entry(
        event_type=f"TRADE_{action.upper()}",
        payload=payload,
        guild_id=guild_id,
        user_id=user_id,
    )
    # Produce block for new entries
    block = produce_block()
    block_height = block["height"] if block else query_one("SELECT max(height) as h FROM cord_blocks")["h"]

    return {
        "ledgerHash": entry["hash"],
        "entryIndex": entry["entryIndex"],
        "prevHash": entry["prevHash"],
        "blockNumber": block_height,
        "network": CORDSCAN_NETWORK,
        "chainId": CORDSCAN_CHAIN_ID,
        "explorerUrl": f"/scan/tx/{entry['hash']}",
        "timestamp": entry["timestamp"],
        "onChainStatus": "mined",
        "isMinedOnChain": True,
    }

def register_trade_tx(transaction_id: str, tx_hash: str, block_number: int | None = None, wallet_address: str | None = None) -> dict:
    """Legacy helper redirected to CordLedger hash verification."""
    entry = query_one("SELECT * FROM cord_ledger WHERE hash = :h", h=tx_hash)
    return {
        "id": transaction_id,
        "ledgerHash": tx_hash,
        "verified": entry is not None,
        "status": "mined" if entry else "unverified",
    }

def sync_guild_contracts():
    """No-op on CordLedger — all guilds trade natively on the local ledger."""
    pass
