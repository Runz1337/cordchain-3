import { Router, type IRouter } from "express";
import { db, usersTable, holdingsTable, guildsTable, withdrawalsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { hashUpiVpa, maskUpiVpa, isAccountOldEnough } from "../lib/antiCheat";

const router: IRouter = Router();

// GET /api/wallet/summary - Returns full dual-wallet state and portfolio
router.get("/wallet/summary", async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "userId query parameter is required" });
    }

    const todayUTC = new Date().toISOString().split("T")[0];

    const userRows = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.discordId, userId))
      .limit(1);

    if (userRows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = userRows[0];

    // Fetch user's holdings
    const holdings = await db
      .select({
        guildId: guildsTable.guildId,
        ticker: guildsTable.ticker,
        serverName: guildsTable.name,
        shares: holdingsTable.shares,
        avgBuyPrice: holdingsTable.avgBuyPrice,
        currentPrice: guildsTable.stockPrice,
      })
      .from(holdingsTable)
      .innerJoin(guildsTable, eq(holdingsTable.guildId, guildsTable.guildId))
      .where(eq(holdingsTable.userId, userId));

    let portfolioStockValue = 0;
    const formattedHoldings = holdings
      .filter((h) => h.shares > 0)
      .map((h) => {
        const val = Number(h.currentPrice) * h.shares;
        portfolioStockValue += val;
        const profitLoss = (Number(h.currentPrice) - Number(h.avgBuyPrice)) * h.shares;
        return {
          ...h,
          totalValueCred: val.toFixed(2),
          unrealizedPnlCred: profitLoss.toFixed(2),
        };
      });

    const netWorth = Number(user.credBalance) + portfolioStockValue;
    const dailyBoostCount = user.lastBoostDate === todayUTC ? user.dailyBoostCount : 0;
    const cashWallet = Number(user.cashWalletInr);
    const minWithdrawal = 100.00;
    const canWithdraw = cashWallet >= minWithdrawal;

    return res.json({
      user: {
        discordId: user.discordId,
        username: user.username,
        avatar: user.avatar,
        isVip: user.isVipUntil ? new Date(user.isVipUntil) > new Date() : false,
      },
      wallets: {
        credBalance: Number(user.credBalance).toFixed(2),
        cashWalletInr: cashWallet.toFixed(2),
        portfolioStockValueCred: portfolioStockValue.toFixed(2),
        totalNetWorthCred: netWorth.toFixed(2),
      },
      cashout: {
        minWithdrawalThresholdInr: minWithdrawal,
        canWithdraw,
        progressPct: Math.min(100, (cashWallet / minWithdrawal) * 100).toFixed(1),
      },
      dailyStatus: {
        boostsUsedToday: dailyBoostCount,
        maxDailyBoosts: 3,
        canClaimCashDrop: user.lastPaidCheckinDate !== todayUTC && isAccountOldEnough(userId),
      },
      holdings: formattedHoldings,
    });
  } catch (error: any) {
    console.error("Failed to fetch wallet summary:", error);
    return res.status(500).json({ error: "Failed to fetch wallet summary", message: error.message });
  }
});

// POST /api/wallet/cashout - Requests instant UPI withdrawal with anti-cheat deduplication
router.post("/wallet/cashout", async (req, res) => {
  try {
    const { userId, upiVpa, amountInr } = req.body;

    if (!userId || !upiVpa || !amountInr) {
      return res.status(400).json({ error: "userId, upiVpa, and amountInr are required" });
    }

    const requestedAmount = Number(amountInr);
    if (isNaN(requestedAmount) || requestedAmount < 100.00) {
      return res.status(400).json({
        error: "MINIMUM_THRESHOLD_NOT_MET",
        message: "The minimum cashout threshold is ₹100.00 INR.",
      });
    }

    // 1. Fetch User
    const userRows = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.discordId, userId))
      .limit(1);

    if (userRows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = userRows[0];

    // Check account age (Filter 1)
    if (!isAccountOldEnough(userId)) {
      return res.status(403).json({
        error: "ACCOUNT_TOO_NEW",
        message: "Discord account must be at least 30 days old to request real cash withdrawals.",
      });
    }

    // Check balance
    if (Number(user.cashWalletInr) < requestedAmount) {
      return res.status(400).json({
        error: "INSUFFICIENT_FUNDS",
        message: `Insufficient cash balance. Available: ₹${user.cashWalletInr}, Requested: ₹${requestedAmount.toFixed(2)}`,
      });
    }

    // 2. Filter 5: UPI Hash Deduplication
    const upiHash = hashUpiVpa(upiVpa);

    // Check if this UPI is already linked to another discord account
    const existingBinding = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.upiHash, upiHash), sql`${usersTable.discordId} != ${userId}`))
      .limit(1);

    if (existingBinding.length > 0) {
      return res.status(403).json({
        error: "DUPLICATE_PAYOUT_DESTINATION",
        message: "This UPI ID is already linked to another Discord account. Each payout destination can only be linked to one unique user.",
      });
    }

    // 3. Atomically deduct cash balance & create withdrawal record
    const newCashBalance = (Number(user.cashWalletInr) - requestedAmount).toFixed(2);
    const maskedUpi = maskUpiVpa(upiVpa);

    await db
      .update(usersTable)
      .set({
        cashWalletInr: newCashBalance,
        upiHash, // Bind UPI hash to this account
      })
      .where(eq(usersTable.discordId, userId));

    const withdrawal = await db
      .insert(withdrawalsTable)
      .values({
        userId,
        amountInr: requestedAmount.toFixed(2),
        upiVpaMasked: maskedUpi,
        upiHash,
        status: "PENDING",
      })
      .returning();

    return res.json({
      success: true,
      withdrawalId: withdrawal[0].id,
      amountInr: requestedAmount.toFixed(2),
      destinationUpi: maskedUpi,
      status: "PENDING",
      message: "Withdrawal request submitted successfully. Processing via UPI payout engine.",
      newCashWalletInr: newCashBalance,
    });
  } catch (error: any) {
    console.error("Failed to process cashout:", error);
    return res.status(500).json({ error: "Failed to process cashout", message: error.message });
  }
});

export default router;
