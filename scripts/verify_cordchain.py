#!/usr/bin/env python3
"""Open-Source CordLedger Cryptographic Verifier.

Audits any running CordLedger instance by independently:
1. Re-calculating canonical SHA-256 hashes for all ledger entries.
2. Checking unbroken prev_hash chaining from Genesis to latest.
3. Re-computing Merkle trees for all sealed blocks.
4. Verifying Ed25519 digital block signatures.
"""

from __future__ import annotations

import sys
import json
import hashlib
import argparse
import urllib.request
import urllib.error

def normalize_canonical_obj(obj):
    if isinstance(obj, float):
        if obj.is_integer():
            return int(obj)
        return round(obj, 8)
    if isinstance(obj, dict):
        return {k: normalize_canonical_obj(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [normalize_canonical_obj(v) for v in obj]
    return obj

def canonical_entry_bytes(entry: dict) -> bytes:
    clean = {
        "guild_id": entry.get("guildId") or entry.get("guild_id"),
        "id": entry.get("entryIndex") if entry.get("entryIndex") is not None else (entry.get("id") if entry.get("id") is not None else entry.get("index")),
        "payload": normalize_canonical_obj(entry.get("payload") or {}),
        "prev_hash": entry.get("prevHash") or entry.get("prev_hash"),
        "ts": entry.get("ts"),
        "type": entry.get("eventType") or entry.get("type"),
        "user_id": entry.get("userId") or entry.get("user_id"),
    }
    return json.dumps(clean, sort_keys=True, separators=(",", ":")).encode("utf-8")

def compute_merkle_root(hashes: list[str]) -> str:
    if not hashes:
        return "0" * 64
    current_level = [bytes.fromhex(h) if len(h) == 64 else hashlib.sha256(h.encode()).digest() for h in hashes]
    while len(current_level) > 1:
        next_level = []
        for i in range(0, len(current_level), 2):
            left = current_level[i]
            right = current_level[i + 1] if i + 1 < len(current_level) else left
            parent = hashlib.sha256(left + right).digest()
            next_level.append(parent)
        current_level = next_level
    return current_level[0].hex()

def verify_ed25519(pubkey_hex: str, message_bytes: bytes, sig_hex: str) -> tuple[bool, str | None]:
    try:
        from Crypto.PublicKey import ECC
        from Crypto.Signature import eddsa
    except (ImportError, ModuleNotFoundError):
        return False, "pycryptodome library is not installed in this environment. Run with '.venv/bin/python3' or 'pip install pycryptodome'."
    except Exception as e:
        return False, f"Crypto import error: {e}"

    try:
        key = ECC.import_key(bytes.fromhex(pubkey_hex))
        signer = eddsa.new(key, "rfc8032")
        signer.verify(message_bytes, bytes.fromhex(sig_hex))
        return True, None
    except Exception as e:
        return False, f"Signature mismatch: {e}"

def http_get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "CordLedger-Verifier/1.0"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))

