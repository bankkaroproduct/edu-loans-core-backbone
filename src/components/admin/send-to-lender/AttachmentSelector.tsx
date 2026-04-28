import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Paperclip, FileText } from "lucide-react";
import type { LeadDocFile } from "@/lib/sendToLender/buildDraft";

interface Props {
  documents: LeadDocFile[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}

const STATUS_BADGE: Record<string, string> = {
  verified: "bg-emerald-100 text-emerald-900 border-emerald-300",
  uploaded: "bg-blue-100 text-blue-900 border-blue-300",
  rejected: "bg-red-100 text-red-900 border-red-300",
  reupload_needed: "bg-amber-100 text-amber-900 border-amber-300",
  not_uploaded: "bg-muted text-muted-foreground",
};

export function AttachmentSelector({ documents, selectedIds, onToggle }: Props) {
  const latest = documents.filter((d) => d.is_latest);

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Paperclip className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Attachments</h3>
        <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
          {selectedIds.size} of {latest.length} selected
        </span>
      </div>

      {latest.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">
          No documents uploaded for this lead yet.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {latest.map((d) => {
            const checked = selectedIds.has(d.id);
            const docName = d.document_master?.document_name ?? d.file_name;
            return (
              <li
                key={d.id}
                className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted/50 cursor-pointer"
                onClick={() => onToggle(d.id)}
              >
                <Checkbox checked={checked} onCheckedChange={() => onToggle(d.id)} />
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{docName}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{d.file_name}</p>
                </div>
                <Badge
                  variant="outline"
                  className={`text-[9px] h-5 ${STATUS_BADGE[d.verification_status] ?? ""}`}
                >
                  {d.verification_status}
                </Badge>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-[11px] text-muted-foreground mt-3">
        Verified and uploaded documents are pre-selected. Rejected / re-upload-needed documents
        are listed but not auto-included.
      </p>
    </Card>
  );
}
