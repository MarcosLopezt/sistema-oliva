import { Card, CardContent } from "@/components/ui/card";
import { Hammer } from "lucide-react";

export function SectionPlaceholder({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>
      <Card>
        <CardContent className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
          <Hammer className="size-5 text-primary" />
          En construcción — {phase}.
        </CardContent>
      </Card>
    </div>
  );
}
