import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Tables } from "@/integrations/supabase/types";

type Partner = Tables<"partner_organizations">;

const statusColors: Record<string, string> = {
  active: "bg-primary/20 text-primary",
  inactive: "bg-muted text-muted-foreground",
  onboarding: "bg-primary/10 text-primary",
  suspended: "bg-destructive/10 text-destructive",
  terminated: "bg-destructive/10 text-destructive",
};

const fmt = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default function Partners() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("partner_organizations")
        .select("*")
        .order("created_at", { ascending: false });
      setPartners(data ?? []);
      setLoading(false);
    };
    load();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Partners</h1>
      <Card>
        <CardHeader><CardTitle className="text-lg">Partner Organizations</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Loading...</p>
          ) : partners.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No partners found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Onboarded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partners.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono">{p.partner_code}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{p.display_name}</p>
                        <p className="text-xs text-muted-foreground">{p.legal_name}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{fmt(p.partner_type)}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{p.contact_person_name ?? "—"}</p>
                        <p className="text-muted-foreground">{p.contact_person_email ?? ""}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusColors[p.status] ?? ""}>{fmt(p.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.onboarding_date ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
