// Day & night life simulator — deterministic, presentation-only layer (FR-011: no LLM in the loop).
// Generates each trial day's simulated rhythm: morning vocalisations, feeding windows,
// gradual behaviour changes, loneliness from the animal's sociability profile, and a
// daily summary of what the pet experienced and what the owner missed.
// Production: this runs inside the Cloud Run service alongside POST /v1/trials/{id}/days/{day}:commit;
// this client copy is the preview engine and must replay identically from the trial seed.
import type { ActionId, Animal, BehaviorLogEntry, DayLog, DayPhase, Trial } from "@/lib/domain/types";
import { rand } from "@/lib/sim/prng";

const DAY_START = 7 * 60; // 07:00
const DAY_END = 23 * 60; // 23:00
const SLOT = 30; // minutes per simulation slot
const MIN_DWELL_SLOTS = 3; // behaviour changes are gradual: at least 90 minutes between switches

const hhmm = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

export function phaseOf(mins: number): DayPhase {
  if (mins < 10 * 60) return "MORNING";
  if (mins < 17 * 60) return "MIDDAY";
  if (mins < 21 * 60) return "EVENING";
  return "NIGHT";
}

/** How much company this animal needs, 0..100. UNKNOWN traits stay neutral (50) — never assumed. */
export function clinginess(a: Animal): number {
  const social = a.baselineTraits.socialApproach?.value ?? 50;
  const sep = a.baselineTraits.separationSensitivity?.value ?? 50;
  return Math.round(social * 0.6 + sep * 0.4);
}

/** Slots (30 min each) the animal tolerates without interaction before loneliness is logged. */
const aloneLimitSlots = (a: Animal) => {
  const c = clinginess(a);
  return c >= 55 ? 6 : c < 40 ? 16 : 10; // clingy 3h · average 5h · independent 8h
};

const VOCAL: Record<"CAT" | "DOG", [string, string]> = {
  CAT: ["meows softly", "meows again, louder — still no answer"],
  DOG: ["gives a soft morning woof", "whines and barks — still no answer"],
};

type BehaviorKey = "hide" | "rest" | "explore" | "play" | "bowl" | "window" | "groom";

function behaviors(a: Animal): Record<BehaviorKey, string> {
  return a.species === "CAT"
    ? { hide: "hides in the retreat box", rest: "naps on the bed", explore: "explores the room cautiously", play: "bats a toy around", bowl: "sits by the food bowl", window: "watches birds from the window", groom: "grooms quietly" }
    : { hide: "retreats to the crate", rest: "dozes on the dog bed", explore: "sniffs around the room", play: "chews a toy", bowl: "waits by the food bowl", window: "watches out the window", groom: "licks its paws and settles" };
}

function pickBehavior(s: Trial["state"], a: Animal, r: number): BehaviorKey {
  if (s.stress > 60) return "hide";
  if (s.hunger > 65) return "bowl";
  if (r < 0.3) return "rest";
  if (s.energy > 55 && r < 0.55) return (a.baselineTraits.activityLevel?.value ?? 50) > 60 ? "play" : "explore";
  if (r < 0.75) return "window";
  return "groom";
}

const ATTENTION_ACTIONS: ActionId[] = ["FEED", "PLAY", "OBSERVE"];

/**
 * Simulate one full day (07:00–23:00) of life for the trial animal.
 * Feeding/attention come from the care actions the owner actually took that day,
 * so missed meals and long alone stretches are captured honestly in the log.
 */
