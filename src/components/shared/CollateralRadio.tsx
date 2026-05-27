// 2-state collateral selector (with undefined = no selection). Maps to:
//   "likely"    -> collateral_available = true
//   "unlikely"  -> collateral_available = false
//   undefined   -> collateral_available = null  (user has not chosen)
//
// Notes textarea is REVEALED only when "likely" is chosen but stays OPTIONAL.

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

export type CollateralState = "likely" | "unlikely" | undefined;

export function collateralBoolToState(v: boolean | null | undefined): CollateralState {
  if (v === true) return "likely";
  if (v === false) return "unlikely";
  return undefined;
}

export function collateralStateToBool(s: CollateralState): boolean | null {
  if (s === "likely") return true;
  if (s === "unlikely") return false;
  return null;
}

interface Props {
  state: CollateralState;
  notes: string;
  onChangeState: (s: CollateralState) => void;
  onChangeNotes: (n: string) => void;
  /** Optional id prefix to keep multiple instances on one page accessible. */
  idPrefix?: string;
}

export function CollateralRadio({ state, notes, onChangeState, onChangeNotes, idPrefix = "coll" }: Props) {
  return (
    <div className="space-y-2">
      <div>
        <Label className="text-sm">Collateral likely available?</Label>
      </div>
      <div className="h-10 flex items-center">
        <RadioGroup
          value={state ?? ""}
          onValueChange={(v) => onChangeState(v as CollateralState)}
          className="flex flex-wrap gap-4"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem id={`${idPrefix}-likely`} value="likely" />
            <Label htmlFor={`${idPrefix}-likely`} className="text-sm font-normal cursor-pointer">Yes</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem id={`${idPrefix}-unlikely`} value="unlikely" />
            <Label htmlFor={`${idPrefix}-unlikely`} className="text-sm font-normal cursor-pointer">No</Label>
          </div>
        </RadioGroup>
      </div>
      {state === "likely" && (
        <Textarea
          value={notes}
          onChange={(e) => onChangeNotes(e.target.value)}
          placeholder="Optional — describe collateral if known (type, approximate value, location)"
          rows={2}
        />
      )}
    </div>
  );
}

export const INCOME_SOURCE_OPTIONS = [
  "Salaried",
  "Self-Employed Professional",
  "Self-Employed Non-Professional",
  "Business Owner",
  "Pensioner",
  "Other",
];
