/**
 * Master data schemas — drives both the admin table view and the add/edit drawer.
 * `editableFields` is the AUTHORITATIVE allow-list for mutation payloads.
 * Any field not in `editableFields` MUST NOT be sent in update payloads,
 * even if it appears in the form (e.g. immutable keys shown as read-only).
 */

export type FieldType = "text" | "number" | "boolean" | "select" | "tags";

export interface FieldSchema {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  hint?: string;
  /** If true, shown in the form but disabled and never sent to update payload. */
  immutableOnEdit?: boolean;
  /** If true, never shown in the create form (system-controlled). */
  hiddenOnCreate?: boolean;
  uppercase?: boolean;
  min?: number;
  max?: number;
}

export interface MasterSchema {
  key: string;
  label: string;
  table: string;
  searchKeys: string[];
  searchPlaceholder: string;
  /** Columns shown in the list view (in order). */
  columns: { key: string; label: string; render?: "badge-bool" | "tags" | "iso" | "intake-quarter" }[];
  fields: FieldSchema[];
  /** Soft-delete via `active_flag`. */
  hasActiveFlag: boolean;
  defaultSort: { column: string; ascending: boolean };
  /** Sensitive masters get a banner warning. */
  sensitive?: boolean;
  sensitiveNote?: string;
  /** Optional country filter (Universities only). */
  countryFilter?: boolean;
  /** Display name for "Add" button. */
  addLabel: string;
}

export const COUNTRY_OPTIONS = [
  "United States", "United Kingdom", "Canada", "Australia", "Germany",
  "France", "Netherlands", "Singapore", "Ireland", "New Zealand",
  "Spain", "Italy", "Switzerland", "Sweden", "Denmark",
];

export const INTAKE_TERMS = ["Spring", "Summer", "Fall", "Winter"];

export const APPLICABLE_FOR_OPTIONS = [
  { value: "all", label: "All applicants" },
  { value: "student", label: "Student only" },
  { value: "coapplicant", label: "Co-applicant only" },
];

export const RANKING_BUCKETS = [
  { value: "Top 50", label: "Top 50" },
  { value: "Top 100", label: "Top 100" },
  { value: "Top 200", label: "Top 200" },
  { value: "Top 500", label: "Top 500" },
  { value: "Other", label: "Other" },
];

export const DOC_CATEGORIES = ["KYC", "Academic", "Financial", "Co-applicant", "Other"];

export const COURSE_CATEGORIES = ["STEM", "Management", "Business", "Engineering", "Arts", "Health Sciences", "Other"];

