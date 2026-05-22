# Plan: Simplify BRE Diagnostic Display (Admin Portal Only)

## Goal
Make the BRE results on the Admin Lead Detail page more user-friendly by removing jargon while keeping all data accessible.

## Scope
- **Portal**: Admin portal only (`AdminBreAndLenderSection.tsx`)
- **Detail level**: Verdict + collapsible details (bucket cards + top factors/highlights visible by default; full parameter table stays behind accordion toggle)
- **Jargon**: Remove all technical labels

## Changes (5 presentational edits only — zero BRE logic touched)

1. **Section eyebrow** (line ~339): Rename `BRE Diagnostic` → `Eligibility result`
2. **StatusBanner** (lines ~905-922): Remove `Band`, `Bucket threshold`, `Config v` suffixes from the score line. Keep only `Score X/100`.
3. **BucketScorecard** (lines ~965-968): Remove `Threshold 60` sub-label below each bucket score.
4. **Accordion trigger** (lines ~409-415): Rename `View detailed BRE breakdown (N parameters)` → `View full parameter breakdown`.
5. **BucketTraceTable header** (lines ~1065-1076): Remove `/ threshold N · PASS/FAIL` suffix from the per-bucket total line.

## What stays untouched
- `evaluate()`, `loadActive()`, `BreResult`, `buildBreProfileFromLeadAsync`, rank modifiers, lender recommendation logic, scoring, ranking, eligibility, rates, loan amounts
- Parameter table rows and their data
- Top factors reducing score + Positive highlights sections
- Primary rejection reasons callout
- Approximate-data amber warning
- Lender cards, coverage chips, all lender display logic
- Any other admin page, partner portal, or unrelated component
- Database, RLS, edge functions, types

## Verification
- Run BRE on any lead — status banner shows only `Rejected · Score X/100`
- Bucket cards show label + score + PASS/FAIL only (no threshold sub-label)
- Accordion still expands to full parameter table
- Top factors / positive highlights still render
- Rejection reasons callout still appears for failed leads
- No layout shift where elements were removed
