import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Download, FileText, AlertTriangle, CheckCircle2, XCircle, Info } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

/** Per-master upload spec. Determined by real DB unique-constraint reality. */
type Mode = "upsert" | "insert-only";

interface MasterUploadSpec {
  table: string;
  label: string;
  /** Required CSV columns. */
  required: string[];
  /** Optional CSV columns. */
  optional: string[];
  /** Natural keys used to match existing rows. */
  matchKeys: string[];
  /** Insert-only: rows matching existing → skipped. Upsert: matching → updated. */
  mode: Mode;
  /** Builds the row payload. Returns null if validation fails. */
  buildRow: (raw: Record<string, string>) => { ok: true; row: Record<string, any> } | { ok: false; error: string };
  /** Builds a search key for matching against existing rows. */
  matchKey: (row: Record<string, any>) => string;
  /** Builds a search key for an existing DB row. */
  existingKey: (row: any) => string;
  /** Sample CSV template content. */
  template: string;
}

export const MASTER_UPLOAD_SPECS: Record<string, MasterUploadSpec> = {
  countries: {
    table: "countries_master",
    label: "Countries",
    required: ["country_name", "iso_code"],
    optional: ["active_flag"],
    matchKeys: ["iso_code"],
    mode: "upsert",
    buildRow: (raw) => {
      if (!raw.country_name?.trim() || !raw.iso_code?.trim()) {
        return { ok: false, error: "country_name and iso_code are required" };
      }
      return {
        ok: true,
        row: {
          country_name: raw.country_name.trim(),
          iso_code: raw.iso_code.trim().toUpperCase(),
          active_flag: parseBool(raw.active_flag, true),
        },
      };
    },
    matchKey: (r) => String(r.iso_code).toUpperCase(),
    existingKey: (r) => String(r.iso_code ?? "").toUpperCase(),
    template: `country_name,iso_code,active_flag
Brazil,BR,true
Japan,JP,true
`,
  },
  intakes: {
    table: "intake_master",
    label: "Intakes",
    required: ["intake_term", "intake_year"],
    optional: ["sort_order", "active_flag"],
    matchKeys: ["intake_term", "intake_year"],
    mode: "upsert",
    buildRow: (raw) => {
      const term = raw.intake_term?.trim();
      const year = parseInt(raw.intake_year ?? "", 10);
      if (!term || !Number.isFinite(year)) {
        return { ok: false, error: "intake_term and intake_year are required" };
      }
      return {
        ok: true,
        row: {
          intake_term: term,
          intake_year: year,
          sort_order: parseInt(raw.sort_order ?? "0", 10) || 0,
          active_flag: parseBool(raw.active_flag, true),
        },
      };
    },
    matchKey: (r) => `${r.intake_term}|${r.intake_year}`,
    existingKey: (r) => `${r.intake_term}|${r.intake_year}`,
    template: `intake_term,intake_year,sort_order,active_flag
Spring,2026,1,true
Fall,2026,2,true
`,
  },
  universities: {
    table: "universities_master",
    label: "Universities",
    required: ["university_name", "country"],
    optional: ["ranking_bucket", "aliases", "active_flag"],
    matchKeys: ["lower(university_name) + country"],
    mode: "insert-only",
    buildRow: (raw) => {
      if (!raw.university_name?.trim() || !raw.country?.trim()) {
        return { ok: false, error: "university_name and country are required" };
      }
      const aliases = raw.aliases?.trim()
        ? raw.aliases.split(/[|;]/).map((a) => a.trim()).filter(Boolean)
        : null;
      return {
        ok: true,
        row: {
          university_name: raw.university_name.trim(),
          country: raw.country.trim(),
          ranking_bucket: raw.ranking_bucket?.trim() || null,
          aliases,
          active_flag: parseBool(raw.active_flag, true),
        },
      };
    },
    matchKey: (r) => `${String(r.university_name).toLowerCase()}|${r.country}`,
    existingKey: (r) => `${String(r.university_name ?? "").toLowerCase()}|${r.country ?? ""}`,
    template: `university_name,country,ranking_bucket,aliases,active_flag
University of Toronto,Canada,Top 50,UofT|U of T,true
ETH Zurich,Switzerland,Top 50,ETH,true
`,
  },
  courses: {
    table: "courses_master",
    label: "Courses",
    required: ["course_name"],
    optional: ["course_category", "stem_flag", "mba_flag", "management_flag", "active_flag"],
    matchKeys: ["lower(course_name)"],
    mode: "insert-only",
    buildRow: (raw) => {
      if (!raw.course_name?.trim()) {
        return { ok: false, error: "course_name is required" };
      }
      return {
        ok: true,
        row: {
          course_name: raw.course_name.trim(),
          normalized_course_name: raw.course_name.trim().toLowerCase(),
          course_category: raw.course_category?.trim() || null,
          stem_flag: parseBool(raw.stem_flag, false),
          mba_flag: parseBool(raw.mba_flag, false),
          management_flag: parseBool(raw.management_flag, false),
          active_flag: parseBool(raw.active_flag, true),
        },
      };
    },
    matchKey: (r) => String(r.course_name).toLowerCase(),
    existingKey: (r) => String(r.course_name ?? "").toLowerCase(),
    template: `course_name,course_category,stem_flag,mba_flag,management_flag,active_flag
MS Data Science,STEM,true,false,false,true
MBA Finance,Management,false,true,true,true
`,
  },
};

