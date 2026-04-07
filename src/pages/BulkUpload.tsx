import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Batch = Tables<"bulk_upload_batches">;

const statusColors: Record<string, string> = {
  uploaded: "bg-primary/10 text-primary",
  processing: "bg-accent text-accent-foreground",
  completed: "bg-primary/20 text-primary",
  completed_with_errors: "bg-destructive/10 text-destructive",
  failed: "bg-destructive/10 text-destructive",
};

const fmt = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default function BulkUpload() {
  const { appUser } = useAuth();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("bulk_upload_batches")
        .select("*")
        .order("uploaded_at", { ascending: false })
        .limit(50);
      setBatches(data ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const downloadTemplate = () => {
    const headers = [
      "student_first_name", "student_last_name", "student_email", "student_phone",
      "student_whatsapp", "city", "state", "country_of_residence",
      "intended_study_country", "intake_term", "intake_year", "course_name",
      "university_name", "loan_amount_required", "coapplicant_name",
      "coapplicant_relation", "coapplicant_income", "collateral_available",
    ];
    const csv = headers.join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lead_upload_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !appUser?.partner_id) return;

    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a CSV file");
      return;
    }

    const text = await file.text();
    const lines = text.trim().split("\n");
    const totalRows = Math.max(lines.length - 1, 0);

    const { error } = await supabase.from("bulk_upload_batches").insert({
      partner_id: appUser.partner_id,
      uploaded_by: appUser.id,
      file_name: file.name,
      total_rows: totalRows,
      batch_status: "uploaded",
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Uploaded ${file.name} with ${totalRows} rows. Processing will begin shortly.`);
      const { data } = await supabase.from("bulk_upload_batches").select("*").order("uploaded_at", { ascending: false }).limit(50);
      setBatches(data ?? []);
    }

    e.target.value = "";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Bulk Upload</h1>
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="mr-1 h-4 w-4" /> Download Template
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upload CSV File</CardTitle>
          <CardDescription>Upload a CSV file with lead data. Download the template first to see the required format.</CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 cursor-pointer hover:bg-muted/30 transition-colors">
            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-1">Click to upload CSV file</p>
            <p className="text-xs text-muted-foreground">Maximum 1000 rows per batch</p>
            <input type="file" accept=".csv" className="hidden" onChange={handleUpload} />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-4 w-4" /> Upload History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Loading...</p>
          ) : batches.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No uploads yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch ID</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Success</TableHead>
                  <TableHead>Failed</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Uploaded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-sm">{b.batch_id ?? "—"}</TableCell>
                    <TableCell className="max-w-[150px] truncate">{b.file_name}</TableCell>
                    <TableCell>{b.total_rows}</TableCell>
                    <TableCell>{b.success_rows}</TableCell>
                    <TableCell>{b.failed_rows}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusColors[b.batch_status] ?? ""}>{fmt(b.batch_status)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(b.uploaded_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
