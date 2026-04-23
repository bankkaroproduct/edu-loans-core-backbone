/** Extract {{variable}} tokens from a template string */
export function extractTokens(text: string): string[] {
  const set = new Set<string>();
  const re = /\{\{\s*([\w.]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) set.add(m[1]);
  return Array.from(set);
}

/** Render a template by substituting {{var}} with values; missing vars become empty string */
export function renderTemplate(text: string, vars: Record<string, unknown>): string {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const v = vars[key];
    return v === undefined || v === null ? "" : String(v);
  });
}

/** Default UI variables seeded from a lead row */
export function leadToVariables(lead: {
  lead_id?: string | null;
  student_full_name?: string | null;
  student_first_name?: string | null;
  current_status?: string | null;
} | null): Record<string, string> {
  if (!lead) return {};
  return {
    student_name: lead.student_full_name || lead.student_first_name || "",
    lead_id: lead.lead_id || "",
    application_status: (lead.current_status ?? "").replace(/_/g, " "),
    dashboard_link: `${window.location.origin}/leads`,
    advisor_name: "Your EduLoans Advisor",
    pending_document_name: "the requested document",
    lender_name: "the lender",
    timestamp: new Date().toLocaleString(),
  };
}
