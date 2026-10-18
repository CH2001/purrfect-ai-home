import type { Trial } from "@/lib/domain/types";
export function reactionContext(trial: Trial) {
  return {
    animal: trial.snapshot.animal, day: trial.day, state: trial.state,
    relationship: trial.relationship,
    recentCare: trial.events.filter(e => e.kind === "ACTION" || e.kind === "SCENARIO_DECISION").slice(-6).map(e => ({ day: e.day, action: e.code })),
    dayLog: trial.dayLogs?.at(-1),
  };
}
export function scriptedReaction(trial: Trial) {
  const last = trial.events.filter(e => e.kind === "ACTION" || e.kind === "SCENARIO_DECISION").at(-1);
  const name = trial.snapshot.animal.name;
  const text = last?.code === "FEED" ? name + " pauses near the bowl after your feeding action."
    : last?.code === "PLAY" ? name + " notices the toy and explores at their own pace."
    : last?.code === "OBSERVE" ? name + " has space to watch you without being rushed."
    : name + (trial.state.stress >= 65 ? " keeps close to a retreat while getting used to the room." : " explores the room at their own pace.");
  return { reaction: text + " This is an illustrative reaction in your virtual trial.", suggestion: trial.state.hunger > 65 ? "Check the food bowl." : "Offer a quiet retreat and let your pet choose when to approach.", source: "scripted" as "scripted" | "gemini" };
}
