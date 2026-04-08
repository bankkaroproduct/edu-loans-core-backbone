import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { usePartnerContext } from "@/hooks/usePartnerContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Upload, Download, FileText, ArrowLeft, CheckCircle, XCircle, AlertTriangle,
  RefreshCw, Eye, History, Info, ChevronDown, ChevronRight, FileWarning, LayoutList, Home,
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import {
  processBulkUpload,
  generateErrorReportCSV,
  getTemplateCSV,
  type RowResult,
  type ProcessingStage,
} from "@/hooks/useBulkUploadProcessor";

type Batch = Tables<"bulk_upload_batches">;

const statusColors: Record<string, string> = {
  uploaded: "bg-primary/10 text-primary",
  processing: "bg-accent text-accent-foreground",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  completed_with_errors: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  failed: "bg-destructive/10 text-destructive",
};

const rowStatusConfig = {
  success: { icon: CheckCircle, className: "text-green-600 bg-green-50 dark:bg-green-900/20", label: "Success" },
  failed: { icon: XCircle, className: "text-destructive bg-destructive/10", label: "Failed" },
  duplicate: { icon: AlertTriangle, className: "text-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400", label: "Duplicate" },
};

const fmt = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/* ─── Template field reference ─── */
const REQUIRED_COLS = [
  { name: "student_first_name", example: "Rahul" },
  { name: "student_last_name", example: "Sharma" },
  { name: "student_phone", example: "+919876543210" },
  { name: "intended_study_country", example: "United States" },
  { name: "intake_term", example: "Fall" },
  { name: "intake_year", example: "2025" },
  { name: "course_name", example: "MS Computer Science" },
  { name: "loan_amount_required", example: "2500000" },
];

const OPTIONAL_COLS = [
  { name: "student_email", example: "rahul@email.com" },
  { name: "student_whatsapp", example: "+919876543210" },
  { name: "city", example: "Mumbai" },
  { name: "state", example: "Maharashtra" },
  { name: "country_of_residence", example: "India" },
  { name: "university_name", example: "MIT" },
  { name: "coapplicant_name", example: "Suresh Sharma" },
  { name: "coapplicant_relation", example: "Father" },
  { name: "coapplicant_income", example: "1200000" },
  { name: "collateral_available", example: "yes" },
  { name: "collateral_notes", example: "Flat in Mumbai" },
  { name: "source_sub_type", example: "referral" },
  { name: "partner_remark", example: "Urgent case" },
];

