import os
import asyncpg
import logging

logger = logging.getLogger("CordChain.Database")

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL must be set.")

class DatabasePool:
    def __init__(self):
        self.pool: asyncpg.Pool | None = None

    async def connect(self):
        if not self.pool:
            logger.info("⚡ [DatabasePool] Initializing asyncpg connection pool (5-20 connections)...")
            self.pool = await asyncpg.create_pool(
                dsn=DATABASE_URL,
                min_size=5,
                max_size=20,
                command_timeout=60,
            )
            logger.info("✅ [DatabasePool] Asyncpg pool initialized successfully.")

    async def close(self):
        if self.pool:
            await self.pool.close()
            logger.info("🔒 [DatabasePool] Asyncpg pool closed.")

    async def fetch(self, query: str, *args):
        assert self.pool is not None, "Database pool not connected"
        async with self.pool.acquire() as conn:
            return await conn.fetch(query, *args)

    async def fetchrow(self, query: str, *args):
        assert self.pool is not None, "Database pool not connected"
        async with self.pool.acquire() as conn:
            return await conn.fetchrow(query, *args)

    async def fetchval(self, query: str, *args):
        assert self.pool is not None, "Database pool not connected"
        async with self.pool.acquire() as conn:
            return await conn.fetchval(query, *args)

    async def execute(self, query: str, *args):
        assert self.pool is not None, "Database pool not connected"
        async with self.pool.acquire() as conn:
            return await conn.execute(query, *args)

    def acquire(self):
        assert self.pool is not None, "Database pool not connected"
        return self.pool.acquire()

db_pool = DatabasePool()
