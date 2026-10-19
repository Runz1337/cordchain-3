import { Router, type IRouter } from "express";
import { db, usersTable, guildsTable, holdingsTable, tradeTransactionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

// POST /api/trade/quote - Calculates cost and price preview
router.post("/trade/quote", async (req, res) => {
  try {
    const { guildId, action, shares } = req.body;

    if (!guildId || !action || !shares || shares <= 0) {
      return res.status(400).json({ error: "guildId, action ('BUY'|'SELL'), and positive shares required" });
    }

    const guildRows = await db
      .select()
      .from(guildsTable)
      .where(eq(guildsTable.guildId, guildId))
      .limit(1);

    if (guildRows.length === 0) {
      return res.status(404).json({ error: "Guild not found" });
    }

    const guild = guildRows[0];
    const currentPrice = Number(guild.stockPrice);
    const totalCost = (currentPrice * shares).toFixed(2);

    return res.json({
      guildId: guild.guildId,
      ticker: guild.ticker,
      currentPrice: currentPrice.toFixed(2),
      shares,
      action,
      totalCred: totalCost,
      estimatedSlippagePct: 0.1,
    });
  } catch (error: any) {
    console.error("Failed to generate trade quote:", error);
    return res.status(500).json({ error: "Failed to generate quote", message: error.message });
  }
});

// POST /api/trade/buy - Executes buy order
router.post("/trade/buy", async (req, res) => {
  try {
    const { guildId, userId, shares } = req.body;

    if (!guildId || !userId || !shares || shares <= 0) {
      return res.status(400).json({ error: "guildId, userId, and positive shares are required" });
    }

    // 1. Fetch User & Guild
    const userRows = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.discordId, userId))
      .limit(1);

    const guildRows = await db
      .select()
      .from(guildsTable)
      .where(eq(guildsTable.guildId, guildId))
      .limit(1);

    if (userRows.length === 0 || guildRows.length === 0) {
      return res.status(404).json({ error: "User or Guild not found" });
    }

    const user = userRows[0];
    const guild = guildRows[0];
    const pricePerShare = Number(guild.stockPrice);
    const totalCost = pricePerShare * shares;

    // Check balance
    if (Number(user.credBalance) < totalCost) {
      return res.status(400).json({
        error: "INSUFFICIENT_FUNDS",
        message: `Insufficient $CRED balance. Required: ${totalCost.toFixed(2)} $CRED, Available: ${user.credBalance} $CRED`,
      });
    }

    const newCredBalance = (Number(user.credBalance) - totalCost).toFixed(2);

    // 2. Fetch existing holding
    const holdingRows = await db
      .select()
      .from(holdingsTable)
      .where(and(eq(holdingsTable.userId, userId), eq(holdingsTable.guildId, guildId)))
      .limit(1);

    let updatedShares = shares;
    let newAvgPrice = pricePerShare;

    if (holdingRows.length > 0) {
      const existing = holdingRows[0];
      const prevShares = existing.shares;
      const prevAvg = Number(existing.avgBuyPrice);
      updatedShares = prevShares + shares;
      newAvgPrice = (prevShares * prevAvg + shares * pricePerShare) / updatedShares;

      await db
        .update(holdingsTable)
        .set({
          shares: updatedShares,
          avgBuyPrice: newAvgPrice.toFixed(2),
          updatedAt: new Date(),
        })
        .where(and(eq(holdingsTable.userId, userId), eq(holdingsTable.guildId, guildId)));
    } else {
      await db.insert(holdingsTable).values({
        userId,
        guildId,
        shares,
        avgBuyPrice: pricePerShare.toFixed(2),
      });
    }

    // 3. Deduct CRED & update guild circulating shares
    await db
      .update(usersTable)
      .set({ credBalance: newCredBalance })
      .where(eq(usersTable.discordId, userId));

    await db
      .update(guildsTable)
      .set({ circulatingShares: guild.circulatingShares + shares })
      .where(eq(guildsTable.guildId, guildId));

    // 4. Log transaction
    const tx = await db
      .insert(tradeTransactionsTable)
      .values({
        userId,
        guildId,
        action: "BUY",
        shares,
        pricePerShare: pricePerShare.toFixed(2),
        totalCred: totalCost.toFixed(2),
      })
      .returning();

    return res.json({
      success: true,
      action: "BUY",
      ticker: guild.ticker,
      sharesBought: shares,
      pricePerShare: pricePerShare.toFixed(2),
      totalCredSpent: totalCost.toFixed(2),
      newCredBalance,
      holding: {
        shares: updatedShares,
        avgBuyPrice: newAvgPrice.toFixed(2),
      },
      transactionId: tx[0].id,
    });
  } catch (error: any) {
    console.error("Failed to execute buy order:", error);
    return res.status(500).json({ error: "Failed to execute buy order", message: error.message });
  }
});

