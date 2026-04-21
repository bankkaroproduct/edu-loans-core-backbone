# Admin Reports — UX Refinement (Non-Destructive)

Promote Date Range to a first-class hero control. **No logic, query, or export changes.**

## Files to modify (3)

### 1. `src/components/admin/reports/AdminReportFilters.tsx`
- Rename collapsible header label `Filters` → `Advanced Filters`.
- Remove the From/To date pickers from row 1.
- Keep the Partner select in this section (binds to `filters.partnerId` — stays in sync with the new scope bar automatically).
- Reflow row 1 to fill the gap left by the removed date pickers.
- Leave all other filters and the active-count badge logic untouched.

### 2. `src/components/admin/reports/ReportCard.tsx`
- Add optional prop: `dateFieldHint?: string`.
- Render under the existing description as `text-[10px] text-muted-foreground` (e.g. "Uses created date").
- No behavior change — the `useEffect` that fetches the count still keys on `filterVersion` only.

### 3. `src/pages/admin/AdminReports.tsx`
- Add an inline `ReportingScopeBar` component (no new file).
- Add an applied-state summary line beneath it.
- Pass `dateFieldHint` to each `ReportCard`.

## New page section order

```text
PageHeader
Reporting Scope Bar           ← NEW, always visible
Applied-state summary line    ← NEW
Summary Strip                 ← unchanged
Advanced Filters              ← relabeled, dates removed
Report Cards                  ← + dateFieldHint
```

## Reporting Scope Bar — behavior

- Inline component inside `AdminReports.tsx`.
- Local pending state: `pendingFrom`, `pendingTo`, `pendingPartner`.
- **Sync rule (NEW):** `pendingFrom`, `pendingTo`, `pendingPartner` are initialized from current `filters` and kept in sync via a `useEffect` on `[filters.dateFrom, filters.dateTo, filters.partnerId]`. This guarantees the bar reflects external mutations — Reset button, edits made inside Advanced Filters' Partner select, or any future programmatic change — without diverging.
- Commits to page-level `filters` only on **Apply** or preset click — prevents card refetch thrash while picking dates.
- **Presets** (auto-apply on click):
  - Today → `[today, today]`
  - Last 7 Days → `[today-6, today]`
  - Last 30 Days → `[today-29, today]`
  - This Month → `[startOfMonth, today]`
  - Last Month → `[startOfLastMonth, endOfLastMonth]`
  - Custom → opens From/To popovers, no auto-apply
- **Reset** → clears `dateFrom`, `dateTo`, `partnerId` and commits immediately (sync effect then refreshes the pending state from the cleared filters).
- **Apply** → commits pending values into `filters`; existing `filterVersion` → `cardKey` flow refetches all card counts.
- Layout: single row at ≥1024px, wraps cleanly below. Matches Lead Queue toolbar rhythm (`h-9` controls, `gap-2`, `text-xs`). Uses existing shadcn `Popover` + `Calendar` (with `pointer-events-auto`).

## No new fetch pathway (NEW constraint)

- The scope bar **must not** introduce any new fetch trigger, query, or refresh function.
- Its only side effect is calling `onChange(nextFilters)` (i.e. `setFilters`) on the page-level state.
- All count refreshes continue to flow through the existing `filterVersion = JSON.stringify(filters)` → `cardKey` → `ReportCard` `useEffect` chain.
- The summary strip (`loadSummary`) keeps its current independent refresh trigger (already filter-independent) — no new wiring.

## Applied-state line

Muted `text-xs` line below the bar:

```
Showing data for {range} • {partner}
```

- `{range}` → `01 Apr 2026 – 30 Apr 2026` or `All time` when both dates empty.
- `{partner}` → resolved name from loaded `partners` list, or `All Partners`.

Read-only.

## ReportCard date-field hints (mapped in `AdminReports.tsx`)

| Report | Hint |
|---|---|
| Leads Report | Uses created date |
| Stage Movement Report | Uses transition date |
| Documents Pending Review | Uses uploaded date |
| Edit Requests Report | Uses created date |
| Partner Performance | Uses created date |

Labels only — match the date columns already used by existing fetchers.

## What stays exactly the same

- `src/lib/reportExports.ts` — every fetcher, column set, business mapping, 5,000-row cap, CSV/XLSX helpers.
- `ReportFilterState` shape — no new fields (reuses `dateFrom`, `dateTo`, `partnerId`).
- `filterVersion` / `cardKey` refetch mechanism (single source of truth for card refreshes).
- Summary strip query and layout.
- Sidebar nav, route guard, page max width, design language.

## Acceptance

1. ✅ Global Date Range visible above summary strip
2. ✅ Admin can pick "Last 30 Days" + Apply → export without opening Advanced
3. ✅ All existing advanced filters still work
4. ✅ Each card shows its date-field hint
5. ✅ Card counts refresh on Apply via existing flow (no new fetch path)
6. ✅ CSV/XLSX exports unchanged
7. ✅ Pending state stays in sync with external filter changes (Reset, Advanced Partner edits)
8. ✅ Page feels reporting-first without redesigning anything else
