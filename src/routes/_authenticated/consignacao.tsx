import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ListaConsignacoes } from "@/components/erp/consignacao/lista";
import { NovaConsignacao } from "@/components/erp/consignacao/nova";
import { EncerrarConsignacao } from "@/components/erp/consignacao/encerrar";

export const Route = createFileRoute("/_authenticated/consignacao")({
  component: ConsignacaoPage,
});

function ConsignacaoPage() {
  const [tab, setTab] = useState<"lista" | "nova" | "encerrar">("lista");
  const [conferirId, setConferirId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="space-y-4">
      <TabsList>
        <TabsTrigger value="lista">Lista</TabsTrigger>
        <TabsTrigger value="nova">Nova condicional</TabsTrigger>
        <TabsTrigger value="encerrar">Encerrar / Conferir</TabsTrigger>
      </TabsList>

      <TabsContent value="lista">
        <ListaConsignacoes
          refreshKey={refreshKey}
          onNova={() => setTab("nova")}
          onConferir={(id) => {
            setConferirId(id);
            setTab("encerrar");
          }}
        />
      </TabsContent>

      <TabsContent value="nova">
        <NovaConsignacao
          onCriada={() => {
            setRefreshKey((k) => k + 1);
            setTab("lista");
          }}
        />
      </TabsContent>

      <TabsContent value="encerrar">
        <EncerrarConsignacao
          initialId={conferirId}
          onEncerrada={() => {
            setConferirId(null);
            setRefreshKey((k) => k + 1);
            setTab("lista");
          }}
        />
      </TabsContent>
    </Tabs>
  );
}