import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import {
  ADMIN_SECTION_KEYS,
  ADMIN_SECTION_LABELS,
  ADMIN_ACCESS_LABELS,
  type AdminAccessLevel,
  type AdminSectionKey,
} from "@/lib/admin/sections";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { ShieldOff, UserPlus, KeyRound, Power, RotateCcw, Pencil, ChevronDown } from "lucide-react";
import { useReadOnly } from "@/components/admin/ReadOnlyContext";
import { ReadOnlyBanner } from "@/components/admin/ReadOnlyBanner";

type AdminRow = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_super_admin: boolean;
  is_active: boolean;
  allow_admin_mode: boolean;
  terminated_at: string | null;
  last_login_at: string | null;
  created_at: string;
};

type PartnerOpt = { id: string; display_name: string; partner_code: string };

const emptyPerms = (): Record<AdminSectionKey, AdminAccessLevel> => {
  const o = {} as Record<AdminSectionKey, AdminAccessLevel>;
  for (const k of ADMIN_SECTION_KEYS) o[k] = "hidden";
  return o;
};

export default function AdminUsers() {
  const { appUser } = useAuth();
  const { isSuperAdmin, loading: permsLoading } = useAdminPermissions();
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [partners, setPartners] = useState<PartnerOpt[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminRow | null>(null);
  const [resetTarget, setResetTarget] = useState<AdminRow | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("users")
      .select("id, full_name, email, role, is_super_admin, is_active, allow_admin_mode, terminated_at, last_login_at, created_at")
      .in("role", ["super_admin", "admin"])
      .order("created_at", { ascending: false });
    setRows((data ?? []) as AdminRow[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!isSuperAdmin) return;
    load();
    supabase
      .from("partner_organizations")
      .select("id, display_name, partner_code")
      .eq("is_archived", false)
      .order("display_name")
      .then(({ data }) => setPartners((data ?? []) as PartnerOpt[]));
  }, [isSuperAdmin]);

  if (permsLoading) return null;
  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <ShieldOff className="h-10 w-10 text-muted-foreground mb-3" />
        <h2 className="text-lg font-semibold">Super admin access required</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          Only super admins can manage admin users.
        </p>
      </div>
    );
  }

  const callFn = async (name: string, body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke(name, { body });
      if (error || (data as { error?: string })?.error) {
        const msg = (data as { error?: string })?.error ?? error?.message ?? "Request failed";
        toast({ title: "Error", description: msg, variant: "destructive" });
        return false;
      }
      return true;
    } finally {
      setBusy(false);
    }
  };

  const openResetDialog = (u: AdminRow) => {
    setResetTarget(u);
    setResetPassword("");
  };

  const submitResetPassword = async () => {
    if (!resetTarget) return;
    if (resetPassword.trim().length < 8) {
      toast({ title: "Password too short", description: "Must be at least 8 characters.", variant: "destructive" });
      return;
    }
    const ok = await callFn("admin-user-reset-password", {
      user_id: resetTarget.id,
      new_password: resetPassword,
    });
    if (ok) {
      toast({ title: "Password reset", description: `New password set for ${resetTarget.email}` });
      setResetTarget(null);
      setResetPassword("");
    }
  };

  const handleTerminate = async (u: AdminRow) => {
    if (!confirm(`Terminate ${u.full_name}? They will lose access immediately.`)) return;
    if (await callFn("admin-user-terminate", { user_id: u.id })) {
      toast({ title: "User terminated" });
      load();
    }
  };

  const handleReactivate = async (u: AdminRow) => {
    if (await callFn("admin-user-reactivate", { user_id: u.id })) {
      toast({ title: "User reactivated" });
      load();
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Invite admins, control per-section access, and manage partner scope.
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)} className="gap-2">
          <UserPlus className="h-4 w-4" />
          Invite Admin
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Admin Mode</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No admin users yet.</TableCell></TableRow>
            ) : rows.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.full_name}</TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={u.is_super_admin ? "border-primary/40 text-primary" : ""}>
                    {u.is_super_admin ? "Super Admin" : "Admin"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {u.terminated_at || !u.is_active ? (
                    <Badge variant="outline" className="border-destructive/40 text-destructive">Terminated</Badge>
                  ) : (
                    <Badge variant="outline" className="border-green-500/40 text-green-600">Active</Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{u.allow_admin_mode ? "Allowed" : "Hidden"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {!u.is_super_admin && (
                      <Button size="sm" variant="ghost" onClick={() => setEditTarget(u)} disabled={busy} title="Edit permissions">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => openResetDialog(u)} disabled={busy} title="Reset password">
                      <KeyRound className="h-3.5 w-3.5" />
                    </Button>
                    {!u.is_super_admin && u.id !== appUser?.id && (
                      u.terminated_at || !u.is_active ? (
                        <Button size="sm" variant="ghost" onClick={() => handleReactivate(u)} disabled={busy} title="Reactivate user">
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => handleTerminate(u)} disabled={busy} title="Terminate user">
                          <Power className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <InviteOrEditDialog
        mode="invite"
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        partners={partners}
        onSubmit={async (payload) => {
          if (await callFn("admin-user-invite", payload)) {
            toast({
              title: payload.temp_password ? "User created" : "Invite sent",
              description: payload.temp_password
                ? `${payload.email} can sign in with the temporary password.`
                : `Email sent to ${payload.email}`,
            });
            setInviteOpen(false);
            load();
          }
        }}
        busy={busy}
      />

      <InviteOrEditDialog
        mode="edit"
        open={!!editTarget}
        onOpenChange={(v) => !v && setEditTarget(null)}
        partners={partners}
        target={editTarget}
        onSubmit={async (payload) => {
          if (!editTarget) return;
          if (await callFn("admin-user-update", { ...payload, user_id: editTarget.id })) {
            toast({ title: "User updated" });
            setEditTarget(null);
            load();
          }
        }}
        busy={busy}
      />

      <Dialog open={!!resetTarget} onOpenChange={(v) => { if (!v) { setResetTarget(null); setResetPassword(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              {resetTarget ? `Set a new password for ${resetTarget.full_name} (${resetTarget.email}). They can sign in with it immediately. No email is sent.` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reset_password" className="text-xs">New Password</Label>
            <Input
              id="reset_password"
              type="password"
              autoComplete="new-password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              placeholder="Minimum 8 characters"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetTarget(null); setResetPassword(""); }} disabled={busy}>Cancel</Button>
            <Button onClick={submitResetPassword} disabled={busy || resetPassword.trim().length < 8}>
              Reset password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dialog component shared by invite + edit flows.
// ─────────────────────────────────────────────────────────────────────────────
function InviteOrEditDialog({
  mode, open, onOpenChange, partners, target, onSubmit, busy,
}: {
  mode: "invite" | "edit";
  open: boolean;
  onOpenChange: (v: boolean) => void;
  partners: PartnerOpt[];
  target?: AdminRow | null;
  busy: boolean;
  onSubmit: (payload: {
    email: string;
    full_name: string;
    allow_admin_mode: boolean;
    partner_ids: string[];
    permissions: { section: AdminSectionKey; access_level: AdminAccessLevel }[];
    temp_password?: string;
  }) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [allowAdminMode, setAllowAdminMode] = useState(true);
  const [perms, setPerms] = useState<Record<AdminSectionKey, AdminAccessLevel>>(emptyPerms());
  const [partnerIds, setPartnerIds] = useState<string[]>([]);
  const [credMode, setCredMode] = useState<"invite" | "temp">("invite");
  const [tempPassword, setTempPassword] = useState("");
  const [partnerScopeOpen, setPartnerScopeOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCredMode("invite");
    setTempPassword("");
    setPartnerScopeOpen(false);
    if (mode === "edit" && target) {
      setEmail(target.email);
      setFullName(target.full_name);
      setAllowAdminMode(target.allow_admin_mode);
      // load existing perms + assignments
      (async () => {
        const [{ data: p }, { data: a }] = await Promise.all([
          supabase.from("admin_section_permissions").select("section, access_level").eq("user_id", target.id),
          supabase.from("admin_partner_assignments").select("partner_id").eq("user_id", target.id),
        ]);
        const map = emptyPerms();
        for (const row of p ?? []) map[row.section as AdminSectionKey] = row.access_level as AdminAccessLevel;
        setPerms(map);
        setPartnerIds((a ?? []).map((r) => r.partner_id));
      })();
    } else {
      setEmail("");
      setFullName("");
      setAllowAdminMode(true);
      setPerms(emptyPerms());
      setPartnerIds([]);
    }
  }, [open, mode, target]);

  const submit = () => {
    const permissions = ADMIN_SECTION_KEYS.map((s) => ({ section: s, access_level: perms[s] }));
    const payload: Parameters<typeof onSubmit>[0] = {
      email, full_name: fullName, allow_admin_mode: allowAdminMode, partner_ids: partnerIds, permissions,
    };
    if (mode === "invite" && credMode === "temp") {
      payload.temp_password = tempPassword;
    }
    onSubmit(payload);
  };

  const allPartnersSelected = partners.length > 0 && partnerIds.length === partners.length;
  const someSelected = partnerIds.length > 0 && !allPartnersSelected;
  const partnerSummary =
    partnerIds.length === 0
      ? "All partners (default)"
      : `${partnerIds.length} partner${partnerIds.length === 1 ? "" : "s"} selected`;
  const tempPasswordInvalid = mode === "invite" && credMode === "temp" && tempPassword.trim().length < 8;
  const submitDisabled =
    busy || !email || !fullName || tempPasswordInvalid;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "invite" ? "Invite Admin" : "Edit Admin"}</DialogTitle>
          <DialogDescription>
            {mode === "invite"
              ? credMode === "invite"
                ? "An invite email will be sent. The user sets their own password."
                : "Set a temporary password. The user will be required to change it on first login."
              : "Update permissions, partner scope, and Admin Mode access."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={mode === "edit"}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Full Name</Label>
              <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
          </div>

          {mode === "invite" && (
            <div className="space-y-2">
              <Label className="text-sm">Credential Setup</Label>
              <Tabs value={credMode} onValueChange={(v) => setCredMode(v as "invite" | "temp")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="invite">Send invite email</TabsTrigger>
                  <TabsTrigger value="temp">Set temporary password</TabsTrigger>
                </TabsList>
              </Tabs>
              {credMode === "temp" && (
                <div className="space-y-1.5 pt-1">
                  <Label htmlFor="temp_password" className="text-xs">Temporary Password</Label>
                  <Input
                    id="temp_password"
                    type="text"
                    autoComplete="new-password"
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                    placeholder="At least 8 characters"
                  />
                  <p className="text-xs text-muted-foreground">
                    User will be prompted to change this on first login.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="text-sm">Allow Admin Mode</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Lets this user view data without simulating a partner.
              </p>
            </div>
            <Switch checked={allowAdminMode} onCheckedChange={setAllowAdminMode} />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Section Permissions</Label>
            <div className="rounded-md border divide-y">
              {ADMIN_SECTION_KEYS.map((s) => (
                <div key={s} className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm">{ADMIN_SECTION_LABELS[s]}</span>
                  <Select value={perms[s]} onValueChange={(v) => setPerms({ ...perms, [s]: v as AdminAccessLevel })}>
                    <SelectTrigger className="w-36 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hidden">{ADMIN_ACCESS_LABELS.hidden}</SelectItem>
                      <SelectItem value="view">{ADMIN_ACCESS_LABELS.view}</SelectItem>
                      <SelectItem value="full">{ADMIN_ACCESS_LABELS.full}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>

          <Collapsible open={partnerScopeOpen} onOpenChange={setPartnerScopeOpen} className="rounded-md border">
            <CollapsibleTrigger className="w-full flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors">
              <div className="flex flex-col items-start text-left">
                <span className="text-sm font-medium">Partner Scope</span>
                <span className="text-xs text-muted-foreground">{partnerSummary}</span>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${partnerScopeOpen ? "rotate-180" : ""}`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t px-3 py-2 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Leave empty for access to all partners. Select specific partners to restrict scope.
                </p>
                <div className="flex items-center justify-between px-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={allPartnersSelected ? true : someSelected ? "indeterminate" : false}
                      onCheckedChange={(v) => {
                        setPartnerIds(v ? partners.map((p) => p.id) : []);
                      }}
                    />
                    <span className="text-sm font-medium">Select all</span>
                  </label>
                  <span className="text-xs text-muted-foreground">
                    {partnerIds.length} of {partners.length} selected
                  </span>
                </div>
                <div className="rounded-md border max-h-48 overflow-y-auto divide-y">
                  {partners.map((p) => {
                    const checked = partnerIds.includes(p.id);
                    return (
                      <label key={p.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            setPartnerIds(v ? [...partnerIds, p.id] : partnerIds.filter((x) => x !== p.id));
                          }}
                        />
                        <span className="text-sm flex-1">{p.display_name}</span>
                        <span className="text-xs text-muted-foreground">{p.partner_code}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={submitDisabled}>
            {mode === "invite"
              ? credMode === "temp" ? "Create User" : "Send Invite"
              : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
