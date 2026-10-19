import os
import urllib.parse
from pg8000.native import Connection, literal
from contextlib import contextmanager

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL must be set to run CordChain.")

def get_connection():
    url = urllib.parse.urlparse(DATABASE_URL)
    return Connection(
        user=url.username or "postgres",
        password=url.password,
        host=url.hostname or "localhost",
        port=url.port or 5432,
        database=url.path.lstrip("/") or "postgres",
        ssl_context=None,
    )

def query(sql_query: str, **params) -> list[dict]:
    """Execute a SELECT query and return list of dicts."""
    con = get_connection()
    try:
        rows = con.run(sql_query, **params)
        cols = [c["name"] for c in con.columns] if con.columns else []
        return [dict(zip(cols, row)) for row in rows]
    finally:
        con.close()

def query_one(sql_query: str, **params) -> dict | None:
    """Execute a SELECT query and return first row as dict or None."""
    results = query(sql_query, **params)
    return results[0] if results else None

def execute(sql_query: str, **params):
    """Execute an INSERT/UPDATE/DELETE statement."""
    con = get_connection()
    try:
        con.run(sql_query, **params)
    finally:
        con.close()

def execute_returning(sql_query: str, **params) -> dict | None:
    """Execute an INSERT/UPDATE statement with RETURNING clause."""
    con = get_connection()
    try:
        rows = con.run(sql_query, **params)
        cols = [c["name"] for c in con.columns] if con.columns else []
        return dict(zip(cols, rows[0])) if rows else None
    finally:
        con.close()
