import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Mail, MessageCircle, Send, Eye, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { extractTokens, renderTemplate } from "@/lib/communications/render";
import type { CommChannel, CommMode, CommunicationTemplate } from "@/lib/communications/types";

interface Props {
  /** Pre-fill recipient (e.g. lead's email/phone) */
  defaultRecipient?: string;
  /** Restrict to a single channel; if not set user can choose */
  lockChannel?: CommChannel;
  /** Pre-filled variable values from a lead */
  defaultVariables?: Record<string, string>;
  /** Bind the send to a lead id (for log linkage) */
  leadId?: string | null;
  /** Called after a successful send/simulate */
  onSent?: (logId: string | null) => void;
  /** Whether providers are connected — controls demo_live availability */
  providerStatus?: { resend: boolean; twilio: boolean };
}

export function MessageComposer({
  defaultRecipient = "",
  lockChannel,
  defaultVariables = {},
  leadId = null,
  onSent,
  providerStatus = { resend: true, twilio: true },
}: Props) {
  const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  // Correction 2: mock is ALWAYS the default on every fresh form load
  const [channel, setChannel] = useState<CommChannel>(lockChannel ?? "email");
  const [templateKey, setTemplateKey] = useState<string>("");
  const [recipient, setRecipient] = useState(defaultRecipient);
  const [vars, setVars] = useState<Record<string, string>>(defaultVariables);
  const [mode, setMode] = useState<CommMode>("mock"); // ALWAYS default to mock
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("communication_templates")
        .select("*")
        .eq("active_flag", true)
        .order("template_key");
      setTemplates((data ?? []) as CommunicationTemplate[]);
      setLoading(false);
    })();
  }, []);

  const channelTemplates = useMemo(
    () => templates.filter((t) => t.channel === channel),
    [templates, channel],
  );

  const selectedTemplate = useMemo(
    () => channelTemplates.find((t) => t.template_key === templateKey) ?? null,
    [channelTemplates, templateKey],
  );

  // Reset template when channel changes
  useEffect(() => {
    if (selectedTemplate && selectedTemplate.channel !== channel) setTemplateKey("");
  }, [channel, selectedTemplate]);

  // Auto-pick first template when none selected
  useEffect(() => {
    if (!templateKey && channelTemplates.length > 0) {
      setTemplateKey(channelTemplates[0].template_key);
    }
  }, [channelTemplates, templateKey]);

  // Initialize variables from defaults whenever template changes
  useEffect(() => {
    if (!selectedTemplate) return;
    const tokens = [
      ...extractTokens(selectedTemplate.subject ?? ""),
      ...extractTokens(selectedTemplate.body ?? ""),
    ];
    const next: Record<string, string> = {};
    tokens.forEach((t) => {
      next[t] = vars[t] ?? defaultVariables[t] ?? "";
    });
    setVars(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateKey]);

  const tokens = useMemo(() => {
    if (!selectedTemplate) return [];
    return Array.from(
      new Set([
        ...extractTokens(selectedTemplate.subject ?? ""),
        ...extractTokens(selectedTemplate.body ?? ""),
      ]),
    );
  }, [selectedTemplate]);

  const previewSubject = selectedTemplate?.subject
    ? renderTemplate(selectedTemplate.subject, vars)
    : null;
  const previewBody = selectedTemplate ? renderTemplate(selectedTemplate.body, vars) : "";

  const liveAvailable =
    channel === "email" ? providerStatus.resend : providerStatus.twilio;

  // Correction 3: if user picked demo_live and provider isn't connected, force back to mock
  useEffect(() => {
    if (mode === "demo_live" && !liveAvailable) setMode("mock");
  }, [liveAvailable, mode]);

  const handleSend = async () => {
    if (!selectedTemplate) {
      toast.error("Select a template first");
      return;
    }
    if (!recipient.trim()) {
      toast.error("Recipient is required");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-communication", {
        body: {
          template_key: selectedTemplate.template_key,
          recipient: recipient.trim(),
          lead_id: leadId,
          mode,
          variables: vars,
        },
      });
      if (error) throw error;
      const result = data as { ok: boolean; log_id?: string; error?: string; message?: string };
      if (result.ok) {
        toast.success(
          mode === "mock"
            ? "Mock send logged successfully"
            : `Sent via ${channel === "email" ? "Resend" : "Twilio Sandbox"}`,
        );
        onSent?.(result.log_id ?? null);
      } else {
        toast.error(result.message ?? result.error ?? "Send failed (logged)");
        onSent?.(result.log_id ?? null);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading templates…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Channel selector */}
      {!lockChannel && (
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Channel</Label>
          <RadioGroup
            value={channel}
            onValueChange={(v) => setChannel(v as CommChannel)}
            className="flex gap-4 mt-2"
          >
            <label className="flex items-center gap-2 cursor-pointer">
              <RadioGroupItem value="email" /> <Mail className="h-4 w-4" /> Email
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <RadioGroupItem value="whatsapp" /> <MessageCircle className="h-4 w-4" /> WhatsApp
            </label>
          </RadioGroup>
        </div>
      )}

      {/* Template picker */}
      <div>
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Template</Label>
        <Select value={templateKey} onValueChange={setTemplateKey}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Choose a template" />
          </SelectTrigger>
          <SelectContent>
            {channelTemplates.map((t) => (
              <SelectItem key={t.id} value={t.template_key}>
                {t.template_key}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedTemplate?.description && (
          <p className="text-xs text-muted-foreground mt-1">{selectedTemplate.description}</p>
        )}
      </div>

      {/* Recipient */}
      <div>
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Recipient {channel === "email" ? "(email)" : "(phone in E.164, e.g. +919876543210)"}
        </Label>
        <Input
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder={channel === "email" ? "student@example.com" : "+919876543210"}
          className="mt-1"
        />
        {channel === "whatsapp" && mode === "demo_live" && (
          <p className="text-xs text-muted-foreground mt-1">
            ⚠ Recipient must first join the Twilio sandbox by sending the join code to{" "}
            <strong>+1 415 523 8886</strong>.
          </p>
        )}
      </div>

      {/* Variables */}
      {tokens.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Variables</Label>
          <div className="grid grid-cols-2 gap-2">
            {tokens.map((tok) => (
              <div key={tok}>
                <Label className="text-xs text-muted-foreground">{tok}</Label>
                <Input
                  value={vars[tok] ?? ""}
                  onChange={(e) => setVars((v) => ({ ...v, [tok]: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview */}
      {selectedTemplate && (
        <Card className="p-3 bg-muted/30">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-2">
            <Eye className="h-3 w-3" /> Preview
          </div>
          {previewSubject && (
            <p className="text-sm font-medium mb-2">Subject: {previewSubject}</p>
          )}
          <pre className="text-xs whitespace-pre-wrap font-sans text-foreground">{previewBody}</pre>
        </Card>
      )}

      {/* Mode */}
      <div>
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Send mode</Label>
        <RadioGroup
          value={mode}
          onValueChange={(v) => setMode(v as CommMode)}
          className="grid grid-cols-2 gap-2 mt-2"
        >
          <label
            className={`flex items-start gap-2 p-3 border rounded-md cursor-pointer ${
              mode === "mock" ? "border-primary bg-primary/5" : "border-input"
            }`}
          >
            <RadioGroupItem value="mock" className="mt-0.5" />
            <div>
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Mock (safe)
              </div>
              <p className="text-xs text-muted-foreground">Logs only. Nothing is actually sent.</p>
            </div>
          </label>
          <label
            className={`flex items-start gap-2 p-3 border rounded-md ${
              !liveAvailable
                ? "opacity-50 cursor-not-allowed"
                : mode === "demo_live"
                  ? "border-primary bg-primary/5 cursor-pointer"
                  : "border-input cursor-pointer"
            }`}
          >
            <RadioGroupItem value="demo_live" disabled={!liveAvailable} className="mt-0.5" />
            <div>
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <Send className="h-3.5 w-3.5" /> Demo Live
                {!liveAvailable && (
                  <Badge variant="outline" className="text-[10px] h-4 px-1">
                    Not configured
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {channel === "email" ? "Send via Resend" : "Send via Twilio Sandbox"}
              </p>
            </div>
          </label>
        </RadioGroup>
        {!liveAvailable && (
          <Alert className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {channel === "email"
                ? "Resend is not connected. Live email sending is unavailable — mock mode is still available."
                : "Twilio is not connected. Live WhatsApp sending is unavailable — mock mode is still available."}
            </AlertDescription>
          </Alert>
        )}
      </div>

      <Button onClick={handleSend} disabled={sending || !selectedTemplate} className="w-full">
        {sending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…
          </>
        ) : (
          <>
            <Send className="h-4 w-4 mr-2" />
            {mode === "mock" ? "Simulate send" : "Send now"}
          </>
        )}
      </Button>
    </div>
  );
}
