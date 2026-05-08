import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  component: Page,
});

// Ordem importa: filhos antes de pais para respeitar FKs
const TABELAS_RESET = [
  "pagamentos",
  "venda_itens",
  "vendas",
  "consignacao_itens",
  "consignacoes",
  "caixa_movimentos",
  "caixa_sessoes",
  "contas",
  "movimentacoes_estoque",
  "pedido_compra_itens",
  "pedidos_compra",
] as const;

function Page() {
  return (
    <div className="space-y-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Configurações</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Ajustes gerais do sistema.
          </p>
        </CardContent>
      </Card>

      <ResetDadosCard />
    </div>
  );
}

function ResetDadosCard() {
  const [open, setOpen] = useState(false);
  const [confirma, setConfirma] = useState("");
  const [busy, setBusy] = useState(false);

  async function executarReset() {
    setBusy(true);
    const erros: string[] = [];
    for (const tabela of TABELAS_RESET) {
      const { error } = await supabase
        .from(tabela)
        .delete()
        .not("id", "is", null);
      if (error) erros.push(`${tabela}: ${error.message}`);
    }
    setBusy(false);
    setOpen(false);
    setConfirma("");
    if (erros.length === 0) {
      toast.success("Dados de teste apagados com sucesso");
    } else {
      toast.error("Alguns erros: " + erros.join(" | "));
    }
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">Zona de Perigo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Apaga <strong>vendas, pagamentos, consignações, caixa, financeiro,
          movimentações de estoque e pedidos de compra</strong>. Mantém
          produtos, clientes, fornecedores, funcionários e categorias.
        </p>
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Resetar dados de teste
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar reset</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. Para confirmar, digite{" "}
                <strong>RESETAR</strong> abaixo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2 py-2">
              <Label htmlFor="confirma">Digite RESETAR</Label>
              <Input
                id="confirma"
                value={confirma}
                onChange={(e) => setConfirma(e.target.value)}
                placeholder="RESETAR"
                autoComplete="off"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); executarReset(); }}
                disabled={busy || confirma !== "RESETAR"}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Apagar dados
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
