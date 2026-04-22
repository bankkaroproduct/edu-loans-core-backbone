import { Button } from "@/components/ui/button";
import { Copy, Download, Save } from "lucide-react";

interface Props {
  onCopy: () => void;
  onDownloadPdf: () => void;
  onSave: () => void;
  canSave: boolean;
}

export function SimulationActionsBar({ onCopy, onDownloadPdf, onSave, canSave }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={onCopy} variant="outline" size="sm">
        <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy result
      </Button>
      <Button onClick={onDownloadPdf} variant="outline" size="sm">
        <Download className="mr-1.5 h-3.5 w-3.5" /> Download PDF
      </Button>
      {canSave && (
        <Button onClick={onSave} size="sm">
          <Save className="mr-1.5 h-3.5 w-3.5" /> Save scenario
        </Button>
      )}
    </div>
  );
}
