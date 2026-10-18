import { ANIMALS } from "@/lib/data/seed";
import { matchHousehold } from "@/lib/discover-matching";
import type { HouseholdVersion } from "@/lib/domain/types";

export type ChatTurn = { role: "user" | "assistant"; text: string };
/** Small-catalogue lexical retrieval. No external search or invented shelter records. */
export function retrievePets(message: string, history: ChatTurn[], home: HouseholdVersion) {
  const latest = message.toLowerCase();
  const context = [...history.filter(t => t.role === "user").slice(-3).map(t => t.text), message].join(" ").toLowerCase();
  const named = ANIMALS.filter(a => latest.includes(a.name.toLowerCase()));
  const previousNamed = ANIMALS.filter(a => context.includes(a.name.toLowerCase()));
  const scope = named.length ? named : previousNamed.length && !/recommend|other|instead|compare/.test(latest) ? previousNamed : ANIMALS;
  const speciesText = /\bcats?\b|\bdogs?\b/.test(latest) ? latest : context;
  const cat = /\bcats?\b/.test(speciesText), dog = /\bdogs?\b/.test(speciesText);
  const tokens = context.match(/[a-z]{3,}/g) ?? [];
  return scope.filter(a => a.status === "APPROVED" && (named.length || cat === dog || a.species === (cat ? "CAT" : "DOG")))
    .map(animal => {
      const match = matchHousehold(animal, home);
      const words = (animal.name + " " + animal.tags.join(" ") + " " + animal.description).toLowerCase();
      const lexical = [...new Set(tokens)].reduce((score, word) => score + (words.includes(word) ? 2 : 0), 0);
      return { animal, match, score: lexical + match.priority };
    }).sort((a, b) => b.score - a.score || a.animal.name.localeCompare(b.animal.name)).slice(0, 3)
    .map(({ animal, match }) => ({
      id: animal.animalId, name: animal.name, species: animal.species,
      ageMonths: animal.ageMonths, description: animal.description, tags: animal.tags,
      traits: animal.baselineTraits, observations: animal.verifiedObservations,
      health: animal.healthInfo, reasons: match.reasons, cautions: match.cautions, unknowns: match.unknowns,
      provenance: "Synthetic demo catalogue" as const,
    }));
}
export type PetSource = ReturnType<typeof retrievePets>[number];
export function catalogueReply(sources: PetSource[]) {
  return sources.map(p => p.name + " [" + p.id + "]: " + p.description + " " + (p.reasons[0] ?? "") + " Check: " + (p.cautions[0] ?? p.unknowns[0])).join("\n\n")
    + "\n\nThese are fictional catalogue suggestions, not an adoption approval. What daily care time and quiet space could you provide?";
}
