import { useState, useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, AlertTriangle, CheckCircle, X, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { DocRequirement } from "@/pages/LeadDocuments";

const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
const ACCEPTED_EXTENSIONS = ".pdf,.jpg,.jpeg,.png";
const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requirement: DocRequirement;
  leadId: string;
  userId: string | null;
  onUploadComplete: () => void;
}

export function DocumentUploadDialog({ open, onOpenChange, requirement, leadId, userId, onUploadComplete }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isReupload = ["rejected", "reupload_needed"].includes(requirement.status);
  const docName = requirement.document_master?.document_name ?? "Document";

  const validateFile = (f: File): string | null => {
    if (!ACCEPTED_TYPES.includes(f.type)) {
      return `Unsupported file type. Accepted: PDF, JPG, PNG.`;
    }
    if (f.size > MAX_SIZE_BYTES) {
      return `File too large (${(f.size / 1024 / 1024).toFixed(1)} MB). Maximum ${MAX_SIZE_MB} MB.`;
    }
    if (f.size === 0) {
      return "File appears to be empty.";
    }
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

  const handleUpload = async () => {
    if (!file || !userId) return;
    setUploading(true);
    setProgress(20);
    setError(null);

    try {
      // Determine next version number
      const { count } = await supabase
        .from("lead_documents")
        .select("id", { count: "exact", head: true })
        .eq("lead_id", leadId)
        .eq("document_type_id", requirement.document_type_id);

      const nextVersion = (count ?? 0) + 1;
      const ext = file.name.split(".").pop() ?? "pdf";
      const storagePath = `${leadId}/${requirement.document_type_id}_v${nextVersion}.${ext}`;

      setProgress(40);

      // Mark previous versions as not latest
      if (nextVersion > 1) {
        await supabase
          .from("lead_documents")
          .update({ is_latest: false })
          .eq("lead_id", leadId)
          .eq("document_type_id", requirement.document_type_id);
      }

      setProgress(50);

      // Upload file to storage
      const { error: uploadErr } = await supabase.storage
        .from("lead-documents")
        .upload(storagePath, file, { upsert: false });

      if (uploadErr) throw uploadErr;

      setProgress(75);

      // Insert document record
      const { error: insertErr } = await supabase
        .from("lead_documents")
        .insert({
          lead_id: leadId,
          document_type_id: requirement.document_type_id,
          file_name: file.name,
          storage_path: storagePath,
          mime_type: file.type,
          uploaded_by_user_id: userId,
          version_number: nextVersion,
          is_latest: true,
          verification_status: "uploaded",
        });

      if (insertErr) throw insertErr;

      setProgress(90);

      // Update requirement status to uploaded
      await supabase
        .from("lead_document_requirements")
        .update({ status: "uploaded", remarks: null })
        .eq("id", requirement.id);

      setProgress(100);

      toast.success(`${docName} uploaded successfully (v${nextVersion})`);
      setFile(null);
      onUploadComplete();
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err.message ?? "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!uploading) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isReupload ? (
              <><AlertTriangle className="h-4 w-4 text-orange-600" /> Reupload {docName}</>
            ) : (
              <><Upload className="h-4 w-4 text-primary" /> Upload {docName}</>
            )}
          </DialogTitle>
          <DialogDescription>
            {isReupload
              ? "Upload a corrected version to replace the previous file."
              : "Upload the required document file."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Requirement context */}
          {requirement.document_master?.document_category && (
            <Badge variant="outline" className="text-xs">{requirement.document_master.document_category}</Badge>
          )}

          {/* Show previous rejection reason */}
          {isReupload && requirement.remarks && (
            <div className="flex items-start gap-2 rounded-md bg-orange-50 dark:bg-orange-950/30 p-3 text-sm">
              <Info className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-orange-800 dark:text-orange-300">Previous Issue</p>
                <p className="text-orange-700 dark:text-orange-400 text-xs mt-0.5">{requirement.remarks}</p>
              </div>
            </div>
          )}

          {/* File input */}
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              onChange={handleFileSelect}
              className="hidden"
            />
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium truncate max-w-[250px]">{file.name}</span>
                <span className="text-xs text-muted-foreground">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                <Button
                  variant="ghost" size="icon" className="h-5 w-5 ml-1"
                  onClick={(e) => { e.stopPropagation(); setFile(null); setError(null); }}
                >
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

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Progress */}
          {uploading && (
            <div className="space-y-1">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">Uploading...</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? "Uploading..." : isReupload ? "Reupload Document" : "Upload Document"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
