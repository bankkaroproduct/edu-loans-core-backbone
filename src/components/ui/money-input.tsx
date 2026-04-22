// Indian-grouped numeric input. Displays "12,34,567" while storing raw "1234567".
// Strips non-digits on every keystroke. Empty input → empty string (caller decides null vs 0).
import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function formatIndian(raw: string): string {
  if (!raw) return "";
  const n = raw.replace(/\D/g, "");
  if (!n) return "";
  // Indian grouping: last 3 digits, then groups of 2.
  const last3 = n.slice(-3);
  const rest = n.slice(0, -3);
  if (!rest) return last3;
  const restGrouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${restGrouped},${last3}`;
}

export interface MoneyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value: string | number | null | undefined;
  onChange: (rawDigits: string) => void;
  prefix?: string; // default "₹"
}

export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onChange, prefix = "₹", className, placeholder, ...rest }, ref) => {
    const raw = value === null || value === undefined ? "" : String(value).replace(/\D/g, "");
    const display = formatIndian(raw);
    return (
      <div className={cn("flex", className)}>
        <span className="flex items-center rounded-l-md border border-r-0 bg-muted px-3 text-sm text-muted-foreground">
          {prefix}
        </span>
        <Input
          ref={ref}
          inputMode="numeric"
          autoComplete="off"
          value={display}
          placeholder={placeholder ?? "0"}
          onChange={(e) => {
            const digitsOnly = e.target.value.replace(/\D/g, "");
            onChange(digitsOnly);
          }}
          className="rounded-l-none"
          {...rest}
        />
      </div>
    );
  },
);
MoneyInput.displayName = "MoneyInput";
