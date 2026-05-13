import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, GraduationCap, Mail, Phone, User } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type PartnerOrg = Tables<"partner_organizations">;

interface Props {
  /** Partner org row, or null when the lead has no partner_id (direct student). */
  partner: PartnerOrg | null;
  /** Whether the lead originated directly from a student (source_type=student_direct). */
  isStudentDirect: boolean;
}

function Field({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-2 min-w-0">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium break-words" title={value || undefined}>{value || "—"}</p>
      </div>
    </div>
  );
}

export function AdminPartnerCard({ partner, isStudentDirect }: Props) {
  const isDirectSystem = partner?.partner_code === "PTR-DIRECT";

  if (isStudentDirect || !partner) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-primary" /> Source
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-sm font-medium">
              {isStudentDirect ? "Direct Student Lead" : "Partner Lead"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isStudentDirect
                ? "This application was submitted via the student portal — no partner attached."
                : "Partner record is missing or could not be loaded."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {isDirectSystem ? (
            <>
              <GraduationCap className="h-4 w-4 text-primary" /> Source — Direct / Admin-owned
            </>
          ) : (
            <>
              <Building2 className="h-4 w-4 text-primary" /> Partner Organization
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{partner.display_name?.trim() || "Partner Lead"}</p>
            <p className="text-xs text-muted-foreground">
              {isDirectSystem ? "System bucket for walk-in / admin-originated leads" : partner.legal_name}
            </p>
          </div>
          <Badge variant={isDirectSystem ? "secondary" : "outline"} className="font-mono text-[10px]">
            {partner.partner_code}
          </Badge>
        </div>

        {isDirectSystem ? (
          <div className="rounded-md border border-dashed bg-muted/30 p-2.5">
            <p className="text-xs text-muted-foreground">
              This lead is owned directly by the admin team. It is excluded from billable partner reports and payout calculations.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t">
            <Field icon={User} label="Contact Person" value={partner.contact_person_name} />
            <Field icon={Mail} label="Email" value={partner.contact_person_email} />
            <Field icon={Phone} label="Phone" value={partner.contact_person_phone} />
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Badge variant="secondary" className="text-[10px]">
            {isDirectSystem ? "Direct / System" : partner.partner_type.replace(/_/g, " ")}
          </Badge>
          <Badge
            variant="outline"
            className={`text-[10px] ${
              partner.status === "active" ? "border-emerald-300 text-emerald-700 bg-emerald-50" :
              partner.status === "suspended" || partner.status === "terminated" ? "border-destructive/30 text-destructive bg-destructive/5" :
              "border-amber-300 text-amber-700 bg-amber-50"
            }`}
          >
            {partner.status}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
