import { ANIMALS } from "@/lib/data/seed";
import type { Command } from "@/lib/domain/validation";
import type { AppState } from "./state";
import { applyCareAction, commitDay, createTrial } from "@/lib/sim/engine";
import { buildReport } from "@/lib/sim/report";
import { mockNarrate } from "@/lib/ai/mock-llm";

export class CommandError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** The server accepts intent only. No client-supplied state, scores or reports. */
export function executeCommand(state: AppState, command: Command, requestId: string): { state: AppState; trialId?: string } {
  const current = state.householdVersions.find(v => v.versionId === state.activeVersionId)!;
  if (command.kind === "preferences") {
    const patch = command.patch;
    for (const id of [...(patch.favorites ?? []), ...(patch.passed ?? [])]) {
      if (!ANIMALS.some(a => a.animalId === id && a.status === "APPROVED")) throw new CommandError(400, "Unknown animal.");
    }
    return { state: { ...state, ...patch } };
  }
  if (command.kind === "household") {
    if (current.revision !== command.expectedRevision) throw new CommandError(409, "Your household changed. Reload and review your edits.");
    const version = { ...current, ...command.patch, source: command.source, revision: current.revision + 1, versionId: `v${current.revision + 1}`, createdAt: new Date().toISOString() };
    return { state: { ...state, activeVersionId: version.versionId, householdVersions: [...state.householdVersions, version] } };
  }
  if (command.kind === "createTrial") {
    const animal = ANIMALS.find(a => a.animalId === command.animalId && a.status === "APPROVED");
    if (!animal) throw new CommandError(404, "Animal is unavailable.");
    const parent = command.forkedFrom ? state.trials.find(t => t.trialId === command.forkedFrom) : undefined;
    if (command.forkedFrom && (!parent || parent.animalId !== animal.animalId)) throw new CommandError(404, "Original trial is unavailable.");
    const existing = !parent && state.trials.find(t => t.animalId === animal.animalId && t.status === "IN_PROGRESS");
    if (existing) return { state, trialId: existing.trialId };
    const trial = createTrial(animal, current, parent?.seed, parent?.trialId);
    trial.trialId = `trial_${requestId}`;
    return { state: { ...state, trials: [trial, ...state.trials] }, trialId: trial.trialId };
  }
  const trial = state.trials.find(t => t.trialId === command.trialId);
  if (!trial) throw new CommandError(404, "Trial not found.");
  if (trial.status !== "IN_PROGRESS") throw new CommandError(409, "Trial is already complete.");
  if (trial.stateVersion !== command.expectedStateVersion) throw new CommandError(409, "The trial changed. Reload before trying again.");
  const result = command.kind === "care"
    ? applyCareAction(trial, command.actionId, requestId)
    : commitDay(trial, command.actionId, command.expectedDay);
  if (!result.ok) throw new CommandError(400, result.reason);
  let next = result.trial;
  if (next.status === "COMPLETED") {
    const draft = buildReport(next, "", "scripted-fallback");
    const narrative = mockNarrate({ animalName: next.snapshot.animal.name, strengths: draft.strengths.map(s => s.text), risks: draft.risks.map(r => r.text), stress: next.state.stress, trust: next.state.humanTrust });
    next = { ...next, report: buildReport(next, narrative, "scripted-fallback") };
  }
  return { state: { ...state, trials: state.trials.map(t => t.trialId === next.trialId ? next : t) }, trialId: next.trialId };
}
