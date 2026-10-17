// Attention alerts — presentation-only nudges during a trial. Never mutate trial state.
import type { Trial } from "@/lib/domain/types";
import { clinginess } from "@/lib/sim/daylife";

export type AttentionNeed = { kind: "HUNGRY" | "CALLING"; title: string; body: string; action: "FEED" | "OBSERVE" };

/** Real seconds without care before the pet calls out: clingy 45s · average 75s · independent 120s. */
export function idleLimitSeconds(trial: Trial) {
  const c = clinginess(trial.snapshot.animal);
  return c >= 55 ? 45 : c < 40 ? 120 : 75;
}

export function attentionNeed(trial: Trial, idleSeconds: number): AttentionNeed | null {
  if (trial.status !== "IN_PROGRESS") return null;
  const a = trial.snapshot.animal;
  const cat = a.species === "CAT";
  if (trial.state.hunger > 65)
    return { kind: "HUNGRY", action: "FEED", title: `${a.name} is hungry`, body: `${cat ? "Meowing" : "Whining"} by the empty bowl.` };
  if (idleSeconds >= idleLimitSeconds(trial))
    return { kind: "CALLING", action: "OBSERVE", title: `${a.name} ${cat ? "is meowing" : "is barking"} for you`, body: "No attention for a while — check in?" };
  return null;
}
