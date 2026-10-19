import json
from datetime import datetime, timezone, timedelta
from cordchain.db import execute, query_one

def seed():
    print("🌱 [Python] Seeding CordChain database - no dummy guilds seeded.")


    # Campaigns
    c_count = query_one("SELECT COUNT(*) as cnt FROM ad_campaigns")
    if not c_count or c_count["cnt"] == 0:
        campaigns = [
            {
                "sponsor": "Vortex Gaming Gear",
                "title": "Vortex Pro Wireless Headset 2.0",
                "desc": "Experience spatial 7.1 surround sound with zero latency wireless transmission.",
                "media": "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&auto=format&fit=crop&q=60",
                "q": "What type of wireless audio transmission does Vortex Pro feature?",
                "correct": "Ultra-low latency 7.1 spatial",
                "wrongs": json.dumps(["Bluetooth 1.0 mono", "Wired-only audio jack"]),
                "cpi": 6.00, "user_r": 3.50, "owner_r": 1.00, "plat_f": 1.50, "budget": 3000.00, "cat": "gaming"
            },
            {
                "sponsor": "CloudCode IDE",
                "title": "Deploy Fullstack Apps in 10 Seconds",
                "desc": "The AI-native cloud workspace that builds, scales, and tests your Discord bots automatically.",
                "media": "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=60",
                "q": "How fast can you deploy fullstack apps with CloudCode?",
                "correct": "10 Seconds",
                "wrongs": json.dumps(["24 Hours", "3 Business Days"]),
                "cpi": 6.00, "user_r": 3.50, "owner_r": 1.00, "plat_f": 1.50, "budget": 2500.00, "cat": "coding"
            },
            {
                "sponsor": "Neon Energy Drink",
                "title": "Neon Surge - Zero Sugar Brain Fuel",
                "desc": "Infused with nootropics, B-vitamins, and organic green tea extract for all-night gaming sessions.",
                "media": "https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=800&auto=format&fit=crop&q=60",
                "q": "What key ingredient powers Neon Surge for sustained focus?",
                "correct": "Organic green tea extract & nootropics",
                "wrongs": json.dumps(["Refined high fructose syrup", "Artificial coloring"]),
                "cpi": 6.00, "user_r": 3.50, "owner_r": 1.00, "plat_f": 1.50, "budget": 1800.00, "cat": "all"
            },
        ]
        for c in campaigns:
            execute("""
                INSERT INTO ad_campaigns (
                    sponsor_name, title, description, media_url,
                    verify_question, correct_option, wrong_options,
                    cpi_rate_inr, user_reward_inr, owner_reward_inr,
                    platform_fee_inr, remaining_budget_inr, target_category
                ) VALUES (:sponsor, :title, :desc, :media, :q, :correct, :wrongs, :cpi, :user_r, :owner_r, :plat_f, :budget, :cat)
            """, **c)
        print("✅ [Python] Seeded 3 sponsor ad campaigns.")

    print("🎉 [Python] Database seeding complete (no dummy users or dummy tokens).")

if __name__ == "__main__":
    seed()
