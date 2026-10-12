import type { Trial } from "@/lib/domain/types";
import { buildReport } from "@/lib/sim/report";
import { narrateReport } from "@/lib/ai/ai.functions";
import { mockNarrate } from "@/lib/ai/mock-llm";

/** Generate the grounded report; falls back to scripted narration if the LLM fails (FR-014). */
export async function finalizeTrial(trial: Trial): Promise<Trial> {
  const draft = buildReport(trial, "", "pending");
  const input = { animalName: trial.snapshot.animal.name, strengths: draft.strengths.map((s) => s.text), risks: draft.risks.map((r) => r.text), stress: trial.state.stress, trust: trial.state.humanTrust };
  let narrative: string; let modelId: string;
  try {
    const r = await narrateReport({ data: input });
    narrative = r.narrative; modelId = r.modelId;
  } catch {
    narrative = mockNarrate(input); modelId = "scripted-fallback";
  }
  return { ...trial, report: buildReport(trial, narrative, modelId) };
}
