import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SemanticBadge } from "@/components/dashboard/StageBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Edit, Copy, Power, Mail, MessageCircle, Search } from "lucide-react";
import { toast } from "sonner";
import { TemplateEditor, type EditorMode } from "@/components/admin/communications/TemplateEditor";
import type { CommunicationTemplate } from "@/lib/communications/types";
import { useReadOnly } from "@/components/admin/ReadOnlyContext";
import { ReadOnlyBanner } from "@/components/admin/ReadOnlyBanner";

export default function AdminCommunicationTemplates() {
  const readOnly = useReadOnly();
  const [rows, setRows] = useState<CommunicationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState<"all" | "email" | "whatsapp">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>("create");
  const [editingTemplate, setEditingTemplate] = useState<CommunicationTemplate | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("communication_templates")
      .select("*")
      .order("template_key");
    if (error) {
      toast.error(error.message);
    } else {
      setRows((data ?? []) as CommunicationTemplate[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (channelFilter !== "all" && r.channel !== channelFilter) return false;
      if (statusFilter === "active" && !r.active_flag) return false;
      if (statusFilter === "inactive" && r.active_flag) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !r.template_key.toLowerCase().includes(q) &&
          !(r.description ?? "").toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [rows, search, channelFilter, statusFilter]);

  const openCreate = () => {
    setEditorMode("create");
    setEditingTemplate(null);
    setEditorOpen(true);
  };
  const openEdit = (t: CommunicationTemplate) => {
    setEditorMode("edit");
    setEditingTemplate(t);
    setEditorOpen(true);
  };
  const openDuplicate = (t: CommunicationTemplate) => {
    setEditorMode("duplicate");
    setEditingTemplate(t);
    setEditorOpen(true);
  };

  const toggleActive = async (t: CommunicationTemplate) => {
    const { error } = await supabase
      .from("communication_templates")
      .update({ active_flag: !t.active_flag, updated_at: new Date().toISOString() })
      .eq("id", t.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t.active_flag ? "Template disabled" : "Template enabled");
    load();
  };

  const truncate = (s: string | null | undefined, n: number) => {
    if (!s) return "";
    return s.length > n ? s.slice(0, n) + "…" : s;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Communication Templates"
        description="Manage email and WhatsApp templates. Edits take effect immediately in the test panel and lead-detail send block."
      >
        <Button onClick={openCreate} size="sm" disabled={readOnly}>
          <Plus className="h-4 w-4 mr-1.5" /> New template
        </Button>
      </PageHeader>
      <ReadOnlyBanner />

      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by key or description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={channelFilter} onValueChange={(v) => setChannelFilter(v as typeof channelFilter)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All channels</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template key</TableHead>
              <TableHead className="w-[100px]">Channel</TableHead>
              <TableHead>Subject / Body preview</TableHead>
              <TableHead className="w-[90px]">Status</TableHead>
              <TableHead className="w-[140px]">Updated</TableHead>
              <TableHead className="w-[60px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No templates match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">{t.template_key}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] h-5">
                      {t.channel === "email" ? (
                        <Mail className="h-3 w-3 mr-1" />
                      ) : (
                        <MessageCircle className="h-3 w-3 mr-1" />
                      )}
                      {t.channel}
                    </Badge>
                    {t.channel === "email" && t.resend_template_id && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] h-5 ml-1"
                        title={`Resend template: ${t.resend_template_id}`}
                      >
                        Resend
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[400px]">
                    {t.channel === "email" && t.subject && (
                      <div className="text-xs font-medium truncate">{truncate(t.subject, 80)}</div>
                    )}
                    <div className="text-xs text-muted-foreground truncate">
                      {truncate(t.body, 90)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {t.active_flag ? (
                      <SemanticBadge tone="emerald">Active</SemanticBadge>
                    ) : (
                      <SemanticBadge tone="slate">Inactive</SemanticBadge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {new Date((t as unknown as { updated_at: string }).updated_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(t)} disabled={readOnly}>
                          <Edit className="h-4 w-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openDuplicate(t)} disabled={readOnly}>
                          <Copy className="h-4 w-4 mr-2" /> Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleActive(t)} disabled={readOnly}>
                          <Power className="h-4 w-4 mr-2" />
                          {t.active_flag ? "Disable" : "Enable"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <TemplateEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        mode={editorMode}
        template={editingTemplate}
        onSaved={load}
      />
    </div>
  );
}
