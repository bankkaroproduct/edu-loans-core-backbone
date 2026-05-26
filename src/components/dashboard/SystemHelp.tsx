import { Download, FileText, HelpCircle, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";

function downloadBulkTemplate() {
  const a = document.createElement("a");
  a.href = "/Bulk_Upload_Template_File.xlsx";
  a.download = "Bulk_Upload_Template_File.xlsx";
  a.click();
}

export function SystemHelp() {
  const navigate = useNavigate();

  const tiles = [
    {
      key: "bulk",
      title: "Bulk Upload Template",
      sub: "Download the XLSX template (with dropdowns). Save Sheet 1 as CSV before uploading.",
      icon: Download,
      onClick: downloadBulkTemplate,
    },
    {
      key: "docs",
      title: "Document Checklist",
      sub: "View required documents for each lender and study destination.",
      icon: FileText,
      onClick: () => navigate("/leads?stage=documents_pending"),
    },
    {
      key: "support",
      title: "Support & Escalation",
      sub: "For urgent issues, contact support@eduloans.in",
      icon: Mail,
      onClick: undefined,
    },
  ];

  return (
    <section
      className="rounded-[12px] border bg-white"
      style={{ borderColor: "var(--pp-border-1)" }}
    >
      <header
        className="flex items-center justify-between px-5 py-4 border-b"
        style={{ borderColor: "var(--pp-border-2)" }}
      >
        <div className="flex items-center gap-2">
          <HelpCircle className="h-[18px] w-[18px]" style={{ color: "var(--pp-blue)" }} />
          <div>
            <h3
              className="text-[16px] font-extrabold"
              style={{ letterSpacing: "-0.015em", color: "var(--pp-fg-1)" }}
            >
              Help & Resources
            </h3>
            <p
              className="text-[11.5px] font-medium"
              style={{ color: "var(--pp-fg-3)" }}
            >
              Get up to speed in minutes
            </p>
          </div>
        </div>
      </header>
      <div className="p-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={t.onClick}
              disabled={!t.onClick}
              className="flex items-start gap-3 p-[14px] rounded-[10px] border text-left transition-colors hover:bg-[#FAFBFC] disabled:cursor-default"
              style={{ borderColor: "var(--pp-border-1)" }}
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-[9px] shrink-0"
                style={{ background: "#EEF2FF", color: "var(--pp-blue)" }}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-bold" style={{ color: "var(--pp-fg-1)" }}>
                  {t.title}
                </p>
                <p
                  className="text-[11.5px] leading-[1.4] mt-0.5"
                  style={{ color: "var(--pp-fg-3)" }}
                >
                  {t.sub}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
