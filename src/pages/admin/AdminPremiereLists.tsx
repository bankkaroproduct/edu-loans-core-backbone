import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { Upload, Trash2, Eye, RefreshCw, AlertCircle, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

const REQUIRED_COLS = ["college name", "country"];

function isAdmin(role: string | null | undefined) {
  return role === "admin" || role === "super_admin";
}

export default function AdminPremiereLists() {
  const { appUser, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<LenderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [uploadFor, setUploadFor] = useState<LenderRow | null>(null);
  const [viewFor, setViewFor] = useState<LenderRow | null>(null);
  const [deleteFor, setDeleteFor] = useState<LenderRow | null>(null);

  const admin = isAdmin(appUser?.role);

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
      >
        <Button variant="outline" size="sm" onClick={loadRows} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </PageHeader>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

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
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No active lenders found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.lender_id}>
                  <TableCell className="font-medium">
                    <div>{r.lender_name}</div>
                    <div className="text-xs text-muted-foreground">{r.lender_code}</div>
                  </TableCell>
                  <TableCell>
                    {r.list_status === "Uploaded" ? (
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-900 border-emerald-200">
                        Uploaded
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Not Uploaded
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.row_count}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.list_version ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.last_updated_at ? new Date(r.last_updated_at).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.last_updated_by ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewFor(r)}
                        disabled={r.row_count === 0}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setUploadFor(r)}>
                        <Upload className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteFor(r)}
                        disabled={r.row_count === 0}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
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

  const handleFile = async (f: File) => {
    setFile(f);
    setParsed(null);
    setParseError(null);
    if (f.size > 5 * 1024 * 1024) {
      setParseError("File exceeds 5 MB limit.");
      return;
    }
    try {
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
      const headerKeys = Object.keys(rows[0]).map((h) => h.toLowerCase().trim());
      const missing = REQUIRED_COLS.filter(
        (c) => !headerKeys.some((h) => h === c || h.includes(c)),
      );
      if (missing.length > 0) {
        setParseError(`Missing required columns: ${missing.join(", ")}`);
        return;
      }
      const out: ParsedRow[] = [];
      for (const row of rows) {
        const lc: Record<string, any> = {};
        for (const k of Object.keys(row)) lc[k.toLowerCase().trim()] = row[k];
        const college = String(lc["college name"] ?? lc["college"] ?? "").trim();
        const country = String(lc["country"] ?? "").trim();
        if (!college || !country) continue;
        out.push({
          college_name_raw: college,
          country_raw: country,
          city: stringOrNull(lc["city"]),
          notes: stringOrNull(lc["notes"]),
          effective_from: stringOrNull(lc["effective from"] ?? lc["effective_from"]),
          effective_to: stringOrNull(lc["effective to"] ?? lc["effective_to"]),
        });
      }
      if (out.length === 0) {
        setParseError("No valid rows after parsing.");
        return;
      }
      const failureRate = (rows.length - out.length) / rows.length;
      if (failureRate > 0.2) {
        setParseError(
          `Parse failure rate ${(failureRate * 100).toFixed(0)}% exceeds 20%. Fix the file and retry.`,
        );
        return;
      }
      setParsed(out);
    } catch (e: any) {
      setParseError(e?.message ?? "Failed to parse file.");
    }
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
            <code>College Name</code>, <code>Country</code>. Optional: City, Notes,
            Effective From, Effective To. Replaces the current list.
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
