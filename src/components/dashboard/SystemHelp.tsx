import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, HelpCircle, Info, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";

function downloadBulkTemplate() {
  const headers = [
    "student_first_name", "student_last_name", "student_email", "student_phone",
    "student_whatsapp", "city", "state", "country_of_residence",
    "intended_study_country", "university_name_raw", "course_name", "course_category",
    "intake_term", "intake_year", "loan_amount_required",
    "coapplicant_name", "coapplicant_relation", "coapplicant_income",
    "collateral_available", "collateral_notes",
  ];
  const csv = headers.join(",") + "\n";
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "eduloans_bulk_upload_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function SystemHelp() {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <HelpCircle className="h-4 w-4" /> Help & Resources
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start gap-3 p-2 rounded-lg border">
          <Download className="h-4 w-4 mt-0.5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Bulk Upload Template</p>
            <p className="text-xs text-muted-foreground">
              Download the standard CSV template for bulk lead uploads.
            </p>
          </div>
          <Button variant="outline" size="sm" className="text-xs shrink-0" onClick={downloadBulkTemplate}>
            Download
          </Button>
        </div>

        <div className="flex items-start gap-3 p-2 rounded-lg border">
          <FileText className="h-4 w-4 mt-0.5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Document Checklist Guide</p>
            <p className="text-xs text-muted-foreground">
              View required documents for each lender and study destination.
            </p>
          </div>
          <Button variant="outline" size="sm" className="text-xs shrink-0" onClick={() => navigate("/leads?stage=documents_pending")}>
            View
          </Button>
        </div>

        <div className="flex items-start gap-3 p-2 rounded-lg border">
          <Mail className="h-4 w-4 mt-0.5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Support & Escalation</p>
            <p className="text-xs text-muted-foreground">
              For urgent issues, contact <span className="font-medium">support@eduloans.in</span>
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-2 rounded-lg bg-muted/50 border">
          <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            Track all your submitted leads from the <strong>Submitted Leads</strong> page. Use the sidebar for quick navigation.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
