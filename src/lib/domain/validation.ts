import { z } from "zod";

const text = z.string().max(200);
const days = z.array(z.enum(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"])).max(7);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const level = z.enum(["LOW", "MEDIUM", "HIGH"]).nullable();
export const householdPatchSchema = z.object({
  timezone: z.string().max(80).refine(v => { try { new Intl.DateTimeFormat("en", { timeZone: v }); return true; } catch { return false; } }),
  homeType: z.enum(["APARTMENT", "HOUSE", "CONDO", "TERRACE"]).nullable(),
  areaM2: z.number().min(1).max(100000).nullable().optional(),
  safeRoomAvailable: z.boolean().nullable(),
  noiseLevel: z.enum(["LOW", "MODERATE", "HIGH"]).nullable(),
  resources: z.array(z.string().min(1).max(80)).max(30),
  weeklySchedule: z.array(z.object({ days, start: time, end: time, type: z.enum(["WORK_AWAY", "WORK_FROM_HOME", "HOME_REST", "HOME_ALL_DAY", "AWAY"]) }).strict()).max(50),
  caregivers: z.array(z.object({ name: text, days }).strict()).max(20),
  pets: z.array(z.object({
    petId: text, name: text, species: z.enum(["CAT", "DOG"]), breed: text.optional(),
    ageMonths: z.number().int().min(0).max(600).nullable(), energy: level, sociability: level,
    reactsToCats: z.enum(["IGNORES", "CURIOUS", "BARKS", "CHASES"]).nullable(),
    catCohabitation: z.enum(["GOOD", "UNSURE", "NOT_SUITABLE", "UNKNOWN"]),
    observedBehaviors: z.array(z.object({ code: text, context: text.optional(), source: z.enum(["USER_REPORTED", "SHELTER_VERIFIED", "SIMULATED", "UNKNOWN", "DEMO_SYNTHETIC"]) }).strict()).max(30),
  }).strict()).max(20),
}).partial().strict();

export const reviewSchema = z.object({
  intervalMonths: z.union([z.literal(1), z.literal(3), z.literal(6), z.literal(12)]),
  remindersEnabled: z.boolean(), pushEnabled: z.boolean(), lastReviewedAt: z.string().datetime(),
  nextReviewDueAt: z.string().datetime(), snoozedUntil: z.string().datetime().nullable(), dismissedForWindow: z.string().datetime().nullable(),
}).strict();
export const actionSchema = z.enum(["FEED", "PLAY", "ADD_RETREAT", "CONTINUE_SEPARATION", "SCENT_EXCHANGE", "OBSERVE", "ARRANGE_CAREGIVER", "FORCE_DIRECT_MEETING"]);
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
export const commandSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("preferences"), patch: z.object({ userName: text, favorites: z.array(id).max(500), passed: z.array(id).max(500), review: reviewSchema, reviewLog: z.array(z.object({ reviewId: id, type: z.enum(["NO_CHANGE", "CONFIRMED_CHANGE", "REMINDER_SNOOZED", "REMINDER_DISABLED", "INTERVAL_CHANGED"]), at: z.string().datetime(), versionId: id, changedFields: z.array(text).max(30).optional() }).strict()).max(200) }).partial().strict() }).strict(),
  z.object({ kind: z.literal("household"), patch: householdPatchSchema, source: z.enum(["ONBOARDING", "MANUAL_EDIT", "PROFILE_REVIEW"]), expectedRevision: z.number().int().min(1) }).strict(),
  z.object({ kind: z.literal("createTrial"), animalId: id, forkedFrom: id.optional() }).strict(),
  z.object({ kind: z.literal("care"), trialId: id, actionId: actionSchema, expectedStateVersion: z.number().int().min(0) }).strict(),
  z.object({ kind: z.literal("day"), trialId: id, actionId: actionSchema, expectedDay: z.number().int().min(1).max(7), expectedStateVersion: z.number().int().min(0) }).strict(),
]);
export type Command = z.infer<typeof commandSchema>;
export const envelopeSchema = z.object({ command: commandSchema, requestId: z.string().uuid(), expectedRevision: z.number().int().min(0) }).strict();
