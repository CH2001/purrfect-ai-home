// Grounded readiness report builder. Every finding references event ids (FR-016).
// The numeric engine produces the facts; the LLM (Gemini) may only *narrate* them.
import type { ReportDimension, Trial, TrialReport } from "@/lib/domain/types";

export function buildReport(trial: Trial, narrative: string, modelId: string): TrialReport {
  const ev = trial.events;
  const h = trial.snapshot.household;
  const a = trial.snapshot.animal;
  const ids = (codes: string[]) => ev.filter((e) => codes.includes(e.code)).map((e) => e.eventId);
  const d = trial.decisions;

  const retreatEv = ids(["ADD_RETREAT"]);
  const careGap = ev.find((e) => e.code === "CARE_GAP");
  const caregiver = ids(["ARRANGE_CAREGIVER"]);
  const intro = ids(["CONTINUE_SEPARATION", "SCENT_EXCHANGE"]);
  const play = ids(["PLAY", "FEED"]);
  const hasPet = h.pets.length > 0;
  const missingRes = ["WATER_BOWL", "FOOD_BOWL", "HIDE_BOX", "REST_BED", "TOY"].filter((r) => !h.resources.includes(r));

  const dims: ReportDimension[] = [
    { key: "HOME_RESOURCES", label: "Home resources", status: missingRes.length === 0 && h.safeRoomAvailable ? "PREPARED" : "NEEDS_ACTION", score: Math.max(1, 5 - missingRes.length - (h.safeRoomAvailable ? 0 : 2)), evidence: retreatEv },
    { key: "DAILY_CARE", label: "Daily care needs", status: careGap ? "NEEDS_ACTION" : "PREPARED", score: careGap ? 2 : caregiver.length ? 5 : 4, evidence: careGap ? [careGap.eventId] : caregiver },
    { key: "PET_INTRODUCTIONS", label: "Pet introductions", status: hasPet ? "GRADUAL_PLAN" : "UNKNOWN", score: hasPet ? Math.min(5, 1 + intro.length) : 0, evidence: intro },
    { key: "ADOPTION_READINESS", label: "Adoption readiness", status: trial.state.stress < 55 ? "PREPARED" : "NEEDS_ACTION", score: Math.round(Math.max(1, Math.min(5, (100 - trial.state.stress + trial.state.humanTrust) / 30))), evidence: play },
  ];

  const missedMeals = (trial.dayLogs ?? []).reduce((n, l) => n + l.missed.filter((m) => /meal|Breakfast|Dinner/i.test(m)).length, 0);
  const lonelyDays = (trial.dayLogs ?? []).filter((l) => l.missed.some((m) => /interaction/i.test(m))).length;

  const risks: TrialReport["risks"] = [];
  if (careGap) risks.push({ text: "Long office days with no care cover were simulated.", severity: "MEDIUM", mitigation: "Arrange a midday caregiver or check-in on WORK_AWAY days." });
  if (missedMeals >= 2) risks.push({ text: `Meals were missed on ${missedMeals} occasion${missedMeals > 1 ? "s" : ""} during the trial.`, severity: "MEDIUM", mitigation: "Set feeding reminders or use a timed feeder on busy days." });
  if (lonelyDays >= 2) risks.push({ text: `${a.name} went without interaction on ${lonelyDays} days.`, severity: "MEDIUM", mitigation: "Plan short daily play or check-in moments, especially for sociable animals." });
  missingRes.forEach((r) => risks.push({ text: `Missing resource: ${r.toLowerCase().replace(/_/g, " ")}.`, severity: "LOW", mitigation: "Add it before arrival day." }));
  if (h.safeRoomAvailable === false) risks.push({ text: "No separate room available for gradual introductions.", severity: "HIGH", mitigation: "Plan a gated or partitioned safe zone." });
  if (hasPet && (h.pets[0].catCohabitation === "UNKNOWN" || h.pets[0].catCohabitation === "UNSURE"))
    risks.push({ text: `${h.pets[0].name}'s history living with ${a.species === "CAT" ? "cats" : "dogs"} is unknown.`, severity: "MEDIUM", mitigation: "Keep separation as default; progress only with rescuer guidance." });

  const uncertainties = Object.entries(a.baselineTraits).filter(([, t]) => t.value === null).map(([k]) => `${a.name}'s ${k.replace(/([A-Z])/g, " $1").toLowerCase()} is UNKNOWN — this is not the same as low risk.`);
  uncertainties.push("All animal traits in this demo are synthetic; health status requires vet review.");

  const strengths: TrialReport["strengths"] = [];
  if (retreatEv.length) strengths.push({ text: "You prepared a safe retreat space.", evidence: retreatEv });
  if (intro.length) strengths.push({ text: "You kept introductions gradual and choice-based.", evidence: intro });
  if (caregiver.length) strengths.push({ text: "You arranged care cover for away days.", evidence: caregiver });
  if (play.length) strengths.push({ text: "You offered enrichment and routine meals.", evidence: play });
  if (missedMeals === 0 && (trial.dayLogs ?? []).length > 0) strengths.push({ text: "You kept a reliable feeding routine every day.", evidence: play });

  const needs = dims.filter((x) => x.status === "NEEDS_ACTION").length;
  const summary: TrialReport["summary"] = needs === 0 ? "PREPARED" : needs <= 2 ? "NEEDS_ACTION" : "UNKNOWN";
  return {
    summary,
    headline: summary === "PREPARED" ? "Potentially suitable with preparation" : summary === "NEEDS_ACTION" ? "A few areas need preparation" : "More information needed",
    narrative,
    dimensions: dims, strengths, risks, uncertainties,
    recommendations: [
      `Ask the rescuer how ${a.name} has reacted to ${hasPet ? h.pets[0].species.toLowerCase() + "s" : "other animals"} in real life.`,
      "Request vaccination and sterilisation records.",
      "Arrange a supervised, rescuer-led meet-and-greet before any decision.",
      ...(d[4] === "SCENT_EXCHANGE" ? ["Continue scent swapping for several days before any visual contact."] : []),
    ],
    provenance: { modelId, promptVersion: "report-v1.1", rulesVersion: trial.rulesVersion, seed: trial.seed },
    generatedAt: new Date().toISOString(),
  };
}
