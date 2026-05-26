import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, AlertTriangle, Info } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FormSection } from "@/components/shared/FormSection";
import type { Tables } from "@/integrations/supabase/types";

type Partner = Tables<"partner_organizations">;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  record: Partner | null; // null = create
  onSaved: () => void;
}

const PARTNER_TYPES: { value: Partner["partner_type"]; label: string }[] = [
  { value: "education_consultant", label: "Education Consultant" },
  { value: "study_abroad_agency", label: "Study Abroad Agency" },
  { value: "university_partner", label: "University Partner" },
  { value: "digital_aggregator", label: "Digital Aggregator" },
  { value: "freelance_counsellor", label: "Freelance Counsellor" },
  { value: "other", label: "Other" },
];

const STATUSES: { value: Partner["status"]; label: string }[] = [
  { value: "onboarding", label: "Onboarding" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "suspended", label: "Suspended" },
  { value: "terminated", label: "Terminated" },
];

const blank = {
  display_name: "",
  legal_name: "",
  partner_code: "",
  partner_type: "education_consultant" as Partner["partner_type"],
  status: "onboarding" as Partner["status"],
  contact_person_name: "",
  contact_person_email: "",
  contact_person_phone: "",
  payout_entity_name: "",
};

export function PartnerDrawer({ open, onOpenChange, record, onSaved }: Props) {
  const isEdit = !!record;
  const isSystem = record?.partner_code === "PTR-DIRECT";
  const [form, setForm] = useState<typeof blank>(blank);
  const [saving, setSaving] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [autoCode, setAutoCode] = useState<string>("");
  const [dupCheck, setDupCheck] = useState<"idle" | "checking" | "ok" | "duplicate">("idle");
  const [dupOwnerName, setDupOwnerName] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setActivationError(null);
    setDupCheck("idle");
    setDupOwnerName(null);
    if (record) {
      setAutoCode("");
      setForm({
        display_name: record.display_name ?? "",
        legal_name: record.legal_name ?? "",
        partner_code: record.partner_code ?? "",
        partner_type: record.partner_type,
        status: record.status,
        contact_person_name: record.contact_person_name ?? "",
        contact_person_email: record.contact_person_email ?? "",
        contact_person_phone: record.contact_person_phone ?? "",
        payout_entity_name: record.payout_entity_name ?? "",
      });
    } else {
      setForm(blank);
      setAutoCode("");
      (async () => {
        const { data } = await supabase
          .from("partner_organizations")
          .select("partner_code")
          .like("partner_code", "PTR-%");
        let max = 0;
        (data ?? []).forEach((r) => {
          const m = /^PTR-(\d+)$/.exec(r.partner_code ?? "");
          if (m) {
            const n = parseInt(m[1], 10);
            if (!Number.isNaN(n) && n > max) max = n;
          }
        });
        const next = `PTR-${String(max + 1).padStart(4, "0")}`;
        setAutoCode(next);
        setForm((p) => (p.partner_code ? p : { ...p, partner_code: next }));
      })();
    }
  }, [open, record]);

  // Debounced duplicate check (create mode only)
  useEffect(() => {
    if (isEdit || !open) return;
    const code = form.partner_code.trim();
    if (!code || code === autoCode) {
      setDupCheck("idle");
      setDupOwnerName(null);
      return;
    }
    if (!/^[A-Z0-9-]{2,}$/.test(code)) {
      setDupCheck("idle");
      setDupOwnerName(null);
      return;
    }
    setDupCheck("checking");
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("partner_organizations")
        .select("display_name")
        .eq("partner_code", code)
        .maybeSingle();
      if (data) {
        setDupOwnerName(data.display_name);
        setDupCheck("duplicate");
      } else {
        setDupOwnerName(null);
        setDupCheck("ok");
      }
    }, 300);
    return () => clearTimeout(t);
  }, [form.partner_code, autoCode, isEdit, open]);

  const setField = (k: keyof typeof blank, v: any) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (k === "status" || k === "contact_person_name" || k === "contact_person_email") {
      setActivationError(null);
    }
  };

  const activationReady = useMemo(
    () => form.contact_person_name.trim().length > 0 && form.contact_person_email.trim().length > 0,
    [form.contact_person_name, form.contact_person_email],
  );

  // (SectionHeader replaced with shared FormSection — PR 5)

  const handleSave = async () => {
    if (!form.display_name.trim() || !form.legal_name.trim() || !form.partner_code.trim()) {
      toast({ title: "Validation error", description: "Display name, legal name, and partner code are required.", variant: "destructive" });
      return;
    }
    if (form.status === "active" && !activationReady) {
      const msg = "Contact name and email are required to set status to Active. Save as Onboarding, or fill in Activation Details.";
      setActivationError(msg);
      toast({ title: "Cannot activate yet", description: msg, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (isEdit && record) {
        const { partner_code: _drop, ...payload } = form;
        const { error } = await supabase.from("partner_organizations").update(payload).eq("id", record.id);
        if (error) throw error;
        toast({ title: "Saved", description: "Partner organization updated." });
      } else {
        const { error } = await supabase.from("partner_organizations").insert(form);
        if (error) throw error;
        toast({ title: "Created", description: "Partner organization added." });
      }
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit Partner" : "Add Partner"}</SheetTitle>
          <SheetDescription>
            {isEdit ? "Update partner organization details." : "Register a new partner organization."}
          </SheetDescription>
        </SheetHeader>

        {isSystem && (
          <Alert className="my-4 bg-amber-50 border-amber-200 text-amber-900 [&>svg]:text-amber-600">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>System partner:</strong> The Student Direct row is system-managed. Status changes are not recommended.
            </AlertDescription>
          </Alert>
        )}

        {/* Lifecycle helper — visible BEFORE submit, not a save-time surprise */}
        <Alert className="my-4 bg-muted/40 border-muted [&>svg]:text-muted-foreground">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs leading-relaxed">
            A partner can be created in <strong>Onboarding</strong> with just identity fields.
            To set status to <strong>Active</strong> (go-live), Contact Name and Contact Email are required in Activation Details below.
          </AlertDescription>
        </Alert>

        <div className="space-y-6 py-4">
          {/* Section 1 — Create Partner (identity) */}
          <FormSection title="Create Partner" actions={<span className="text-[10px] text-muted-foreground">Required for record</span>}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Display Name *</Label>
                <Input value={form.display_name} onChange={(e) => setField("display_name", e.target.value)} disabled={isSystem} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  Partner Code * {isEdit && <Lock className="h-3 w-3 text-muted-foreground" />}
                </Label>
                <Input value={form.partner_code} onChange={(e) => setField("partner_code", e.target.value.toUpperCase())} disabled={isEdit} className="font-mono" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Legal Name *</Label>
              <Input value={form.legal_name} onChange={(e) => setField("legal_name", e.target.value)} disabled={isSystem} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Partner Type</Label>
                <Select value={form.partner_type} onValueChange={(v) => setField("partner_type", v)} disabled={isSystem}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PARTNER_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={(v) => setField("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {form.status === "active" && !activationReady && (
                  <p className="text-[10px] text-amber-700">Active requires Contact Name + Email below.</p>
                )}
              </div>
            </div>
          </FormSection>

          {/* Section 2 — Activation Details */}
          <FormSection
            title="Activation Details"
            description="Optional in Onboarding; required to switch status to Active."
            actions={<span className="text-[10px] text-muted-foreground">Required to go live</span>}
          >
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Contact Person Name {form.status === "active" && <span className="text-amber-700">*</span>}
                </Label>
                <Input value={form.contact_person_name} onChange={(e) => setField("contact_person_name", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Email {form.status === "active" && <span className="text-amber-700">*</span>}
                  </Label>
                  <Input type="email" value={form.contact_person_email} onChange={(e) => setField("contact_person_email", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Phone</Label>
                  <Input value={form.contact_person_phone} onChange={(e) => setField("contact_person_phone", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Payout Entity Name</Label>
                <Input value={form.payout_entity_name} onChange={(e) => setField("payout_entity_name", e.target.value)} placeholder="Bank account beneficiary name" />
                <p className="text-[10px] text-muted-foreground">Defaults to legal name if blank.</p>
              </div>
            </div>
            {activationError && (
              <Alert className="bg-amber-50 border-amber-200 text-amber-900 [&>svg]:text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">{activationError}</AlertDescription>
              </Alert>
            )}
          </FormSection>
        </div>

        <SheetFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : isEdit ? "Save Changes" : "Create Partner"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
