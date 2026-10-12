// MOCK LLM — deterministic, rule-based stand-in for Gemini on Vertex AI.
// Output shapes match the JSON schemas the real model is constrained to
// (responseSchema / structured output). Replace via src/server/ai.functions.ts.
import type { Day, ExtractedFact, HouseholdVersion, ProposedChange, ScheduleBlock } from "@/lib/domain/types";
import { DAYS } from "@/lib/domain/types";

const DAY_ALIASES: Record<string, Day> = { mon: "MON", tue: "TUE", wed: "WED", thu: "THU", fri: "FRI", sat: "SAT", sun: "SUN" };
function parseRange(a: string, b?: string): Day[] {
  const s = DAY_ALIASES[a.slice(0, 3).toLowerCase()];
  if (!s) return [];
  if (!b) return [s];
  const e = DAY_ALIASES[b.slice(0, 3).toLowerCase()];
  return DAYS.slice(DAYS.indexOf(s), DAYS.indexOf(e) + 1);
}
const hhmm = (n: string) => {
  let h = parseInt(n, 10);
  if (h < 8) h += 12; // "9 to 6" -> 18:00
  return `${String(h).padStart(2, "0")}:00`;
};
const DAY_RE = "(mon|tue|wed|thu|fri|sat|sun)[a-z]*";

export interface ExtractionResult {
  facts: ExtractedFact[];
  patch: Partial<HouseholdVersion>;
  followUp: { field: string; question: string; hint: string; options: string[] } | null;
  reply: string;
}

