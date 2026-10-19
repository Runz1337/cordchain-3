"""Public web destinations for the Discord surface.

The bot deep-links into the CordChain web terminal (dashboard OAuth consent,
exchange browsing). The origin resolves from explicit env first, then the
Replit dev domains this repl runs on.
"""

from __future__ import annotations

import os

DASHBOARD_PATH = "/dash"     # guarded tab — unauthenticated users land on the OAuth consent flow
EXCHANGE_PATH = "/exchange"  # public exchange floor


def web_url(path: str = "") -> str:
    """Absolute web origin (override via CORDCHAIN_WEB_URL)."""
    explicit = os.environ.get("CORDCHAIN_WEB_URL")
    if explicit:
        return explicit.rstrip("/") + (path or "")
    domain = os.environ.get("REPLIT_DEV_DOMAIN")
    if not domain:
        domains = os.environ.get("REPLIT_DOMAINS") or ""
        domain = domains.split(",")[0].strip() if domains else ""
    if domain:
        return f"https://{domain.rstrip('/')}" + (path or "")
    return "https://cordchain.replit.app" + (path or "")


def dashboard_url() -> str:
    """Deep link that drops new users straight into the authorize flow."""
    return web_url(DASHBOARD_PATH)


def exchange_url() -> str:
    return web_url(EXCHANGE_PATH)
