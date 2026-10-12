import type { Species } from "@/lib/domain/types";

export interface SoundPet { species: Species; ageMonths: number | null; breed?: string }

/** Illustrative pitch variation, not an authentic recording of a particular breed. */
export function petSoundRate(pet: SoundPet) {
  const infant = pet.ageMonths !== null && pet.ageMonths < 6;
  const young = pet.ageMonths !== null && pet.ageMonths < 12;
  const breed = pet.breed?.toLowerCase() ?? "";
  const smallDog = /chihuahua|pomeranian|toy|yorkshire|dachshund|shih tzu/.test(breed);
  const largeDog = /retriever|shepherd|mastiff|great dane|husky|rottweiler/.test(breed);
  const largeCat = /maine coon|ragdoll|norwegian/.test(breed);
  const sizeRate = pet.species === "DOG" ? (smallDog ? 1.18 : largeDog ? 0.85 : 1) : (largeCat ? 0.92 : 1);
  return sizeRate * (infant ? 1.4 : young ? 1.2 : 1);
}