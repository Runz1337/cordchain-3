import { Router, type IRouter } from "express";
import { db, adCampaignsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

// GET /api/campaigns - List active sponsor ad campaigns
router.get("/campaigns", async (req, res) => {
  try {
    const campaigns = await db
      .select({
        campaignId: adCampaignsTable.campaignId,
        sponsorName: adCampaignsTable.sponsorName,
        title: adCampaignsTable.title,
        description: adCampaignsTable.description,
        mediaUrl: adCampaignsTable.mediaUrl,
        cpiRateInr: adCampaignsTable.cpiRateInr,
        userRewardInr: adCampaignsTable.userRewardInr,
        remainingBudgetInr: adCampaignsTable.remainingBudgetInr,
        targetCategory: adCampaignsTable.targetCategory,
      })
      .from(adCampaignsTable)
      .where(eq(adCampaignsTable.isActive, true))
      .orderBy(desc(adCampaignsTable.createdAt));

    return res.json({ campaigns });
  } catch (error: any) {
    console.error("Failed to list campaigns:", error);
    return res.status(500).json({ error: "Failed to list campaigns", message: error.message });
  }
});

// POST /api/campaigns/create - Self-serve sponsor campaign deposit MVP
router.post("/campaigns/create", async (req, res) => {
  try {
    const {
      sponsorName,
      title,
      description,
      mediaUrl,
      verifyQuestion,
      correctOption,
      wrongOptions,
      budgetInr,
      targetCategory,
    } = req.body;

    if (
      !sponsorName ||
      !title ||
      !description ||
      !mediaUrl ||
      !verifyQuestion ||
      !correctOption ||
      !wrongOptions ||
      !budgetInr
    ) {
      return res.status(400).json({ error: "Missing required campaign fields" });
    }

    const budget = Number(budgetInr);
    if (isNaN(budget) || budget < 500) {
      return res.status(400).json({ error: "Minimum campaign deposit is ₹500.00 INR" });
    }

    const created = await db
      .insert(adCampaignsTable)
      .values({
        sponsorName,
        title,
        description,
        mediaUrl,
        verifyQuestion,
        correctOption,
        wrongOptions: Array.isArray(wrongOptions) ? wrongOptions : [wrongOptions],
        cpiRateInr: "6.00",
        userRewardInr: "3.50",
        ownerRewardInr: "1.00",
        platformFeeInr: "1.50",
        remainingBudgetInr: budget.toFixed(2),
        targetCategory: targetCategory || "all",
        isActive: true,
      })
      .returning();

    return res.json({
      success: true,
      campaign: created[0],
      message: "Campaign created and active in the CordChain sponsor network!",
    });
  } catch (error: any) {
    console.error("Failed to create campaign:", error);
    return res.status(500).json({ error: "Failed to create campaign", message: error.message });
  }
});

export default router;
