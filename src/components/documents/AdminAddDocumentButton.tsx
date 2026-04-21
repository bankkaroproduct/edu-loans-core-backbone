import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { DocRequirement } from "@/pages/LeadDocuments";

interface DocType {
  id: string;
  document_name: string;
  document_category: string | null;
  document_code: string | null;
  applicable_for: string | null;
  mandatory_flag: boolean;
}

interface Props {
  leadId: string;
  existingRequirements: DocRequirement[];
  onRequirementReady: (req: DocRequirement) => void;
}

/**
 * Admin-only entry point to upload a document on behalf of the lead even when
 * the chosen document type does not yet exist as a requirement. It lazily
 * inserts a `lead_document_requirements` row (admin RLS allows this) and then
 * delegates the actual upload to the same `DocumentUploadDialog` used by
 * partners — preserving OCR/validation/version/audit behaviour.
 */
export function AdminAddDocumentButton({ leadId, existingRequirements, onRequirementReady }: Props) {
  const [open, setOpen] = useState(false);
  const [docTypes, setDocTypes] = useState<DocType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    supabase
      .from("document_master")
      .select("id, document_name, document_category, document_code, applicable_for, mandatory_flag")
      .eq("active_flag", true)
      .order("document_category")
      .order("document_name")
      .then(({ data }) => {
        if (alive) setDocTypes((data ?? []) as DocType[]);
      });
    return () => { alive = false; };
  }, [open]);

  const handleProceed = async () => {
    if (!selectedTypeId) return;
    setBusy(true);

    // If a requirement already exists for this type, reuse it.
    const existing = existingRequirements.find((r) => r.document_type_id === selectedTypeId);
    if (existing) {
      setBusy(false);
      setOpen(false);
      setSelectedTypeId("");
      onRequirementReady(existing);
      return;
    }

    const docType = docTypes.find((d) => d.id === selectedTypeId);
    if (!docType) {
      setBusy(false);
      toast.error("Document type not found");
      return;
    }

    const { data, error } = await supabase
      .from("lead_document_requirements")
      .insert({
        lead_id: leadId,
        document_type_id: selectedTypeId,
        status: "not_uploaded",
        required_flag: docType.mandatory_flag,
      })
      .select("*")
      .single();

    setBusy(false);

    if (error || !data) {
      toast.error("Could not create document slot", { description: error?.message });
      return;
    }

    setOpen(false);
    setSelectedTypeId("");
    onRequirementReady({
      ...(data as any),
      document_master: {
        document_name: docType.document_name,
        document_category: docType.document_category,
        document_code: docType.document_code,
        applicable_for: docType.applicable_for,
      },
    } as DocRequirement);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Upload on Behalf
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!busy) setOpen(v); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Document on Behalf of Lead</DialogTitle>
            <DialogDescription>
              Select the document type you received from the student. It will be added to the lead's document checklist
              and run through the same validation pipeline.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-sm">Document type</Label>
            <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a document type…" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {docTypes.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.document_name}
                    {d.document_category ? ` · ${d.document_category}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={handleProceed} disabled={!selectedTypeId || busy}>
              {busy && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Continue to Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
