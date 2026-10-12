// Shared domain contracts. Mirrors data/profile.schema.json, trial.schema.json and
// profile_review.schema.json from the specification package. Keep these in sync with the
// Cloud Run FastAPI Pydantic models (single source of truth in production).

export type Provenance = "USER_REPORTED" | "SHELTER_VERIFIED" | "SIMULATED" | "UNKNOWN" | "DEMO_SYNTHETIC";
export type Species = "CAT" | "DOG";
export type Day = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";
export const DAYS: Day[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

export interface Trait {
  value: number | null;
  source: Provenance;
  isSynthetic: boolean;
}

export interface Animal {
  animalId: string;
  name: string;
  species: Species;
  ageMonths: number;
  sex: "MALE" | "FEMALE";
  shelterId: string;
  status: "DRAFT" | "PENDING" | "APPROVED" | "ARCHIVED" | "ADOPTED";
  isDemo: boolean;
  description: string;
  tags: string[];
  baselineTraits: Record<string, Trait>;
  verifiedObservations: { code: string; context: string; source: Provenance }[];
  healthInfo: { vaccinationStatus: string; sterilizationStatus: string; vetReviewRequired: boolean };
}

export type ScheduleType = "WORK_AWAY" | "WORK_FROM_HOME" | "HOME_REST" | "HOME_ALL_DAY" | "AWAY";
export interface ScheduleBlock {
  days: Day[];
  start: string;
  end: string;
  type: ScheduleType;
}

export interface ResidentPet {
  petId: string;
  name: string;
  species: Species;
  breed?: string;
  ageMonths: number | null;
  energy: "LOW" | "MEDIUM" | "HIGH" | null;
  sociability: "LOW" | "MEDIUM" | "HIGH" | null;
  reactsToCats: "IGNORES" | "CURIOUS" | "BARKS" | "CHASES" | null;
  catCohabitation: "GOOD" | "UNSURE" | "NOT_SUITABLE" | "UNKNOWN";
  observedBehaviors: { code: string; source: Provenance; context?: string }[];
}

export interface HouseholdVersion {
  householdId: string;
  versionId: string; // v1, v2… immutable once saved
  revision: number;
  createdAt: string;
  source: "ONBOARDING" | "MANUAL_EDIT" | "PROFILE_REVIEW" | "SEED";
  timezone: string;
  homeType: "APARTMENT" | "HOUSE" | "CONDO" | "TERRACE" | null;
  areaM2?: number | null;
  safeRoomAvailable: boolean | null;
  noiseLevel: "LOW" | "MODERATE" | "HIGH" | null;
  resources: string[];
  weeklySchedule: ScheduleBlock[];
  caregivers: { name: string; days: Day[] }[];
  pets: ResidentPet[];
}

export interface DynamicState {
  hunger: number;
  energy: number;
  stress: number;
  environmentalComfort: number;
  humanTrust: number;
  curiosity: number;
}

export type ActionId =
  | "FEED" | "PLAY" | "ADD_RETREAT" | "CONTINUE_SEPARATION" | "SCENT_EXCHANGE"
  | "OBSERVE" | "ARRANGE_CAREGIVER" | "FORCE_DIRECT_MEETING";

export interface TrialEvent {
  eventId: string;
  day: number;
  kind: "ACTION" | "SCENARIO_DECISION" | "ENVIRONMENT" | "DAY_COMPLETE" | "REJECTED";
  code: string;
  label: string;
  provenance: Provenance;
  before?: DynamicState;
  after?: DynamicState;
  idempotencyKey?: string;
  at: string;
}

export interface ReportDimension {
  key: "HOME_RESOURCES" | "DAILY_CARE" | "PET_INTRODUCTIONS" | "ADOPTION_READINESS";
  label: string;
  status: "PREPARED" | "NEEDS_ACTION" | "GRADUAL_PLAN" | "UNKNOWN";
  score: number; // 0..5 progress pips for display only — NOT a prediction
  evidence: string[]; // event ids
}

export interface TrialReport {
  summary: "PREPARED" | "NEEDS_ACTION" | "UNKNOWN";
  headline: string;
  narrative: string;
  dimensions: ReportDimension[];
  strengths: { text: string; evidence: string[] }[];
  risks: { text: string; severity: "LOW" | "MEDIUM" | "HIGH"; mitigation: string }[];
  uncertainties: string[];
  recommendations: string[];
  provenance: { modelId: string; promptVersion: string; rulesVersion: string; seed: number };
  generatedAt: string;
}

export interface Trial {
  trialId: string;
  animalId: string;
  status: "IN_PROGRESS" | "COMPLETED";
  day: number; // 1..7; 8 = finished
  seed: number;
  rngState: number;
  rulesVersion: string;
  // Immutable snapshot pinned at trial creation (FR-017, FR-028)
  snapshot: { animal: Animal; household: HouseholdVersion };
  state: DynamicState;
  relationship: { familiarity: number; comfort: number; introductionStage: "SEPARATED" | "SCENT" | "VISUAL" };
  freeActionsToday: number;
  stateVersion: number;
  events: TrialEvent[];
  decisions: Record<number, ActionId>;
  report?: TrialReport;
  createdAt: string;
  completedAt?: string;
  forkedFrom?: string;
}

export interface ReviewSettings {
  intervalMonths: 1 | 3 | 6 | 12;
  remindersEnabled: boolean;
  pushEnabled: boolean;
  lastReviewedAt: string;
  nextReviewDueAt: string;
  snoozedUntil: string | null;
  dismissedForWindow: string | null;
}

export interface ReviewEvent {
  reviewId: string;
  type: "NO_CHANGE" | "CONFIRMED_CHANGE" | "REMINDER_SNOOZED" | "REMINDER_DISABLED" | "INTERVAL_CHANGED";
  at: string;
  versionId: string;
  changedFields?: string[];
}

export interface ExtractedFact {
  field: string;
  label: string;
  value: string;
  quote?: string;
  provenance: Provenance;
  confidence: number;
}

export interface ProposedChange {
  field: string;
  label: string;
  before: string;
  after: string;
  quote?: string;
  apply: Partial<HouseholdVersion>;
}
