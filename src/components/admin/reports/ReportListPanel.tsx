import { ReactNode } from "react";

export function ReportListGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: "10.5px",
          fontWeight: 700,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          color: "#6B7684",
          padding: "14px 22px 10px",
          background: "#FAFBFC",
          borderBottom: "1px solid #F1F3F6",
        }}
      >
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

export function ReportListPanel({ children }: { children: ReactNode }) {
  return (
    <div
      className="rp-reports"
      style={{
        background: "#FFFFFF",
        border: "1px solid #ECEEF1",
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}
