// Intake Session = a single UI control that combines `intake_term` + `intake_year`.
//
// IMPORTANT: Options are STRICTLY master-driven. We never invent a (term, year)
// pair that does not exist in `public.intake_master`. Storage is unchanged:
// the UI decomposes the composite key back into the existing `intake_term`
// (text, e.g. "Spring") and `intake_year` (int) columns on save.
//
// Display: ONLY quarter format — never season names in the UI.
//   Spring → Jan-Mar-{year}
//   Summer → Apr-Jun-{year}
//   Fall   → Jul-Sep-{year}
//   Winter → Oct-Dec-{year}
//
// Visible sequence is chronological starting from the CURRENT quarter (rolling),
// e.g. if today is in Apr–Jun 2026 the list begins Apr-Jun-2026, Jul-Sep-2026,
// Oct-Dec-2026, Jan-Mar-2027, ...

export interface IntakeMasterRow {
  intake_term: string;
  intake_year: number;
  sort_order?: number | null;
}

export interface IntakeSessionOption {
  /** Composite key: `${term}|${year}` — used as Select value. */
  value: string;
  /** Human label, e.g. "Apr-Jun-2026". */
  label: string;
  term: string;
  year: number;
}

/** Quarter index: 1=Jan-Mar, 2=Apr-Jun, 3=Jul-Sep, 4=Oct-Dec */
const QUARTER_BY_TERM: Record<string, number> = {
  Spring: 1,
  Summer: 2,
  Fall: 3,
  Winter: 4,
};

const QUARTER_LABEL: Record<number, string> = {
  1: "Jan-Mar",
  2: "Apr-Jun",
  3: "Jul-Sep",
  4: "Oct-Dec",
};

function quarterOf(term: string): number | null {
  return QUARTER_BY_TERM[term] ?? null;
}

function currentQuarterKey(): { year: number; q: number } {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3) + 1; // 1..4
  return { year: now.getFullYear(), q };
}

function chronoKey(year: number, q: number): number {
  return year * 10 + q;
}

export function buildIntakeSessionOptions(
  rows: IntakeMasterRow[],
  opts: { onlyFuture?: boolean } = {},
): IntakeSessionOption[] {
  const { year: cy, q: cq } = currentQuarterKey();
  const cutoff = chronoKey(cy, cq);

  // Dedup on (term, year)
  const seen = new Set<string>();
  const unique: IntakeMasterRow[] = [];
  for (const r of rows) {
    const k = `${r.intake_term}|${r.intake_year}`;
    if (!seen.has(k)) {
      seen.add(k);
      unique.push(r);
    }
  }

  const filtered = opts.onlyFuture
    ? unique.filter((r) => {
        const q = quarterOf(r.intake_term);
        if (!q) return r.intake_year >= cy; // unknown term: fall back to year cutoff
        return chronoKey(r.intake_year, q) >= cutoff;
      })
    : unique;

  filtered.sort((a, b) => {
    const aq = quarterOf(a.intake_term) ?? 99;
    const bq = quarterOf(b.intake_term) ?? 99;
    return chronoKey(a.intake_year, aq) - chronoKey(b.intake_year, bq);
  });

  return filtered.map((r) => ({
    value: `${r.intake_term}|${r.intake_year}`,
    label: intakeSessionLabel(r.intake_term, r.intake_year),
    term: r.intake_term,
    year: r.intake_year,
  }));
}

export function intakeSessionValue(term: string | null | undefined, year: number | null | undefined): string {
  if (!term || !year) return "";
  return `${term}|${year}`;
}

export function parseIntakeSessionValue(value: string): { term: string; year: number } | null {
  if (!value) return null;
  const [term, yearStr] = value.split("|");
  const year = Number(yearStr);
  if (!term || !Number.isFinite(year)) return null;
  return { term, year };
}

export function intakeSessionLabel(term: string | null | undefined, year: number | null | undefined): string {
  if (!term || !year) return "";
  const q = quarterOf(term);
  if (!q) return `${term} ${year}`; // safe fallback for unknown terms
  return `${QUARTER_LABEL[q]}-${year}`;
}
