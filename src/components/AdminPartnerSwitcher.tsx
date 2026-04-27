import { usePartnerContext } from "@/hooks/usePartnerContext";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FlaskConical, X } from "lucide-react";

export function AdminPartnerSwitcher({ collapsed }: { collapsed: boolean }) {
  const { isAdmin } = useRoleAccess();
  const { isSimulating, effectivePartnerName, partnerOptions, simulatePartner, effectivePartnerId } = usePartnerContext();

  if (!isAdmin) return null;

  if (collapsed) {
    return isSimulating ? (
      <div className="flex justify-center p-1">
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 p-1">
          <FlaskConical className="h-3 w-3" />
        </Badge>
      </div>
    ) : null;
  }

  return (
    <div className="px-2 py-2 space-y-1.5">
      <Select value={effectivePartnerId ?? "__none__"} onValueChange={(v) => simulatePartner(v === "__none__" ? null : v)}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="Select partner…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">— Admin Mode —</SelectItem>
          {partnerOptions.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.display_name} ({p.partner_code})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isSimulating && (
        <div className="flex items-center gap-1">
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs py-0.5">
            Testing: {effectivePartnerName}
          </Badge>
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => simulatePartner(null)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
