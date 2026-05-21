import { Eye } from "lucide-react";
import { useReadOnly } from "@/components/admin/ReadOnlyContext";

/** Renders a subtle banner when the surrounding section is in view-only mode. */
export function ReadOnlyBanner() {
  const readOnly = useReadOnly();
  if (!readOnly) return null;
  return (
    <div className="mb-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
      <Eye className="h-3.5 w-3.5" />
      <span>View-only access — actions are disabled. Contact a super admin for edit rights.</span>
    </div>
  );
}
