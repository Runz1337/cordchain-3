import {
  pgTable,
  varchar,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  date,
  uuid,
  serial,
  bigserial,
  bigint,
  jsonb,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

// ==========================================
// 1. GUILDS (Listed Discord Servers)
// ==========================================
export const guildsTable = pgTable("guilds", {
  guildId: varchar("guild_id", { length: 32 }).primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  ticker: varchar("ticker", { length: 10 }).unique().notNull(),
  iconUrl: text("icon_url"),
  inviteUrl: text("invite_url"),
  description: text("description"),
  category: text("category").default("Community"),
  leagueTier: integer("league_tier").notNull().default(1),
  league: varchar("league", { length: 16 }).notNull().default("Bronze"), // Bronze, Silver, Gold
  memberCountCurrent: integer("member_count_current").notNull().default(0),
  memberCountPeak7d: integer("member_count_peak_7d").notNull().default(0),
  stockPrice: numeric("stock_price", { precision: 12, scale: 2 }).notNull().default("100.00"),
  previousDayPrice: numeric("previous_day_price", { precision: 12, scale: 2 }).notNull().default("100.00"),
  circulatingShares: integer("circulating_shares").notNull().default(750000),
  fixedSupply: bigint("fixed_supply", { mode: "number" }).notNull().default(1000000),
  creatorReserveShares: bigint("creator_reserve_shares", { mode: "number" }).notNull().default(250000),
  creatorVestedShares: bigint("creator_vested_shares", { mode: "number" }).notNull().default(50000),
  creatorLockedShares: bigint("creator_locked_shares", { mode: "number" }).notNull().default(200000),
  vestingLastUnlockedAt: timestamp("vesting_last_unlocked_at", { withTimezone: true }),
  communityScore: numeric("community_score", { precision: 8, scale: 2 }).notNull().default("100.00"),
  baselineScore: numeric("baseline_score", { precision: 8, scale: 2 }).notNull().default("100.00"),
  poolShares: numeric("pool_shares").notNull().default("750000"),
  poolCred: numeric("pool_cred").notNull().default("75000000"),
  circuitBreakerUntil: timestamp("circuit_breaker_until", { withTimezone: true }),
  lastPriceTick: timestamp("last_price_tick", { withTimezone: true }),
  bumpCount: integer("bump_count").notNull().default(0),
  lastBumpedAt: timestamp("last_bumped_at", { withTimezone: true }),
  ownerId: varchar("owner_id", { length: 32 }).notNull(),
  ownerCashWalletInr: numeric("owner_cash_wallet_inr", { precision: 12, scale: 2 }).notNull().default("0.00"),
  isPromotedUntil: timestamp("is_promoted_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGuildSchema = createInsertSchema(guildsTable);
export const selectGuildSchema = createSelectSchema(guildsTable);
export type Guild = typeof guildsTable.$inferSelect;
export type InsertGuild = typeof guildsTable.$inferInsert;

// ==========================================
// 2. USERS ($CRED Fantasy Economy)
// ==========================================
export const usersTable = pgTable("users", {
  discordId: varchar("discord_id", { length: 32 }).primaryKey(),
  username: varchar("username", { length: 100 }).notNull(),
  avatar: text("avatar"),
  accountCreatedAt: timestamp("account_created_at", { withTimezone: true }),
  isDiscordVerified: boolean("is_discord_verified").notNull().default(true),
  hasNitroOrAvatar: boolean("has_nitro_or_avatar").notNull().default(false),
  credBalance: numeric("cred_balance", { precision: 14, scale: 2 }).notNull().default("1000.00"), // 1,000 CRED Starter Allowance
  lastDailyAllowanceDate: date("last_daily_allowance_date"),
  dailyEarnedCred: numeric("daily_earned_cred", { precision: 10, scale: 2 }).notNull().default("0.00"),
  lastEarnDate: date("last_earn_date"),
  cashWalletInr: numeric("cash_wallet_inr", { precision: 12, scale: 2 }).notNull().default("0.00"),
  upiHash: varchar("upi_hash", { length: 64 }),
  isVipUntil: timestamp("is_vip_until", { withTimezone: true }),
  lastPaidCheckinDate: date("last_paid_checkin_date"),
  dailyBoostCount: integer("daily_boost_count").notNull().default(0),
  lastBoostDate: date("last_boost_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable);
export const selectUserSchema = createSelectSchema(usersTable);
export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;

// ==========================================
// 3. HOLDINGS (Stock Portfolios)
// ==========================================
export const holdingsTable = pgTable(
  "holdings",
  {
    userId: varchar("user_id", { length: 32 })
      .notNull()
      .references(() => usersTable.discordId, { onDelete: "cascade" }),
    guildId: varchar("guild_id", { length: 32 })
      .notNull()
      .references(() => guildsTable.guildId, { onDelete: "cascade" }),
    shares: integer("shares").notNull().default(0),
    avgBuyPrice: numeric("avg_buy_price", { precision: 12, scale: 6 }).notNull().default("0.00"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.guildId] })]
);

export const insertHoldingSchema = createInsertSchema(holdingsTable);
export const selectHoldingSchema = createSelectSchema(holdingsTable);
export type Holding = typeof holdingsTable.$inferSelect;
export type InsertHolding = typeof holdingsTable.$inferInsert;

// ==========================================
// 4. CORD BLOCKS (1-Minute Merkle Groupings)
// ==========================================
export const cordBlocksTable = pgTable("cord_blocks", {
  height: bigint("height", { mode: "number" }).primaryKey(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  entryCount: integer("entry_count").notNull().default(0),
  startEntryIndex: bigint("start_entry_index", { mode: "number" }).notNull().default(0),
  endEntryIndex: bigint("end_entry_index", { mode: "number" }).notNull().default(0),
  merkleRoot: varchar("merkle_root", { length: 64 }).notNull(),
  prevBlockHash: varchar("prev_block_hash", { length: 64 }).notNull(),
  blockHash: varchar("block_hash", { length: 64 }).notNull().unique(),
  signature: varchar("signature", { length: 128 }).notNull(),
  signerPubkey: varchar("signer_pubkey", { length: 64 }).notNull(),
});

export const insertCordBlockSchema = createInsertSchema(cordBlocksTable);
export const selectCordBlockSchema = createSelectSchema(cordBlocksTable);
export type CordBlock = typeof cordBlocksTable.$inferSelect;
export type InsertCordBlock = typeof cordBlocksTable.$inferInsert;

// ==========================================
// 5. CORD LEDGER (Append-Only Hash-Chained Events)
// ==========================================
export const cordLedgerTable = pgTable("cord_ledger", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  entryIndex: bigint("entry_index", { mode: "number" }).notNull().unique(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  eventType: varchar("event_type", { length: 32 }).notNull(),
  guildId: varchar("guild_id", { length: 32 }).references(() => guildsTable.guildId, { onDelete: "set null" }),
  userId: varchar("user_id", { length: 32 }).references(() => usersTable.discordId, { onDelete: "set null" }),
  payload: jsonb("payload").notNull().default({}),
  prevHash: varchar("prev_hash", { length: 64 }).notNull(),
  hash: varchar("hash", { length: 64 }).notNull().unique(),
  blockHeight: bigint("block_height", { mode: "number" }).references(() => cordBlocksTable.height),
});

export const insertCordLedgerSchema = createInsertSchema(cordLedgerTable);
export const selectCordLedgerSchema = createSelectSchema(cordLedgerTable);
export type CordLedgerEntry = typeof cordLedgerTable.$inferSelect;
export type InsertCordLedgerEntry = typeof cordLedgerTable.$inferInsert;

// ==========================================
// 6. SERVER METRICS (Bot-Resistant Community Scoring)
// ==========================================
export const serverMetricsTable = pgTable("server_metrics", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  guildId: varchar("guild_id", { length: 32 }).notNull().references(() => guildsTable.guildId, { onDelete: "cascade" }),
  metricDate: date("metric_date").notNull(),
  uniqueChatters: integer("unique_chatters").notNull().default(0),
  totalMessages: integer("total_messages").notNull().default(0),
  chatterEntropy: numeric("chatter_entropy", { precision: 6, scale: 4 }).notNull().default("1.0000"),
  retentionRate: numeric("retention_rate", { precision: 6, scale: 4 }).notNull().default("1.0000"),
  voiceMinutes: integer("voice_minutes").notNull().default(0),
  accountAgeMedianDays: integer("account_age_median_days").notNull().default(180),
  growthVsBaseline: numeric("growth_vs_baseline", { precision: 6, scale: 4 }).notNull().default("1.0000"),
  communityScore: numeric("community_score", { precision: 8, scale: 2 }).notNull().default("100.00"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ==========================================
// 7. WEEKLY EARNINGS REPORTS (Fantasy Dividends)
// ==========================================
export const weeklyEarningsReportsTable = pgTable("weekly_earnings_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  guildId: varchar("guild_id", { length: 32 }).notNull().references(() => guildsTable.guildId, { onDelete: "cascade" }),
  weekNumber: integer("week_number").notNull(),
  seasonId: integer("season_id").notNull().default(1),
  communityScore: numeric("community_score", { precision: 8, scale: 2 }).notNull(),
  totalPayoutCred: numeric("total_payout_cred", { precision: 12, scale: 2 }).notNull(),
  payoutPerShare: numeric("payout_per_share", { precision: 10, scale: 6 }).notNull(),
  chatterCount: integer("chatter_count").notNull().default(0),
  retentionPct: numeric("retention_pct", { precision: 5, scale: 2 }).notNull().default("0.00"),
  distributedAt: timestamp("distributed_at", { withTimezone: true }).notNull().defaultNow(),
  ledgerHash: varchar("ledger_hash", { length: 64 }),
});

// ==========================================
// 8. SEASONS
// ==========================================
export const seasonsTable = pgTable("seasons", {
  seasonId: serial("season_id").primaryKey(),
  name: varchar("name", { length: 64 }).notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  hallOfFame: jsonb("hall_of_fame").notNull().default([]),
});

// ==========================================
// 9. SERVER RIVALRIES (Community Derbies)
// ==========================================
export const serverRivalriesTable = pgTable("server_rivalries", {
  id: uuid("id").primaryKey().defaultRandom(),
  seasonId: integer("season_id").notNull().default(1),
  guildA: varchar("guild_a", { length: 32 }).notNull().references(() => guildsTable.guildId),
  guildB: varchar("guild_b", { length: 32 }).notNull().references(() => guildsTable.guildId),
  startTime: timestamp("start_time", { withTimezone: true }).notNull().defaultNow(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  scoreA: numeric("score_a", { precision: 8, scale: 2 }).notNull().default("0.00"),
  scoreB: numeric("score_b", { precision: 8, scale: 2 }).notNull().default("0.00"),
  winnerGuildId: varchar("winner_guild_id", { length: 32 }),
  rewardCred: numeric("reward_cred", { precision: 10, scale: 2 }).notNull().default("5000.00"),
  status: varchar("status", { length: 16 }).notNull().default("ACTIVE"),
});

// ==========================================
// 10. COMMUNITY QUESTS
// ==========================================
export const communityQuestsTable = pgTable("community_quests", {
  id: uuid("id").primaryKey().defaultRandom(),
  guildId: varchar("guild_id", { length: 32 }).notNull().references(() => guildsTable.guildId, { onDelete: "cascade" }),
  title: varchar("title", { length: 128 }).notNull(),
  targetType: varchar("target_type", { length: 32 }).notNull(),
  targetValue: integer("target_value").notNull(),
  currentValue: integer("current_value").notNull().default(0),
  rewardCred: numeric("reward_cred", { precision: 10, scale: 2 }).notNull().default("1000.00"),
  isCompleted: boolean("is_completed").notNull().default(false),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

// ==========================================
// 11. PREDICTION MARKETS
// ==========================================
export const predictionMarketsTable = pgTable("prediction_markets", {
  id: uuid("id").primaryKey().defaultRandom(),
  guildId: varchar("guild_id", { length: 32 }).notNull().references(() => guildsTable.guildId, { onDelete: "cascade" }),
  question: text("question").notNull(),
  options: jsonb("options").notNull(),
  totalPoolCred: numeric("total_pool_cred", { precision: 12, scale: 2 }).notNull().default("0.00"),
  status: varchar("status", { length: 16 }).notNull().default("OPEN"),
  outcome: varchar("32", { length: 32 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvesAt: timestamp("resolves_at", { withTimezone: true }).notNull(),
});

// ==========================================
// 12. TRADE TRANSACTIONS
// ==========================================
export const tradeTransactionsTable = pgTable("trade_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 32 })
    .notNull()
    .references(() => usersTable.discordId),
  guildId: varchar("guild_id", { length: 32 })
    .notNull()
    .references(() => guildsTable.guildId),
  action: varchar("action", { length: 4 }).notNull(), // 'BUY' | 'SELL'
  shares: integer("shares").notNull(),
  pricePerShare: numeric("price_per_share", { precision: 12, scale: 6 }).notNull(),
  totalCred: numeric("total_cred", { precision: 14, scale: 2 }).notNull(),
  ledgerHash: varchar("ledger_hash", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ==========================================
// RELATIONS
// ==========================================
export const guildsRelations = relations(guildsTable, ({ many }) => ({
  holdings: many(holdingsTable),
  trades: many(tradeTransactionsTable),
  ledgerEntries: many(cordLedgerTable),
  metrics: many(serverMetricsTable),
  earningsReports: many(weeklyEarningsReportsTable),
  quests: many(communityQuestsTable),
  predictions: many(predictionMarketsTable),
}));

export const usersRelations = relations(usersTable, ({ many }) => ({
  holdings: many(holdingsTable),
  trades: many(tradeTransactionsTable),
  ledgerEntries: many(cordLedgerTable),
}));

export const holdingsRelations = relations(holdingsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [holdingsTable.userId],
    references: [usersTable.discordId],
  }),
  guild: one(guildsTable, {
    fields: [holdingsTable.guildId],
    references: [guildsTable.guildId],
  }),
}));