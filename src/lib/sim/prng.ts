// xorshift32 PRNG shared by the simulation engine and the day-life simulator.
// Kept in its own module so both stay deterministic without a circular import.
// Production authority: the Cloud Run service uses the same algorithm (behavior_rules.json seedAlgorithm).
export function xorshift32(state: number): number {
  let x = state | 0 || 0x9e3779b9;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  return x >>> 0;
}
export function rand(state: number): [number, number] {
  const next = xorshift32(state);
  return [next / 0xffffffff, next];
}
