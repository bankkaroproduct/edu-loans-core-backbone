import { Wallet, SearchX } from "lucide-react";

interface Props {
  hasFilters: boolean;
  onClearFilters?: () => void;
}

export function PayoutEmptyState({ hasFilters, onClearFilters }: Props) {
  if (hasFilters) {
    return (
      <div className="text-center py-12">
        <SearchX className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">No payout records match your current filters.</p>
        {onClearFilters && (
          <button onClick={onClearFilters} className="text-xs text-primary underline mt-2">
            Clear all filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="text-center py-12">
      <Wallet className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
      <p className="text-sm font-medium text-muted-foreground">No payout records yet.</p>
      <p className="text-xs text-muted-foreground mt-1">Earnings will appear here once eligible lead milestones are reached.</p>
    </div>
  );
}
