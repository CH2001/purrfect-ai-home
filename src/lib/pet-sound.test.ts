import { describe, expect, it } from "vitest";
import { petSoundRate } from "./pet-sound";

describe("illustrative pet sound profiles", () => {
  it("uses higher pitches for infants than adolescents and adults", () => {
    for (const species of ["CAT", "DOG"] as const) {
      expect(petSoundRate({ species, ageMonths: 3 })).toBeGreaterThan(petSoundRate({ species, ageMonths: 8 }));
      expect(petSoundRate({ species, ageMonths: 8 })).toBeGreaterThan(petSoundRate({ species, ageMonths: 24 }));
    }
  });
  it("accounts for known dog breed size and handles unknown ages", () => {
    expect(petSoundRate({ species: "DOG", ageMonths: 24, breed: "Golden Retriever" })).toBeLessThan(1);
    expect(petSoundRate({ species: "DOG", ageMonths: 24, breed: "Chihuahua" })).toBeGreaterThan(1);
    expect(petSoundRate({ species: "CAT", ageMonths: null })).toBe(1);
  });
});