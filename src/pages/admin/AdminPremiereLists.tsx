import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { Upload, Trash2, Eye, ArrowUp, RefreshCw, AlertCircle, FileSpreadsheet, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SemanticBadge } from "@/components/dashboard/StageBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { useReadOnly } from "@/components/admin/ReadOnlyContext";
import { ReadOnlyBanner } from "@/components/admin/ReadOnlyBanner";

type LenderRow = {
  lender_id: string;
  lender_name: string;
  lender_code: string;
  list_status: "Uploaded" | "Not Uploaded";
  row_count: number;
  list_version: number | null;
  last_updated_at: string | null;
  last_updated_by: string | null;
  source_file_name: string | null;
};

type ParsedRow = {
  college_name_raw: string;
  country_raw: string;
  city: string | null;
  notes: string | null;
  effective_from: string | null;
  effective_to: string | null;
};

// Canonical required columns + alias maps (case-insensitive, spaces/underscores stripped).
// "name" intentionally excluded from college aliases — too generic, would silently
// misroute student-name / lender-name columns.
const COLLEGE_ALIASES = [
  "college name",
  "collegename",
  "university name",
  "universityname",
  "institution",
  "institution name",
  "institute",
  "school",
];
const COUNTRY_ALIASES = [
  "country",
  "country name",
  "countryname",
  "nation",
  "location",
];

function normalizeHeader(h: string): string {
  return String(h ?? "").toLowerCase().replace(/[\s_]+/g, " ").trim();
}
function normalizeForAlias(h: string): string {
  // For alias matching: also collapse all whitespace away so "collegename" === "college name"
  return normalizeHeader(h).replace(/\s+/g, "");
}

function findHeaderMatch(
  headers: string[],
  aliases: string[],
): { rawHeader: string; alias: string } | null {
  // Pass 1: exact normalized match (preserves spaces between words)
  for (const raw of headers) {
    const n = normalizeHeader(raw);
    if (aliases.includes(n)) return { rawHeader: raw, alias: n };
  }
  // Pass 2: spaces/underscores stripped
  const aliasesStripped = aliases.map((a) => a.replace(/\s+/g, ""));
  for (const raw of headers) {
    const n = normalizeForAlias(raw);
    const idx = aliasesStripped.indexOf(n);
    if (idx >= 0) return { rawHeader: raw, alias: aliases[idx] };
  }
  return null;
}

type HeaderMapping = {
  collegeHeader: string; // raw header key as it appears in the file
  countryHeader: string;
  cityHeader: string | null;
  notesHeader: string | null;
  isExact: boolean; // true when both required headers were "college name" + "country" exactly
};

function detectMapping(headers: string[]): HeaderMapping | { error: string } {
  const college = findHeaderMatch(headers, COLLEGE_ALIASES);
  const country = findHeaderMatch(headers, COUNTRY_ALIASES);
  if (!college) {
    return {
      error:
        "Required column 'College Name' (or alias) not found in your file. Download the template using the button above, fill it in, and try again.",
    };
  }
  if (!country) {
    return {
      error:
        "Required column 'Country' (or alias) not found in your file. Download the template using the button above, fill it in, and try again.",
    };
  }
  // Optional columns — straight lookup on normalized header
  let cityHeader: string | null = null;
  let notesHeader: string | null = null;
  for (const raw of headers) {
    const n = normalizeHeader(raw);
    if (!cityHeader && n === "city") cityHeader = raw;
    if (!notesHeader && n === "notes") notesHeader = raw;
  }
  const isExact =
    normalizeHeader(college.rawHeader) === "college name" &&
    normalizeHeader(country.rawHeader) === "country";
  return {
    collegeHeader: college.rawHeader,
    countryHeader: country.rawHeader,
    cityHeader,
    notesHeader,
    isExact,
  };
}

