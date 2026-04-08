import { AlertTriangle, Bug } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { LeadCreateDebugState } from "@/lib/leadCreateDebug";
import { prettyDebugJson } from "@/lib/leadCreateDebug";

interface LeadCreateDebugPanelProps {
  debug: LeadCreateDebugState | null;
}

function DebugBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <details className="rounded-md border border-border bg-muted/30 p-3">
      <summary className="cursor-pointer text-sm font-medium text-foreground">{title}</summary>
      <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-xs text-foreground">
        {prettyDebugJson(value)}
      </pre>
    </details>
  );
}

export function LeadCreateDebugPanel({ debug }: LeadCreateDebugPanelProps) {
  if (!debug) return null;

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Bug className="h-4 w-4 text-primary" />
          Temporary lead creation debug
        </CardTitle>
        <CardDescription>
          Exact auth context, payload, DB response, and failing step for this submission.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-border p-3 text-sm">
            <p className="text-muted-foreground">Authenticated user id</p>
            <p className="break-all font-medium text-foreground">{debug.authUserId ?? "—"}</p>
          </div>
          <div className="rounded-md border border-border p-3 text-sm">
            <p className="text-muted-foreground">Resolved app user id</p>
            <p className="break-all font-medium text-foreground">{debug.appUserId ?? "—"}</p>
          </div>
          <div className="rounded-md border border-border p-3 text-sm">
            <p className="text-muted-foreground">Resolved role</p>
            <p className="font-medium text-foreground">{debug.resolvedRole ?? "—"}</p>
          </div>
          <div className="rounded-md border border-border p-3 text-sm">
            <p className="text-muted-foreground">Resolved partner_id</p>
            <p className="break-all font-medium text-foreground">{debug.resolvedPartnerId ?? "—"}</p>
          </div>
          <div className="rounded-md border border-border p-3 text-sm">
            <p className="text-muted-foreground">effectivePartnerId</p>
            <p className="break-all font-medium text-foreground">{debug.effectivePartnerId ?? "—"}</p>
          </div>
          <div className="rounded-md border border-border p-3 text-sm">
            <p className="text-muted-foreground">Effective submitting user id</p>
            <p className="break-all font-medium text-foreground">{debug.effectiveSubmittingUserId ?? "—"}</p>
          </div>
        </div>

        {debug.failedStep && debug.error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground">
            <div className="mb-1 flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Failing step: {debug.failedStep}
            </div>
            <p className="break-words">{debug.error.message}</p>
            {debug.error.details ? <p className="mt-1 text-muted-foreground">Details: {debug.error.details}</p> : null}
            {debug.error.hint ? <p className="mt-1 text-muted-foreground">Hint: {debug.error.hint}</p> : null}
            {debug.error.code ? <p className="mt-1 text-muted-foreground">Code: {debug.error.code}</p> : null}
          </div>
        ) : null}

        <DebugBlock title="Final payload being sent for insert" value={debug.payload} />
        <DebugBlock title="Main lead insert response" value={debug.mainInsertResponse ?? null} />
        <DebugBlock title="Downstream write responses" value={debug.downstream ?? null} />
        <DebugBlock title="Lead ID fetch response" value={debug.displayIdResponse ?? null} />
      </CardContent>
    </Card>
  );
}