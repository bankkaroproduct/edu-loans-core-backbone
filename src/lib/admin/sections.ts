// Admin section keys & access levels (kept in sync with the
// admin_section_key + admin_access_level Postgres enums).
export const ADMIN_SECTION_KEYS = [
  "dashboard",
  "lead_queue",
  "reports",
  "add_lead",
  "bulk_upload",
  "master_data",
  "partners",
  "lenders",
  "premiere_lists",
  "bre",
  "communications",
  "admin_users",
  "calendar",
] as const;

export type AdminSectionKey = (typeof ADMIN_SECTION_KEYS)[number];
export type AdminAccessLevel = "hidden" | "view" | "full";

export const ADMIN_SECTION_LABELS: Record<AdminSectionKey, string> = {
  dashboard: "Dashboard",
  lead_queue: "Lead Queue",
  reports: "Reports",
  add_lead: "Add Lead",
  bulk_upload: "Bulk Upload",
  master_data: "Master Data",
  partners: "Partners",
  lenders: "Lenders",
  premiere_lists: "Premiere Lists",
  bre: "BRE Engine",
  communications: "Communications",
  admin_users: "User Management",
  calendar: "Calendar",
};

export const ADMIN_ACCESS_LEVELS: AdminAccessLevel[] = ["hidden", "view", "full"];

export const ADMIN_ACCESS_LABELS: Record<AdminAccessLevel, string> = {
  hidden: "Hidden",
  view: "View Only",
  full: "Full Access",
};