function downloadTemplate() {
  const headers = ["College Name", "Country", "City", "Notes"];
  const examples = [
    ["Harvard University", "United States", "Cambridge", "Example row — replace with your data"],
    ["University of Oxford", "United Kingdom", "Oxford", "Example row — replace with your data"],
    ["National University of Singapore (NUS)", "Singapore", "Singapore", "Example row — replace with your data"],
  ];
  const sheet1 = XLSX.utils.aoa_to_sheet([headers, ...examples]);
  // Column widths
  sheet1["!cols"] = [{ wch: 50 }, { wch: 20 }, { wch: 20 }, { wch: 50 }];
  // Bold + light-yellow fill for header row
  const headerStyle = {
    font: { bold: true },
    fill: { patternType: "solid", fgColor: { rgb: "FFF2CC" } },
  };
  ["A1", "B1", "C1", "D1"].forEach((addr) => {
    if (sheet1[addr]) (sheet1[addr] as any).s = headerStyle;
  });

  const instructions = [
    ["Premiere College List — Upload Instructions"],
    [""],
    ["• College Name and Country are required. City and Notes can be left blank."],
    ["• Country must be a recognised country name. Common aliases (USA, UK, UAE, HK, ROK) will be auto-resolved."],
    ["• Maximum 10,000 rows per file. Maximum file size 5 MB."],
    ["• Duplicates within the same file are de-duped (first occurrence kept)."],
    ["• The system supports .xlsx and .csv only."],
    ["• To replace a lender's list, upload a new file using the Replace action — the previous version is archived and the new file becomes current."],
  ];
  const sheet2 = XLSX.utils.aoa_to_sheet(instructions);
  sheet2["!cols"] = [{ wch: 110 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet1, "Premiere List");
  XLSX.utils.book_append_sheet(wb, sheet2, "Instructions");
  XLSX.writeFile(wb, "premiere-list-template.xlsx");
}

function isAdmin(role: string | null | undefined) {
  return role === "admin" || role === "super_admin";
}

export default function AdminPremiereLists() {
  const readOnly = useReadOnly();
  const { appUser, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<LenderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [uploadFor, setUploadFor] = useState<LenderRow | null>(null);
  const [viewFor, setViewFor] = useState<LenderRow | null>(null);
  const [deleteFor, setDeleteFor] = useState<LenderRow | null>(null);
  const [search, setSearch] = useState("");

  const admin = isAdmin(appUser?.role);

  const filteredRows = (() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.lender_name ?? "").toLowerCase().includes(q) ||
        (r.lender_code ?? "").toLowerCase().includes(q),
    );
  })();

  const loadRows = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.functions.invoke("premiere-list-admin", {
      body: { action: "list" },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setRows((data?.rows ?? []) as LenderRow[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading && admin) loadRows();
  }, [authLoading, admin]);

  if (!authLoading && !admin) {
    return (
      <div className="p-8">
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-6 text-center">
          <AlertCircle className="mx-auto h-6 w-6 text-destructive" />
          <h2 className="mt-2 text-lg font-semibold">403 — Admin access required</h2>
          <p className="text-sm text-muted-foreground">
            Premiere College Lists are restricted to admin users.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Premiere College Lists"
        description="Per-lender lists used to rank eligible recommendations. Premiere status never affects eligibility — only ordering."
        count={loading ? null : rows.filter((r) => r.list_status === "Uploaded").length}
      >
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="mr-2 h-4 w-4" />
          Download Template
        </Button>
        <Button variant="outline" size="sm" onClick={loadRows} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </PageHeader>
      <ReadOnlyBanner />


      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <Input
          type="search"
          placeholder="Search lender name or code…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        {search && (
          <span className="text-xs text-muted-foreground">
            {filteredRows.length} of {rows.length} lender{rows.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lender</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Rows</TableHead>
              <TableHead className="text-right">Version</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead>By</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  {rows.length === 0
                    ? "No active lenders found."
                    : `No lenders match "${search}".`}
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((r) => (
                <TableRow key={r.lender_id}>
                  <TableCell className="font-medium">
                    <div>{r.lender_name}</div>
                    <div className="text-xs text-muted-foreground">{r.lender_code}</div>
                  </TableCell>
                  <TableCell>
                    {r.list_status === "Uploaded" ? (
                      <SemanticBadge tone="emerald">Uploaded</SemanticBadge>
                    ) : (
                      <SemanticBadge tone="slate">Not Uploaded</SemanticBadge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.row_count}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.list_version ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {r.last_updated_at ? new Date(r.last_updated_at).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.last_updated_by ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => setViewFor(r)}
                        disabled={r.row_count === 0}
                        title="View list"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => setUploadFor(r)}
                        title="Upload list"
                        disabled={readOnly}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-red-600"
                        onClick={() => setDeleteFor(r)}
                        disabled={r.row_count === 0 || readOnly}
                        title="Delete list"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {uploadFor && (
        <UploadDialog
          lender={uploadFor}
          onClose={() => setUploadFor(null)}
          onDone={() => {
            setUploadFor(null);
            loadRows();
          }}
        />
      )}
      {viewFor && (
        <ViewDialog lender={viewFor} onClose={() => setViewFor(null)} />
      )}
      {deleteFor && (
        <DeleteDialog
          lender={deleteFor}
          onClose={() => setDeleteFor(null)}
          onDone={() => {
            setDeleteFor(null);
            loadRows();
          }}
        />
      )}
    </div>
  );
}

/* ---------- Upload Dialog ---------- */

function UploadDialog({
  lender,
  onClose,
  onDone,
}: {
  lender: LenderRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Pending mapping confirmation: set when fuzzy (non-exact) header match was used.
  // Null = no pending confirmation. Holds the workbook rows + mapping until admin confirms.
  const [pendingMapping, setPendingMapping] = useState<
    { mapping: HeaderMapping; rawRows: any[] } | null
  >(null);

  // Convert the workbook rows into ParsedRow[] using the resolved mapping,
  // then run the >20% failure check and commit to `parsed` state.
  // Used for both exact-match (auto-proceed) and post-confirmation flows.
  const finalizeParse = (rawRows: any[], mapping: HeaderMapping) => {
    const out: ParsedRow[] = [];
    for (const row of rawRows) {
      const college = String(row[mapping.collegeHeader] ?? "").trim();
      const country = String(row[mapping.countryHeader] ?? "").trim();
      if (!college || !country) continue;
      out.push({
        college_name_raw: college,
        country_raw: country,
        city: mapping.cityHeader ? stringOrNull(row[mapping.cityHeader]) : null,
        notes: mapping.notesHeader ? stringOrNull(row[mapping.notesHeader]) : null,
        // effective_from / effective_to intentionally omitted from admin UI for v1.
        // DB columns remain nullable; null = always-effective in BRE lookup.
        effective_from: null,
        effective_to: null,
      });
    }
    if (out.length === 0) {
      setParseError("No valid rows after parsing.");
      return;
    }
    const failureRate = (rawRows.length - out.length) / rawRows.length;
    if (failureRate > 0.2) {
      setParseError(
        `Parse failure rate ${(failureRate * 100).toFixed(0)}% exceeds 20%. Fix the file and retry.`,
      );
      return;
    }
    setParsed(out);
  };

  const handleFile = async (f: File) => {
    setFile(f);
    setParsed(null);
    setParseError(null);
    setPendingMapping(null);
    if (f.size > 5 * 1024 * 1024) {
      setParseError("File exceeds 5 MB limit.");
      return;
    }
    try {
      // Single code path for .xlsx AND .csv — XLSX.read auto-detects format from
      // the file bytes. Header detection + alias mapping below applies uniformly.
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      if (rows.length === 0) {
        setParseError("File contains no rows.");
        return;
      }
      if (rows.length > 10000) {
        setParseError("File exceeds 10,000 row limit.");
        return;
      }
      const headers = Object.keys(rows[0]);
      const result = detectMapping(headers);
      if ("error" in result) {
        setParseError(result.error);
        return;
      }
      if (result.isExact) {
        // No friction — proceed straight to validation
        finalizeParse(rows, result);
      } else {
        // Show confirmation panel before validating
        setPendingMapping({ mapping: result, rawRows: rows });
      }
    } catch (e: any) {
      setParseError(e?.message ?? "Failed to parse file.");
    }
  };

  const confirmMapping = () => {
    if (!pendingMapping) return;
    const { rawRows, mapping } = pendingMapping;
    setPendingMapping(null);
    finalizeParse(rawRows, mapping);
  };

  const cancelMapping = () => {
    setPendingMapping(null);
    setFile(null);
    setParsed(null);
  };

  const submit = async () => {
    if (!file || !parsed) return;
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("premiere-list-admin", {
      body: {
        action: "upload",
        lender_id: lender.lender_id,
        file_name: file.name,
        file_size_bytes: file.size,
        rows: parsed,
      },
    });
    setSubmitting(false);
    if (error || data?.error) {
      toast({
        title: "Upload failed",
        description: data?.error ?? error?.message ?? "Unknown error",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Upload complete",
      description: `${parsed.length} rows committed for ${lender.lender_name}.`,
    });
    onDone();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Premiere List — {lender.lender_name}</DialogTitle>
          <DialogDescription>
            Accepts <code>.xlsx</code> or <code>.csv</code>. Required columns:{" "}
            <code>College Name</code>, <code>Country</code>. Optional: City, Notes.
            Replaces the current list.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          {parseError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {parseError}
            </div>
          )}
          {pendingMapping && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-3 text-sm">
              <div className="font-medium mb-2">Confirm column mapping</div>
              <div className="text-muted-foreground mb-2">
                Detected columns from your file:
              </div>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <code>'{pendingMapping.mapping.collegeHeader}'</code> → will be
                  treated as <code>'College Name'</code>
                </li>
                <li>
                  <code>'{pendingMapping.mapping.countryHeader}'</code> → will be
                  treated as <code>'Country'</code>
                </li>
                {pendingMapping.mapping.cityHeader && (
                  <li>
                    <code>'{pendingMapping.mapping.cityHeader}'</code> → will be
                    treated as <code>'City'</code>
                  </li>
                )}
                {pendingMapping.mapping.notesHeader && (
                  <li>
                    <code>'{pendingMapping.mapping.notesHeader}'</code> → will be
                    treated as <code>'Notes'</code>
                  </li>
                )}
              </ul>
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={confirmMapping}>
                  Confirm
                </Button>
                <Button size="sm" variant="outline" onClick={cancelMapping}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
          {parsed && (
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                <span>
                  Parsed <strong>{parsed.length}</strong> valid rows from{" "}
                  <strong>{file?.name}</strong>.
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!parsed || submitting}>
            {submitting ? "Uploading..." : "Commit Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- View Dialog ---------- */

function ViewDialog({
  lender,
  onClose,
}: {
  lender: LenderRow;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase.functions.invoke("premiere-list-admin", {
        body: {
          action: "view",
          lender_id: lender.lender_id,
          search,
          page: 0,
          page_size: 100,
        },
      });
      if (cancelled) return;
      setRows(data?.rows ?? []);
      setTotal(data?.total ?? 0);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [lender.lender_id, search]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{lender.lender_name} — Current List</DialogTitle>
          <DialogDescription>
            {total} rows • version {lender.list_version ?? "—"}
          </DialogDescription>
        </DialogHeader>
        <Input
          placeholder="Search college or country…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="max-h-[50vh] overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>College</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>City</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={3}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No rows.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.college_name_raw}</TableCell>
                    <TableCell>{r.country_normalized || r.country_raw}</TableCell>
                    <TableCell className="text-muted-foreground">{r.city ?? "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Delete Dialog ---------- */

function DeleteDialog({
  lender,
  onClose,
  onDone,
}: {
  lender: LenderRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("premiere-list-admin", {
      body: { action: "delete", lender_id: lender.lender_id },
    });
    setSubmitting(false);
    if (error || data?.error) {
      toast({
        title: "Delete failed",
        description: data?.error ?? error?.message ?? "Unknown error",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "List archived", description: `${lender.lender_name} list cleared.` });
    onDone();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive Premiere List?</DialogTitle>
          <DialogDescription>
            This soft-archives the current list for <strong>{lender.lender_name}</strong>.
            Existing recommendations are not retroactively re-ranked.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={submit} disabled={submitting}>
            {submitting ? "Archiving…" : "Archive List"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function stringOrNull(v: any): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}
