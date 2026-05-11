import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, CreditCard, Wallet, Smartphone, Banknote, UserCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { brl } from "@/lib/pdv-types";
import type { ConsignacaoItemConferencia, ConsignacaoRow } from "./types";

type Forma = "dinheiro" | "debito" | "credito" | "pix" | "credito_cliente";

export function EncerrarConsignacao({
  initialId,
  onEncerrada,
}: {
  initialId: string | null;
  onEncerrada: () => void;
}) {
  const { user } = useAuth();
  const [abertas, setAbertas] = useState<ConsignacaoRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  const [search, setSearch] = useState("");
  const [itens, setItens] = useState<ConsignacaoItemConferencia[]>([]);
  const [clienteSaldo, setClienteSaldo] = useState<{ id: string; saldo: number; nome: string } | null>(null);
  const [forma, setForma] = useState<Forma>("dinheiro");
  const [parcelas, setParcelas] = useState(1);
  const [busy, setBusy] = useState(false);
  const [loadingItens, setLoadingItens] = useState(false);

  // load condicionais abertas/parciais
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("consignacoes")
        .select("id, status, data_saida, prazo_devolucao, total, cliente_id, clientes:cliente_id(nome)")
        .in("status", ["aberta", "parcial"])
        .order("data_saida", { ascending: false })
        .limit(200);
      setAbertas(
        (data ?? []).map((r: any) => ({
          id: r.id,
          numero: String(r.id).slice(0, 8).toUpperCase(),
          cliente_id: r.cliente_id,
          cliente_nome: r.clientes?.nome ?? "—",
          data_saida: r.data_saida,
          prazo_devolucao: r.prazo_devolucao,
          qtd_pecas: 0,
          total: Number(r.total) || 0,
          status: r.status,
        }))
      );
    })();
  }, []);

  useEffect(() => {
    if (initialId) setSelectedId(initialId);
  }, [initialId]);

  // load itens da condicional selecionada
  useEffect(() => {
    if (!selectedId) {
      setItens([]);
      setClienteSaldo(null);
      return;
    }
    (async () => {
      setLoadingItens(true);
      const { data: cons } = await supabase
        .from("consignacoes")
        .select("cliente_id, clientes:cliente_id(id, nome, saldo_credito)")
        .eq("id", selectedId)
        .single();
      const cli: any = cons?.clientes;
      if (cli) setClienteSaldo({ id: cli.id, saldo: Number(cli.saldo_credito) || 0, nome: cli.nome });
      else setClienteSaldo(null);

      const { data } = await supabase
        .from("consignacao_itens")
        .select(
          "id, variante_id, qtd_saiu, qtd_devolvida, preco_unitario, produto_variantes:variante_id(cor, tamanho, produtos:produto_id(nome))"
        )
        .eq("consignacao_id", selectedId);
      setItens(
        (data ?? []).map((r: any) => {
          const restante = Number(r.qtd_saiu) - Number(r.qtd_devolvida);
          return {
            id: r.id,
            variante_id: r.variante_id,
            nome: r.produto_variantes?.produtos?.nome ?? "Produto",
            variante_label: [r.produto_variantes?.cor, r.produto_variantes?.tamanho]
              .filter(Boolean)
              .join(" · "),
            preco_unitario: Number(r.preco_unitario) || 0,
            qtd_saiu: Number(r.qtd_saiu) || 0,
            qtd_devolvida: Number(r.qtd_devolvida) || 0,
            qtd_devolvida_atual: restante, // assume devolução total por padrão
          };
        })
      );
      setLoadingItens(false);
    })();
  }, [selectedId]);

  const totaisPorItem = useMemo(
    () =>
      itens.map((i) => {
        const restante = i.qtd_saiu - i.qtd_devolvida;
        const devolverAgora = Math.min(Math.max(0, i.qtd_devolvida_atual), restante);
        const vendida = restante - devolverAgora;
        return { ...i, devolverAgora, vendida, valor: vendida * i.preco_unitario };
      }),
    [itens]
  );
  const totalCobrar = totaisPorItem.reduce((a, i) => a + i.valor, 0);

  function setDevolvida(id: string, v: number) {
    setItens((p) => p.map((i) => (i.id === id ? { ...i, qtd_devolvida_atual: v } : i)));
  }

  const filtered = abertas.filter((r) => {
    const lower = search.trim().toLowerCase();
    if (!lower) return true;
    return (
      r.cliente_nome.toLowerCase().includes(lower) ||
      r.numero.toLowerCase().includes(lower)
    );
  });

  async function encerrar() {
    if (!selectedId) return;

    const itensPayload = totaisPorItem.map((i) => ({
      item_id: i.id,
      qtd_devolvida_agora: i.devolverAgora,
      qtd_vendida: i.vendida,
    }));

    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("encerrar_consignacao", {
        payload: {
          consignacao_id: selectedId,
          funcionario_id: user?.id ?? null,
          forma,
          parcelas: forma === "credito" ? parcelas : 1,
          itens: itensPayload,
        },
      });

      if (error || !(data as any)?.ok) {
        toast.error((data as any)?.erro ?? error?.message ?? "Erro ao encerrar condicional.");
        return;
      }

      toast.success("Condicional encerrada!");
      setSelectedId(null);
      setItens([]);
      onEncerrada();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 grid-cols-1 lg:grid-cols-[2fr_3fr]">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Selecionar condicional</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por número ou cliente…"
              className="pl-9"
            />
          </div>
          <div className="border rounded-md max-h-[60vh] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4 text-center">Nenhuma condicional aberta.</p>
            ) : (
              filtered.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className={
                    "w-full text-left px-3 py-2 border-b last:border-b-0 hover:bg-accent " +
                    (selectedId === r.id ? "bg-accent" : "")
                  }
                >
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-xs">{r.numero}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.data_saida).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <p className="text-sm font-medium">{r.cliente_nome}</p>
                  <p className="text-xs text-muted-foreground">Total: {brl(r.total)}</p>
                </button>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Conferência</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 space-y-4">
          {!selectedId ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Selecione uma condicional ao lado.
            </p>
          ) : loadingItens ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {totaisPorItem.map((i) => {
                  const restante = i.qtd_saiu - i.qtd_devolvida;
                  return (
                    <div key={i.id} className="rounded-md border p-2.5">
                      <p className="text-sm font-medium">{i.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {i.variante_label || "—"} · {brl(i.preco_unitario)} · saiu {i.qtd_saiu}
                        {i.qtd_devolvida > 0 && ` · já devolvido ${i.qtd_devolvida}`}
                      </p>
                      <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                        <div>
                          <Label className="text-[10px] uppercase text-muted-foreground">Devolvido agora</Label>
                          <Input
                            type="number"
                            min={0}
                            max={restante}
                            value={i.qtd_devolvida_atual}
                            onChange={(e) => setDevolvida(i.id, Number(e.target.value) || 0)}
                            className="h-8"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] uppercase text-muted-foreground">Vendido</Label>
                          <p className="h-8 flex items-center font-semibold">{i.vendida}</p>
                        </div>
                        <div>
                          <Label className="text-[10px] uppercase text-muted-foreground">Cobrar</Label>
                          <p className="h-8 flex items-center font-semibold">{brl(i.valor)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t pt-3 space-y-3">
                <div className="flex justify-between text-base font-bold">
                  <span>Total a cobrar</span>
                  <span>{brl(totalCobrar)}</span>
                </div>

                {totalCobrar > 0 && (
                  <Tabs value={forma} onValueChange={(v) => setForma(v as Forma)}>
                    <TabsList className="grid grid-cols-5 w-full h-9">
                      <TabsTrigger value="dinheiro" className="text-xs"><Banknote className="h-3.5 w-3.5" /></TabsTrigger>
                      <TabsTrigger value="debito" className="text-xs"><Wallet className="h-3.5 w-3.5" /></TabsTrigger>
                      <TabsTrigger value="credito" className="text-xs"><CreditCard className="h-3.5 w-3.5" /></TabsTrigger>
                      <TabsTrigger value="pix" className="text-xs"><Smartphone className="h-3.5 w-3.5" /></TabsTrigger>
                      <TabsTrigger value="credito_cliente" className="text-xs"><UserCircle2 className="h-3.5 w-3.5" /></TabsTrigger>
                    </TabsList>
                    <TabsContent value="credito" className="mt-2">
                      <Select value={String(parcelas)} onValueChange={(v) => setParcelas(Number(v))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                            <SelectItem key={n} value={String(n)}>{n}x de {brl(totalCobrar / n)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TabsContent>
                    <TabsContent value="credito_cliente" className="mt-2 text-xs">
                      {clienteSaldo ? (
                        <p>
                          {clienteSaldo.nome} · Saldo: <span className="font-semibold">{brl(clienteSaldo.saldo)}</span>
                          {clienteSaldo.saldo < totalCobrar && (
                            <span className="text-destructive ml-1">(insuficiente)</span>
                          )}
                        </p>
                      ) : (
                        <p className="text-destructive">Sem cliente associado.</p>
                      )}
                    </TabsContent>
                  </Tabs>
                )}

                <Button
                  size="lg"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={encerrar}
                  disabled={busy || !selectedId}
                >
                  {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Encerrar Condicional
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}