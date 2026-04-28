import { useEffect, useMemo, useState } from "react";
import { intakeSessionLabel } from "@/lib/intakeSession";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SemanticBadge } from "@/components/dashboard/StageBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Database, Search, Plus, Pencil, Power, AlertTriangle, Upload } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MASTER_SCHEMAS, MASTER_KEYS, MasterSchema, COUNTRY_OPTIONS } from "@/lib/masterSchemas";
import { MasterRecordDrawer } from "@/components/admin/MasterRecordDrawer";
import { MasterBulkUploadDialog, MASTER_UPLOAD_SPECS } from "@/components/admin/MasterBulkUploadDialog";
import { PincodeMasterImportDialog } from "@/components/admin/PincodeMasterImportDialog";
import { MapPin } from "lucide-react";

type StatusFilter = "all" | "active" | "inactive";

/** Safe v1 masters that support bulk upload. Sensitive masters (documents, lifecycle) are excluded. */
const BULK_UPLOAD_KEYS = new Set(Object.keys(MASTER_UPLOAD_SPECS));

export default function AdminMasterData() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [activeKey, setActiveKey] = useState<string>(
    initialTab && MASTER_KEYS.includes(initialTab) ? initialTab : MASTER_KEYS[0]
  );
  const [pincodeOpen, setPincodeOpen] = useState(false);
  const [pincodeStats, setPincodeStats] = useState<{ count: number; loading: boolean }>({ count: 0, loading: true });
  const schema = MASTER_SCHEMAS[activeKey];

  const refreshPincodeStats = async () => {
    setPincodeStats((s) => ({ ...s, loading: true }));
    const { count } = await supabase
      .from("pincode_master")
      .select("pincode", { count: "exact", head: true });
    setPincodeStats({ count: count ?? 0, loading: false });
  };

  useEffect(() => { refreshPincodeStats(); }, []);

  const handleTabChange = (k: string) => {
    setActiveKey(k);
    const next = new URLSearchParams(searchParams);
    next.set("tab", k);
    setSearchParams(next, { replace: true });
  };

  // Sync state when URL changes externally (e.g. sidebar deep-link)
  useEffect(() => {
    const urlTab = searchParams.get("tab");
    if (urlTab && MASTER_KEYS.includes(urlTab) && urlTab !== activeKey) {
      setActiveKey(urlTab);
    }
  }, [searchParams, activeKey]);

  return (
    <div className="space-y-6 max-w-screen-2xl mx-auto">
      <PageHeader
        title="Master Data"
        description="Manage system reference data — countries, universities, courses, lifecycle, documents."
      />

      <Card>
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-primary/10 p-2 text-primary">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-medium text-foreground">Pincode Master</div>
              <div className="text-xs text-muted-foreground">
                {pincodeStats.loading
                  ? "Loading…"
                  : pincodeStats.count === 0
                    ? "Not yet imported. Lead forms can capture pincode but District / State will not auto-fill until you import the master CSV."
                    : `${pincodeStats.count.toLocaleString("en-IN")} pincodes loaded. District / State auto-fill is active on lead forms.`}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={refreshPincodeStats}>Refresh</Button>
            <Button size="sm" onClick={() => setPincodeOpen(true)}>
              <Upload className="h-4 w-4 mr-1.5" />
              {pincodeStats.count === 0 ? "Import CSV" : "Re-import / Update CSV"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <PincodeMasterImportDialog
        open={pincodeOpen}
        onOpenChange={setPincodeOpen}
        onCompleted={refreshPincodeStats}
      />

      <Tabs value={activeKey} onValueChange={handleTabChange}>
        <TabsList className="flex w-full flex-wrap h-auto gap-1 bg-muted p-1">
          {MASTER_KEYS.map((k) => (
            <TabsTrigger key={k} value={k} className="text-xs flex-1 min-w-[110px]">
              {MASTER_SCHEMAS[k].label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <MasterDataTable schema={schema} key={activeKey} bulkUploadEnabled={BULK_UPLOAD_KEYS.has(activeKey)} />
    </div>
  );
}

function MasterDataTable({ schema, bulkUploadEnabled }: { schema: MasterSchema; bulkUploadEnabled: boolean }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from(schema.table)
        .select("*")
        .order(schema.defaultSort.column, { ascending: schema.defaultSort.ascending })
        .limit(1000);
      if (!cancelled) {
        if (error) toast({ title: "Failed to load", description: error.message, variant: "destructive" });
        setRows(data ?? []);
        setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [schema.table, refreshKey, schema.defaultSort.ascending, schema.defaultSort.column]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter === "active" && !r.active_flag) return false;
      if (statusFilter === "inactive" && r.active_flag) return false;
      if (schema.countryFilter && countryFilter !== "all" && r.country !== countryFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hit = schema.searchKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(q));
        if (!hit) return false;
      }
      return true;
    });
  }, [rows, search, statusFilter, countryFilter, schema]);

  const handleToggleActive = async (row: any) => {
    const newVal = !row.active_flag;
    const { error } = await (supabase as any)
      .from(schema.table)
      .update({ active_flag: newVal })
      .eq("id", row.id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: newVal ? "Activated" : "Deactivated", description: `Record ${newVal ? "is now active" : "has been deactivated"}.` });
      setRefreshKey((k) => k + 1);
    }
  };

  const openCreate = () => { setEditing(null); setDrawerOpen(true); };
  const openEdit = (row: any) => { setEditing(row); setDrawerOpen(true); };

  return (
    <div className="space-y-4">
      {schema.sensitive && (
        <Alert className="bg-amber-50 border-amber-200 text-amber-900 [&>svg]:text-amber-600">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs leading-relaxed">
            <strong>{schema.label}:</strong> {schema.sensitiveNote}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={schema.searchPlaceholder}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v: StatusFilter) => setStatusFilter(v)}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="active">Active only</SelectItem>
                  <SelectItem value="inactive">Inactive only</SelectItem>
                </SelectContent>
              </Select>
              {schema.countryFilter && (
                <Select value={countryFilter} onValueChange={setCountryFilter}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="Country" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All countries</SelectItem>
                    {COUNTRY_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex items-center gap-2">
              {bulkUploadEnabled && (
                <Button onClick={() => setBulkOpen(true)} size="sm" variant="outline">
                  <Upload className="h-4 w-4 mr-1.5" /> Bulk Upload
                </Button>
              )}
              <Button onClick={openCreate} size="sm">
                <Plus className="h-4 w-4 mr-1.5" /> {schema.addLabel}
              </Button>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            Showing {filtered.length} of {rows.length} records
          </div>

          {loading ? (
            <PageSkeleton variant="table" />
          ) : (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    {schema.columns.map((c) => (
                      <TableHead key={c.key}>{c.label}</TableHead>
                    ))}
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={schema.columns.length + 2} className="text-center text-muted-foreground py-8">
                        No records match your filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((row) => (
                      <TableRow key={row.id}>
                        {schema.columns.map((c) => (
                          <TableCell key={c.key}>
                            {renderCell(row[c.key], c.render, row)}
                          </TableCell>
                        ))}
                        <TableCell>
                          {row.active_flag ? (
                            <SemanticBadge tone="emerald">Active</SemanticBadge>
                          ) : (
                            <SemanticBadge tone="slate">Inactive</SemanticBadge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => openEdit(row)} title="Edit">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => handleToggleActive(row)}
                              title={row.active_flag ? "Deactivate" : "Activate"}
                            >
                              <Power className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <MasterRecordDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        schema={schema}
        record={editing}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />

      {bulkUploadEnabled && (
        <MasterBulkUploadDialog
          open={bulkOpen}
          onOpenChange={setBulkOpen}
          masterKey={schema.key}
          onCompleted={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}

function renderCell(val: any, render?: "badge-bool" | "tags" | "iso" | "intake-quarter", row?: any) {
  if (render === "badge-bool") {
    return val ? (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] px-1.5 py-0">Yes</Badge>
    ) : (
      <span className="text-muted-foreground text-xs">—</span>
    );
  }
  if (render === "tags") {
    if (!Array.isArray(val) || val.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {val.slice(0, 3).map((t, i) => (
          <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">{t}</Badge>
        ))}
        {val.length > 3 && <span className="text-[10px] text-muted-foreground">+{val.length - 3}</span>}
      </div>
    );
  }
  if (render === "iso") {
    return val ? <span className="font-mono text-xs uppercase">{val}</span> : <span className="text-muted-foreground text-xs">—</span>;
  }
  if (render === "intake-quarter") {
    const label = intakeSessionLabel(row?.intake_term, row?.intake_year);
    return label ? <span className="text-xs">{label}</span> : <span className="text-muted-foreground text-xs">—</span>;
  }
  if (val === null || val === undefined || val === "") return <span className="text-muted-foreground text-xs">—</span>;
  return String(val);
}
