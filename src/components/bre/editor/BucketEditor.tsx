import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ParameterEditor } from "./ParameterEditor";
import { WeightSumIndicator } from "./WeightSumIndicator";
import type { ScoringParameter } from "@/lib/bre/types";
import { emptyParameter } from "@/lib/bre/empty";

interface Props {
  title: string;
  description: string;
  params: ScoringParameter[];
  onChange: (next: ScoringParameter[]) => void;
  readOnly?: boolean;
}

export function BucketEditor({ title, description, params, onChange, readOnly }: Props) {
  const sum = params.reduce((acc, p) => acc + (Number(p.weight) || 0), 0);

  const updateParam = (idx: number, next: ScoringParameter) => {
    const copy = [...params];
    copy[idx] = next;
    onChange(copy);
  };
  const removeParam = (idx: number) => onChange(params.filter((_, i) => i !== idx));
  const addParam = () => onChange([...params, emptyParameter("number")]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <WeightSumIndicator sum={sum} />
      </CardHeader>
      <CardContent className="space-y-3">
        {params.map((p, i) => (
          <ParameterEditor
            key={i}
            param={p}
            onChange={(n) => updateParam(i, n)}
            onRemove={() => removeParam(i)}
            readOnly={readOnly}
          />
        ))}
        {params.length === 0 && (
          <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
            No parameters. Add one to start scoring this bucket.
          </p>
        )}
        {!readOnly && (
          <Button type="button" size="sm" variant="outline" onClick={addParam}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add parameter
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
