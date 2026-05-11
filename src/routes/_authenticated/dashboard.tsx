import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  TrendingUp, TrendingDown, DollarSign, Boxes, Handshake, Calendar,
  AlertTriangle, AlertCircle, Cake,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Metrics = {
  vendasHoje: number;
  vendasMes: number;
  estoque: number;
  consignacoes: number;
  varHoje: number | null;
  varMes: number | null;
};

const fakeWeek = [
  { dia: "Seg", total: 1200 }, { dia: "Ter", total: 1850 },
  { dia: "Qua", total: 1430 }, { dia: "Qui", total: 2100 },
  { dia: "Sex", total: 2780 }, { dia: "Sáb", total: 3420 },
  { dia: "Dom", total: 1980 },
];
const fakeTopProducts = [
  { nome: "Vestido Floral", qtd: 42 },
  { nome: "Blusa Tricot", qtd: 36 },
  { nome: "Saia Midi", qtd: 28 },
  { nome: "Calça Wide Leg", qtd: 24 },
  { nome: "Cropped Básico", qtd: 19 },
];
const fakeLastSales = [
  { id: "001", cliente: "Ana Beatriz", total: 289.9, pagamento: "Pix" },
  { id: "002", cliente: "Mariana S.", total: 459.0, pagamento: "Crédito" },
  { id: "003", cliente: "Júlia R.", total: 129.9, pagamento: "Débito" },
  { id: "004", cliente: "Fernanda L.", total: 698.5, pagamento: "Crédito" },
  { id: "005", cliente: "Patrícia M.", total: 89.0, pagamento: "Dinheiro" },
];

