import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/fornecedores")({
  component: Page,
});

function Page() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fornecedores</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Este módulo será construído nas próximas etapas.
        </p>
      </CardContent>
    </Card>
  );
}