export function mockExtractHousehold(message: string, current: Partial<HouseholdVersion>): ExtractionResult {
  const m = message.toLowerCase();
  const facts: ExtractedFact[] = [];
  const patch: Partial<HouseholdVersion> = {};
  const schedule: ScheduleBlock[] = [];

  const office = m.match(new RegExp(`office[^.]*?${DAY_RE}\\s*(?:-|–|to)\\s*${DAY_RE}(?:[^.\\d]*(\\d{1,2})\\s*(?:am)?\\s*(?:-|to|–)\\s*(\\d{1,2}))?`));
  if (office) {
    const days = parseRange(office[1], office[2]);
    const start = office[3] ? hhmm(office[3]) : "09:00";
    const end = office[4] ? hhmm(office[4]) : "18:00";
    schedule.push({ days, start, end, type: "WORK_AWAY" });
    facts.push({ field: "officeDays", label: "Office days", value: `${days[0]}–${days.at(-1)} ${start}–${end}`, quote: office[0], provenance: "USER_REPORTED", confidence: 0.9 });
  }
  const wfh = m.match(new RegExp(`(?:from home|wfh|remote)[^.]*?${DAY_RE}(?:\\s*(?:-|–|to)\\s*${DAY_RE})?`));
  if (wfh) {
    const days = parseRange(wfh[1], wfh[2]);
    schedule.push({ days, start: "09:00", end: "18:00", type: "WORK_FROM_HOME" });
    facts.push({ field: "wfhDays", label: "Work from home", value: `${days[0]}${days.length > 1 ? "–" + days.at(-1) : ""}`, quote: wfh[0], provenance: "USER_REPORTED", confidence: 0.85 });
  }
  if (schedule.length) {
    patch.weeklySchedule = schedule;
    facts.unshift({ field: "workStyle", label: "Work style", value: office && wfh ? "Hybrid work" : office ? "Office" : "Remote", provenance: "USER_REPORTED", confidence: 0.8 });
  }

  const pet = m.match(/(dog|cat)\s+(?:named|called)\s+([a-z]+)/);
  if (pet) {
    const species = pet[1] === "dog" ? "DOG" : "CAT";
    const name = pet[2][0].toUpperCase() + pet[2].slice(1);
    const excited = /excited|barks|chase/.test(m) && /cat/.test(m.replace(pet[0], ""));
    patch.pets = [{ petId: `pet_${name.toLowerCase()}`, name, species, ageMonths: null, energy: /excit|energetic|hyper/.test(m) ? "HIGH" : null, sociability: null,
      reactsToCats: excited ? (/bark/.test(m) ? "BARKS" : "CURIOUS") : null, catCohabitation: "UNKNOWN",
      observedBehaviors: excited ? [{ code: "EXCITED_AROUND_CATS", source: "USER_REPORTED", context: "User description" }] : [] }];
    facts.push({ field: "pet", label: "Existing pet", value: `${pet[1] === "dog" ? "Dog" : "Cat"}: ${name}`, quote: pet[0], provenance: "USER_REPORTED", confidence: 0.95 });
    if (excited) facts.push({ field: "petBehavior", label: "Pet behaviour", value: "Gets excited around cats", provenance: "USER_REPORTED", confidence: 0.7 });
    facts.push({ field: "catCohabitation", label: "Cat cohabitation", value: "Unknown", provenance: "UNKNOWN", confidence: 1 });
  } else if (/no (other )?pets|don't have (any )?pets/.test(m)) {
    patch.pets = [];
    facts.push({ field: "pet", label: "Existing pet", value: "None", provenance: "USER_REPORTED", confidence: 0.9 });
  }
  const home = m.match(/\b(apartment|condo|house|terrace|flat)\b/);
  if (home) {
    patch.homeType = home[1] === "flat" ? "APARTMENT" : (home[1].toUpperCase() as HouseholdVersion["homeType"]);
    facts.push({ field: "homeType", label: "Home type", value: home[1][0].toUpperCase() + home[1].slice(1), quote: home[0], provenance: "USER_REPORTED", confidence: 0.9 });
  }
  if (/quiet/.test(m)) { patch.noiseLevel = "LOW"; facts.push({ field: "noiseLevel", label: "Noise", value: "Low", provenance: "USER_REPORTED", confidence: 0.7 }); }
  if (/noisy|loud|busy road/.test(m)) { patch.noiseLevel = "HIGH"; facts.push({ field: "noiseLevel", label: "Noise", value: "High", provenance: "USER_REPORTED", confidence: 0.7 }); }
  const cg = m.match(/(mum|mom|mother|dad|partner|sister|brother|friend|neighbou?r|helper)[^.]*?(?:visit|check|come|help)/);
  if (cg) { patch.caregivers = [{ name: cg[1][0].toUpperCase() + cg[1].slice(1), days: ["MON", "TUE", "WED"] }]; facts.push({ field: "caregiver", label: "Caregiver", value: patch.caregivers[0].name, quote: cg[0], provenance: "USER_REPORTED", confidence: 0.75 }); }

  // One prioritized follow-up (safety relevance first, FR-003)
  const merged = { ...current, ...patch };
  let followUp: ExtractionResult["followUp"] = null;
  if (merged.safeRoomAvailable == null) followUp = { field: "safeRoomAvailable", question: "Do you have a separate room for a new pet?", hint: "This can help them adjust more easily during the first few weeks.", options: ["Yes", "No", "Not sure"] };
  else if (!merged.homeType) followUp = { field: "homeType", question: "What kind of home do you live in?", hint: "Space and layout affect how pets settle in.", options: ["Apartment", "House", "Condo"] };
  else if (merged.noiseLevel == null) followUp = { field: "noiseLevel", question: "How noisy is your home usually?", hint: "Cautious animals can be sensitive to noise.", options: ["Low", "Moderate", "High"] };
  else if (!merged.caregivers?.length && merged.weeklySchedule?.some((b) => b.type === "WORK_AWAY")) followUp = { field: "caregiver", question: "Is anyone around to help on your office days?", hint: "Care cover matters during long absences.", options: ["Yes", "No", "Not sure"] };

  const reply = facts.length ? "Thanks! Here's what I've understood so far. Let me know if anything looks different." : "I didn't quite catch specifics there — could you share your work days, home type, or any current pets?";
  return { facts, patch, followUp, reply };
}