export default function BulkUpload() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { appUser } = useAuth();
  const { agentUserId } = useRoleAccess();
  const { effectivePartnerId, effectiveUserId } = usePartnerContext();

  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>(searchParams.get("batch") ? "history" : "upload");

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [stage, setStage] = useState<ProcessingStage>("idle");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<RowResult[]>([]);
  const [summary, setSummary] = useState<{ batchId: string; total: number; success: number; failed: number; duplicates: number } | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef(false);
  const [guideOpen, setGuideOpen] = useState(false);

  // Batch detail
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(searchParams.get("batch"));
  const [batchRows, setBatchRows] = useState<any[]>([]);
  const [batchRowsLoading, setBatchRowsLoading] = useState(false);

  const loadBatches = async () => {
    let query = supabase.from("bulk_upload_batches").select("*").order("uploaded_at", { ascending: false }).limit(50);
    if (agentUserId) query = query.eq("uploaded_by", agentUserId);
    const { data } = await query;
    setBatches(data ?? []);
    setBatchesLoading(false);
  };

  useEffect(() => { loadBatches(); }, []);

  useEffect(() => {
    if (selectedBatchId) loadBatchRows(selectedBatchId);
  }, [selectedBatchId]);

  const loadBatchRows = async (batchId: string) => {
    setBatchRowsLoading(true);
    const { data } = await supabase
      .from("bulk_upload_row_results")
      .select("*")
      .eq("batch_id", batchId)
      .order("row_number", { ascending: true })
      .limit(1000);
    setBatchRows(data ?? []);
    setBatchRowsLoading(false);
  };

  const downloadTemplate = () => {
    const csv = getTemplateCSV();
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lead_upload_template.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Template downloaded successfully");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      toast.error("Only CSV files are supported");
      e.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be under 5MB");
      e.target.value = "";
      return;
    }
    setSelectedFile(file);
    setStage("idle");
    setResults([]);
    setSummary(null);
    setProcessingError(null);
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const startProcessing = async () => {
    if (!selectedFile || !appUser || processingRef.current) return;
    processingRef.current = true;
    setProcessingError(null);

    try {
      const text = await selectedFile.text();
      const result = await processBulkUpload(
        text, selectedFile.name, appUser,
        (s) => setStage(s),
        (c, t) => setProgress({ current: c, total: t }),
      );
      setResults(result.results);
      setSummary({ batchId: result.batchId, total: result.totalRows, success: result.successCount, failed: result.failedCount, duplicates: result.duplicateCount });
      await loadBatches();
      toast.success(`Upload complete. ${result.successCount} leads created.`);
    } catch (err: any) {
      setStage("error");
      setProcessingError(err.message ?? "An unexpected error occurred");
      toast.error(err.message ?? "Upload failed");
    } finally {
      processingRef.current = false;
    }
  };

  const downloadErrorReport = (rowData?: RowResult[]) => {
    const data = rowData ?? results;
    const csv = generateErrorReportCSV(data);
    if (!csv) { toast.info("No failed or duplicate rows to download"); return; }
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `error_report_${summary?.batchId ?? "batch"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadBatchErrorReport = (batchId: string) => {
    const errorRows = batchRows.filter((r) => r.validation_status !== "success");
    if (errorRows.length === 0) { toast.info("No errors in this batch"); return; }
    const mapped: RowResult[] = errorRows.map((r: any) => ({
      rowNumber: r.row_number,
      raw: (r.raw_payload as Record<string, string>) ?? {},
      status: r.validation_status === "duplicate" ? "duplicate" : "failed",
      reason: r.failure_reason ?? "",
      matchedLeadId: r.validation_status === "duplicate" ? r.created_lead_id : undefined,
    }));
    const csv = generateErrorReportCSV(mapped);
    if (!csv) return;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `error_report_batch_${batchId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setStage("idle");
    setResults([]);
    setSummary(null);
    setProcessingError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isProcessing = stage === "parsing" || stage === "validating" || stage === "processing";
  const progressPct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  const stageMessages: Record<ProcessingStage, string> = {
    idle: "",
    parsing: "Reading and parsing file…",
    validating: "Validating rows against master data…",
    processing: `Creating leads… ${progress.current} of ${progress.total}`,
    completed: "Upload complete",
    error: "Processing failed",
  };

  /* ─── Row results renderer (shared between upload results and batch detail) ─── */
  const renderRowResultsTable = (rows: RowResult[], showEmail = true) => (
    <div className="max-h-[500px] overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-14">Row</TableHead>
            <TableHead>Student</TableHead>
            <TableHead>Phone</TableHead>
            {showEmail && <TableHead>Email</TableHead>}
            <TableHead>Status</TableHead>
            <TableHead>Details</TableHead>
            <TableHead>Lead ID</TableHead>
            <TableHead className="w-28">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const cfg = rowStatusConfig[r.status];
            const Icon = cfg.icon;
            return (
              <TableRow key={r.rowNumber} className={r.status === "duplicate" ? "bg-yellow-50/40 dark:bg-yellow-900/5" : ""}>
                <TableCell className="font-mono text-xs">{r.rowNumber}</TableCell>
                <TableCell className="text-sm font-medium">{r.raw.student_first_name} {r.raw.student_last_name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.raw.student_phone || "—"}</TableCell>
                {showEmail && <TableCell className="text-sm text-muted-foreground">{r.raw.student_email || "—"}</TableCell>}
                <TableCell>
                  <Badge variant="secondary" className={`${cfg.className} gap-1`}>
                    <Icon className="h-3 w-3" /> {cfg.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[220px]">
                  <span className="line-clamp-2">{r.reason}</span>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {r.status === "success" && (r.createdLeadDisplayId ?? r.createdLeadId?.slice(0, 8) ?? "—")}
                  {r.status === "duplicate" && (
                    <span className="text-yellow-700 dark:text-yellow-400">
                      {r.matchedLeadDisplayId ?? r.matchedLeadId?.slice(0, 8) ?? "—"}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {r.status === "success" && r.createdLeadId && (
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate(`/leads/${r.createdLeadId}`)}>
                      <Eye className="mr-1 h-3 w-3" /> Open
                    </Button>
                  )}
                  {r.status === "duplicate" && r.matchedLeadId && (
                    <Button variant="outline" size="sm" className="text-xs h-7 border-yellow-300 text-yellow-700 dark:text-yellow-400" onClick={() => navigate(`/leads/${r.matchedLeadId}`)}>
                      <Eye className="mr-1 h-3 w-3" /> View Existing
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  /* ─── Batch detail row table from persisted data ─── */
  const renderBatchRowsTable = () => {
    if (batchRowsLoading) return <p className="text-center py-8 text-muted-foreground">Loading rows…</p>;
    if (batchRows.length === 0) return (
      <div className="text-center py-10">
        <LayoutList className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-muted-foreground text-sm">No row results found for this batch.</p>
      </div>
    );

    return (
      <div className="max-h-[500px] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">Row</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Lead ID</TableHead>
              <TableHead className="w-28">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batchRows.map((r: any) => {
              const payload = r.raw_payload as Record<string, string> | null;
              const name = payload ? `${payload.student_first_name ?? ""} ${payload.student_last_name ?? ""}`.trim() : "—";
              const phone = payload?.student_phone ?? "—";
              const email = payload?.student_email ?? "—";
              const vs = r.validation_status as string;
              const cfg = rowStatusConfig[vs as keyof typeof rowStatusConfig] ?? rowStatusConfig.failed;
              const Icon = cfg.icon;
              const isDup = vs === "duplicate";
              return (
                <TableRow key={r.id} className={isDup ? "bg-yellow-50/40 dark:bg-yellow-900/5" : ""}>
                  <TableCell className="font-mono text-xs">{r.row_number}</TableCell>
                  <TableCell className="text-sm font-medium">{name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{phone}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={`${cfg.className} gap-1`}>
                      <Icon className="h-3 w-3" /> {fmt(vs)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[220px]">
                    <span className="line-clamp-2">{r.failure_reason ?? "—"}</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {vs === "success" && r.created_lead_id ? r.created_lead_id.slice(0, 8) : ""}
                    {isDup && r.created_lead_id && (
                      <span className="text-yellow-700 dark:text-yellow-400">{r.created_lead_id.slice(0, 8)}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.created_lead_id && vs === "success" && (
                      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate(`/leads/${r.created_lead_id}`)}>
                        <Eye className="mr-1 h-3 w-3" /> Open
                      </Button>
                    )}
                    {r.created_lead_id && isDup && (
                      <Button variant="outline" size="sm" className="text-xs h-7 border-yellow-300 text-yellow-700 dark:text-yellow-400" onClick={() => navigate(`/leads/${r.created_lead_id}`)}>
                        <Eye className="mr-1 h-3 w-3" /> View Existing
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Bulk Upload Leads</h1>
            <p className="text-sm text-muted-foreground">Upload multiple student leads using the standard CSV template</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="mr-1 h-4 w-4" /> Download Template
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/leads")}>
            <FileText className="mr-1 h-4 w-4" /> View Submitted Leads
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="upload"><Upload className="mr-1 h-3.5 w-3.5" /> Upload</TabsTrigger>
          <TabsTrigger value="history"><History className="mr-1 h-3.5 w-3.5" /> Batch History</TabsTrigger>
          {selectedBatchId && <TabsTrigger value="detail"><Eye className="mr-1 h-3.5 w-3.5" /> Batch Detail</TabsTrigger>}
        </TabsList>

        {/* ===== UPLOAD TAB ===== */}
        <TabsContent value="upload" className="space-y-4">

          {/* ── Instructions & Template Guide ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Info className="h-4 w-4" /> Upload Guidelines & Template Reference</CardTitle>
              <CardDescription>Read carefully before uploading to avoid validation errors.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {/* Quick rules */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <p className="font-medium text-foreground">Format & Limits</p>
                  <ul className="list-disc pl-4 text-muted-foreground space-y-0.5">
                    <li>Supported format: <strong>CSV</strong> only</li>
                    <li>Maximum <strong>1,000 rows</strong> per file</li>
                    <li>Maximum file size: <strong>5 MB</strong></li>
                    <li>Use <strong>exact header names</strong> from the template — headers are case-insensitive and spaces are normalized to underscores</li>
                  </ul>
                </div>
                <div className="space-y-1.5">
                  <p className="font-medium text-foreground">After Upload</p>
                  <ul className="list-disc pl-4 text-muted-foreground space-y-0.5">
                    <li>Each row is validated individually — valid rows create leads even if others fail</li>
                    <li>Duplicates (matching phone, email, or name+intake) are <strong>flagged and not created</strong></li>
                    <li>Duplicates within the same file are also detected</li>
                    <li>Download the error report, correct the rows, and re-upload as a new batch</li>
                    <li>Successfully created leads appear immediately in Submitted Leads</li>
                  </ul>
                </div>
              </div>

              {/* Collapsible field reference */}
              <Collapsible open={guideOpen} onOpenChange={setGuideOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground hover:text-foreground">
                    <span className="flex items-center gap-1"><LayoutList className="h-3.5 w-3.5" /> Column Reference & Allowed Values</span>
                    {guideOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  <div className="border rounded-lg overflow-auto max-h-[350px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-48">Column Name</TableHead>
                          <TableHead className="w-20">Required</TableHead>
                          <TableHead>Example / Allowed Values</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {REQUIRED_COLS.map((c) => (
                          <TableRow key={c.name}>
                            <TableCell className="font-mono text-xs">{c.name}</TableCell>
                            <TableCell><Badge variant="destructive" className="text-[10px] px-1.5">Required</Badge></TableCell>
                            <TableCell className="text-xs text-muted-foreground">{c.example}</TableCell>
                          </TableRow>
                        ))}
                        {OPTIONAL_COLS.map((c) => (
                          <TableRow key={c.name}>
                            <TableCell className="font-mono text-xs">{c.name}</TableCell>
                            <TableCell><Badge variant="secondary" className="text-[10px] px-1.5">Optional</Badge></TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {c.name === "collateral_available" ? (
                                <span><strong>yes</strong> / <strong>no</strong> / true / false / 1 / 0</span>
                              ) : c.name === "coapplicant_income" || c.name === "loan_amount_required" ? (
                                <span>{c.example} <em>(numeric, positive)</em></span>
                              ) : c.name === "intended_study_country" ? (
                                <span>{c.example} <em>(must match countries master)</em></span>
                              ) : c.name === "intake_term" ? (
                                <span>{c.example} <em>(must match intake master, e.g. Fall, Spring, Summer)</em></span>
                              ) : c.name === "intake_year" ? (
                                <span>{c.example} <em>(2020–2035)</em></span>
                              ) : c.example}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    <strong>Note:</strong> Do not add partner_id, source_type, or created_by columns — these are derived automatically.
                    University and course values are matched against master data when possible; unmatched values are stored as-is.
                    If <strong>collateral_available = yes</strong>, then <strong>collateral_notes</strong> is required.
                  </p>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>

          {/* ── Upload Zone ── */}
          {stage !== "completed" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Upload CSV File</CardTitle>
                <CardDescription>Select a file prepared using the template above.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!selectedFile ? (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-10 cursor-pointer hover:bg-muted/30 transition-colors">
                    <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="text-sm font-medium text-muted-foreground mb-1">Click to select a CSV file or drag and drop</p>
                    <p className="text-xs text-muted-foreground">CSV format only • Max 1,000 rows • Max 5 MB</p>
                    <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
                  </label>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
                      <div className="flex items-center gap-3">
                        <FileText className="h-8 w-8 text-primary" />
                        <div>
                          <p className="font-medium text-sm">{selectedFile.name}</p>
                          <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                      </div>
                      {!isProcessing && (
                        <Button variant="ghost" size="sm" onClick={removeFile}>Remove</Button>
                      )}
                    </div>

                    {isProcessing && (
                      <div className="space-y-2 p-3 bg-muted/20 rounded-lg">
                        <div className="flex items-center gap-2">
                          <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                          <p className="text-sm font-medium">{stageMessages[stage]}</p>
                        </div>
                        <Progress value={stage === "processing" ? progressPct : undefined} className="h-2" />
                        {stage === "processing" && (
                          <p className="text-xs text-muted-foreground text-right">{progressPct}% complete</p>
                        )}
                      </div>
                    )}

                    {stage === "error" && processingError && (
                      <div className="p-3 border border-destructive/30 rounded-lg bg-destructive/5">
                        <p className="text-sm text-destructive font-medium">Error: {processingError}</p>
                        <p className="text-xs text-muted-foreground mt-1">Check your file format and try again. If the problem persists, download a fresh template.</p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button onClick={startProcessing} disabled={isProcessing}>
                        {isProcessing ? <><RefreshCw className="mr-1 h-4 w-4 animate-spin" /> Processing…</> : <><Upload className="mr-1 h-4 w-4" /> Start Processing</>}
                      </Button>
                      {stage === "error" && <Button variant="outline" onClick={resetUpload}>Try Again</Button>}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Results Summary ── */}
          {stage === "completed" && summary && (
            <div className="space-y-4">
              <Card className="border-green-200 dark:border-green-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" /> Upload Complete
                  </CardTitle>
                  <CardDescription>Batch {summary.batchId} — {selectedFile?.name}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                    <div className="text-center p-3 rounded-lg bg-muted/30">
                      <p className="text-2xl font-bold">{summary.total}</p>
                      <p className="text-xs text-muted-foreground">Total Rows</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                      <p className="text-2xl font-bold text-green-600">{summary.success}</p>
                      <p className="text-xs text-muted-foreground">Created</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-destructive/5">
                      <p className="text-2xl font-bold text-destructive">{summary.failed}</p>
                      <p className="text-xs text-muted-foreground">Failed</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                      <p className="text-2xl font-bold text-yellow-600">{summary.duplicates}</p>
                      <p className="text-xs text-muted-foreground">Duplicates</p>
                    </div>
                  </div>

                  {/* Next-step actions */}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => navigate("/leads")}>
                      <FileText className="mr-1 h-3.5 w-3.5" /> View Created Leads
                    </Button>
                    {(summary.failed > 0 || summary.duplicates > 0) && (
                      <Button variant="outline" size="sm" onClick={() => downloadErrorReport()}>
                        <Download className="mr-1 h-3.5 w-3.5" /> Download Error Report
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={resetUpload}>
                      <Upload className="mr-1 h-3.5 w-3.5" /> Upload Corrected File
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setActiveTab("history")}>
                      <History className="mr-1 h-3.5 w-3.5" /> View Batch History
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
                      <Home className="mr-1 h-3.5 w-3.5" /> Return to Dashboard
                    </Button>
                  </div>

                  {/* Re-upload guidance */}
                  {(summary.failed > 0 || summary.duplicates > 0) && (
                    <div className="mt-4 p-3 border border-yellow-200 dark:border-yellow-800 rounded-lg bg-yellow-50/50 dark:bg-yellow-900/10">
                      <p className="text-sm font-medium flex items-center gap-1.5 text-yellow-800 dark:text-yellow-400">
                        <FileWarning className="h-4 w-4" /> Correction Workflow
                      </p>
                      <ol className="list-decimal pl-5 text-xs text-muted-foreground mt-1 space-y-0.5">
                        <li>Download the error report above — it contains all failed and duplicate rows with reasons.</li>
                        <li>Fix the data in your spreadsheet editor.</li>
                        <li>Upload the corrected rows as a new file using "Upload Corrected File" — old batch history is preserved.</li>
                      </ol>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Row Results */}
              {results.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Row-Level Results</CardTitle>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-green-600" /> {summary.success} success</span>
                        <span className="flex items-center gap-1"><XCircle className="h-3 w-3 text-destructive" /> {summary.failed} failed</span>
                        <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-yellow-600" /> {summary.duplicates} duplicates</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {renderRowResultsTable(results)}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* ===== HISTORY TAB ===== */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-4 w-4" /> Upload History
              </CardTitle>
              <CardDescription>All bulk upload batches for your organization, most recent first.</CardDescription>
            </CardHeader>
            <CardContent>
              {batchesLoading ? (
                <div className="text-center py-10">
                  <RefreshCw className="h-6 w-6 text-muted-foreground mx-auto mb-2 animate-spin" />
                  <p className="text-sm text-muted-foreground">Loading batch history…</p>
                </div>
              ) : batches.length === 0 ? (
                <div className="text-center py-10">
                  <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground mb-1">No upload history yet</p>
                  <p className="text-xs text-muted-foreground mb-4">Download the template and upload your first batch.</p>
                  <div className="flex justify-center gap-2">
                    <Button variant="outline" size="sm" onClick={downloadTemplate}><Download className="mr-1 h-3.5 w-3.5" /> Download Template</Button>
                    <Button size="sm" onClick={() => setActiveTab("upload")}><Upload className="mr-1 h-3.5 w-3.5" /> Upload File</Button>
                  </div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Batch ID</TableHead>
                      <TableHead>File</TableHead>
                      <TableHead className="text-center">Total</TableHead>
                      <TableHead className="text-center">Success</TableHead>
                      <TableHead className="text-center">Failed</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead>Processed</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.map((b) => (
                      <TableRow key={b.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedBatchId(b.id); setActiveTab("detail"); }}>
                        <TableCell className="font-mono text-xs">{b.batch_id ?? "—"}</TableCell>
                        <TableCell className="max-w-[150px] truncate text-sm">{b.file_name}</TableCell>
                        <TableCell className="text-center">{b.total_rows}</TableCell>
                        <TableCell className="text-center text-green-600 font-medium">{b.success_rows}</TableCell>
                        <TableCell className="text-center text-destructive font-medium">{b.failed_rows}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={statusColors[b.batch_status] ?? ""}>{fmt(b.batch_status)}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(b.uploaded_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{b.processed_at ? new Date(b.processed_at).toLocaleDateString() : "—"}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={(e) => { e.stopPropagation(); setSelectedBatchId(b.id); setActiveTab("detail"); }}>
                            <Eye className="mr-1 h-3 w-3" /> View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== BATCH DETAIL TAB ===== */}
        <TabsContent value="detail">
          {selectedBatchId && (() => {
            const batch = batches.find((b) => b.id === selectedBatchId);
            const errorCount = batchRows.filter((r) => r.validation_status !== "success").length;
            const dupCount = batchRows.filter((r) => r.validation_status === "duplicate").length;
            const failCount = batchRows.filter((r) => r.validation_status === "failed").length;
            const successCount = batchRows.filter((r) => r.validation_status === "success").length;
            return (
              <div className="space-y-4">
                <Button variant="ghost" size="sm" onClick={() => { setSelectedBatchId(null); setActiveTab("history"); }}>
                  <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back to History
                </Button>

                {batch && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Batch {batch.batch_id ?? "—"}</CardTitle>
                      <CardDescription>
                        {batch.file_name} • Uploaded {new Date(batch.uploaded_at).toLocaleString()}
                        {batch.processed_at && ` • Processed ${new Date(batch.processed_at).toLocaleString()}`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
                        <div className="text-center p-2 rounded bg-muted/30">
                          <p className="text-lg font-bold">{batch.total_rows}</p><p className="text-xs text-muted-foreground">Total</p>
                        </div>
                        <div className="text-center p-2 rounded bg-green-50 dark:bg-green-900/20">
                          <p className="text-lg font-bold text-green-600">{batch.success_rows}</p><p className="text-xs text-muted-foreground">Success</p>
                        </div>
                        <div className="text-center p-2 rounded bg-destructive/5">
                          <p className="text-lg font-bold text-destructive">{failCount || batch.failed_rows}</p><p className="text-xs text-muted-foreground">Failed</p>
                        </div>
                        <div className="text-center p-2 rounded bg-yellow-50 dark:bg-yellow-900/20">
                          <p className="text-lg font-bold text-yellow-600">{dupCount}</p><p className="text-xs text-muted-foreground">Duplicates</p>
                        </div>
                        <div className="text-center p-2 rounded bg-muted/30">
                          <Badge variant="secondary" className={statusColors[batch.batch_status] ?? ""}>{fmt(batch.batch_status)}</Badge>
                        </div>
                      </div>

                      {/* Batch detail actions */}
                      <div className="flex flex-wrap gap-2">
                        {batch.success_rows > 0 && (
                          <Button size="sm" variant="outline" onClick={() => navigate("/leads")}>
                            <FileText className="mr-1 h-3.5 w-3.5" /> View Created Leads
                          </Button>
                        )}
                        {errorCount > 0 && (
                          <Button variant="outline" size="sm" onClick={() => downloadBatchErrorReport(batch.batch_id ?? batch.id)}>
                            <Download className="mr-1 h-3.5 w-3.5" /> Download Error Report
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => { resetUpload(); setActiveTab("upload"); }}>
                          <Upload className="mr-1 h-3.5 w-3.5" /> Upload Corrected File
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
                          <Home className="mr-1 h-3.5 w-3.5" /> Dashboard
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Row results from persisted data */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Row Results</CardTitle>
                      {batchRows.length > 0 && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-green-600" /> {successCount}</span>
                          <span className="flex items-center gap-1"><XCircle className="h-3 w-3 text-destructive" /> {failCount}</span>
                          <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-yellow-600" /> {dupCount}</span>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {renderBatchRowsTable()}
                  </CardContent>
                </Card>
              </div>
            );
          })()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
