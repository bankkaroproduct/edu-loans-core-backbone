

# Fix: Remove `student_full_name` from All Insert Payloads

## Root Cause
The `student_full_name` column is a generated column in Postgres. The frontend is explicitly sending a value for it in insert payloads, which Postgres rejects.

## Changes (3 files)

### 1. `src/pages/QuickLead.tsx` (~line 113-118)
- Remove `const fullName = ...` line
- Remove `student_full_name: fullName` from the payload object

### 2. `src/pages/AddLead.tsx` (~line 190-192)
- Remove `student_full_name: fullName || null` from the payload object
- Remove the `fullName` variable if only used for the payload

### 3. `src/hooks/useBulkUploadProcessor.ts` (~line 397-409)
- Remove `const fullName = ...` line
- Remove `student_full_name: fullName` from the insert payload

## What stays unchanged
- All SELECT queries that read `student_full_name` — those are fine
- Database schema — no changes
- Display logic using `student_full_name` — stays as-is
- RLS policies, downstream writes, debug panel — untouched

## Scope
Three surgical deletions. No other files need changes.

