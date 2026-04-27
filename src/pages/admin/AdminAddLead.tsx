import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

/**
 * Admin-native wrapper for the lead creation form.
 * - Compact, single-row Partner Attribution strip (label + searchable picker + status chip).
 * - Reuses the existing AddLead form/business logic — passes containerClassName so the
 *   form fills the admin shell instead of being centered inside max-w-4xl.
 */
export default function AdminAddLead() {
  const { effectivePartnerId, effectivePartnerName, partnerOptions, simulatePartner } = usePartnerContext();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const selected = partnerOptions.find((p) => p.id === effectivePartnerId);

  return (
    <div className="space-y-5 max-w-screen-2xl mx-auto">
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

      {/* Compact Partner Attribution strip — single row */}
      <div className="flex items-center gap-3 flex-wrap rounded-md border bg-card px-3 py-2.5">
        <div className="flex items-center gap-2 shrink-0">
          <Building2 className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Partner</span>
          <Badge variant="secondary" className="text-[10px] uppercase tracking-wide h-5">
            Required
          </Badge>
        </div>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              size="sm"
              className={cn(
                "min-w-[280px] flex-1 max-w-md justify-between font-normal h-9",
                !selected && "text-muted-foreground"
              )}
            >
              <span className="truncate">
                {selected
                  ? selected.partner_code === "PTR-DIRECT"
                    ? `${selected.display_name} — Direct / Admin-owned`
                    : `${selected.display_name} (${selected.partner_code})`
                  : "Search & select a partner organization…"}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
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
                  {partnerOptions.map((p) => {
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

        {selected && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => simulatePartner(null)}
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3 mr-1" /> Clear
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {selected ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-primary">
              <Check className="h-3.5 w-3.5" /> Attributed to {effectivePartnerName ?? selected.display_name}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Choose a partner to enable submission.</span>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Why is partner required?"
                className="text-muted-foreground/60 hover:text-muted-foreground"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs text-xs">
              True admin-owned (unassigned) leads require a future schema change. Every lead must currently be attributed to a partner.
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <AddLead hideOwnHeader adminMode containerClassName="space-y-6" />
    </div>
  );
}
