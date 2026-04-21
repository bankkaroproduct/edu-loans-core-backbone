import { useState } from "react";
import { Card } from "@/components/ui/card";
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
import { ArrowLeft, Building2, Check, ChevronsUpDown, X, ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePartnerContext } from "@/hooks/usePartnerContext";
import { PageHeader } from "@/components/shared/PageHeader";
import { cn } from "@/lib/utils";
import AddLead from "@/pages/AddLead";

/**
 * Admin-native wrapper for the lead creation form.
 * - Renders under AdminLayout with admin-styled PageHeader.
 * - Inline searchable "Partner Attribution" picker drives effectivePartnerId via simulatePartner().
 * - Reuses the existing AddLead form/business logic — zero duplication.
 */
export default function AdminAddLead() {
  const { effectivePartnerId, effectivePartnerName, partnerOptions, simulatePartner } = usePartnerContext();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const selected = partnerOptions.find((p) => p.id === effectivePartnerId);

  return (
    <div className="space-y-4 max-w-screen-2xl mx-auto">
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

      {/* Partner Attribution card */}
      <Card className="p-4 sm:p-5 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="rounded-md bg-primary/10 p-2 shrink-0">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-semibold leading-tight">Partner Attribution</h2>
                <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                  Required
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Every lead must be attributed to a partner organization. Select which partner this new lead will appear under.
              </p>
            </div>
          </div>
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
        </div>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className={cn(
                "w-full justify-between font-normal h-10",
                !selected && "text-muted-foreground"
              )}
            >
              <span className="truncate">
                {selected
                  ? `${selected.display_name} (${selected.partner_code})`
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
                  {partnerOptions.map((p) => (
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
                      <span className="ml-2 text-xs text-muted-foreground">
                        {p.partner_code}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {selected ? (
          <div className="flex items-center gap-2 text-xs text-primary bg-primary/5 border border-primary/20 rounded-md px-2.5 py-1.5">
            <Check className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              Lead will be attributed to <span className="font-medium">{effectivePartnerName ?? selected.display_name}</span>.
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs bg-muted/50 border border-border rounded-md px-2.5 py-1.5 text-muted-foreground">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
            <span>Choose a partner above to enable lead submission.</span>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground/80 leading-relaxed border-t pt-2 mt-1">
          Note: True admin-owned (unassigned) leads require a future schema change and are not supported yet.
        </p>
      </Card>

      <AddLead hideOwnHeader />
    </div>
  );
}
