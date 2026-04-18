import { Button } from "@/components/ui/button";
import { Plus, Upload, DollarSign, Clock, AlertTriangle, Zap } from "lucide-react";
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
    <div className="bg-primary text-primary-foreground rounded-2xl shadow-xl overflow-hidden">
      <div className="p-6 sm:p-8 lg:p-10">
        {/* Top row: Greeting + CTAs */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
              {getGreeting()}, {appUser?.full_name ?? "User"}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {partnerName && (
                <span className="text-base font-medium opacity-90">{partnerName}</span>
              )}
              <span className="text-sm opacity-60">{today}</span>
            </div>
            <p className="text-sm opacity-50 mt-3">
              Track leads, uploads, documents, and payouts in one place
            </p>
          </div>

          <div className="flex flex-wrap gap-3 shrink-0">
            <Button
              className="h-12 px-6 text-base font-semibold bg-primary-foreground text-primary hover:bg-primary-foreground/90"
              onClick={() => navigate("/leads/new")}
            >
              <Plus className="mr-2 h-5 w-5" /> Add New Lead
            </Button>
            <Button
              variant="outline"
              className="h-12 px-6 text-base font-semibold border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 bg-transparent"
              onClick={() => navigate("/bulk-upload")}
            >
              <Upload className="mr-2 h-5 w-5" /> Bulk Upload
            </Button>
          </div>
        </div>

        {/* Hero Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 mt-10">
          {heroMetrics.map((m) => {
            const Icon = m.icon;
            return (
              <div
                key={m.label}
                className="flex items-center gap-4 p-5 rounded-xl bg-primary-foreground/10 hover:bg-primary-foreground/15 cursor-pointer transition-colors"
                onClick={m.onClick}
              >
                <div className="bg-primary-foreground/10 p-3 rounded-full shrink-0">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  {loading ? (
                    <Skeleton className="h-8 w-24 bg-primary-foreground/20" />
                  ) : (
                    <p className="text-2xl sm:text-3xl font-extrabold tracking-tight truncate">{m.value}</p>
                  )}
                  <p className="text-xs sm:text-sm opacity-60 mt-0.5">{m.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
