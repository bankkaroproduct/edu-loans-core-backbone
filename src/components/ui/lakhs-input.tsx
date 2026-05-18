// Lakhs-shorthand currency input.
//
// User types a value in lakhs (e.g. "25" → ₹25,00,000 ; "12.5" → ₹12,50,000).
// Internally emits a raw rupee digit string via onChange — drop-in compatible
// with existing callers that previously stored MoneyInput's raw digits and
// later did Number(value) for DB persistence (rupees, not lakhs).
//
// Storage contract (unchanged):
//   - DB column loan_amount_required continues to hold absolute rupees.
//   - value prop accepts the raw rupee number/string already stored.
//   - onChange(rawDigits) returns the raw rupee digit string, so existing
//     submit code (Number(form.loan_amount_required)) keeps working.
//
// UX: live preview "= ₹25,00,000" shown beneath the input.

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatINRParts } from "@/lib/formatCurrency";

/** Convert rupee digit string (e.g. "2500000") into lakhs string ("25"). */
function rupeesToLakhsString(rupees: string): string {
  if (!rupees) return "";
  const n = Number(rupees);
  if (!isFinite(n) || n <= 0) return "";
  const lakhs = n / 100000;
  // Trim trailing zeros (25.00 → 25, 12.50 → 12.5)
  return Number.isInteger(lakhs) ? String(lakhs) : String(parseFloat(lakhs.toFixed(2)));
}

/** Parse user lakhs input → rupee digit string. Accepts ".", up to 2 decimals. */
function lakhsTextToRupeeDigits(text: string): { rupees: string; previewRupees: number } {
  const cleaned = text.replace(/[^0-9.]/g, "");
  // Keep only first dot
  const firstDot = cleaned.indexOf(".");
  const normalized =
    firstDot === -1
      ? cleaned
      : cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
  if (!normalized || normalized === ".") return { rupees: "", previewRupees: 0 };
  const lakhs = parseFloat(normalized);
  if (!isFinite(lakhs) || lakhs <= 0) return { rupees: "", previewRupees: 0 };
  const rupees = Math.round(lakhs * 100000);
  return { rupees: String(rupees), previewRupees: rupees };
}

export interface LakhsInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  /** Stored as raw rupees (number or digit string). */
  value: string | number | null | undefined;
  /** Emits raw rupee digit string — same contract as MoneyInput. */
  onChange: (rawRupeeDigits: string) => void;
}

export const LakhsInput = React.forwardRef<HTMLInputElement, LakhsInputProps>(
  ({ value, onChange, className, placeholder, ...rest }, ref) => {
    // Keep local string so user can freely type "12.", "12.5", etc.
    const externalRupees =
      value === null || value === undefined ? "" : String(value).replace(/\D/g, "");
    const [text, setText] = React.useState<string>(() => rupeesToLakhsString(externalRupees));
    const lastEmittedRef = React.useRef<string>(externalRupees);

    // Sync from external when parent changes value via a non-input source
    // (e.g. draft load). Avoid clobbering mid-typing.
    React.useEffect(() => {
      if (externalRupees !== lastEmittedRef.current) {
        setText(rupeesToLakhsString(externalRupees));
        lastEmittedRef.current = externalRupees;
      }
    }, [externalRupees]);

    const { previewRupees } = lakhsTextToRupeeDigits(text);

    const preview = previewRupees > 0 ? formatINRParts(previewRupees) : null;

    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className={cn("flex", className)}>
          <span className="flex items-center rounded-l-md border border-r-0 bg-muted px-3 text-sm text-muted-foreground">
            ₹ Lakhs
          </span>
          <Input
            ref={ref}
            inputMode="decimal"
            autoComplete="off"
            value={text}
            placeholder={placeholder ?? "e.g. 25 or 12.5"}
            onChange={(e) => {
              const next = e.target.value;
              setText(next);
              const { rupees } = lakhsTextToRupeeDigits(next);
              lastEmittedRef.current = rupees;
              onChange(rupees);
            }}
            className="rounded-l-none"
            {...rest}
          />
        </div>
        {preview && (
          <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
            {preview.amount}
            {preview.unit ? ` · ${preview.unit}` : ""}
          </span>
        )}
      </div>
    );
  }
);
LakhsInput.displayName = "LakhsInput";
