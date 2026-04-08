import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { StageBadge } from "./StageBadge";
import { useNavigate } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";

type Batch = Tables<"bulk_upload_batches">;

export function BulkUploadSnapshot({ batches, loading }: { batches: Batch[]; loading: boolean }) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Recent Bulk Uploads</CardTitle>
        <Button variant="outline" size="sm" onClick={() => navigate("/bulk-upload")}>
          <Upload className="mr-1 h-3 w-3" /> Upload
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-20 w-full" />
        ) : batches.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No bulk uploads yet. Use bulk upload to add multiple leads at once.
          </p>
        ) : (
          <div className="space-y-2">
            {batches.slice(0, 5).map((b) => (
              <div key={b.id} className="flex items-center justify-between p-2 border rounded-lg text-sm">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-muted-foreground">{b.batch_id ?? "—"}</p>
                  <p className="text-xs truncate">{b.file_name}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right text-xs">
                    <span className="text-green-600 font-medium">{b.success_rows}</span>
                    {" / "}
                    <span>{b.total_rows}</span>
                    {b.failed_rows > 0 && (
                      <span className="text-destructive ml-1">({b.failed_rows} failed)</span>
                    )}
                  </div>
                  <StageBadge stage={b.batch_status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
