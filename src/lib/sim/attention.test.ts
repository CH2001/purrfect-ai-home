import { describe, expect, it } from "vitest";
import { createTrial } from "@/lib/sim/engine";
import { attentionNeed, idleLimitSeconds } from "@/lib/sim/attention";
import { ANIMALS, SEED_HOUSEHOLD } from "@/lib/data/seed";

const trialFor = (id: string) => createTrial(ANIMALS.find((a) => a.animalId === id)!, SEED_HOUSEHOLD, 1);

describe("attentionNeed", () => {
  it("alerts every stray when left alone past its limit", () => {
    for (const a of ANIMALS) {
      const t = trialFor(a.animalId);
      t.state = { ...t.state, hunger: 10 };
      expect(attentionNeed(t, idleLimitSeconds(t))?.kind).toBe("CALLING");
      expect(attentionNeed(t, 0)).toBeNull();
    }
  });
  it("flags hunger first", () => {
    const t = trialFor("cat_oyen");
    t.state = { ...t.state, hunger: 80 };
    expect(attentionNeed(t, 0)?.action).toBe("FEED");
  });
  it("clingy Bumi calls sooner than the limit for independent pets", () => {
    expect(idleLimitSeconds(trialFor("dog_bumi"))).toBe(45);
  });
});
