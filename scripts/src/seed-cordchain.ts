import { db, guildsTable, adCampaignsTable, usersTable } from "@workspace/db";

async function main() {
  console.log("🌱 Seeding CordChain database with initial leagues, servers, and ad campaigns...");

  // 1. Seed Guilds across all 4 Leagues
  const guilds = [
    // Tier 1 — Squad League (15 to 150 members)
    {
      guildId: "111100000000000001",
      name: "Squad Alpha",
      ticker: "$SQUAD",
      leagueTier: 1,
      memberCountCurrent: 45,
      memberCountPeak7d: 48,
      stockPrice: "114.50",
      previousDayPrice: "108.00",
      circulatingShares: 1250,
      ownerId: "999000000000000001",
      ownerCashWalletInr: "28.00",
      iconUrl: "https://cdn.discordapp.com/embed/avatars/0.png",
    },
    {
      guildId: "111100000000000002",
      name: "Dev Collective",
      ticker: "$DEV",
      leagueTier: 1,
      memberCountCurrent: 92,
      memberCountPeak7d: 95,
      stockPrice: "128.20",
      previousDayPrice: "120.00",
      circulatingShares: 2100,
      ownerId: "999000000000000002",
      ownerCashWalletInr: "54.00",
      iconUrl: "https://cdn.discordapp.com/embed/avatars/1.png",
    },
    {
      guildId: "111100000000000003",
      name: "Pixel Crafters",
      ticker: "$PIXEL",
      leagueTier: 1,
      memberCountCurrent: 78,
      memberCountPeak7d: 80,
      stockPrice: "98.40",
      previousDayPrice: "102.00",
      circulatingShares: 980,
      ownerId: "999000000000000003",
      ownerCashWalletInr: "19.00",
      iconUrl: "https://cdn.discordapp.com/embed/avatars/2.png",
    },

    // Tier 2 — Club League (151 to 1,000 members)
    {
      guildId: "222200000000000001",
      name: "Code & Coffee",
      ticker: "$CODE",
      leagueTier: 2,
      memberCountCurrent: 420,
      memberCountPeak7d: 435,
      stockPrice: "162.80",
      previousDayPrice: "154.00",
      circulatingShares: 5400,
      ownerId: "999000000000000004",
      ownerCashWalletInr: "185.00",
      iconUrl: "https://cdn.discordapp.com/embed/avatars/3.png",
      isPromotedUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Featured IPO
    },
    {
      guildId: "222200000000000002",
      name: "Chill Lounge",
      ticker: "$CHILL",
      leagueTier: 2,
      memberCountCurrent: 680,
      memberCountPeak7d: 710,
      stockPrice: "145.00",
      previousDayPrice: "148.50",
      circulatingShares: 4300,
      ownerId: "999000000000000005",
      ownerCashWalletInr: "142.00",
      iconUrl: "https://cdn.discordapp.com/embed/avatars/4.png",
    },
    {
      guildId: "222200000000000003",
      name: "Builders Club",
      ticker: "$BUILD",
      leagueTier: 2,
      memberCountCurrent: 310,
      memberCountPeak7d: 315,
      stockPrice: "135.50",
      previousDayPrice: "131.00",
      circulatingShares: 3200,
      ownerId: "999000000000000006",
      ownerCashWalletInr: "96.00",
      iconUrl: "https://cdn.discordapp.com/embed/avatars/0.png",
    },

    // Tier 3 — Arena League (1,001 to 10,000 members)
    {
      guildId: "333300000000000001",
      name: "Arena Esports",
      ticker: "$ARENA",
      leagueTier: 3,
      memberCountCurrent: 3400,
      memberCountPeak7d: 3500,
      stockPrice: "245.00",
      previousDayPrice: "238.00",
      circulatingShares: 18400,
      ownerId: "999000000000000007",
      ownerCashWalletInr: "420.00",
      iconUrl: "https://cdn.discordapp.com/embed/avatars/1.png",
      isPromotedUntil: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    },
    {
      guildId: "333300000000000002",
      name: "Clan Warzone",
      ticker: "$CLAN",
      leagueTier: 3,
      memberCountCurrent: 5200,
      memberCountPeak7d: 5320,
      stockPrice: "210.50",
      previousDayPrice: "215.00",
      circulatingShares: 14200,
      ownerId: "999000000000000008",
      ownerCashWalletInr: "380.00",
      iconUrl: "https://cdn.discordapp.com/embed/avatars/2.png",
    },

    // Tier 4 — Titan League (10,001+ members)
    {
      guildId: "444400000000000001",
      name: "Titan Megahub",
      ticker: "$TITAN",
      leagueTier: 4,
      memberCountCurrent: 28500,
      memberCountPeak7d: 29000,
      stockPrice: "520.00",
      previousDayPrice: "498.00",
      circulatingShares: 65000,
      ownerId: "999000000000000009",
      ownerCashWalletInr: "1250.00",
      iconUrl: "https://cdn.discordapp.com/embed/avatars/3.png",
      isPromotedUntil: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    },
  ];

  for (const guild of guilds) {
    await db
      .insert(guildsTable)
      .values(guild)
      .onConflictDoUpdate({
        target: guildsTable.guildId,
        set: {
          stockPrice: guild.stockPrice,
          memberCountCurrent: guild.memberCountCurrent,
          memberCountPeak7d: guild.memberCountPeak7d,
          leagueTier: guild.leagueTier,
          isPromotedUntil: guild.isPromotedUntil,
        },
      });
  }
  console.log(`✅ Seeded ${guilds.length} guilds across all 4 league tiers.`);

  // 2. Seed Sponsor Ad Campaigns
  const campaigns = [
    {
      sponsorName: "Vortex Gaming Gear",
      title: "Vortex Pro Wireless Headset 2.0",
      description: "Experience spatial 7.1 surround sound with zero latency wireless transmission.",
      mediaUrl: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&auto=format&fit=crop&q=60",
      verifyQuestion: "What type of wireless audio transmission does Vortex Pro feature?",
      correctOption: "Ultra-low latency 7.1 spatial",
      wrongOptions: ["Bluetooth 1.0 mono", "Wired-only audio jack"],
      cpiRateInr: "6.00",
      userRewardInr: "3.50",
      ownerRewardInr: "1.00",
      platformFeeInr: "1.50",
      remainingBudgetInr: "3000.00",
      targetCategory: "gaming",
      isActive: true,
    },
    {
      sponsorName: "CloudCode IDE",
      title: "Deploy Fullstack Apps in 10 Seconds",
      description: "The AI-native cloud workspace that builds, scales, and tests your Discord bots automatically.",
      mediaUrl: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=60",
      verifyQuestion: "How fast can you deploy fullstack apps with CloudCode?",
      correctOption: "10 Seconds",
      wrongOptions: ["24 Hours", "3 Business Days"],
      cpiRateInr: "6.00",
      userRewardInr: "3.50",
      ownerRewardInr: "1.00",
      platformFeeInr: "1.50",
      remainingBudgetInr: "2500.00",
      targetCategory: "coding",
      isActive: true,
    },
    {
      sponsorName: "Neon Energy Drink",
      title: "Neon Surge - Zero Sugar Brain Fuel",
      description: "Infused with nootropics, B-vitamins, and organic green tea extract for all-night gaming sessions.",
      mediaUrl: "https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=800&auto=format&fit=crop&q=60",
      verifyQuestion: "What key ingredient powers Neon Surge for sustained focus?",
      correctOption: "Organic green tea extract & nootropics",
      wrongOptions: ["Refined high fructose syrup", "Artificial coloring"],
      cpiRateInr: "6.00",
      userRewardInr: "3.50",
      ownerRewardInr: "1.00",
      platformFeeInr: "1.50",
      remainingBudgetInr: "1800.00",
      targetCategory: "all",
      isActive: true,
    },
  ];

  for (const c of campaigns) {
    await db.insert(adCampaignsTable).values(c);
  }
  console.log(`✅ Seeded ${campaigns.length} sponsor ad campaigns.`);

  // 3. Seed Demo / Test User
  const demoUser = {
    discordId: "123456789012345678",
    username: "CordTrader",
    avatar: "https://cdn.discordapp.com/embed/avatars/0.png",
    accountCreatedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days old (passes 30d snowflake gate)
    isDiscordVerified: true,
    hasNitroOrAvatar: true,
    credBalance: "12450.00",
    cashWalletInr: "42.50",
    dailyBoostCount: 1,
    lastBoostDate: new Date().toISOString().split("T")[0],
  };

  await db
    .insert(usersTable)
    .values(demoUser)
    .onConflictDoUpdate({
      target: usersTable.discordId,
      set: {
        username: demoUser.username,
        credBalance: demoUser.credBalance,
        cashWalletInr: demoUser.cashWalletInr,
      },
    });

  console.log(`✅ Seeded demo user (${demoUser.username}).`);
  console.log("🎉 Seeding complete!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
