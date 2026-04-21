# Admin Direct Edit + Partner / Lender Form Refinement + Duplicate-Capture Cleanup (v2 — corrections applied)

Four corrections in one focused batch. Bulk Upload, Reports, Requests, OTP, BRE, and Student portal are not touched.

---

## Corrections from user (v2)

1. **Admin direct edit must be available for every lead, including terminal-stage leads** (disbursed/rejected/dropped). Show a non-blocking warning banner; do NOT disable Edit.
2. **Do not auto-default `country_of_residence` to India.** Leave it blank/null when not collected at intake.
3. **Lender form — do not add `supported_course_categories` / `supported_university_tiers` in this batch.** They are not consumed by current matching SQL (`seed_lead_lender_matches` only uses country + loan amount). Keep `internal_notes` only.
4. **Admin direct-edit audit diff must cover all editable admin fields,** not just the partner edit-request whitelist. Build a dedicated admin-scope diff list.

---

## 1. Admin direct edit — plan

### 1A. Visible edit affordance
- **AdminLeads queue**: trailing Actions cell with `Pencil` icon → `/admin/leads/new?edit=<id>`. Stops row click propagation.
- **AdminLeadDetail**: render an explicit "Edit Lead" button in the admin header (separate from the partner action panel), routed to `/admin/leads/new?edit=<id>`.
- **Terminal stages**: Edit button is **always enabled** for admin. When the lead is in `disbursed` / `rejected` / `dropped`, show an amber inline warning banner at the top of the edit form: *"This lead is in a terminal stage (`<stage>`). Changes here will not re-open the lifecycle and may affect downstream reporting. Proceed only if you have a documented business reason."*

### 1B. Edit mode behavior (already mostly built)
- `AddLead?edit=<id>` already loads any lead row and runs a direct `UPDATE` on `student_leads` for admins. RLS policy `Admins can manage all leads` permits this.
- Partner-side guard at `AddLead.tsx` lines 77–82 stays.
- No edit-request RPC is touched.
- For terminal-stage leads, remove the existing terminal-stage block on the admin path only. Partner edit-request flow keeps its terminal block.

### 1C. Audit trail (full admin-scope diff)
Add a new helper `src/lib/adminEditableFields.ts` that exports an `ADMIN_EDITABLE_KEYS` list covering **every column the AddLead form can write**. This is a superset of the partner whitelist and includes (non-exhaustive):

- All `EDITABLE_FIELDS` from `editRequestFields.ts` (contact, profile, address, study, academic, co-applicant, collateral)
- Plus admin-touchable fields the partner whitelist omits: `student_full_name` (if user-edited), `university_id`, `source_sub_type`, `source_type`, `assigned_admin_id`, `partner_id`, `partner_user_id` — limited to whatever the AddLead form actually exposes today.

Implementation:
- Export `computeAdminDiff(original, edited)` in the new module, mirroring `computeDiff` shape but iterating `ADMIN_EDITABLE_KEYS`.
- After a successful admin UPDATE in `AddLead.tsx`:
  - Compute admin diff. If non-empty:
    - `INSERT INTO audit_logs` with `entity_type='student_lead'`, `entity_id=lead.id`, `action_type='admin_direct_edit'`, `actor_user_id=appUser.id`, `actor_role=appUser.role`, `old_value=<diff.from>`, `new_value=<diff.to>`, `meta={ field_count, source: 'admin_direct_edit', terminal_stage_at_edit: <bool> }`.
    - `INSERT INTO lead_notes` of type `internal`: "Admin directly edited N field(s): a, b, c" (+ "[on terminal-stage lead]" if applicable).
- RLS for `audit_logs` already permits authenticated inserts where `actor_user_id` matches the user's own `users.id`.

### 1D. Separation guarantees
- `AdminEditRequestPanel` and `submit_edit_request` / `decide_edit_request` RPCs unchanged.
- Partner role still cannot reach `/leads/new?edit=`.

---

## 2. Partner form — field classification

No DB schema change. Fields stay nullable; we just stop asking for them at intake.

