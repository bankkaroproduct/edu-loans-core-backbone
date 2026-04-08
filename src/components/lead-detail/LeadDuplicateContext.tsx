import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"student_leads">;

interface Props {
  lead: Lead;
}

export function LeadDuplicateContext({ lead }: Props) {
  const navigate = useNavigate();
  const [matchedLead, setMatchedLead] = useState<Pick<Lead, "id" | "lead_id" | "student_full_name" | "current_stage"> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!lead.duplicate_flag) return;
    setLoading(true);
    supabase
      .from("student_leads")
      .select("id, lead_id, student_full_name, current_stage")
      .eq("student_phone", lead.student_phone)
      .neq("id", lead.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setMatchedLead(data);
        setLoading(false);
      });
  }, [lead.id, lead.duplicate_flag, lead.student_phone]);

  if (!lead.duplicate_flag) return null;

  return (
    <Card className="border-orange-200 bg-orange-50/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 text-orange-800">
          <AlertTriangle className="h-4 w-4" /> Duplicate Lead Context
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-orange-300 text-orange-700">Duplicate Flagged</Badge>
            <span className="text-sm text-muted-foreground">
              This lead shares contact details with an existing record.
            </span>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Looking up matched lead...</p>
          ) : matchedLead ? (
            <div className="flex items-center justify-between bg-background rounded-md border p-3 mt-2">
              <div>
                <p className="text-sm font-medium">{matchedLead.student_full_name ?? "—"}</p>
                <p className="text-xs text-muted-foreground font-mono">{matchedLead.lead_id ?? "No ID"}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate(`/leads/${matchedLead.id}`)}>
                <ExternalLink className="h-3.5 w-3.5 mr-1" /> View Existing Lead
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">
              No accessible matched lead found. The original record may belong to another partner or has been resolved.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
