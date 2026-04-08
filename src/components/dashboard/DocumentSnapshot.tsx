import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileCheck, FileX, FileClock, FileUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";

export interface DocSummary {
  pending: number;
  underReview: number;
  verified: number;
  rejected: number;
  reuploadNeeded: number;
}

export function DocumentSnapshot({ data, loading }: { data: DocSummary; loading: boolean }) {
  const navigate = useNavigate();

  const items = [
    { label: "Pending Upload", value: data.pending, icon: FileUp, color: "text-orange-600", route: "/leads?attention=true&stage=documents_pending" },
    { label: "Under Review", value: data.underReview, icon: FileClock, color: "text-amber-600", route: "/leads?stage=documents_under_review" },
    { label: "Verified", value: data.verified, icon: FileCheck, color: "text-green-600", route: "/leads" },
    { label: "Rejected", value: data.rejected, icon: FileX, color: "text-destructive", route: "/leads?attention=true" },
    { label: "Reupload Needed", value: data.reuploadNeeded, icon: FileX, color: "text-rose-600", route: "/leads?attention=true" },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Document Status</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="text-center p-2 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(item.route)}
                >
                  <Icon className={`h-5 w-5 mx-auto mb-1 ${item.color}`} />
                  <p className="text-lg font-bold">{item.value}</p>
                  <p className="text-[10px] text-muted-foreground">{item.label}</p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
