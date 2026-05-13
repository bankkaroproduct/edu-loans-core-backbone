import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { BookOpen, Search, Info, Download } from "lucide-react";
import { intakeSessionLabel } from "@/lib/intakeSession";

type Column = { key: string; label: string; compute?: (row: any) => string };

interface MasterTableProps {
  table: string;
  columns: Column[];
  searchKeys: string[];
  orderBy?: { column: string; ascending: boolean };
  filterActive?: boolean;
  searchPlaceholder?: string;
  exportFileName?: string;
}

/** CSV-safe cell: escape quotes/commas/newlines per RFC 4180. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(filename: string, columns: Column[], rows: any[]) {
  const header = columns.map((c) => csvCell(c.label)).join(",");
  const body = rows
    .map((row) =>
      columns
        .map((c) => csvCell(c.compute ? c.compute(row) : row[c.key]))
        .join(","),
    )
    .join("\n");
  const csv = `${header}\n${body}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function MasterTable({ table, columns, searchKeys, orderBy, filterActive = true, searchPlaceholder, exportFileName }: MasterTableProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      // Paginate via .range() — some masters (universities_master) exceed
      // PostgREST's 1000-row default. Cheap no-op for small tables.
      const PAGE = 1000;
      const SAFETY_CAP = 50_000;
      const all: any[] = [];
      let from = 0;
      while (from < SAFETY_CAP) {
        let q = supabase.from(table as any).select("*");
        if (filterActive) q = q.eq("active_flag", true);
        if (orderBy) q = q.order(orderBy.column, { ascending: orderBy.ascending });
        const { data: rows, error } = await q.range(from, from + PAGE - 1);
        if (error) break;
        const chunk = rows ?? [];
        all.push(...chunk);
        if (chunk.length < PAGE) break;
        from += PAGE;
      }
      if (!cancelled) {
        setData(all);
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

  const fileName = exportFileName ?? `${table}.csv`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative max-w-md flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder ?? "Search…"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => downloadCsv(fileName, columns, filtered)}
          disabled={filtered.length === 0}
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
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
                    const val = c.compute ? c.compute(row) : row[c.key];
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

const VALID_TABS = [
  "countries",
  "universities",
  "courses",
  "intakes",
  "qualifications",
  "employment_types",
  "documents",
  "stages",
];

export default function MasterData() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(
    initialTab && VALID_TABS.includes(initialTab) ? initialTab : "countries"
  );

  useEffect(() => {
    const urlTab = searchParams.get("tab");
    if (urlTab && urlTab !== activeTab) {
      setActiveTab(urlTab);
    }
  }, [searchParams, activeTab]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const next = new URLSearchParams(searchParams);
    next.set("tab", value);
    setSearchParams(next, { replace: true });
  };

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

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="flex-wrap h-auto gap-1 p-1.5">
          <TabsTrigger value="countries">Countries</TabsTrigger>
          <TabsTrigger value="universities">Universities</TabsTrigger>
          <TabsTrigger value="courses">Courses</TabsTrigger>
          <TabsTrigger value="intakes">Intakes</TabsTrigger>
          <TabsTrigger value="qualifications">Highest Qualification</TabsTrigger>
          <TabsTrigger value="employment_types">Employment Types</TabsTrigger>
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
                exportFileName="countries.csv"
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
                  { key: "global_rank", label: "Global Rank" },
                  { key: "rank_band", label: "Tier" },
                ]}
                searchKeys={["university_name", "country"]}
                orderBy={{ column: "university_name", ascending: true }}
                searchPlaceholder="Search universities or countries…"
                exportFileName="universities.csv"
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
                exportFileName="courses.csv"
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
                  {
                    key: "intake_session",
                    label: "Intake Session",
                    compute: (row) => intakeSessionLabel(row.intake_term, row.intake_year),
                  },
                ]}
                searchKeys={["intake_term", "intake_year"]}
                orderBy={{ column: "sort_order", ascending: true }}
                searchPlaceholder="Search intakes…"
                exportFileName="intakes.csv"
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
                exportFileName="highest_qualifications.csv"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employment_types">
          <Card>
            <CardHeader>
              <CardTitle>Employment Types</CardTitle>
              <CardDescription>Allowed values for the <code className="font-mono text-xs px-1 py-0.5 rounded bg-muted">coapplicant_employment_type</code> field used in lead creation and bulk upload.</CardDescription>
            </CardHeader>
            <CardContent>
              <MasterTable
                table="employment_type_master"
                columns={[
                  { key: "sort_order", label: "#" },
                  { key: "employment_type_label", label: "Employment Type" },
                ]}
                searchKeys={["employment_type_label"]}
                orderBy={{ column: "sort_order", ascending: true }}
                searchPlaceholder="Search employment types…"
                exportFileName="employment_types.csv"
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
                exportFileName="documents.csv"
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
                exportFileName="lifecycle_stages.csv"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
