import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { NumericBand } from "@/lib/bre/types";

interface Props {
  band: NumericBand;
  onChange: (next: NumericBand) => void;
  onRemove: () => void;
  readOnly?: boolean;
}

export function NumericBandRow({ band, onChange, onRemove, readOnly }: Props) {
  const num = (v: string): number => (v === "" ? 0 : Number(v));
  return (
    <div className="grid grid-cols-12 items-center gap-2">
      <Input
        type="number"
        step="any"
        value={band.from}
        onChange={(e) => onChange({ ...band, from: num(e.target.value) })}
        className="col-span-2 h-8 text-xs"
        placeholder="From"
        disabled={readOnly}
      />
      <Input
        type="number"
        step="any"
        value={band.to}
        onChange={(e) => onChange({ ...band, to: num(e.target.value) })}
        className="col-span-2 h-8 text-xs"
        placeholder="To"
        disabled={readOnly}
      />
      <Input
        type="number"
        step="any"
        value={band.score}
        onChange={(e) => onChange({ ...band, score: num(e.target.value) })}
        className="col-span-2 h-8 text-xs"
        placeholder="Score"
        disabled={readOnly}
      />
      <Input
        value={band.label ?? ""}
        onChange={(e) => onChange({ ...band, label: e.target.value })}
        className="col-span-5 h-8 text-xs"
        placeholder="Label (optional)"
        disabled={readOnly}
      />
      {!readOnly && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="col-span-1 h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          aria-label="Remove band"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
