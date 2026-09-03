// Mirrors the DTOs the API returns. The server does the hydration maths, so
// the frontend mostly renders what it is given.

export type SourceType = 'bottle' | 'small_glass' | 'large_glass' | 'custom';

export interface BirdDto {
  id: string;
  name: string;
  emoji: string;
  state: string;
  face: string;
  label: string;
  message: string;
}

export interface UserSummary {
  id: string;
  key: string;
  name: string;
  timezone: string;
  localDate: string;
  localTime: string;
  dailyTargetMl: number;
  consumedMl: number;
  remainingMl: number;
  percent: number;
  percentDisplay: number;
  expectedPercent: number;
  goalReached: boolean;
  bottleMl: number;
  glassMl: number;
  customMl: number;
  bottlesFinishedToday: number;
  coinBalance: number;
  smallGlassMl: number;
  largeGlassMl: number;
  activeBottle: { id: string; name: string; capacityMl: number } | null;
  bird: BirdDto;
}

export interface SummaryResponse {
  me: UserSummary;
  partner: UserSummary | null;
  serverTime: string;
}

export interface LogEntry {
  id: string;
  amountMl: number;
  sourceType: SourceType;
  label: string | null;
  bottleId: string | null;
  loggedAt: string;
  localDate: string;
}

export interface LogResponse {
  summary: UserSummary;
  logId: string;
  coinsAwarded: number;
  clientId: string | null;
}

export interface Bottle {
  id: string;
  name: string;
  capacityMl: number;
  isActive: boolean;
}

export interface StoreBird {
  id: string;
  name: string;
  emoji: string;
  description: string;
  priceCoins: number;
  isDefault: boolean;
  owned: boolean;
  active: boolean;
  affordable: boolean;
}

export interface StoreResponse {
  coinBalance: number;
  activeBirdId: string | null;
  birds: StoreBird[];
}

export interface NotificationSettings {
  userId: string;
  enabled: boolean;
  intervalMinutes: number;
  wakeMinute: number;
  sleepMinute: number;
  lastSentAt: string | null;
}

export interface HistoryResponse {
  today: string;
  dailyTargetMl: number;
  days: { date: string; totalMl: number; entries: number }[];
  logs: LogEntry[];
}