export const MASTER_SCHEMAS: Record<string, MasterSchema> = {
  countries: {
    key: "countries",
    label: "Countries",
    table: "countries_master",
    searchKeys: ["country_name", "iso_code"],
    searchPlaceholder: "Search countries…",
    columns: [
      { key: "country_name", label: "Country" },
      { key: "iso_code", label: "ISO", render: "iso" },
    ],
    fields: [
      { key: "country_name", label: "Country name", type: "text", required: true, placeholder: "e.g. United States" },
      { key: "iso_code", label: "ISO code", type: "text", required: true, placeholder: "e.g. US", uppercase: true, hint: "2-letter ISO code (uppercase)" },
    ],
    hasActiveFlag: true,
    defaultSort: { column: "country_name", ascending: true },
    addLabel: "Add country",
  },
  universities: {
    key: "universities",
    label: "Universities",
    table: "universities_master",
    searchKeys: ["university_name", "country"],
    searchPlaceholder: "Search universities…",
    countryFilter: true,
    columns: [
      { key: "university_name", label: "University" },
      { key: "country", label: "Country" },
      { key: "ranking_bucket", label: "Ranking" },
      { key: "aliases", label: "Aliases", render: "tags" },
    ],
    fields: [
      { key: "university_name", label: "University name", type: "text", required: true },
      { key: "country", label: "Country", type: "select", required: true, options: COUNTRY_OPTIONS.map((c) => ({ value: c, label: c })) },
      { key: "ranking_bucket", label: "Ranking bucket", type: "select", options: RANKING_BUCKETS },
      { key: "aliases", label: "Aliases", type: "tags", placeholder: "Comma-separated alternate names", hint: "Used for fuzzy matching during lead capture" },
    ],
    hasActiveFlag: true,
    defaultSort: { column: "university_name", ascending: true },
    addLabel: "Add university",
  },
  courses: {
    key: "courses",
    label: "Courses",
    table: "courses_master",
    searchKeys: ["course_name", "course_category"],
    searchPlaceholder: "Search courses…",
    columns: [
      { key: "course_name", label: "Course" },
      { key: "course_category", label: "Category" },
      { key: "stem_flag", label: "STEM", render: "badge-bool" },
      { key: "mba_flag", label: "MBA", render: "badge-bool" },
      { key: "management_flag", label: "Mgmt", render: "badge-bool" },
    ],
    fields: [
      { key: "course_name", label: "Course name", type: "text", required: true },
      { key: "course_category", label: "Category", type: "select", options: COURSE_CATEGORIES.map((c) => ({ value: c, label: c })) },
      { key: "stem_flag", label: "STEM", type: "boolean" },
      { key: "mba_flag", label: "MBA", type: "boolean" },
      { key: "management_flag", label: "Management", type: "boolean" },
    ],
    hasActiveFlag: true,
    defaultSort: { column: "course_name", ascending: true },
    addLabel: "Add course",
  },
  intakes: {
    key: "intakes",
    label: "Intakes",
    table: "intake_master",
    searchKeys: ["intake_term"],
    searchPlaceholder: "Search intakes…",
    columns: [
      { key: "intake_session", label: "Intake Session", render: "intake-quarter" },
      { key: "sort_order", label: "Sort" },
    ],
    fields: [
      { key: "intake_term", label: "Term", type: "select", required: true, options: INTAKE_TERMS.map((t) => ({ value: t, label: t })) },
      { key: "intake_year", label: "Year", type: "number", required: true, min: 2024, max: 2035 },
      { key: "sort_order", label: "Sort order", type: "number", hint: "Lower numbers appear first in dropdowns" },
    ],
    hasActiveFlag: true,
    defaultSort: { column: "sort_order", ascending: true },
    addLabel: "Add intake",
  },
  documents: {
    key: "documents",
    label: "Documents",
    table: "document_master",
    searchKeys: ["document_name", "document_code", "document_category"],
    searchPlaceholder: "Search documents…",
    sensitive: true,
    sensitiveNote: "Changes here affect new operations and UI labels. Core keys remain locked.",
    columns: [
      { key: "document_code", label: "Code" },
      { key: "document_name", label: "Document" },
      { key: "document_category", label: "Category" },
      { key: "applicable_for", label: "Applies to" },
      { key: "mandatory_flag", label: "Required", render: "badge-bool" },
    ],
    fields: [
      { key: "document_code", label: "Document code", type: "text", required: true, immutableOnEdit: true, hint: "Permanent identifier — locked after creation" },
      { key: "document_name", label: "Document name", type: "text", required: true },
      { key: "document_category", label: "Category", type: "select", options: DOC_CATEGORIES.map((c) => ({ value: c, label: c })) },
      { key: "applicable_for", label: "Applicable for", type: "select", required: true, options: APPLICABLE_FOR_OPTIONS },
      { key: "mandatory_flag", label: "Mandatory", type: "boolean" },
      { key: "description", label: "Description", type: "text" },
    ],
    hasActiveFlag: true,
    defaultSort: { column: "document_name", ascending: true },
    addLabel: "Add document",
  },
  stages: {
    key: "stages",
    label: "Lifecycle Stages",
    table: "lifecycle_stage_master",
    searchKeys: ["stage_label", "stage_key"],
    searchPlaceholder: "Search stages…",
    sensitive: true,
    sensitiveNote: "Changes here affect new operations and UI labels. Core keys remain locked.",
    columns: [
      { key: "sort_order", label: "#" },
      { key: "stage_key", label: "Key" },
      { key: "stage_label", label: "Label" },
      { key: "is_terminal", label: "Terminal", render: "badge-bool" },
    ],
    fields: [
      { key: "stage_key", label: "Stage key", type: "text", required: true, immutableOnEdit: true, hint: "Enum value — locked (changing breaks RPC + reports)" },
      { key: "stage_label", label: "Display label", type: "text", required: true },
      { key: "description", label: "Description", type: "text" },
      { key: "sort_order", label: "Sort order", type: "number" },
      { key: "is_terminal", label: "Terminal stage", type: "boolean", immutableOnEdit: true, hint: "System-controlled flag" },
    ],
    hasActiveFlag: true,
    defaultSort: { column: "sort_order", ascending: true },
    addLabel: "Add stage",
  },
  qualifications: {
    key: "qualifications",
    label: "Highest Qualification",
    table: "highest_qualification_master",
    searchKeys: ["qualification_label"],
    searchPlaceholder: "Search qualifications…",
    columns: [
      { key: "sort_order", label: "#" },
      { key: "qualification_label", label: "Qualification" },
    ],
    fields: [
      { key: "qualification_label", label: "Qualification name", type: "text", required: true, placeholder: "e.g. Bachelor's Degree" },
      { key: "sort_order", label: "Sort order", type: "number", hint: "Lower numbers appear first in dropdowns" },
    ],
    hasActiveFlag: true,
    defaultSort: { column: "sort_order", ascending: true },
    addLabel: "Add qualification",
  },
  employment_types: {
    key: "employment_types",
    label: "Employment Types",
    table: "employment_type_master",
    searchKeys: ["employment_type_label"],
    searchPlaceholder: "Search employment types…",
    columns: [
      { key: "sort_order", label: "#" },
      { key: "employment_type_label", label: "Employment Type" },
    ],
    fields: [
      { key: "employment_type_label", label: "Employment type", type: "text", required: true, placeholder: "e.g. Salaried" },
      { key: "sort_order", label: "Sort order", type: "number", hint: "Lower numbers appear first in dropdowns" },
    ],
    hasActiveFlag: true,
    defaultSort: { column: "sort_order", ascending: true },
    addLabel: "Add employment type",
  },
  statuses: {
    key: "statuses",
    label: "Lifecycle Statuses",
    table: "lifecycle_status_master",
    searchKeys: ["status_label", "status_key", "stage_key"],
    searchPlaceholder: "Search statuses…",
    sensitive: true,
    sensitiveNote: "Changes here affect new operations and UI labels. Core keys remain locked.",
    columns: [
      { key: "sort_order", label: "#" },
      { key: "stage_key", label: "Stage" },
      { key: "status_key", label: "Key" },
      { key: "status_label", label: "Label" },
    ],
    fields: [
      { key: "status_key", label: "Status key", type: "text", required: true, immutableOnEdit: true, hint: "Enum value — locked" },
      { key: "stage_key", label: "Parent stage key", type: "text", required: true, immutableOnEdit: true, hint: "Parent enum value — locked" },
      { key: "status_label", label: "Display label", type: "text", required: true },
      { key: "description", label: "Description", type: "text" },
      { key: "sort_order", label: "Sort order", type: "number" },
    ],
    hasActiveFlag: true,
    defaultSort: { column: "sort_order", ascending: true },
    addLabel: "Add status",
  },
};

