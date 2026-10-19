import { Router, type IRouter } from "express";
import { db, guildsTable } from "@workspace/db";
import { eq, desc, asc, sql, and, gte, ilike } from "drizzle-orm";

const router: IRouter = Router();

// GET /api/guilds - List listed servers on the exchange
router.get("/guilds", async (req, res) => {
  try {
    const { tier, sort, search } = req.query;

    let query = db.select().from(guildsTable);
    const conditions = [];

    if (tier && !isNaN(Number(tier))) {
      conditions.push(eq(guildsTable.leagueTier, Number(tier)));
    }

    if (search && typeof search === "string" && search.trim().length > 0) {
      conditions.push(
        sql`(${guildsTable.name} ILIKE ${`%${search.trim()}%`} OR ${guildsTable.ticker} ILIKE ${`%${search.trim()}%`})`
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    let order = desc(guildsTable.stockPrice);
    if (sort === "gain") {
      order = desc(sql`(${guildsTable.stockPrice} - ${guildsTable.previousDayPrice}) / NULLIF(${guildsTable.previousDayPrice}, 0)`);
    } else if (sort === "activity") {
      order = desc(guildsTable.memberCountCurrent);
    }

    const rows = whereClause
      ? await query.where(whereClause).orderBy(order).limit(50)
      : await query.orderBy(order).limit(50);

    const mapped = rows.map((g) => {
      const cur = Number(g.stockPrice);
      const prev = Number(g.previousDayPrice);
      const changePct = prev > 0 ? (((cur - prev) / prev) * 100).toFixed(2) : "0.00";
      return {
        ...g,
        changePct: Number(changePct),
        isGain: Number(changePct) >= 0,
      };
    });

    return res.json({ guilds: mapped });
  } catch (error: any) {
    console.error("Failed to list guilds:", error);
    return res.status(500).json({ error: "Failed to list guilds", message: error.message });
  }
});

// GET /api/guilds/featured - Promoted IPO servers
router.get("/guilds/featured", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(guildsTable)
      .where(gte(guildsTable.isPromotedUntil, new Date()))
      .limit(6);

    const mapped = rows.map((g) => {
      const cur = Number(g.stockPrice);
      const prev = Number(g.previousDayPrice);
      const changePct = prev > 0 ? (((cur - prev) / prev) * 100).toFixed(2) : "0.00";
      return {
        ...g,
        changePct: Number(changePct),
        isGain: Number(changePct) >= 0,
      };
    });

    return res.json({ featured: mapped });
  } catch (error: any) {
    console.error("Failed to fetch featured IPO guilds:", error);
    return res.status(500).json({ error: "Failed to fetch featured guilds", message: error.message });
  }
});

// GET /api/guilds/:id - Detailed server view
router.get("/guilds/:id", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(guildsTable)
      .where(eq(guildsTable.guildId, req.params.id))
      .limit(1);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Guild not found" });
    }

    const g = rows[0];
    const cur = Number(g.stockPrice);
    const prev = Number(g.previousDayPrice);
    const changePct = prev > 0 ? (((cur - prev) / prev) * 100).toFixed(2) : "0.00";

    return res.json({
      guild: {
        ...g,
        changePct: Number(changePct),
        isGain: Number(changePct) >= 0,
      },
    });
  } catch (error: any) {
    console.error("Failed to fetch guild:", error);
    return res.status(500).json({ error: "Failed to fetch guild", message: error.message });
  }
});

export default router;
