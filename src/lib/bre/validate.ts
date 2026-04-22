// Client-side validation of a scoring config.
// Mirrors the DB trigger `bre_validate_scoring_config`.
//
// Band semantics:
//  - Numeric bands use [from, to] (inclusive on both ends).
//  - Two numeric bands overlap when a.from <= b.to && b.from <= a.to.
//  - Enum bands are matched by exact string equality on `value`.

import type { BreScoringConfig, ScoringParameter, Band, NumericBand } from "./types";

export interface ValidationError {
  bucket?: string;
  param_key?: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

const BUCKETS: { key: keyof BreScoringConfig; label: string }[] = [
  { key: "student_params", label: "student" },
  { key: "university_params", label: "university" },
  { key: "coapplicant_params", label: "coapplicant" },
];

function isNumericBand(b: Band): b is NumericBand {
  return typeof (b as NumericBand).from === "number" && typeof (b as NumericBand).to === "number";
}

export function validateScoringConfig(cfg: BreScoringConfig): ValidationResult {
  const errors: ValidationError[] = [];

  for (const { key, label } of BUCKETS) {
    const params = cfg[key] as ScoringParameter[] | undefined;
    if (!Array.isArray(params)) {
      errors.push({ bucket: label, message: `${label}_params must be an array` });
      continue;
    }

    const sum = params.reduce((acc, p) => acc + (Number(p.weight) || 0), 0);
    if (sum !== 100) {
      errors.push({
        bucket: label,
        message: `${label} weights must sum to 100 (got ${sum})`,
      });
    }

    for (const p of params) {
      if (!Array.isArray(p.bands)) {
        errors.push({
          bucket: label,
          param_key: p.param_key,
          message: `bands must be an array`,
        });
        continue;
      }

      for (const b of p.bands) {
        if (typeof b.score !== "number" || b.score < 0 || b.score > 100) {
          errors.push({
            bucket: label,
            param_key: p.param_key,
            message: `band score must be between 0 and 100 (got ${b.score})`,
          });
        }
        if (isNumericBand(b) && b.from > b.to) {
          errors.push({
            bucket: label,
            param_key: p.param_key,
            message: `band from (${b.from}) must be <= to (${b.to})`,
          });
        }
      }

      // overlap detection (numeric only)
      const numeric = p.bands.filter(isNumericBand);
      for (let i = 0; i < numeric.length; i++) {
        for (let j = i + 1; j < numeric.length; j++) {
          const a = numeric[i];
          const c = numeric[j];
          if (a.from <= c.to && c.from <= a.to) {
            errors.push({
              bucket: label,
              param_key: p.param_key,
              message: `overlapping bands: [${a.from}-${a.to}] vs [${c.from}-${c.to}]`,
            });
          }
        }
      }
    }
  }

  if (cfg.bucket_threshold == null || cfg.bucket_threshold < 0 || cfg.bucket_threshold > 100) {
    errors.push({ message: `bucket_threshold must be between 0 and 100` });
  }

  if (!Array.isArray(cfg.overall_band_mapping) || cfg.overall_band_mapping.length === 0) {
    errors.push({ message: `overall_band_mapping must contain at least one band` });
  }

  return { valid: errors.length === 0, errors };
}
