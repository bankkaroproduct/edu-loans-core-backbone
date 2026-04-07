import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const fmt = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function MasterTable({ table, columns }: { table: string; columns: { key: string; label: string }[] }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: rows } = await supabase.from(table as any).select("*").order("created_at", { ascending: false }).limit(100);
      setData(rows ?? []);
      setLoading(false);
    };
    load();
  }, [table]);

  if (loading) return <p className="text-center py-4 text-muted-foreground">Loading...</p>;
  if (data.length === 0) return <p className="text-center py-4 text-muted-foreground">No records</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((c) => (
            <TableHead key={c.key}>{c.label}</TableHead>
          ))}
          <TableHead>Active</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow key={row.id}>
            {columns.map((c) => (
              <TableCell key={c.key} className="text-sm">{String(row[c.key] ?? "—")}</TableCell>
            ))}
            <TableCell>
              <Badge variant={row.active_flag ? "default" : "secondary"}>
                {row.active_flag ? "Yes" : "No"}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function Settings() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Settings & Master Data</h1>

      <Tabs defaultValue="countries">
        <TabsList className="flex-wrap">
          <TabsTrigger value="countries">Countries</TabsTrigger>
          <TabsTrigger value="universities">Universities</TabsTrigger>
          <TabsTrigger value="courses">Courses</TabsTrigger>
          <TabsTrigger value="lenders">Lenders</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="stages">Lifecycle</TabsTrigger>
          <TabsTrigger value="intakes">Intakes</TabsTrigger>
        </TabsList>

        <TabsContent value="countries">
          <Card>
            <CardHeader>
              <CardTitle>Countries</CardTitle>
              <CardDescription>Master list of countries</CardDescription>
            </CardHeader>
            <CardContent>
              <MasterTable table="countries_master" columns={[
                { key: "country_name", label: "Country" },
                { key: "iso_code", label: "ISO Code" },
              ]} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="universities">
          <Card>
            <CardHeader>
              <CardTitle>Universities</CardTitle>
              <CardDescription>Master list of universities</CardDescription>
            </CardHeader>
            <CardContent>
              <MasterTable table="universities_master" columns={[
                { key: "university_name", label: "Name" },
                { key: "country", label: "Country" },
                { key: "ranking_bucket", label: "Ranking" },
              ]} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="courses">
          <Card>
            <CardHeader>
              <CardTitle>Courses</CardTitle>
              <CardDescription>Master list of courses</CardDescription>
            </CardHeader>
            <CardContent>
              <MasterTable table="courses_master" columns={[
                { key: "course_name", label: "Course" },
                { key: "course_category", label: "Category" },
                { key: "stem_flag", label: "STEM" },
                { key: "mba_flag", label: "MBA" },
              ]} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lenders">
          <Card>
            <CardHeader>
              <CardTitle>Lenders</CardTitle>
              <CardDescription>Configured lenders</CardDescription>
            </CardHeader>
            <CardContent>
              <MasterTable table="lenders" columns={[
                { key: "lender_code", label: "Code" },
                { key: "lender_name", label: "Name" },
                { key: "lender_type", label: "Type" },
                { key: "loan_amount_min", label: "Min Loan" },
                { key: "loan_amount_max", label: "Max Loan" },
              ]} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Document Types</CardTitle>
              <CardDescription>Document master for checklists</CardDescription>
            </CardHeader>
            <CardContent>
              <MasterTable table="document_master" columns={[
                { key: "document_code", label: "Code" },
                { key: "document_name", label: "Name" },
                { key: "document_category", label: "Category" },
                { key: "mandatory_flag", label: "Mandatory" },
              ]} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stages">
          <Card>
            <CardHeader>
              <CardTitle>Lifecycle Stages</CardTitle>
              <CardDescription>Lead lifecycle stages</CardDescription>
            </CardHeader>
            <CardContent>
              <MasterTable table="lifecycle_stage_master" columns={[
                { key: "stage_key", label: "Key" },
                { key: "stage_label", label: "Label" },
                { key: "sort_order", label: "Order" },
                { key: "is_terminal", label: "Terminal" },
              ]} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="intakes">
          <Card>
            <CardHeader>
              <CardTitle>Intakes</CardTitle>
              <CardDescription>Available intake terms</CardDescription>
            </CardHeader>
            <CardContent>
              <MasterTable table="intake_master" columns={[
                { key: "intake_term", label: "Term" },
                { key: "intake_year", label: "Year" },
                { key: "sort_order", label: "Order" },
              ]} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
