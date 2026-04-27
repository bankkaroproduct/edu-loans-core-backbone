import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * IndianPhoneInput — a thin wrapper over <Input> that:
 *  - Strips any non-digit characters as the user types
 *  - Removes a leading `91` (so paste of `+91 98765 43210` collapses to 10 digits)
 *  - Hard-caps the captured digit count at 10 (Indian mobile format)
 *  - Visually shows a fixed `+91` prefix outside the input
 *
 * The value passed to `onChange` is always the raw 10-digit string (no `+91`,
 * no spaces, no dashes). Persistence layers should prepend `+91` separately
 * (or use `normalizePhone()` from `@/lib/phone`).
 *
 * This component is presentational only — DB normalization (`normalize_phone`
 * trigger) and the existing `isValidIndianPhone` validator remain the source of
 * truth for stored values.
 */
export interface IndianPhoneInputProps
  extends Omit<React.ComponentProps<"input">, "onChange" | "value" | "type"> {
  /** Current raw digits (0–10, no prefix). */
  value: string;
  /** Called with the cleaned, capped digit string. */
  onChange: (digits: string) => void;
  /** Optional className passthrough on the inner input. */
  inputClassName?: string;
}

/** Strip non-digits, drop a leading `91`, then cap at 10 digits. */
export function sanitizeIndianPhoneDigits(input: string): string {
  let digits = (input ?? "").replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("91")) {
    digits = digits.slice(2);
  }
  if (digits.length > 10) digits = digits.slice(0, 10);
  return digits;
}

export const IndianPhoneInput = React.forwardRef<HTMLInputElement, IndianPhoneInputProps>(
  ({ value, onChange, className, inputClassName, placeholder, ...rest }, ref) => {
    // Accept any incoming value shape (e.g. legacy +91XXXXXXXXXX from DB) and
    // surface only the trailing 10 digits in the field.
    const displayValue = sanitizeIndianPhoneDigits(value);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(sanitizeIndianPhoneDigits(e.target.value));
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      // Let the default paste happen — handleChange will sanitize. Keeping this
      // as a no-op makes the intent explicit and lets us add metrics later.
    };

    return (
      <div className={cn("flex items-stretch", className)}>
        <span
          className="inline-flex items-center px-2.5 rounded-l-md border border-r-0 border-input bg-muted text-sm text-muted-foreground select-none"
          aria-hidden="true"
        >
          +91
        </span>
        <Input
          ref={ref}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={10}
          pattern="[0-9]{10}"
          value={displayValue}
          onChange={handleChange}
          onPaste={handlePaste}
          placeholder={placeholder ?? "10-digit mobile number"}
          className={cn("rounded-l-none", inputClassName)}
          {...rest}
        />
      </div>
    );
  },
);
IndianPhoneInput.displayName = "IndianPhoneInput";
