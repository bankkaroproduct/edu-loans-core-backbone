import { createContext, useContext, useMemo, useState, ReactNode } from "react";

interface HeaderSlotState {
  headerContent: ReactNode | null;
  hideSidebarTrigger: boolean;
  backTo: string | null;
  setHeaderContent: (node: ReactNode | null) => void;
  setHideSidebarTrigger: (hide: boolean) => void;
  setBackTo: (path: string | null) => void;
}

const HeaderSlotContext = createContext<HeaderSlotState | null>(null);

export function HeaderSlotProvider({ children }: { children: ReactNode }) {
  const [headerContent, setHeaderContent] = useState<ReactNode | null>(null);
  const [hideSidebarTrigger, setHideSidebarTrigger] = useState(false);
  const [backTo, setBackTo] = useState<string | null>(null);

  const value = useMemo(
    () => ({
      headerContent,
      hideSidebarTrigger,
      backTo,
      setHeaderContent,
      setHideSidebarTrigger,
      setBackTo,
    }),
    [headerContent, hideSidebarTrigger, backTo]
  );

  return <HeaderSlotContext.Provider value={value}>{children}</HeaderSlotContext.Provider>;
}

export function useHeaderSlot() {
  const ctx = useContext(HeaderSlotContext);
  if (!ctx) throw new Error("useHeaderSlot must be used within HeaderSlotProvider");
  return ctx;
}
