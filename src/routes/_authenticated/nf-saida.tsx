import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { brl } from "@/lib/pdv-types";

export const Route = createFileRoute("/_authenticated/nf-saida")({
  component: NfSaidaPage,
});

type Item = {
  id: string;
  quantidade: number;
  preco_unitario: number;
  nf_saida_emitida: boolean;
  nf_saida_numero: string | null;
  nf_saida_data: string | null;
  venda: {
    id: string;
    criado_em: string;
    cliente: { nome: string } | null;
  } | null;
  variante: {
    cor: string | null;
    tamanho: string | null;
    codigo_barras: string | null;
    produto: {
      nome: string;
      codigo_fornecedor: string | null;
      codigo_interno: string | null;
    } | null;
  } | null;
};

function ymNow() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function NfSaidaPage() {
  const [mes, setMes] = useState<string>(ymNow());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Emissão de NF de Saída</h1>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">Mês:</Label>
          <Input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="w-44"
          />
        </div>
      </div>

      <Tabs defaultValue="pendentes">
        <TabsList>
          <TabsTrigger value="pendentes">Pendentes</TabsTrigger>
          <TabsTrigger value="emitidas">Emitidas</TabsTrigger>
        </TabsList>
        <TabsContent value="pendentes">
          <Lista mes={mes} emitidas={false} />
        </TabsContent>
        <TabsContent value="emitidas">
          <Lista mes={mes} emitidas={true} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function rangeMes(mes: string) {
  const [y, m] = mes.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1)).toISOString();
  const end = new Date(Date.UTC(y, m, 1)).toISOString();
  return { start, end };
}

