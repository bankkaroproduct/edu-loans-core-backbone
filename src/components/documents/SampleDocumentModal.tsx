/**
 * View Sample modal — purely presentational guidance overlay.
 * Shows a dummy sample image, instructions, and a checklist of fields the
 * user should be able to locate on their real document.
 *
 * This component does NOT touch upload, validation, OCR, status, or storage.
 */
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CheckCircle2, ExternalLink } from "lucide-react";
import type { DocumentSample } from "@/lib/documentSamples";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sample: DocumentSample | null;
}

export function SampleDocumentModal({ open, onOpenChange, sample }: Props) {
  if (!sample) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">{sample.document_name}</DialogTitle>
          <DialogDescription className="text-xs">
            Sample for guidance only — do not upload this image.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative rounded-md border bg-muted/30 overflow-hidden">
            <img
              src={sample.image_url}
              alt={`${sample.document_name} sample`}
              className="w-full max-h-[60vh] object-contain bg-white"
              loading="lazy"
            />
            <a
              href={sample.image_url}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-md bg-background/90 border px-2 py-1 text-[11px] text-foreground hover:bg-background"
            >
              <ExternalLink className="h-3 w-3" /> Open larger
            </a>
          </div>

          {sample.sample_instruction && (
            <p className="text-sm text-muted-foreground">{sample.sample_instruction}</p>
          )}

          {sample.important_visible_fields?.length > 0 && (
            <div className="rounded-md border p-3 bg-muted/20">
              <p className="text-sm font-medium mb-2">
                What you should see on your real document:
              </p>
              <ul className="space-y-1.5">
                {sample.important_visible_fields.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground italic">
            This is a dummy reference image. It is not used for OCR, verification, or approval.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
