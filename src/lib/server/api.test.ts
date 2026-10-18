// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const deps = vi.hoisted(() => ({ requireUser: vi.fn(), readState: vi.fn(), mutate: vi.fn(), deleteData: vi.fn(), dispatchReminders: vi.fn() }));
vi.mock("./firebase", () => ({ requireUser: deps.requireUser }));
vi.mock("./repository", () => ({ readState: deps.readState, mutate: deps.mutate, deleteData: deps.deleteData }));
vi.mock("./reminders", () => ({ dispatchReminders: deps.dispatchReminders }));
import { handleApi } from "./api";
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("APP_MODE", "gcp"); vi.stubEnv("SERVICE_MODE", "web"); });
afterEach(() => vi.unstubAllEnvs());
describe("API boundary", () => {
  it("rejects unauthenticated state reads before touching Firestore", async () => {
    deps.requireUser.mockRejectedValue(new Response("Sign in required", { status: 401 }));
    expect((await handleApi(new Request("https://app.test/api/v1/state")))?.status).toBe(401);
    expect(deps.readState).not.toHaveBeenCalled();
  });
  it("uses the verified UID, not a supplied query owner", async () => {
    deps.requireUser.mockResolvedValue("user-A"); deps.readState.mockResolvedValue({ state: {}, revision: 0 });
    expect((await handleApi(new Request("https://app.test/api/v1/state?uid=user-B")))?.status).toBe(200);
    expect(deps.readState).toHaveBeenCalledWith("user-A");
  });
  it("rejects malicious profile metadata and oversized input", async () => {
    deps.requireUser.mockResolvedValue("user-A");
    const response = await handleApi(new Request("https://app.test/api/v1/commands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: crypto.randomUUID(), expectedRevision: 0, command: { kind: "household", patch: { revision: 99 }, source: "MANUAL_EDIT", expectedRevision: 1 } }) }));
    expect(response?.status).toBe(400);
    const oversized = await handleApi(new Request("https://app.test/api/v1/commands", { method: "POST", headers: { "Content-Type": "application/json" }, body: " ".repeat(65537) }));
    expect(oversized?.status).toBe(413); expect(deps.mutate).not.toHaveBeenCalled();
  });
  it("does not expose reminder execution on the public web service", async () => {
    expect((await handleApi(new Request("https://app.test/internal/reminders", { method: "POST" })))?.status).toBe(404);
    expect(deps.dispatchReminders).not.toHaveBeenCalled();
  });
  it("does not expose user routes or SSR from the private worker", async () => {
    vi.stubEnv("SERVICE_MODE", "worker");
    expect((await handleApi(new Request("https://worker.test/")))?.status).toBe(404);
    expect((await handleApi(new Request("https://worker.test/api/v1/state")))?.status).toBe(404);
  });
});