function Lista({ mes, emitidas }: { mes: string; emitidas: boolean }) {
  const [loading, setLoading] = useState(true);
  const [itens, setItens] = useState<Item[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [openEmitir, setOpenEmitir] = useState(false);
  const [nfNumero, setNfNumero] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    setLoading(true);
    const { start, end } = rangeMes(mes);
    // 1) Busca vendas do mês para evitar filtro em foreign-table (PostgREST alias)
    const { data: vendasMes, error: vendasErr } = await supabase
      .from("vendas")
      .select("id")
      .gte("criado_em", start)
      .lt("criado_em", end);
    if (vendasErr) {
      toast.error("Erro ao carregar: " + vendasErr.message);
      setItens([]);
      setSelecionados(new Set());
      setLoading(false);
      return;
    }
    const vendaIds = (vendasMes ?? []).map((v: any) => v.id);
    if (vendaIds.length === 0) {
      setItens([]);
      setSelecionados(new Set());
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("venda_itens")
      .select(`
        id, quantidade, preco_unitario, nf_saida_emitida, nf_saida_numero, nf_saida_data,
        venda:vendas!inner(id, criado_em, cliente:clientes(nome)),
        variante:produto_variantes!inner(
          cor, tamanho, codigo_barras,
          produto:produtos!inner(nome, codigo_fornecedor, codigo_interno)
        )
      `)
      .eq("nf_saida_emitida", emitidas)
      .in("venda_id", vendaIds)
      .not("variante.produto.codigo_fornecedor", "is", null);

    if (error) {
      toast.error("Erro ao carregar: " + error.message);
      setItens([]);
    } else {
      // filtra defensivamente caso join traga produto sem codigo_fornecedor
      const filtered = (data as any[]).filter(
        (i) => i.variante?.produto?.codigo_fornecedor,
      );
      setItens(filtered as Item[]);
    }
    setSelecionados(new Set());
    setLoading(false);
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes, emitidas]);

  const totalValor = useMemo(
    () => itens.reduce((s, i) => s + Number(i.preco_unitario) * i.quantidade, 0),
    [itens],
  );
  const totalQtd = useMemo(
    () => itens.reduce((s, i) => s + i.quantidade, 0),
    [itens],
  );

  const toggleAll = () => {
    if (selecionados.size === itens.length) setSelecionados(new Set());
    else setSelecionados(new Set(itens.map((i) => i.id)));
  };
  const toggle = (id: string) => {
    const n = new Set(selecionados);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setSelecionados(n);
  };

  const emitir = async () => {
    if (!nfNumero.trim()) {
      toast.error("Informe o número da NF");
      return;
    }
    setSalvando(true);
    const { error } = await supabase
      .from("venda_itens")
      .update({
        nf_saida_emitida: true,
        nf_saida_numero: nfNumero.trim(),
        nf_saida_data: new Date().toISOString(),
      })
      .in("id", Array.from(selecionados));
    setSalvando(false);
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    toast.success(`${selecionados.size} item(ns) marcado(s) como emitido(s)`);
    setOpenEmitir(false);
    setNfNumero("");
    carregar();
  };

  const reverter = async (id: string) => {
    const { error } = await supabase
      .from("venda_itens")
      .update({
        nf_saida_emitida: false,
        nf_saida_numero: null,
        nf_saida_data: null,
      })
      .eq("id", id);
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    toast.success("Item retornado para pendentes");
    carregar();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
        <CardTitle className="text-base">
          {emitidas ? "Itens com NF já emitida" : "Itens aguardando emissão"}
        </CardTitle>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">
            {itens.length} {itens.length === 1 ? "item" : "itens"} · {totalQtd} un · {brl(totalValor)}
          </Badge>
          {!emitidas && (
            <Button
              size="sm"
              disabled={selecionados.size === 0}
              onClick={() => setOpenEmitir(true)}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Marcar como emitida ({selecionados.size})
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Carregando...</p>
        ) : itens.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            {emitidas ? "Nenhuma NF emitida nesse período." : "Nenhum item pendente. 🎉"}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {!emitidas && (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selecionados.size > 0 && selecionados.size === itens.length}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                  )}
                  <TableHead>Data venda</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Cód. fornec.</TableHead>
                  <TableHead>Variante</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  {emitidas && <TableHead>Nº NF</TableHead>}
                  {emitidas && <TableHead>Emitida em</TableHead>}
                  {emitidas && <TableHead></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.map((i) => (
                  <TableRow key={i.id}>
                    {!emitidas && (
                      <TableCell>
                        <Checkbox
                          checked={selecionados.has(i.id)}
                          onCheckedChange={() => toggle(i.id)}
                        />
                      </TableCell>
                    )}
                    <TableCell className="text-sm">
                      {i.venda?.criado_em
                        ? new Date(i.venda.criado_em).toLocaleDateString("pt-BR")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {i.venda?.cliente?.nome ?? "Consumidor"}
                    </TableCell>
                    <TableCell className="text-sm">{i.variante?.produto?.nome ?? "—"}</TableCell>
                    <TableCell className="text-sm font-mono">
                      {i.variante?.produto?.codigo_fornecedor ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {[i.variante?.cor, i.variante?.tamanho].filter(Boolean).join(" · ") || "—"}
                    </TableCell>
                    <TableCell className="text-right">{i.quantidade}</TableCell>
                    <TableCell className="text-right">
                      {brl(Number(i.preco_unitario) * i.quantidade)}
                    </TableCell>
                    {emitidas && <TableCell className="text-sm">{i.nf_saida_numero ?? "—"}</TableCell>}
                    {emitidas && (
                      <TableCell className="text-sm">
                        {i.nf_saida_data
                          ? new Date(i.nf_saida_data).toLocaleDateString("pt-BR")
                          : "—"}
                      </TableCell>
                    )}
                    {emitidas && (
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => reverter(i.id)}>
                          Reverter
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={openEmitir} onOpenChange={setOpenEmitir}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar {selecionados.size} item(ns) como emitidos</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label>Número da NF emitida</Label>
            <Input
              value={nfNumero}
              onChange={(e) => setNfNumero(e.target.value)}
              placeholder="Ex.: 000123"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              O mesmo número será aplicado a todos os itens selecionados.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenEmitir(false)}>Cancelar</Button>
            <Button onClick={emitir} disabled={salvando}>
              {salvando ? "Salvando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
