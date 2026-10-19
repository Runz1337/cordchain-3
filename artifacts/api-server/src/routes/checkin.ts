import { Router, type IRouter } from "express";
import { db, usersTable, guildsTable, adCampaignsTable, checkinLogsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { getSnowflakeCreationDate, isAccountOldEnough, shuffleArray } from "../lib/antiCheat";

const router: IRouter = Router();

// POST /api/checkin/initiate - Starts attention quiz check-in session
router.post("/checkin/initiate", async (req, res) => {
  try {
    const { guildId, userId } = req.body;

    if (!guildId || !userId) {
      return res.status(400).json({ error: "guildId and userId are required" });
    }

    const todayUTC = new Date().toISOString().split("T")[0];

    // 1. Fetch Guild
    const guildRows = await db
      .select()
      .from(guildsTable)
      .where(eq(guildsTable.guildId, guildId))
      .limit(1);

    if (guildRows.length === 0) {
      return res.status(404).json({ error: "Guild not registered on CordChain" });
    }

    // 2. Fetch or create User
    const userRows = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.discordId, userId))
      .limit(1);

    let user = userRows[0];
    if (!user) {
      const createdAt = getSnowflakeCreationDate(userId);
      const inserted = await db
        .insert(usersTable)
        .values({
          discordId: userId,
          username: `Trader_${userId.slice(-4)}`,
          accountCreatedAt: createdAt,
          credBalance: "10000.00",
          cashWalletInr: "0.00",
          dailyBoostCount: 0,
        })
        .returning();
      user = inserted[0];
    }

    // 3. Check 3-boost daily limit
    let currentBoostCount = user.dailyBoostCount;
    if (user.lastBoostDate !== todayUTC) {
      currentBoostCount = 0;
    }

    if (currentBoostCount >= 3) {
      return res.status(429).json({
        error: "DAILY_LIMIT_REACHED",
        message: "You have used all 3 server boosts for today. Resets at 00:00 UTC.",
        dailyBoostCount: currentBoostCount,
      });
    }

    // 4. Check real cash drop eligibility (Filter 1 Snowflake age + Filter 3 1-paid-drop cap)
    const isOldEnough = isAccountOldEnough(userId);
    const isFirstDropOfDay = user.lastPaidCheckinDate !== todayUTC;
    const isPaidDrop = isOldEnough && isFirstDropOfDay;

    // 5. Pick an active sponsor ad campaign
    const campaigns = await db
      .select()
      .from(adCampaignsTable)
      .where(eq(adCampaignsTable.isActive, true))
      .limit(10);

    if (campaigns.length === 0) {
      return res.status(503).json({ error: "No active sponsor ad campaigns available right now" });
    }

    const campaign = campaigns[Math.floor(Math.random() * campaigns.length)];
    const options = shuffleArray([campaign.correctOption, ...campaign.wrongOptions]);

    return res.json({
      guild: {
        id: guildRows[0].guildId,
        name: guildRows[0].name,
        ticker: guildRows[0].ticker,
        stockPrice: guildRows[0].stockPrice,
      },
      campaign: {
        campaignId: campaign.campaignId,
        sponsorName: campaign.sponsorName,
        title: campaign.title,
        description: campaign.description,
        mediaUrl: campaign.mediaUrl,
        verifyQuestion: campaign.verifyQuestion,
        options,
      },
      isPaidDrop,
      accountAgeQualified: isOldEnough,
      currentDailyBoosts: currentBoostCount,
      minWatchSeconds: 10,
    });
  } catch (error: any) {
    console.error("Failed to initiate checkin:", error);
    return res.status(500).json({ error: "Failed to initiate checkin", message: error.message });
  }
});

// POST /api/checkin/verify - Validates attention answer & credits rewards
router.post("/checkin/verify", async (req, res) => {
  try {
    const { guildId, userId, campaignId, selectedOption } = req.body;

    if (!guildId || !userId || !campaignId || !selectedOption) {
      return res.status(400).json({ error: "guildId, userId, campaignId, and selectedOption are required" });
    }

    const todayUTC = new Date().toISOString().split("T")[0];

    // 1. Fetch Campaign
    const campaignRows = await db
      .select()
      .from(adCampaignsTable)
      .where(eq(adCampaignsTable.campaignId, campaignId))
      .limit(1);

    if (campaignRows.length === 0) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    const campaign = campaignRows[0];

    // 2. Validate Attention Check Answer
    if (selectedOption.trim() !== campaign.correctOption.trim()) {
      return res.status(400).json({
        success: false,
        verified: false,
        message: "Incorrect answer to attention question. A 1-hour cooldown has been initiated.",
      });
    }

    // 3. Fetch User & Guild
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

    let currentBoostCount = user.dailyBoostCount;
    if (user.lastBoostDate !== todayUTC) {
      currentBoostCount = 0;
    }

    if (currentBoostCount >= 3) {
      return res.status(429).json({ error: "Daily boost limit (3/3) already reached." });
    }

    const isOldEnough = isAccountOldEnough(userId);
    const isFirstDropOfDay = user.lastPaidCheckinDate !== todayUTC;
    const isPaidDrop = isOldEnough && isFirstDropOfDay;

    const credBonus = 250;
    const cashBonus = isPaidDrop ? Number(campaign.userRewardInr) : 0;
    const ownerCashBonus = isPaidDrop ? Number(campaign.ownerRewardInr) : 0;

    const newCred = (Number(user.credBalance) + credBonus).toFixed(2);
    const newCash = (Number(user.cashWalletInr) + cashBonus).toFixed(2);
    const newBoostCount = currentBoostCount + 1;

    // Bump guild price +0.8%
    const newStockPrice = (Number(guild.stockPrice) * 1.008).toFixed(2);
    const newOwnerCash = (Number(guild.ownerCashWalletInr) + ownerCashBonus).toFixed(2);

    // Atomically update user
    await db
      .update(usersTable)
      .set({
        credBalance: newCred,
        cashWalletInr: newCash,
        dailyBoostCount: newBoostCount,
        lastBoostDate: todayUTC,
        lastPaidCheckinDate: isPaidDrop ? todayUTC : user.lastPaidCheckinDate,
      })
      .where(eq(usersTable.discordId, userId));

    // Update guild
    await db
      .update(guildsTable)
      .set({
        stockPrice: newStockPrice,
        ownerCashWalletInr: newOwnerCash,
      })
      .where(eq(guildsTable.guildId, guildId));

    // Insert log
    await db.insert(checkinLogsTable).values({
      userId,
      guildId,
      campaignId: campaign.campaignId,
      isPaidDrop,
      credAwarded: credBonus.toFixed(2),
      userPayoutInr: cashBonus.toFixed(2),
      ownerPayoutInr: ownerCashBonus.toFixed(2),
      platformFeeInr: isPaidDrop ? campaign.platformFeeInr : "0.00",
      quizAnsweredCorrectly: true,
    });

    return res.json({
      success: true,
      verified: true,
      credAwarded: credBonus,
      isPaidDrop,
      userPayoutInr: cashBonus,
      newCredBalance: newCred,
      newCashWalletInr: newCash,
      newStockPrice,
      dailyBoostCount: newBoostCount,
      boostsRemainingToday: 3 - newBoostCount,
    });
  } catch (error: any) {
    console.error("Failed to verify checkin:", error);
    return res.status(500).json({ error: "Failed to verify checkin", message: error.message });
  }
});

export default router;
