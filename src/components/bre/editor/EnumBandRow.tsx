import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { EnumBand } from "@/lib/bre/types";

interface Props {
  band: EnumBand;
  onChange: (next: EnumBand) => void;
  onRemove: () => void;
  readOnly?: boolean;
}

export function EnumBandRow({ band, onChange, onRemove, readOnly }: Props) {
  return (
    <div className="grid grid-cols-12 items-center gap-2">
      <Input
        value={band.value}
        onChange={(e) => onChange({ ...band, value: e.target.value })}
        className="col-span-4 h-8 text-xs font-mono"
        placeholder="value_key"
        disabled={readOnly}
      />
      <Input
        type="number"
        step="any"
        value={band.score}
        onChange={(e) => onChange({ ...band, score: e.target.value === "" ? 0 : Number(e.target.value) })}
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
