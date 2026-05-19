import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDownToLine, ArrowUpFromLine, Lock, Unlock, Plus, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { brl } from "@/lib/pdv-types";

export const Route = createFileRoute("/_authenticated/financeiro")({
  component: Page,
});

function Page() {
  return (
    <Tabs defaultValue="caixa">
      <TabsList>
        <TabsTrigger value="caixa">Caixa</TabsTrigger>
        <TabsTrigger value="contas">Contas</TabsTrigger>
        <TabsTrigger value="dre">DRE</TabsTrigger>
      </TabsList>
      <TabsContent value="caixa"><Caixa /></TabsContent>
      <TabsContent value="contas"><Contas /></TabsContent>
      <TabsContent value="dre"><DRE /></TabsContent>
    </Tabs>
  );
}

/* ================== CAIXA ================== */
function Caixa() {
  const { user } = useAuth();
  const [caixa, setCaixa] = useState<any>(null);
  const [movs, setMovs] = useState<any[]>([]);
  const [pagamentos, setPagamentos] = useState<any[]>([]);
  const [openAbrir, setOpenAbrir] = useState(false);
  const [openMov, setOpenMov] = useState<"sangria" | "suprimento" | null>(null);
  const [valor, setValor] = useState(0);
  const [desc, setDesc] = useState("");
  const [funcionarioId, setFuncionarioId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase.from("funcionarios").select("id")
        .eq("user_id", user.id).maybeSingle();
      if (data?.id) { setFuncionarioId(data.id); return; }
      const nome = user.email?.split("@")[0] ?? "Usuário";
      const { data: novo, error } = await supabase.from("funcionarios").insert({
        user_id: user.id, nome, perfil: "admin", ativo: true, comissao_pct: 0,
      }).select("id").single();
      if (error) { toast.error("Não foi possível vincular funcionário: " + error.message); return; }
      setFuncionarioId(novo.id);
    })();
  }, [user?.id]);

  const load = async () => {
    const { data: c } = await supabase.from("caixa_sessoes").select("*")
      .eq("status", "aberta")
      .order("abertura_em", { ascending: false }).limit(1).maybeSingle();
    setCaixa(c);
    if (c) {
      const { data: m } = await supabase.from("caixa_movimentos").select("*")
        .eq("sessao_id", c.id).order("criado_em", { ascending: false });
      setMovs(m ?? []);
      const ini = c.abertura_em;
      const { data: pg } = await supabase.from("pagamentos").select("forma, valor, vendas!inner(criado_em)").gte("vendas.criado_em", ini);
      setPagamentos(pg ?? []);
    } else {
      setMovs([]); setPagamentos([]);
    }
  };
  useEffect(() => { load(); }, []);

  const totaisForma = useMemo(() => {
    const t: Record<string, number> = {};
    pagamentos.forEach((p: any) => { t[p.forma] = (t[p.forma] ?? 0) + Number(p.valor ?? 0); });
    return t;
  }, [pagamentos]);

  const totalSangria = movs.filter((m) => m.tipo === "sangria").reduce((s, m) => s + Number(m.valor ?? 0), 0);
  const totalSupr = movs.filter((m) => m.tipo === "suprimento").reduce((s, m) => s + Number(m.valor ?? 0), 0);
  const totalDinheiro = totaisForma.dinheiro ?? 0;
  const saldoFinal = Number(caixa?.saldo_inicial ?? 0) + totalDinheiro + totalSupr - totalSangria;

  const abrir = async () => {
    if (!funcionarioId) return toast.error("Usuário sem cadastro de funcionário vinculado.");
    const { data: ses, error } = await supabase.from("caixa_sessoes").insert({
      saldo_inicial: valor, funcionario_id: funcionarioId,
      abertura_em: new Date().toISOString(), status: "aberta",
    }).select("id").single();
    if (error) return toast.error(error.message);
    if (ses) {
      await supabase.from("caixa_movimentos").insert({
        sessao_id: ses.id, tipo: "abertura", valor,
        descricao: "Abertura de caixa", funcionario_id: funcionarioId,
      });
    }
    toast.success("Caixa aberto"); setOpenAbrir(false); setValor(0); load();
  };

  const fechar = async () => {
    if (!caixa) return;
    const { error } = await supabase.from("caixa_sessoes").update({
      fechamento_em: new Date().toISOString(), saldo_final: saldoFinal, status: "fechada",
    }).eq("id", caixa.id);
    if (error) return toast.error(error.message);
    await supabase.from("caixa_movimentos").insert({
      sessao_id: caixa.id, tipo: "fechamento", valor: saldoFinal,
      descricao: "Fechamento de caixa", funcionario_id: funcionarioId,
    });
    toast.success(`Caixa fechado. Saldo: ${brl(saldoFinal)}`); load();
  };

  const lancar = async () => {
    if (!caixa || !openMov || valor <= 0) return;
    const { error } = await supabase.from("caixa_movimentos").insert({
      sessao_id: caixa.id, tipo: openMov, valor, descricao: desc, funcionario_id: funcionarioId,
    });
    if (error) return toast.error(error.message);
    toast.success("Lançado"); setOpenMov(null); setValor(0); setDesc(""); load();
  };

  return (
    <div className="space-y-4 mt-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Status do Caixa</CardTitle>
          {caixa
            ? <Button onClick={fechar} variant="destructive"><Lock className="h-4 w-4 mr-1" />Fechar Caixa</Button>
            : <Button onClick={() => setOpenAbrir(true)}><Unlock className="h-4 w-4 mr-1" />Abrir Caixa</Button>}
        </CardHeader>
        <CardContent>
          {caixa ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Info l="Aberto em" v={new Date(caixa.abertura_em).toLocaleString("pt-BR")} />
              <Info l="Saldo inicial" v={brl(Number(caixa.saldo_inicial ?? 0))} />
              <Info l="Saldo final esperado" v={brl(saldoFinal)} />
              <Info l="Funcionário" v={caixa.funcionario_id ?? "—"} />
            </div>
          ) : <p className="text-muted-foreground text-sm">Caixa fechado.</p>}
        </CardContent>
      </Card>

      {caixa && (
        <>
          <Card>
            <CardHeader><CardTitle>Resumo do Dia</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {["dinheiro","debito","credito","pix","credito_cliente"].map((f) => (
                  <Info key={f} l={f} v={brl(totaisForma[f] ?? 0)} />
                ))}
                <Info l="Sangrias" v={brl(totalSangria)} />
                <Info l="Suprimentos" v={brl(totalSupr)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Movimentos do Dia</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setOpenMov("sangria")}><ArrowUpFromLine className="h-4 w-4 mr-1" />Sangria</Button>
                <Button size="sm" variant="outline" onClick={() => setOpenMov("suprimento")}><ArrowDownToLine className="h-4 w-4 mr-1" />Suprimento</Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Hora</TableHead><TableHead>Tipo</TableHead><TableHead>Valor</TableHead><TableHead>Descrição</TableHead></TableRow></TableHeader>
                <TableBody>
                  {movs.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>{new Date(m.criado_em).toLocaleTimeString("pt-BR")}</TableCell>
                      <TableCell><Badge variant="outline">{m.tipo}</Badge></TableCell>
                      <TableCell className={m.tipo === "sangria" ? "text-destructive" : "text-green-600"}>{brl(Number(m.valor ?? 0))}</TableCell>
                      <TableCell>{m.descricao ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                  {movs.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Sem movimentos.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={openAbrir} onOpenChange={setOpenAbrir}>
        <DialogContent>
          <DialogHeader><DialogTitle>Abrir Caixa</DialogTitle></DialogHeader>
          <div className="grid gap-2"><Label>Saldo inicial</Label><Input type="number" step="0.01" value={valor} onChange={(e) => setValor(Number(e.target.value))} /></div>
          <DialogFooter><Button onClick={abrir}>Abrir</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!openMov} onOpenChange={(o) => !o && setOpenMov(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{openMov === "sangria" ? "Sangria" : "Suprimento"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2"><Label>Valor</Label><Input type="number" step="0.01" value={valor} onChange={(e) => setValor(Number(e.target.value))} /></div>
            <div className="grid gap-2"><Label>Descrição</Label><Input value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
          </div>
          <DialogFooter><Button onClick={lancar}>Confirmar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ l, v }: { l: string; v: string }) {
  return <div><p className="text-xs text-muted-foreground capitalize">{l}</p><p className="text-base font-semibold">{v}</p></div>;
}

/* ================== CONTAS ================== */
function Contas() {
  const [tipo, setTipo] = useState<"pagar" | "receber">("pagar");
  const [filtro, setFiltro] = useState<"todas" | "vencidas" | "hoje" | "semana">("todas");
  const [rows, setRows] = useState<any[]>([]);
  const [novaOpen, setNovaOpen] = useState(false);
  const [nova, setNova] = useState<any>({ tipo: "pagar", descricao: "", valor: 0, vencimento: "" });

  const load = async () => {
    const { data } = await supabase.from("contas").select("*, fornecedores(nome), clientes(nome)")
      .eq("tipo", tipo).order("vencimento");
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, [tipo]);

  const filtered = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const semana = new Date(today); semana.setDate(semana.getDate() + 7);
    return rows.filter((r) => {
      if (filtro === "todas") return true;
      const v = new Date(r.vencimento);
      if (filtro === "vencidas") return v < today && r.status !== "pago";
      if (filtro === "hoje") return v.toDateString() === today.toDateString();
      if (filtro === "semana") return v >= today && v <= semana;
      return true;
    });
  }, [rows, filtro]);

  const pagar = async (r: any) => {
    await supabase.from("contas").update({ status: "pago", pago_em: new Date().toISOString() }).eq("id", r.id);
    toast.success("Conta paga"); load();
  };

  const salvarNova = async () => {
    if (!nova.descricao || !nova.vencimento) return toast.error("Preencha descrição e vencimento");
    const { error } = await supabase.from("contas").insert({ ...nova, tipo, status: "pendente" });
    if (error) return toast.error(error.message);
    toast.success("Conta criada"); setNovaOpen(false); setNova({ descricao: "", valor: 0, vencimento: "" }); load();
  };

  const statusBadge = (r: any) => {
    if (r.status === "pago") return <Badge>Pago</Badge>;
    if (r.status === "cancelado") return <Badge variant="secondary">Cancelado</Badge>;
    const v = new Date(r.vencimento); const t = new Date(); t.setHours(0,0,0,0);
    if (v < t || r.status === "vencido") return <Badge variant="destructive">Vencido</Badge>;
    return <Badge variant="outline">Pendente</Badge>;
  };

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Contas</CardTitle>
        <Button onClick={() => setNovaOpen(true)}><Plus className="h-4 w-4 mr-1" />Nova conta</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={tipo} onValueChange={(v) => setTipo(v as any)}>
          <TabsList>
            <TabsTrigger value="pagar">A Pagar</TabsTrigger>
            <TabsTrigger value="receber">A Receber</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={filtro} onValueChange={(v) => setFiltro(v as any)}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="vencidas">Vencidas</SelectItem>
            <SelectItem value="hoje">Vencendo hoje</SelectItem>
            <SelectItem value="semana">Esta semana</SelectItem>
          </SelectContent>
        </Select>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Descrição</TableHead><TableHead>Vencimento</TableHead><TableHead>Valor</TableHead>
            <TableHead>{tipo === "pagar" ? "Fornecedor" : "Cliente"}</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.descricao}</TableCell>
                <TableCell>{new Date(r.vencimento).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell>{brl(Number(r.valor ?? 0))}</TableCell>
                <TableCell>{r.fornecedores?.nome ?? r.clientes?.nome ?? "—"}</TableCell>
                <TableCell>{statusBadge(r)}</TableCell>
                <TableCell>{r.status !== "pago" && (
                  <Button size="sm" variant="outline" onClick={() => pagar(r)}><CheckCircle2 className="h-4 w-4 mr-1" />Pagar</Button>
                )}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhuma conta.</TableCell></TableRow>}
          </TableBody>
        </Table>

        <Dialog open={novaOpen} onOpenChange={setNovaOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova conta a {tipo}</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-2"><Label>Descrição</Label><Input value={nova.descricao} onChange={(e) => setNova({ ...nova, descricao: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2"><Label>Valor</Label><Input type="number" step="0.01" value={nova.valor} onChange={(e) => setNova({ ...nova, valor: Number(e.target.value) })} /></div>
                <div className="grid gap-2"><Label>Vencimento</Label><Input type="date" value={nova.vencimento} onChange={(e) => setNova({ ...nova, vencimento: e.target.value })} /></div>
              </div>
            </div>
            <DialogFooter><Button onClick={salvarNova}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

/* ================== DRE ================== */
function DRE() {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [receitasPorForma, setReceitasPorForma] = useState<Record<string, number>>({});
  const [despesas, setDespesas] = useState(0);

  useEffect(() => {
    (async () => {
      const ini = new Date(ano, mes - 1, 1).toISOString();
      const fim = new Date(ano, mes, 1).toISOString();
      const { data: pg } = await supabase.from("pagamentos").select("forma, valor, vendas!inner(created_at)")
        .gte("vendas.created_at", ini).lt("vendas.created_at", fim);
      const t: Record<string, number> = {};
      (pg ?? []).forEach((p: any) => { t[p.forma] = (t[p.forma] ?? 0) + Number(p.valor ?? 0); });
      setReceitasPorForma(t);
      const { data: ct } = await supabase.from("contas").select("valor").eq("status", "pago").gte("pago_em", ini).lt("pago_em", fim);
      setDespesas((ct ?? []).reduce((s: number, c: any) => s + Number(c.valor ?? 0), 0));
    })();
  }, [mes, ano]);

  const totalReceitas = Object.values(receitasPorForma).reduce((s, v) => s + v, 0);
  const lucro = totalReceitas - despesas;

  return (
    <Card className="mt-4">
      <CardHeader><CardTitle>DRE Simplificado</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>{Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <SelectItem key={m} value={String(m)}>{m.toString().padStart(2, "0")}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>{Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <h3 className="font-semibold mb-2">Receitas</h3>
          <Table><TableBody>
            {Object.entries(receitasPorForma).map(([f, v]) => (
              <TableRow key={f}><TableCell className="capitalize">{f}</TableCell><TableCell className="text-right">{brl(v)}</TableCell></TableRow>
            ))}
            <TableRow className="font-semibold"><TableCell>Total receitas</TableCell><TableCell className="text-right text-green-600">{brl(totalReceitas)}</TableCell></TableRow>
          </TableBody></Table>
        </div>
        <div>
          <h3 className="font-semibold mb-2">Despesas</h3>
          <Table><TableBody>
            <TableRow><TableCell>Contas pagas no período</TableCell><TableCell className="text-right text-destructive">{brl(despesas)}</TableCell></TableRow>
          </TableBody></Table>
        </div>
        <div className="border-t pt-3 flex justify-between text-lg font-bold">
          <span>Lucro Bruto</span>
          <span className={lucro >= 0 ? "text-green-600" : "text-destructive"}>{brl(lucro)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
