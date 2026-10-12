// Client repository layer. Today: localStorage-backed mock persisted per browser.
// The public API (functions below) is the seam to swap for real persistence.
//
// ─────────────────────────── GCP CONFIGURATION (commented) ───────────────────────────
// Production: Firebase Auth + Cloud Run API (/api/v1/*) + Firestore (asia-southeast1).
//   import { initializeApp } from "firebase/app";
//   import { getAuth } from "firebase/auth";
//   const app = initializeApp({
//     apiKey: import.meta.env.VITE_FIREBASE_API_KEY,          // publishable
//     authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
//     projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
//     messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID, // FCM web push (P1)
//   });
//   const api = async (path: string, init?: RequestInit) => fetch(`/api/v1${path}`, {
//     ...init, headers: { ...init?.headers, Authorization: `Bearer ${await getAuth(app).currentUser?.getIdToken()}`,
//       "Content-Type": "application/json" } });
// Collections (see starter/firestore.rules + firestore.indexes.json):
//   users/{uid}, users/{uid}/favorites/{animalId}, households/{hid}/versions/{vid} (immutable),
//   trials/{trialId} (+ /events subcollection, append-only), profileReviewSettings/{uid},
//   profileReviewEvents/{uid}/log/{id}, notifications/{uid}/inbox/{id}
// Scaling: all trial writes go through Cloud Run with idempotency keys + expectedStateVersion
// (optimistic concurrency); history uses paginated queries (orderBy createdAt, limit 20).
// Reminders: Cloud Scheduler -> private Cloud Run worker -> Firestore inbox/outbox -> FCM.
// ──────────────────────────────────────────────────────────────────────────────────────
import { useSyncExternalStore } from "react";
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
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

const initial: AppState = {
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

const KEY = "purrfect-home:v1";
let state: AppState = initial;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = { ...initial, ...JSON.parse(raw) };
  } catch { /* ignore corrupted cache */ }
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* quota */ }
}

export function setState(fn: (s: AppState) => AppState) {
  load();
  state = fn(state);
  persist();
  listeners.forEach((l) => l());
}
export function getState() { load(); return state; }

export function useAppState<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => selector(getState()),
    () => selector(initial),
  );
}

export const activeHousehold = (s: AppState) => s.householdVersions.find((v) => v.versionId === s.activeVersionId) ?? s.householdVersions[0];

/** Save a new immutable household version with optimistic concurrency (FR-005, FR-027). */
export function saveHouseholdVersion(patch: Partial<HouseholdVersion>, source: HouseholdVersion["source"], expectedRevision: number): { ok: boolean; version?: HouseholdVersion; reason?: string } {
  const cur = activeHousehold(getState());
  if (cur.revision !== expectedRevision) return { ok: false, reason: "Your profile changed in another session. Reload and try again." };
  const next: HouseholdVersion = { ...cur, ...JSON.parse(JSON.stringify(patch)), versionId: `v${getState().householdVersions.length + 1}`, revision: cur.revision + 1, createdAt: new Date().toISOString(), source };
  setState((s) => ({ ...s, householdVersions: [...s.householdVersions, next], activeVersionId: next.versionId }));
  return { ok: true, version: next };
}

export function upsertTrial(t: Trial) {
  setState((s) => ({ ...s, trials: s.trials.some((x) => x.trialId === t.trialId) ? s.trials.map((x) => (x.trialId === t.trialId ? t : x)) : [t, ...s.trials] }));
}

export function toggleFavorite(id: string) {
  setState((s) => ({ ...s, favorites: s.favorites.includes(id) ? s.favorites.filter((f) => f !== id) : [...s.favorites, id] })); // no duplicates (FR-002)
}

export function resetAll() {
  setState(() => initial);
}

export function reviewDue(s: AppState, now = new Date()) {
  if (!s.review.remindersEnabled) return false;
  if (s.review.snoozedUntil && new Date(s.review.snoozedUntil) > now) return false;
  if (s.review.dismissedForWindow === s.review.nextReviewDueAt) return false;
  return new Date(s.review.nextReviewDueAt) <= now;
}
