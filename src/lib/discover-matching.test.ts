import { describe, expect, it } from "vitest";
import { ANIMALS, SEED_HOUSEHOLD } from "@/lib/data/seed";
import { matchHousehold, swipeDecision } from "./discover-matching";

describe("Discover decisions", () => {
  it("saves left, passes right and ignores short or vertical gestures", () => {
    expect(swipeDecision(-100, 10, 320)).toBe("save");
    expect(swipeDecision(100, 10, 320)).toBe("pass");
    expect(swipeDecision(20, 0, 320)).toBeNull();
    expect(swipeDecision(-100, 120, 320)).toBeNull();
  });
});
describe("Household matching", () => {
  it("keeps unknown dog compatibility explicit and exposes long absences", () => {
    const result = matchHousehold(ANIMALS[0], SEED_HOUSEHOLD);
    expect(result.unknowns).toContain("Compatibility with your resident dog is unknown.");
    expect(result.cautions.some((text) => text.includes("MON, TUE, WED"))).toBe(true);
  });
  it("checks care coverage day by day, not just caregiver existence", () => {
    const result = matchHousehold(ANIMALS[0], { ...SEED_HOUSEHOLD, caregivers: [{ name: "Helper", days: ["MON"] }] });
    expect(result.cautions.some((text) => text.includes("TUE, WED"))).toBe(true);
  });
  it("ranks quieter settings without mutating inputs or implying certainty", () => {
    const before = JSON.stringify(SEED_HOUSEHOLD);
    const quiet = matchHousehold(ANIMALS[0], { ...SEED_HOUSEHOLD, noiseLevel: "LOW" });
    const noisy = matchHousehold(ANIMALS[0], { ...SEED_HOUSEHOLD, noiseLevel: "HIGH" });
    expect(quiet.priority).toBeGreaterThan(noisy.priority);
    expect(quiet.unknowns).toContain("Shelter eligibility requirements have not been supplied.");
    expect(JSON.stringify(SEED_HOUSEHOLD)).toBe(before);
  });
});