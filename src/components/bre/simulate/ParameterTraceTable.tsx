import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BreResult, ParameterTrace } from "@/lib/bre/types";
import { formatTraceInput } from "@/lib/bre/displayLabels";

function TraceTable({ trace }: { trace: ParameterTrace[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Parameter</TableHead>
          <TableHead>Input</TableHead>
          <TableHead>Matched band</TableHead>
          <TableHead className="text-right">Band score</TableHead>
          <TableHead className="text-right">Weight</TableHead>
          <TableHead className="text-right">Contribution</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {trace.map((t) => {
          const bandLabel = t.matched_band
            ? "value" in t.matched_band
              ? (t.matched_band.label ?? t.matched_band.value)
              : `${t.matched_band.from}–${t.matched_band.to}${t.matched_band.label ? ` · ${t.matched_band.label}` : ""}`
            : "— no match";
          return (
            <TableRow key={t.param_key}>
              <TableCell className="font-medium text-xs">{t.label}</TableCell>
              <TableCell className="text-xs">{formatTraceInput(t)}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{bandLabel}</TableCell>
              <TableCell className="text-right tabular-nums text-xs">{t.band_score}</TableCell>
              <TableCell className="text-right tabular-nums text-xs">{t.weight}</TableCell>
              <TableCell className="text-right tabular-nums text-xs font-medium">{t.contribution}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export function ParameterTraceTable({ result }: { result: BreResult }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Parameter breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="student">
          <TabsList>
            <TabsTrigger value="student">Student ({result.buckets.student.total})</TabsTrigger>
            <TabsTrigger value="university">University ({result.buckets.university.total})</TabsTrigger>
            <TabsTrigger value="coapplicant">Co-applicant ({result.buckets.coapplicant.total})</TabsTrigger>
          </TabsList>
          <TabsContent value="student" className="mt-3"><TraceTable trace={result.buckets.student.trace} /></TabsContent>
          <TabsContent value="university" className="mt-3"><TraceTable trace={result.buckets.university.trace} /></TabsContent>
          <TabsContent value="coapplicant" className="mt-3"><TraceTable trace={result.buckets.coapplicant.trace} /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
