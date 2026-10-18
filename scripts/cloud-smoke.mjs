// Runs against a compiled server and Firebase emulators, never a real project.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
const project = "demo-purrfect-home";
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error("Run through npm run test:cloud. Emulators are required.");
const env = { ...process.env, GOOGLE_CLOUD_PROJECT: project, APP_MODE: "gcp", DEMO_GUEST_ACCESS: "true", AI_PROVIDER: "mock", HOST: "127.0.0.1" };
delete env.K_SERVICE;
const server = spawn(process.execPath, [".output/server/index.mjs"], { env: { ...env, PORT: "8087", SERVICE_MODE: "web" }, stdio: ["ignore", "pipe", "pipe"] });
const worker = spawn(process.execPath, [".output/server/index.mjs"], { env: { ...env, PORT: "8089", SERVICE_MODE: "worker" }, stdio: ["ignore", "pipe", "pipe"] });
let logs = "";
for (const child of [server, worker]) { child.stdout.on("data", d => { logs = (logs + d).slice(-8000); }); child.stderr.on("data", d => { logs = (logs + d).slice(-8000); }); }
async function ready(port) { for (let i = 0; i < 60; i++) { if (server.exitCode !== null || worker.exitCode !== null) throw new Error("Server exited during startup."); try { if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) return; } catch {} await delay(500); } throw new Error("Server did not become healthy."); }
async function signup(guest = false) {
  const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(guest ? { returnSecureToken: true } : { email: `${crypto.randomUUID()}@example.test`, password: "test-password-12345", returnSecureToken: true }) });
  assert.equal(response.status, 200); return (await response.json()).idToken;
}
async function request(token, path, method = "GET", body) {
  const response = await fetch(`http://127.0.0.1:8087/api/v1${path}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const value = await response.json().catch(() => null); return { status: response.status, value };
}
try {
  await Promise.all([ready(8087), ready(8089)]);
  assert.equal((await request(null, "/state")).status, 401);
  const [a, b] = await Promise.all([signup(true), signup(true)]);
  const existingAccount = await signup();
  assert.equal((await request(existingAccount, "/state")).status, 200);
  let current = (await request(a, "/state")).value;
  assert.equal(current.revision, 0);
  const command = { kind: "createTrial", animalId: "cat_oyen" };
  const envelope = { command, requestId: crypto.randomUUID(), expectedRevision: 0 };
  let response = await request(a, "/commands", "POST", envelope);
  assert.equal(response.status, 200, JSON.stringify(response)); current = response.value;
  const trialId = current.trialId;
  const replay = await request(a, "/commands", "POST", envelope);
  assert.equal(replay.value.trialId, trialId); assert.equal(replay.value.revision, 1); assert.equal(replay.value.state.trials.length, 1);
  assert.equal((await request(b, "/state")).value.state.trials.length, 0);
  const stolen = await request(b, "/commands", "POST", { command: { kind: "care", trialId, actionId: "FEED", expectedStateVersion: 0 }, requestId: crypto.randomUUID(), expectedRevision: 0 });
  assert.equal(stolen.status, 404);
  const forged = await request(a, "/commands", "POST", { ...envelope, requestId: crypto.randomUUID(), command: { ...command, state: { stress: 0 } } });
  assert.equal(forged.status, 400);
  const stale = await request(a, "/commands", "POST", { ...envelope, requestId: crypto.randomUUID() });
  assert.equal(stale.status, 409);
  async function send(command) {
    const response = await request(a, "/commands", "POST", { command, expectedRevision: current.revision, requestId: crypto.randomUUID() });
    assert.equal(response.status, 200, JSON.stringify(response)); current = response.value; return current;
  }
  const originalSnapshot = structuredClone(current.state.trials[0].snapshot);
  await send({ kind: "household", patch: { noiseLevel: "LOW" }, source: "MANUAL_EDIT", expectedRevision: 1 });
  assert.equal(current.state.householdVersions.length, 2); assert.deepEqual(current.state.trials[0].snapshot, originalSnapshot);
  await send({ kind: "care", trialId, actionId: "FEED", expectedStateVersion: 0 });
  for (let day = 1; day <= 7; day++) await send({ kind: "day", trialId, actionId: "OBSERVE", expectedDay: day, expectedStateVersion: current.state.trials[0].stateVersion });
  assert.equal(current.state.trials[0].status, "COMPLETED"); assert.ok(current.state.trials[0].report);
  assert.deepEqual((await request(a, "/state")).value.state.trials[0].report, current.state.trials[0].report);
  await send({ kind: "preferences", patch: { review: { ...current.state.review, remindersEnabled: true, nextReviewDueAt: "2020-01-01T00:00:00.000Z", snoozedUntil: null, dismissedForWindow: null } } });
  const trigger = () => fetch("http://127.0.0.1:8089/internal/reminders", { method: "POST" }).then(r => r.json());
  assert.equal((await trigger()).sent, 1); assert.equal((await trigger()).sent, 0);
  assert.equal((await request(a, "/state")).value.state.inbox.length, 1);
  assert.equal((await fetch("http://127.0.0.1:8087/internal/reminders", { method: "POST" })).status, 404);
  assert.equal((await request(a, "/data", "DELETE")).status, 200);
  const erased = (await request(a, "/state")).value;
  assert.equal(erased.state.trials.length, 0); assert.equal(erased.revision, 0); assert.equal(erased.state.inbox.length, 0);
  console.log("Cloud smoke passed: authentication, account isolation, idempotency, concurrency, immutable snapshots, seven-day reports, reminder deduplication, and deletion.");
} catch (error) { console.error(logs); throw error; }
finally { server.kill(); worker.kill(); }
