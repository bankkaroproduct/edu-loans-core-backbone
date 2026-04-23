import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Eye, Loader2, Mail, MessageCircle, Save, AlertCircle, Lock } from "lucide-react";
import { toast } from "sonner";
import { extractTokens, renderTemplate } from "@/lib/communications/render";
import { TEMPLATE_VARIABLES, defaultVariableValues, findVariable } from "@/lib/communications/variables";
import type { CommChannel, CommunicationTemplate } from "@/lib/communications/types";

export type EditorMode = "create" | "edit" | "duplicate";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: EditorMode;
  /** existing row when mode === 'edit' or 'duplicate' */
  template?: CommunicationTemplate | null;
  onSaved: () => void;
}

const TEMPLATE_KEY_RE = /^[a-z][a-z0-9_]{2,79}$/;

export function TemplateEditor({ open, onOpenChange, mode, template, onSaved }: Props) {
  const [templateKey, setTemplateKey] = useState("");
  const [channel, setChannel] = useState<CommChannel>("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [description, setDescription] = useState("");
  const [activeFlag, setActiveFlag] = useState(false);
  const [vars, setVars] = useState<Record<string, string>>(defaultVariableValues());
  const [saving, setSaving] = useState(false);
  const [keyTaken, setKeyTaken] = useState(false);

  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const subjectRef = useRef<HTMLInputElement | null>(null);
  const lastFocused = useRef<"subject" | "body">("body");

  const isEdit = mode === "edit";
  const keyLocked = isEdit; // Guardrail #2: template_key immutable when editing existing
  const headerTitle =
    mode === "create" ? "New Template" : mode === "duplicate" ? "Duplicate Template" : "Edit Template";

  // Hydrate form whenever drawer opens
  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && template) {
      setTemplateKey(template.template_key);
      setChannel(template.channel);
      setSubject(template.subject ?? "");
      setBody(template.body);
      setDescription(template.description ?? "");
      setActiveFlag(template.active_flag);
    } else if (mode === "duplicate" && template) {
      setTemplateKey(`copy_of_${template.template_key}`.slice(0, 80));
      setChannel(template.channel);
      setSubject(template.subject ?? "");
      setBody(template.body);
      setDescription(template.description ?? "");
      setActiveFlag(false); // Guardrail #4: new templates default inactive
    } else {
      setTemplateKey("");
      setChannel("email");
      setSubject("");
      setBody("");
      setDescription("");
      setActiveFlag(false); // Guardrail #4
    }
    setKeyTaken(false);
    setVars(defaultVariableValues());
  }, [open, mode, template]);

  // Detect tokens used in this template (for the inputs panel)
  const tokens = useMemo(
    () => Array.from(new Set([...extractTokens(subject), ...extractTokens(body)])),
    [subject, body],
  );

  // Live preview — uses the EXACT same renderTemplate() as the send flow (Guardrail #3)
  const previewSubject = subject ? renderTemplate(subject, vars) : "";
  const previewBody = body ? renderTemplate(body, vars) : "";

  // Validation
  const keyValid = TEMPLATE_KEY_RE.test(templateKey);
  const keyChangedFromOriginal =
    mode === "duplicate" && template && templateKey === `copy_of_${template.template_key}`;
  const bodyValid = body.trim().length > 0;
  const subjectValidForChannel = channel === "whatsapp" || subject.trim().length > 0;

  const canSave =
    keyValid && bodyValid && subjectValidForChannel && !keyTaken && !keyChangedFromOriginal && !saving;

  const insertVariable = (key: string) => {
    const token = `{{${key}}}`;
    const target = lastFocused.current;
    if (target === "subject" && channel === "email") {
      const el = subjectRef.current;
      const start = el?.selectionStart ?? subject.length;
      const end = el?.selectionEnd ?? subject.length;
      const next = subject.slice(0, start) + token + subject.slice(end);
      setSubject(next);
      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(start + token.length, start + token.length);
      });
    } else {
      const el = bodyRef.current;
      const start = el?.selectionStart ?? body.length;
      const end = el?.selectionEnd ?? body.length;
      const next = body.slice(0, start) + token + body.slice(end);
      setBody(next);
      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(start + token.length, start + token.length);
      });
    }
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      // Pre-flight uniqueness check for create / duplicate (Guardrail #5)
      if (mode !== "edit") {
        const { data: existing } = await supabase
          .from("communication_templates")
          .select("id")
          .eq("template_key", templateKey)
          .maybeSingle();
        if (existing) {
          setKeyTaken(true);
          toast.error("Template key already exists. Choose a different key.");
          setSaving(false);
          return;
        }
      }

      if (mode === "edit" && template) {
        // Guardrail #2: never write template_key on edit
        const { error } = await supabase
          .from("communication_templates")
          .update({
            channel,
            subject: channel === "email" ? subject : null,
            body,
            description: description || null,
            active_flag: activeFlag,
            updated_at: new Date().toISOString(),
          })
          .eq("id", template.id);
        if (error) throw error;
        toast.success("Template updated");
      } else {
        const { error } = await supabase.from("communication_templates").insert({
          template_key: templateKey,
          channel,
          subject: channel === "email" ? subject : null,
          body,
          description: description || null,
          active_flag: activeFlag, // Guardrail #4: defaults to false unless user toggled on
        });
        if (error) {
          if (error.code === "23505") {
            setKeyTaken(true);
            toast.error("Template key already exists.");
          } else {
            throw error;
          }
          setSaving(false);
          return;
        }
        toast.success(mode === "duplicate" ? "Template duplicated" : "Template created");
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{headerTitle}</SheetTitle>
          <SheetDescription>
            Templates take effect immediately for the test panel and lead-detail send block.
            Disable a template to hide it from the composer without deleting it.
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-6 lg:grid-cols-2 mt-6">
          {/* LEFT — form */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="template_key" className="text-xs uppercase tracking-wide text-muted-foreground">
                Template key {keyLocked && <Lock className="inline h-3 w-3 ml-1" />}
              </Label>
              <Input
                id="template_key"
                value={templateKey}
                disabled={keyLocked}
                onChange={(e) => {
                  setTemplateKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"));
                  setKeyTaken(false);
                }}
                placeholder="e.g. welcome_email"
                className="mt-1 font-mono text-sm"
              />
              {keyLocked && (
                <p className="text-xs text-muted-foreground mt-1">
                  Locked to keep current send-flow references intact.
                </p>
              )}
              {!keyLocked && !keyValid && templateKey && (
                <p className="text-xs text-destructive mt-1">
                  Use lowercase letters, digits and underscores. 3–80 chars. Must start with a letter.
                </p>
              )}
              {keyTaken && (
                <p className="text-xs text-destructive mt-1">This key is already in use.</p>
              )}
              {keyChangedFromOriginal && (
                <p className="text-xs text-amber-600 mt-1">
                  Please rename this duplicate before saving.
                </p>
              )}
            </div>

            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Channel</Label>
              <RadioGroup
                value={channel}
                onValueChange={(v) => setChannel(v as CommChannel)}
                className="flex gap-4 mt-2"
                disabled={isEdit}
              >
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="email" /> <Mail className="h-4 w-4" /> Email
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="whatsapp" /> <MessageCircle className="h-4 w-4" /> WhatsApp
                </label>
              </RadioGroup>
              {isEdit && (
                <p className="text-xs text-muted-foreground mt-1">
                  Channel cannot be changed on existing templates.
                </p>
              )}
            </div>

            {channel === "email" && (
              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Subject</Label>
                <Input
                  ref={subjectRef}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  onFocus={() => (lastFocused.current = "subject")}
                  placeholder="Your application has been received"
                  className="mt-1"
                />
              </div>
            )}

            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Body</Label>
              <Textarea
                ref={bodyRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onFocus={() => (lastFocused.current = "body")}
                placeholder="Hi {{student_name}}, your application {{lead_id}} is being reviewed."
                className="mt-1 min-h-[200px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Click a variable below to insert it at the cursor position.
              </p>
            </div>

            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Available variables
              </Label>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {TEMPLATE_VARIABLES.map((v) => (
                  <Button
                    key={v.key}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => insertVariable(v.key)}
                    className="h-7 text-xs font-mono"
                    title={v.label}
                  >
                    {`{{${v.key}}}`}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Description (internal)
              </Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="When is this template used?"
                className="mt-1 min-h-[60px] text-sm"
              />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-md">
              <div>
                <Label className="text-sm font-medium">Active</Label>
                <p className="text-xs text-muted-foreground">
                  Inactive templates are hidden from the composer.
                </p>
              </div>
              <Switch checked={activeFlag} onCheckedChange={setActiveFlag} />
            </div>
          </div>

          {/* RIGHT — preview & token inputs */}
          <div className="space-y-4">
            <Card className="p-4 bg-muted/30">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-3">
                <Eye className="h-3 w-3" /> Live Preview
                <Badge variant="outline" className="text-[10px] h-4 px-1 ml-auto">
                  Same render as send
                </Badge>
              </div>
              {channel === "email" && (
                <p className="text-sm font-medium mb-2">
                  Subject: {previewSubject || <span className="text-muted-foreground italic">(empty)</span>}
                </p>
              )}
              <pre className="text-xs whitespace-pre-wrap font-sans text-foreground min-h-[120px]">
                {previewBody || <span className="text-muted-foreground italic">(empty body)</span>}
              </pre>
            </Card>

            {tokens.length > 0 && (
              <Card className="p-4">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Variable values (preview only)
                </Label>
                <div className="grid grid-cols-1 gap-2 mt-2">
                  {tokens.map((tok) => {
                    const meta = findVariable(tok);
                    return (
                      <div key={tok}>
                        <Label className="text-xs text-muted-foreground">
                          {tok}
                          {!meta && (
                            <span className="ml-1 text-amber-600">(not in catalog)</span>
                          )}
                        </Label>
                        <Input
                          value={vars[tok] ?? ""}
                          onChange={(e) => setVars((v) => ({ ...v, [tok]: e.target.value }))}
                          className="h-8 text-sm"
                        />
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {!activeFlag && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  This template is inactive and will not appear in the composer until enabled.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" /> Save template
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
