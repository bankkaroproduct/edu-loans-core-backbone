/**
 * "How to get this document?" guidance modal — content-only overlay.
 *
 * Does NOT touch upload, status, verification, OCR, storage, or any backend
 * logic. Sources marked needs_verification are intentionally rendered with a
 * safe fallback line instead of a clickable URL.
 */
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Building2,
  Download,
  ExternalLink,
  FileCheck2,
  HelpCircle,
  ListChecks,
  Lock,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";
import { isPublishableUrl, type DocumentGuidance } from "@/lib/documentGuidance";
import type { GuidanceSource } from "@/data/documentGuidance";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guidance: DocumentGuidance | null;
}

const FALLBACK_LINE = "Check the official portal or contact your EduLoans counsellor.";

function SourceItem({ src }: { src: GuidanceSource }) {
  const showLink = src.verification === "verified" && isPublishableUrl(src.url);
  return (
    <li className="flex items-start gap-2 text-sm">
      <Building2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-medium">{src.name}</span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {src.type}
          </span>
        </div>
        {showLink ? (
          <a
            href={src.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline break-all"
          >
            {src.url}
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        ) : (
          <p className="text-xs text-muted-foreground">{FALLBACK_LINE}</p>
        )}
      </div>
    </li>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof HelpCircle;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </h3>
      {children}
    </section>
  );
}

export function DocumentGuidanceModal({ open, onOpenChange, guidance }: Props) {
  if (!guidance) return null;
  const hasImage = !!guidance.image_guide?.image_url;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">
            How to get this document — {guidance.canonical_name}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {guidance.short_helper_line}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Where to get */}
          {guidance.where_to_get.length > 0 && (
            <Section icon={Download} title="Where to get this document">
              <ul className="space-y-2">
                {guidance.where_to_get.map((s, i) => (
                  <SourceItem key={`${s.name}-${i}`} src={s} />
                ))}
              </ul>
            </Section>
          )}

          {/* Steps */}
          <Section icon={ListChecks} title="Steps">
            <ol className="space-y-1.5 text-sm text-foreground/90">
              {guidance.text_steps.map((step, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-muted-foreground tabular-nums shrink-0">
                    {i + 1}.
                  </span>
                  <span className="leading-snug">{step}</span>
                </li>
              ))}
            </ol>
            {guidance.bank_specific_steps && (
              <div className="mt-2 rounded-md border bg-muted/30 p-2.5 space-y-1">
                {Object.entries(guidance.bank_specific_steps).map(([bank, txt]) => (
                  <p key={bank} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{bank}: </span>
                    {txt as string}
                  </p>
                ))}
              </div>
            )}
          </Section>

          {/* What to upload */}
          <Section icon={FileCheck2} title="What to upload">
            <p className="text-sm text-foreground/90 leading-snug">
              {guidance.what_to_upload}
            </p>
          </Section>

          {/* Accepted format */}
          <Section icon={FileCheck2} title="Accepted format">
            <p className="text-sm text-foreground/90 leading-snug">
              {guidance.accepted_format_guidance}
            </p>
          </Section>

          {/* Common mistakes */}
          {guidance.common_mistakes.length > 0 && (
            <Section icon={TriangleAlert} title="Common mistakes to avoid">
              <ul className="space-y-1 text-sm text-foreground/90">
                {guidance.common_mistakes.map((m, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-amber-600 shrink-0">•</span>
                    <span className="leading-snug">{m}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Password protected */}
          {guidance.password_protected_guidance && (
            <Section icon={Lock} title="If your file is password-protected">
              <p className="text-sm text-foreground/90 leading-snug">
                {guidance.password_protected_guidance}
              </p>
            </Section>
          )}

          {/* Image guide — only if asset exists */}
          {hasImage && (
            <Section icon={HelpCircle} title="Visual guide">
              <div className="rounded-md border overflow-hidden bg-white">
                <img
                  src={guidance.image_guide!.image_url}
                  alt={guidance.image_guide!.caption}
                  className="w-full max-h-[50vh] object-contain"
                  loading="lazy"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {guidance.image_guide!.caption}
              </p>
            </Section>
          )}

          {/* Privacy note */}
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-3">
            <ShieldAlert className="h-4 w-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-900 dark:text-amber-200 leading-snug">
              {guidance.privacy_note}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
