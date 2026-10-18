import type { HouseholdVersion, ReviewEvent, ReviewSettings, Trial } from "@/lib/domain/types";
import { SEED_HOUSEHOLD } from "@/lib/data/seed";
export interface AppState {
  userName: string;
  householdVersions: HouseholdVersion[]; // append-only
  activeVersionId: string;
  favorites: string[];
  passed: string[];
  trials: Trial[];
  review: ReviewSettings;
  reviewLog: ReviewEvent[];
  inbox: { id: string; title: string; at: string; read: boolean; link: string }[];
}

export function addMonths(iso: string, months: number) {
  const d = new Date(iso);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d.toISOString();
}

export const initial: AppState = {
  userName: "Hanssen",
  householdVersions: [SEED_HOUSEHOLD],
  activeVersionId: "v1",
  favorites: [],
  passed: [],
  trials: [],
  review: { intervalMonths: 3, remindersEnabled: true, pushEnabled: false, lastReviewedAt: "2026-10-12T05:00:00Z", nextReviewDueAt: "2027-01-12T05:00:00Z", snoozedUntil: null, dismissedForWindow: null },
  reviewLog: [{ reviewId: "rev_seed", type: "CONFIRMED_CHANGE", at: "2026-10-12T05:00:00Z", versionId: "v1", changedFields: ["initial profile"] }],
  inbox: [],
};

