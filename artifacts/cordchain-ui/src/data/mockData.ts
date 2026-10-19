import {
  ServerAsset,
  CandlePoint,
  OrderBookRow,
  TradeRecord,
  ActivityItem,
  TraderLeaderboardEntry,
  ServerLeaderboardEntry,
  UserProfile,
  SettingsState,
  AdCampaign,
  OwnedServerStock,
} from '../types';

export const SERVERS: ServerAsset[] = [];

export const IPO_SERVERS: ServerAsset[] = [];

export const SIDEBAR_SERVERS_ORDER: string[] = [];

export const SQUAD_CANDLES: CandlePoint[] = [
  { time: 'Oct 09 16:00', open: 55.2, high: 57.4, low: 54.5, close: 56.8, volume: 42 },
  { time: 'Oct 09 18:00', open: 56.8, high: 59.1, low: 56.1, close: 58.6, volume: 48 },
  { time: 'Oct 09 20:00', open: 58.6, high: 59.4, low: 55.0, close: 55.9, volume: 55 },
  { time: 'Oct 09 22:00', open: 55.9, high: 58.2, low: 55.2, close: 57.5, volume: 38 },
  { time: 'Oct 10 00:00', open: 57.5, high: 60.2, low: 57.0, close: 59.6, volume: 51 },
  { time: 'Oct 10 02:00', open: 59.6, high: 61.0, low: 56.8, close: 57.4, volume: 63 },
  { time: 'Oct 10 04:00', open: 57.4, high: 60.5, low: 56.9, close: 59.9, volume: 44 },
  { time: 'Oct 10 06:00', open: 59.9, high: 62.1, low: 58.5, close: 61.2, volume: 58 },
  { time: 'Oct 10 08:00', dateLabel: 'Oct 10', open: 61.2, high: 61.8, low: 55.4, close: 56.2, volume: 72 },
  { time: 'Oct 10 10:00', open: 56.2, high: 57.9, low: 53.8, close: 54.6, volume: 67 },
  { time: 'Oct 10 12:00', open: 54.6, high: 57.2, low: 54.1, close: 56.8, volume: 49 },
  { time: 'Oct 10 14:00', open: 56.8, high: 58.5, low: 54.9, close: 55.5, volume: 52 },
  { time: 'Oct 10 16:00', open: 55.5, high: 59.0, low: 55.0, close: 58.4, volume: 61 },
  { time: 'Oct 10 18:00', open: 58.4, high: 61.2, low: 57.8, close: 60.5, volume: 54 },
  { time: 'Oct 10 20:00', open: 60.5, high: 61.4, low: 57.2, close: 58.1, volume: 47 },
  { time: 'Oct 10 22:00', open: 58.1, high: 60.8, low: 57.5, close: 60.2, volume: 43 },
  { time: 'Oct 11 00:00', open: 60.2, high: 62.5, low: 59.4, close: 61.9, volume: 59 },
  { time: 'Oct 11 02:00', open: 61.9, high: 64.0, low: 60.8, close: 63.4, volume: 64 },
  { time: 'Oct 11 04:00', open: 63.4, high: 63.9, low: 58.6, close: 59.2, volume: 78 },
  { time: 'Oct 11 06:00', open: 59.2, high: 61.5, low: 58.1, close: 60.8, volume: 53 },
  { time: 'Oct 11 08:00', dateLabel: 'Oct 11', open: 60.8, high: 63.2, low: 60.1, close: 62.7, volume: 48 },
  { time: 'Oct 11 10:00', open: 62.7, high: 65.8, low: 62.0, close: 65.1, volume: 69 },
  { time: 'Oct 11 12:00', open: 65.1, high: 68.4, low: 64.5, close: 67.8, volume: 74 },
  { time: 'Oct 11 14:00', open: 67.8, high: 68.9, low: 64.2, close: 65.0, volume: 62 },
  { time: 'Oct 11 16:00', open: 65.0, high: 67.5, low: 64.4, close: 66.9, volume: 51 },
  { time: 'Oct 11 18:00', open: 66.9, high: 69.8, low: 66.1, close: 69.2, volume: 66 },
  { time: 'Oct 11 20:00', open: 69.2, high: 70.4, low: 66.5, close: 67.4, volume: 57 },
  { time: 'Oct 11 22:00', open: 67.4, high: 69.1, low: 65.2, close: 66.1, volume: 49 },
  { time: 'Oct 12 00:00', open: 66.1, high: 68.8, low: 65.8, close: 68.3, volume: 55 },
  { time: 'Oct 12 02:00', open: 68.3, high: 71.2, low: 67.9, close: 70.6, volume: 71 },
  { time: 'Oct 12 04:00', open: 70.6, high: 71.5, low: 67.1, close: 67.9, volume: 63 },
  { time: 'Oct 12 06:00', open: 67.9, high: 70.4, low: 67.2, close: 69.8, volume: 52 },
  { time: 'Oct 12 08:00', dateLabel: 'Oct 12', open: 69.8, high: 71.9, low: 66.8, close: 67.5, volume: 68 },
  { time: 'Oct 12 10:00', open: 67.5, high: 69.4, low: 65.1, close: 66.2, volume: 59 },
  { time: 'Oct 12 12:00', open: 66.2, high: 70.1, low: 65.9, close: 69.5, volume: 64 },
  { time: 'Oct 12 14:00', open: 69.5, high: 72.6, low: 68.8, close: 71.9, volume: 73 },
  { time: 'Oct 12 16:00', open: 71.9, high: 73.1, low: 69.2, close: 70.1, volume: 56 },
  { time: 'Oct 12 18:00', open: 70.1, high: 74.0, low: 69.8, close: 73.4, volume: 77 },
  { time: 'Oct 12 20:00', open: 73.4, high: 75.8, low: 72.5, close: 75.1, volume: 82 },
  { time: 'Oct 12 22:00', open: 75.1, high: 76.2, low: 71.8, close: 72.6, volume: 65 },
  { time: 'Oct 13 00:00', open: 72.6, high: 75.4, low: 72.1, close: 74.8, volume: 61 },
  { time: 'Oct 13 02:00', open: 74.8, high: 77.9, low: 74.2, close: 77.2, volume: 79 },
  { time: 'Oct 13 04:00', open: 77.2, high: 79.5, low: 76.1, close: 78.9, volume: 85 },
  { time: 'Oct 13 06:00', open: 78.9, high: 79.8, low: 74.6, close: 75.4, volume: 74 },
  { time: 'Oct 13 08:00', dateLabel: 'Oct 13', open: 75.4, high: 78.2, low: 74.9, close: 77.6, volume: 67 },
  { time: 'Oct 13 10:00', open: 77.6, high: 81.4, low: 77.1, close: 80.8, volume: 92 },
  { time: 'Oct 13 12:00', open: 80.8, high: 84.2, low: 80.1, close: 83.5, volume: 96 },
  { time: 'Oct 13 14:00', open: 83.5, high: 86.1, low: 82.4, close: 85.4, volume: 88 },
  { time: 'Oct 13 16:00', open: 85.4, high: 86.5, low: 80.2, close: 81.1, volume: 94 },
  { time: 'Oct 13 18:00', open: 81.1, high: 83.8, low: 78.5, close: 79.4, volume: 76 },
  { time: 'Oct 13 20:00', open: 79.4, high: 82.6, low: 78.9, close: 82.0, volume: 69 },
  { time: 'Oct 13 22:00', open: 82.0, high: 84.9, low: 81.2, close: 84.1, volume: 73 },
  { time: 'Oct 14 00:00', open: 84.1, high: 85.2, low: 79.8, close: 80.6, volume: 68 },
  { time: 'Oct 14 02:00', open: 80.6, high: 83.4, low: 80.0, close: 82.9, volume: 64 },
  { time: 'Oct 14 04:00', open: 82.9, high: 85.7, low: 82.1, close: 85.0, volume: 71 },
  { time: 'Oct 14 06:00', dateLabel: 'Oct 14', open: 85.0, high: 85.9, low: 81.4, close: 82.2, volume: 62 },
  { time: 'Oct 14 08:00', open: 82.2, high: 84.8, low: 81.6, close: 84.3, volume: 58 },
  { time: 'Oct 14 10:00', open: 84.3, high: 87.2, low: 83.8, close: 86.4, volume: 77 },
  { time: 'Oct 14 12:00', open: 86.4, high: 87.5, low: 82.9, close: 83.7, volume: 66 },
  { time: 'Oct 14 14:00', open: 83.7, high: 86.8, low: 83.2, close: 86.1, volume: 72 },
  { time: 'Oct 14 16:00', open: 86.1, high: 88.4, low: 84.9, close: 87.6, volume: 81 },
  { time: 'Oct 14 17:00', open: 87.6, high: 88.1, low: 84.8, close: 86.10, volume: 69 },
  { time: 'Oct 14 18:00', dateLabel: '18:00', open: 86.10, high: 88.92, low: 84.37, close: 86.75, volume: 89 },
];

