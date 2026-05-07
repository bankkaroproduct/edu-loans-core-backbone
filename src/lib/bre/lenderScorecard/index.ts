export { evaluateLenderScorecard } from "./evaluate";
export * from "./types";
export { getSeedForLender, SEEDS, DEFAULT_SEED } from "./seeds";

// Compile-time feature flag. Layer 2 output is purely additive.
export const ENABLE_LENDER_SCORECARD = true;
