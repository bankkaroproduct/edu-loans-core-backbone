

# Admin Lead Queue — Filter UX Refinement (Non-Destructive)

Promote the right controls, demote the rest, give Country/Partner real search, and turn Date into a real range control with presets. **No changes to lead-queue logic, business-filter mapping, fetch flow, or `applyBusinessFilters`.**

## 1. Gap review

| Issue | Today | Fix |
|---|---|---|
| Country is a long flat dropdown | `Select` over 100+ countries | Replace with searchable `Combobox` (Popover + Command) |
| Source mixes ops thinking with sub-types | 5 options including "University Referral" at top level | Primary view shows 4 clean options; deep sub-types live in Advanced |
| Date feels detached | Two separate "From" / "To" buttons in row 2 | Single Date Range control with preset menu (Today / 7d / 30d / This Month / Custom) |
| Flat hierarchy | 14 controls in 3 equal rows | Primary row + collapsible Advanced row |
| Partner won't scale | Plain `Select` | Same searchable Combobox pattern as Country |
| Status / Stage are correct primary controls but buried in row 2 | OK position, just need to be in the new Primary row | Move into Primary row |

## 2. Final filter architecture

```text
PRIMARY ROW (always visible)
[ 🔍 Search ──────────── ] [Source▼] [Stage▼] [Status▼] [Partner🔍▼] [📅 Date Range▼]

   ▸ More filters (chevron)   ← collapsible toggle, shows active count badge

ADVANCED ROW (collapsed by default; auto-expanded if any advanced filter active)
[Country🔍▼] [Type▼] [Entry Mode▼] [Region▼] [Loan Amount▼] [Intake▼] [Loan Type▼]

QUICK CHIPS (unchanged — operational shortcuts)
[Pending review] [Docs to verify] [With lender] [Sanctioned] [Stale > 48h]

ACTIVE-FILTER CHIPS  (unchanged behavior, refined display)
Source: Partner ✕    Country: USA ✕    Date: 01–07 Apr ✕    [Clear all]
```

Advanced row uses `Collapsible`. Trigger label: **"More filters"** with a small `Badge` showing count of active advanced filters. Auto-opens on mount if any advanced filter is non-default (so URL-hydrated state is visible).

## 3. Source — visible options

Primary `Source` select shows only:

- All Sources
- Partner
- Student Direct
- Referral

Mapping (extends `applyBusinessFilters` switch — additive, no removal):

| UI label | Filter mapping |
|---|---|
| Partner | `source_type = 'partner'` (no sub-type filter — covers both direct & referral) |
| Student Direct | `source_type = 'student_direct'` |
| Referral | `source_sub_type ilike '%refer%'` (covers partner-referral + university-referral) |

The four legacy granular values (`partner_direct`, `partner_referral`, `student_portal`, `university_referral`) **stay supported in the type union and switch** so URL-hydrated old links keep working — they just aren't shown in the primary dropdown. Power users get the full granular set via a new "Source detail" select inside the Advanced row.

## 4. Country & Partner — searchable Combobox

Replace plain `<Select>` with shadcn `Popover + Command` pattern:

- Trigger button (`h-9 text-xs justify-between`) showing the current selection or placeholder.
- Popover content with `Command` → `CommandInput` (autofocused) → `CommandList` → `CommandEmpty` → `CommandGroup` of `CommandItem`s.
- First item is always "All Countries" / "All Partners".
- Match on substring (cmdk default).
- Same component used for both — implemented as a tiny inline `SearchableSelect` helper inside `AdminLeadFilters.tsx` to avoid a new file.

`cmdk` and `@/components/ui/command` already exist — no new dependencies.

## 5. Date Range — single control with presets

Replace the two date buttons with one button → one popover containing **two stacked sections**:

```
┌──────────────────────────────────┐
│  Today                           │
│  Last 7 Days                     │
│  Last 30 Days                    │
│  This Month                      │
│  Last Month                      │
│  ─────────────────────────       │
│  Custom range                    │
├──────────────────────────────────┤
│  [Calendar — mode="range"]       │  ← visible when Custom or any range selected
│  Selected: 01 Apr – 07 Apr 2026  │
│             [Clear]    [Apply]   │
└──────────────────────────────────┘
```

- Uses `react-day-picker` `mode="range"` (already in `Calendar`).
- Trigger label dynamic:
  - empty → `"Date range"` (muted)
  - preset selected → `"Last 7 Days"`
  - custom → `"01 Apr – 07 Apr 2026"`
- Clicking a preset auto-applies + closes.
- Custom commits on Apply only (no thrash while picking).
- Writes to existing `filters.dateFrom` and `filters.dateTo` — **no new state shape**, no change to URL params or query logic.
- `From` / `To` controls in row 2 are removed.

## 6. Files to modify (1 file)

| File | Change |
|---|---|
| `src/components/admin/AdminLeadFilters.tsx` | Restructure JSX into Primary row + `Collapsible` Advanced row + chips. Add inline `SearchableSelect` (Popover+Command) for Country & Partner. Add inline `DateRangeControl` with presets. Update `SOURCE_OPTIONS` to the 4 primary labels; add a separate `SOURCE_DETAIL_OPTIONS` rendered inside Advanced. |

Untouched:
- `src/pages/admin/AdminLeads.tsx` — fetch logic, URL hydration, `applyBusinessFilters`, health counts, table, pagination, realtime, quick chips.
- `src/components/admin/AdminLeadQueue.tsx` — dashboard widget, separate component.
- `AdminLeadFilterState` shape — unchanged.
- `defaultAdminLeadFilters` — unchanged.

## 7. Safe execution order

1. Add inline helpers (`SearchableSelect`, `DateRangeControl`) at top of `AdminLeadFilters.tsx`.
2. Extend `SOURCE_OPTIONS` to primary 4; add `SOURCE_DETAIL_OPTIONS` for the legacy 5-way detail.
3. Replace Row 1 / Row 2 / Row 3 markup with Primary row + `Collapsible` Advanced row.
4. Wire all controls to existing `set(...)` helper. No prop changes. No state changes.
5. Manual sanity at 1309×853.

## 8. Runtime QA checklist

| Scenario | Expected |
|---|---|
| Primary row shows Search + Source + Stage + Status + Partner + Date Range only | PASS |
| "More filters" toggles Advanced row | PASS |
| URL with `?country=USA` auto-expands Advanced and shows USA selected | PASS |
| Country combobox searches "uni" → United States, United Kingdom appear | PASS |
| Partner combobox searches by display name | PASS |
| Source = "Partner" returns both Direct + Referral leads (count matches old "Partner Direct" + "Partner Referral") | PASS |
| Source = "Referral" returns partner-referral + university-referral leads | PASS |
| Old shared URL with `?source=partner_referral` still works | PASS |
| Date preset "Last 7 Days" sets `dateFrom` and `dateTo` correctly + refetches | PASS |
| Date preset "Last Month" → exact month boundaries | PASS |
| Custom range → Apply commits both dates + closes popover | PASS |
| Date Clear inside popover removes both dates | PASS |
| Quick chips (Pending review / Stale >48h etc.) still work | PASS |
| Active-filter chip row still shows + Clear All works | PASS |
| Dashboard `AdminLeadQueue` widget unchanged | PASS |
| Visual sanity at 1309×853 — no overflow, single primary row fits | PASS |

## What does not change

- `applyBusinessFilters` logic
- `fetchPage`, `fetchHealthCounts`, realtime channel
- Quick chips behavior
- Table columns, sort, pagination
- URL param keys
- `AdminLeadFilterState` / `defaultAdminLeadFilters`