export const MASTER_KEYS = Object.keys(MASTER_SCHEMAS);

/**
 * Build an UPDATE payload that strictly contains only allowed editable fields.
 * Immutable fields are dropped even if present in `formData` — defense in depth.
 */
export function buildUpdatePayload(schema: MasterSchema, formData: Record<string, any>): Record<string, any> {
  const payload: Record<string, any> = {};
  for (const field of schema.fields) {
    if (field.immutableOnEdit) continue;
    if (!(field.key in formData)) continue;
    let val = formData[field.key];
    if (field.type === "text" && field.uppercase && typeof val === "string") val = val.toUpperCase();
    if (field.type === "tags" && typeof val === "string") {
      val = val.split(",").map((s) => s.trim()).filter(Boolean);
    }
    if (field.type === "number" && val !== null && val !== "" && val !== undefined) {
      val = Number(val);
    }
    payload[field.key] = val === "" ? null : val;
  }
  if (schema.hasActiveFlag && "active_flag" in formData) {
    payload.active_flag = !!formData.active_flag;
  }
  return payload;
}

/**
 * Build an INSERT payload — includes all fields (immutable keys are required at creation time).
 */
export function buildInsertPayload(schema: MasterSchema, formData: Record<string, any>): Record<string, any> {
  const payload: Record<string, any> = {};
  for (const field of schema.fields) {
    if (!(field.key in formData)) continue;
    let val = formData[field.key];
    if (field.type === "text" && field.uppercase && typeof val === "string") val = val.toUpperCase();
    if (field.type === "tags" && typeof val === "string") {
      val = val.split(",").map((s) => s.trim()).filter(Boolean);
    }
    if (field.type === "number" && val !== null && val !== "" && val !== undefined) {
      val = Number(val);
    }
    payload[field.key] = val === "" ? null : val;
  }
  if (schema.hasActiveFlag) {
    payload.active_flag = "active_flag" in formData ? !!formData.active_flag : true;
  }
  return payload;
}

export function validateForm(schema: MasterSchema, formData: Record<string, any>, isEdit: boolean): string | null {
  for (const field of schema.fields) {
    if (isEdit && field.immutableOnEdit) continue;
    if (!field.required) continue;
    const v = formData[field.key];
    if (v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) {
      return `${field.label} is required`;
    }
    if (field.type === "number" && typeof v === "number") {
      if (field.min !== undefined && v < field.min) return `${field.label} must be ≥ ${field.min}`;
      if (field.max !== undefined && v > field.max) return `${field.label} must be ≤ ${field.max}`;
    }
  }
  return null;
}
