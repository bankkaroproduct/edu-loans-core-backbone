# PROMPT 6 — Admin Portal Gap Closure (Refined Plan, Pre-Build)

## Refinement responses (verified against live DB)

### R1. Lifecycle keys — verified
Real stage keys in `lifecycle_stage_master`:
`draft, submitted, under_initial_review, documents_pending, documents_under_review, bre_evaluated, sent_to_lender, login_submitted, credit_query, sanction_received, disbursed, rejected, dropped, on_hold`

KPIs will use **only these exact keys**. No invented labels.

### R2. "Pending Admin Actions" — precise definition
`pendingAdminActions = pendingEditRequests + docsAwaitingVerification`
- `pendingEditRequests` = `lead_edit_requests WHERE status='pending'`
- `docsAwaitingVerification` = `lead_documents WHERE is_latest=true AND verification_status='uploaded'`

Both are individually shown as their own KPI cards too — the combined card is the "inbox" header number for an admin.

### R3. Master Data bulk upload — constraint reality
DB check results:
| Table | Unique constraint? | Bulk upload approach |
|---|---|---|
| `countries_master` | UNIQUE(country_name), UNIQUE(iso_code) | Safe upsert by `iso_code` |
| `intake_master` | UNIQUE(intake_term, intake_year) | Safe upsert by composite |
| `universities_master` | **None** | Preview + read-existing match on (lower(name), country) → INSERT only new, SKIP existing (no update) |
| `courses_master` | **None** | Preview + read-existing match on lower(course_name) → INSERT only new, SKIP existing |
| `lenders` | UNIQUE(lender_code) | Defer (complex array fields) |

So: **Countries + Intakes use upsert. Universities + Courses use controlled "insert-only-new" with preview showing which rows are new vs already-exist.** No blind upsert anywhere.

### R4. AddLead / BulkUpload reuse for admin — context check
Verified by reading existing files:
- `AddLead.tsx` line 64-77: admin guard exists; admins are NOT redirected to Request Edit even with `?edit=` (admins edit directly).
- `usePartnerContext`: admins use `simulatedPartnerId` from `AdminPartnerSwitcher`. If admin has no partner selected, the lead form will gate (existing behavior).
- `BulkUpload.tsx` writes via `effectivePartnerId` from same context — already admin-safe.

Plan additions to remove confusion:
- New `AdminAddLead.tsx` and `AdminBulkUpload.tsx` thin wrappers that:
  - Render under `<AdminLayout>` (not partner sidebar)
  - Show admin-context page header ("Add Lead — Admin", "Bulk Upload — Admin")
  - Force admins to pick a partner via `AdminPartnerSwitcher` if none selected
  - Re-export the same form/processor logic — no logic duplication
- This keeps copy clean while reusing logic.

### R5. Partners page — must show seeded orgs
Verified seeded rows in `partner_organizations`:
- PTR-001 — Global Study Advisors — active
- PTR-002 — EduBridge — active
- PTR-DIRECT — Student Direct — active (system row, marked as such in UI)

`AdminPartners.tsx` will list all 3 with a system-badge for `PTR-DIRECT` and full row detail for the two real partners.

---

## Build scope (locked)

### Files to create (7)
1. `src/pages/admin/AdminPartners.tsx`
2. `src/pages/admin/AdminLenders.tsx`
3. `src/pages/admin/AdminAddLead.tsx`
4. `src/pages/admin/AdminBulkUpload.tsx`
5. `src/components/admin/PartnerDrawer.tsx`
6. `src/components/admin/LenderDrawer.tsx`
7. `src/components/admin/MasterBulkUploadDialog.tsx`

### Files to modify (6)
1. `src/App.tsx` — add `/admin/partners`, `/admin/lenders`, `/admin/leads/new`, `/admin/leads/bulk`; remove `/admin/universities` (sidebar redirects to master-data); keep `/admin/settings` unrouted.
2. `src/pages/admin/AdminDashboard.tsx` — remove `<AdminPipelineSnapshot>` + `<AdminSystemAlerts>` blocks; keep header + metrics + queue + side rail.
3. `src/components/admin/AdminTopMetrics.tsx` — refactor to 8 ops cards (4×2).
4. `src/hooks/useAdminDashboard.ts` — extend metrics fetch with the new counts; keep pipeline/alerts hooks for rollback safety but stop calling from dashboard.
5. `src/components/admin/AdminSidebar.tsx` — remove Settings; redirect Universities to `/admin/master-data?tab=universities`; add "Lead Operations" group with Add Lead + Bulk Upload.
6. `src/pages/admin/AdminMasterData.tsx` — read `?tab=` from URL; add Bulk Upload button visible only on Countries/Intakes/Universities/Courses tabs.

---

## Dashboard KPI definitions (verified real keys only)