function parseBool(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined || v === null || v === "") return fallback;
  return ["true", "yes", "1", "y"].includes(v.trim().toLowerCase());
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = (cells[idx] ?? "").trim(); });
    rows.push(row);
  }
  return { headers, rows };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQuotes = !inQuotes; continue; }
    if (c === "," && !inQuotes) { out.push(cur); cur = ""; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}

type RowStatus = "new" | "exists" | "invalid";

interface PreviewRow {
  num: number;
  status: RowStatus;
  data: Record<string, any> | null;
  error?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  masterKey: keyof typeof MASTER_UPLOAD_SPECS;
  onCompleted: () => void;
}

export function MasterBulkUploadDialog({ open, onOpenChange, masterKey, onCompleted }: Props) {
  const spec = MASTER_UPLOAD_SPECS[masterKey];
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ inserted: number; updated: number; skipped: number; failed: number } | null>(null);

  const reset = () => {
    setPreview(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleFile = async (file: File) => {
    setResult(null);
    const text = await file.text();
    const { rows } = parseCSV(text);
    if (rows.length === 0) {
      toast({ title: "Empty file", description: "No data rows found.", variant: "destructive" });
      return;
    }
    if (rows.length > 500) {
      toast({ title: "Too many rows", description: "Max 500 rows per upload. Split your file.", variant: "destructive" });
      return;
    }

    // Fetch existing rows for matching
    const { data: existing, error } = await (supabase as any).from(spec.table).select("*");
    if (error) {
      toast({ title: "Failed to read existing rows", description: error.message, variant: "destructive" });
      return;
    }
    const existingKeys = new Set((existing ?? []).map(spec.existingKey));

    const items: PreviewRow[] = rows.map((raw, i) => {
      const built = spec.buildRow(raw);
      if (!built.ok) {
        return { num: i + 2, status: "invalid", data: null, error: built.error };
      }
      const k = spec.matchKey(built.row);
      return {
        num: i + 2,
        status: existingKeys.has(k) ? "exists" : "new",
        data: built.row,
      };
    });
    setPreview(items);
  };

  const handleConfirm = async () => {
    if (!preview) return;
    setSubmitting(true);
    let inserted = 0, updated = 0, skipped = 0, failed = 0;

    try {
      const newRows = preview.filter((r) => r.status === "new" && r.data).map((r) => r.data!);
      const existsRows = preview.filter((r) => r.status === "exists" && r.data).map((r) => r.data!);
      skipped = preview.filter((r) => r.status === "invalid").length;

      // Insert new rows in chunks of 50
      for (let i = 0; i < newRows.length; i += 50) {
        const chunk = newRows.slice(i, i + 50);
        const { error } = await (supabase as any).from(spec.table).insert(chunk);
        if (error) failed += chunk.length;
        else inserted += chunk.length;
      }

      // Upsert mode → update existing rows by natural key
      if (spec.mode === "upsert" && existsRows.length > 0) {
        for (const row of existsRows) {
          // Build match condition (e.g. iso_code or term+year)
          let q: any = (supabase as any).from(spec.table).update(row);
          if (masterKey === "countries") q = q.eq("iso_code", row.iso_code);
          else if (masterKey === "intakes") q = q.eq("intake_term", row.intake_term).eq("intake_year", row.intake_year);
          const { error } = await q;
          if (error) failed += 1;
          else updated += 1;
        }
      } else {
        // insert-only mode: existing rows are skipped (already counted above as skipped if invalid)
        // Don't increment skipped here — already-existing rows are intentional, count separately
      }

      const skippedExisting = spec.mode === "insert-only" ? existsRows.length : 0;
      setResult({ inserted, updated, skipped: skipped + skippedExisting, failed });
      toast({
        title: "Upload complete",
        description: `${inserted} new, ${updated} updated, ${skipped + skippedExisting} skipped, ${failed} failed.`,
      });
      onCompleted();
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([spec.template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${spec.table}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const counts = preview ? {
    new: preview.filter((r) => r.status === "new").length,
    exists: preview.filter((r) => r.status === "exists").length,
    invalid: preview.filter((r) => r.status === "invalid").length,
  } : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Upload — {spec.label}</DialogTitle>
          <DialogDescription>
            Upload a CSV file to {spec.mode === "upsert" ? "add new or update existing" : "add new"} {spec.label.toLowerCase()}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert className="bg-blue-50 border-blue-200 text-blue-900 [&>svg]:text-blue-600">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs leading-relaxed space-y-1">
              <div><strong>Mode:</strong> {spec.mode === "upsert" ? `Upsert by ${spec.matchKeys.join(", ")} — existing rows will be UPDATED` : `Insert-only — rows matching ${spec.matchKeys.join(", ")} will be SKIPPED (no overwrite)`}</div>
              <div><strong>Required:</strong> <span className="font-mono">{spec.required.join(", ")}</span></div>
              {spec.optional.length > 0 && <div><strong>Optional:</strong> <span className="font-mono">{spec.optional.join(", ")}</span></div>}
              <div className="text-blue-700">Max 500 rows per upload.</div>
            </AlertDescription>
          </Alert>

          {!preview && !result && (
            <div className="border-2 border-dashed rounded-md p-8 text-center space-y-3">
              <FileText className="h-8 w-8 text-muted-foreground mx-auto" />
              <div className="space-y-2">
                <p className="text-sm">Choose a CSV file to preview before importing.</p>
                <div className="flex items-center justify-center gap-2">
                  <Button variant="outline" size="sm" onClick={downloadTemplate}>
                    <Download className="h-3.5 w-3.5 mr-1.5" /> Download Template
                  </Button>
                  <Button size="sm" onClick={() => fileRef.current?.click()}>
                    <Upload className="h-3.5 w-3.5 mr-1.5" /> Choose File
                  </Button>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
              </div>
            </div>
          )}

          {preview && counts && !result && (
            <>
              <div className="flex items-center gap-3 text-sm">
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> {counts.new} new
                </Badge>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  {counts.exists} {spec.mode === "upsert" ? "to update" : "skipped (exists)"}
                </Badge>
                {counts.invalid > 0 && (
                  <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
                    <XCircle className="h-3 w-3 mr-1" /> {counts.invalid} invalid
                  </Badge>
                )}
              </div>

              <div className="border rounded-md max-h-[300px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="text-xs w-[60px]">Row</TableHead>
                      <TableHead className="text-xs w-[100px]">Status</TableHead>
                      <TableHead className="text-xs">Preview</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.slice(0, 50).map((r) => (
                      <TableRow key={r.num}>
                        <TableCell className="text-xs py-1.5">{r.num}</TableCell>
                        <TableCell className="py-1.5">
                          {r.status === "new" && <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0">NEW</Badge>}
                          {r.status === "exists" && <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] px-1.5 py-0">{spec.mode === "upsert" ? "UPDATE" : "SKIP"}</Badge>}
                          {r.status === "invalid" && <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[10px] px-1.5 py-0">INVALID</Badge>}
                        </TableCell>
                        <TableCell className="text-xs py-1.5 font-mono truncate max-w-[400px]">
                          {r.error ? <span className="text-rose-600">{r.error}</span> : JSON.stringify(r.data).slice(0, 120)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {preview.length > 50 && (
                  <div className="text-center text-xs text-muted-foreground py-2 border-t">
                    Showing first 50 of {preview.length} rows
                  </div>
                )}
              </div>
            </>
          )}

          {result && (
            <Alert className="bg-emerald-50 border-emerald-200 text-emerald-900 [&>svg]:text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Import complete.</strong>{" "}
                {result.inserted} inserted, {result.updated} updated, {result.skipped} skipped, {result.failed} failed.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          {!result && preview && (
            <>
              <Button variant="outline" onClick={reset} disabled={submitting}>Choose Different File</Button>
              <Button
                onClick={handleConfirm}
                disabled={submitting || (counts!.new === 0 && (spec.mode !== "upsert" || counts!.exists === 0))}
              >
                {submitting ? "Importing…" : `Import ${counts!.new}${spec.mode === "upsert" ? ` + Update ${counts!.exists}` : ""} rows`}
              </Button>
            </>
          )}
          {result && <Button onClick={() => handleClose(false)}>Done</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
