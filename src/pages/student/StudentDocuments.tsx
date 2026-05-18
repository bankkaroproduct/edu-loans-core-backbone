import { useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { StudentHeader } from "@/components/student/StudentHeader";
import { StudentFooter } from "@/components/student/StudentFooter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useStudentAuth } from "@/hooks/useStudentAuth";
import { supabase } from "@/integrations/supabase/client";
import { StudentDocumentUploadDialog } from "@/components/student/StudentDocumentUploadDialog";
import { SampleDocumentModal } from "@/components/documents/SampleDocumentModal";
import { findSampleForDocument, getHelperText, type DocumentSample } from "@/lib/documentSamples";
import { isRequirementApplicable } from "@/lib/documentApplicability";
import type { LeadDocRequirement } from "@/hooks/useLeadDocumentsData";
import {
  CheckCircle2, AlertTriangle, Upload, Eye, RefreshCw, FileText, Clock,
  Shield, Compass, HeartHandshake, HelpCircle, Loader2, AlertCircle, Info,
  ArrowLeft, ArrowRight, PartyPopper, ImageIcon
} from "lucide-react";

interface DocumentRequirement {
  id: string;
  document_type_id: string;
  document_name: string;
  document_code?: string | null;
  document_category: string | null;
  applicable_for?: string | null;
  description: string | null;
  required: boolean;
  status: string;
  student_status_label: string;
  remark: string | null;
  due_date: string | null;
  uploaded_file: {
    file_name: string;
    uploaded_at: string;
    version_number: number;
  } | null;
}

interface DocCounts {
  total: number;
  pending: number;
  uploaded: number;
  under_review: number;
  verified: number;
  action_needed: number;
  not_required: number;
}

interface LeadSummary {
  id: string;
  lead_id: string | null;
  current_stage: string;
  updated_at: string;
  student_full_name?: string | null;
  coapplicant_name?: string | null;
  highest_qualification?: string | null;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: any }> = {
  "Pending Upload": { color: "text-muted-foreground", bg: "bg-muted", icon: Upload },
  "Uploaded": { color: "text-blue-700", bg: "bg-blue-100", icon: FileText },
  "Being Reviewed": { color: "text-amber-700", bg: "bg-amber-100", icon: Clock },
  "Verified": { color: "text-emerald-700", bg: "bg-emerald-100", icon: CheckCircle2 },
  "Action Needed": { color: "text-red-700", bg: "bg-red-100", icon: AlertCircle },
  "Not Required": { color: "text-muted-foreground", bg: "bg-muted", icon: Info },
};

export default function StudentDocuments() {
  const navigate = useNavigate();
  const { isVerified, phone, leads } = useStudentAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [requirements, setRequirements] = useState<DocumentRequirement[]>([]);
  const [counts, setCounts] = useState<DocCounts>({ total: 0, pending: 0, uploaded: 0, under_review: 0, verified: 0, action_needed: 0, not_required: 0 });
  const [leadSummary, setLeadSummary] = useState<LeadSummary | null>(null);
  const [uploadTarget, setUploadTarget] = useState<DocumentRequirement | null>(null);
  const [sampleOpen, setSampleOpen] = useState<DocumentSample | null>(null);

  useEffect(() => {
    if (!isVerified) { navigate("/student/login"); return; }
    loadDocuments();
  }, [isVerified]);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(false);
    console.log("[student.documents.viewed]");
    try {
      const activeLead = leads[0];
      const { data, error: fnErr } = await supabase.functions.invoke("student-application", {
        body: { action: "load_documents", phone, lead_id: activeLead?.id },
      });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      setRequirements(data.requirements || []);
      setCounts(data.counts || { total: 0, pending: 0, uploaded: 0, under_review: 0, verified: 0, action_needed: 0, not_required: 0 });
      setLeadSummary(data.lead_summary);
    } catch (err) {
      console.error("Load documents error:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [phone, leads]);

  const handleUploadComplete = () => {
    setUploadTarget(null);
    loadDocuments();
  };

  if (!isVerified) return null;

  // Smart academic applicability — hide non-applicable academic docs from the
  // student view and recompute readiness counts from the filtered list so
  // hidden docs never appear as "missing".
  const applicableRequirements = requirements.filter((r) => {
    const adapted = {
      document_master: {
        document_code: r.document_code ?? null,
        display_name: null,
        document_name: r.document_name,
      },
    } as unknown as LeadDocRequirement;
    return isRequirementApplicable(adapted, leadSummary?.highest_qualification ?? null);
  });
  const hiddenAcademicCount = requirements.length - applicableRequirements.length;

  const effectiveCounts: DocCounts = {
    total: applicableRequirements.length,
    pending: applicableRequirements.filter((r) => r.status === "not_uploaded").length,
    uploaded: applicableRequirements.filter((r) => r.status === "uploaded").length,
    under_review: applicableRequirements.filter((r) => r.status === "under_review").length,
    verified: applicableRequirements.filter((r) => r.status === "verified").length,
    action_needed: applicableRequirements.filter((r) => ["rejected", "reupload_needed"].includes(r.status)).length,
    not_required: applicableRequirements.filter((r) => ["waived", "not_applicable"].includes(r.status)).length,
  };

  const allComplete = effectiveCounts.total > 0 && effectiveCounts.verified >= effectiveCounts.total - effectiveCounts.not_required && effectiveCounts.action_needed === 0 && effectiveCounts.pending === 0;

  // Readiness banner config
  const getReadinessBanner = () => {
    if (effectiveCounts.total === 0) return { type: "empty", icon: Info, color: "border-muted bg-muted/30", textColor: "text-muted-foreground", message: "No documents have been assigned yet — check back soon." };
    if (effectiveCounts.action_needed > 0) return { type: "action", icon: AlertCircle, color: "border-red-200 bg-red-50/60", textColor: "text-red-800", message: `${effectiveCounts.action_needed} document${effectiveCounts.action_needed > 1 ? "s" : ""} need${effectiveCounts.action_needed === 1 ? "s" : ""} re-upload before your case can proceed.` };
    if (effectiveCounts.pending > 0) return { type: "pending", icon: Upload, color: "border-amber-200 bg-amber-50/60", textColor: "text-amber-800", message: `${effectiveCounts.pending} required document${effectiveCounts.pending > 1 ? "s" : ""} still need${effectiveCounts.pending === 1 ? "s" : ""} upload.` };
    if (allComplete) return { type: "complete", icon: CheckCircle2, color: "border-emerald-200 bg-emerald-50/60", textColor: "text-emerald-800", message: "All required documents are complete!" };
    if (effectiveCounts.under_review > 0 || effectiveCounts.uploaded > 0) return { type: "review", icon: Clock, color: "border-blue-200 bg-blue-50/60", textColor: "text-blue-800", message: "All documents uploaded — under review." };
    return { type: "review", icon: Clock, color: "border-blue-200 bg-blue-50/60", textColor: "text-blue-800", message: "Documents are being processed." };
  };

  const banner = getReadinessBanner();

  // Sort: action needed first, then pending, then uploaded/review, then verified, then not required
  const sortedRequirements = [...applicableRequirements].sort((a, b) => {
    const priority: Record<string, number> = { "Action Needed": 0, "Pending Upload": 1, "Uploaded": 2, "Being Reviewed": 3, "Verified": 4, "Not Required": 5 };
    return (priority[a.student_status_label] ?? 9) - (priority[b.student_status_label] ?? 9);
  });

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-primary/[0.02] via-background to-primary/[0.04]">
      <StudentHeader />
      <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-3xl">

          {/* Back to tracker */}
          <button onClick={() => navigate("/student/tracker")} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Tracker
          </button>

          {/* Header */}
          <div className="mb-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Document Center</h1>
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">Upload and track the documents required for your loan application.</p>
          </div>

          {/* Case context */}
          {leadSummary && (
            <div className="mb-5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {leadSummary.lead_id && <span>Case: <strong className="text-foreground">{leadSummary.lead_id}</strong></span>}
              <span>· Last updated: {new Date(leadSummary.updated_at).toLocaleDateString()}</span>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <Card className="py-16 text-center">
              <CardContent>
                <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Loading your documents…</p>
              </CardContent>
            </Card>
          )}

          {/* Error */}
          {error && !loading && (
            <Card className="py-12 text-center">
              <CardContent>
                <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-destructive" />
                <h2 className="text-lg font-semibold">Something went wrong</h2>
                <p className="mt-1 text-sm text-muted-foreground">We couldn't load your documents right now.</p>
                <Button variant="outline" className="mt-4" onClick={loadDocuments}><RefreshCw className="mr-1 h-4 w-4" /> Try Again</Button>
                <p className="mt-3 text-xs text-muted-foreground">If this persists, contact <a href="mailto:support@eduloans.com" className="text-primary underline">support@eduloans.com</a></p>
              </CardContent>
            </Card>
          )}

          {/* Content */}
          {!loading && !error && (
            <>
              {/* Readiness Banner */}
              <div className={`mb-5 flex items-start gap-2.5 rounded-lg border px-4 py-3 ${banner.color}`}>
                <banner.icon className={`mt-0.5 h-4 w-4 shrink-0 ${banner.textColor}`} />
                <p className={`text-sm font-medium ${banner.textColor}`}>{banner.message}</p>
              </div>

              {/* Summary Strip */}
              {effectiveCounts.total > 0 && (
                <div className="mb-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {[
                    { label: "Total", value: effectiveCounts.total, color: "text-foreground" },
                    { label: "Pending", value: effectiveCounts.pending, color: "text-muted-foreground" },
                    { label: "Uploaded", value: effectiveCounts.uploaded, color: "text-blue-600" },
                    { label: "Reviewing", value: effectiveCounts.under_review, color: "text-amber-600" },
                    { label: "Verified", value: effectiveCounts.verified, color: "text-emerald-600" },
                    { label: "Action", value: effectiveCounts.action_needed, color: effectiveCounts.action_needed > 0 ? "text-red-600" : "text-muted-foreground" },
                  ].map(c => (
                    <div key={c.label} className="rounded-lg border bg-card px-3 py-2 text-center">
                      <p className={`text-lg font-bold ${c.color}`}>{c.value}</p>
                      <p className="text-[10px] text-muted-foreground">{c.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {hiddenAcademicCount > 0 && (
                <p className="mb-3 text-[11px] italic text-muted-foreground">
                  Some academic documents are not applicable based on your highest qualification and have been hidden.
                </p>
              )}

              {/* Document Checklist */}
              <div className="mb-6 space-y-3">
                {sortedRequirements.map(req => {
                  const config = STATUS_CONFIG[req.student_status_label] || STATUS_CONFIG["Pending Upload"];
                  const isActionNeeded = req.student_status_label === "Action Needed";
                  const isPending = req.student_status_label === "Pending Upload";
                  const isVerifiedDoc = req.student_status_label === "Verified";
                  const StatusIcon = config.icon;
                  const helperText = getHelperText(req.document_name);
                  const sample = findSampleForDocument(req.document_name);

                  return (
                    <Card key={req.id} className={`overflow-hidden transition-shadow hover:shadow-sm ${isActionNeeded ? "border-red-200" : ""}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-semibold text-foreground">{req.document_name}</h3>
                              {req.required ? (
                                <Badge variant="outline" className="text-[10px]">Required</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] text-muted-foreground">Optional</Badge>
                              )}
                            </div>

                            {(helperText || sample) && (
                              <div className="mt-1 flex flex-wrap items-start gap-1.5 text-xs text-muted-foreground">
                                {helperText && <span className="leading-snug">{helperText}</span>}
                                {sample && (
                                  <button
                                    type="button"
                                    onClick={() => setSampleOpen(sample)}
                                    className="inline-flex shrink-0 items-center gap-1 text-primary hover:underline"
                                  >
                                    <ImageIcon className="h-3 w-3" /> View Sample
                                  </button>
                                )}
                              </div>
                            )}

                            <div className="mt-1.5 flex items-center gap-1.5">
                              <StatusIcon className={`h-3.5 w-3.5 ${config.color}`} />
                              <span className={`text-xs font-medium ${config.color}`}>{req.student_status_label}</span>
                            </div>

                            {/* Uploaded file info */}
                            {req.uploaded_file && (
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                {req.uploaded_file.file_name} · v{req.uploaded_file.version_number} · {new Date(req.uploaded_file.uploaded_at).toLocaleDateString()}
                              </p>
                            )}

                            {/* Remark / guidance for action-needed */}
                            {isActionNeeded && req.remark && (
                              <div className="mt-2 rounded-md bg-red-50 px-3 py-2">
                                <p className="text-xs font-medium text-red-800">What we need:</p>
                                <p className="text-xs text-red-700">{req.remark}</p>
                              </div>
                            )}

                            {/* Helper for pending */}
                            {isPending && req.required && (
                              <p className="mt-1.5 text-[11px] text-muted-foreground">
                                Please ensure the document is clear, complete, and matches your application details.
                              </p>
                            )}
                          </div>

                          <div className="shrink-0">
                            {(isPending || isActionNeeded) && (
                              <Button
                                size="sm"
                                variant={isActionNeeded ? "default" : "outline"}
                                className="gap-1 text-xs"
                                onClick={() => {
                                  console.log(isActionNeeded ? "[student.document.reupload_initiated]" : "[student.document.upload_started]", { doc: req.document_name });
                                  setUploadTarget(req);
                                }}
                              >
                                <Upload className="h-3 w-3" />
                                {isActionNeeded ? "Re-upload" : "Upload"}
                              </Button>
                            )}
                            {isVerifiedDoc && (
                              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                                <CheckCircle2 className="mr-1 h-3 w-3" /> Done
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {requirements.length === 0 && (
                  <Card className="py-10 text-center">
                    <CardContent>
                      <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
                      <p className="text-sm font-medium text-muted-foreground">No document requirements assigned yet</p>
                      <p className="mt-1 text-xs text-muted-foreground">Requirements will appear as your application is reviewed. Check back in a day or two.</p>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Readiness Guidance */}
              {effectiveCounts.total > 0 && (
                <Card className="mb-6 border-primary/20 bg-primary/5">
                  <CardContent className="p-4 text-center">
                    {allComplete ? (
                      <div className="flex flex-col items-center gap-2">
                        <PartyPopper className="h-6 w-6 text-emerald-500" />
                        <p className="text-sm font-medium text-foreground">All documents are complete — your application is progressing!</p>
                        <Button size="sm" variant="outline" className="mt-1 gap-1.5" onClick={() => navigate("/student/tracker")}>
                          View Tracker <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : counts.action_needed > 0 || counts.pending > 0 ? (
                      <p className="text-sm text-foreground">
                        <strong>Upload your pending documents</strong> so your case can move to the next stage.
                      </p>
                    ) : (
                      <p className="text-sm text-foreground">
                        Once your uploads are reviewed, your case will continue. No action needed right now.
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Trust strip */}
              <div className="mb-6 grid gap-3 sm:grid-cols-3">
                {[
                  { icon: Compass, title: "Guided Support", desc: "Expert guidance through every step" },
                  { icon: Shield, title: "Secure Uploads", desc: "Your documents are encrypted and protected" },
                  { icon: HeartHandshake, title: "Dedicated Handling", desc: "Your application gets personal attention" },
                ].map(c => (
                  <div key={c.title} className="rounded-xl border bg-card p-3 text-center shadow-sm sm:p-4">
                    <c.icon className="mx-auto mb-1.5 h-5 w-5 text-primary" />
                    <h3 className="text-xs font-semibold text-foreground">{c.title}</h3>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{c.desc}</p>
                  </div>
                ))}
              </div>

              {/* Support CTA */}
              <div className="mb-4 text-center">
                <a
                  href="mailto:support@eduloans.com"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  onClick={() => console.log("[student.support.clicked]", { page: "documents" })}
                >
                  <HelpCircle className="h-4 w-4" /> Not sure which document to upload?
                </a>
              </div>
            </>
          )}
        </div>
      </main>
      <StudentFooter />

      {/* Upload Dialog */}
      {uploadTarget && leadSummary && (
        <StudentDocumentUploadDialog
          requirement={uploadTarget}
          leadId={leadSummary.id}
          phone={phone!}
          expectedSubject={uploadTarget.applicable_for === "coapplicant" ? "coapplicant" : "student"}
          expectedName={
            uploadTarget.applicable_for === "coapplicant"
              ? leadSummary.coapplicant_name ?? null
              : leadSummary.student_full_name ?? null
          }
          onClose={() => setUploadTarget(null)}
          onSuccess={handleUploadComplete}
        />
      )}
      <SampleDocumentModal
        open={!!sampleOpen}
        onOpenChange={(open) => !open && setSampleOpen(null)}
        sample={sampleOpen}
      />
    </div>
  );
}
