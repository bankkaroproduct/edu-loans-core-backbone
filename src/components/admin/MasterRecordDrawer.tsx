import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MasterSchema, buildUpdatePayload, buildInsertPayload, validateForm } from "@/lib/masterSchemas";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  schema: MasterSchema;
  record: any | null; // null = create
  onSaved: () => void;
}

export function MasterRecordDrawer({ open, onOpenChange, schema, record, onSaved }: Props) {
  const isEdit = !!record;
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (record) {
      const init: Record<string, any> = { active_flag: record.active_flag ?? true };
      for (const f of schema.fields) {
        const v = record[f.key];
        init[f.key] = f.type === "tags" && Array.isArray(v) ? v.join(", ") : v ?? (f.type === "boolean" ? false : "");
      }
      setForm(init);
    } else {
      const init: Record<string, any> = { active_flag: true };
      for (const f of schema.fields) {
        init[f.key] = f.type === "boolean" ? false : "";
      }
      setForm(init);
    }
  }, [open, record, schema]);

  const setField = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    const err = validateForm(schema, form, isEdit);
    if (err) {
      toast({ title: "Validation error", description: err, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        // Strict allow-list: immutable fields are dropped here even if present in form.
        const payload = buildUpdatePayload(schema, form);
        const { error } = await (supabase as any).from(schema.table).update(payload).eq("id", record.id);
        if (error) throw error;
        toast({ title: "Saved", description: `${schema.label.replace(/s$/, "")} updated.` });
      } else {
        const payload = buildInsertPayload(schema, form);
        const { error } = await (supabase as any).from(schema.table).insert(payload);
        if (error) throw error;
        toast({ title: "Created", description: `New ${schema.label.toLowerCase().replace(/s$/, "")} added.` });
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
      <SheetContent className="w-full sm:max-w-[480px] flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle>{isEdit ? "Edit" : "Add"} {schema.label.replace(/s$/, "")}</SheetTitle>
          <SheetDescription>
            {isEdit ? "Update fields below. Locked fields are system identifiers and cannot be changed." : `Create a new entry in ${schema.label}.`}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {schema.sensitive && (
            <Alert className="bg-amber-50 border-amber-200 text-amber-900 [&>svg]:text-amber-600">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs leading-relaxed">
                {schema.sensitiveNote}
              </AlertDescription>
            </Alert>
          )}

          {schema.fields.map((f) => {
            const locked = isEdit && f.immutableOnEdit;
            return (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={f.key} className="flex items-center gap-1.5 text-sm">
                  {f.label}
                  {f.required && <span className="text-destructive">*</span>}
                  {locked && <Lock className="h-3 w-3 text-muted-foreground" aria-label="Locked field" />}
                </Label>

                {f.type === "boolean" ? (
                  <div className="flex items-center gap-2 pt-1">
                    <Switch
                      id={f.key}
                      checked={!!form[f.key]}
                      onCheckedChange={(v) => setField(f.key, v)}
                      disabled={locked}
                    />
                    <span className="text-xs text-muted-foreground">{form[f.key] ? "Yes" : "No"}</span>
                  </div>
                ) : f.type === "select" ? (
                  <Select
                    value={String(form[f.key] ?? "")}
                    onValueChange={(v) => setField(f.key, v)}
                    disabled={locked}
                  >
                    <SelectTrigger id={f.key}>
                      <SelectValue placeholder={`Select ${f.label.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {f.options?.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : f.type === "number" ? (
                  <Input
                    id={f.key}
                    type="number"
                    value={form[f.key] ?? ""}
                    onChange={(e) => setField(f.key, e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder={f.placeholder}
                    disabled={locked}
                    min={f.min}
                    max={f.max}
                  />
                ) : (
                  <Input
                    id={f.key}
                    type="text"
                    value={form[f.key] ?? ""}
                    onChange={(e) => setField(f.key, f.uppercase ? e.target.value.toUpperCase() : e.target.value)}
                    placeholder={f.placeholder}
                    disabled={locked}
                  />
                )}

                {f.hint && <p className="text-[11px] text-muted-foreground leading-tight">{f.hint}</p>}
              </div>
            );
          })}

          {schema.hasActiveFlag && (
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Active</Label>
                  <p className="text-[11px] text-muted-foreground">Inactive records are hidden from new operations but preserved for existing data.</p>
                </div>
                <Switch checked={!!form.active_flag} onCheckedChange={(v) => setField("active_flag", v)} />
              </div>
            </div>
          )}
        </div>

        <SheetFooter className="px-6 py-4 border-t bg-muted/30 flex-row gap-2 sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : isEdit ? "Save changes" : "Create"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
