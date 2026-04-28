// Searchable Indian city/district combobox.
//
// Source: public.pincode_master (distinct district + state). This is the only
// structured Indian-geo source currently available in the project — there is
// no separate city/town/locality master table. Districts in pincode_master
// represent the administrative area covering a city/town and are the closest
// reliable proxy. The visible label says "City / District" so users are not
// misled into thinking these are pure city names.
//
// Behavior:
// - Server-side debounced search (250ms), case-insensitive, matches district
//   OR state. Caps results to 50.
// - Controlled manual fallback: user must explicitly click "Type manually" to
//   reveal a free-text input. Free-text is retained but clearly labelled as
//   manual so it does not silently bypass the dropdown.
// - When a master option is picked, manual mode is exited and value is set
//   to the district string (state is shown as hint only).
// - Single string value (the city/district name) — drop-in replacement for
//   a plain text city input. No schema change.

import * as React from "react";
import { Check, ChevronsUpDown, Plus, Loader2 } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";

interface CityOption {
  district: string;
  state: string;
}

export interface IndianCityComboboxProps {
  value: string;
  onChange: (city: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Optional label for the manual mode helper line. */
  helperText?: string;
}

export function IndianCityCombobox({
  value,
  onChange,
  placeholder = "Search city or district…",
  disabled = false,
  helperText,
}: IndianCityComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [options, setOptions] = React.useState<CityOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [manualMode, setManualMode] = React.useState(false);
  const seqRef = React.useRef(0);

  // Debounced server search
  React.useEffect(() => {
    if (!open) return;
    const term = query.trim();
    const seq = ++seqRef.current;
    setLoading(true);
    const handle = window.setTimeout(async () => {
      let q = supabase
        .from("pincode_master")
        .select("district, state")
        .not("district", "is", null)
        .order("district", { ascending: true })
        .limit(500);

      if (term.length >= 1) {
        q = q.or(`district.ilike.%${term}%,state.ilike.%${term}%`);
      }

      const { data, error } = await q;
      if (seq !== seqRef.current) return;
      if (error || !data) {
        setOptions([]);
        setLoading(false);
        return;
      }
      // De-dupe (district + state)
      const seen = new Set<string>();
      const deduped: CityOption[] = [];
      for (const row of data) {
        const d = (row.district ?? "").trim();
        const s = (row.state ?? "").trim();
        if (!d) continue;
        const key = `${d.toLowerCase()}|${s.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push({ district: d, state: s });
        if (deduped.length >= 50) break;
      }
      setOptions(deduped);
      setLoading(false);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [query, open]);

  const triggerLabel = value
    ? value
    : placeholder;

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
              "w-full justify-between font-normal h-9",
              !value && "text-muted-foreground"
            )}
          >
            <span className="truncate text-left">
              {triggerLabel}
              {manualMode && value && (
                <span className="ml-2 text-[11px] text-muted-foreground">(manual)</span>
              )}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Type to search Indian cities / districts…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {loading && (
                <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" /> Searching…
                </div>
              )}
              {!loading && options.length === 0 && (
                <CommandEmpty>No matches. Try a different term or use manual entry.</CommandEmpty>
              )}
              {!loading && options.length > 0 && (
                <CommandGroup heading="Cities / Districts">
                  {options.map((opt) => {
                    const key = `${opt.district}|${opt.state}`;
                    const selected = value.trim().toLowerCase() === opt.district.toLowerCase();
                    return (
                      <CommandItem
                        key={key}
                        value={key}
                        onSelect={() => {
                          onChange(opt.district);
                          setManualMode(false);
                          setOpen(false);
                        }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
                        <span className="truncate">{opt.district}</span>
                        {opt.state && (
                          <span className="ml-2 text-xs text-muted-foreground">{opt.state}</span>
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
              <CommandGroup heading="Other">
                <CommandItem
                  value="__manual__"
                  onSelect={() => {
                    setManualMode(true);
                    setOpen(false);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Type city manually
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {manualMode && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type city name"
          className="h-9"
        />
      )}

      {helperText && <p className="text-[11px] text-muted-foreground">{helperText}</p>}
    </div>
  );
}
