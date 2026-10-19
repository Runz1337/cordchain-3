export interface ProjectChannel {
  name: string;
  desc: string;
}

export interface ProjectTeamMember {
  role: string;
  name: string;
}

export interface ProjectRoadmapItem {
  quarter: string;
  title: string;
  status: 'completed' | 'in-progress' | 'planned';
}

export interface ProjectResearchData {
  guildId: string;
  ticker: string;
  name: string;
  league: 'Titan' | 'Arena' | 'Club' | 'Squad';
  category: string;
  tagline: string;
  overview: string;
  contractAddress: string;
  tokenExplorerUrl: string;
  ammRouterAddress: string;
  dividendYield: string;
  dividendPayoutFreq: string;
  circulatingSupply: string;
  maxSupply: string;
  marketCapUsd: string;
  members: string;
  peak7d: string;
  activeVoiceLounges: number;
  dailyMessages: string;
  boostTier: string;
  boostPower: number;
  keyChannels: ProjectChannel[];
  governance: string;
  team: ProjectTeamMember[];
  roadmap: ProjectRoadmapItem[];
}

export const PROJECTS_RESEARCH: Record<string, ProjectResearchData> = {
  $SQUAD: {
    guildId: '111100000000000001',
    ticker: '$SQUAD',
    name: 'Squad Alpha',
    league: 'Squad',
    category: 'Competitive Gaming Clan & Creator Hub',
    tagline: 'Top-ranked tactical squad organizing daily scrims, customs, and clip bounties.',
    overview:
      'Squad Alpha is a high-skill tactical gaming organization and streaming syndicate founded in 2024. Featuring elite rosters across Valorant, Apex, and Call of Duty, Squad Alpha hosts weekly custom tournaments, clip review stages, and high-energy creator watch parties. $SQUAD token holders receive proportional shares of server ad revenue rewards and voting rights on future tournament prize pools.',
    contractAddress: '0xc16813462483E8691a87D50B788386D8eF179a65',
    tokenExplorerUrl: '/scan?address=0xc16813462483E8691a87D50B788386D8eF179a65',
    ammRouterAddress: '0x074802DE766bF300C2e7A333B1cbf756C76E3F53',
    dividendYield: '4.8% APY',
    dividendPayoutFreq: 'Daily at 00:00 UTC',
    circulatingSupply: '1,250 SQUAD',
    maxSupply: '100,000 SQUAD',
    marketCapUsd: '$144.2K',
    members: '45 humans',
    peak7d: '48 members',
    activeVoiceLounges: 6,
    dailyMessages: '1,840 msgs/day',
    boostTier: 'Level 2 (8 Server Boosts)',
    boostPower: 88,
    keyChannels: [
      { name: '#alpha-announcements', desc: 'Tournament schedules, scrim rosters, and guild updates' },
      { name: '#competitive-scrims', desc: 'Daily 5v5 customs, ranked LFGs, and lobby codes' },
      { name: '#clip-bounties', desc: 'Weekly video submissions and top highlight voting' },
      { name: '#creator-lounge', desc: 'Private stage for guild streamers, casters, and patrons' },
    ],
    governance: '1 $SQUAD = 1 vote on tournament rule sets, prize allocation, and bot features.',
    team: [
      { role: 'Guild Founder & Head of Operations', name: 'Ayush (AyushR)' },
      { role: 'Esports Director', name: 'PhantomRider' },
      { role: 'Lead Bot Architect', name: '0xKrypton' },
    ],
    roadmap: [
      { quarter: 'Q1 2026', title: 'CordLedger Cryptographic Token Launch', status: 'completed' },
      { quarter: 'Q2 2026', title: 'Automated Discord Scrim Bot & Leaderboard', status: 'completed' },
      { quarter: 'Q3 2026', title: 'Cross-Guild League Championship ($10K Prize Pool)', status: 'in-progress' },
      { quarter: 'Q4 2026', title: 'DAO-governed Creator Grant Fund', status: 'planned' },
    ],
  },

  $DEV: {
    guildId: '111100000000000002',
    ticker: '$DEV',
    name: 'Dev Collective',
    league: 'Squad',
    category: 'Fullstack Open Source & AI Builders',
    tagline: 'Engineering guild building decentralized AI agents, Discord bots, and Web3 apps.',
    overview:
      'Dev Collective is an engineering collective uniting full-stack developers, AI practitioners, Rust systems programmers, and smart contract auditors. Guild members ship open-source libraries, conduct rigorous architecture peer reviews, and participate in weekend mini-hackathons. Backers of $DEV earn dividends generated from community sponsor campaigns and SaaS bot subscriptions.',
    contractAddress: '0x0aB145Aff9299eB1766234989F1fA5Fd614B8D05',
    tokenExplorerUrl: '/scan?address=0x0aB145Aff9299eB1766234989F1fA5Fd614B8D05',
    ammRouterAddress: '0x074802DE766bF300C2e7A333B1cbf756C76E3F53',
    dividendYield: '5.4% APY',
    dividendPayoutFreq: 'Daily at 00:00 UTC',
    circulatingSupply: '2,100 DEV',
    maxSupply: '250,000 DEV',
    marketCapUsd: '$269.2K',
    members: '92 humans',
    peak7d: '95 members',
    activeVoiceLounges: 8,
    dailyMessages: '3,250 msgs/day',
    boostTier: 'Level 2 (11 Server Boosts)',
    boostPower: 92,
    keyChannels: [
      { name: '#architecture-reviews', desc: 'System design, database schemas, and RFC proposals' },
      { name: '#hackathon-war-room', desc: 'Sprint channels for weekend builds and submissions' },
      { name: '#ai-agent-lab', desc: 'LLM agents, fine-tuning scripts, and automation tools' },
      { name: '#job-board-verified', desc: 'Remote Web3 & fullstack engineering opportunities' },
    ],
    governance: 'Token-weighted voting for hackathon bounties and open-source grant disbursement.',
    team: [
      { role: 'Lead Architect', name: 'CipherDev' },
      { role: 'AI Research Lead', name: 'NeuralNomad' },
      { role: 'Security Auditor', name: '0xZeroDay' },
    ],
    roadmap: [
      { quarter: 'Q1 2026', title: 'CordLedger Verification & Merkle Audit', status: 'completed' },
      { quarter: 'Q2 2026', title: 'Open-Source Dev Bot SDK Release', status: 'completed' },
      { quarter: 'Q3 2026', title: 'AI Code Review Agent Discord Integration', status: 'in-progress' },
      { quarter: 'Q4 2026', title: 'Decentralized Package Registry Beta', status: 'planned' },
    ],
  },

  $PIXEL: {
    guildId: '111100000000000003',
    ticker: '$PIXEL',
    name: 'Pixel Crafters',
    league: 'Squad',
    category: 'Digital Art, 3D Shaders & Indie Game Assets',
    tagline: 'Vibrant artist collective sharing daily 3D renders, shaders, and game sprites.',
    overview:
      'Pixel Crafters is an international guild of digital painters, 3D Blender sculptors, technical shader wizards, and indie game asset creators. Members host weekly 3D sculpting challenges, live drawing streams, and art critique roundtables. $PIXEL holders gain access to high-res asset drops and weekly royalty dividends from community art packs.',
    contractAddress: '0x03A8C556492650332040A20a32b07579597A33aA',
    tokenExplorerUrl: '/scan?address=0x03A8C556492650332040A20a32b07579597A33aA',
    ammRouterAddress: '0x074802DE766bF300C2e7A333B1cbf756C76E3F53',
    dividendYield: '4.2% APY',
    dividendPayoutFreq: 'Daily at 00:00 UTC',
    circulatingSupply: '980 PIXEL',
    maxSupply: '150,000 PIXEL',
    marketCapUsd: '$96.4K',
    members: '78 humans',
    peak7d: '80 members',
    activeVoiceLounges: 4,
    dailyMessages: '1,420 msgs/day',
    boostTier: 'Level 1 (5 Server Boosts)',
    boostPower: 76,
    keyChannels: [
      { name: '#daily-art-prompts', desc: '24-hour visual themes and creative warmups' },
      { name: '#blender-and-shaders', desc: 'Nodes, procedural textures, and geometry lab' },
      { name: '#commissions-verified', desc: 'Direct client inquiries for verified guild artists' },
      { name: '#feedback-critique', desc: 'Constructive composition, lighting, and anatomy advice' },
    ],
    governance: 'Community curation voting for feature showcases and monthly asset store bundles.',
    team: [
      { role: 'Art Director', name: 'VoxelQueen' },
      { role: 'Shader Technical Artist', name: 'GlitchFrame' },
      { role: 'Community Host', name: 'ChromaArt' },
    ],
    roadmap: [
      { quarter: 'Q1 2026', title: 'On-Chain Royalty Contract Deployment', status: 'completed' },
      { quarter: 'Q2 2026', title: 'Curated 3D Asset Pack V1 Drop', status: 'completed' },
      { quarter: 'Q3 2026', title: 'Guild Virtual Art Gallery on Base', status: 'in-progress' },
      { quarter: 'Q4 2026', title: 'Asset Licensing Marketplace Launch', status: 'planned' },
    ],
  },

  $CODE: {
    guildId: '222200000000000001',
    ticker: '$CODE',
    name: 'Code & Coffee',
    league: 'Club',
    category: 'Virtual Study Hall & FAANG Career Accelerator',
    tagline: '24/7 lo-fi study lounges, live pair programming, and FAANG technical mock interviews.',
    overview:
      'Code & Coffee is one of Discord’s premier developer sanctuaries, hosting continuous 24/7 Pomodoro study rooms, algorithmic whiteboarding workshops, and mock interview coaching sessions. With over 420 active computer science students and senior software engineers, $CODE backs a community-owned education and job-referral ecosystem with continuous sponsor ad rewards.',
    contractAddress: '0x218999a67db0727ecAaa2ffdb9d8073F79cfB988',
    tokenExplorerUrl: '/scan?address=0x218999a67db0727ecAaa2ffdb9d8073F79cfB988',
    ammRouterAddress: '0x074802DE766bF300C2e7A333B1cbf756C76E3F53',
    dividendYield: '6.1% APY',
    dividendPayoutFreq: 'Daily at 00:00 UTC',
    circulatingSupply: '5,400 CODE',
    maxSupply: '500,000 CODE',
    marketCapUsd: '$879.1K',
    members: '420 humans',
    peak7d: '435 members',
    activeVoiceLounges: 14,
    dailyMessages: '7,890 msgs/day',
    boostTier: 'Level 2 (14 Server Boosts)',
    boostPower: 94,
    keyChannels: [
      { name: '#study-hall-24-7', desc: 'Lo-fi bot rooms with camera/screen share study timers' },
      { name: '#leetcode-daily', desc: 'Daily algorithmic problem breakdown and solutions' },
      { name: '#faang-mock-interviews', desc: 'Peer behavioral and technical systems interview practice' },
      { name: '#career-referrals', desc: 'Direct employee referrals at top tech startups' },
    ],
    governance: 'Voting on workshop curriculum, speaker series, and verified bot extensions.',
    team: [
      { role: 'Community Lead', name: 'DevBrew' },
      { role: 'Lead Mentor', name: 'AlgoSage' },
      { role: 'Event Coordinator', name: 'LatteByte' },
    ],
    roadmap: [
      { quarter: 'Q1 2026', title: 'CordLedger AMM Token Integration', status: 'completed' },
      { quarter: 'Q2 2026', title: 'Automated LeetCode Discord Leaderboard', status: 'completed' },
      { quarter: 'Q3 2026', title: 'Exclusive Mentorship Guild Pass', status: 'in-progress' },
      { quarter: 'Q4 2026', title: 'Global Virtual Career Fair 2026', status: 'planned' },
    ],
  },

  $CHILL: {
    guildId: '222200000000000002',
    ticker: '$CHILL',
    name: 'Chill Lounge',
    league: 'Club',
    category: 'Social Sanctuary, Anime Nights & Community Radio',
    tagline: 'Relaxed hangout hub featuring anime watch-parties, voice radio, and community trivia.',
    overview:
      'Chill Lounge is a massive social hub built around positive community vibes, movie watch parties, gaming casuals, and interactive trivia bots. Boasting 680 active members across 18 voice rooms, the server delivers consistent daily ad engagement and creator sponsorships, yielding strong, steady passive dividends for $CHILL shareholders.',
    contractAddress: '0x15C5FecA9eFf4B2b95Cd4bb4F0A5674498169564',
    tokenExplorerUrl: '/scan?address=0x15C5FecA9eFf4B2b95Cd4bb4F0A5674498169564',
    ammRouterAddress: '0x074802DE766bF300C2e7A333B1cbf756C76E3F53',
    dividendYield: '5.0% APY',
    dividendPayoutFreq: 'Daily at 00:00 UTC',
    circulatingSupply: '4,300 CHILL',
    maxSupply: '400,000 CHILL',
    marketCapUsd: '$623.5K',
    members: '680 humans',
    peak7d: '710 members',
    activeVoiceLounges: 18,
    dailyMessages: '12,400 msgs/day',
    boostTier: 'Level 2 (12 Server Boosts)',
    boostPower: 89,
    keyChannels: [
      { name: '#lounge-chat', desc: 'Fast-paced friendly global chat and daily icebreakers' },
      { name: '#anime-watch-party', desc: 'Synchronized weekend seasonal anime screenings' },
      { name: '#trivia-arena', desc: 'Hourly automated trivia contests with $CRED drops' },
      { name: '#music-radio-live', desc: 'Curated 24/7 community radio and DJ voice stage' },
    ],
    governance: 'Token holders vote on watch-party film rosters, bot additions, and emote sets.',
    team: [
      { role: 'Server Master', name: 'ZenithChill' },
      { role: 'Event Host', name: 'SakuraVibes' },
      { role: 'Chief Moderator', name: 'KumoCloud' },
    ],
    roadmap: [
      { quarter: 'Q1 2026', title: 'CordLedger Constant-Product AMM Listing', status: 'completed' },
      { quarter: 'Q2 2026', title: 'Integrated Trivia Cashout System', status: 'completed' },
      { quarter: 'Q3 2026', title: '24/7 Community Radio Discord Bot V2', status: 'in-progress' },
      { quarter: 'Q4 2026', title: 'Annual ChillFest Virtual Convention', status: 'planned' },
    ],
  },

  $BUILD: {
    guildId: '222200000000000003',
    ticker: '$BUILD',
    name: 'Builders Club',
    league: 'Club',
    category: 'Startup Founders & Indie Hackers',
    tagline: 'Fast-moving community of founders shipping SaaS products, apps, and crypto protocols.',
    overview:
      'Builders Club brings together bootstrapped founders, serial entrepreneurs, growth marketers, and angel investors. Members share transparent weekly MRR updates, conduct landing page conversion roasts, and pitch to syndicate investors during monthly Demo Days. $BUILD shares represent a stake in community incubator revenues and sponsor partnerships.',
    contractAddress: '0xA481B52011872fEcAd213A939e9d74989A5b5Eb6',
    tokenExplorerUrl: '/scan?address=0xA481B52011872fEcAd213A939e9d74989A5b5Eb6',
    ammRouterAddress: '0x074802DE766bF300C2e7A333B1cbf756C76E3F53',
    dividendYield: '6.8% APY',
    dividendPayoutFreq: 'Daily at 00:00 UTC',
    circulatingSupply: '3,200 BUILD',
    maxSupply: '300,000 BUILD',
    marketCapUsd: '$433.6K',
    members: '310 humans',
    peak7d: '315 members',
    activeVoiceLounges: 7,
    dailyMessages: '4,890 msgs/day',
    boostTier: 'Level 2 (9 Server Boosts)',
    boostPower: 91,
    keyChannels: [
      { name: '#mrr-milestones', desc: 'Verified revenue milestones from Stripe and Lemonsqueezy' },
      { name: '#demo-day-pitches', desc: 'Monthly live founder pitches and feedback sessions' },
      { name: '#growth-tactics', desc: 'SEO, cold outreach, viral loops, and ad spend case studies' },
      { name: '#investor-lounge', desc: 'Direct accredited investor introductions and syndicates' },
    ],
    governance: 'Token votes allocate quarterly micro-grants to the most promising community projects.',
    team: [
      { role: 'Incubator Director', name: 'AlexFounder' },
      { role: 'Growth Hacker', name: 'MetricMike' },
      { role: 'Venture Partner', name: 'AngelDave' },
    ],
    roadmap: [
      { quarter: 'Q1 2026', title: 'CordLedger Verification & Merkle Audit', status: 'completed' },
      { quarter: 'Q2 2026', title: 'Stripe Verified Revenue Discord Bot', status: 'completed' },
      { quarter: 'Q3 2026', title: 'Micro-Grant Syndicate Launch ($25K Pool)', status: 'in-progress' },
      { quarter: 'Q4 2026', title: 'Builders Incubator Cohort #1', status: 'planned' },
    ],
  },

  $ARENA: {
    guildId: '333300000000000001',
    ticker: '$ARENA',
    name: 'Arena Esports',
    league: 'Arena',
    category: 'Tier-1 Esports Tournament Federation',
    tagline: 'Professional tournament federation organizing cash prize cups in Valorant, CS2 & Rocket League.',
    overview:
      'Arena Esports is a premier Tier-1 competitive tournament circuit spanning over 3,400 verified esports players. Operating licensed regional leagues with professional casters, twitch broadcasts, and anti-cheat verification, Arena Esports generates significant commercial sponsorships from gaming peripheral brands. $ARENA is backed by real tournament ticket shares and broadcast revenue.',
    contractAddress: '0x1E1e0454787C87D223089eD74f1116D91BfC87f8',
    tokenExplorerUrl: '/scan?address=0x1E1e0454787C87D223089eD74f1116D91BfC87f8',
    ammRouterAddress: '0x074802DE766bF300C2e7A333B1cbf756C76E3F53',
    dividendYield: '7.4% APY',
    dividendPayoutFreq: 'Daily at 00:00 UTC',
    circulatingSupply: '18,400 ARENA',
    maxSupply: '1,000,000 ARENA',
    marketCapUsd: '$4.51M',
    members: '3,400 humans',
    peak7d: '3,500 members',
    activeVoiceLounges: 24,
    dailyMessages: '38,900 msgs/day',
    boostTier: 'Level 3 (28 Server Boosts)',
    boostPower: 98,
    keyChannels: [
      { name: '#tournament-brackets', desc: 'Live brackets, check-ins, and match arbitrations' },
      { name: '#broadcast-studio', desc: 'Caster voice channels, stream graphics, and OBS feeds' },
      { name: '#esports-news-feed', desc: 'Roster shifts, patch notes, and meta analysis' },
      { name: '#scrim-finder-tier-1', desc: 'High-elo team scrim scheduling and map vetoes' },
    ],
    governance: 'Tournament map pool bans, game additions, and tournament prize pool structures.',
    team: [
      { role: 'Commissioner', name: 'VanguardApex' },
      { role: 'Head of Production', name: 'PixelCaster' },
      { role: 'Chief Referee', name: 'RuleEnforcer' },
    ],
    roadmap: [
      { quarter: 'Q1 2026', title: 'CordLedger Fixed-Supply Issuance', status: 'completed' },
      { quarter: 'Q2 2026', title: 'Automated Discord Match Results Engine', status: 'completed' },
      { quarter: 'Q3 2026', title: 'Arena Pro Cup ($50,000 Prize Pool)', status: 'in-progress' },
      { quarter: 'Q4 2026', title: 'International Collegiate Esports Circuit', status: 'planned' },
    ],
  },

  $CLAN: {
    guildId: '333300000000000002',
    ticker: '$CLAN',
    name: 'Clan Warzone',
    league: 'Arena',
    category: 'Tactical Gaming Alliance & Raid Guild',
    tagline: 'Massive 5,200+ member alliance dominating extraction shooters and battle royales.',
    overview:
      'Clan Warzone is one of Discord’s largest coordinated tactical alliances, fielding organized battle divisions across Warzone, Escape from Tarkov, Rust, and Hell Let Loose. Organized into structured command platoons with tactical comms protocols, Clan Warzone dominates community leaderboards and drives massive server attention.',
    contractAddress: '0x52fF8f0a7cfF25b6590cB878F9ea8Ef408d3A6A1',
    tokenExplorerUrl: '/scan?address=0x52fF8f0a7cfF25b6590cB878F9ea8Ef408d3A6A1',
    ammRouterAddress: '0x074802DE766bF300C2e7A333B1cbf756C76E3F53',
    dividendYield: '7.1% APY',
    dividendPayoutFreq: 'Daily at 00:00 UTC',
    circulatingSupply: '14,200 CLAN',
    maxSupply: '1,000,000 CLAN',
    marketCapUsd: '$2.99M',
    members: '5,200 humans',
    peak7d: '5,320 members',
    activeVoiceLounges: 32,
    dailyMessages: '45,600 msgs/day',
    boostTier: 'Level 3 (31 Server Boosts)',
    boostPower: 97,
    keyChannels: [
      { name: '#war-orders', desc: 'Weekly platoon objectives, server wipes, and raid times' },
      { name: '#meta-loadouts', desc: 'Weapon attachments, recoil patterns, and armor stats' },
      { name: '#squad-recruitment', desc: 'Squad tryouts, comms tests, and platoon transfers' },
      { name: '#clip-hall-of-fame', desc: 'Legendary squad wipe clips and highlight reels' },
    ],
    governance: 'Alliance strategy council elections and seasonal war chest allocations.',
    team: [
      { role: 'Supreme Commander', name: 'IronClad_General' },
      { role: 'Platoon Officer', name: 'TacticalHawk' },
      { role: 'Intelligence Officer', name: 'ShadowOp_7' },
    ],
    roadmap: [
      { quarter: 'Q1 2026', title: 'CordLedger AMM Token Integration', status: 'completed' },
      { quarter: 'Q2 2026', title: 'Platoon Management Discord Bot V2', status: 'completed' },
      { quarter: 'Q3 2026', title: 'Multi-Clan Global Siege Tournament', status: 'in-progress' },
      { quarter: 'Q4 2026', title: 'Hardware Sponsor Partnership Program', status: 'planned' },
    ],
  },

  $TITAN: {
    guildId: '444400000000000001',
    ticker: '$TITAN',
    name: 'Titan Megahub',
    league: 'Titan',
    category: 'Premier Mega-Community & Creator Network',
    tagline: 'Flagship 28,500+ member megahub with global creator network and entertainment lounges.',
    overview:
      'Titan Megahub is the crown jewel of the CordChain exchange. With over 28,500 registered members, 120+ active voice lounges, continuous nitro giveaways, and celebrity creator AMAs, Titan represents unmatched community liquidity and attention capital. Backed by institutional ad sponsors and premium community subscriptions, $TITAN offers the highest dividend yield and market depth on the network.',
    contractAddress: '0xB809bf4C0461158F9dFC7b1aBB37D17C598F5C7c',
    tokenExplorerUrl: '/scan?address=0xB809bf4C0461158F9dFC7b1aBB37D17C598F5C7c',
    ammRouterAddress: '0x074802DE766bF300C2e7A333B1cbf756C76E3F53',
    dividendYield: '8.5% APY',
    dividendPayoutFreq: 'Daily at 00:00 UTC',
    circulatingSupply: '65,000 TITAN',
    maxSupply: '2,500,000 TITAN',
    marketCapUsd: '$33.8M',
    members: '28,500 humans',
    peak7d: '29,000 members',
    activeVoiceLounges: 64,
    dailyMessages: '185,000 msgs/day',
    boostTier: 'Level 3 (75 Server Boosts)',
    boostPower: 100,
    keyChannels: [
      { name: '#global-announcements', desc: 'Major creator announcements, AMAs, and partner drops' },
      { name: '#megahub-general', desc: 'The most active conversational channel on Discord' },
      { name: '#creator-stage', desc: 'Weekly live podcasts, celebrity AMAs, and community concerts' },
      { name: '#vip-shareholder-lounge', desc: 'Exclusive gated channel for verified $TITAN holders' },
    ],
    governance: 'Exclusive DAO governance over major ecosystem sponsorship contracts and treasury grants.',
    team: [
      { role: 'Founder & CEO', name: 'TitanPrime' },
      { role: 'Head of Partnerships', name: 'GlobalAura' },
      { role: 'Operations Director', name: 'KaiserV' },
    ],
    roadmap: [
      { quarter: 'Q1 2026', title: 'CordLedger Fixed-Supply Issuance', status: 'completed' },
      { quarter: 'Q2 2026', title: 'VIP Token-Gated Role Bot Verification', status: 'completed' },
      { quarter: 'Q3 2026', title: 'Titan Creator Accelerator ($250K Fund)', status: 'in-progress' },
      { quarter: 'Q4 2026', title: 'CordChain Cross-Chain Settlement Bridge', status: 'planned' },
    ],
  },
};

export function getProjectResearch(tickerOrName: string): ProjectResearchData {
  const clean = tickerOrName.startsWith('$') ? tickerOrName : `$${tickerOrName}`;
  const uppercase = clean.toUpperCase();
  if (PROJECTS_RESEARCH[uppercase]) {
    return PROJECTS_RESEARCH[uppercase];
  }
  // Fallback to $SQUAD
  return PROJECTS_RESEARCH['$SQUAD'];
}
