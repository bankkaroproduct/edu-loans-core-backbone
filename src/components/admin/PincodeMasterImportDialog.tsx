// Dedicated importer for Pincode_master.csv (the user's 111k-row source).
// CSV columns expected: Bank, Pincode, Tier, District, State (Bank is dropped).
// Groups rows by Pincode → mode of district/state → tier from first non-null →
// tracks conflicts, then upserts in chunks of 500 to public.pincode_master.
//
// This is intentionally separate from MasterBulkUploadDialog because:
//   - the source file is 100k+ rows (the master dialog caps at 500),
//   - the row→record reduction (mode picking + conflict flag) is bespoke,
//   - the master dialog assumes one CSV row = one DB row.

import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Upload, Download, FileText, Info, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCompleted?: () => void;
}

interface AggregatedRow {
  pincode: string;
  district: string | null;
  state: string | null;
  tier: string | null;
  source_row_count: number;
  has_conflict: boolean;
}

interface ImportSummary {
  rowsRead: number;
  uniquePincodes: number;
  upserted: number;
  failed: number;
  conflicts: number;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (c === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

/** Mode (most-frequent value) over a list of strings; non-null wins ties by count. */
function modeNonNull(values: (string | null)[]): { value: string | null; conflict: boolean } {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  if (counts.size === 0) return { value: null, conflict: false };
  let best: string | null = null;
  let bestCount = -1;
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  // Conflict = more than one distinct non-null value seen.
  return { value: best, conflict: counts.size > 1 };
}

const SAMPLE_TEMPLATE = `Bank,Pincode,Tier,District,State
HDFC,400001,1,Mumbai,Maharashtra
HDFC,110001,1,New Delhi,Delhi
HDFC,560001,1,Bangalore,Karnataka
`;

export function PincodeMasterImportDialog({ open, onOpenChange, onCompleted }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState<string>("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const reset = () => {
    setParsing(false);
    setUploading(false);
    setProgress(0);
    setProgressLabel("");
    setSummary(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const downloadTemplate = () => {
    const blob = new Blob([SAMPLE_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pincode_master_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = async (file: File) => {
    setSummary(null);
    setParsing(true);
    setProgressLabel("Reading file…");
    setProgress(2);

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/);
      if (lines.length < 2) {
        toast({ title: "Empty file", description: "No data rows found.", variant: "destructive" });
        setParsing(false);
        return;
      }
      const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
      const idxPincode = headers.indexOf("pincode");
      const idxTier = headers.indexOf("tier");
      const idxDistrict = headers.indexOf("district");
      const idxState = headers.indexOf("state");
      if (idxPincode < 0 || idxDistrict < 0 || idxState < 0) {
        toast({
          title: "Missing required columns",
          description: "CSV must include Pincode, District, State (Tier and Bank are optional).",
          variant: "destructive",
        });
        setParsing(false);
        return;
      }

      // Aggregate by pincode
      const buckets = new Map<string, { districts: (string | null)[]; states: (string | null)[]; tiers: (string | null)[] }>();
      let rowsRead = 0;
      const totalLines = lines.length - 1;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        const cells = splitCsvLine(line);
        const pin = (cells[idxPincode] ?? "").trim();
        if (!/^\d{6}$/.test(pin)) continue;
        rowsRead++;
        const district = (cells[idxDistrict] ?? "").trim() || null;
        const state = (cells[idxState] ?? "").trim() || null;
        const tier = idxTier >= 0 ? ((cells[idxTier] ?? "").trim() || null) : null;
        let bucket = buckets.get(pin);
        if (!bucket) {
          bucket = { districts: [], states: [], tiers: [] };
          buckets.set(pin, bucket);
        }
        bucket.districts.push(district);
        bucket.states.push(state);
        bucket.tiers.push(tier);

        if (i % 10000 === 0) {
          setProgress(Math.min(40, Math.round((i / totalLines) * 40)));
          setProgressLabel(`Parsed ${i.toLocaleString("en-IN")} of ~${totalLines.toLocaleString("en-IN")} rows`);
          // Yield to UI
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      const aggregated: AggregatedRow[] = [];
      let conflicts = 0;
      for (const [pin, b] of buckets) {
        const dist = modeNonNull(b.districts);
        const st = modeNonNull(b.states);
        const tier = b.tiers.find((t) => !!t) ?? null;
        const has_conflict = dist.conflict || st.conflict;
        if (has_conflict) conflicts++;
        aggregated.push({
          pincode: pin,
          district: dist.value,
          state: st.value,
          tier,
          source_row_count: b.districts.length,
          has_conflict,
        });
      }

      setParsing(false);
      setUploading(true);
      setProgressLabel(`Uploading ${aggregated.length.toLocaleString("en-IN")} unique pincodes…`);
      setProgress(45);

      const CHUNK = 500;
      let upserted = 0;
      let failed = 0;
      for (let i = 0; i < aggregated.length; i += CHUNK) {
        const chunk = aggregated.slice(i, i + CHUNK);
        const { error } = await supabase
          .from("pincode_master")
          .upsert(chunk, { onConflict: "pincode" });
        if (error) {
          failed += chunk.length;
          // Continue — partial success is still valuable
        } else {
          upserted += chunk.length;
        }
        const done = Math.min(i + CHUNK, aggregated.length);
        setProgress(45 + Math.round((done / aggregated.length) * 55));
        setProgressLabel(`Uploaded ${done.toLocaleString("en-IN")} of ${aggregated.length.toLocaleString("en-IN")}`);
        await new Promise((r) => setTimeout(r, 0));
      }

      const summary: ImportSummary = {
        rowsRead,
        uniquePincodes: aggregated.length,
        upserted,
        failed,
        conflicts,
      };
      setSummary(summary);
      setUploading(false);
      setProgress(100);
      setProgressLabel("Done");

      toast({
        title: "Pincode import complete",
        description: `${upserted.toLocaleString("en-IN")} pincodes upserted${failed > 0 ? `, ${failed} failed` : ""}.`,
      });
      onCompleted?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Import failed", description: msg, variant: "destructive" });
      setParsing(false);
      setUploading(false);
    }
  };

  const busy = parsing || uploading;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Pincode Master</DialogTitle>
          <DialogDescription>
            Upload your Pincode_master.csv to power district / state auto-fill on lead forms.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert className="bg-blue-50 border-blue-200 text-blue-900 [&>svg]:text-blue-600">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs leading-relaxed space-y-1">
              <div><strong>Required columns:</strong> <span className="font-mono">Pincode, District, State</span></div>
              <div><strong>Optional:</strong> <span className="font-mono">Tier, Bank</span> (Bank is ignored)</div>
              <div>Rows are grouped by pincode. The most-frequent district / state wins; mismatches are flagged in the master so the form can show a "Verify district" hint.</div>
            </AlertDescription>
          </Alert>

          {!busy && !summary && (
            <div className="border-2 border-dashed rounded-md p-8 text-center space-y-3">
              <FileText className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-sm">Choose your Pincode_master.csv (large files OK — processed in chunks).</p>
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
          )}

          {busy && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground">{progressLabel}</p>
            </div>
          )}

          {summary && (
            <Alert className="bg-emerald-50 border-emerald-200 text-emerald-900 [&>svg]:text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription className="text-sm leading-relaxed">
                <strong>Import complete.</strong>
                <ul className="mt-1 space-y-0.5 text-xs">
                  <li>Rows read: {summary.rowsRead.toLocaleString("en-IN")}</li>
                  <li>Unique pincodes: {summary.uniquePincodes.toLocaleString("en-IN")}</li>
                  <li>Upserted: {summary.upserted.toLocaleString("en-IN")}</li>
                  {summary.failed > 0 && <li className="text-rose-700">Failed: {summary.failed.toLocaleString("en-IN")}</li>}
                  {summary.conflicts > 0 && (
                    <li className="text-amber-700 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> District/state conflicts flagged: {summary.conflicts.toLocaleString("en-IN")}
                    </li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={busy}>
            {summary ? "Close" : "Cancel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