export const ORDER_BOOK_ASKS: OrderBookRow[] = [
  { price: 87.42, amount: 1240, total: '108.3K', depthPercent: 52 },
  { price: 87.21, amount: 980, total: '85.4K', depthPercent: 38 },
  { price: 86.97, amount: 1560, total: '135.7K', depthPercent: 64 },
  { price: 86.88, amount: 2340, total: '203.3K', depthPercent: 88 },
  { price: 86.82, amount: 1120, total: '97.2K', depthPercent: 45 },
];

export const ORDER_BOOK_BIDS: OrderBookRow[] = [
  { price: 86.60, amount: 1560, total: '135.7K', depthPercent: 58 },
  { price: 86.42, amount: 2180, total: '188.7K', depthPercent: 78 },
  { price: 86.21, amount: 980, total: '84.6K', depthPercent: 36 },
  { price: 85.98, amount: 1430, total: '123.1K', depthPercent: 52 },
  { price: 85.76, amount: 2760, total: '237.4K', depthPercent: 95 },
];

export const INITIAL_TRADES: TradeRecord[] = [];

export const INITIAL_ACTIVITIES: ActivityItem[] = [];

export const TOP_LEAGUES = [
  { id: 'Titan', name: 'Titan', subtitle: 'Top 5% servers', count: 0 },
  { id: 'Arena', name: 'Arena', subtitle: 'Top 10% servers', count: 0 },
  { id: 'Club', name: 'Club', subtitle: 'Top 25% servers', count: 0 },
  { id: 'Squad', name: 'Squad', subtitle: 'All servers', count: 2 },
] as const;

export const INITIAL_TRADER_LEADERBOARD: TraderLeaderboardEntry[] = [];

export const INITIAL_SERVER_LEADERBOARD: ServerLeaderboardEntry[] = [];

export const INITIAL_USER_PROFILE: UserProfile = {
  name: 'Trader',
  username: '',
  email: '',
  discordId: '',
  isLoggedIn: false,
  connectedGuildsCount: 0,
  reputationScore: 100,
  tierRole: 'Verified Discord User',
  joinedDate: 'Joined 2026',
};

export const DEFAULT_SETTINGS: SettingsState = {
  currency: 'INR',
  slippageTolerance: '0.5%',
  confirmOrders: true,
  showDepthAnimation: true,
  upiId: '',
  autoWithdrawalEnabled: false,
  autoWithdrawThreshold: 500,
  emailAlerts: true,
  priceAlertThreshold: 10,
  discordWebhookUrl: '',
  botAlertsEnabled: true,
  soundEffects: true,
};

export const INITIAL_CAMPAIGNS: AdCampaign[] = [];
export const INITIAL_OWNED_SERVER: OwnedServerStock | null = null;


