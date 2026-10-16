import type { Animal, HouseholdVersion } from "@/lib/domain/types";

export interface HouseholdMatch {
  priority: number; // Ordering aid only, never a compatibility probability.
  reasons: string[];
  cautions: string[];
  unknowns: string[];
}

/** Presentation-only matching. Production requirements must come from the shelter;
 * AI may explain these findings but must not invent facts or approve adoption. */
export function matchHousehold(animal: Animal, home: HouseholdVersion): HouseholdMatch {
  const result: HouseholdMatch = { priority: 0, reasons: [], cautions: [], unknowns: [] };
  const trait = (key: string) => {
    const value = animal.baselineTraits[key];
    return value?.source === "UNKNOWN" ? null : value?.value ?? null;
  };
  const sensitivity = trait("noiseSensitivity");
  const activity = trait("activityLevel");
  if (home.noiseLevel === "LOW") {
    result.reasons.push("Your quieter home offers a calmer setting.");
    result.priority += sensitivity !== null && sensitivity >= 60 ? 2 : 1;
  } else if (home.noiseLevel === "HIGH" && sensitivity !== null && sensitivity >= 60) {
    result.cautions.push("Noise sensitivity calls for a quiet retreat and a noise plan.");
    result.priority -= 2;
  }
  if (!home.noiseLevel || sensitivity === null) result.unknowns.push("Noise needs need confirmation.");
  if (home.safeRoomAvailable && home.resources.includes("HIDE_BOX")) {
    result.reasons.push("A separate room and hiding spot support a gradual arrival.");
    result.priority += 1;
  } else {
    result.cautions.push("Confirm a separate retreat before bringing a new pet home.");
    result.priority -= 1;
  }
  if (activity !== null && activity >= 60) {
    if (home.resources.includes("TOY")) {
      result.reasons.push("Your enrichment supplies support this pet’s active routine.");
      result.priority += 1;
    } else {
      result.cautions.push("Plan daily enrichment for this active pet.");
      result.priority -= 1;
    }
  }
  const minutes = (time: string) => {
    const [hours, mins] = time.split(":").map(Number);
    return Number.isFinite(hours) && Number.isFinite(mins) ? hours * 60 + mins : 0;
  };
  const uncoveredDays = new Set<string>();
  for (const block of home.weeklySchedule) {
    if (block.type !== "WORK_AWAY" && block.type !== "AWAY") continue;
    const duration = (minutes(block.end) - minutes(block.start) + 1440) % 1440;
    if (duration >= 480) {
      for (const day of block.days) {
        if (!home.caregivers.some((caregiver) => caregiver.days.includes(day))) uncoveredDays.add(day);
      }
    }
  }
  if (uncoveredDays.size) {
    result.cautions.push(`Arrange care for long absences on ${[...uncoveredDays].join(", ")}.");
    result.priority -= 1;
  }
  if (!home.weeklySchedule.length) result.unknowns.push("Your daily care schedule is not recorded.");
  for (const species of new Set(home.pets.map((pet) => pet.species))) {
    const reactivity = trait(species === "CAT" ? "catReactivity" : "dogReactivity");
    if (reactivity === null) result.unknowns.push(`Compatibility with your resident ${species === "CAT" ? "cat" : "dog"} is unknown.`);
    else result.unknowns.push(`A recorded reaction is not proof of compatibility with your resident ${species === "CAT" ? "cat" : "dog"}; ask the rescuer.`);
  }
  if (animal.species === "CAT" && home.pets.some((pet) => pet.species === "DOG" && (pet.reactsToCats === "CHASES" || pet.catCohabitation === "NOT_SUITABLE"))) {
    result.cautions.push("Your dog’s reported cat reactions need a professional introduction assessment.");
    result.priority -= 4;
  }
  if (animal.healthInfo.vaccinationStatus === "UNKNOWN" || animal.healthInfo.sterilizationStatus === "UNKNOWN") {
    result.unknowns.push("Confirm vaccination, sterilisation and care needs with the rescuer.");
  }
  result.unknowns.push("Shelter eligibility requirements have not been supplied.");
  return result;
}

export function swipeDecision(dx: number, dy: number, width: number): "save" | "pass" | null {
  if (Math.abs(dx) < Math.max(60, width * 0.22) || Math.abs(dx) < Math.abs(dy) * 1.3) return null;
  return dx < 0 ? "save" : "pass";
}