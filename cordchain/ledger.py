import os
import json
import time
import hashlib
from typing import Optional, Any
from datetime import datetime, timezone
from decimal import Decimal
from Crypto.PublicKey import ECC
from Crypto.Signature import eddsa
from cordchain.db import query, query_one, execute, execute_returning

# ----------------- Ed25519 Server Key Management -----------------
SERVER_KEY_SEED = os.environ.get("CORDCHAIN_SERVER_SEED", "cordchain_fantasy_ledger_master_ed25519_seed_2026")

def _get_server_key() -> ECC.EccKey:
    """Derive deterministic Ed25519 keypair for block signing."""
    seed_bytes = hashlib.sha256(SERVER_KEY_SEED.encode("utf-8")).digest()
    return ECC.generate(curve="ed25519", randfunc=lambda n: seed_bytes[:n] if n <= len(seed_bytes) else (seed_bytes * 2)[:n])

SERVER_KEY = _get_server_key()
SERVER_PUBKEY = SERVER_KEY.public_key()
# 44-byte DER encoded key in hex (88 hex characters), universally importable
SERVER_PUBKEY_HEX = SERVER_PUBKEY.export_key(format="DER").hex()

def sign_data(data: bytes) -> str:
    """Sign bytes with Ed25519 server key, returning hex signature."""
    signer = eddsa.new(SERVER_KEY, "rfc8032")
    return signer.sign(data).hex()

def verify_signature(data: bytes, signature_hex: str, pubkey_hex: str) -> bool:
    """Verify Ed25519 signature."""
    try:
        raw_der = bytes.fromhex(pubkey_hex)
        pub = ECC.import_key(raw_der)
        verifier = eddsa.new(pub, "rfc8032")
        verifier.verify(data, bytes.fromhex(signature_hex))
        return True
    except Exception:
        return False

