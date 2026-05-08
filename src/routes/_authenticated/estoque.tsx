import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Boxes, AlertTriangle, XCircle, DollarSign, Plus } from "lucide-react";
import { AjusteModal } from "@/components/erp/estoque/ajuste-modal";

export const Route = createFileRoute("/_authenticated/estoque")({
  component: Page,
});

type VarRow = {
  id: string; cor: string; tamanho: string; codigo_barras: string;
  qtd_estoque: number; preco_venda: number;
  produtos: { nome: string; estoque_minimo: number; preco_custo: number } | null;
};

type Mov = {
  id: string; created_at: string; tipo: string; quantidade: number; motivo: string | null;
  venda_id: string | null; consignacao_id: string | null;
  produto_variantes: { cor: string; tamanho: string; produtos: { nome: string } | null } | null;
  funcionarios?: { nome: string } | null;
};

function Page() {
  const [vars, setVars] = useState<VarRow[]>([]);
  const [movs, setMovs] = useState<Mov[]>([]);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "criticos" | "zerados">("todos");
  const [tipoFiltro, setTipoFiltro] = useState<string>("todos");
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("produto_variantes")
      .select("id, cor, tamanho, codigo_barras, qtd_estoque, preco_venda, produtos(nome, estoque_minimo, preco_custo)");
    setVars((data as any) ?? []);
    const { data: m } = await supabase
      .from("movimentacoes_estoque")
      .select("id, created_at, tipo, quantidade, motivo, venda_id, consignacao_id, produto_variantes(cor, tamanho, produtos(nome))")
      .order("created_at", { ascending: false })
      .limit(200);
    setMovs((m as any) ?? []);
  };

  useEffect(() => { load(); }, []);

  const totals = useMemo(() => {
    const skus = vars.length;
    const valor = vars.reduce((s, v) => s + Number(v.qtd_estoque ?? 0) * Number(v.produtos?.preco_custo ?? 0), 0);
    const criticos = vars.filter((v) => v.qtd_estoque > 0 && v.qtd_estoque <= Number(v.produtos?.estoque_minimo ?? 0)).length;
    const zerados = vars.filter((v) => Number(v.qtd_estoque ?? 0) <= 0).length;
    return { skus, valor, criticos, zerados };
  }, [vars]);

  const filtered = useMemo(() => {
    const t = busca.toLowerCase();
    return vars.filter((v) => {
      const min = Number(v.produtos?.estoque_minimo ?? 0);
      const q = Number(v.qtd_estoque ?? 0);
      if (filtro === "criticos" && !(q > 0 && q <= min)) return false;
      if (filtro === "zerados" && q > 0) return false;
      if (t) {
        const hay = `${v.produtos?.nome ?? ""} ${v.codigo_barras ?? ""}`.toLowerCase();
        if (!hay.includes(t)) return false;
      }
      return true;
    });
  }, [vars, busca, filtro]);

  const movsFiltradas = useMemo(() => {
    return movs.filter((m) => tipoFiltro === "todos" || m.tipo === tipoFiltro);
  }, [movs, tipoFiltro]);

  const statusBadge = (q: number, min: number) => {
    if (q <= 0) return <Badge variant="destructive">Zerado</Badge>;
    if (q <= min) return <Badge className="bg-yellow-500 text-white hover:bg-yellow-500">Crítico</Badge>;
    return <Badge variant="default">OK</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="pt-6 flex items-center gap-3"><Boxes className="h-8 w-8 text-primary" /><div><p className="text-xs text-muted-foreground">SKUs</p><p className="text-2xl font-bold">{totals.skus}</p></div></CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-3"><DollarSign className="h-8 w-8 text-primary" /><div><p className="text-xs text-muted-foreground">Valor em estoque</p><p className="text-2xl font-bold">R$ {totals.valor.toFixed(2)}</p></div></CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-3"><AlertTriangle className="h-8 w-8 text-yellow-500" /><div><p className="text-xs text-muted-foreground">Críticos</p><p className="text-2xl font-bold">{totals.criticos}</p></div></CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-3"><XCircle className="h-8 w-8 text-destructive" /><div><p className="text-xs text-muted-foreground">Zerados</p><p className="text-2xl font-bold">{totals.zerados}</p></div></CardContent></Card>
      </div>

      <Tabs defaultValue="estoque">
        <TabsList>
          <TabsTrigger value="estoque">Estoque</TabsTrigger>
          <TabsTrigger value="movs">Movimentações</TabsTrigger>
        </TabsList>

        <TabsContent value="estoque">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Posição de Estoque</CardTitle>
              <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Ajuste de Inventário</Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Input placeholder="Nome ou código de barras..." value={busca} onChange={(e) => setBusca(e.target.value)} className="max-w-xs" />
                <Select value={filtro} onValueChange={(v) => setFiltro(v as any)}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="criticos">Apenas críticos</SelectItem>
                    <SelectItem value="zerados">Apenas zerados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Variante</TableHead>
                    <TableHead>Cód. barras</TableHead>
                    <TableHead>Estoque</TableHead>
                    <TableHead>Mínimo</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((v) => {
                    const min = Number(v.produtos?.estoque_minimo ?? 0);
                    const q = Number(v.qtd_estoque ?? 0);
                    return (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium">{v.produtos?.nome ?? "—"}</TableCell>
                        <TableCell>{v.cor} / {v.tamanho}</TableCell>
                        <TableCell className="font-mono text-xs">{v.codigo_barras}</TableCell>
                        <TableCell>{q}</TableCell>
                        <TableCell>{min}</TableCell>
                        <TableCell>{statusBadge(q, min)}</TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum item.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movs">
          <Card>
            <CardHeader><CardTitle>Histórico de Movimentações</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os tipos</SelectItem>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida_venda">Saída venda</SelectItem>
                  <SelectItem value="saida_consig">Saída consignação</SelectItem>
                  <SelectItem value="devolucao_consig">Devolução consignação</SelectItem>
                  <SelectItem value="ajuste_positivo">Ajuste +</SelectItem>
                  <SelectItem value="ajuste_negativo">Ajuste -</SelectItem>
                </SelectContent>
              </Select>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Produto/Variante</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Qtd</TableHead>
                    <TableHead>Referência</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movsFiltradas.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>{new Date(m.created_at).toLocaleString("pt-BR")}</TableCell>
                      <TableCell>{m.produto_variantes?.produtos?.nome} — {m.produto_variantes?.cor}/{m.produto_variantes?.tamanho}</TableCell>
                      <TableCell><Badge variant="outline">{m.tipo}</Badge></TableCell>
                      <TableCell className={Number(m.quantidade) < 0 ? "text-destructive" : "text-green-600"}>{m.quantidade}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {m.venda_id ? `Venda` : m.consignacao_id ? `Consig.` : "—"}
                      </TableCell>
                      <TableCell>{m.motivo ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                  {movsFiltradas.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhuma movimentação.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AjusteModal open={open} onOpenChange={setOpen} onSaved={load} />
    </div>
  );
}