async function safeSum(table: string, column: string, filter?: { gte?: { col: string; v: string } }) {
  try {
    let q = supabase.from(table).select(column);
    if (filter?.gte) q = q.gte(filter.gte.col, filter.gte.v);
    const { data, error } = await q;
    if (error || !data) return 0;
    return data.reduce((acc: number, r: any) => acc + (Number(r[column]) || 0), 0);
  } catch {
    return 0;
  }
}
async function safeCount(table: string, filter?: { eq?: { col: string; v: any } }) {
  try {
    let q = supabase.from(table).select("*", { count: "exact", head: true });
    if (filter?.eq) q = q.eq(filter.eq.col, filter.eq.v);
    const { count, error } = await q;
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

function DashboardPage() {
  const [m, setM] = useState<Metrics>({
    vendasHoje: 0, vendasMes: 0, estoque: 0, consignacoes: 0, varHoje: null, varMes: null,
  });
  const [alerts, setAlerts] = useState({ vencidas: 0, semEstoque: 0, aniversariantes: 0 });

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const month = new Date().getMonth() + 1;
      const [vencidas, semEstoque, clientes] = await Promise.all([
        supabase.from("consignacoes").select("id", { count: "exact", head: true })
          .eq("status", "aberta").lt("data_prazo", today),
        supabase.from("produto_variantes").select("id", { count: "exact", head: true })
          .eq("qtd_estoque", 0),
        supabase.from("clientes").select("data_nascimento"),
      ]);
      const aniv = (clientes.data ?? []).filter((c: any) => {
        if (!c.data_nascimento) return false;
        return new Date(c.data_nascimento).getMonth() + 1 === month;
      }).length;
      setAlerts({
        vencidas: vencidas.count ?? 0,
        semEstoque: semEstoque.count ?? 0,
        aniversariantes: aniv,
      });
    })();
  }, []);

  useEffect(() => {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const startYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const startPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

    (async () => {
      const [vendasHoje, vendasOntem, vendasMes, vendasMesAnt, estoque, consig] = await Promise.all([
        safeSum("vendas", "total", { gte: { col: "created_at", v: startToday } }),
        (async () => {
          try {
            const { data } = await supabase
              .from("vendas")
              .select("total")
              .gte("created_at", startYesterday)
              .lt("created_at", startToday);
            return (data ?? []).reduce((a: number, r: any) => a + (Number(r.total) || 0), 0);
          } catch { return 0; }
        })(),
        safeSum("vendas", "total", { gte: { col: "created_at", v: startMonth } }),
        (async () => {
          try {
            const { data } = await supabase
              .from("vendas")
              .select("total")
              .gte("created_at", startPrevMonth)
              .lt("created_at", startMonth);
            return (data ?? []).reduce((a: number, r: any) => a + (Number(r.total) || 0), 0);
          } catch { return 0; }
        })(),
        safeSum("produto_variantes", "estoque"),
        safeCount("consignacoes", { eq: { col: "status", v: "aberta" } }),
      ]);
      const pct = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : null);
      setM({
        vendasHoje, vendasMes, estoque, consignacoes: consig,
        varHoje: pct(vendasHoje, vendasOntem),
        varMes: pct(vendasMes, vendasMesAnt),
      });
    })();
  }, []);

  const cards = [
    { title: "Vendas Hoje", value: brl(m.vendasHoje), variation: m.varHoje, icon: DollarSign, sub: "vs ontem" },
    { title: "Vendas do Mês", value: brl(m.vendasMes), variation: m.varMes, icon: Calendar, sub: "vs mês anterior" },
    { title: "Itens no Estoque", value: m.estoque.toLocaleString("pt-BR"), variation: null, icon: Boxes, sub: "unidades disponíveis" },
    { title: "Condicionais Abertas", value: m.consignacoes.toLocaleString("pt-BR"), variation: null, icon: Handshake, sub: "em andamento" },
  ];

  return (
    <div className="space-y-6">
      {(alerts.vencidas > 0 || alerts.semEstoque > 0 || alerts.aniversariantes > 0) && (
        <div className="space-y-2">
          {alerts.vencidas > 0 && (
            <Link to="/consignacao" className="flex items-center justify-between rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-900 hover:bg-yellow-100">
              <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />
                {alerts.vencidas} condicional(ões) vencida(s) sem encerramento.
              </span>
              <span className="text-xs underline">Ver condicionais</span>
            </Link>
          )}
          {alerts.semEstoque > 0 && (
            <Link to="/estoque" className="flex items-center justify-between rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 hover:bg-red-100">
              <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />
                {alerts.semEstoque} variante(s) com estoque zerado.
              </span>
              <span className="text-xs underline">Ver estoque</span>
            </Link>
          )}
          {alerts.aniversariantes > 0 && (
            <Link to="/clientes" className="flex items-center justify-between rounded-md border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-900 hover:bg-blue-100">
              <span className="flex items-center gap-2"><Cake className="h-4 w-4" />
                {alerts.aniversariantes} cliente(s) fazem aniversário neste mês.
              </span>
              <span className="text-xs underline">Ver clientes</span>
            </Link>
          )}
        </div>
      )}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          const positive = c.variation != null && c.variation >= 0;
          return (
            <Card key={c.title}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{c.title}</p>
                    <p className="text-2xl font-semibold mt-1">{c.value}</p>
                  </div>
                  <div className="h-9 w-9 rounded-md bg-accent text-accent-foreground flex items-center justify-center">
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1 text-xs">
                  {c.variation != null ? (
                    <>
                      {positive ? (
                        <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                      )}
                      <span className={positive ? "text-emerald-600" : "text-destructive"}>
                        {c.variation.toFixed(1)}%
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                  <span className="text-muted-foreground">{c.sub}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Faturamento — últimos 7 dias</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={fakeWeek}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" />
                <XAxis dataKey="dia" stroke="hsl(0 0% 50%)" fontSize={12} />
                <YAxis stroke="hsl(0 0% 50%)" fontSize={12} tickFormatter={(v) => `R$${v}`} />
                <Tooltip formatter={(v: number) => brl(v)} />
                <Line type="monotone" dataKey="total" stroke="var(--accent-blue)" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Top 5 produtos vendidos</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fakeTopProducts}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" />
                <XAxis dataKey="nome" stroke="hsl(0 0% 50%)" fontSize={11} interval={0} />
                <YAxis stroke="hsl(0 0% 50%)" fontSize={12} />
                <Tooltip />
                <Bar dataKey="qtd" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Últimas vendas do dia</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fakeLastSales.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{s.id}</TableCell>
                  <TableCell>{s.cliente}</TableCell>
                  <TableCell>{s.pagamento}</TableCell>
                  <TableCell className="text-right font-medium">{brl(s.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}