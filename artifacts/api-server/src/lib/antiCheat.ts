import crypto from "node:crypto";

const DISCORD_EPOCH = 1420070400000n;
const UPI_SALT = process.env.UPI_SALT_SECRET || "cordchain-salt-super-secret-key-2026";

/**
 * Filter 1: Extract account creation timestamp from Discord Snowflake ID
 */
export function getSnowflakeCreationDate(snowflake: string): Date {
  try {
    const id = BigInt(snowflake);
    const timestampMs = (id >> 22n) + DISCORD_EPOCH;
    return new Date(Number(timestampMs));
  } catch {
    return new Date();
  }
}

/**
 * Filter 1: Validate account is at least 30 days old for Real Cash Dividends
 */
export function isAccountOldEnough(snowflake: string): boolean {
  const createdAt = getSnowflakeCreationDate(snowflake);
  const ageMs = Date.now() - createdAt.getTime();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  return ageMs >= thirtyDaysMs;
}

/**
 * Filter 5: Salted SHA-256 Hash of UPI VPA / phone to prevent cashout multi-accounting
 */
export function hashUpiVpa(vpa: string): string {
  const normalized = vpa.trim().toLowerCase();
  return crypto.createHmac("sha256", UPI_SALT).update(normalized).digest("hex");
}

/**
 * Helper: Mask UPI VPA for privacy display (e.g. user****@okhdfcbank)
 */
export function maskUpiVpa(vpa: string): string {
  const parts = vpa.trim().split("@");
  if (parts.length !== 2) return vpa;
  const username = parts[0];
  const domain = parts[1];
  const maskedUser = username.length > 3 ? username.slice(0, 3) + "****" : username + "****";
  return `${maskedUser}@${domain}`;
}

/**
 * Fisher-Yates array shuffle for attention check buttons
 */
export function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