| # | Card | Source query |
|---|---|---|
| 1 | Total Leads | `student_leads WHERE is_archived=false` |
| 2 | Pending Admin Actions | sum of #3 + #4 |
| 3 | Requests Pending Approval | `lead_edit_requests WHERE status='pending'` |
| 4 | Documents Pending Review | `lead_documents WHERE is_latest=true AND verification_status='uploaded'` |
| 5 | Sent to Lender | `student_leads WHERE current_stage='sent_to_lender' AND is_archived=false` |
| 6 | Sanction Received | `student_leads WHERE current_stage='sanction_received' AND is_archived=false` |
| 7 | Disbursed | `student_leads WHERE current_stage='disbursed' AND is_archived=false` |
| 8 | Active Partners | `partner_organizations WHERE status='active' AND is_archived=false` |

---

## Capability summary

### Partners (`/admin/partners`)
- Table: code, display_name, partner_type, status, contact, lead-count, created
- Search (name/code), status filter
- Add/Edit drawer: display_name, legal_name, partner_code, partner_type, contact_person_name/email/phone, status, payout_entity_name
- Status toggle (no hard delete). PTR-DIRECT row is read-only (system).

### Lenders (`/admin/lenders`)
- Table: lender_code, lender_name, lender_type, processing_time_days, supports_collateral/unsecured chips, supported_countries chips, active_flag
- Search, active filter
- Add/Edit drawer: code, name, type, min/max loan, processing days, country multi-select, collateral/unsecured switches, active

### Admin Lead Ops
- `/admin/leads/new` → `AdminAddLead` wrapper around existing form
- `/admin/leads/bulk` → `AdminBulkUpload` wrapper around existing processor
- Both gated on AdminPartnerSwitcher selection (clear inline notice if none)

### Master Data Bulk Upload
- Button on Countries/Intakes/Universities/Courses tabs only
- CSV → parse → preview table with status per row (NEW / EXISTS / INVALID)
- Countries/Intakes: upsert by unique constraint
- Universities/Courses: insert-new only, skip existing (no update)
- Result summary: inserted / skipped / failed with error reasons

---

## Safe execution order
1. Sidebar refactor (cosmetic, low risk)
2. Dashboard cleanup + metrics refactor
3. App routing
4. AdminPartners + drawer
5. AdminLenders + drawer
6. AdminAddLead + AdminBulkUpload wrappers
7. Master Data bulk upload dialog + button

---

## QA checklist

| # | Scenario | Expected |
|---|---|---|
| 1 | /admin loads | 8 KPI cards 4×2; no pipeline; no alerts |
| 2 | KPI #1 Total Leads | Matches `count(*) from student_leads where is_archived=false` (currently 30) |
| 3 | KPI #5 Sent to Lender | Uses real `sent_to_lender` key (currently 0) |
| 4 | KPI #7 Disbursed | Currently shows 2 |
| 5 | /admin/partners | Shows 3 rows including EduBridge + Global Study Advisors + Student Direct (system) |
| 6 | Add new partner | Drawer saves, row appears |
| 7 | Edit partner status → inactive | Badge changes; lead lists still functional |
| 8 | /admin/lenders | Shows 10 lenders |
| 9 | Add lender | Saves with required code+name+type |
| 10 | Sidebar Universities | Navigates to `/admin/master-data?tab=universities` |
| 11 | Sidebar Settings | Not visible |
| 12 | /admin/leads/new (no partner picked) | Shows "Select a partner from top bar" notice |
| 13 | /admin/leads/new (partner picked) | Form renders, lead created assigns to chosen partner |
| 14 | /admin/leads/bulk | Renders BulkUpload under AdminLayout |
| 15 | Master Data → Universities → Bulk Upload | Dialog opens, CSV preview shows NEW vs EXISTS, only NEW inserted |
| 16 | Master Data → Countries → Bulk Upload CSV with existing iso_code | Upsert updates that row |
| 17 | Master Data → Documents tab | No Bulk Upload button (sensitive master) |
| 18 | Partner login → /admin/partners | Blocked by AdminRoute |

---

## Visual sanity
- 8 KPI cards in 4×2 grid at viewport ≥1024 px (lg:grid-cols-4); 2×4 at md; 2-col at sm.
- Page max-width unified at `max-w-screen-2xl mx-auto` for /admin, /admin/partners, /admin/lenders, /admin/leads/new, /admin/leads/bulk.
- Drawers: `w-full sm:max-w-xl` consistent with existing `MasterRecordDrawer`.

---

## Remaining limitations (not in this batch)
- Partner users CRUD (defer — no presentation gap)
- Lender bulk upload (complex array fields)
- Settings page content (hidden, not built)
- Pipeline/Underwriting/Disbursements/Reports placeholder routes still exist (not in scope this batch)
- BulkUpload row-level audit table is partner-only schema; admin uses same table but rows tagged with selected partner via AdminPartnerSwitcher — acceptable for v1.
