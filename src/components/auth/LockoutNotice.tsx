import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldAlert, Info } from "lucide-react";

/**
 * Inline notice used on every login screen to surface rate-limit /
 * soft-counter feedback without shifting the form layout.
 *
 * Always reserves a fixed min-height so toggling between hidden / soft /
 * locked states doesn't push fields around. Cosmetic only — the actual
 * lockout is enforced by Lovable Cloud Auth at the server (HTTP 429).
 */
type LockoutNoticeProps =
  | { kind: "hidden" }
  | { kind: "soft"; attemptsUsed: number; maxAttempts: number }
  | { kind: "locked"; unlockAt: number; onUnlock?: () => void };

function formatRemaining(ms: number): string {
  if (ms <= 0) return "0:00";
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function LockoutNotice(props: LockoutNoticeProps) {
  const [, force] = useState(0);

  useEffect(() => {
    if (props.kind !== "locked") return;
    const id = window.setInterval(() => {
      force((n) => n + 1);
      if (Date.now() >= props.unlockAt) {
        window.clearInterval(id);
        props.onUnlock?.();
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [props]);

  // Reserved height container — prevents layout shift between states.
  const shell = "min-h-[64px]";

  if (props.kind === "hidden") {
    return <div className={shell} aria-hidden="true" />;
  }

  if (props.kind === "soft") {
    return (
      <div className={shell}>
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            {props.attemptsUsed} of {props.maxAttempts} attempts used. After too
            many failed sign-ins, you'll need to wait before trying again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const remaining = formatRemaining(props.unlockAt - Date.now());
  return (
    <div className={shell}>
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription>
          Too many sign-in attempts. Please try again in <strong>{remaining}</strong>.
        </AlertDescription>
      </Alert>
    </div>
  );
}
