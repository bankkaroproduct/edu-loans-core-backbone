import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity } from "lucide-react";

export interface ActivityItem {
  id: string;
  label: string;
  leadId: string | null;
  description: string;
  timestamp: string;
  actor: string;
}

export function ActivityFeed({ items, loading }: { items: ActivityItem[]; loading: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4" /> Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No recent activity. Activity will appear here as you submit leads and progress updates.
          </p>
        ) : (
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {items.map((item) => (
              <div key={item.id} className="flex gap-3 text-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{item.label}</span>
                    {item.leadId && (
                      <span className="text-xs font-mono text-muted-foreground">{item.leadId}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(item.timestamp).toLocaleDateString()}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{item.actor}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