# ----------------- Canonical JSON Serialization -----------------
def normalize_canonical_obj(obj: Any) -> Any:
    """Recursively normalize objects so JSON matches browser JavaScript byte-for-byte."""
    if isinstance(obj, float):
        if obj.is_integer():
            return int(obj)
        return round(obj, 8)
    if isinstance(obj, Decimal):
        if obj % 1 == 0:
            return int(obj)
        return float(round(obj, 8))
    if isinstance(obj, dict):
        return {k: normalize_canonical_obj(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [normalize_canonical_obj(v) for v in obj]
    return obj

def canonical_json(obj: Any) -> str:
    norm = normalize_canonical_obj(obj)
    def _default(o):
        if isinstance(o, (datetime,)):
            return o.isoformat()
        if isinstance(o, Decimal):
            return int(o) if o % 1 == 0 else str(o)
        return str(o)
    return json.dumps(norm, sort_keys=True, separators=(",", ":"), default=_default)

# ----------------- Merkle Tree -----------------
def compute_merkle_root(hashes: list[str]) -> str:
    """Compute standard pairwise SHA-256 Merkle root."""
    if not hashes:
        return "0" * 64
    current_level = [bytes.fromhex(h) if len(h) == 64 else hashlib.sha256(h.encode()).digest() for h in hashes]
    while len(current_level) > 1:
        next_level = []
        for i in range(0, len(current_level), 2):
            left = current_level[i]
            right = current_level[i + 1] if i + 1 < len(current_level) else left
            combined = hashlib.sha256(left + right).digest()
            next_level.append(combined)
        current_level = next_level
    return current_level[0].hex()

# ----------------- Append-Only Hash Chain -----------------
def append_ledger_entry(
    event_type: str,
    payload: dict,
    guild_id: Optional[str] = None,
    user_id: Optional[str] = None,
) -> dict:
    """Append a row to the CordLedger with SHA-256 hash chaining."""
    ensure_genesis()

    latest = query_one("SELECT entry_index, hash FROM cord_ledger ORDER BY entry_index DESC LIMIT 1")
    if latest:
        next_index = int(latest["entry_index"]) + 1
        prev_hash = str(latest["hash"])
    else:
        next_index = 0
        prev_hash = "0" * 64

    now_ms = int(time.time() * 1000)
    canonical_entry = {
        "id": next_index,
        "ts": now_ms,
        "type": event_type,
        "guild_id": guild_id,
        "user_id": user_id,
        "payload": payload,
        "prev_hash": prev_hash,
    }
    canonical_bytes = canonical_json(canonical_entry).encode("utf-8")
    entry_hash = hashlib.sha256(canonical_bytes).hexdigest()

    execute(
        """
        INSERT INTO cord_ledger (
            entry_index, ts, timestamp, event_type, guild_id, user_id,
            payload, prev_hash, hash
        ) VALUES (
            :idx, :ts_ms, TO_TIMESTAMP(:ts_sec), :evt, :gid, :uid,
            :payload, :prev, :h
        )
        """,
        idx=next_index,
        ts_ms=now_ms,
        ts_sec=now_ms / 1000.0,
        evt=event_type,
        gid=guild_id,
        uid=user_id,
        payload=json.dumps(payload),
        prev=prev_hash,
        h=entry_hash,
    )

    return {
        "entryIndex": next_index,
        "ts": now_ms,
        "timestamp": datetime.fromtimestamp(now_ms / 1000.0, tz=timezone.utc).isoformat(),
        "eventType": event_type,
        "guildId": guild_id,
        "userId": user_id,
        "payload": payload,
        "prevHash": prev_hash,
        "hash": entry_hash,
    }

# ----------------- Genesis Block -----------------
def ensure_genesis():
    """Ensure entry 0 (GENESIS) and block 0 exist."""
    existing = query_one("SELECT count(*) as cnt FROM cord_ledger")
    if existing and existing["cnt"] > 0:
        return

    genesis_ms = 1776500000000  # Deterministic genesis timestamp
    genesis_payload = {
        "message": "CordChain Genesis - Tamper-evident fantasy community exchange",
        "protocol": "CordLedger v1.0",
        "currency": "$CRED",
        "tamperEvident": True,
        "decentralized": False,
        "note": "Local cryptographically verified hash-chained ledger replacing blockchain testnets.",
    }
    canonical_entry = {
        "id": 0,
        "ts": genesis_ms,
        "type": "GENESIS",
        "guild_id": None,
        "user_id": None,
        "payload": genesis_payload,
        "prev_hash": "0" * 64,
    }
    entry_hash = hashlib.sha256(canonical_json(canonical_entry).encode("utf-8")).hexdigest()

    execute(
        """
        INSERT INTO cord_ledger (
            entry_index, ts, timestamp, event_type, guild_id, user_id,
            payload, prev_hash, hash
        ) VALUES (
            0, :ts_ms, TO_TIMESTAMP(:ts_sec), 'GENESIS', NULL, NULL,
            :payload, :prev, :h
        ) ON CONFLICT (entry_index) DO NOTHING
        """,
        ts_ms=genesis_ms,
        ts_sec=genesis_ms / 1000.0,
        payload=json.dumps(genesis_payload),
        prev="0" * 64,
        h=entry_hash,
    )

    produce_block()

# ----------------- Block Producer (Merkle + Ed25519) -----------------
def produce_block() -> Optional[dict]:
    """Group unmined entries into a block with a Merkle root and Ed25519 signature."""
    unmined = query(
        """
        SELECT entry_index, hash FROM cord_ledger
        WHERE block_height IS NULL
        ORDER BY entry_index ASC
        LIMIT 1000
        """
    )
    if not unmined:
        return None

    hashes = [u["hash"] for u in unmined]
    merkle_root = compute_merkle_root(hashes)
    start_idx = unmined[0]["entry_index"]
    end_idx = unmined[-1]["entry_index"]
    entry_count = len(unmined)

    latest_block = query_one("SELECT height, block_hash FROM cord_blocks ORDER BY height DESC LIMIT 1")
    if latest_block:
        height = int(latest_block["height"]) + 1
        prev_block_hash = str(latest_block["block_hash"])
    else:
        height = 0
        prev_block_hash = "0" * 64

    now_ms = int(time.time() * 1000)
    block_header = {
        "entry_count": entry_count,
        "height": height,
        "merkle_root": merkle_root,
        "prev_block_hash": prev_block_hash,
        "ts": now_ms,
    }
    canonical_header = canonical_json(block_header).encode("utf-8")
    block_hash = hashlib.sha256(canonical_header).hexdigest()
    signature = sign_data(block_hash.encode("utf-8"))

    execute(
        """
        INSERT INTO cord_blocks (
            height, ts, timestamp, entry_count, start_entry_index, end_entry_index,
            merkle_root, prev_block_hash, block_hash, signature, signer_pubkey
        ) VALUES (
            :h, :ts_ms, TO_TIMESTAMP(:ts_sec), :cnt, :start, :end,
            :merkle, :prev_h, :b_hash, :sig, :pub
        )
        """,
        h=height,
        ts_ms=now_ms,
        ts_sec=now_ms / 1000.0,
        cnt=entry_count,
        start=start_idx,
        end=end_idx,
        merkle=merkle_root,
        prev_h=prev_block_hash,
        b_hash=block_hash,
        sig=signature,
        pub=SERVER_PUBKEY_HEX,
    )

    # Attach block_height to mined ledger entries
    execute("ALTER TABLE cord_ledger DISABLE TRIGGER trg_cord_ledger_worm")
    try:
        execute(
            """
            UPDATE cord_ledger
            SET block_height = :h
            WHERE entry_index BETWEEN :start AND :end
            """,
            h=height,
            start=start_idx,
            end=end_idx,
        )
    finally:
        execute("ALTER TABLE cord_ledger ENABLE TRIGGER trg_cord_ledger_worm")

    return {
        "height": height,
        "ts": now_ms,
        "timestamp": datetime.fromtimestamp(now_ms / 1000.0, tz=timezone.utc).isoformat(),
        "entryCount": entry_count,
        "startEntryIndex": start_idx,
        "endEntryIndex": end_idx,
        "merkleRoot": merkle_root,
        "prevBlockHash": prev_block_hash,
        "blockHash": block_hash,
        "signature": signature,
        "signerPubkey": SERVER_PUBKEY_HEX,
    }

# ----------------- Cryptographic Verification -----------------
def verify_ledger_integrity() -> dict:
    """Complete cryptographic audit of the CordLedger."""
    entries = query(
        """
        SELECT entry_index, ts, timestamp, event_type, guild_id, user_id,
               payload, prev_hash, hash, block_height
        FROM cord_ledger
        ORDER BY entry_index ASC
        """
    )

    if not entries:
        return {
            "valid": True,
            "checkedEntries": 0,
            "checkedBlocks": 0,
            "brokenAt": None,
            "message": "Empty ledger.",
        }

    # 1. Verify Entry Hash Chain
    for i, e in enumerate(entries):
        idx = int(e["entry_index"])
        expected_prev = "0" * 64 if idx == 0 else str(entries[i - 1]["hash"])
        if str(e["prev_hash"]) != expected_prev:
            return {
                "valid": False,
                "brokenAt": idx,
                "reason": f"Prev-hash mismatch at entry #{idx}. Expected {expected_prev[:12]}..., got {str(e['prev_hash'])[:12]}...",
            }

        # Check hash calculation
        ts_val = int(e["ts"]) if e.get("ts") is not None else int(e["timestamp"].timestamp() * 1000)
        canonical_entry = {
            "id": idx,
            "ts": ts_val,
            "type": e["event_type"],
            "guild_id": e["guild_id"],
            "user_id": e["user_id"],
            "payload": e["payload"] if isinstance(e["payload"], dict) else json.loads(e["payload"]),
            "prev_hash": str(e["prev_hash"]),
        }
        computed_hash = hashlib.sha256(canonical_json(canonical_entry).encode("utf-8")).hexdigest()
        if computed_hash != str(e["hash"]):
            return {
                "valid": False,
                "brokenAt": idx,
                "reason": f"Hash integrity failure at entry #{idx}. Computed {computed_hash[:12]}..., stored {str(e['hash'])[:12]}...",
            }

    # 2. Verify Blocks & Merkle Roots & Ed25519 Signatures
    blocks = query("SELECT * FROM cord_blocks ORDER BY height ASC")
    for j, b in enumerate(blocks):
        height = int(b["height"])
        expected_prev_b = "0" * 64 if height == 0 else str(blocks[j - 1]["block_hash"])
        if str(b["prev_block_hash"]) != expected_prev_b:
            return {
                "valid": False,
                "brokenAtBlock": height,
                "reason": f"Prev-block-hash mismatch at block #{height}.",
            }

        # Check Merkle root
        block_entries = [e["hash"] for e in entries if e.get("block_height") == height]
        if block_entries:
            recomputed_merkle = compute_merkle_root(block_entries)
            if recomputed_merkle != str(b["merkle_root"]):
                return {
                    "valid": False,
                    "brokenAtBlock": height,
                    "reason": f"Merkle root mismatch at block #{height}. Recomputed {recomputed_merkle[:12]}..., stored {str(b['merkle_root'])[:12]}...",
                }

        # Verify Block Hash
        ts_b = int(b["ts"]) if b.get("ts") is not None else int(b["timestamp"].timestamp() * 1000)
        block_header = {
            "entry_count": int(b["entry_count"]),
            "height": height,
            "merkle_root": str(b["merkle_root"]),
            "prev_block_hash": str(b["prev_block_hash"]),
            "ts": ts_b,
        }
        computed_bhash = hashlib.sha256(canonical_json(block_header).encode("utf-8")).hexdigest()
        if computed_bhash != str(b["block_hash"]):
            return {
                "valid": False,
                "brokenAtBlock": height,
                "reason": f"Block hash mismatch at block #{height}.",
            }

        # Verify Ed25519 signature
        is_sig_valid = verify_signature(
            str(b["block_hash"]).encode("utf-8"),
            str(b["signature"]),
            str(b["signer_pubkey"]),
        )
        if not is_sig_valid:
            return {
                "valid": False,
                "brokenAtBlock": height,
                "reason": f"Ed25519 cryptographic signature verification failed at block #{height}.",
            }

    return {
        "valid": True,
        "checkedEntries": len(entries),
        "checkedBlocks": len(blocks),
        "latestEntryHash": entries[-1]["hash"],
        "latestBlockHash": blocks[-1]["block_hash"] if blocks else None,
        "latestBlockHeight": blocks[-1]["height"] if blocks else 0,
        "signerPubkey": SERVER_PUBKEY_HEX,
        "tamperEvidentStatus": "VERIFIED_TAMPER_FREE",
    }

# ----------------- Checkpoint Generation -----------------
def generate_daily_checkpoint() -> dict:
    """Generate daily public checkpoint for Discord / GitHub publishing."""
    audit = verify_ledger_integrity()
    latest_block = query_one("SELECT * FROM cord_blocks ORDER BY height DESC LIMIT 1")
    latest_entry = query_one("SELECT * FROM cord_ledger ORDER BY entry_index DESC LIMIT 1")

    now = datetime.now(timezone.utc).isoformat()
    return {
        "checkpointTimestamp": now,
        "status": "VALID" if audit.get("valid") else "INTEGRITY_BREACH",
        "latestBlockHeight": latest_block["height"] if latest_block else 0,
        "latestBlockHash": latest_block["block_hash"] if latest_block else "0" * 64,
        "merkleRoot": latest_block["merkle_root"] if latest_block else "0" * 64,
        "blockSignature": latest_block["signature"] if latest_block else None,
        "latestEntryIndex": latest_entry["entry_index"] if latest_entry else 0,
        "latestEntryHash": latest_entry["hash"] if latest_entry else "0" * 64,
        "signerPubkey": SERVER_PUBKEY_HEX,
        "totalEntries": audit.get("checkedEntries", 0),
        "totalBlocks": audit.get("checkedBlocks", 0),
        "tamperEvidentStatus": audit.get("tamperEvidentStatus", "UNKNOWN"),
        "verificationInstruction": "Verify with: python scripts/verify_cordchain.py or in browser at /scan",
    }
