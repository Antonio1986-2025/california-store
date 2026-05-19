import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/relatorios")({
  component: RelatoriosPage,
});

const brl = (n: number) =>
  (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("pt-BR");

function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) =>
      r
        .map((c) => {
          const s = String(c ?? "");
          return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(";"),
    )
    .join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function firstDayOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function RelatoriosPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Relatórios</h2>
      <Tabs defaultValue="vendas" className="space-y-4">
        <TabsList>
          <TabsTrigger value="vendas">Vendas</TabsTrigger>
          <TabsTrigger value="estoque">Estoque</TabsTrigger>
          <TabsTrigger value="consignacoes">Condicionais</TabsTrigger>
          <TabsTrigger value="comissoes">Comissões</TabsTrigger>
        </TabsList>
        <TabsContent value="vendas"><RelVendas /></TabsContent>
        <TabsContent value="estoque"><RelEstoque /></TabsContent>
        <TabsContent value="consignacoes"><RelConsignacoes /></TabsContent>
        <TabsContent value="comissoes"><RelComissoes /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ============== VENDAS ============== */
function RelVendas() {
  const [inicio, setInicio] = useState(firstDayOfMonth());
  const [fim, setFim] = useState(todayStr());
  const [forma, setForma] = useState<string>("todas");
  const [funcId, setFuncId] = useState<string>("todos");
  const [funcs, setFuncs] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("funcionarios").select("id,nome").then(({ data }) => setFuncs(data ?? []));
  }, []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const ini = new Date(inicio + "T00:00:00").toISOString();
      const end = new Date(fim + "T23:59:59").toISOString();
      let q = supabase
        .from("vendas")
        .select(
          "id,criado_em,total,desconto,funcionario_id,clientes(nome),funcionarios(nome),pagamentos(forma,valor)",
        )
        .gte("criado_em", ini)
        .lte("criado_em", end)
        .order("criado_em", { ascending: false });
      if (funcId !== "todos") q = q.eq("funcionario_id", funcId);
      const { data } = await q;
      let res = data ?? [];
      if (forma !== "todas") {
        res = res.filter((v: any) =>
          (v.pagamentos ?? []).some((p: any) => p.forma === forma),
        );
      }
      if (!cancel) setRows(res);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [inicio, fim, forma, funcId]);

  const totals = useMemo(() => {
    const qtd = rows.length;
    const total = rows.reduce((a, r) => a + Number(r.total || 0), 0);
    const desc = rows.reduce((a, r) => a + Number(r.desconto || 0), 0);
    return { qtd, total, desc, ticket: qtd ? total / qtd : 0, liquido: total - desc };
  }, [rows]);

  const chart = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r) => {
      const d = new Date(r.criado_em).toISOString().slice(0, 10);
      map.set(d, (map.get(d) ?? 0) + Number(r.total || 0));
    });
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dia, total]) => ({ dia: dia.slice(5), total }));
  }, [rows]);

  function exportar() {
    const header = ["Data", "Nº Venda", "Cliente", "Total", "Pagamento", "Funcionário"];
    const body = rows.map((r) => [
      fmtDate(r.criado_em),
      String(r.id).slice(0, 8).toUpperCase(),
      r.clientes?.nome ?? "—",
      Number(r.total || 0).toFixed(2),
      (r.pagamentos ?? []).map((p: any) => p.forma).join(", "),
      r.funcionarios?.nome ?? "—",
    ]);
    downloadCSV(`vendas_${inicio}_${fim}.csv`, [header, ...body]);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <Label>Início</Label>
            <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </div>
          <div>
            <Label>Fim</Label>
            <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
          </div>
          <div>
            <Label>Forma de pagamento</Label>
            <Select value={forma} onValueChange={setForma}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="pix">Pix</SelectItem>
                <SelectItem value="debito">Débito</SelectItem>
                <SelectItem value="credito">Crédito</SelectItem>
                <SelectItem value="crediario">Crediário</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Funcionário</Label>
            <Select value={funcId} onValueChange={setFuncId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {funcs.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={exportar} className="w-full" variant="outline">
              <Download className="h-4 w-4 mr-2" />Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Faturamento por dia</CardTitle></CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dia" fontSize={12} />
              <YAxis fontSize={12} tickFormatter={(v) => `R$${v}`} />
              <Tooltip formatter={(v: number) => brl(v)} />
              <Line type="monotone" dataKey="total" stroke="var(--accent-blue)" strokeWidth={2.5} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Nº</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Funcionário</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhuma venda no período.</TableCell></TableRow>
                ) : rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{fmtDate(r.criado_em)}</TableCell>
                    <TableCell className="font-mono text-xs">{String(r.id).slice(0, 8).toUpperCase()}</TableCell>
                    <TableCell>{r.clientes?.nome ?? "—"}</TableCell>
                    <TableCell>{(r.pagamentos ?? []).map((p: any) => p.forma).join(", ") || "—"}</TableCell>
                    <TableCell>{r.funcionarios?.nome ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium">{brl(r.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="grid gap-2 grid-cols-2 lg:grid-cols-4 mt-4 pt-4 border-t text-sm">
            <div><p className="text-muted-foreground">Vendas</p><p className="font-semibold">{totals.qtd}</p></div>
            <div><p className="text-muted-foreground">Ticket médio</p><p className="font-semibold">{brl(totals.ticket)}</p></div>
            <div><p className="text-muted-foreground">Descontos</p><p className="font-semibold">{brl(totals.desc)}</p></div>
            <div><p className="text-muted-foreground">Líquido</p><p className="font-semibold">{brl(totals.liquido)}</p></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ============== ESTOQUE ============== */
function RelEstoque() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("produto_variantes")
        .select("id,cor,tamanho,codigo_barras,qtd_estoque,preco_custo,produtos(nome,estoque_minimo)");
      setRows(data ?? []);
      setLoading(false);
    })();
  }, []);

  const total = rows.reduce(
    (a, r) => a + Number(r.qtd_estoque || 0) * Number(r.preco_custo || 0),
    0,
  );

  function exportar() {
    const header = ["Produto", "Cor", "Tamanho", "Cód. barras", "Qtd", "Custo", "Total"];
    const body = rows.map((r) => [
      r.produtos?.nome ?? "",
      r.cor ?? "",
      r.tamanho ?? "",
      r.codigo_barras ?? "",
      r.qtd_estoque ?? 0,
      Number(r.preco_custo || 0).toFixed(2),
      (Number(r.qtd_estoque || 0) * Number(r.preco_custo || 0)).toFixed(2),
    ]);
    downloadCSV("estoque.csv", [header, ...body]);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Estoque</CardTitle>
        <Button onClick={exportar} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />Exportar CSV
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Variante</TableHead>
                <TableHead>Cód. barras</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Custo</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const min = Number(r.produtos?.estoque_minimo ?? 0);
                const baixo = Number(r.qtd_estoque || 0) <= min;
                return (
                  <TableRow key={r.id}>
                    <TableCell>{r.produtos?.nome ?? "—"}</TableCell>
                    <TableCell>{[r.cor, r.tamanho].filter(Boolean).join(" / ") || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.codigo_barras ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {r.qtd_estoque ?? 0}
                      {baixo && <Badge variant="destructive" className="ml-2">baixo</Badge>}
                    </TableCell>
                    <TableCell className="text-right">{brl(r.preco_custo)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {brl(Number(r.qtd_estoque || 0) * Number(r.preco_custo || 0))}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        <div className="mt-4 pt-4 border-t flex justify-end text-sm">
          <span className="text-muted-foreground mr-2">Valor total do estoque:</span>
          <span className="font-semibold">{brl(total)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

/* ============== CONSIGNAÇÕES ============== */
function RelConsignacoes() {
  const [inicio, setInicio] = useState(firstDayOfMonth());
  const [fim, setFim] = useState(todayStr());
  const [status, setStatus] = useState("todos");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = supabase
        .from("consignacoes")
        .select("id,data_saida,data_prazo,status,total,clientes(nome),consignacao_itens(qtd_saiu,qtd_devolvida,qtd_vendida,preco_unitario)")
        .gte("data_saida", inicio)
        .lte("data_saida", fim)
        .order("data_saida", { ascending: false });
      if (status !== "todos") q = q.eq("status", status);
      const { data } = await q;
      setRows(data ?? []);
      setLoading(false);
    })();
  }, [inicio, fim, status]);

  const totals = useMemo(() => {
    let pecasCampo = 0, valorReceber = 0;
    rows.forEach((c) => {
      (c.consignacao_itens ?? []).forEach((i: any) => {
        const saiu = Number(i.qtd_saiu || 0);
        const dev = Number(i.qtd_devolvida || 0);
        const vend = Number(i.qtd_vendida || 0);
        pecasCampo += Math.max(0, saiu - dev - vend);
        valorReceber += vend * Number(i.preco_unitario || 0);
      });
    });
    return { pecasCampo, valorReceber };
  }, [rows]);

  function sumQtd(c: any, key: string) {
    return (c.consignacao_itens ?? []).reduce((a: number, i: any) => a + Number(i[key] || 0), 0);
  }
  function valorCobrado(c: any) {
    return (c.consignacao_itens ?? []).reduce(
      (a: number, i: any) => a + Number(i.qtd_vendida || 0) * Number(i.preco_unitario || 0),
      0,
    );
  }

  function exportar() {
    const header = ["Cliente", "Saída", "Prazo", "Saiu", "Devolvido", "Vendido", "Valor cobrado", "Status"];
    const body = rows.map((c) => [
      c.clientes?.nome ?? "",
      c.data_saida ? fmtDate(c.data_saida) : "",
      c.data_prazo ? fmtDate(c.data_prazo) : "",
      sumQtd(c, "qtd_saiu"),
      sumQtd(c, "qtd_devolvida"),
      sumQtd(c, "qtd_vendida"),
      valorCobrado(c).toFixed(2),
      c.status ?? "",
    ]);
    downloadCSV("consignacoes.csv", [header, ...body]);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 grid gap-3 grid-cols-1 sm:grid-cols-4">
          <div><Label>Início</Label><Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></div>
          <div><Label>Fim</Label><Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} /></div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="aberta">Aberta</SelectItem>
                <SelectItem value="parcial">Parcial</SelectItem>
                <SelectItem value="encerrada">Encerrada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={exportar} variant="outline" className="w-full">
              <Download className="h-4 w-4 mr-2" />Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Saída</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead className="text-right">Saiu</TableHead>
                  <TableHead className="text-right">Devolvido</TableHead>
                  <TableHead className="text-right">Vendido</TableHead>
                  <TableHead className="text-right">Valor cobrado</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.clientes?.nome ?? "—"}</TableCell>
                    <TableCell>{c.data_saida ? fmtDate(c.data_saida) : "—"}</TableCell>
                    <TableCell>{c.data_prazo ? fmtDate(c.data_prazo) : "—"}</TableCell>
                    <TableCell className="text-right">{sumQtd(c, "qtd_saiu")}</TableCell>
                    <TableCell className="text-right">{sumQtd(c, "qtd_devolvida")}</TableCell>
                    <TableCell className="text-right">{sumQtd(c, "qtd_vendida")}</TableCell>
                    <TableCell className="text-right">{brl(valorCobrado(c))}</TableCell>
                    <TableCell><Badge variant="outline">{c.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="grid gap-2 grid-cols-2 mt-4 pt-4 border-t text-sm">
            <div><p className="text-muted-foreground">Peças em campo</p><p className="font-semibold">{totals.pecasCampo}</p></div>
            <div><p className="text-muted-foreground">Valor a receber</p><p className="font-semibold">{brl(totals.valorReceber)}</p></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ============== COMISSÕES ============== */
function RelComissoes() {
  const [inicio, setInicio] = useState(firstDayOfMonth());
  const [fim, setFim] = useState(todayStr());
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const ini = new Date(inicio + "T00:00:00").toISOString();
      const end = new Date(fim + "T23:59:59").toISOString();
      const { data } = await supabase
        .from("vendas")
        .select("total,funcionario_id,funcionarios(nome,comissao_pct)")
        .not("funcionario_id", "is", null)
        .gte("criado_em", ini)
        .lte("criado_em", end);
      const map = new Map<string, { nome: string; pct: number; qtd: number; total: number }>();
      (data ?? []).forEach((v: any) => {
        const id = v.funcionario_id;
        const cur = map.get(id) ?? {
          nome: v.funcionarios?.nome ?? "—",
          pct: Number(v.funcionarios?.comissao_pct || 0),
          qtd: 0, total: 0,
        };
        cur.qtd += 1;
        cur.total += Number(v.total || 0);
        map.set(id, cur);
      });
      setRows([...map.values()]);
      setLoading(false);
    })();
  }, [inicio, fim]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 grid gap-3 grid-cols-1 sm:grid-cols-3">
          <div><Label>Início</Label><Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></div>
          <div><Label>Fim</Label><Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} /></div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                  <TableHead className="text-right">Total vendido</TableHead>
                  <TableHead className="text-right">% Comissão</TableHead>
                  <TableHead className="text-right">Comissão a pagar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sem dados no período.</TableCell></TableRow>
                ) : rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.nome}</TableCell>
                    <TableCell className="text-right">{r.qtd}</TableCell>
                    <TableCell className="text-right">{brl(r.total)}</TableCell>
                    <TableCell className="text-right">{r.pct.toFixed(2)}%</TableCell>
                    <TableCell className="text-right font-medium">{brl(r.total * r.pct / 100)}</TableCell>
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