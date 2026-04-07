

# EduLoans Partner Portal — Backend Architecture & Data Foundation

## Overview
Build the complete database schema, RLS security, master data, seed data, and architecture documentation for the EduLoans Partner Portal using Supabase (Lovable Cloud). This is the data backbone that all future UI prompts will build upon.

---

## Phase 1: Enable Backend & Core Enums

- Enable Lovable Cloud (Supabase) for the project
- Create all enum types: `app_role` (super_admin, admin, partner_admin, partner_agent), `partner_type`, `partner_status`, `lead_stage`, `lead_status`, `document_status`, `payout_status`, `bulk_upload_status`, `notification_type`, etc.

## Phase 2: Core Tables — Users & Partners

- **users** table linked to `auth.users` with role, partner_id scoping, is_active, last_login
- **partner_organizations** with partner_code, legal/display names, contact info, payout terms, status, onboarding_date
- **partner_branches** for future multi-branch expansion
- **user_roles** table (separate from profiles per security best practices) with `has_role()` security definer function

## Phase 3: Master Data Tables

Create all master/reference tables with seed data:
- **countries_master** — seed ~15 countries (India, US, UK, Canada, Australia, Germany, etc.)
- **universities_master** — seed ~20 representative universities with country, ranking_bucket, aliases
- **courses_master** — seed ~15 courses with category, STEM/MBA flags
- **lenders** — seed 8-10 lenders with loan ranges, collateral support, supported countries
- **document_master** — seed ~15 document types (passport, transcripts, income proof, etc.)
- **lifecycle_stage_master** — seed all 14 stages (Draft → Disbursed/Rejected/Dropped/On Hold)
- **lifecycle_status_master** — seed statuses per stage (e.g., Documents stage → Reupload Needed, Awaiting Verification, Verified)
- **intake_master** — seed intake terms (Fall, Spring, Summer) × years
- Additional masters: partner_types, payout_basis_types, rejection_reasons, relation_types, source_sub_types, note_types

## Phase 4: Lead Engine Tables

- **student_leads** — full lead record with human-readable ID (EL-PL-000001), all student fields, partner attribution, stage/status, admin assignment, duplicate/fraud flags, future student_portal_user_id
- **lead_stage_history** — every stage/status transition with actor, reason, internal + partner-visible notes
- **lead_notes** — typed notes (internal/partner-visible/system)
- Database function to auto-generate sequential human-readable lead IDs
- Database trigger to log stage changes automatically to history

## Phase 5: Document Architecture

- **lead_documents** — uploaded files with version tracking, verification status, uploaded_by role
- **lead_document_requirements** — dynamic per-lead checklist with status (not_uploaded → uploaded → verified/rejected/reupload_needed/waived/not_applicable), optional lender scoping

## Phase 6: BRE Compatibility Layer

- **lead_lender_matches** — per-lead lender evaluation with score, fit_category, lock_status, recommendation_rank, bre_output_json
- **lender_university_mappings** — university-lender restriction/preference mappings for future BRE rules

## Phase 7: Payout Architecture

- **partner_payout_rules** — per-partner (optionally per-lender) payout config with basis, amount/percent, trigger stage, clawback rules, effective dates
- **partner_payout_records** — per-lead payout tracking with status lifecycle (triggered → approved → paid), audit fields

## Phase 8: Bulk Upload Architecture

- **bulk_upload_batches** — batch metadata with human-readable ID (BULK-000001), partner scoping, row counts, status
- **bulk_upload_row_results** — per-row validation results with raw_payload JSON, failure reasons, linked created_lead_id

## Phase 9: Audit & Notifications

- **audit_logs** — entity-based audit trail with actor, action_type, old_value/new_value JSON, meta JSON
- **notifications_queue** — future-ready notification table with entity reference, recipient, delivery status

## Phase 10: Row-Level Security (RLS)

Apply RLS policies across all tables:
- **Partner scoping**: Partner users can only access records where `partner_id` matches their own organization
- **Admin access**: Admin/Super Admin can read/write across all partners
- **Note visibility**: Partner users cannot see `internal` type notes
- **Master tables**: Read-only for partners, writable by admins
- **Payout rules**: Read-only for partners
- **Audit logs**: Admin-only access
- Security definer functions for role checks to avoid RLS recursion

## Phase 11: Validation Functions

- Database-level constraints: required fields (student name, phone, country, intake, course), numeric checks (loan amount, income), phone format validation
- Unique constraints for duplicate detection (phone + intake combination)
- Check constraints for logical consistency (collateral fields)
- Partner scoping enforced via RLS (cannot spoof partner_id)

## Phase 12: Seed Data

Insert test data:
- 2 partner organizations (with partner codes)
- 1 super admin, 1 admin/ops user
- 2 partner admin users (one per partner org)
- 2 partner agent users
- All master data as described above
- 2 sample payout rules

## Phase 13: Architecture Documentation

- Create `ARCHITECTURE.md` in project root documenting all tables, relationships, role/access model, lifecycle design, and what's ready for next prompts
- Create a minimal placeholder admin page showing table counts / system health for verification

---

## Key Design Decisions
- UUIDs as primary keys, human-readable IDs as indexed unique columns
- Soft-delete via `is_archived` flags (no hard deletes)
- All tables have `created_at`, `updated_at` timestamps
- Stage and status are always separate fields backed by master tables
- Partner attribution is immutable on leads (changes require audit)
- All enums defined at database level for type safety

