import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { NumericBandRow } from "./NumericBandRow";
import { EnumBandRow } from "./EnumBandRow";
import type { ScoringParameter, NumericBand, EnumBand } from "@/lib/bre/types";
import { emptyEnumBand, emptyNumericBand } from "@/lib/bre/empty";

interface Props {
  param: ScoringParameter;
  onChange: (next: ScoringParameter) => void;
  onRemove: () => void;
  readOnly?: boolean;
}

export function ParameterEditor({ param, onChange, onRemove, readOnly }: Props) {
  const [open, setOpen] = useState(false);

  const updateBand = (idx: number, next: NumericBand | EnumBand) => {
    const bands = [...param.bands];
    bands[idx] = next;
    onChange({ ...param, bands });
  };
  const removeBand = (idx: number) => {
    const bands = param.bands.filter((_, i) => i !== idx);
    onChange({ ...param, bands });
  };
  const addBand = () => {
    const bands = [...param.bands, param.input_type === "enum" ? emptyEnumBand() : emptyNumericBand()];
    onChange({ ...param, bands });
  };

  return (
    <div className="rounded-md border bg-card">
      <div className="grid grid-cols-12 items-end gap-2 p-3">
        <div className="col-span-3 space-y-1">
          <Label className="text-[10px] uppercase text-muted-foreground">Param key</Label>
          <Input
            value={param.param_key}
            onChange={(e) => onChange({ ...param, param_key: e.target.value })}
            className="h-8 text-xs font-mono"
            placeholder="param_key"
            disabled={readOnly}
          />
        </div>
        <div className="col-span-4 space-y-1">
          <Label className="text-[10px] uppercase text-muted-foreground">Label</Label>
          <Input
            value={param.label}
            onChange={(e) => onChange({ ...param, label: e.target.value })}
            className="h-8 text-xs"
            placeholder="Display label"
            disabled={readOnly}
          />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-[10px] uppercase text-muted-foreground">Type</Label>
          <Select
            value={param.input_type}
            onValueChange={(v) =>
              onChange({
                ...param,
                input_type: v as "number" | "enum" | "boolean",
                bands: v === "enum" ? [emptyEnumBand()] : [emptyNumericBand()],
              })
            }
            disabled={readOnly}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="number">Number</SelectItem>
              <SelectItem value="enum">Enum</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-[10px] uppercase text-muted-foreground">Weight</Label>
          <Input
            type="number"
            value={param.weight}
            onChange={(e) => onChange({ ...param, weight: e.target.value === "" ? 0 : Number(e.target.value) })}
            className="h-8 text-xs tabular-nums"
            disabled={readOnly}
          />
        </div>
        {!readOnly && (
          <div className="col-span-1 flex justify-end">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={onRemove}
              aria-label="Remove parameter"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground hover:bg-muted/40"
          >
            <span className="flex items-center gap-1.5">
              {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              {param.bands.length} band{param.bands.length === 1 ? "" : "s"}
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t bg-muted/20 p-3 space-y-2">
          <div className="grid grid-cols-12 gap-2 px-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            {param.input_type === "enum" ? (
              <>
                <span className="col-span-4">Value</span>
                <span className="col-span-2">Score</span>
                <span className="col-span-5">Label</span>
                <span className="col-span-1" />
              </>
            ) : (
              <>
                <span className="col-span-2">From</span>
                <span className="col-span-2">To</span>
                <span className="col-span-2">Score</span>
                <span className="col-span-5">Label</span>
                <span className="col-span-1" />
              </>
            )}
          </div>
          {param.bands.map((b, i) =>
            param.input_type === "enum" ? (
              <EnumBandRow
                key={i}
                band={b as EnumBand}
                onChange={(n) => updateBand(i, n)}
                onRemove={() => removeBand(i)}
                readOnly={readOnly}
              />
            ) : (
              <NumericBandRow
                key={i}
                band={b as NumericBand}
                onChange={(n) => updateBand(i, n)}
                onRemove={() => removeBand(i)}
                readOnly={readOnly}
              />
            ),
          )}
          {!readOnly && (
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={addBand}>
              <Plus className="mr-1 h-3 w-3" /> Add band
            </Button>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