### Step 1 — Student Basic Details
| Field | Decision |
|---|---|
| First Name | Compulsory |
| Last Name | Optional |
| Mobile Number | Compulsory |
| Email | Optional |
| WhatsApp | Optional |
| City | Optional |
| State | Optional |
| Country of Residence | **Removed from intake. Leave NULL — no auto-default.** Collected later via student portal / docs. |

### Step 2 — Study Intent
| Field | Decision |
|---|---|
| Intended Study Country | Compulsory |
| University (master OR raw) | Compulsory (one of the two counts) |
| Course (master OR raw) | Compulsory (one of the two counts) |
| Intake Term | Compulsory |
| Intake Year | Compulsory |
| Approx Loan Amount Required | Compulsory (relabeled to "Approx") |

### Step 3 — Financial — DROPPED as a step
Move co-applicant name/relation + secured/unsecured toggle into a collapsed "Co-applicant context (optional)" panel on the Notes step. Drop entirely:
- Co-Applicant Income (re-collected later)
- Collateral Notes (re-collected at document stage)

### Step 4 — Notes
- Source Subtype dropdown: **removed from UI**. Server still writes `source_sub_type='add_lead'`.
- Partner Remark: optional.
- Co-applicant context (collapsed): optional.

### Always auto-prefilled (not asked)
- `partner_id`, `partner_user_id`, `source_type='partner'`, `source_sub_type='add_lead'`.
- `country_of_residence`: **NOT auto-set**. Stays whatever the form provides (which is now nothing → NULL).

### UI
- Read-only "Submitting as: <Partner Org>" chip at the top.
- Step indicator collapses 5 → 4.

QuickLead: unchanged.

---

## 3. Lender form — field classification (corrected)

**No new schema columns for course categories or university tiers in this batch.** They aren't consumed by `seed_lead_lender_matches` today (which only matches on `supported_countries` and loan amount). Adding unused columns now would be dead data.

### Single schema addition
- `ALTER TABLE public.lenders ADD COLUMN internal_notes text;` — used by ops, no logic dependency.

### LenderDrawer reorganized into 3 sections (was: flat)
1. **Identity** — Code, Name, Type, Active
2. **Loan Coverage** — Min/Max loan, Processing days, Supports Collateral, Supports Unsecured, Min Income (conditional: only when Supports Unsecured = true)
3. **Eligibility** — Supported Countries (chip picker, ≥1 required)
4. **Internal Notes** (collapsed) — single free-text field

### Field rules
| Field | Decision |
|---|---|
| Lender Code | Compulsory, immutable on edit |
| Lender Name | Compulsory |
| Lender Type | Compulsory |
| Min Loan / Max Loan | Compulsory (blank allowed → no bound) |
| Processing Days | Compulsory |
| Min Income | **Conditional** — visible & required only when `supports_unsecured=true` |
| Supports Collateral / Supports Unsecured | Compulsory toggles |
| Supported Countries | Compulsory (≥1) |
| Active | Compulsory toggle |
| Internal Notes | Optional |

### Removed / not added in this batch
- Course-category coverage — defer until matching SQL consumes it.
- University-tier coverage — defer until matching SQL consumes it.
- Marketing labels, escalation contacts — not referenced anywhere.

---

## 4. Partner form (PartnerDrawer) refinement

| Field | Decision |
|---|---|
| Display Name / Legal Name / Partner Code / Partner Type / Status | Compulsory |
| Contact Person Name / Email / Phone | Optional (recommended for go-live) |
| Payout Entity Name | Optional, helper text: "Defaults to legal name if blank" |

UX: small "Required for go-live" hint under Contact section. No new fields.

---

## 5. Duplicate-data cleanup

| Where | Action |
|---|---|
| Partner Add Lead — Country of Residence | Removed from intake. Stays NULL until collected later. **No India default.** |
| Partner Add Lead — Source Subtype dropdown | Removed from UI; server writes `add_lead`. |
| Partner Add Lead — Co-applicant Income | Removed from intake. |
| Partner Add Lead — Collateral Notes | Removed from intake. |
| Partner Add Lead — partner identity entry | Replaced with read-only "Submitting as" chip. |
| Lender Drawer — Min Income | Hidden unless Supports Unsecured = true. |
| Admin Lead Detail — Edit Lead button | Now explicitly rendered for admin context; works on terminal stages too. |

