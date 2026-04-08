import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Download, FileText, ArrowLeft, CheckCircle, XCircle, AlertTriangle, RefreshCw, Eye, History, Info } from "lucide-react";
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
  success: { icon: CheckCircle, className: "text-green-600", label: "Success" },
  failed: { icon: XCircle, className: "text-destructive", label: "Failed" },
  duplicate: { icon: AlertTriangle, className: "text-yellow-600", label: "Duplicate" },
};

const fmt = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default function BulkUpload() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { appUser } = useAuth();
  const { agentUserId } = useRoleAccess();

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

  const downloadErrorReport = () => {
    const csv = generateErrorReportCSV(results);
    if (!csv) { toast.info("No failed or duplicate rows to download"); return; }
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `error_report_${summary?.batchId ?? "batch"}.csv`;
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
    idle: "", parsing: "Reading and parsing file…", validating: "Validating rows against master data…",
    processing: `Creating leads… ${progress.current}/${progress.total}`, completed: "Upload complete", error: "Processing failed",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
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
          {/* Instructions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Info className="h-4 w-4" /> Upload Guidelines</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-1">
              <p>• Download the CSV template and fill in student lead data.</p>
              <p>• <strong>Required columns:</strong> student_first_name, student_last_name, student_phone, intended_study_country, intake_term, intake_year, course_name, loan_amount_required</p>
              <p>• <strong>Optional columns:</strong> student_email, student_whatsapp, city, state, country_of_residence, university_name, coapplicant_name, coapplicant_relation, coapplicant_income, collateral_available, collateral_notes, source_sub_type, partner_remark</p>
              <p>• Maximum 1,000 rows per batch. File size limit: 5 MB.</p>
              <p>• Duplicate leads (matching phone, email, or name+intake) will be flagged and not created.</p>
              <p>• Use exact header names from the template. <strong>collateral_available</strong> accepts yes/no. <strong>intake_year</strong> must be a number (e.g. 2025).</p>
            </CardContent>
          </Card>

          {/* Upload Zone */}
          {stage !== "completed" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Upload CSV File</CardTitle>
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
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">{stageMessages[stage]}</p>
                        <Progress value={stage === "processing" ? progressPct : undefined} className="h-2" />
                      </div>
                    )}

                    {stage === "error" && processingError && (
                      <div className="p-3 border border-destructive/30 rounded-lg bg-destructive/5">
                        <p className="text-sm text-destructive font-medium">Error: {processingError}</p>
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

          {/* Results Summary */}
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
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
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

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => navigate("/leads")}>View Created Leads</Button>
                    {(summary.failed > 0 || summary.duplicates > 0) && (
                      <Button variant="outline" size="sm" onClick={downloadErrorReport}>
                        <Download className="mr-1 h-3.5 w-3.5" /> Download Error Report
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={resetUpload}>
                      <Upload className="mr-1 h-3.5 w-3.5" /> Upload Another File
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => navigate("/")}>Return to Dashboard</Button>
                  </div>
                </CardContent>
              </Card>

              {/* Row Results Table */}
              {results.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Row-Level Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[400px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">Row</TableHead>
                            <TableHead>Student</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Details</TableHead>
                            <TableHead className="w-24">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {results.map((r) => {
                            const cfg = rowStatusConfig[r.status];
                            const Icon = cfg.icon;
                            return (
                              <TableRow key={r.rowNumber}>
                                <TableCell className="font-mono text-xs">{r.rowNumber}</TableCell>
                                <TableCell className="text-sm">{r.raw.student_first_name} {r.raw.student_last_name}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{r.raw.student_phone}</TableCell>
                                <TableCell>
                                  <Badge variant="secondary" className={`${cfg.className} gap-1`}>
                                    <Icon className="h-3 w-3" /> {cfg.label}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground max-w-[250px] truncate">{r.reason}</TableCell>
                                <TableCell>
                                  {r.status === "success" && r.createdLeadId && (
                                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate(`/leads/${r.createdLeadId}`)}>
                                      Open Lead
                                    </Button>
                                  )}
                                  {r.status === "duplicate" && r.matchedLeadId && (
                                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate(`/leads/${r.matchedLeadId}`)}>
                                      View Existing
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
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
            </CardHeader>
            <CardContent>
              {batchesLoading ? (
                <p className="text-center py-8 text-muted-foreground">Loading...</p>
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
            return (
              <div className="space-y-4">
                <Button variant="ghost" size="sm" onClick={() => { setSelectedBatchId(null); setActiveTab("history"); }}>
                  <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back to History
                </Button>

                {batch && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Batch {batch.batch_id ?? "—"}</CardTitle>
                      <CardDescription>{batch.file_name} • Uploaded {new Date(batch.uploaded_at).toLocaleString()}</CardDescription>
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
                          <p className="text-lg font-bold text-destructive">{batch.failed_rows}</p><p className="text-xs text-muted-foreground">Failed/Dup</p>
                        </div>
                        <div className="text-center p-2 rounded bg-muted/30">
                          <Badge variant="secondary" className={statusColors[batch.batch_status] ?? ""}>{fmt(batch.batch_status)}</Badge>
                        </div>
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="outline" size="sm" onClick={() => setActiveTab("upload")}>
                            <Upload className="mr-1 h-3 w-3" /> Re-upload
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Row Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {batchRowsLoading ? (
                      <p className="text-center py-8 text-muted-foreground">Loading rows...</p>
                    ) : batchRows.length === 0 ? (
                      <p className="text-center py-8 text-muted-foreground">No row results found for this batch.</p>
                    ) : (
                      <div className="max-h-[500px] overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-16">Row</TableHead>
                              <TableHead>Student</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Reason</TableHead>
                              <TableHead>Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {batchRows.map((r: any) => {
                              const payload = r.raw_payload as Record<string, string> | null;
                              const name = payload ? `${payload.student_first_name ?? ""} ${payload.student_last_name ?? ""}`.trim() : "—";
                              const vs = r.validation_status as string;
                              const cfg = rowStatusConfig[vs as keyof typeof rowStatusConfig] ?? rowStatusConfig.failed;
                              const Icon = cfg.icon;
                              return (
                                <TableRow key={r.id}>
                                  <TableCell className="font-mono text-xs">{r.row_number}</TableCell>
                                  <TableCell className="text-sm">{name}</TableCell>
                                  <TableCell>
                                    <Badge variant="secondary" className={`${cfg.className} gap-1`}>
                                      <Icon className="h-3 w-3" /> {fmt(vs)}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground max-w-[250px] truncate">{r.failure_reason ?? "—"}</TableCell>
                                  <TableCell>
                                    {r.created_lead_id && vs === "success" && (
                                      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate(`/leads/${r.created_lead_id}`)}>Open Lead</Button>
                                    )}
                                    {r.created_lead_id && vs === "duplicate" && (
                                      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate(`/leads/${r.created_lead_id}`)}>View Existing</Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
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
