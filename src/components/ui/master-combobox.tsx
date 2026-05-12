// Searchable Command-popover combobox bound to a master list.
// Includes a "Not available in list" sentinel that exposes a manual input so the
// caller can capture a free-text value while clearing the master id.
//
// Designed for University and Course pickers, but generic over any { id, label } shape.

import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const NOT_IN_LIST_VALUE = "__not_in_list__";

export interface MasterOption {
  id: string;
  label: string;
  /** Optional secondary label, e.g. country for a university. */
  hint?: string;
}

export interface MasterComboboxProps {
  options: MasterOption[];
  /** Selected master id, or empty string when nothing/manual is chosen. */
  selectedId: string;
  /** Manual free-text fallback value (used when "Not in list" is chosen). */
  manualValue: string;
  onSelectMaster: (option: MasterOption) => void;
  onSelectManual: () => void;
  onChangeManual: (text: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  /** Optional helper line shown under the combobox. */
  helperText?: string;
  manualPlaceholder?: string;
  disabled?: boolean;
}

export function MasterCombobox({
  options,
  selectedId,
  manualValue,
  onSelectMaster,
  onSelectManual,
  onChangeManual,
  placeholder = "Search…",
  emptyMessage = "No matches.",
  helperText,
  manualPlaceholder = "Type the name manually",
  disabled = false,
}: MasterComboboxProps) {
  const [open, setOpen] = React.useState(false);
  // Local flag set when the user picks "Not available in list" so the manual
  // input becomes visible immediately. The manual input is shown ONLY when
  // this flag is true — never inferred from manualValue, since some callers
  // store the chosen master label in manualValue (e.g. Course Name).
  const [manualOpened, setManualOpened] = React.useState(false);
  const isManual = !selectedId && manualOpened;
  const selected = options.find((o) => o.id === selectedId) ?? null;

  // Reset local manual flag and clear stray manual text whenever a master
  // option is chosen via selectedId (covers callers that track an id).
  React.useEffect(() => {
    if (selectedId) {
      if (manualOpened) onChangeManual("");
      setManualOpened(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  let triggerLabel = placeholder;
  if (selected) triggerLabel = selected.hint ? `${selected.label} (${selected.hint})` : selected.label;
  else if (isManual) triggerLabel = manualValue.trim() ? `"${manualValue.trim()}" (not in list)` : placeholder;
  else if (manualValue.trim()) triggerLabel = manualValue.trim();

  return (
    <div className="space-y-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full justify-between font-normal h-9 gap-2",
              !selected && !isManual && "text-muted-foreground",
            )}
          >
            <span className="flex-1 min-w-0 truncate text-left">{triggerLabel}</span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder={placeholder} />
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup>
                {options.map((opt) => (
                  <CommandItem
                    key={opt.id}
                    value={`${opt.label} ${opt.hint ?? ""}`}
                    onSelect={() => {
                      // Explicitly close the manual mode BEFORE notifying parent,
                      // so callers that don't track a selectedId (e.g. Course Name)
                      // still hide the free-text input on transition.
                      setManualOpened(false);
                      onSelectMaster(opt);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4 shrink-0", selectedId === opt.id ? "opacity-100" : "opacity-0")} />
                    <span className="flex-1 min-w-0 truncate">{opt.label}</span>
                    {opt.hint && (
                      <span className="ml-auto pl-3 shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                        {opt.hint}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup heading="Other">
                <CommandItem
                  value={NOT_IN_LIST_VALUE}
                  onSelect={() => {
                    setManualOpened(true);
                    onSelectManual();
                    setOpen(false);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Not available in list — type it manually
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {isManual && (
        <Input
          value={manualValue}
          onChange={(e) => onChangeManual(e.target.value)}
          placeholder={manualPlaceholder}
          className="h-9"
        />
      )}

      {helperText && <p className="text-[11px] text-muted-foreground">{helperText}</p>}
    </div>
  );
}