/** Change-only extraction for periodic profile review (FR-024). Never overwrites unchanged fields. */
export function mockExtractChanges(message: string, current: HouseholdVersion): ProposedChange[] {
  const r = mockExtractHousehold(message, current);
  const changes: ProposedChange[] = [];
  const fmtSched = (s: ScheduleBlock[]) => s.map((b) => `${b.days[0]}${b.days.length > 1 ? "–" + b.days.at(-1) : ""} ${b.type.replace(/_/g, " ").toLowerCase()}`).join(", ");
  if (r.patch.weeklySchedule) {
    // Merge: only replace blocks for the days that were mentioned
    const touched = new Set(r.patch.weeklySchedule.flatMap((b) => b.days));
    const kept = current.weeklySchedule.map((b) => ({ ...b, days: b.days.filter((d) => !touched.has(d)) })).filter((b) => b.days.length);
    const next = [...kept, ...r.patch.weeklySchedule];
    changes.push({ field: "weeklySchedule", label: "Weekly routine", before: fmtSched(current.weeklySchedule), after: fmtSched(next), quote: r.facts.find((f) => f.quote)?.quote, apply: { weeklySchedule: next } });
  }
  if (r.patch.homeType && r.patch.homeType !== current.homeType) changes.push({ field: "homeType", label: "Home type", before: current.homeType ?? "Unknown", after: r.patch.homeType, apply: { homeType: r.patch.homeType } });
  if (r.patch.noiseLevel && r.patch.noiseLevel !== current.noiseLevel) changes.push({ field: "noiseLevel", label: "Noise level", before: current.noiseLevel ?? "Unknown", after: r.patch.noiseLevel, apply: { noiseLevel: r.patch.noiseLevel } });
  if (r.patch.caregivers) changes.push({ field: "caregivers", label: "Caregivers", before: current.caregivers.map((c) => c.name).join(", ") || "None", after: r.patch.caregivers.map((c) => c.name).join(", "), apply: { caregivers: r.patch.caregivers } });
  if (r.patch.pets && JSON.stringify(r.patch.pets.map((p) => p.name)) !== JSON.stringify(current.pets.map((p) => p.name))) {
    const add = r.patch.pets.filter((p) => !current.pets.some((c) => c.name === p.name));
    const next = r.patch.pets.length === 0 ? [] : [...current.pets, ...add];
    changes.push({ field: "pets", label: "Resident pets", before: current.pets.map((p) => p.name).join(", ") || "None", after: next.map((p) => p.name).join(", ") || "None", apply: { pets: next } });
  }
  if (/moved|new (home|place)/.test(message.toLowerCase()) && !r.patch.homeType) changes.push({ field: "homeType", label: "Home type", before: current.homeType ?? "Unknown", after: "Unknown — please confirm", apply: { homeType: null } });
  return changes;
}

export function mockNarrate(input: { animalName: string; strengths: string[]; risks: string[]; stress: number; trust: number }) {
  const mood = input.stress < 50 ? "settled noticeably" : "is still adjusting";
  return `Over this simulated week, ${input.animalName} ${mood} in your home. ${input.strengths[0] ?? "You took a careful approach."} ${input.risks.length ? `Worth preparing: ${input.risks[0]}` : "No major care gaps appeared in this rehearsal."} Remember: this is an educational rehearsal, not a prediction of real behaviour.`;
}

export function mockChatReply(message: string) {
  const m = message.toLowerCase();
  if (/litter|toilet/.test(m)) return "Place the litter box in a quiet corner away from food and water. One box per cat plus one extra is a common guideline — ask your rescuer for specifics.";
  if (/introduc|meet/.test(m)) return "Go slowly: separation first, then scent swaps, then brief visual contact through a gate — always led by how both animals respond.";
  return "Great question! I'm a demo companion, so my tips are general. Your rescuer and vet are the best sources for advice about a specific animal.";
}
