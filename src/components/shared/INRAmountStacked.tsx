// Two-line INR display: amount on top line, Lakhs/Crore unit on muted line below.
// Used for full-form surfaces (lead detail tiles, profile cards, student review).
// For space-constrained surfaces (list cells, header chips), use formatINRCompact instead.
import { formatINRParts } from "@/lib/formatCurrency";

interface Props {
  value: number | string | null | undefined;
  /** Emphasized amount styling for summary-strip tiles. */
  emphasis?: boolean;
  /** Override the empty-state fallback string. */
  fallback?: string;
  className?: string;
}

export function INRAmountStacked({ value, emphasis = false, fallback = "—", className }: Props) {
  const { amount, unit } = formatINRParts(value, { fallback });
  const amountClass = emphasis
    ? "text-base font-semibold tabular-nums text-foreground"
    : "text-sm font-medium";
  return (
    <span className={`flex flex-col leading-tight ${className ?? ""}`}>
      <span className={`${amountClass} truncate`} title={amount}>{amount}</span>
      {unit && (
        <span className="text-[11px] text-muted-foreground tabular-nums truncate" title={unit}>
          {unit}
        </span>
      )}
    </span>
  );
}
