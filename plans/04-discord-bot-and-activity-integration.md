# Subplan 04: Discord Bot Client & Activity SDK Launching

> **Phase 4 Execution Plan**
> Target Package: [`artifacts/discord-bot`](file:///home/runner/workspace/artifacts/discord-bot) or [`lib/discord-bot`](file:///home/runner/workspace/lib/discord-bot)
> Status: Ready for Execution

---

## 1. Objectives

1. Build a lightweight, reliable Discord Bot using `discord.js` v14 to handle server onboarding, real non-bot member counting, and user interactions.
2. Provide slash commands (`/register-server`, `/boost`, `/stats`, `/portfolio`, `/leaderboard`).
3. Deploy the automated daily **"⚡ Boost Server Stock"** interactive rich embed in Discord channels.
4. Integrate seamlessly with the Discord Embedded App SDK activity launcher.

---

## 2. Bot Architecture & Permissions

### Discord Developer Portal Requirements
- **Bot Privileges:**
  - `Server Members Intent` enabled (mandatory for accurate non-bot counting: `member.user.bot === false`).
- **Scopes:**
  - `bot`, `applications.commands`, `embedded` (for Embedded App SDK Activity).
- **Permissions:**
  - `Send Messages`, `Embed Links`, `Use External Emojis`, `Create Instant Invite`.

---

## 3. Slash Commands Implementation

### 1. `/register-server` (Admin Only)
- **Role:** Registers the Discord server on the CordChain Exchange.
- **Workflow:**
  1. Verifies caller has `Administrator` or `ManageGuild` permission.
  2. Scans human member count:
     ```typescript
     const humanCount = guild.members.cache.filter(m => !m.user.bot).size;
     ```
  3. Checks minimum requirement ($\ge 15$ humans). If fewer, notifies owner with friendly guidance.
  4. Automatically determines League Tier:
     - 15–150 $\to$ **Tier 1 (Squad League)**
     - 151–1,000 $\to$ **Tier 2 (Club League)**
     - 1,001–10,000 $\to$ **Tier 3 (Arena League)**
     - 10,001+ $\to$ **Tier 4 (Titan League)**
  5. Generates or accepts custom ticker symbol (e.g. `$DEV`, `$SQUAD`).
  6. Creates guild record in CordChain backend with initial price of 100.00 `$CRED`.
  7. Responds with celebratory embed containing ticker badge and Embedded App launch button.

### 2. `/boost` (All Members)
- **Role:** Provides direct launch button to boost the server's stock in the Embedded App.
- **Response:**
  - Rich Embed showing current stock price, 24h change, and daily check-in status.
  - Action row with glowing button: `"⚡ Boost $TICKER & Claim Dividend"` (launching the Discord Activity).

### 3. `/stats` (All Members)
- **Role:** Displays live ticker information, current stock price, circulating shares, 7-day peak member count, and daily activity score.

### 4. `/portfolio` (All Members)
- **Role:** Shows the invoking user's fantasy stock portfolio, net worth, and season rank without opening the iframe.

### 5. `/leaderboard` (All Members)
- **Role:** Shows top 10 performing server stocks in the server's specific league bracket.

---

## 4. Automated Daily Boost Channel Embed

- **Scheduled Trigger:** Configurable daily post (e.g. 09:00 local server time or 00:00 UTC).
- **Embed Content:**
  - **Banner:** High-energy CordChain graphic.
  - **Title:** `⚡ CordChain Daily Boost Window is Open!`
  - **Description:**
    > Boost **$TICKER** today to pump our stock price against other league rivals!
    > • First check-in awards **+250 $CRED** + **Real Cash Dividend (₹)**!
    > • 15-second sponsor interaction.
  - **Component Button:**
    - Label: `⚡ Open Trading Terminal`
    - Style: `Primary` or Activity Launch action.

---

## 5. Member Sync & Anti-Ghost-Kick Hook

- **Event:** `guildMemberAdd` / `guildMemberRemove`
  - Updates in-memory guild human count.
  - If new count exceeds `member_count_peak_7d`, updates database high-water mark immediately.
  - If members are kicked, `member_count_peak_7d` is strictly preserved for at least 7 days.

---

## 6. Acceptance Criteria
- [ ] Bot connects and registers slash commands via Discord REST API.
- [ ] `/register-server` correctly categorizes servers into the 4 league brackets.
- [ ] Member count strictly ignores bots (`member.user.bot === true`).
- [ ] Daily embed displays interactive activity launch button.
