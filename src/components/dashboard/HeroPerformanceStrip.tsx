import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Upload, DollarSign, Clock, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/integrations/supabase/types";
import type { KPIData } from "./KPICards";

type AppUser = Tables<"users">;

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatINR(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

interface Props {
  appUser: AppUser | null;
  partnerName: string | null;
  kpiData: KPIData;
  loading: boolean;
}

export function HeroPerformanceStrip({ appUser, partnerName, kpiData, loading }: Props) {
  const navigate = useNavigate();
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const heroMetrics = [
    {
      label: "Total Earned",
      value: formatINR(kpiData.paidPayout),
      icon: DollarSign,
      onClick: () => navigate("/payouts"),
    },
    {
      label: "Pending Payout",
      value: formatINR(kpiData.pendingPayout),
      icon: Clock,
      onClick: () => navigate("/payouts?status=pending"),
    },
    {
      label: "Needs Attention",
      value: kpiData.needsAttention.toString(),
      icon: AlertTriangle,
      onClick: () => navigate("/leads?attention=true"),
    },
  ];

  return (
    <Card className="bg-primary text-primary-foreground shadow-lg overflow-hidden">
      <div className="p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          {/* Left: Greeting + Partner */}
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold">
              {getGreeting()}, {appUser?.full_name ?? "User"}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {partnerName && (
                <span className="text-sm font-medium opacity-90">{partnerName}</span>
              )}
              <span className="text-sm opacity-70">{today}</span>
            </div>
            <p className="text-xs opacity-60 mt-1">
              Track leads, uploads, documents, and payouts in one place
            </p>
          </div>

          {/* Right: CTAs */}
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button
              size="sm"
              variant="secondary"
              className="font-medium"
              onClick={() => navigate("/leads/new")}
            >
              <Plus className="mr-1 h-4 w-4" /> Add New Lead
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => navigate("/bulk-upload")}
            >
              <Upload className="mr-1 h-4 w-4" /> Bulk Upload
            </Button>
          </div>
        </div>

        {/* Hero Metrics */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          {heroMetrics.map((m) => {
            const Icon = m.icon;
            return (
              <div
                key={m.label}
                className="flex items-center gap-3 p-3 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/15 cursor-pointer transition-colors"
                onClick={m.onClick}
              >
                <Icon className="h-5 w-5 opacity-80 shrink-0" />
                <div className="min-w-0">
                  {loading ? (
                    <Skeleton className="h-5 w-16 bg-primary-foreground/20" />
                  ) : (
                    <p className="text-lg font-bold truncate">{m.value}</p>
                  )}
                  <p className="text-[11px] opacity-70">{m.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
