import { useState } from "react";
import { ChevronDown, ChevronUp, CheckCircle2, XCircle, Star } from "lucide-react";
import { T } from "./tokens";
import type { LenderCard } from "./lenderCardModel";

interface Props {
  card: LenderCard;
  ctaLabel: string;
  onCta: () => void;
  defaultExpandRationale?: boolean;
}

export function LenderMatchCard({ card, ctaLabel, onCta, defaultExpandRationale = false }: Props) {
  const [open, setOpen] = useState(defaultExpandRationale);

  const ineligible = !card.eligible;
  const isBest = card.bestFit && card.eligible;

  const borderColor = isBest ? T.primary : T.hairline;
  const cardStyle: React.CSSProperties = {
    borderColor,
    borderWidth: isBest ? 2 : 1,
    borderRadius: 12,
    background: ineligible ? T.ineligibleBg : "#fff",
    opacity: ineligible ? 0.62 : 1,
    boxShadow: isBest
      ? `0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,54,218,0.10)`
      : `0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.04)`,
    color: T.text,
  };

  const headerGradient = ineligible
    ? `linear-gradient(180deg, ${T.headerStripIneligibleFrom} 0%, ${T.headerStripIneligibleTo} 100%)`
    : `linear-gradient(180deg, ${T.headerStripFrom} 0%, ${T.headerStripTo} 100%)`;

  return (
    <article
      className="flex flex-col overflow-hidden transition-shadow hover:shadow-md"
      style={cardStyle}
    >
      {/* Header strip */}
      <header
        className="flex items-start justify-between gap-3 px-4 pt-3 pb-3"
        style={{ background: headerGradient }}
      >
        <div className="flex items-start gap-2.5 min-w-0">
          <RankChip rank={card.rank} filled={isBest} dimmed={ineligible} />
          <div className="min-w-0">
            <h3
              className="text-[15px] font-extrabold tracking-tight truncate"
              style={{ letterSpacing: "-0.02em" }}
              title={card.name}
            >
              {card.name}
            </h3>
            {card.code && (
              <div
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: T.textTertiary }}
              >
                {card.code}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {ineligible ? (
            <Pill text="Not eligible" bg={T.errorBg} color={T.errorText} />
          ) : (
            <>
              {isBest && (
                <Pill
                  text="★ Best fit"
                  bg={T.peachBg}
                  color={T.accentOrange}
                  icon={<Star className="h-3 w-3 fill-current" />}
                />
              )}
              <Pill text="Eligible" bg={T.successBg} color={T.successText} />
            </>
          )}
        </div>
      </header>

      {/* ROI hero */}
      <div className="px-4 py-3 flex items-stretch gap-3" style={{ borderTop: `1px solid ${T.hairline}` }}>
        <div className="flex-1 min-w-0">
          <div
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: T.textTertiary }}
          >
            {card.roiKind}
          </div>
          <div
            className="mt-0.5 text-[20px] font-extrabold tabular-nums"
            style={{ letterSpacing: "-0.03em" }}
          >
            {card.roiLow != null && card.roiHigh != null
              ? `${card.roiLow}% – ${card.roiHigh}%`
              : "—"}
          </div>
        </div>
        {card.indicativeRoi != null && (
          <div
            className="shrink-0 rounded-lg px-3 py-2 flex flex-col items-end justify-center"
            style={{ background: T.peachBg }}
          >
            <div
              className="text-[9px] font-bold uppercase tracking-wider"
              style={{ color: T.accentOrange }}
            >
              Indicative for you
            </div>
            <div
              className="text-[16px] font-extrabold tabular-nums"
              style={{ letterSpacing: "-0.02em", color: T.text }}
            >
              ~{card.indicativeRoi}%
            </div>
          </div>
        )}
      </div>

      {/* Spec table */}
      {card.rows.length > 0 && (
        <dl className="px-4">
          {card.rows.map((row, idx) => (
            <div
              key={row.key}
              className="flex items-start justify-between gap-3 py-2"
              style={{
                borderTop: idx === 0 ? `1px solid ${T.hairline}` : undefined,
                borderBottom: `1px solid ${T.hairline}`,
              }}
            >
              <dt
                className="text-[12px] font-semibold uppercase tracking-wider pt-0.5"
                style={{ color: T.textSecondary, letterSpacing: "0.04em" }}
              >
                {row.label}
              </dt>
              <dd className="text-right min-w-0 max-w-[60%]">
                <div
                  className="text-[13px] font-semibold tabular-nums"
                  style={{ color: row.emphasis === "danger" ? T.errorText : T.text }}
                >
                  {row.value ?? "—"}
                </div>
                {row.subText && (
                  <div
                    className="text-[11px] mt-0.5"
                    style={{ color: row.emphasis === "danger" ? T.errorText : T.textTertiary }}
                  >
                    {row.subText}
                  </div>
                )}
                {row.progress != null && (
                  <div
                    className="mt-1 h-1 w-24 ml-auto rounded-full overflow-hidden"
                    style={{ background: T.hairline }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${row.progress}%`, background: T.primary }}
                    />
                  </div>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {/* Coverage */}
      <section className="px-4 pt-3 pb-1">
        <div
          className="text-[10px] font-semibold uppercase tracking-wider mb-1.5"
          style={{ color: T.textTertiary }}
        >
          Coverage
        </div>
        <div className="flex flex-wrap gap-1.5">
          {card.coverage.map((c) =>
            c.covered ? (
              <Chip
                key={c.label}
                text={c.label}
                bg={T.successBg}
                color={T.successText}
                icon={<CheckCircle2 className="h-3 w-3" />}
              />
            ) : (
              <Chip
                key={c.label}
                text={c.label}
                bg={T.errorBg}
                color={T.errorText}
                icon={<XCircle className="h-3 w-3" />}
              />
            ),
          )}
        </div>
      </section>

      {/* Lender-specific factors */}
      {card.lenderFactors.length > 0 && (
        <section className="px-4 pt-3 pb-1">
          <div
            className="text-[10px] font-semibold uppercase tracking-wider mb-1.5"
            style={{ color: T.textTertiary }}
          >
            Lender-specific factors
          </div>
          <div className="flex flex-wrap gap-1.5">
            {card.lenderFactors.map((f, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium"
                style={{ background: T.primaryBgSoft, color: T.text }}
              >
                {f.label}
                {f.sourceBacked && (
                  <span
                    className="ml-0.5 rounded-sm px-1 py-[1px] text-[9px] font-bold uppercase"
                    style={{ background: T.successBg, color: T.successText }}
                  >
                    Source-backed
                  </span>
                )}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Ineligibility reasons */}
      {ineligible && card.ineligibilityReasons.length > 0 && (
        <section className="px-4 pt-3 pb-1">
          <div
            className="text-[10px] font-semibold uppercase tracking-wider mb-1.5"
            style={{ color: T.errorText }}
          >
            Why not eligible
          </div>
          <ul className="space-y-0.5">
            {card.ineligibilityReasons.slice(0, 4).map((r, i) => (
              <li key={i} className="text-[12px]" style={{ color: T.textSecondary }}>
                • {r}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Why this lender — collapsible */}
      {card.rationale.length > 0 && (
        <section className="px-4 pt-3 pb-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 text-[12px] font-semibold"
            style={{ color: T.primary }}
            aria-expanded={open}
          >
            {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            Why this lender · {card.rationale.length} reason{card.rationale.length === 1 ? "" : "s"}
          </button>
          {open && (
            <ul className="mt-2 space-y-1">
              {card.rationale.map((r, i) => (
                <li key={i} className="text-[12px]" style={{ color: T.textSecondary }}>
                  • {r}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Footer */}
      <footer
        className="mt-auto flex items-center justify-between px-4 py-3"
        style={{ background: T.screenBg, borderTop: `1px solid ${T.hairline}` }}
      >
        <button
          type="button"
          className="text-[11px] font-medium hover:underline"
          style={{ color: T.textSecondary }}
          onClick={() => {
            console.log("Score calculation details requested");
          }}
        >
          How this score was calculated
        </button>
        <button
          type="button"
          disabled={ineligible}
          onClick={onCta}
          className="rounded-full px-4 py-1.5 text-[12px] font-bold transition-transform active:scale-[0.985] disabled:cursor-not-allowed"
          style={{
            background: ineligible ? T.hairline : T.primary,
            color: ineligible ? T.textTertiary : "#fff",
          }}
          onMouseEnter={(e) => {
            if (!ineligible) (e.currentTarget.style.background = T.primaryHover);
          }}
          onMouseLeave={(e) => {
            if (!ineligible) (e.currentTarget.style.background = T.primary);
          }}
        >
          {ineligible ? "Not eligible" : ctaLabel}
        </button>
      </footer>
    </article>
  );
}

// ─── small bits ────────────────────────────────────────────────────────────

function RankChip({ rank, filled, dimmed }: { rank: number | null; filled: boolean; dimmed: boolean }) {
  return (
    <span
      className="inline-flex h-6 min-w-[1.6rem] items-center justify-center rounded-md px-1.5 text-[11px] font-mono font-bold"
      style={{
        background: filled ? T.primary : T.primaryBgSoft,
        color: filled ? "#fff" : dimmed ? T.textTertiary : T.primary,
      }}
      aria-label={`Rank ${rank ?? "unranked"}`}
    >
      #{rank ?? "—"}
    </span>
  );
}

function Pill({
  text,
  bg,
  color,
  icon,
}: {
  text: string;
  bg: string;
  color: string;
  icon?: React.ReactNode;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{ background: bg, color }}
    >
      {icon}
      {text}
    </span>
  );
}

function Chip({
  text,
  bg,
  color,
  icon,
}: {
  text: string;
  bg: string;
  color: string;
  icon?: React.ReactNode;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ background: bg, color }}
    >
      {icon}
      {text}
    </span>
  );
}
