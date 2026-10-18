import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
vi.mock("@/lib/cloud/client", () => ({ cloudEnabled: false, api: vi.fn(), ApiError: class extends Error {} }));
import { useAppState, clearCloudState, setState } from "./store";
it("keeps React snapshots stable when selectors allocate arrays", async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  clearCloudState();
  let renders = 0;
  function Test() {
    const trials = useAppState(s => s.trials.filter(t => t.status === "IN_PROGRESS"));
    renders++;
    return <p>{trials.length}</p>;
  }
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () => { root.render(<Test />); });
    expect(container.textContent).toBe("0");
    await act(async () => { setState(s => ({ ...s, userName: "Visitor" })); });
    expect(renders).toBe(2);
  } finally { await act(async () => { root.unmount(); }); }
});