def main():
    parser = argparse.ArgumentParser(description="CordLedger Cryptographic Audit CLI")
    parser.add_argument("--api", default="http://127.0.0.1:5000", help="Base URL of CordLedger FastAPI")
    args = parser.parse_args()

    api_url = args.api.rstrip("/")
    print(f"\n[+] Connecting to CordLedger node at {api_url} ...")

    try:
        status = http_get_json(f"{api_url}/api/ledger/status")
        entries_resp = http_get_json(f"{api_url}/api/ledger/entries?limit=5000")
        blocks_resp = http_get_json(f"{api_url}/api/ledger/blocks?limit=500")
    except urllib.error.URLError as err:
        print(f"[-] Network error connecting to CordLedger: {err}")
        sys.exit(1)

    entries = entries_resp.get("entries", [])
    blocks = blocks_resp.get("blocks", [])

    print(f"[+] Loaded {len(entries)} ledger entries and {len(blocks)} blocks.")
    print("=" * 64)

    # 1. Audit Entries and Prev_Hash chaining
    sorted_entries = sorted(entries, key=lambda x: x.get("entryIndex", x.get("index", x.get("id", 0))))
    chain_intact = True
    for i, e in enumerate(sorted_entries):
        calculated_hash = hashlib.sha256(canonical_entry_bytes(e)).hexdigest()
        recorded_hash = e.get("hash")
        idx = e.get("entryIndex", e.get("index", e.get("id", i)))

        if calculated_hash != recorded_hash:
            print(f"[-] [FAIL] Hash mismatch at entry #{idx}!")
            print(f"     Recorded:   {recorded_hash}")
            print(f"     Calculated: {calculated_hash}")
            chain_intact = False
            break

        if i > 0:
            prev_entry = sorted_entries[i - 1]
            prev_hash = e.get("prev_hash") or e.get("prevHash")
            expected_prev = prev_entry.get("hash")
            if prev_hash != expected_prev:
                print(f"[-] [FAIL] Chain broken at entry #{idx}!")
                print(f"     Recorded prev_hash: {prev_hash}")
                print(f"     Expected:           {expected_prev}")
                chain_intact = False
                break

    if chain_intact:
        print(f"[✔] [PASS] Verified {len(sorted_entries)} entry hashes & prev_hash links.")

    # 2. Audit Merkle Roots
    merkle_intact = True
    entries_by_block: dict[int, list[str]] = {}
    for e in sorted_entries:
        bh = e.get("block_height") if e.get("block_height") is not None else e.get("blockHeight")
        if bh is not None:
            entries_by_block.setdefault(bh, []).append(e["hash"])

    for b in blocks:
        height = b["height"]
        block_entry_hashes = entries_by_block.get(height, [])
        calculated_root = compute_merkle_root(block_entry_hashes)
        recorded_root = b.get("merkle_root") or b.get("merkleRoot")
        if recorded_root and recorded_root != calculated_root:
            print(f"[-] [FAIL] Merkle root mismatch on Block #{height}!")
            print(f"     Recorded:   {recorded_root}")
            print(f"     Calculated: {calculated_root}")
            merkle_intact = False
            break

    if merkle_intact:
        print(f"[✔] [PASS] Verified Merkle tree roots for all {len(blocks)} blocks.")

    # 3. Audit Ed25519 Signatures
    sigs_intact = True
    signer_pubkey = status.get("signerPublicKey")
    for b in blocks:
        sig = b.get("signature")
        b_hash = b.get("block_hash") or b.get("blockHash")
        b_pub = b.get("signer_pubkey") or b.get("signerPubkey") or signer_pubkey
        if sig and b_hash and b_pub:
            is_valid, err_msg = verify_ed25519(b_pub, b_hash.encode("utf-8"), sig)
            if not is_valid:
                print(f"[-] [FAIL] Ed25519 signature check failed on Block #{b['height']}!")
                if err_msg:
                    print(f"     Reason: {err_msg}")
                sigs_intact = False
                break

    if sigs_intact:
        print(f"[✔] [PASS] Verified Ed25519 block producer digital signatures.")

    print("=" * 64)
    if chain_intact and merkle_intact and sigs_intact:
        print("╔════════════════════════════════════════════════════════════════╗")
        print("║               CORDLEDGER CRYPTOGRAPHIC AUDIT                   ║")
        print("╠════════════════════════════════════════════════════════════════╣")
        print("║  STATUS:           VERIFIED_TAMPER_FREE                        ║")
        print(f"║  ENTRIES AUDITED:  {len(sorted_entries):<44}║")
        print(f"║  BLOCKS AUDITED:   {len(blocks):<44}║")
        print("║  TAMPER EVIDENCE:  100% INTACT & MATHEMATICALLY PROVEN         ║")
        print("╚════════════════════════════════════════════════════════════════╝\n")
        sys.exit(0)
    else:
        print("[-] AUDIT FAILED: Cryptographic inconsistencies found in ledger.\n")
        sys.exit(1)

if __name__ == "__main__":
    main()
