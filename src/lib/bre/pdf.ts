// Client-side PDF export for a BRE simulation result.
// Uses jsPDF + jspdf-autotable. No server call.

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { BreProfileInput, BreResult, BreScoringConfig } from "./types";

function formatNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("en-IN");
}

function formatCurrency(n: number | null | undefined): string {
  if (n == null) return "—";
  return "₹" + n.toLocaleString("en-IN");
}

export function buildSimulationPdf(opts: {
  profile: BreProfileInput;
  result: BreResult;
  cfg: BreScoringConfig;
  runByName?: string;
}): void {
  const { profile, result, cfg, runByName } = opts;
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("BRE Simulation Report", 40, 50);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${new Date().toLocaleString()}`, 40, 68);
  doc.text(`Scoring config version: v${cfg.version_number}`, 40, 82);
  if (runByName) doc.text(`Run by: ${runByName}`, 40, 96);

  let y = runByName ? 116 : 102;

  // Result summary
  autoTable(doc, {
    startY: y,
    head: [["Result summary", "Value"]],
    body: [
      ["Eligibility status", result.eligibility_status],
      ["Overall score", `${result.overall_score} / 100`],
      ["Overall band", result.overall_band ? `${result.overall_band.band} — ${result.overall_band.label ?? ""}` : "—"],
      ["Eligible loan range", result.eligible_loan_range ? `${formatCurrency(result.eligible_loan_range.min)} – ${formatCurrency(result.eligible_loan_range.max)}` : "—"],
      ["Indicative rate range", result.indicative_rate_range ? `${result.indicative_rate_range.min}% – ${result.indicative_rate_range.max}%` : "—"],
      ["Collateral route", result.collateral_route ?? "—"],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [60, 60, 80] },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;

  // Profile inputs
  autoTable(doc, {
    startY: y,
    head: [["Profile input", "Value"]],
    body: [
      ["Loan amount requested", formatCurrency(profile.loan_amount)],
      ["Destination country", profile.destination_country || "—"],
      ["Course category", profile.course_category ?? "—"],
      ["Course level", profile.course_level ?? "—"],
      ["Collateral route", profile.collateral_route ?? "—"],
      ["State", profile.state ?? "—"],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [60, 60, 80] },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;

  // Bucket scores
  autoTable(doc, {
    startY: y,
    head: [["Bucket", "Score", "Threshold", "Pass / Fail"]],
    body: (["student", "university", "coapplicant"] as const).map((b) => [
      b.charAt(0).toUpperCase() + b.slice(1),
      `${result.buckets[b].total}`,
      `${cfg.bucket_threshold}`,
      result.buckets[b].passes ? "PASS" : "FAIL",
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [60, 60, 80] },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;

  // Rejection reasons (if any)
  if (result.rejection_reasons.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Rejection reasons"]],
      body: result.rejection_reasons.map((r) => [r]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [180, 60, 60] },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;
  }

  // Parameter trace per bucket
  for (const b of ["student", "university", "coapplicant"] as const) {
    autoTable(doc, {
      startY: y,
      head: [[`${b.charAt(0).toUpperCase() + b.slice(1)} parameter trace`, "Input", "Band score", "Weight", "Contribution"]],
      body: result.buckets[b].trace.map((t) => [
        t.label,
        t.input == null || t.input === "" ? "—" : String(t.input),
        `${t.band_score}`,
        `${t.weight}`,
        `${t.contribution}`,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [80, 80, 100] },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
    if (y > 720) {
      doc.addPage();
      y = 40;
    }
  }

  // Lender ranking table
  if (y > 600) {
    doc.addPage();
    y = 40;
  }
  const eligibleSorted = [...result.eligible_lenders].sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    return (a.rank ?? 9999) - (b.rank ?? 9999);
  });
  autoTable(doc, {
    startY: y,
    head: [["Rank", "Lender", "Product", "Projected loan", "Projected rate", "Payout %", "Status / Reasons"]],
    body: eligibleSorted.map((l) => [
      l.rank != null ? `#${l.rank}` : "—",
      `${l.lender_name} (${l.lender_code})`,
      l.product_type ?? "—",
      formatCurrency(l.projected_loan_amount),
      l.projected_rate != null ? `${l.projected_rate}%` : "—",
      l.payout_pct != null ? `${l.payout_pct}%` : "—",
      l.eligible ? (l.badge ?? "") : (l.reasons[0] ?? "Ineligible"),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [60, 60, 80] },
    columnStyles: { 6: { cellWidth: 140 } },
  });

  doc.save(`bre-simulation-${new Date().toISOString().slice(0, 10)}.pdf`);
}
