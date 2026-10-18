import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: { currentUser: null as null | { uid: string }, authStateReady: vi.fn().mockResolvedValue(undefined) },
  signIn: vi.fn().mockResolvedValue({}), hydrate: vi.fn().mockResolvedValue(undefined), clear: vi.fn(),
}));
vi.mock("firebase/auth", () => ({ signInAnonymously: mocks.signIn }));
vi.mock("@/lib/cloud/client", () => ({ cloudEnabled: true, firebaseAuth: () => mocks.auth }));
vi.mock("@/lib/repo/store", () => ({ hydrateCloud: mocks.hydrate, clearCloudState: mocks.clear }));
beforeEach(() => {
  vi.resetModules(); mocks.auth.currentUser = null;
  mocks.signIn.mockClear(); mocks.hydrate.mockReset().mockResolvedValue(undefined);
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
it("opens a guest session without rendering a login form", async () => {
  const { CloudSession } = await import("./cloud-session");
  const element = document.createElement("div"); const root = createRoot(element);
  try {
    await act(async () => { root.render(<CloudSession><p>Demo app</p></CloudSession>); });
    expect(mocks.signIn).toHaveBeenCalledTimes(1);
    expect(mocks.hydrate).toHaveBeenCalledTimes(1);
    expect(element.textContent).toBe("Demo app");
    expect(element.querySelector("input")).toBeNull();
  } finally { await act(async () => root.unmount()); }
});
it("preserves an existing authenticated session", async () => {
  mocks.auth.currentUser = { uid: "existing" };
  const { CloudSession } = await import("./cloud-session");
  const element = document.createElement("div"); const root = createRoot(element);
  try {
    await act(async () => { root.render(<CloudSession>Existing data</CloudSession>); });
    expect(mocks.signIn).not.toHaveBeenCalled();
    expect(element.textContent).toBe("Existing data");
  } finally { await act(async () => root.unmount()); }
});
it("shows a retry rather than exposing data when hydration fails", async () => {
  mocks.hydrate.mockRejectedValue(new Error("offline"));
  const { CloudSession } = await import("./cloud-session");
  const element = document.createElement("div"); const root = createRoot(element);
  try {
    await act(async () => { root.render(<CloudSession>Private data</CloudSession>); });
    expect(element.textContent).toContain("Retry demo");
    expect(element.textContent).not.toContain("Private data");
  } finally { await act(async () => root.unmount()); }
});
