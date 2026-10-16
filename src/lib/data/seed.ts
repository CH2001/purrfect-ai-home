// DEMO / SYNTHETIC seed data derived from the specification package (data/*.json).
// Production: these come from Firestore collections `animals`, `households/{id}/versions`,
// `scenarioTemplates` and `rulesets` via the Cloud Run API (GET /v1/animals etc.).
import type { Animal, HouseholdVersion, ActionId } from "@/lib/domain/types";
import oyen from "@/assets/photo-oyen.jpg";
import luna from "@/assets/photo-luna.jpg";
import mochi from "@/assets/photo-mochi.jpg";
import bumi from "@/assets/photo-bumi.jpg";
import milo from "@/assets/photo-milo.jpg";
import suri from "@/assets/photo-suri.jpg";

export const ANIMAL_IMAGES: Record<string, string> = {
  cat_oyen: oyen, cat_luna: luna, cat_mochi: mochi, dog_bumi: bumi, dog_milo: milo, dog_suri: suri,
};

// Presentation-only directory for demo listings. Production provider information
// comes from the shelter/rescuer directory keyed by Animal.shelterId.
export const ADOPTION_PROVIDERS: Record<string, { name: string; type: "Shelter" | "Individual rescuer" }> = {
  demo_shelter_1: { name: "Demo rescue shelter", type: "Shelter" },
};

const t = (value: number | null) =>
  value === null
    ? { value, source: "UNKNOWN" as const, isSynthetic: false }
    : { value, source: "DEMO_SYNTHETIC" as const, isSynthetic: true };

const base = { shelterId: "demo_shelter_1", status: "APPROVED" as const, isDemo: true,
  healthInfo: { vaccinationStatus: "UNKNOWN", sterilizationStatus: "UNKNOWN", vetReviewRequired: true } };

export const ANIMALS: Animal[] = [
  { ...base, animalId: "cat_oyen", name: "Oyen", species: "CAT", ageMonths: 8, sex: "MALE",
    description: "A curious rescue cat learning that home can be a happy place again. Loves window-watching, soft blankets and gentle company.",
    tags: ["Cautious", "Curious", "Gentle"],
    baselineTraits: { confidence: t(30), activityLevel: t(65), noiseSensitivity: t(80), socialApproach: t(35), dogReactivity: t(null), catReactivity: t(null), separationSensitivity: t(null) },
    verifiedObservations: [
      { code: "HIDES_FROM_STRANGERS", context: "Fictional foster-room demonstration", source: "DEMO_SYNTHETIC" },
      { code: "EXPLORES_AFTER_QUIET_TIME", context: "Fictional quiet room", source: "DEMO_SYNTHETIC" }] },
  { ...base, animalId: "cat_luna", name: "Luna", species: "CAT", ageMonths: 24, sex: "FEMALE",
    description: "Gentle, reserved companion with limited inter-pet history. Prefers calm evenings.",
    tags: ["Calm", "Gentle"],
    baselineTraits: { confidence: t(48), activityLevel: t(35), noiseSensitivity: t(55), socialApproach: t(40), dogReactivity: t(null), catReactivity: t(40) },
    verifiedObservations: [{ code: "OBSERVES_BEFORE_APPROACH", context: "Fictional adoption room", source: "DEMO_SYNTHETIC" }] },
  { ...base, animalId: "cat_mochi", name: "Mochi", species: "CAT", ageMonths: 10, sex: "FEMALE",
    description: "Active, playful cat who adores wand toys. Dog familiarity unknown.",
    tags: ["Playful", "Affectionate"],
    baselineTraits: { confidence: t(67), activityLevel: t(84), noiseSensitivity: t(42), socialApproach: t(61), dogReactivity: t(null), catReactivity: t(55) },
    verifiedObservations: [{ code: "PLAYS_WITH_WAND", context: "Fictional play session", source: "DEMO_SYNTHETIC" }] },
  { ...base, animalId: "dog_bumi", name: "Bumi", species: "DOG", ageMonths: 14, sex: "MALE",
    description: "Young mixed-breed with an active play routine and a love of puzzle feeders.",
    tags: ["Friendly", "Loyal"],
    baselineTraits: { confidence: t(62), activityLevel: t(80), noiseSensitivity: t(48), socialApproach: t(72), catReactivity: t(null), preyDrive: t(null), separationSensitivity: t(null) },
    verifiedObservations: [{ code: "ENJOYS_PUZZLE_FEEDER", context: "Fictional kennel enrichment", source: "DEMO_SYNTHETIC" }] },
  { ...base, animalId: "dog_milo", name: "Milo", species: "DOG", ageMonths: 30, sex: "MALE",
    description: "Quiet, easy-going dog with an uncertain small-animal history.",
    tags: ["Calm", "Easy-going"],
    baselineTraits: { confidence: t(55), activityLevel: t(47), noiseSensitivity: t(45), socialApproach: t(51), catReactivity: t(null), preyDrive: t(null), separationSensitivity: t(35) },
    verifiedObservations: [{ code: "RESTS_AFTER_WALK", context: "Fictional walk log", source: "DEMO_SYNTHETIC" }] },
  { ...base, animalId: "dog_suri", name: "Suri", species: "DOG", ageMonths: 36, sex: "FEMALE",
    description: "Attentive dog with observable reactions to noise. Thrives with routine.",
    tags: ["Attentive", "Smart"],
    baselineTraits: { confidence: t(52), activityLevel: t(60), noiseSensitivity: t(72), socialApproach: t(45), catReactivity: t(null), preyDrive: t(null), separationSensitivity: t(null) },
    verifiedObservations: [{ code: "LOOKS_TOWARD_NOISE", context: "Fictional shelter yard", source: "DEMO_SYNTHETIC" }] },
];

