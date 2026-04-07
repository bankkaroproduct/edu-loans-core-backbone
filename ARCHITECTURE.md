# EduLoans Partner Portal — Architecture Documentation

## Overview

This document describes the complete backend data architecture for the EduLoans Partner Portal, built on Lovable Cloud (Supabase). This is the foundational data backbone that all UI pages will be built upon.

---

## Database Schema Summary

### Core Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `users` | All portal users (admins, partners) | role, partner_id, auth_user_id |
| `user_roles` | Separate role storage (security best practice) | user_id, role |
| `partner_organizations` | Partner companies | partner_code, legal_name, status |
| `partner_branches` | Future multi-branch support | partner_id, branch_name |

### Master Data Tables

| Table | Purpose | Seed Count |
|-------|---------|------------|
| `countries_master` | Country reference | 15 |
| `universities_master` | University reference with aliases | 20 |
| `courses_master` | Course types with STEM/MBA flags | 15 |
| `lenders` | Lender profiles with loan ranges | 10 |
| `document_master` | Document type definitions | 15 |
| `lifecycle_stage_master` | Lead lifecycle stages | 14 |
| `lifecycle_status_master` | Statuses per stage | 28 |
| `intake_master` | Intake terms × years | 9 |

### Lead Engine Tables

| Table | Purpose |
|-------|---------|
| `student_leads` | Main lead record with human-readable ID (EL-PL-000001) |
| `lead_stage_history` | Auto-logged stage/status transitions |
| `lead_notes` | Typed notes (internal/partner-visible/system) |

### Document Architecture

| Table | Purpose |
|-------|---------|
| `lead_documents` | Uploaded files with versioning |
| `lead_document_requirements` | Per-lead dynamic checklist |

### BRE Compatibility

| Table | Purpose |
|-------|---------|
| `lead_lender_matches` | Per-lead lender scoring and fit categories |
| `lender_university_mappings` | University-lender restriction mappings |

### Payout Architecture

| Table | Purpose |
|-------|---------|
| `partner_payout_rules` | Per-partner payout configuration |
| `partner_payout_records` | Per-lead payout tracking |

### Bulk Upload

| Table | Purpose |
|-------|---------|
| `bulk_upload_batches` | Batch metadata with human-readable ID (BULK-000001) |
| `bulk_upload_row_results` | Per-row validation results |

### System Tables

| Table | Purpose |
|-------|---------|
| `audit_logs` | System-wide audit trail |
| `notifications_queue` | Future notification system |

---

## Enum Types

| Enum | Values |
|------|--------|
| `app_role` | super_admin, admin, partner_admin, partner_agent |
| `partner_type_enum` | education_consultant, study_abroad_agency, university_partner, digital_aggregator, freelance_counsellor, other |
| `partner_status_enum` | active, inactive, onboarding, suspended, terminated |
| `lead_stage_enum` | draft → submitted → under_initial_review → documents_pending → documents_under_review → bre_evaluated → sent_to_lender → login_submitted → credit_query → sanction_received → disbursed / rejected / dropped / on_hold |
| `lead_status_enum` | new, in_progress, pending_info, reupload_needed, awaiting_verification, verified, under_assessment, query_raised, query_resolved, approved, conditionally_approved, declined, withdrawn, on_hold, completed, not_applicable |
| `document_status_enum` | not_uploaded, uploaded, under_review, verified, rejected, reupload_needed, waived, not_applicable |
| `payout_status_enum` | pending, triggered, approved, paid, reversed, on_hold, cancelled |
| `payout_basis_enum` | flat_fee, percentage_of_loan, percentage_of_disbursed, tiered, custom |
| `fit_category_enum` | best_fit, good_fit, premium_match, backup, not_eligible |
| `note_type_enum` | internal, partner_visible, system |

---

## Lead Lifecycle Design

**Stage** and **Status** are always separate:

