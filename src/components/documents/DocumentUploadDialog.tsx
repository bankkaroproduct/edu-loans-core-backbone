import { useState, useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, AlertTriangle, X, RotateCcw, Loader2, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { DocRequirement } from "@/pages/LeadDocuments";
import { getReferenceName, subjectForApplicableFor, type LeadNameFields } from "@/lib/referenceName";
import { displayDocName, softBlockMessage } from "@/lib/docCopy";

const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
const ACCEPTED_EXTENSIONS = ".pdf,.jpg,.jpeg,.png";
const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requirement: DocRequirement;
  leadId: string;
  lead?: LeadNameFields | null;
  applicableFor?: string | null;
  userId: string | null;
  userRole?: string | null;
  onUploadComplete: () => void;
  currentVersionCount?: number;
}

type UploadPhase = "idle" | "uploading" | "validating" | "soft_block" | "done";

export function DocumentUploadDialog({ open, onOpenChange, requirement, leadId, lead, applicableFor, userId, userRole, onUploadComplete, currentVersionCount = 0 }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [softBlockInfo, setSoftBlockInfo] = useState<{ docName: string; uploadedDocId: string; docCode: string | null } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploading = phase === "uploading" || phase === "validating";
  const isReupload = ["rejected", "reupload_needed"].includes(requirement.status);
  const docCode = (requirement as any).document_master?.document_code ?? null;
  const docName = displayDocName(docCode, requirement.document_master?.document_name ?? "Document");
  const subject = subjectForApplicableFor(applicableFor);
  const expectedName = getReferenceName(lead ?? null, subject);
  const nextVersion = currentVersionCount + 1;

  const validateFile = (f: File): string | null => {
    if (!ACCEPTED_TYPES.includes(f.type)) return `Unsupported file type. Accepted: PDF, JPG, PNG.`;
    if (f.size > MAX_SIZE_BYTES) return `File too large (${(f.size / 1024 / 1024).toFixed(1)} MB). Maximum ${MAX_SIZE_MB} MB.`;
    if (f.size === 0) return "File appears to be empty.";
    return null;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const selected = e.target.files?.[0];
    if (!selected) return;
    const validationError = validateFile(selected);
    if (validationError) {
      setError(validationError);
      setFile(null);
      return;
    }
    setFile(selected);
  };

  const finishSuccessfully = () => {
    toast.success(`${docName} uploaded successfully (v${nextVersion})`);
    setFile(null);
    setSoftBlockInfo(null);
    setPhase("idle");
    setProgress(0);
    onUploadComplete();
  };

  const handleUpload = async () => {
    if (!file || !userId) return;
    setPhase("uploading");
    setProgress(20);
    setError(null);

    try {
      const ext = file.name.split(".").pop() ?? "pdf";
      const storagePath = `${leadId}/${requirement.document_type_id}_v${nextVersion}.${ext}`;

      setProgress(40);

      if (nextVersion > 1) {
        await supabase
          .from("lead_documents")
          .update({ is_latest: false })
          .eq("lead_id", leadId)
          .eq("document_type_id", requirement.document_type_id);
      }

      setProgress(50);

      const { error: uploadErr } = await supabase.storage
        .from("lead-documents")
        .upload(storagePath, file, { upsert: false });
      if (uploadErr) throw uploadErr;

      setProgress(70);

      const { data: inserted, error: insertErr } = await supabase
        .from("lead_documents")
        .insert({
          lead_id: leadId,
          document_type_id: requirement.document_type_id,
          file_name: file.name,
          storage_path: storagePath,
          mime_type: file.type,
          uploaded_by_user_id: userId,
          uploaded_by_role: userRole as any ?? null,
          version_number: nextVersion,
          is_latest: true,
          verification_status: "uploaded",
        })
        .select("id")
        .single();

      if (insertErr || !inserted) throw insertErr ?? new Error("Insert failed");

      await supabase
        .from("lead_document_requirements")
        .update({ status: "uploaded", remarks: null })
        .eq("id", requirement.id);

      setProgress(85);
      setPhase("validating");

      // Call shared validator
      const { data: valData, error: valErr } = await supabase.functions.invoke("validate-document", {
        body: { lead_document_id: inserted.id },
      });

      setProgress(100);

      if (!valErr && valData?.soft_block) {
        setSoftBlockInfo({ docName, uploadedDocId: inserted.id, docCode });
        setPhase("soft_block");
        return;
      }

      finishSuccessfully();
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err.message ?? "Upload failed. Please try again.");
      setPhase("idle");
    }
  };

  const handleSoftBlockOverride = async () => {
    if (!softBlockInfo) return;
    // Record override on the validation_result for admin visibility
    const { data: row } = await supabase
      .from("lead_documents")
      .select("validation_result")
      .eq("id", softBlockInfo.uploadedDocId)
      .single();

    const existing = (row?.validation_result as any) ?? {};
    await supabase
      .from("lead_documents")
      .update({
        validation_result: {
          ...existing,
          override: {
            actor_user_id: userId,
            actor_role: userRole ?? null,
            overridden_at: new Date().toISOString(),
            reason: "User confirmed upload despite type mismatch",
          },
        },
      })
      .eq("id", softBlockInfo.uploadedDocId);

    finishSuccessfully();
  };

  const handleSoftBlockReplace = async () => {
    if (!softBlockInfo) return;
    // Delete the suspicious upload so the user can pick a different file
    await supabase.from("lead_documents").delete().eq("id", softBlockInfo.uploadedDocId);
    await supabase
      .from("lead_document_requirements")
      .update({ status: currentVersionCount > 0 ? "uploaded" : "not_uploaded" })
      .eq("id", requirement.id);
    setSoftBlockInfo(null);
    setFile(null);
    setPhase("idle");
    setProgress(0);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!uploading && phase !== "soft_block") onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        {phase === "soft_block" && softBlockInfo ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-5 w-5" /> This may not be a valid {softBlockInfo.docName}
              </DialogTitle>
              <DialogDescription>
                {softBlockMessage(softBlockInfo.docCode, softBlockInfo.docName)}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleSoftBlockReplace}>Choose different file</Button>
              <Button variant="default" onClick={handleSoftBlockOverride}>Upload anyway</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {isReupload ? (
                  <><RotateCcw className="h-4 w-4 text-orange-600" /> Reupload: {docName}</>
                ) : (
                  <><Upload className="h-4 w-4 text-primary" /> Upload: {docName}</>
                )}
              </DialogTitle>
              <DialogDescription>
                {isReupload ? "Upload a corrected version to replace the rejected file." : "Upload the required document file."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                {requirement.document_master?.document_category && (
                  <Badge variant="outline" className="text-xs">{requirement.document_master.document_category}</Badge>
                )}
                <Badge variant="secondary" className="text-xs">Will create v{nextVersion}</Badge>
                {requirement.required_flag && <Badge variant="secondary" className="text-xs">Required</Badge>}
              </div>

              {/* Expected name on document — drives the validator's name-consistency check */}
              <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-2.5 text-xs">
                <User className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-muted-foreground">
                    Expected name on document
                    {subject === "coapplicant" ? " (co-applicant)" : ""}:
                  </p>
                  {expectedName ? (
                    <p className="font-medium text-foreground truncate">{expectedName}</p>
                  ) : (
                    <p className="italic text-muted-foreground">Not set — please complete the {subject === "coapplicant" ? "co-applicant" : "student"} profile first.</p>
                  )}
                </div>
              </div>

              {isReupload && (
                <div className="rounded-md bg-orange-50 dark:bg-orange-950/30 p-3 text-sm border border-orange-200 dark:border-orange-800">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-orange-800 dark:text-orange-300">
                        {requirement.status === "rejected" ? "Rejection Reason" : "Reupload Reason"}
                      </p>
                      <p className="text-orange-700 dark:text-orange-400 text-xs mt-1">
                        {requirement.remarks || "No specific reason provided. Please upload a corrected version of this document."}
                      </p>
                      {currentVersionCount > 0 && (
                        <p className="text-orange-600 dark:text-orange-500 text-xs mt-1.5 font-medium">
                          Current version: v{currentVersionCount} → Uploading: v{nextVersion}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" accept={ACCEPTED_EXTENSIONS} onChange={handleFileSelect} className="hidden" />
                {file ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium truncate max-w-[250px]">{file.name}</span>
                    <span className="text-xs text-muted-foreground">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                    <Button variant="ghost" size="icon" className="h-5 w-5 ml-1"
                      onClick={(e) => { e.stopPropagation(); setFile(null); setError(null); }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Click to select a file</p>
                    <p className="text-xs text-muted-foreground">PDF, JPG, PNG · Max {MAX_SIZE_MB} MB</p>
                  </div>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {uploading && (
                <div className="space-y-1">
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
                    {phase === "validating" && <Loader2 className="h-3 w-3 animate-spin" />}
                    {phase === "validating" ? "Checking document…" : "Uploading…"}
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>Cancel</Button>
              <Button onClick={handleUpload} disabled={!file || uploading} variant={isReupload ? "destructive" : "default"}>
                {uploading ? (phase === "validating" ? "Checking…" : "Uploading…") : isReupload ? "Reupload Document" : "Upload Document"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
