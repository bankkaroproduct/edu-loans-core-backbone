import { useNavigate } from "react-router-dom";
import { ClipboardCheck, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminPendingRequests } from "@/hooks/useAdminPendingRequests";

export function AdminRequestsSnapshot() {
  const navigate = useNavigate();
  const { count, loading } = useAdminPendingRequests();

  return (
    <div className="rounded-[12px] border border-[#ECEEF1] bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[#F1F3F6] px-5 py-[18px]">
        <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#F3EEFF] text-[#9747FF]">
          <ClipboardCheck className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h3 className="text-[15px] font-extrabold text-[#1C1B1F] leading-none">Requests &amp; Approvals</h3>
          <p className="mt-1 text-[11.5px] text-[#6B7684]">Pending sign-off from your team</p>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-5">
        {loading ? (
          <div className="flex items-center gap-4">
            <Skeleton className="h-11 w-12" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <p className="text-[44px] font-extrabold leading-none tracking-[-0.04em] tabular-nums text-[#1C1B1F]">
              {count}
            </p>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[#1C1B1F]">
                {count === 0 ? "All caught up" : `${count} pending request${count !== 1 ? "s" : ""}`}
              </p>
              <p className="mt-0.5 text-[11.5px] text-[#6B7684]">
                {count === 0 ? "No pending requests right now" : "Awaiting admin action"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Tappable footer row */}
      <div className="px-5 pb-5">
        <button
          type="button"
          onClick={() => navigate("/admin/requests")}
          className="flex w-full items-center justify-between rounded-[8px] border border-[#ECEEF1] bg-[#FAFBFC] px-[14px] py-3 text-[13px] font-semibold text-[#1C1B1F] transition-colors hover:bg-[#F5F7FA]"
        >
          <span>View all requests</span>
          <ArrowRight className="h-4 w-4 text-[#45505C]" />
        </button>
      </div>
    </div>
  );
}