- **Stage** = Where the lead is in the pipeline (e.g., `documents_under_review`)
- **Status** = What's happening within that stage (e.g., `reupload_needed`)

Both are backed by master tables (`lifecycle_stage_master`, `lifecycle_status_master`), making them admin-configurable.

### Stage Flow

```
Draft → Submitted → Under Initial Review → Documents Pending →
Documents Under Review → BRE Evaluated → Sent to Lender →
Login Submitted → Credit Query → Sanction Received → Disbursed
                                                    ↘ Rejected
                                                    ↘ Dropped
                                                    ↘ On Hold
```

### Auto-Logging

A database trigger (`log_lead_stage_change`) automatically records every stage/status change to `lead_stage_history`.

---

## Role-Based Access Control

### Roles

| Role | Scope | Capabilities |
|------|-------|-------------|
| `super_admin` | Global | Full system control |
| `admin` | Global | Manage all leads, partners, masters, payouts |
| `partner_admin` | Own organization | Manage own leads, users, bulk uploads, view payouts |
| `partner_agent` | Own organization | Add/view leads within org scope |

### Data Partitioning (RLS)

All tables enforce Row-Level Security:

- **Partner scoping**: Partner users only see records where `partner_id` matches their organization
- **Admin access**: `is_admin_or_super()` function grants cross-partner access
- **Note visibility**: Partner users cannot see `internal` type notes
- **Master tables**: Read-only for all authenticated; write for admins only
- **Audit logs**: Admin-only read access
- **Payout rules**: Read-only for partners

### Security Functions

| Function | Purpose |
|----------|---------|
| `has_role(user_id, role)` | Check if user has specific role (SECURITY DEFINER) |
| `get_user_role(auth_id)` | Get role from auth.uid |
| `get_user_partner_id(auth_id)` | Get partner_id from auth.uid |
| `is_admin_or_super(auth_id)` | Check admin/super_admin status |

---

## Human-Readable IDs

| Entity | Format | Example |
|--------|--------|---------|
| Lead | `EL-PL-NNNNNN` | EL-PL-000001 |
| Batch | `BULK-NNNNNN` | BULK-000001 |
| Partner | `PTR-NNN` | PTR-001 |

Generated via database sequences and triggers.

---

## Test Data

### Partner Organizations
- **PTR-001**: Global Study Advisors (study_abroad_agency)
- **PTR-002**: EduBridge Consultants (education_consultant)

### Users
- 1 Super Admin (superadmin@eduloans.com)
- 1 Admin/Ops (admin@eduloans.com)
- 2 Partner Admins (one per org)
- 2 Partner Agents (one per org)

### Payout Rules
- PTR-001: ₹15,000 flat fee per disbursed lead
- PTR-002: 1.5% of disbursed amount

---

## What's Ready for Next Prompts

### Ready to Build On
1. ✅ Complete database schema with all relationships
2. ✅ RLS policies enforcing partner scoping
3. ✅ Master data seeded and queryable
4. ✅ Lead lifecycle with auto-logging triggers
5. ✅ Document architecture with versioning
6. ✅ Bulk upload tables ready
7. ✅ Payout tracking structure
8. ✅ BRE compatibility layer
9. ✅ Audit trail system
10. ✅ Supabase client configured with typed queries

### Next Prompts Should Build
1. Partner Dashboard / Operations Hub
2. Add Quick Lead + Add New Lead forms
3. Bulk Upload Leads UI
4. Submitted Leads list/table
5. Lead Detail / Lifecycle Tracking page
6. Master Data + Upload Rules admin panel

### Integration Notes
- Import `supabase` from `@/integrations/supabase/client`
- All types auto-generated in `@/integrations/supabase/types.ts`
- Use `supabase.from('table_name')` for all queries
- Auth state via `supabase.auth.getUser()`
- Partner scoping is automatic via RLS — no need to filter by partner_id in queries for partner users
