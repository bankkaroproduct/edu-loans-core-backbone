import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ArrowLeft,
  Mail,
  Send,
  Loader2,
  AlertCircle,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { useLeadDocumentsData } from "@/hooks/useLeadDocumentsData";
import { CaseSummaryCard } from "@/components/admin/send-to-lender/CaseSummaryCard";
import { formatStageLabel } from "@/components/dashboard/StageBadge";
import { AttachmentSelector } from "@/components/admin/send-to-lender/AttachmentSelector";
import { LenderRecipientPicker } from "@/components/admin/send-to-lender/LenderRecipientPicker";
import {
  buildDraftVariables,
  defaultBody,
  defaultSelectedAttachmentIds,
  defaultSubject,
  isValidEmail,
  parseEmailList,
  type LeadRow,
  type LenderRow,
} from "@/lib/sendToLender/buildDraft";
import { useReadOnly } from "@/components/admin/ReadOnlyContext";
import { ReadOnlyBanner } from "@/components/admin/ReadOnlyBanner";
import type { Tables } from "@/integrations/supabase/types";

type LeadDocFile = Tables<"lead_documents"> & {
  document_master?: { document_name: string } | null;
};

export default function AdminSendToLender() {
  const readOnly = useReadOnly();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [lead, setLead] = useState<LeadRow | null>(null);
  const [lender, setLender] = useState<LenderRow | null>(null);
  const [advisorName, setAdvisorName] = useState<string>("EduLoans Advisor");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  const { documents } = useLeadDocumentsData(id);

  const loadAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const leadRes = await supabase
        .from("student_leads")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (leadRes.error) throw leadRes.error;
      if (!leadRes.data) {
        setError("Lead not found");
        setLoading(false);
        return;
      }
      const leadData = leadRes.data as LeadRow;
      setLead(leadData);

      const lockedRes = await supabase
        .from("lead_lender_matches")
        .select("lender_id")
        .eq("lead_id", id)
        .eq("lock_status", true)
        .maybeSingle();

      let lenderRow: LenderRow | null = null;
      if (lockedRes.data?.lender_id) {
        const lenderRes = await supabase
          .from("lenders")
          .select("*")
          .eq("id", lockedRes.data.lender_id)
          .maybeSingle();
        lenderRow = (lenderRes.data ?? null) as LenderRow | null;
      }
      setLender(lenderRow);

      const { data: authData } = await supabase.auth.getUser();
      let adminEmail: string | null = null;
      if (authData?.user) {
        const userRes = await supabase
          .from("users")
          .select("full_name, email")
          .eq("auth_user_id", authData.user.id)
          .maybeSingle();
        if (userRes.data?.full_name) setAdvisorName(userRes.data.full_name);
        adminEmail = userRes.data?.email ?? authData.user.email ?? null;
      }

      const vars = buildDraftVariables(
        leadData,
        lenderRow,
        adminEmail ? advisorNameOrEmail(authData?.user?.email, lenderRow) : "EduLoans Advisor",
      );
      setSubject(defaultSubject(vars));
      setBody(defaultBody(vars));

      const ccList: string[] = [];
      if (lenderRow?.cc_emails && Array.isArray(lenderRow.cc_emails)) {
        ccList.push(...lenderRow.cc_emails.filter(Boolean));
      }
      if (adminEmail) ccList.push(adminEmail);
      setCc(Array.from(new Set(ccList)).join(", "));
      setTo(lenderRow?.contact_email ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (documents.length > 0 && selectedDocIds.size === 0) {
      setSelectedDocIds(new Set(defaultSelectedAttachmentIds(documents as LeadDocFile[])));
    }
  }, [documents]);

  useEffect(() => {
    if (!lead) return;
    const vars = buildDraftVariables(lead, lender, advisorName);
    setBody((current) => {
      if (current.includes("EduLoans Advisor") || current === "") {
        return defaultBody(vars);
      }
      return current;
    });
    setSubject((current) => (current === "" ? defaultSubject(vars) : current));
  }, [advisorName, lead, lender]);

  const toggleDoc = (docId: string) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  };

  const ccList = useMemo(() => parseEmailList(cc), [cc]);
  const toValid = isValidEmail(to.trim());
  const ccValid = ccList.every((e) => isValidEmail(e));

  const canSend =
    !!lead &&
    !!lender &&
    to.trim().length > 0 &&
    toValid &&
    ccValid &&
    subject.trim().length > 0 &&
    body.trim().length > 0;

  const handleSend = async () => {
    if (!lead || !lender || !canSend) return;
    setSending(true);
    try {
      const attachmentManifest = (documents as LeadDocFile[])
        .filter((d) => selectedDocIds.has(d.id))
        .map((d) => ({
          document_id: d.id,
          file_name: d.file_name,
          storage_path: d.storage_path ?? null,
          document_name: d.document_master?.document_name ?? null,
        }));

      const vars = buildDraftVariables(lead, lender, advisorName);

      const { data, error } = await supabase.functions.invoke("send-communication", {
        body: {
          template_key: "lender_application_submission",
          recipient: to.trim(),
          lead_id: lead.id,
          mode: "mock",
          variables: vars,
          cc: ccList,
          subject_override: subject,
          body_override: body,
          attachments_manifest: attachmentManifest,
          recipient_label: "lender",
        },
      });
      if (error) throw error;
      const result = data as { ok: boolean; log_id?: string; message?: string; error?: string };
      if (!result.ok) {
        toast.error(result.message ?? result.error ?? "Send failed");
        return;
      }
      toast.success("Sent to lender (logged). Lifecycle stage was not changed.");
      navigate(`/admin/leads/${lead.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  const handleSaveDraft = () => {
    if (!lead) return;
    setSavingDraft(true);
    try {
      const key = `stl-draft:${lead.id}`;
      localStorage.setItem(
        key,
        JSON.stringify({ to, cc, subject, body, savedAt: new Date().toISOString() }),
      );
      toast.success("Draft saved locally");
    } finally {
      setSavingDraft(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-4 py-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-20 w-full" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="max-w-3xl mx-auto py-10">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Cannot open compose</AlertTitle>
          <AlertDescription>{error ?? "Lead not found"}</AlertDescription>
        </Alert>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => navigate("/admin/leads")}
          size="sm"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Lead Queue
        </Button>
      </div>
    );
  }

  if (!lender) {
    return (
      <div className="max-w-3xl mx-auto py-10 space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Assign a lender first</AlertTitle>
          <AlertDescription>
            This lead has no locked lender assignment. Open the lead and use “Assigned Lender” to
            pick one before composing the lender email. This screen will not change lender
            assignment on its own.
          </AlertDescription>
        </Alert>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/admin/leads/${lead.id}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to lead
        </Button>
      </div>
    );
  }

  const studentName =
    lead.student_full_name ||
    [lead.student_first_name, lead.student_last_name].filter(Boolean).join(" ");
  const lenderEmailMissing = !lender.contact_email;

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-12">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/admin/leads/${lead.id}`)}
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to lead
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" /> Send to Lender
            </h1>
            <p className="text-xs text-muted-foreground">
              Compose preview — auto-filled from this lead. No lifecycle changes are made.
            </p>
          </div>
        </div>
        <Badge variant="outline" className="font-mono">
          {lead.lead_id}
        </Badge>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-x-6 gap-y-2 items-center text-sm">
          <div>
            <span className="text-muted-foreground text-xs">Student</span>
            <p className="font-medium">{studentName}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Stage / Status</span>
            <p className="font-medium">
              {formatStageLabel(lead.current_stage)} · {formatStageLabel(lead.current_status)}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <div>
              <span className="text-muted-foreground text-xs block">Assigned Lender</span>
              <p className="font-medium">
                {lender.lender_name}{" "}
                <span className="text-muted-foreground font-mono text-xs">
                  ({lender.lender_code})
                </span>
              </p>
            </div>
          </div>
        </div>
      </Card>

      {lenderEmailMissing && (
        <Alert>
          <AlertTriangleIcon />
          <AlertTitle>Lender contact email is empty</AlertTitle>
          <AlertDescription>
            You can still draft and review this email. Send is disabled until you fill the
            recipient (To) manually.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          <CaseSummaryCard lead={lead} />
          <AttachmentSelector
            documents={documents as LeadDocFile[]}
            selectedIds={selectedDocIds}
            onToggle={toggleDoc}
          />
        </div>

        <div className="space-y-5">
          <Card className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Email</h3>
            </div>

            <LenderRecipientPicker
              to={to}
              cc={cc}
              onChange={(next) => {
                if (next.to !== undefined) setTo(next.to);
                if (next.cc !== undefined) setCc(next.cc);
              }}
              lenderEmailMissing={lenderEmailMissing}
            />

            <div>
              <Label htmlFor="stl-subject" className="text-xs">
                Subject
              </Label>
              <Input
                id="stl-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="stl-body" className="text-xs">
                Body
              </Label>
              <Textarea
                id="stl-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={16}
                className="font-mono text-xs"
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/admin/leads/${lead.id}`)}
              >
                Cancel
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveDraft}
                  disabled={savingDraft}
                >
                  Save Draft
                </Button>
                <Button size="sm" onClick={handleSend} disabled={!canSend || sending}>
                  {sending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <Send className="h-3.5 w-3.5 mr-1" />
                  )}
                  Send to Lender
                </Button>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              This is a communication-only action. Lifecycle stage and lender assignment are
              not modified.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function AlertTriangleIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function advisorNameOrEmail(
  email: string | null | undefined,
  _lender: LenderRow | null,
): string {
  if (!email) return "EduLoans Advisor";
  const local = email.split("@")[0];
  return local || "EduLoans Advisor";
}
