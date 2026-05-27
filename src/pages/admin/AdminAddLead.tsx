import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, Building2, Check, ChevronsUpDown, X, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePartnerContext } from "@/hooks/usePartnerContext";
import { PageHeader } from "@/components/shared/PageHeader";
import { cn } from "@/lib/utils";
import AddLead from "@/pages/AddLead";
import { useReadOnly } from "@/components/admin/ReadOnlyContext";
import { ReadOnlyBanner } from "@/components/admin/ReadOnlyBanner";

/**
 * Admin-native wrapper for the lead creation form.
 * - Compact, single-row Partner Attribution strip (label + searchable picker + status chip).
 * - Reuses the existing AddLead form/business logic — passes containerClassName so the
 *   form fills the admin shell instead of being centered inside max-w-4xl.
 */
export default function AdminAddLead() {
  const readOnly = useReadOnly();
  const { effectivePartnerId, effectivePartnerName, partnerOptions, simulatePartner } = usePartnerContext();
  const { isSuperAdmin, assignedPartnerIds, loading: permsLoading } = useAdminPermissions();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // Non-super admins should only see their assigned partners + PTR-DIRECT
  // (already merged into assignedPartnerIds by useAdminPermissions).
  const visiblePartnerOptions = useMemo(() => {
    if (isSuperAdmin) return partnerOptions;
    const allowed = new Set(assignedPartnerIds);
    return partnerOptions.filter((p) => allowed.has(p.id));
  }, [isSuperAdmin, assignedPartnerIds, partnerOptions]);

  // Default partner selection to Student Direct (PTR-DIRECT) when nothing is
  // simulated yet. Runs once options resolve; respects any existing selection.
  useEffect(() => {
    if (permsLoading) return;
    if (effectivePartnerId) return;
    const ptrDirect = visiblePartnerOptions.find((p) => p.partner_code === "PTR-DIRECT");
    if (ptrDirect) simulatePartner(ptrDirect.id);
  }, [permsLoading, effectivePartnerId, visiblePartnerOptions, simulatePartner]);

  const selected = visiblePartnerOptions.find((p) => p.id === effectivePartnerId);

  return (
    <div className="add-lead-shell space-y-5 max-w-screen-2xl mx-auto">
      <div className="flex items-start gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/admin/leads")}
          className="mt-1"
          aria-label="Back to leads"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <PageHeader
            title="Add Lead — Admin Console"
            description="Create a lead on behalf of a partner organization."
          />
        </div>
      </div>

      {/* Partner Attribution — ContextCard chrome wrapping the existing
          searchable Popover + Command picker. Mechanics unchanged: open state,
          simulatePartner, Clear, Tooltip behave exactly as before. */}
      <div
        className="flex flex-wrap items-center gap-3 rounded-[12px] border border-[color:var(--al-border-3)] px-[18px] py-3.5"
        style={{ background: "linear-gradient(180deg, #F7F9FF 0%, #FFFFFF 100%)" }}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[color:var(--al-border-3)] bg-[color:var(--al-bg-card)]">
          <Building2 className="h-5 w-5 text-[color:var(--al-blue)]" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-[color:var(--al-fg-muted)]">
              Partner
            </span>
            <Badge variant="secondary" className="text-[9px] uppercase tracking-wide h-4 px-1.5">
              Required
            </Badge>
          </div>

          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                role="combobox"
                aria-expanded={open}
                className={cn(
                  "group mt-0.5 flex w-full items-center gap-2 rounded-md text-left",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--al-blue)] focus-visible:ring-offset-2"
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-extrabold tracking-[-0.01em] text-[color:var(--al-fg-1)]">
                    {selected
                      ? selected.partner_code === "PTR-DIRECT"
                        ? selected.display_name
                        : `${selected.display_name} (${selected.partner_code})`
                      : "Select a partner organization…"}
                  </span>
                  <span className="mt-0.5 block truncate text-[11.5px] font-semibold text-[color:var(--al-fg-2)]">
                    {selected
                      ? selected.partner_code === "PTR-DIRECT"
                        ? "Direct / Admin-owned lead — excluded from partner reports"
                        : `Attributed to ${effectivePartnerName ?? selected.display_name}`
                      : "Search by partner name or code — or pick Student Direct for admin-owned leads."}
                  </span>
                </span>
                <ChevronsUpDown className="h-4 w-4 shrink-0 text-[color:var(--al-fg-3)] group-hover:text-[color:var(--al-fg-1)]" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[--radix-popover-trigger-width] p-0"
              align="start"
            >
              <Command>
                <CommandInput placeholder="Search partner by name or code…" />
                <CommandList>
                  <CommandEmpty>No partners match that search.</CommandEmpty>
                  <CommandGroup>
                    {visiblePartnerOptions.map((p) => {
                      const isDirect = p.partner_code === "PTR-DIRECT";
                      return (
                        <CommandItem
                          key={p.id}
                          value={`${p.display_name} ${p.partner_code}`}
                          onSelect={() => {
                            simulatePartner(p.id);
                            setOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              effectivePartnerId === p.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="truncate">{p.display_name}</span>
                          {isDirect ? (
                            <Badge variant="secondary" className="ml-2 text-[9px] uppercase tracking-wide h-4 px-1.5">
                              Direct / System
                            </Badge>
                          ) : (
                            <span className="ml-2 text-xs text-muted-foreground">
                              {p.partner_code}
                            </span>
                          )}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {selected && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[color:var(--al-success-tint)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--al-success)]">
            <Check className="h-3 w-3" />
            {selected.partner_code === "PTR-DIRECT" ? "Direct" : "Verified"}
          </span>
        )}

        {selected && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => simulatePartner(null)}
            className="h-7 text-xs text-[color:var(--al-fg-2)] hover:text-[color:var(--al-fg-1)]"
          >
            <X className="h-3 w-3 mr-1" /> Clear
          </Button>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Why is partner required?"
              className="shrink-0 text-[color:var(--al-fg-3)] hover:text-[color:var(--al-fg-1)]"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-xs text-xs">
            Every lead must be attributed. Pick a real partner organization, or select <strong>Student Direct (PTR-DIRECT)</strong> for walk-in / admin-originated leads. PTR-DIRECT is excluded from billable partner reports.
          </TooltipContent>
        </Tooltip>
      </div>

      <ReadOnlyBanner />
      <div className={readOnly ? "pointer-events-none opacity-60 select-none" : ""} aria-disabled={readOnly}>
        <AddLead hideOwnHeader adminMode containerClassName="space-y-6" />
      </div>
    </div>
  );
}
