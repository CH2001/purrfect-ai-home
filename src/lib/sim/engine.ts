// Deterministic simulation engine (TypeScript port of starter/demo_simulator.py).
// Pure functions: T(state, actions, events, baseline, seed) -> nextState.
// In production the authoritative copy runs in the Cloud Run FastAPI service
// (POST /v1/trials/{id}/actions and /v1/trials/{id}/days/{day}:commit) and this file is
// used only as the client-side *preview* engine. Golden fixtures must verify parity.
// Coefficients are illustrative game values, NOT validated behavioural measurements.
import type { ActionId, Animal, DynamicState, HouseholdVersion, Trial, TrialEvent } from "@/lib/domain/types";
import { RULES, SCENARIOS } from "@/lib/data/seed";
import { rand } from "@/lib/sim/prng";
import { simulateDayLife } from "@/lib/sim/daylife";

// ---- xorshift32 PRNG (seedAlgorithm in behavior_rules.json) — shared via prng.ts ----
export { xorshift32, rand } from "@/lib/sim/prng";

const clamp = (v: number) => Math.max(0, Math.min(100, v));
const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}`;

function applyDeltas(s: DynamicState, d: Partial<Record<string, number>>): DynamicState {
  const n = { ...s } as Record<string, number>;
  for (const [k, v] of Object.entries(d)) if (k in n && typeof v === "number") n[k] = clamp(n[k] + v);
  return n as unknown as DynamicState;
}

export function hasResidentDog(h: HouseholdVersion) {
  return h.pets.some((p) => p.species === "DOG");
}
export function scenarioFor(trial: Trial) {
  const s = SCENARIOS.find((x) => x.day === trial.day);
  if (!s) return undefined;
  const pet = trial.snapshot.household.pets[0];
  const name = trial.snapshot.animal.name;
  let narrative = s.narrative.replaceAll("{name}", name).replaceAll("{pet}", pet?.name ?? "A neighbour's dog");
  if (s.day === 4 && !pet) narrative = `A dog barked outside the window. ${name} moved toward the cardboard box, looking unsure.`;
  return { ...s, narrative };
}

export function createTrial(animal: Animal, household: HouseholdVersion, seed?: number, forkedFrom?: string): Trial {
  const s = seed ?? (Math.floor(Math.random() * 2 ** 31) + 1);
  const noise = animal.baselineTraits.noiseSensitivity?.value ?? 50;
  const conf = animal.baselineTraits.confidence?.value ?? 50;
  const init = { ...RULES.initialState, stress: clamp(50 + noise * 0.35 - conf * 0.1), curiosity: clamp(conf + 8) };
  return {
    trialId: uid("trial"), animalId: animal.animalId, status: "IN_PROGRESS", day: 1, seed: s, rngState: s,
    rulesVersion: RULES.rulesVersion,
    // Deep-copied immutable snapshot (FR-017). Firestore: trials/{id}.snapshot (write-once rule).
    snapshot: JSON.parse(JSON.stringify({ animal, household })),
    state: init, relationship: { familiarity: 0, comfort: 10, introductionStage: "SEPARATED" },
    freeActionsToday: RULES.freeActionsPerDay, stateVersion: 0, events: [], decisions: {},
    createdAt: new Date().toISOString(), forkedFrom,
  };
}

export type ActionResult = { ok: true; trial: Trial; event: TrialEvent } | { ok: false; reason: string; trial: Trial };

/** Validate & apply a free care action from the action tray (preview of POST /v1/trials/{id}/actions). */
export function applyCareAction(trial: Trial, actionId: ActionId, idempotencyKey: string): ActionResult {
  if (trial.events.some((e) => e.idempotencyKey === idempotencyKey)) return { ok: false, reason: "Duplicate request ignored.", trial };
  if (trial.status !== "IN_PROGRESS") return { ok: false, reason: "This trial is complete.", trial };
  if (actionId === "FORCE_DIRECT_MEETING") return { ok: false, reason: "Direct contact is locked — introductions stay gradual (DO_NOT_FORCE_DIRECT_CONTACT).", trial };
  if (trial.freeActionsToday <= 0) return { ok: false, reason: "That's enough care for today — continue to the day's moment.", trial };
  const rule = RULES.actions[actionId];
  const missing = rule.requiredResources.filter((r) => !trial.snapshot.household.resources.includes(r));
  if (missing.length) return { ok: false, reason: `Missing resource: ${missing.join(", ").toLowerCase().replace(/_/g, " ")}.`, trial };
  const before = trial.state;
  let after = applyDeltas(before, rule.deltas);
  if (actionId === "OBSERVE") after = applyDeltas(after, { humanTrust: 1, curiosity: 1 });
  const event: TrialEvent = { eventId: uid("ev"), day: trial.day, kind: "ACTION", code: actionId, label: actionId, provenance: "SIMULATED", before, after, idempotencyKey, at: new Date().toISOString() };
  return { ok: true, event, trial: { ...trial, state: after, freeActionsToday: trial.freeActionsToday - 1, stateVersion: trial.stateVersion + 1, events: [...trial.events, event] } };
}

export function previewEffects(trial: Trial, actionId: ActionId) {
  const d = RULES.actions[actionId].deltas;
  return { comfort: (d.environmentalComfort ?? 0) + (actionId === "CONTINUE_SEPARATION" ? 0 : 0), stress: d.stress ?? 0, familiarity: actionId === "SCENT_EXCHANGE" ? 2 : actionId === "CONTINUE_SEPARATION" ? 1 : actionId === "FORCE_DIRECT_MEETING" ? -3 : 0 };
}

/** Commit the day's scenario decision and simulate 48 half-hour ticks (idempotent on expectedDay). */
export function commitDay(trial: Trial, actionId: ActionId, expectedDay: number): ActionResult {
  if (trial.day !== expectedDay) return { ok: false, reason: "Day already advanced.", trial };
  const sc = scenarioFor(trial);
  if (!sc) return { ok: false, reason: "No scenario.", trial };
  if (sc.prohibitedActionIds.includes(actionId) || !sc.allowedActionIds.includes(actionId))
    return { ok: false, reason: "That choice isn't safe right now.", trial };
  const h = trial.snapshot.household;
  const a = trial.snapshot.animal;
  const events: TrialEvent[] = [];
  const now = new Date().toISOString();
  let s = trial.state;
  let rng = trial.rngState;
  const rel = { ...trial.relationship };

  // 1. scheduled environmental event of the day
  const envDelta = RULES.eventDeltas[sc.eventType];
  if (envDelta && (sc.eventType !== "DOG_BARK" || true)) {
    const b = s; s = applyDeltas(s, envDelta);
    events.push({ eventId: uid("ev"), day: trial.day, kind: "ENVIRONMENT", code: sc.eventType, label: sc.title, provenance: "SIMULATED", before: b, after: s, at: now });
  }
  // 2. decision
  const before = s;
  s = applyDeltas(s, RULES.actions[actionId].deltas);
  if (actionId === "SCENT_EXCHANGE") { rel.familiarity = clamp(rel.familiarity + 6); rel.introductionStage = "SCENT"; }
  if (actionId === "CONTINUE_SEPARATION") { rel.comfort = clamp(rel.comfort + 4); }
  const decision: TrialEvent = { eventId: uid("ev"), day: trial.day, kind: "SCENARIO_DECISION", code: actionId, label: sc.record, provenance: "SIMULATED", before, after: s, at: now };
  events.push(decision);

  // 3. care gap check on away days
  const awayToday = h.weeklySchedule.some((b) => b.type === "WORK_AWAY");
  const covered = h.caregivers.length > 0 || actionId === "ARRANGE_CAREGIVER" || Object.values(trial.decisions).includes("ARRANGE_CAREGIVER");
  if (trial.day === 3 && awayToday && !covered) {
    const b = s; s = applyDeltas(s, RULES.eventDeltas.CARE_GAP);
    events.push({ eventId: uid("ev"), day: trial.day, kind: "ENVIRONMENT", code: "CARE_GAP", label: "Long absence without care cover", provenance: "SIMULATED", before: b, after: s, at: now });
  }

  // 4. 48 ticks
  const retreat = h.safeRoomAvailable && h.resources.includes("HIDE_BOX");
  const noiseSens = (a.baselineTraits.noiseSensitivity?.value ?? 50) / 100;
  for (let i = 0; i < 48; i++) {
    let r: number; [r, rng] = rand(rng);
    s = applyDeltas(s, RULES.tickDeltas);
    if (i % 12 === 0 && h.resources.includes("FOOD_BOWL")) s = applyDeltas(s, { hunger: -18 });
    if (i % 8 === 0 && retreat) s = applyDeltas(s, RULES.eventDeltas.SAFE_QUIET_TIME);
    if (h.noiseLevel === "HIGH" && r < 0.08 * noiseSens * 2) s = applyDeltas(s, { stress: 1.5 });
    if (r > 0.6) s = applyDeltas(s, { humanTrust: 0.35, curiosity: 0.2 });
    if (i % 16 === 0) s = applyDeltas(s, { energy: 8 }); // rest periods
  }
  const done: TrialEvent = { eventId: uid("ev"), day: trial.day, kind: "DAY_COMPLETE", code: `DAY_${trial.day}_COMPLETE`, label: `Day ${trial.day} complete`, provenance: "SIMULATED", after: s, at: now };
  events.push(done);

  const nextDay = trial.day + 1;
  const finished = nextDay > 7;
  const next: Trial = {
    ...trial, state: s, rngState: rng, relationship: rel, day: nextDay, freeActionsToday: RULES.freeActionsPerDay,
    stateVersion: trial.stateVersion + 1, events: [...trial.events, ...events], decisions: { ...trial.decisions, [trial.day]: actionId },
    status: finished ? "COMPLETED" : "IN_PROGRESS", completedAt: finished ? now : undefined,
  };
  return { ok: true, trial: next, event: decision };
}

export function moodLabel(s: DynamicState) {
  if (s.stress > 65) return "Feeling unsure — needs quiet time";
  if (s.stress > 45) return "Exploring more and settling in!";
  if (s.humanTrust > 40) return "Growing in trust and confidence";
  return "Relaxed and curious";
}
