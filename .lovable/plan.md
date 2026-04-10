

# Plan: UI Refactoring Across the Platform

## Summary
A systematic UI consistency and polish pass across all 3 portals (Partner, Admin, Student) addressing fundamental visual/UX flaws without changing architecture or data models.

---

## Identified Fundamental Flaws

### A. Dashboard (Partner Portal Home)
- **Hero strip** uses hardcoded dark gradient (`from-slate-900 via-primary to-slate-800`) that clashes with the design system's HSL token approach
- **KPI Cards** are cramped: `text-[10px]` labels, `px-2.5 py-2` padding -- barely readable
- **Dashboard is overloaded**: Hero + Filters + Alerts + KPIs (12 cards) + Pipeline + Insight + Recent Leads + Documents + Bulk Upload + Payouts + Activity Feed + Quick Actions + System Help -- all on one page with no hierarchy
- **Inconsistent spacing**: Some sections use `space-y-6`, others `space-y-8`, `gap-6`, `mt-10`

### B. Login Page
- Left panel uses `bg-primary` (dark navy) with white text -- fine, but pills and checkmarks have low contrast (`opacity-80`, `opacity-50`)
- No loading/error states on forms beyond toast

### C. Leads List Page
- **675 lines** in a single file -- filter logic, table rendering, summary strip all monolithic
- Summary strip `grid-cols-4 sm:grid-cols-8` forces 8 micro-columns on tablet -- unreadable
- Advanced filters UI is dense with no visual grouping

### D. Lead Detail Page
- Documents button shows `toast.info("Document module coming soon")` -- dead-end CTA that should link to `/leads/:id/documents`
- Layout is solid structurally

### E. Add Lead / Quick Lead Forms
- Step progress bar uses raw flex with no proper stepper component -- inconsistent with student portal's `StudentStepLayout`
- No auto-save or dirty-state recovery

### F. Student Portal
- Generally the most polished part of the app
- Minor: some pages import 15+ icons (StudentTracker imports 17 icons) -- not a UI flaw but worth noting
- Recommendations page is 462 lines, Tracker is 472 lines -- large but functional

### G. Cross-Portal Consistency Issues
- **Partner sidebar** label says "EduLoans Portal" but header area is empty (just `SidebarTrigger`)
- **No breadcrumbs** anywhere in the Partner/Admin portal
- **Loading states** are inconsistent: some use `<Skeleton>`, some use `"Loading..."` text, some show nothing
- **Empty states** vary wildly: Partners page says "No partners found", Settings uses "No records", Dashboard has custom per-section empty states
- **Page headers** have no consistent pattern -- some have description text, some don't, button placement varies

---

## Proposed Refactoring (Prioritized)

### Phase 1: Critical Fixes (Blocking UX Issues)

1. **Fix dead Documents CTA on Lead Detail** -- wire the "Documents" button to navigate to `/leads/:id/documents` instead of showing a toast
2. **Fix KPI card readability** -- increase padding, font sizes from `text-[10px]` to `text-xs`, give cards breathing room
3. **Fix summary strip on Leads page** -- change from `grid-cols-8` to a responsive scrollable strip or `grid-cols-4` max

### Phase 2: Visual Consistency Pass

4. **Standardize page headers** -- create a shared `PageHeader` component with title, description, and action buttons used across Dashboard, Leads, Lead Detail, Payouts, Partners, Settings, Bulk Upload
5. **Standardize loading states** -- replace all `"Loading..."` text with proper `Skeleton` patterns; create a `PageSkeleton` component
6. **Standardize empty states** -- create a shared `EmptyState` component with icon, title, description, and optional CTA
7. **Fix Hero strip** -- use design system tokens instead of hardcoded Tailwind colors; reduce visual weight so it doesn't dominate the page

### Phase 3: Layout & Density

8. **Dashboard density reduction** -- group related sections with clear visual separators; reduce from ~13 sections to ~6 visible groups with collapsible detail
9. **Consistent spacing scale** -- standardize on `space-y-6` for section gaps, `gap-4` for card grids, `p-6` for card content across all pages
10. **Mobile polish for Partner portal** -- the Leads table, KPI cards, and filters need responsive breakpoint attention

---

## Files Changed

| File | Change |
|---|---|
| `src/components/shared/PageHeader.tsx` | New shared header component |
| `src/components/shared/EmptyState.tsx` | New shared empty state component |
| `src/components/shared/PageSkeleton.tsx` | New shared loading skeleton |
| `src/components/lead-detail/LeadDetailHeader.tsx` | Wire Documents button to real route |
| `src/components/dashboard/KPICards.tsx` | Increase padding, font sizes, readability |
| `src/components/dashboard/HeroPerformanceStrip.tsx` | Use design tokens, reduce visual weight |
| `src/pages/Index.tsx` | Use PageHeader, standardize spacing |
| `src/pages/Leads.tsx` | Fix summary strip responsiveness, use PageHeader |
| `src/pages/Payouts.tsx` | Use PageHeader, standardize empty/loading |
| `src/pages/Partners.tsx` | Use PageHeader, EmptyState, PageSkeleton |
| `src/pages/Settings.tsx` | Use PageHeader, consistent loading |
| `src/pages/BulkUpload.tsx` | Use PageHeader |
| `src/pages/LeadDetail.tsx` | Minor spacing alignment |

No schema changes. No architecture changes. No new features.

---

## What This Does NOT Change
- Student Portal pages (already polished)
- Data fetching logic or state management
- Routing or authentication
- Database schema or edge functions
- Component library (shadcn/ui primitives)

