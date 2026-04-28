// Intake Session = a single UI control that combines `intake_term` + `intake_year`.
//
// IMPORTANT: Options are STRICTLY master-driven. We never invent a (term, year)
// pair that does not exist in `public.intake_master`. If Winter only exists for
// 2026 in the master, "Winter 2026" is the ONLY Winter option exposed.
//
// Persistence is unchanged: the UI decomposes the composite key back into the
// existing `intake_term` (text) and `intake_year` (int) columns on save.

export interface IntakeMasterRow {
  intake_term: string;
  intake_year: number;
  sort_order?: number | null;
}

export interface IntakeSessionOption {
  /** Composite key: `${term}|${year}` — used as Select value. */
  value: string;
  /** Human label, e.g. "Fall 2026". */
  label: string;
  term: string;
  year: number;
}

const TERM_ORDER: Record<string, number> = {
  Spring: 1,
  Summer: 2,
  Fall: 3,
  Winter: 4,
};

export function buildIntakeSessionOptions(
  rows: IntakeMasterRow[],
  opts: { onlyFuture?: boolean } = {},
): IntakeSessionOption[] {
  const currentYear = new Date().getFullYear();
  const filtered = opts.onlyFuture ? rows.filter(r => r.intake_year >= currentYear) : rows;

  // Dedup on (term, year)
  const seen = new Set<string>();
  const unique: IntakeMasterRow[] = [];
  for (const r of filtered) {
    const k = `${r.intake_term}|${r.intake_year}`;
    if (!seen.has(k)) {
      seen.add(k);
      unique.push(r);
    }
  }

  unique.sort((a, b) => {
    if (a.intake_year !== b.intake_year) return a.intake_year - b.intake_year;
    const at = TERM_ORDER[a.intake_term] ?? 99;
    const bt = TERM_ORDER[b.intake_term] ?? 99;
    if (at !== bt) return at - bt;
    return a.intake_term.localeCompare(b.intake_term);
  });

  return unique.map(r => ({
    value: `${r.intake_term}|${r.intake_year}`,
    label: `${r.intake_term} ${r.intake_year}`,
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
  return `${term} ${year}`;
}