// POST /api/trade/sell - Executes sell order
router.post("/trade/sell", async (req, res) => {
  try {
    const { guildId, userId, shares } = req.body;

    if (!guildId || !userId || !shares || shares <= 0) {
      return res.status(400).json({ error: "guildId, userId, and positive shares are required" });
    }

    // 1. Fetch User, Guild & Holding
    const userRows = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.discordId, userId))
      .limit(1);

    const guildRows = await db
      .select()
      .from(guildsTable)
      .where(eq(guildsTable.guildId, guildId))
      .limit(1);

    const holdingRows = await db
      .select()
      .from(holdingsTable)
      .where(and(eq(holdingsTable.userId, userId), eq(holdingsTable.guildId, guildId)))
      .limit(1);

    if (userRows.length === 0 || guildRows.length === 0) {
      return res.status(404).json({ error: "User or Guild not found" });
    }

    if (holdingRows.length === 0 || holdingRows[0].shares < shares) {
      const owned = holdingRows.length > 0 ? holdingRows[0].shares : 0;
      return res.status(400).json({
        error: "INSUFFICIENT_SHARES",
        message: `You do not own enough shares to sell. Requested: ${shares}, Owned: ${owned}`,
      });
    }

    const user = userRows[0];
    const guild = guildRows[0];
    const holding = holdingRows[0];
    const pricePerShare = Number(guild.stockPrice);
    const totalPayout = pricePerShare * shares;

    const newCredBalance = (Number(user.credBalance) + totalPayout).toFixed(2);
    const remainingShares = holding.shares - shares;

    // 2. Update or delete holding
    if (remainingShares === 0) {
      await db
        .delete(holdingsTable)
        .where(and(eq(holdingsTable.userId, userId), eq(holdingsTable.guildId, guildId)));
    } else {
      await db
        .update(holdingsTable)
        .set({
          shares: remainingShares,
          updatedAt: new Date(),
        })
        .where(and(eq(holdingsTable.userId, userId), eq(holdingsTable.guildId, guildId)));
    }

    // 3. Credit CRED & update circulating shares
    await db
      .update(usersTable)
      .set({ credBalance: newCredBalance })
      .where(eq(usersTable.discordId, userId));

    await db
      .update(guildsTable)
      .set({ circulatingShares: Math.max(0, guild.circulatingShares - shares) })
      .where(eq(guildsTable.guildId, guildId));

    // 4. Log transaction
    const tx = await db
      .insert(tradeTransactionsTable)
      .values({
        userId,
        guildId,
        action: "SELL",
        shares,
        pricePerShare: pricePerShare.toFixed(2),
        totalCred: totalPayout.toFixed(2),
      })
      .returning();

    return res.json({
      success: true,
      action: "SELL",
      ticker: guild.ticker,
      sharesSold: shares,
      pricePerShare: pricePerShare.toFixed(2),
      totalCredReceived: totalPayout.toFixed(2),
      newCredBalance,
      remainingShares,
      transactionId: tx[0].id,
    });
  } catch (error: any) {
    console.error("Failed to execute sell order:", error);
    return res.status(500).json({ error: "Failed to execute sell order", message: error.message });
  }
});

export default router;
