import { useLayoutEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronUp } from "lucide-react";

/**
 * Height-based collapse wrapper for Lead Detail profile cards.
 * Default clips at 280px with a "View More" toggle.
 */
export default function ProfileSectionCard({
  icon: Icon,
  title,
  children,
  collapsedMaxHeight = 280,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  children: ReactNode;
  collapsedMaxHeight?: number;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(true);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const measure = () => {
      // Temporarily clear maxHeight to read true scrollHeight
      const prev = el.style.maxHeight;
      el.style.maxHeight = "none";
      const full = el.scrollHeight;
      el.style.maxHeight = prev;
      setOverflows(full > collapsedMaxHeight + 8);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [collapsedMaxHeight, children]);

  const isClipped = overflows && collapsed;

  return (
    <Card className="rounded-xl border-border/60 shadow-[0_1px_2px_rgba(15,23,42,0.04)] self-start h-fit">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
            <Icon className="h-3.5 w-3.5 text-primary" />
          </span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          ref={contentRef}
          style={{ maxHeight: isClipped ? collapsedMaxHeight : undefined }}
          className={isClipped ? "overflow-hidden relative" : ""}
          // @ts-expect-error inert is a valid HTML attribute, types lag behind
          inert={isClipped ? "" : undefined}
          aria-hidden={isClipped ? true : undefined}
        >
          {children}
          {isClipped && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card to-transparent" />
          )}
        </div>
        {overflows && (
          <div className="mt-3 flex justify-center border-t border-border/60 pt-2">
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              {collapsed ? (
                <>
                  View More <ChevronDown className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  View Less <ChevronUp className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
