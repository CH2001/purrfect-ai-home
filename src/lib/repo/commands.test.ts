import { describe, expect, it } from "vitest";
import { initial } from "./state";
import { executeCommand } from "./commands";
import { commandSchema } from "@/lib/domain/validation";

const fresh = () => structuredClone(initial);
const create = () => executeCommand(fresh(), { kind: "createTrial", animalId: "cat_oyen" }, "request-1");
describe("authoritative commands", () => {
  it("rejects client-supplied scores, snapshots and ownership", () => {
    expect(commandSchema.safeParse({ kind: "createTrial", animalId: "cat_oyen", ownerUid: "someone-else", state: { stress: 0 } }).success).toBe(false);
    expect(commandSchema.safeParse({ kind: "household", patch: { revision: 999 }, source: "MANUAL_EDIT", expectedRevision: 1 }).success).toBe(false);
  });
  it("keeps previous household versions and pinned trial snapshots unchanged", () => {
    const { state } = create();
    const snapshot = structuredClone(state.trials[0].snapshot);
    const changed = executeCommand(state, { kind: "household", patch: { noiseLevel: "LOW" }, source: "MANUAL_EDIT", expectedRevision: 1 }, "request-2");
    expect(changed.state.householdVersions).toHaveLength(2);
    expect(changed.state.trials[0].snapshot).toEqual(snapshot);
    expect(state.householdVersions[0].noiseLevel).toBe(snapshot.household.noiseLevel);
  });
  it("rejects stale household and trial revisions", () => {
    const { state, trialId } = create();
    expect(() => executeCommand(state, { kind: "household", patch: {}, source: "MANUAL_EDIT", expectedRevision: 0 }, "x")).toThrow(/household changed/);
    expect(() => executeCommand(state, { kind: "care", trialId: trialId!, actionId: "FEED", expectedStateVersion: 50 }, "x")).toThrow(/trial changed/);
  });
  it("rejects unknown trials and unsafe introductions", () => {
    const { state, trialId } = create();
    expect(() => executeCommand(state, { kind: "care", trialId: "other-user-trial", actionId: "FEED", expectedStateVersion: 0 }, "x")).toThrow(/not found/);
    expect(() => executeCommand(state, { kind: "care", trialId: trialId!, actionId: "FORCE_DIRECT_MEETING", expectedStateVersion: 0 }, "x")).toThrow(/locked/);
  });
  it("completes seven days and creates an evidence-based report on the server", () => {
    let { state } = create();
    for (let day = 1; day <= 7; day++) {
      const trial = state.trials[0];
      state = executeCommand(state, { kind: "day", trialId: trial.trialId, actionId: "OBSERVE", expectedDay: day, expectedStateVersion: trial.stateVersion }, `day-${day}`).state;
    }
    expect(state.trials[0].status).toBe("COMPLETED");
    expect(state.trials[0].dayLogs).toHaveLength(7);
    expect(state.trials[0].report?.narrative).toContain("educational rehearsal");
    const trial = state.trials[0];
    expect(() => executeCommand(state, { kind: "care", trialId: trial.trialId, actionId: "FEED", expectedStateVersion: trial.stateVersion }, "after")).toThrow(/complete/);
  });
});