export const SEED_HOUSEHOLD: HouseholdVersion = {
  householdId: "hh_demo_max", versionId: "v1", revision: 1, createdAt: "2026-10-12T05:00:00Z", source: "SEED",
  timezone: "Asia/Kuala_Lumpur", homeType: "APARTMENT", areaM2: 70, safeRoomAvailable: true, noiseLevel: "MODERATE",
  resources: ["WATER_BOWL", "FOOD_BOWL", "HIDE_BOX", "REST_BED", "TOY"],
  weeklySchedule: [
    { days: ["MON", "TUE", "WED"], start: "09:00", end: "18:00", type: "WORK_AWAY" },
    { days: ["THU", "FRI"], start: "09:00", end: "18:00", type: "WORK_FROM_HOME" },
    { days: ["SAT", "SUN"], start: "00:00", end: "23:59", type: "HOME_ALL_DAY" },
  ],
  caregivers: [],
  pets: [{
    petId: "dog_max", name: "Max", species: "DOG", breed: "Golden Retriever", ageMonths: 24,
    energy: "HIGH", sociability: "MEDIUM", reactsToCats: "CURIOUS", catCohabitation: "UNKNOWN",
    observedBehaviors: [{ code: "BARKS_AT_OUTDOOR_CATS", source: "USER_REPORTED", context: "Leashed walks" }],
  }],
};

export interface ScenarioTemplate {
  day: number; scenarioId: string; eventType: string; title: string; narrative: string;
  allowedActionIds: ActionId[]; recommendedActionIds: ActionId[]; prohibitedActionIds: ActionId[]; record: string;
}

