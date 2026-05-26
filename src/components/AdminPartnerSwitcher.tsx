import { usePartnerContext } from "@/hooks/usePartnerContext";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FlaskConical, X, ChevronDown } from "lucide-react";

export function AdminPartnerSwitcher({ collapsed }: { collapsed: boolean }) {
  const { isAdmin } = useRoleAccess();
  const { allowAdminMode, assignedPartnerIds, isSuperAdmin } = useAdminPermissions();
  const { isSimulating, effectivePartnerName, partnerOptions, simulatePartner, effectivePartnerId } = usePartnerContext();

  if (!isAdmin) return null;

  const visibleOptions = isSuperAdmin || assignedPartnerIds.length === 0
    ? partnerOptions
    : partnerOptions.filter((p) => assignedPartnerIds.includes(p.id));

  if (collapsed) {
    return isSimulating ? (
      <div className="flex justify-center p-1">
        <Badge variant="outline" className="bg-[#FFF5ED] text-[#B5470F] border-[#FFE0CC] p-1">
          <FlaskConical className="h-3 w-3" />
        </Badge>
      </div>
    ) : null;
  }

  return (
    <div className="px-2 py-2 space-y-2">
      {/* "Acting as partner" bordered card */}
      <div className="rounded-[8px] border border-[#ECEEF1] bg-white px-2.5 py-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.10em] text-[#9AA3AE] mb-1">
          Acting as partner
        </p>
        <Select
          value={effectivePartnerId ?? "__none__"}
          onValueChange={(v) => simulatePartner(v === "__none__" ? null : v)}
        >
          <SelectTrigger className="h-7 border-0 bg-transparent p-0 text-[12.5px] font-semibold text-[#1C1B1F] hover:text-[#0036DA] focus:ring-0 [&>svg]:hidden">
            <SelectValue placeholder="Select partner…" />
            <ChevronDown className="h-3.5 w-3.5 text-[#6B7684]" />
          </SelectTrigger>
          <SelectContent>
            {allowAdminMode && <SelectItem value="__none__">— Admin Mode —</SelectItem>}
            {visibleOptions.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.display_name} ({p.partner_code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Testing chip */}
      {isSimulating && (
        <div className="flex items-center justify-between gap-1.5 rounded-full border border-[#FFE0CC] bg-[#FFF5ED] pl-2.5 pr-1 py-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FF6D1D] opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#FF6D1D]" />
            </span>
            <span className="text-[11px] font-semibold text-[#B5470F] truncate">
              Testing: {effectivePartnerName}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0 text-[#B5470F] hover:bg-[#FFE0CC]"
            onClick={() => simulatePartner(null)}
            aria-label="Stop simulating"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
