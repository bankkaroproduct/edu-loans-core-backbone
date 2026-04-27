import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Lock, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FormSection } from "@/components/shared/FormSection";
import type { Tables } from "@/integrations/supabase/types";

type Lender = Tables<"lenders"> & { internal_notes?: string | null };

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  record: Lender | null;
  onSaved: () => void;
}

const LENDER_TYPES = ["Bank", "NBFC", "Fintech", "International"];
const ISO_OPTIONS = ["US", "GB", "CA", "AU", "DE", "FR", "NL", "SG", "IE", "NZ", "ES", "IT", "CH", "SE", "DK"];

const blank = {
  lender_code: "",
  lender_name: "",
  lender_type: "Bank",
  loan_amount_min: "" as string,
  loan_amount_max: "" as string,
  processing_time_days: "" as string,
  income_expectations_min: "" as string,
  supports_collateral: true,
  supports_unsecured: false,
  supported_countries: [] as string[],
  active_flag: true,
  internal_notes: "",
};

export function LenderDrawer({ open, onOpenChange, record, onSaved }: Props) {
  const isEdit = !!record;
  const [form, setForm] = useState<typeof blank>(blank);
  const [saving, setSaving] = useState(false);
  const [countryToAdd, setCountryToAdd] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    if (record) {
      setForm({
        lender_code: record.lender_code,
        lender_name: record.lender_name,
        lender_type: record.lender_type ?? "Bank",
        loan_amount_min: record.loan_amount_min?.toString() ?? "",
        loan_amount_max: record.loan_amount_max?.toString() ?? "",
        processing_time_days: record.processing_time_days?.toString() ?? "",
        income_expectations_min: record.income_expectations_min?.toString() ?? "",
        supports_collateral: record.supports_collateral,
        supports_unsecured: record.supports_unsecured,
        supported_countries: record.supported_countries ?? [],
        active_flag: record.active_flag,
        internal_notes: record.internal_notes ?? "",
      });
    } else {
      setForm(blank);
    }
  }, [open, record]);

  const setField = (k: keyof typeof blank, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const addCountry = () => {
    if (!countryToAdd) return;
    if (form.supported_countries.includes(countryToAdd)) return;
    setField("supported_countries", [...form.supported_countries, countryToAdd]);
    setCountryToAdd("");
  };
  const removeCountry = (c: string) =>
    setField("supported_countries", form.supported_countries.filter((x) => x !== c));

  const handleSave = async () => {
    if (!form.lender_code.trim() || !form.lender_name.trim()) {
      toast({ title: "Validation error", description: "Lender code and name are required.", variant: "destructive" });
      return;
    }
    if (form.supported_countries.length === 0) {
      toast({ title: "Validation error", description: "Select at least one supported country.", variant: "destructive" });
      return;
    }
    if (form.supports_unsecured && form.income_expectations_min.trim() === "") {
      toast({ title: "Validation error", description: "Min income is required when unsecured loans are supported.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const num = (s: string) => (s.trim() === "" ? null : Number(s));
      const payload: any = {
        lender_name: form.lender_name,
        lender_type: form.lender_type,
        loan_amount_min: num(form.loan_amount_min),
        loan_amount_max: num(form.loan_amount_max),
        processing_time_days: num(form.processing_time_days),
        income_expectations_min: form.supports_unsecured ? num(form.income_expectations_min) : null,
        supports_collateral: form.supports_collateral,
        supports_unsecured: form.supports_unsecured,
        supported_countries: form.supported_countries.length ? form.supported_countries : null,
        active_flag: form.active_flag,
        internal_notes: form.internal_notes.trim() || null,
      };

      if (isEdit && record) {
        const { error } = await supabase.from("lenders").update(payload).eq("id", record.id);
        if (error) throw error;
        toast({ title: "Saved", description: "Lender updated." });
      } else {
        const { error } = await supabase.from("lenders").insert({ ...payload, lender_code: form.lender_code.toUpperCase() });
        if (error) throw error;
        toast({ title: "Created", description: "Lender added." });
      }
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // (SectionHeader replaced with shared FormSection — PR 5)


  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit Lender" : "Add Lender"}</SheetTitle>
          <SheetDescription>
            {isEdit ? "Update lender configuration." : "Add a new lender to the catalog."}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-4">
          {/* Identity */}
          <FormSection title="Identity">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  Lender Code * {isEdit && <Lock className="h-3 w-3 text-muted-foreground" />}
                </Label>
                <Input value={form.lender_code} onChange={(e) => setField("lender_code", e.target.value.toUpperCase())} disabled={isEdit} className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Lender Type *</Label>
                <Select value={form.lender_type} onValueChange={(v) => setField("lender_type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LENDER_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Lender Name *</Label>
              <Input value={form.lender_name} onChange={(e) => setField("lender_name", e.target.value)} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-2.5">
              <div>
                <Label className="text-sm">Active</Label>
                <p className="text-[10px] text-muted-foreground">Inactive lenders are excluded from matching.</p>
              </div>
              <Switch checked={form.active_flag} onCheckedChange={(v) => setField("active_flag", v)} />
            </div>
          </FormSection>

          {/* Loan Coverage */}
          <FormSection
            title="Loan Coverage"
            actions={<span className="text-[10px] text-muted-foreground">Drives BRE matching</span>}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Min Loan (₹)</Label>
                <Input type="number" value={form.loan_amount_min} onChange={(e) => setField("loan_amount_min", e.target.value)} placeholder="No minimum" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Max Loan (₹)</Label>
                <Input type="number" value={form.loan_amount_max} onChange={(e) => setField("loan_amount_max", e.target.value)} placeholder="No maximum" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground -mt-1">Leave either field blank to apply no limit on that side.</p>
            <div className="space-y-1.5">
              <Label className="text-xs">Processing Days</Label>
              <Input type="number" value={form.processing_time_days} onChange={(e) => setField("processing_time_days", e.target.value)} placeholder="e.g. 7" />
              <p className="text-[10px] text-muted-foreground">Used to rank lenders. Lower = higher rank.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between rounded-md border p-2.5">
                <Label className="text-sm">Collateral-backed</Label>
                <Switch checked={form.supports_collateral} onCheckedChange={(v) => setField("supports_collateral", v)} />
              </div>
              <div className="flex items-center justify-between rounded-md border p-2.5">
                <Label className="text-sm">Unsecured</Label>
                <Switch checked={form.supports_unsecured} onCheckedChange={(v) => setField("supports_unsecured", v)} />
              </div>
            </div>

            {form.supports_unsecured && (
              <div className="space-y-1.5">
                <Label className="text-xs">Min Co-applicant Income (₹) *</Label>
                <Input
                  type="number"
                  value={form.income_expectations_min}
                  onChange={(e) => setField("income_expectations_min", e.target.value)}
                  placeholder="Required when unsecured loans are supported"
                />
                <p className="text-[10px] text-muted-foreground">Only relevant for unsecured underwriting.</p>
              </div>
            )}
          </FormSection>

          {/* Eligibility */}
          <FormSection title="Eligibility">
            <div>
              <Label className="text-xs">Supported Countries (ISO) *</Label>
              <div className="flex gap-2 mt-1.5">
                <Select value={countryToAdd} onValueChange={setCountryToAdd}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Select country…" /></SelectTrigger>
                  <SelectContent>
                    {ISO_OPTIONS.filter((c) => !form.supported_countries.includes(c)).map((c) =>
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={addCountry} disabled={!countryToAdd}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2 min-h-[28px]">
                {form.supported_countries.map((c) => (
                  <Badge key={c} variant="secondary" className="font-mono text-xs gap-1 pr-1">
                    {c}
                    <button onClick={() => removeCountry(c)} className="hover:bg-destructive/20 rounded p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">At least one country required.</p>
            </div>
          </FormSection>

          {/* Internal Notes */}
          <FormSection
            title="Internal Notes"
            actions={<span className="text-[10px] text-muted-foreground">Ops only — not shown to partners</span>}
          >
            <Textarea
              value={form.internal_notes}
              onChange={(e) => setField("internal_notes", e.target.value)}
              placeholder="Escalation contacts, special conditions, ops context…"
              rows={3}
            />
          </FormSection>
        </div>

        <SheetFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>
                  <Button
                    onClick={handleSave}
                    disabled={saving || form.supported_countries.length === 0 || !form.lender_code.trim() || !form.lender_name.trim()}
                  >
                    {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Lender"}
                  </Button>
                </span>
              </TooltipTrigger>
              {form.supported_countries.length === 0 && (
                <TooltipContent>Select at least one supported country to save.</TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