export const SCENARIOS: ScenarioTemplate[] = [
  { day: 1, scenarioId: "arrival", eventType: "ARRIVAL", title: "First day, quiet space", narrative: "{name} has just arrived. Prepare a retreat and independent care resources before exploring.", allowedActionIds: ["ADD_RETREAT", "OBSERVE"], recommendedActionIds: ["ADD_RETREAT"], prohibitedActionIds: ["FORCE_DIRECT_MEETING"], record: "SAFE_ROOM_READY" },
  { day: 2, scenarioId: "exploration", eventType: "EXPLORATION", title: "An unfamiliar room", narrative: "{name} peeks out and notices the new environment. Allow choice and retreat.", allowedActionIds: ["OBSERVE", "PLAY", "ADD_RETREAT"], recommendedActionIds: ["OBSERVE"], prohibitedActionIds: [], record: "HIDE_REST" },
  { day: 3, scenarioId: "routine", eventType: "WORK_AWAY", title: "What happens during working hours?", narrative: "It's an office day. Who checks on {name} while you're away?", allowedActionIds: ["FEED", "ARRANGE_CAREGIVER", "OBSERVE"], recommendedActionIds: ["ARRANGE_CAREGIVER"], prohibitedActionIds: [], record: "CARE_COVERAGE" },
  { day: 4, scenarioId: "introduction", eventType: "DOG_BARK", title: "Introduction Moment", narrative: "{pet} barked near the doorway. {name} moved toward the cardboard box, looking unsure.", allowedActionIds: ["CONTINUE_SEPARATION", "SCENT_EXCHANGE", "OBSERVE"], recommendedActionIds: ["CONTINUE_SEPARATION"], prohibitedActionIds: ["FORCE_DIRECT_MEETING"], record: "INTRO_STAGE" },
  { day: 5, scenarioId: "enrichment", eventType: "ENRICHMENT", title: "A chance to play", narrative: "{name} seems more relaxed today. Offer appropriate play and rest opportunities.", allowedActionIds: ["PLAY", "OBSERVE", "ADD_RETREAT"], recommendedActionIds: ["PLAY"], prohibitedActionIds: [], record: "ENRICHMENT" },
  { day: 6, scenarioId: "surprise", eventType: "LOUD_NOISE", title: "Unexpected visitor", narrative: "The doorbell rings loudly. Can {name} retreat safely?", allowedActionIds: ["CONTINUE_SEPARATION", "ADD_RETREAT", "OBSERVE"], recommendedActionIds: ["CONTINUE_SEPARATION"], prohibitedActionIds: ["FORCE_DIRECT_MEETING"], record: "NOISE_RESPONSE" },
  { day: 7, scenarioId: "review", eventType: "REVIEW", title: "Review the readiness plan", narrative: "Summarize care continuity, resources and the unknowns in {name}'s history.", allowedActionIds: ["OBSERVE", "ARRANGE_CAREGIVER"], recommendedActionIds: ["OBSERVE"], prohibitedActionIds: [], record: "TRIAL_COMPLETED" },
];

export const ACTION_COPY: Record<ActionId, { title: string; body: string }> = {
  FEED: { title: "Feed on schedule", body: "Offer a calm meal at the usual time in a quiet spot." },
  PLAY: { title: "Gentle play session", body: "Short wand-toy play, letting them choose to engage." },
  ADD_RETREAT: { title: "Add a hiding spot", body: "Set up a box or covered bed they can retreat to." },
  CONTINUE_SEPARATION: { title: "Continue separation", body: "Let them stay in a safe, quiet space for now. Give them time to feel secure." },
  SCENT_EXCHANGE: { title: "Try scent exchange", body: "Swap bedding or cloth so both pets get used to each other's scent." },
  OBSERVE: { title: "Observe quietly", body: "Sit nearby without pressure and note what they do." },
  ARRANGE_CAREGIVER: { title: "Arrange a caregiver", body: "Ask someone trusted to check in midday on away days." },
  FORCE_DIRECT_MEETING: { title: "Approach too quickly", body: "Let them meet face to face now." },
};

export const RULES = {
  rulesVersion: "1.0.0-demo",
  initialState: { hunger: 25, energy: 76, stress: 76, environmentalComfort: 24, humanTrust: 18, curiosity: 38 },
  actions: {
    FEED: { requiredResources: ["FOOD_BOWL"], deltas: { hunger: -25, environmentalComfort: 2 } },
    PLAY: { requiredResources: ["TOY"], deltas: { energy: -4, environmentalComfort: 2, humanTrust: 1 } },
    ADD_RETREAT: { requiredResources: [], deltas: { environmentalComfort: 5 } },
    CONTINUE_SEPARATION: { requiredResources: [], deltas: { stress: -3, environmentalComfort: 2 } },
    SCENT_EXCHANGE: { requiredResources: ["HIDE_BOX"], deltas: { stress: -1, environmentalComfort: 1 } },
    OBSERVE: { requiredResources: [], deltas: {} },
    ARRANGE_CAREGIVER: { requiredResources: [], deltas: { environmentalComfort: 1 } },
    FORCE_DIRECT_MEETING: { requiredResources: [], deltas: { stress: 15 } },
  } as Record<ActionId, { requiredResources: string[]; deltas: Partial<Record<string, number>> }>,
  tickDeltas: { hunger: 1.2, energy: -0.25 },
  eventDeltas: { DOG_BARK: { stress: 6 }, LOUD_NOISE: { stress: 4 }, CARE_GAP: { stress: 3 }, SAFE_QUIET_TIME: { stress: -2, environmentalComfort: 1 } } as Record<string, Partial<Record<string, number>>>,
  freeActionsPerDay: 4,
};
