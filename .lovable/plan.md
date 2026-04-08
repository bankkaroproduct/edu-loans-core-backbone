

# Payouts / Earnings Module — Complete Build Plan

## What exists today
- **Payouts page** (`src/pages/Payouts.tsx`): Basic table with status filter dropdown, tabs for Records/Rules. Minimal — no summary cards, no search, no lead linking, no sorting, weak empty states.
- **Dashboard PayoutSnapshot** (`src/components/dashboard/PayoutSnapshot.tsx`): Summary cards (Total/Pending/Approved/Paid) with click-to-navigate. Already wired.
- **LeadPayoutSnapshot** (`src/components/lead-detail/LeadPayoutSnapshot.tsx`): Compact payout card on Lead Detail. Already wired.
- **Route**: `/payouts` already registered. Sidebar already has "Payouts" nav item.
- **DB tables**: `partner_payout_records` and `partner_payout_rules` with RLS. Payout statuses: pending, triggered, approved, paid, reversed, on_hold, cancelled.

## What needs to be built

### 1. New components (all under `src/components/payouts/`)

**PayoutSummaryCards.tsx** — Top-level earnings summary row
- Total Accrued, Pending, Approved, Paid, Reversed/Clawback — computed from real records
- Number of contributing leads
- Each card clickable to filter the table below
- INR formatting, icons, clear labels

**PayoutFilters.tsx** — Filter bar + active chips
- Status filter (multi or single)
- Date range (triggered/paid date)
- Search by Lead ID or student name
- Active filter chips with clear-all
- Reads from and syncs to URL search params (so dashboard click-paths work)

**PayoutRecordsTable.tsx** — Main records table
- Columns: Lead ID, Student Name, Trigger Stage, Basis, Amount, Status, Triggered At, Approved At, Paid At, Remarks, Action (View Lead)
- Requires joining lead data — fetch student_leads for lead_id/student_full_name in the Payouts page query
- Strong status badges with distinct colors for each state
- Sortable by date/amount/status
- "View Lead" action navigates to `/leads/:id`
- Reversed/clawback rows visually distinct (red tint or indicator)

**PayoutStatusLegend.tsx** — Small collapsible legend
- Explains each status: Pending, Triggered, Approved, Paid, On Hold, Reversed, Cancelled
- Trust-building microcopy

**PayoutEmptyState.tsx** — Context-aware empty states
- Different messages for "no records at all" vs "no results for filters"

### 2. Rewrite `src/pages/Payouts.tsx`
- Page structure: Header → Summary Cards → Filters → Records Table → Rules tab
- Fetch payout records + linked lead data (student_full_name, lead_id text, current_stage)
- Compute summary metrics from fetched records
- URL param sync for status/search/date filters (dashboard compatibility)
- Partner-scoped via `effectivePartnerId` (already done)
- Agent-scoped via `agentUserId` if applicable
- Sorting state (default: newest first)
- Keep the Rules tab as-is

### 3. Refine `src/components/lead-detail/LeadPayoutSnapshot.tsx`
- Add "View All Payouts" link navigating to `/payouts?lead={leadId}` if multiple records
- Add trigger stage label per record
- Show timing info (triggered/paid dates)

### 4. Refine `src/components/dashboard/PayoutSnapshot.tsx`
- Add "Reversed" metric card if any clawback records exist
- Recent records click → navigate to `/payouts?lead={leadId}` instead of just `/payouts`

### 5. No database changes needed
All required tables, columns, RLS policies, and enums already exist.

## Technical details

**Data fetching strategy in Payouts page:**
- Fetch `partner_payout_records` with partner/agent scoping
- Fetch lead IDs from records, then batch-fetch `student_leads` for display names and lead_id text
- Fetch `partner_payout_rules` for Rules tab (existing)
- All filtering/sorting done client-side (records capped at 500)

**URL param contract:**
- `?status=pending` — pre-filter by status (from dashboard)
- `?search=EL-PL-000001` — search term
- `?lead=uuid` — filter to specific lead's payouts

**Files to create:**
- `src/components/payouts/PayoutSummaryCards.tsx`
- `src/components/payouts/PayoutFilters.tsx`
- `src/components/payouts/PayoutRecordsTable.tsx`
- `src/components/payouts/PayoutStatusLegend.tsx`
- `src/components/payouts/PayoutEmptyState.tsx`

**Files to edit:**
- `src/pages/Payouts.tsx` — full rewrite
- `src/components/lead-detail/LeadPayoutSnapshot.tsx` — minor refinements
- `src/components/dashboard/PayoutSnapshot.tsx` — minor refinements