---

## 6. Files to modify

| File | Change |
|---|---|
| `supabase/migrations/<new>.sql` | `ALTER TABLE public.lenders ADD COLUMN internal_notes text;` |
| `src/lib/adminEditableFields.ts` (new) | `ADMIN_EDITABLE_KEYS` superset list + `computeAdminDiff` helper. |
| `src/components/admin/LenderDrawer.tsx` | Reorganize into 4 sections; conditional Min Income; require ≥1 country; add internal notes textarea. |
| `src/components/admin/PartnerDrawer.tsx` | Helper text + "Required for go-live" hint only. |
| `src/pages/AddLead.tsx` | Drop financial step; drop Country-of-Residence + Source-Subtype + Collateral Notes + Co-app Income from UI; add submitting-as chip; require University+Course at submit; relabel loan to "Approx"; **on admin edit, allow terminal-stage editing with warning banner**; admin direct-edit audit insert via `computeAdminDiff`. |
| `src/pages/admin/AdminLeads.tsx` | Trailing Actions cell with Edit pencil. |
| `src/pages/admin/AdminLeadDetail.tsx` | Render "Edit Lead" button for admin (always enabled, including terminal stages). |

No changes to: BulkUpload pages, AdminEditRequests, AdminEditRequestPanel, AdminReports, student portal, OTP/BRE, edit-request RPCs.

---

## 7. Safe execution order

1. Schema migration: `lenders.internal_notes` only.
2. New helper `adminEditableFields.ts`.
3. LenderDrawer refactor.
4. PartnerDrawer helper text.
5. AddLead: form refactor + admin terminal-stage warning + audit insert.
6. AdminLeads: row Edit pencil.
7. AdminLeadDetail: admin Edit button (no terminal guard).
8. Manual sanity sweep at 1309×853.

---

## 8. Runtime QA checklist

### A. Admin direct edit
- Admin sees Edit pencil on every row in `/admin/leads`. **PASS**
- Pencil opens `AddLead?edit=` inside admin shell, hydrates the lead. **PASS**
- Admin Lead Detail shows "Edit Lead" button on **all** stages including terminal. **PASS**
- Terminal-stage edit shows amber warning banner but allows save. **PASS**
- Saving an edit calls `UPDATE student_leads` directly — no `submit_edit_request` invocation. **PASS**
- `audit_logs` row created with `action_type='admin_direct_edit'`, full admin-scope diff (covers every changed field). **PASS**
- `lead_notes` internal note appears in lead timeline listing the changed fields (with terminal-stage marker if applicable). **PASS**
- Partner request-edit flow on `/leads/:id` still works as before. **PASS**

### B. Partner Add Lead
- 4 steps (no Financial step). **PASS**
- "Submitting as: <Org Name>" chip visible at top. **PASS**
- Country of Residence not asked; lead row shows `country_of_residence IS NULL`. **PASS** (no India default)
- Source subtype not asked; lead row shows `source_sub_type='add_lead'`. **PASS**
- Co-applicant context accessible via collapsed panel on Notes step. **PASS**
- Co-applicant income / collateral notes not asked. **PASS**

### C. Lender form
- Drawer renders 4 sections: Identity / Loan Coverage / Eligibility / Notes. **PASS**
- Min Income hidden when Supports Unsecured = false. **PASS**
- Min Income required when Supports Unsecured = true. **PASS**
- Save blocked unless Code + Name + Type + ≥1 Country. **PASS**
- Internal Notes textarea persists. **PASS**
- No new course-category / university-tier fields rendered. **PASS**
- `seed_lead_lender_matches` still produces matches unchanged. **PASS**

### D. Regression safety
- Partner cannot reach `/leads/new?edit=`. **PASS**
- `AdminEditRequestPanel` still functions. **PASS**
- Bulk Upload, Reports, Student portal untouched. **PASS**

---

## 9. Out of scope (explicit)
- BRE scoring math.
- Lender matching SQL.
- Course-category / university-tier coverage on lenders (deferred until consumed).
- Partner-branch / payout-rule UI.
- Student portal field changes.
- Auto-defaulting any field that the user did not enter.
