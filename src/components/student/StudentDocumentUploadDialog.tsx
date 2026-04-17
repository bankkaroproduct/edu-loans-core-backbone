import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, Upload, CheckCircle2, Loader2, FileText, X, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Requirement {
  id: string;
  document_type_id: string;
  document_name: string;
  student_status_label: string;
  remark: string | null;
}

interface Props {
  requirement: Requirement;
  leadId: string;
  phone: string;
  onClose: () => void;
  onSuccess: () => void;
}

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
const MAX_SIZE = 10 * 1024 * 1024;

export function StudentDocumentUploadDialog({ requirement, leadId, phone, onClose, onSuccess }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [softBlock, setSoftBlock] = useState<{ uploadedDocId: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const isReupload = requirement.student_status_label === "Action Needed";

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!ALLOWED_TYPES.includes(f.type)) {
      toast({ title: "Invalid file type", description: "Please upload a PDF, JPG, or PNG file.", variant: "destructive" });
      return;
    }
    if (f.size > MAX_SIZE) {
      toast({ title: "File too large", description: "Maximum file size is 10MB.", variant: "destructive" });
      return;
    }
    setFile(f);
  };

  const finishSuccessfully = () => {
    setSuccess(true);
    toast({ title: "Document uploaded", description: `${requirement.document_name} uploaded successfully.` });
    setTimeout(() => onSuccess(), 1200);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("phone", phone);
      formData.append("lead_id", leadId);
      formData.append("requirement_id", requirement.id);
      formData.append("file", file);

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const url = `https://${projectId}.supabase.co/functions/v1/student-application`;

      const response = await fetch(url, {
        method: "POST",
        body: formData,
        headers: { "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      });

      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result.error || "Upload failed");

      if (result.soft_block && result.lead_document_id) {
        setSoftBlock({ uploadedDocId: result.lead_document_id });
        setUploading(false);
        return;
      }
      finishSuccessfully();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleOverride = async () => {
    // Just proceed — the validation_result is already on the row; admin can see the flag
    finishSuccessfully();
  };

  const handleReplace = async () => {
    // The student-application function already inserted the doc — best-effort: keep it
    // but reset the local UI so they can pick again. The replacement upload will create
    // a new version which becomes is_latest. Leaving the soft-block file recorded is fine
    // as it's flagged for admin.
    setSoftBlock(null);
    setFile(null);
  };

  return (
    <Dialog open onOpenChange={() => !uploading && !softBlock && onClose()}>
      <DialogContent className="sm:max-w-md">
        {softBlock ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-700">
                <AlertTriangle className="h-5 w-5" /> This may not be a {requirement.document_name}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground py-2">
              The file you uploaded doesn't appear to match a {requirement.document_name}. If this is the correct document, you can keep it — our team will review it.
            </p>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleReplace}>Upload a different file</Button>
              <Button onClick={handleOverride}>Keep this file</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{isReupload ? "Re-upload" : "Upload"} Document</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="rounded-lg border bg-muted/50 p-3">
                <p className="text-sm font-medium text-foreground">{requirement.document_name}</p>
                {isReupload && requirement.remark && (
                  <div className="mt-2 flex items-start gap-2 rounded-md bg-red-50 px-3 py-2">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
                    <p className="text-xs text-red-700">{requirement.remark}</p>
                  </div>
                )}
              </div>

              {success && (
                <div className="flex flex-col items-center gap-2 py-4">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                  <p className="text-sm font-medium text-emerald-700">Uploaded successfully!</p>
                </div>
              )}

              {!success && (
                <>
                  <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleFileSelect} />
                  {!file ? (
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 p-8 transition-colors hover:border-primary/50 hover:bg-primary/5"
                    >
                      <Upload className="h-8 w-8 text-muted-foreground/50" />
                      <p className="text-sm font-medium text-muted-foreground">Click to select file</p>
                      <p className="text-[11px] text-muted-foreground/70">PDF, JPG, or PNG · Max 10MB</p>
                    </button>
                  ) : (
                    <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
                      <FileText className="h-8 w-8 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                        <p className="text-[11px] text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                      </div>
                      <button onClick={() => setFile(null)} className="text-muted-foreground hover:text-destructive">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  {uploading && (
                    <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin" /> Uploading and checking…
                    </p>
                  )}
                </>
              )}
            </div>

            {!success && (
              <DialogFooter>
                <Button variant="outline" onClick={onClose} disabled={uploading}>Cancel</Button>
                <Button onClick={handleUpload} disabled={!file || uploading} className="gap-1.5">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? "Uploading…" : "Upload"}
                </Button>
              </DialogFooter>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
