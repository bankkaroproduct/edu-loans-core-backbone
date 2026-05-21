import { createContext, useContext, type ReactNode } from "react";

const ReadOnlyContext = createContext<boolean>(false);

export function ReadOnlyProvider({ readOnly, children }: { readOnly: boolean; children: ReactNode }) {
  return <ReadOnlyContext.Provider value={readOnly}>{children}</ReadOnlyContext.Provider>;
}

/** Returns true when the surrounding admin section is rendered in view-only mode. */
export function useReadOnly() {
  return useContext(ReadOnlyContext);
}
