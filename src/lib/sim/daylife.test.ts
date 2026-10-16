import { describe, expect, it } from "vitest";
import { createTrial } from "@/lib/sim/engine";
import { simulateDayLife } from "@/lib/sim/daylife";
import { ANIMALS, SEED_HOUSEHOLD } from "@/lib/data/seed";
import type { TrialEvent } from "@/lib/domain/types";

const oyen = ANIMALS.find((a) => a.animalId === "cat_oyen")!;
const base = () => createTrial(oyen, SEED_HOUSEHOLD, 42);
const feedEvent = (id: string): TrialEvent => ({ eventId: id, day: 1, kind: "ACTION", code: "FEED", label: "FEED", provenance: "SIMULATED", at: "" });

describe("simulateDayLife", () => {
  it("is deterministic for the same seed", () => {
    const t = base();
    const a = simulateDayLife(t, "OBSERVE", 42).log;
    const b = simulateDayLife(t, "OBSERVE", 42).log;
    expect(a.entries).toEqual(b.entries);
  });

  it("logs missed morning and evening meals when nobody feeds", () => {
    const { log } = simulateDayLife(base(), "OBSERVE", 42);
    expect(log.entries.filter((e) => e.kind === "MISSED")).toHaveLength(2);
    expect(log.missed.join(" ")).toMatch(/Breakfast/);
    expect(log.missed.join(" ")).toMatch(/Dinner/);
  });

  it("logs both meals when fed twice", () => {
    const t = base();
    t.events = [feedEvent("e1"), feedEvent("e2")];
    const { log } = simulateDayLife(t, "OBSERVE", 42);
    expect(log.entries.filter((e) => e.kind === "MISSED")).toHaveLength(0);
    expect(log.entries.filter((e) => e.kind === "FEEDING")).toHaveLength(2);
  });

  it("captures a louder follow-up when the morning greeting gets no attention", () => {
    const { log } = simulateDayLife(base(), "CONTINUE_SEPARATION", 42);
    const vocals = log.entries.filter((e) => e.kind === "VOCAL");
    expect(vocals.length).toBeGreaterThanOrEqual(2);
    expect(vocals[1].text).toMatch(/30 minutes/);
  });

  it("changes behaviour gradually — at least 60 minutes between changes", () => {
    const { log } = simulateDayLife(base(), "OBSERVE", 42);
    const mins = log.entries
      .filter((e) => e.kind === "BEHAVIOR")
      .map((e) => {
        const [h, m] = e.at.split(":").map(Number);
        return h * 60 + m;
      });
    for (let i = 1; i < mins.length; i++) expect(mins[i] - mins[i - 1]).toBeGreaterThanOrEqual(60);
  });

  it("logs loneliness for a sociable animal left without interaction", () => {
    const bumi = ANIMALS.find((a) => a.animalId === "dog_bumi")!; // socialApproach 72 → clingy
    const t = createTrial(bumi, SEED_HOUSEHOLD, 7);
    const { log } = simulateDayLife(t, "CONTINUE_SEPARATION", 7);
    expect(log.entries.some((e) => e.kind === "LONELINESS" && /lonely/i.test(e.text))).toBe(true);
    expect(log.missed.join(" ")).toMatch(/no interaction/i);
  });
});
