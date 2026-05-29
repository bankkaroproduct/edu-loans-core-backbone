import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  ADMIN_SECTION_KEYS,
  type AdminAccessLevel,
  type AdminSectionKey,
} from "@/lib/admin/sections";

interface Ctx {
  loading: boolean;
  isSuperAdmin: boolean;
  allowAdminMode: boolean;
  /** When non-empty, admin is scoped to these partner ids. Empty = unrestricted (all partners). */
  assignedPartnerIds: string[];
  /** Per-section access level map. Defaults to 'hidden' for sections without an explicit row. */
  sectionAccess: Record<AdminSectionKey, AdminAccessLevel>;
  getAccess: (section: AdminSectionKey) => AdminAccessLevel;
  canView: (section: AdminSectionKey) => boolean;
  canEdit: (section: AdminSectionKey) => boolean;
  isReadOnly: (section: AdminSectionKey) => boolean;
}

const defaultSectionAccess = (): Record<AdminSectionKey, AdminAccessLevel> => {
  const o = {} as Record<AdminSectionKey, AdminAccessLevel>;
  for (const k of ADMIN_SECTION_KEYS) o[k] = "hidden";
  // Calendar defaults to full for any admin without an explicit permission row.
  o["calendar"] = "full";
  return o;
};

const AdminPermissionsContext = createContext<Ctx | undefined>(undefined);

export function AdminPermissionsProvider({ children }: { children: ReactNode }) {
  const { appUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sectionAccess, setSectionAccess] = useState<Record<AdminSectionKey, AdminAccessLevel>>(defaultSectionAccess());
  const [assignedPartnerIds, setAssignedPartnerIds] = useState<string[]>([]);

  const isSuperAdmin = !!appUser?.is_super_admin;
  const allowAdminMode = isSuperAdmin || (appUser?.allow_admin_mode ?? true);

  useEffect(() => {
    let cancelled = false;
    if (!appUser?.id) {
      setSectionAccess(defaultSectionAccess());
      setAssignedPartnerIds([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const [{ data: perms }, { data: assigns }, { data: ptrDirect }] = await Promise.all([
        supabase
          .from("admin_section_permissions")
          .select("section, access_level")
          .eq("user_id", appUser.id),
        supabase
          .from("admin_partner_assignments")
          .select("partner_id")
          .eq("user_id", appUser.id),
        supabase
          .from("partner_organizations")
          .select("id")
          .eq("partner_code", "PTR-DIRECT")
          .maybeSingle(),
      ]);
      if (cancelled) return;
      const map = defaultSectionAccess();
      for (const row of perms ?? []) {
        map[row.section as AdminSectionKey] = row.access_level as AdminAccessLevel;
      }
      setSectionAccess(map);
      const assigned = (assigns ?? []).map((a) => a.partner_id);
      // PTR-DIRECT is the system bucket for direct/referral/internal leads.
      // Non-super admins automatically inherit access so this operational
      // workspace stays visible without requiring a manual assignment.
      // Super admins are unrestricted elsewhere; merging is a harmless no-op.
      const merged = ptrDirect?.id
        ? Array.from(new Set([...assigned, ptrDirect.id]))
        : assigned;
      setAssignedPartnerIds(merged);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [appUser?.id, isSuperAdmin]);

  const getAccess = (section: AdminSectionKey): AdminAccessLevel => {
    if (isSuperAdmin) return "full";
    return sectionAccess[section] ?? "hidden";
  };
  const canView = (section: AdminSectionKey) => getAccess(section) !== "hidden";
  const canEdit = (section: AdminSectionKey) => getAccess(section) === "full";
  const isReadOnly = (section: AdminSectionKey) => getAccess(section) === "view";

  return (
    <AdminPermissionsContext.Provider
      value={{
        loading,
        isSuperAdmin,
        allowAdminMode,
        assignedPartnerIds,
        sectionAccess,
        getAccess,
        canView,
        canEdit,
        isReadOnly,
      }}
    >
      {children}
    </AdminPermissionsContext.Provider>
  );
}

const safeDefaults: Ctx = {
  loading: false,
  isSuperAdmin: false,
  allowAdminMode: false,
  assignedPartnerIds: [],
  sectionAccess: defaultSectionAccess(),
  getAccess: () => "hidden",
  canView: () => false,
  canEdit: () => false,
  isReadOnly: () => false,
};

export function useAdminPermissions() {
  const ctx = useContext(AdminPermissionsContext);
  return ctx ?? safeDefaults;
}
