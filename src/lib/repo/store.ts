import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import type { HouseholdVersion, Trial, ActionId } from "@/lib/domain/types";
import { householdPatchSchema, type Command } from "@/lib/domain/validation";
import { cloudEnabled, api, ApiError } from "@/lib/cloud/client";
import { initial, type AppState } from "./state";
import { executeCommand } from "./commands";
export { addMonths } from "./state";
export type { AppState } from "./state";

const KEY = "purrfect-home:v1";
let state: AppState = structuredClone(initial);
let loaded = false;
let revision = 0;
let generation = 0;
let queue: Promise<unknown> = Promise.resolve();
let lastError: unknown;
const listeners = new Set<() => void>();
const pending = new Map<string, Partial<AppState>>();
function emit() { listeners.forEach(l => l()); }
function load() {
  if (cloudEnabled || loaded || typeof window === "undefined") return;
  loaded = true;
  try { const raw = localStorage.getItem(KEY); if (raw) state = { ...structuredClone(initial), ...JSON.parse(raw) }; } catch { /* Invalid demo cache is ignored. */ }
}
function replace(next: AppState) {
  state = next;
  for (const patch of pending.values()) state = { ...state, ...patch };
  if (!cloudEnabled && typeof window !== "undefined") { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* Demo quota. */ } }
  emit();
}
export function getState() { load(); return state; }
export const activeHousehold = (s: AppState) => s.householdVersions.find(v => v.versionId === s.activeVersionId) ?? s.householdVersions[0];
export function useAppState<T>(selector: (s: AppState) => T): T {
  // React requires a stable snapshot even when the selector allocates an array/object.
  const snapshot = useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, getState, () => initial);
  return selector(snapshot);
}
export function clearCloudState() { generation++; pending.clear(); state = structuredClone(initial); revision = 0; queue = Promise.resolve(); lastError = undefined; emit(); }
export async function hydrateCloud() {
  const session = generation;
  const result = await api<{ state: AppState; revision: number }>("/state");
  if (session === generation) { revision = result.revision; replace(result.state); }
}
export async function flushCloud() { await queue; if (lastError) throw lastError; }

function submit(command: Command, requestId = crypto.randomUUID()): Promise<{ state: AppState; trialId?: string }> {
  if (!cloudEnabled) {
    const result = executeCommand(getState(), command, requestId);
    replace(result.state); return Promise.resolve(result);
  }
  const session = generation;
  const operation = queue.then(async () => {
    if (session !== generation) throw new Error("Account changed. Please retry.");
    const envelope = { command, requestId, expectedRevision: revision };
    try {
      let result: { state: AppState; revision: number; trialId?: string };
      try { result = await api("/commands", "POST", envelope); }
      catch (error) {
        // A network failure may occur AFTER commit. Retry the exact request once.
        if (error instanceof ApiError && error.status < 500) throw error;
        result = await api("/commands", "POST", envelope);
      }
      if (session !== generation) throw new Error("Account changed.");
      pending.delete(requestId); revision = result.revision; replace(result.state); lastError = undefined;
      return result;
    } catch (error) {
      pending.delete(requestId);
      if (session === generation) {
        lastError = error;
        await hydrateCloud().catch(() => {});
        toast.error((error as Error).message);
      }
      throw error;
    }
  });
  queue = operation.catch(() => {});
  return operation;
}

/** Presentation preferences only; authoritative fields use dedicated commands. */
export function setState(fn: (s: AppState) => AppState) {
  const previous = getState(); const next = fn(previous);
  if (!cloudEnabled) { replace(next); return; }
  const patch: Partial<AppState> = {};
  for (const key of ["userName", "favorites", "passed", "review", "reviewLog"] as const) {
    if (JSON.stringify(next[key]) !== JSON.stringify(previous[key])) Object.assign(patch, { [key]: next[key] });
  }
  if (!Object.keys(patch).length) return;
  const requestId = crypto.randomUUID(); pending.set(requestId, patch); replace({ ...state, ...patch });
  void submit({ kind: "preferences", patch }, requestId).catch(() => {});
}
export async function saveHouseholdVersion(patch: Partial<HouseholdVersion>, source: HouseholdVersion["source"], expectedRevision: number): Promise<{ ok: boolean; version?: HouseholdVersion; reason?: string }> {
  const { householdId: _id, versionId: _version, revision: _revision, createdAt: _at, source: _source, ...fields } = patch;
  try {
    if (source === "SEED") throw new Error("Seed profiles cannot be saved by users.");
    const result = await submit({ kind: "household", patch: householdPatchSchema.parse(fields), source, expectedRevision });
    return { ok: true, version: activeHousehold(result.state) };
  } catch (error) { return { ok: false, reason: (error as Error).message }; }
}
export async function startTrial(animalId: string, forkedFrom?: string) {
  const result = await submit({ kind: "createTrial", animalId, forkedFrom });
  return result.trialId!;
}
export async function careForTrial(trial: Trial, actionId: ActionId) {
  const result = await submit({ kind: "care", trialId: trial.trialId, actionId, expectedStateVersion: trial.stateVersion });
  return result.state.trials.find(t => t.trialId === trial.trialId)!;
}
export async function advanceTrial(trial: Trial, actionId: ActionId) {
  const result = await submit({ kind: "day", trialId: trial.trialId, actionId, expectedDay: trial.day, expectedStateVersion: trial.stateVersion });
  return result.state.trials.find(t => t.trialId === trial.trialId)!;
}
export function toggleFavorite(id: string) { setState(s => ({ ...s, favorites: s.favorites.includes(id) ? s.favorites.filter(f => f !== id) : [...s.favorites, id] })); }
export async function resetAll() {
  await queue;
  if (cloudEnabled) await api("/data", "DELETE");
  pending.clear(); revision = 0; lastError = undefined; replace(structuredClone(initial));
}
export function reviewDue(s: AppState, now = new Date()) {
  return s.review.remindersEnabled && !(s.review.snoozedUntil && new Date(s.review.snoozedUntil) > now) && s.review.dismissedForWindow !== s.review.nextReviewDueAt && new Date(s.review.nextReviewDueAt) <= now;
}
