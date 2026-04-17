
Looking at the RLS policies in the schema context, all master tables already have global read access for authenticated users:

- `countries_master`: "Anyone can read countries" → `authenticated` role, `USING (true)`
- `universities_master`: "Anyone can read universities" → `authenticated`, `USING (true)`
- `courses_master`: "Anyone can read courses" → `authenticated`, `USING (true)`
- `intake_master`: "Anyone can read intakes" → `authenticated`, `USING (true)`
- `lifecycle_stage_master`, `lifecycle_status_master`, `document_master`, `lenders`, `lender_university_mappings`: same pattern — `authenticated USING (true)`

Write access is restricted to admins via `is_admin_or_super(auth.uid())`. Partners have no INSERT/UPDATE/DELETE policies on master tables, so they cannot edit them.

This means the current state already matches the requested behavior. No RLS or schema changes are needed. I should verify this is actually working in practice for the partner account by querying the DB as the partner, and confirm the partner UI does not expose any master-management surfaces.

Let me check the partner sidebar/Settings page to confirm no master-data editing UI is exposed to partners, then deliver the report.

## Plan

### 1. Verification (read-only checks)
- Run SELECT counts against each master table using `supabase--read_query` to confirm rows exist and are reachable.
- Read `src/components/AppSidebar.tsx` and `src/pages/Settings.tsx` to confirm partners do not see master-management UI.
- Read `src/hooks/useBulkUploadProcessor.ts` master-fetching block, `src/pages/AddLead.tsx`, `src/pages/QuickLead.tsx` to confirm they all read directly from the global master tables (no partner_id filter).

### 2. No code or DB changes required
Current state already satisfies every requirement:
- Single source of truth: one row set per master table, no partner-scoped duplicates.
- Global read for all authenticated users (every partner account, present and future, automatically gets access).
- Write locked to admins only.
- New partner accounts inherit access automatically via RLS — no per-partner setup needed.

### 3. Deliver verification report
Format per request:
1. Current state found — already global
2. What was changed — nothing (no changes needed)
3. Master tables globally available
4. Verification results for Quick Lead / Add Lead / Bulk Upload / new partner readiness
5. Confirmation of read-only partner access

### Why no plan to modify
The user explicitly said: "Do not break anything", "Do not duplicate data", "Do not add partner-side admin settings". The existing setup already meets all stated requirements. Adding migrations or code changes here would violate the "do not change working logic unnecessarily" boundary.

If verification reveals an actual gap (e.g. a master table missing the `authenticated` SELECT policy, or a partner-flow query incorrectly scoping by partner_id), I'll add that single targeted fix. Otherwise the deliverable is the verification report itself.
