import { Timestamp, type Transaction } from "firebase-admin/firestore";
import { database } from "./firebase";
import { initial, type AppState } from "@/lib/repo/state";
import type { HouseholdVersion, Trial, TrialEvent } from "@/lib/domain/types";
import { executeCommand, CommandError } from "@/lib/repo/commands";
import type { envelopeSchema } from "@/lib/domain/validation";
import type { z } from "zod";
import { narrate } from "./vertex";

const clean = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
export const accountRef = (uid: string) => database().collection("users").doc(uid);

// All records live below the verified UID; no owner ID is accepted from the browser.
// Events and versions are separate immutable documents, avoiding a growing 1 MiB trial document.
export async function readState(uid: string, tx?: Transaction) {
  const root = accountRef(uid);
  const [user, versions, trials, notifications] = await Promise.all([
    tx ? tx.get(root) : root.get(),
    tx ? tx.get(root.collection("householdVersions")) : root.collection("householdVersions").get(),
    tx ? tx.get(root.collection("trials")) : root.collection("trials").get(),
    tx ? tx.get(root.collection("notifications").orderBy("at", "desc").limit(50)) : root.collection("notifications").orderBy("at", "desc").limit(50).get(),
  ]);
  const data = user.data();
  if (data?.deleting) throw new CommandError(409, "Your data is being deleted. Please retry shortly.");
  const fullTrials = await Promise.all(trials.docs.map(async doc => {
    const events = tx ? await tx.get(doc.ref.collection("events")) : await doc.ref.collection("events").get();
    return { ...doc.data(), events: events.docs.map(e => e.data()).sort((a, b) => a.seq - b.seq).map(({ seq: _seq, ...e }) => e as TrialEvent) } as Trial;
  }));
  const householdVersions = versions.empty ? clean(initial.householdVersions) : versions.docs.map(d => d.data() as HouseholdVersion).sort((a, b) => a.revision - b.revision);
  const { revision = 0, deleting: _deleting, ...preferences } = data ?? {};
  const state: AppState = { ...clean(initial), userName: "Pet parent", ...preferences, inbox: notifications.docs.map(d => d.data() as AppState["inbox"][number]), householdVersions, trials: fullTrials.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
  return { state, revision: revision as number };
}

export async function mutate(uid: string, envelope: z.infer<typeof envelopeSchema>) {
  const result = await database().runTransaction(async tx => {
    const root = accountRef(uid);
    const receiptRef = root.collection("requests").doc(envelope.requestId);
    const receipt = await tx.get(receiptRef);
    const current = await readState(uid, tx);
    if (receipt.exists) {
      if (receipt.data()!.command !== JSON.stringify(envelope.command)) throw new CommandError(409, "Request ID was already used for another operation.");
      return { ...current, trialId: receipt.data()!.trialId };
    }
    if (current.revision !== envelope.expectedRevision) throw new CommandError(409, "Data changed on another device. Your latest data has been loaded; review and retry.");
    const result = executeCommand(current.state, envelope.command, envelope.requestId);
    const { householdVersions, trials, inbox: _inbox, ...preferences } = result.state;
    const revision = current.revision + 1;
    tx.set(root, clean({ ...preferences, revision }));
    for (const version of householdVersions) {
      if (current.revision === 0 || !current.state.householdVersions.some(v => v.versionId === version.versionId)) {
        tx.create(root.collection("householdVersions").doc(version.versionId), clean(version));
      }
    }
    for (const trial of trials) {
      const old = current.state.trials.find(t => t.trialId === trial.trialId);
      if (old === trial) continue;
      const { events, ...record } = trial;
      const ref = root.collection("trials").doc(trial.trialId);
      tx.set(ref, clean(record));
      events.slice(old?.events.length ?? 0).forEach((event, offset) => {
        const seq = (old?.events.length ?? 0) + offset;
        tx.create(ref.collection("events").doc(String(seq).padStart(10, "0")), clean({ ...event, seq }));
      });
    }
    tx.create(receiptRef, clean({ command: JSON.stringify(envelope.command), trialId: result.trialId ?? null, createdAt: new Date().toISOString() }));
    // Dedicated due index allows the worker to avoid scanning private household/trial data.
    tx.set(database().collection("reviewDueIndex").doc(uid), clean(result.state.review));
    return { state: result.state, revision, trialId: result.trialId };
  });
  const trial = result.state.trials.find(t => t.trialId === result.trialId);
  if (trial?.status === "COMPLETED" && trial.report && process.env.AI_PROVIDER === "vertex") {
    await enrichReport(uid, trial).catch(() => {
      console.warn(JSON.stringify({ event: "report_narration_fallback" }));
    });
    return { ...await readState(uid), trialId: result.trialId };
  }
  return result;
}

async function enrichReport(uid: string, trial: Trial) {
  const root = accountRef(uid);
  const ref = root.collection("trials").doc(trial.trialId);
  const audit = ref.collection("reportNarration").doc("v1");
  const reserved = await database().runTransaction(async tx => {
    const [user, existing] = await Promise.all([tx.get(root), tx.get(audit)]);
    if (!user.exists || user.data()?.deleting || existing.exists) return false;
    tx.create(audit, { status: "STARTED", at: new Date().toISOString() });
    return true;
  });
  if (!reserved) return;
  await reserveAiCall(uid);
  const report = trial.report!;
  const result = await narrate({ animalName: trial.snapshot.animal.name, strengths: report.strengths.map(s => s.text), risks: report.risks.map(r => r.text), stress: trial.state.stress, trust: trial.state.humanTrust });
  await database().runTransaction(async tx => {
    const [user, current] = await Promise.all([tx.get(root), tx.get(ref)]);
    if (!user.exists || user.data()?.deleting || !current.exists) return;
    // Only narrative and model attribution change; scores, evidence and snapshots stay server-computed.
    tx.update(ref, { "report.narrative": result.narrative, "report.provenance.modelId": result.modelId });
    tx.set(audit, { status: "COMPLETED", modelId: result.modelId, at: new Date().toISOString() });
  });
}

export async function deleteData(uid: string) {
  const root = accountRef(uid);
  // Gate new commands before recursive deletion. Repeating DELETE safely resumes a failed deletion.
  await root.set({ deleting: true }, { merge: true });
  await database().collection("reviewDueIndex").doc(uid).delete();
  for (const collection of await root.listCollections()) await database().recursiveDelete(collection);
  await root.delete();
}

export async function reserveAiCall(uid: string) {
  const today = new Date().toISOString().slice(0, 10);
  const ref = accountRef(uid).collection("aiUsage").doc(today);
  const limit = Number(process.env.AI_DAILY_LIMIT ?? 40);
  await database().runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    const count = snapshot.data()?.count ?? 0;
    if (count >= limit) throw new CommandError(429, "Daily assistant limit reached. Try again tomorrow.");
    tx.set(ref, { count: count + 1, expiresAt: Timestamp.fromMillis(Date.now() + 7 * 86400000) });
  });
}
