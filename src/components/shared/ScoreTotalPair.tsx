// Reusable Score / Total input pair with live normalized preview.
// Used by Student Education form and Partner/Admin AddLead study step.
//
// Displays:
//   - "<scoreLabel>" input
//   - "<totalLabel>" input
//   - normalized "<X> / <Y> → Normalized: <Z>%" when both present and valid
//   - inline error when the pair is invalid
//   - yellow hint when score is present but total is blank (legacy compat
//     allowed, but the user is nudged to capture total marks)
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeAcademicScore, validateScoreTotalPair, parseNum } from "@/lib/academicScore";

export interface ScoreTotalPairProps {
  label: string;
  required?: boolean;
  scoreKey: string;
  totalKey: string;
  scoreLabel: string;
  totalLabel: string;
  scorePlaceholder?: string;
  totalPlaceholder?: string;
  scoreValue: string;
  totalValue: string;
  onScore: (value: string) => void;
  onTotal: (value: string) => void;
}

export function ScoreTotalPair(props: ScoreTotalPairProps) {
  const {
    required,
    scoreKey,
    totalKey,
    scoreLabel,
    totalLabel,
    scorePlaceholder,
    totalPlaceholder,
    scoreValue,
    totalValue,
    onScore,
    onTotal,
  } = props;

  const validationError = validateScoreTotalPair(scoreValue, totalValue);
  const norm = normalizeAcademicScore(scoreValue, totalValue);
  const showLivePreview = norm.source === "score_total" && norm.percentage != null;
  const scoreNum = parseNum(scoreValue);
  const totalNum = parseNum(totalValue);
  const showTotalMissingHint =
    !validationError && scoreNum != null && (!totalValue || totalValue.trim() === "");

  return (
    <>
      <div className="space-y-1.5" data-field={scoreKey}>
        <Label>
          {scoreLabel}
          {required ? <span className="text-destructive"> *</span> : null}
        </Label>
        <Input
          value={scoreValue}
          onChange={(e) => onScore(e.target.value)}
          placeholder={scorePlaceholder}
          inputMode="decimal"
        />
      </div>
      <div className="space-y-1.5" data-field={totalKey}>
        <Label>{totalLabel}</Label>
        <Input
          value={totalValue}
          onChange={(e) => onTotal(e.target.value)}
          placeholder={totalPlaceholder}
          inputMode="decimal"
        />
        {validationError ? (
          <p className="text-xs font-medium text-destructive">{validationError}</p>
        ) : showLivePreview ? (
          <p className="text-xs text-muted-foreground">
            {scoreNum} / {totalNum} → Normalized: <span className="font-medium text-foreground">{norm.percentage}%</span>
          </p>
        ) : showTotalMissingHint ? (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Tip: enter the total this score is out of (e.g. 100 or 10) for accurate scoring.
          </p>
        ) : null}
      </div>
    </>
  );
}
