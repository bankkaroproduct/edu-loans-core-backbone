import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import type { OverallBandRow } from "@/lib/bre/types";
import { emptyOverallBandRow } from "@/lib/bre/empty";

interface Props {
  rows: OverallBandRow[];
  onChange: (next: OverallBandRow[]) => void;
  readOnly?: boolean;
}

export function OverallBandMappingEditor({ rows, onChange, readOnly }: Props) {
  const update = (i: number, patch: Partial<OverallBandRow>) => {
    const copy = [...rows];
    copy[i] = { ...copy[i], ...patch };
    onChange(copy);
  };
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const add = () => onChange([...rows, emptyOverallBandRow()]);

  const num = (v: string): number => (v === "" ? 0 : Number(v));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Overall band mapping</CardTitle>
        <p className="text-xs text-muted-foreground">
          Maps the overall score to a band, eligible loan range, and indicative interest range.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="hidden grid-cols-12 gap-2 px-1 text-[10px] uppercase tracking-wider text-muted-foreground md:grid">
          <span className="col-span-1">From</span>
          <span className="col-span-1">To</span>
          <span className="col-span-1">Band</span>
          <span className="col-span-2">Loan min</span>
          <span className="col-span-2">Loan max</span>
          <span className="col-span-1">Rate min</span>
          <span className="col-span-1">Rate max</span>
          <span className="col-span-2">Label</span>
          <span className="col-span-1" />
        </div>
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-12 items-center gap-2">
            <Input type="number" step="any" value={r.from} onChange={(e) => update(i, { from: num(e.target.value) })} className="col-span-1 h-8 text-xs" disabled={readOnly} />
            <Input type="number" step="any" value={r.to} onChange={(e) => update(i, { to: num(e.target.value) })} className="col-span-1 h-8 text-xs" disabled={readOnly} />
            <Input value={r.band} onChange={(e) => update(i, { band: e.target.value })} className="col-span-1 h-8 text-xs" placeholder="A+" disabled={readOnly} />
            <Input type="number" step="any" value={r.loan_min} onChange={(e) => update(i, { loan_min: num(e.target.value) })} className="col-span-2 h-8 text-xs tabular-nums" disabled={readOnly} />
            <Input type="number" step="any" value={r.loan_max} onChange={(e) => update(i, { loan_max: num(e.target.value) })} className="col-span-2 h-8 text-xs tabular-nums" disabled={readOnly} />
            <Input type="number" step="any" value={r.rate_min} onChange={(e) => update(i, { rate_min: num(e.target.value) })} className="col-span-1 h-8 text-xs tabular-nums" disabled={readOnly} />
            <Input type="number" step="any" value={r.rate_max} onChange={(e) => update(i, { rate_max: num(e.target.value) })} className="col-span-1 h-8 text-xs tabular-nums" disabled={readOnly} />
            <Input value={r.label ?? ""} onChange={(e) => update(i, { label: e.target.value })} className="col-span-2 h-8 text-xs" disabled={readOnly} />
            {!readOnly && (
              <Button type="button" size="icon" variant="ghost" className="col-span-1 h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => remove(i)} aria-label="Remove row">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
        {!readOnly && (
          <Button type="button" size="sm" variant="outline" onClick={add}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add band row
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function BucketThresholdEditor({ value, onChange, readOnly }: { value: number; onChange: (v: number) => void; readOnly?: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Bucket pass threshold</CardTitle>
        <p className="text-xs text-muted-foreground">
          Each bucket (student / university / co-applicant) must reach at least this score for the
          profile to qualify.
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase text-muted-foreground">Threshold (0–100)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={value}
              onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
              className="h-9 w-32 tabular-nums"
              disabled={readOnly}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