export function simulateDayLife(trial: Trial, decision: ActionId, rngIn: number): { log: DayLog; rng: number } {
  const a = trial.snapshot.animal;
  const name = a.name;
  const cat = a.species === "CAT";
  const B = behaviors(a);
  const day = trial.day;
  const entries: BehaviorLogEntry[] = [];
  let rng = rngIn;
  const roll = () => {
    let r: number;
    [r, rng] = rand(rng);
    return r;
  };
  const push = (mins: number, kind: BehaviorLogEntry["kind"], text: string) =>
    entries.push({ day, at: hhmm(mins), phase: phaseOf(mins), kind, text });

  const today = trial.events.filter((e) => e.day === day);
  const feeds = today.filter((e) => e.code === "FEED").length + (decision === "FEED" ? 1 : 0);
  const attention = today.filter((e) => ATTENTION_ACTIONS.includes(e.code as ActionId)).length + (ATTENTION_ACTIONS.includes(decision) ? 1 : 0);

  const fedMorning = feeds >= 1;
  const fedEvening = feeds >= 2;
  const limit = aloneLimitSlots(a);
  const clingy = clinginess(a) >= 55;
  const independent = clinginess(a) < 40;

  // Attention moments sprinkled through the waking day.
  const attentionSlots = [4, 12, 20, 26].slice(0, attention);

  // Morning greeting — and a louder follow-up if nobody responds within 30 minutes.
  push(DAY_START + 10, "VOCAL", `${name} ${VOCAL[a.species][0]}.`);
  if (attention === 0) push(DAY_START + 40, "VOCAL", `No attention for 30 minutes — ${name} ${VOCAL[a.species][1]}.`);
  else push(DAY_START + 40, "ATTENTION", `You greet ${name} — ${cat ? "a happy purr" : "a wagging tail"}.`);

  // Feeding windows: breakfast 07:00–09:00, dinner 18:00–20:00.
  if (fedMorning) push(8 * 60 + 5, "FEEDING", `${name} eats breakfast.`);
  else push(9 * 60 + 30, "MISSED", `Morning meal was missed — ${name} waits by the empty bowl, ${cat ? "meowing" : "whining"}.`);
  if (fedEvening) push(18 * 60 + 30, "FEEDING", `${name} eats dinner.`);
  else push(20 * 60 + 30, "MISSED", `Evening meal was missed — ${name} is hungry and restless.`);

  // Behaviour chain — gradual: at least MIN_DWELL_SLOTS between changes, chosen from state.
  let current: BehaviorKey = trial.state.stress > 55 ? "hide" : "rest";
  let sinceChange = MIN_DWELL_SLOTS;
  push(DAY_START, "BEHAVIOR", `${name} ${B[current]}.`);
  let aloneStreak = attention > 0 ? 0 : 2;
  let lonelyLogged = false;

  for (let i = 2; i < (DAY_END - DAY_START) / SLOT; i++) {
    const mins = DAY_START + i * SLOT;
    if (attentionSlots.includes(i)) {
      aloneStreak = 0;
      if (i > 4) push(mins, "ATTENTION", `You spend a little time with ${name}.`);
    } else aloneStreak++;

    if (!lonelyLogged && aloneStreak > limit && mins < 21 * 60) {
      lonelyLogged = true;
      push(
        mins,
        "LONELINESS",
        independent
          ? `${name} is content alone — ${cat ? "curled up napping" : "resting calmly"}.`
          : `${name} seems lonely — ${cat ? "sitting by the door, calling softly" : "pacing and sighing near the door"}.`,
      );
    }
    if (aloneStreak <= limit) lonelyLogged = false;

    // Scenario flavour for days 2–7: the day's event shows up in the animal's behaviour.
    if (day === 4 && mins === 12 * 60) {
      push(mins, "BEHAVIOR", `Barking nearby — ${name} startles and ${cat ? "dives into the hide box" : "retreats to the crate"}.`);
      current = "hide";
      sinceChange = 0;
      continue;
    }
    if (day === 6 && mins === 19 * 60) push(mins, "BEHAVIOR", `The doorbell rings loudly — ${name} startles.`);
    if (day === 3 && mins === 13 * 60) push(mins, "BEHAVIOR", `The flat is quiet — everyone is at work.`);

    sinceChange++;
    if (sinceChange >= MIN_DWELL_SLOTS && roll() < 0.45) {
      const nextB = pickBehavior(trial.state, a, roll());
      if (nextB !== current) {
        current = nextB;
        sinceChange = 0;
        push(mins, "BEHAVIOR", `${name} ${B[current]}.`);
      }
    }
  }
  push(22 * 60 + 30, "REST", `${name} settles down to sleep for the night.`);

  // Daily summary: what the pet experienced and what the owner missed.
  const experienced: string[] = [];
  const missed: string[] = [];
  experienced.push(fedMorning && fedEvening ? "Ate both meals on schedule." : fedMorning || fedEvening ? "Ate one of two meals." : "Had no proper meals today.");
  if (attention > 0) experienced.push(`Had ${attention} moment${attention > 1 ? "s" : ""} of attention and care.`);
  experienced.push(trial.state.stress > 60 ? "Spent much of the day hiding and tense." : trial.state.energy > 55 ? "Explored and played during the day." : "Rested quietly for most of the day.");
  if (!fedMorning) missed.push("Breakfast was not given.");
  if (!fedEvening) missed.push("Dinner was not given.");
  if (attention === 0)
    missed.push(clingy ? `${name} had no interaction all day — a clingy ${cat ? "cat" : "dog"} struggles with that.` : `No interaction today — ${name} coped, but still needs company sometimes.`);
  if (trial.state.stress > 65) missed.push("Stress stayed high — more quiet retreat time would help.");

  return { log: { day, entries, experienced, missed }, rng };
}

/** Live snapshot of the current (not yet committed) day, shown in the trial pane. */
export function liveDayEntries(trial: Trial): BehaviorLogEntry[] {
  const a = trial.snapshot.animal;
  const cat = a.species === "CAT";
  const day = trial.day;
  const used = trial.events.filter((e) => e.day === day && e.kind === "ACTION").length;
  const fed = trial.events.some((e) => e.day === day && e.code === "FEED");
  const entries: BehaviorLogEntry[] = [];
  const push = (mins: number, kind: BehaviorLogEntry["kind"], text: string) =>
    entries.push({ day, at: hhmm(mins), phase: phaseOf(mins), kind, text });

  push(DAY_START + 10, "VOCAL", `${a.name} ${VOCAL[a.species][0]}.`);
  if (used === 0) push(DAY_START + 40, "VOCAL", `No attention for 30 minutes — ${a.name} ${VOCAL[a.species][1]}.`);
  if (fed) push(8 * 60 + 5, "FEEDING", `${a.name} eats breakfast.`);
  else push(9 * 60 + 30, "MISSED", `${a.name} is still waiting for breakfast…`);
  if (used === 0)
    push(12 * 60, "LONELINESS", clinginess(a) >= 55 ? `${a.name} seems lonely — ${cat ? "calling softly by the door" : "sighing near the door"}.` : `${a.name} is content alone for now.`);
  const s = trial.state;
  const B = behaviors(a);
  push(14 * 60, "BEHAVIOR", s.stress > 60 ? `${a.name} ${B.hide}.` : s.hunger > 65 ? `${a.name} ${B.bowl}.` : s.energy > 55 ? `${a.name} ${B.explore}.` : `${a.name} ${B.rest}.`);
  return entries;
}
