import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { BookOpen, Search, Info } from "lucide-react";

type Column = { key: string; label: string };

interface MasterTableProps {
  table: string;
  columns: Column[];
  searchKeys: string[];
  orderBy?: { column: string; ascending: boolean };
  filterActive?: boolean;
  searchPlaceholder?: string;
}

function MasterTable({ table, columns, searchKeys, orderBy, filterActive = true, searchPlaceholder }: MasterTableProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      let query = supabase.from(table as any).select("*");
      if (filterActive) query = query.eq("active_flag", true);
      if (orderBy) query = query.order(orderBy.column, { ascending: orderBy.ascending });
      const { data: rows } = await query.limit(1000);
      if (!cancelled) {
        setData(rows ?? []);
        setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [table, filterActive, orderBy?.column, orderBy?.ascending]);

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.trim().toLowerCase();
    return data.filter((row) =>
      searchKeys.some((k) => String(row[k] ?? "").toLowerCase().includes(q))
    );
  }, [data, search, searchKeys]);

  if (loading) return <PageSkeleton variant="table" />;

  return (
    <div className="space-y-3">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder ?? "Search…"}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No matching records"
          description={search ? "Try a different search term." : "No reference data available."}
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((c) => (
                  <TableHead key={c.key}>{c.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow key={row.id}>
                  {columns.map((c) => {
                    const val = row[c.key];
                    if (typeof val === "boolean") {
                      return (
                        <TableCell key={c.key}>
                          <Badge variant={val ? "default" : "secondary"}>{val ? "Yes" : "No"}</Badge>
                        </TableCell>
                      );
                    }
                    return (
                      <TableCell key={c.key} className="text-sm">
                        {val === null || val === undefined || val === "" ? "—" : String(val)}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {data.length} active records.
      </p>
    </div>
  );
}

export default function MasterData() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Master Data"
        description="Reference values used across lead creation, bulk upload, and dropdowns. Use these exact values to avoid validation errors."
      />

      <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-4 py-3 text-sm">
        <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
        <p className="text-muted-foreground">
          This list is read-only and shared across all partner accounts. For changes or additions, contact the EduLoans team.
        </p>
      </div>

      <Tabs defaultValue="countries">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="countries">Countries</TabsTrigger>
          <TabsTrigger value="universities">Universities</TabsTrigger>
          <TabsTrigger value="courses">Courses</TabsTrigger>
          <TabsTrigger value="intakes">Intakes</TabsTrigger>
          <TabsTrigger value="qualifications">Highest Qualification</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="stages">Lifecycle Stages</TabsTrigger>
        </TabsList>

        <TabsContent value="countries">
          <Card>
            <CardHeader>
              <CardTitle>Countries</CardTitle>
              <CardDescription>Supported study destination countries.</CardDescription>
            </CardHeader>
            <CardContent>
              <MasterTable
                table="countries_master"
                columns={[
                  { key: "country_name", label: "Country" },
                  { key: "iso_code", label: "ISO Code" },
                ]}
                searchKeys={["country_name", "iso_code"]}
                orderBy={{ column: "country_name", ascending: true }}
                searchPlaceholder="Search countries…"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="universities">
          <Card>
            <CardHeader>
              <CardTitle>Universities</CardTitle>
              <CardDescription>Recognised universities. Use the exact name in bulk uploads.</CardDescription>
            </CardHeader>
            <CardContent>
              <MasterTable
                table="universities_master"
                columns={[
                  { key: "university_name", label: "University" },
                  { key: "country", label: "Country" },
                  { key: "ranking_bucket", label: "Ranking" },
                ]}
                searchKeys={["university_name", "country"]}
                orderBy={{ column: "university_name", ascending: true }}
                searchPlaceholder="Search universities or countries…"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="courses">
          <Card>
            <CardHeader>
              <CardTitle>Courses</CardTitle>
              <CardDescription>Standard course names accepted in lead and bulk upload forms.</CardDescription>
            </CardHeader>
            <CardContent>
              <MasterTable
                table="courses_master"
                columns={[
                  { key: "course_name", label: "Course" },
                  { key: "course_category", label: "Category" },
                  { key: "stem_flag", label: "STEM" },
                  { key: "mba_flag", label: "MBA" },
                ]}
                searchKeys={["course_name", "course_category"]}
                orderBy={{ column: "course_name", ascending: true }}
                searchPlaceholder="Search courses or categories…"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="intakes">
          <Card>
            <CardHeader>
              <CardTitle>Intakes</CardTitle>
              <CardDescription>Available intake terms and years.</CardDescription>
            </CardHeader>
            <CardContent>
              <MasterTable
                table="intake_master"
                columns={[
                  { key: "intake_term", label: "Term" },
                  { key: "intake_year", label: "Year" },
                ]}
                searchKeys={["intake_term", "intake_year"]}
                orderBy={{ column: "sort_order", ascending: true }}
                searchPlaceholder="Search intakes…"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="qualifications">
          <Card>
            <CardHeader>
              <CardTitle>Highest Qualification</CardTitle>
              <CardDescription>Allowed values for the <code className="font-mono text-xs px-1 py-0.5 rounded bg-muted">highest_qualification</code> field used in lead creation and bulk upload.</CardDescription>
            </CardHeader>
            <CardContent>
              <MasterTable
                table="highest_qualification_master"
                columns={[
                  { key: "sort_order", label: "#" },
                  { key: "qualification_label", label: "Qualification" },
                ]}
                searchKeys={["qualification_label"]}
                orderBy={{ column: "sort_order", ascending: true }}
                searchPlaceholder="Search qualifications…"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Document Types</CardTitle>
              <CardDescription>Documents that may be requested during the loan process.</CardDescription>
            </CardHeader>
            <CardContent>
              <MasterTable
                table="document_master"
                columns={[
                  { key: "document_name", label: "Document" },
                  { key: "document_category", label: "Category" },
                  { key: "mandatory_flag", label: "Mandatory" },
                ]}
                searchKeys={["document_name", "document_category", "document_code"]}
                orderBy={{ column: "document_name", ascending: true }}
                searchPlaceholder="Search documents…"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stages">
          <Card>
            <CardHeader>
              <CardTitle>Lifecycle Stages</CardTitle>
              <CardDescription>Stages a lead moves through from submission to disbursal.</CardDescription>
            </CardHeader>
            <CardContent>
              <MasterTable
                table="lifecycle_stage_master"
                columns={[
                  { key: "stage_label", label: "Stage" },
                  { key: "sort_order", label: "Order" },
                  { key: "is_terminal", label: "Terminal" },
                ]}
                searchKeys={["stage_label", "stage_key"]}
                orderBy={{ column: "sort_order", ascending: true }}
                searchPlaceholder="Search stages…"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
