import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authHeaders } from "@/lib/cloud/client";
import type { HouseholdVersion } from "@/lib/domain/types";
import { householdPatchSchema } from "@/lib/domain/validation";

const currentSchema = householdPatchSchema.extend({ householdId: z.string().max(100).optional(), versionId: z.string().max(100).optional(), revision: z.number().int().optional(), createdAt: z.string().optional(), source: z.enum(["ONBOARDING", "MANUAL_EDIT", "PROFILE_REVIEW", "SEED"]).optional() });
const messageSchema = z.object({ message: z.string().min(1).max(2000), current: currentSchema });
// Server-only dependencies are imported inside handlers and never enter the browser bundle.
async function authorize() {
  const { getRequest } = await import("@tanstack/react-start/server");
  if (process.env.APP_MODE !== "gcp") {
    if (process.env.AI_PROVIDER === "vertex") throw new Error("Vertex requires authenticated GCP mode.");
    return;
  }
  const { requireUser } = await import("@/lib/server/firebase");
  const { reserveAiCall } = await import("@/lib/server/repository");
  const uid = await requireUser(getRequest());
  await reserveAiCall(uid);
  return uid;
}
const extractFn = createServerFn({ method: "POST" }).inputValidator((data: unknown) => messageSchema.parse(data)).handler(async ({ data }) => {
  await authorize();
  const { extract } = await import("@/lib/server/vertex");
  return extract(data.message, data.current);
});
const changesFn = createServerFn({ method: "POST" }).inputValidator((data: unknown) => messageSchema.parse(data)).handler(async ({ data }) => {
  await authorize();
  const { changes } = await import("@/lib/server/vertex");
  // Read the signed-in user's current profile, never another user ID supplied by a caller.
  if (process.env.APP_MODE === "gcp") {
    const { getRequest } = await import("@tanstack/react-start/server");
    const { requireUser } = await import("@/lib/server/firebase");
    const { readState } = await import("@/lib/server/repository");
    const { state } = await readState(await requireUser(getRequest()));
    return changes(data.message, state.householdVersions.find(v => v.versionId === state.activeVersionId)!);
  }
  return changes(data.message, data.current as HouseholdVersion);
});
const narrativeFn = createServerFn({ method: "POST" }).inputValidator((data: unknown) => z.object({ animalName: z.string().max(100), strengths: z.array(z.string().max(500)).max(20), risks: z.array(z.string().max(500)).max(20), stress: z.number().min(0).max(100), trust: z.number().min(0).max(100) }).strict().parse(data)).handler(async ({ data }) => {
  await authorize();
  const { narrate } = await import("@/lib/server/vertex");
  return narrate(data); // Display-only; this endpoint cannot save reports or scores.
});
const chatFn = createServerFn({ method: "POST" }).inputValidator((data: unknown) => z.object({ message: z.string().min(1).max(1000), history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(3000) }).strict()).max(6).default([]), current: currentSchema.optional() }).strict().parse(data)).handler(async ({ data }) => {
  const uid = await authorize();
  const { SEED_HOUSEHOLD } = await import("@/lib/data/seed");
  let home = { ...SEED_HOUSEHOLD, ...data.current };
  if (uid) {
    const { readState } = await import("@/lib/server/repository");
    const { state } = await readState(uid);
    home = state.householdVersions.find(v => v.versionId === state.activeVersionId)!;
  }
  const { chat } = await import("@/lib/server/vertex");
  return chat(data.message, data.history, home);
});
const reactionFn = createServerFn({ method: "POST" }).inputValidator((data: unknown) => z.object({ trialId: z.string().min(1).max(100) }).strict().parse(data)).handler(async ({ data }) => {
  const uid = await authorize();
  if (!uid) throw new Error("Cloud trial required.");
  const { readState } = await import("@/lib/server/repository");
  const { state } = await readState(uid);
  const trial = state.trials.find(t => t.trialId === data.trialId);
  if (!trial) throw new Error("Trial not found.");
  const { reactToTrial } = await import("@/lib/server/vertex");
  return reactToTrial(trial);
});
export async function extractHousehold(options: { data: { message: string; current: Partial<HouseholdVersion> } }) { return extractFn({ ...options, headers: await authHeaders() }); }
export async function extractChanges(options: { data: { message: string; current: HouseholdVersion } }) { return changesFn({ ...options, headers: await authHeaders() }); }
export async function narrateReport(options: { data: { animalName: string; strengths: string[]; risks: string[]; stress: number; trust: number } }) { return narrativeFn({ ...options, headers: await authHeaders() }); }
export async function companionChat(options: { data: { message: string; history?: import("./catalogue").ChatTurn[]; current?: Partial<HouseholdVersion> } }) { return chatFn({ ...options, headers: await authHeaders() }); }
export async function trialReaction(options: { data: { trialId: string } }) { return reactionFn({ ...options, headers: await authHeaders() }); }
