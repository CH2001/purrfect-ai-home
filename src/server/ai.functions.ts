// Server functions for AI features. They run server-side (edge worker) so model credentials
// never reach the browser. Currently backed by the MOCK LLM in src/lib/ai/mock-llm.ts.
//
// ─────────────────────────── GCP CONFIGURATION (commented) ───────────────────────────
// Production target (Technical Spec §1): Gemini via Vertex AI, called from the Cloud Run
// FastAPI service, or directly from here through the Vertex REST endpoint.
//
// Required env (server-only):
//   GCP_PROJECT_ID=purrfect-home-prod
//   GCP_LOCATION=global                      // Vertex "global" endpoint initially
//   GEMINI_MODEL_ID=gemini-3.8-flash         // configurable, verify access/quotas
//   GCP_SA_KEY / Workload Identity Federation token (prefer WIF, never ship keys)
//
// async function callGemini<T>(systemPrompt: string, userText: string, responseSchema: object): Promise<T> {
//   const token = await getAccessToken(); // via WIF / metadata server on Cloud Run
//   const url = `https://aiplatform.googleapis.com/v1/projects/${process.env.GCP_PROJECT_ID}` +
//     `/locations/${process.env.GCP_LOCATION}/publishers/google/models/${process.env.GEMINI_MODEL_ID}:generateContent`;
//   const res = await fetch(url, {
//     method: "POST",
//     headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//     body: JSON.stringify({
//       systemInstruction: { parts: [{ text: systemPrompt }] },
//       contents: [{ role: "user", parts: [{ text: userText }] }],
//       generationConfig: { responseMimeType: "application/json", responseSchema, temperature: 0.2 },
//     }),
//     signal: AbortSignal.timeout(8000), // FR-014: fall back to scripted output on timeout
//   });
//   if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
//   const json = await res.json();
//   return JSON.parse(json.candidates[0].content.parts[0].text) as T; // then validate with zod!
// }
// Treat all Gemini output as UNTRUSTED suggestions: validate with zod, never let it mutate
// authoritative state (SAFETY_ACTIONS_NOT_OVERRIDDEN_BY_LLM).
// ──────────────────────────────────────────────────────────────────────────────────────
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { mockChatReply, mockExtractChanges, mockExtractHousehold, mockNarrate } from "@/lib/ai/mock-llm";
import type { HouseholdVersion } from "@/lib/domain/types";

export const MODEL_ID = "mock-gemini (set GEMINI_MODEL_ID)";

export const extractHousehold = createServerFn({ method: "POST" })
  .inputValidator((d: { message: string; current: Partial<HouseholdVersion> }) =>
    z.object({ message: z.string().min(1).max(2000), current: z.any() }).parse(d))
  .handler(async ({ data }) => {
    // GCP: return callGemini(EXTRACT_PROMPT_V1, data.message, householdExtractionSchema)
    return mockExtractHousehold(data.message, data.current);
  });

export const extractChanges = createServerFn({ method: "POST" })
  .inputValidator((d: { message: string; current: HouseholdVersion }) =>
    z.object({ message: z.string().min(1).max(2000), current: z.any() }).parse(d))
  .handler(async ({ data }) => {
    // GCP: return callGemini(CHANGE_ONLY_PROMPT_V1, data.message, changeDraftSchema)
    return mockExtractChanges(data.message, data.current as HouseholdVersion);
  });

export const narrateReport = createServerFn({ method: "POST" })
  .inputValidator((d: { animalName: string; strengths: string[]; risks: string[]; stress: number; trust: number }) =>
    z.object({ animalName: z.string(), strengths: z.array(z.string()), risks: z.array(z.string()), stress: z.number(), trust: z.number() }).parse(d))
  .handler(async ({ data }) => {
    // GCP: narration grounded ONLY on engine facts passed in `data` (no free invention).
    return { narrative: mockNarrate(data), modelId: MODEL_ID };
  });

export const companionChat = createServerFn({ method: "POST" })
  .inputValidator((d: { message: string }) => z.object({ message: z.string().min(1).max(1000) }).parse(d))
  .handler(async ({ data }) => ({ reply: mockChatReply(data.message) }));
