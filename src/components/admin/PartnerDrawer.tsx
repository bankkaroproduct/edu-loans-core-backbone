import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
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
  { value: "active", label: "Active" },
  { value: "onboarding", label: "Onboarding" },
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

  useEffect(() => {
    if (!open) return;
    if (record) {
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
    }
  }, [open, record]);

  const setField = (k: keyof typeof blank, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.display_name.trim() || !form.legal_name.trim() || !form.partner_code.trim()) {
      toast({ title: "Validation error", description: "Display name, legal name, and partner code are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (isEdit && record) {
        // partner_code is immutable on edit
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

        <div className="space-y-4 py-4">
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
            </div>
          </div>

          <div className="pt-2">
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contact</p>
              <p className="text-[10px] text-muted-foreground">Recommended for go-live</p>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Contact Person Name</Label>
                <Input value={form.contact_person_name} onChange={(e) => setField("contact_person_name", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Email</Label>
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
          </div>
        </div>

        <SheetFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : isEdit ? "Save Changes" : "Create Partner"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
