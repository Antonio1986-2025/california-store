import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Plus, Pencil, Cake, Wallet } from "lucide-react";
import { toast } from "sonner";
import { brl } from "@/lib/pdv-types";

export const Route = createFileRoute("/_authenticated/clientes")({
  component: Page,
});

type Cliente = {
  id: string; nome: string; cpf: string | null; rg: string | null;
  data_nascimento: string | null; whatsapp: string | null; email: string | null;
  rua: string | null; bairro: string | null; cidade: string | null; cep: string | null;
  observacoes: string | null; saldo_credito: number | null;
};

function Page() {
  const [rows, setRows] = useState<Cliente[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from("clientes").select("*").order("nome");
    setRows((data as any) ?? []);
    const { data: vendas } = await supabase.from("vendas").select("cliente_id");
    const c: Record<string, number> = {};
    (vendas ?? []).forEach((v: any) => { if (v.cliente_id) c[v.cliente_id] = (c[v.cliente_id] ?? 0) + 1; });
    setCounts(c);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const t = busca.toLowerCase();
    if (!t) return rows;
    return rows.filter((r) => `${r.nome} ${r.cpf ?? ""} ${r.whatsapp ?? ""}`.toLowerCase().includes(t));
  }, [rows, busca]);

  const mesAtual = new Date().getMonth() + 1;
  const aniversariante = (d: string | null) => {
    if (!d) return false;
    return new Date(d).getMonth() + 1 === mesAtual;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Clientes</CardTitle>
          <Button onClick={() => { setEditId(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1" />Novo Cliente</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="Buscar por nome, CPF ou WhatsApp..." value={busca} onChange={(e) => setBusca(e.target.value)} className="max-w-sm" />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead><TableHead>CPF</TableHead><TableHead>WhatsApp</TableHead>
                <TableHead>Cidade</TableHead><TableHead>Compras</TableHead><TableHead>Crédito</TableHead><TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <button onClick={() => setProfileId(r.id)} className="hover:underline inline-flex items-center gap-1">
                      {r.nome}
                      {aniversariante(r.data_nascimento) && <Cake className="h-4 w-4 text-pink-500" />}
                    </button>
                  </TableCell>
                  <TableCell>{r.cpf ?? "—"}</TableCell>
                  <TableCell>{r.whatsapp ?? "—"}</TableCell>
                  <TableCell>{r.cidade ?? "—"}</TableCell>
                  <TableCell>{counts[r.id] ?? 0}</TableCell>
                  <TableCell>{brl(Number(r.saldo_credito ?? 0))}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => { setEditId(r.id); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nenhum cliente.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ClienteForm open={open} onOpenChange={setOpen} clienteId={editId} onSaved={load} />
      <ClientePerfil clienteId={profileId} onClose={() => setProfileId(null)} onChanged={load} />
    </div>
  );
}

function ClienteForm({ open, onOpenChange, clienteId, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; clienteId: string | null; onSaved: () => void; }) {
  const [c, setC] = useState<Partial<Cliente>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (clienteId) {
      supabase.from("clientes").select("*").eq("id", clienteId).maybeSingle().then(({ data }) => setC((data as any) ?? {}));
    } else {
      setC({});
    }
  }, [open, clienteId]);

  const set = (k: keyof Cliente, v: any) => setC((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!c.nome) return toast.error("Informe o nome");
    setBusy(true);
    const payload: any = { ...c };
    delete payload.saldo_credito; // somente leitura
    delete payload.id;
    const op = clienteId
      ? supabase.from("clientes").update(payload).eq("id", clienteId)
      : supabase.from("clientes").insert(payload);
    const { error } = await op;
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Cliente salvo");
    onSaved(); onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader><SheetTitle>{clienteId ? "Editar cliente" : "Novo cliente"}</SheetTitle></SheetHeader>
        <div className="grid gap-3 py-4">
          <div className="grid gap-2"><Label>Nome *</Label><Input value={c.nome ?? ""} onChange={(e) => set("nome", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2"><Label>CPF</Label><Input value={c.cpf ?? ""} onChange={(e) => set("cpf", e.target.value)} /></div>
            <div className="grid gap-2"><Label>RG</Label><Input value={c.rg ?? ""} onChange={(e) => set("rg", e.target.value)} /></div>
            <div className="grid gap-2"><Label>Data nascimento</Label><Input type="date" value={c.data_nascimento ?? ""} onChange={(e) => set("data_nascimento", e.target.value)} /></div>
            <div className="grid gap-2"><Label>WhatsApp</Label><Input value={c.whatsapp ?? ""} onChange={(e) => set("whatsapp", e.target.value)} /></div>
            <div className="grid gap-2 col-span-2"><Label>Email</Label><Input type="email" value={c.email ?? ""} onChange={(e) => set("email", e.target.value)} /></div>
            <div className="grid gap-2 col-span-2"><Label>Rua</Label><Input value={c.rua ?? ""} onChange={(e) => set("rua", e.target.value)} /></div>
            <div className="grid gap-2"><Label>Bairro</Label><Input value={c.bairro ?? ""} onChange={(e) => set("bairro", e.target.value)} /></div>
            <div className="grid gap-2"><Label>Cidade</Label><Input value={c.cidade ?? ""} onChange={(e) => set("cidade", e.target.value)} /></div>
            <div className="grid gap-2"><Label>CEP</Label><Input value={c.cep ?? ""} onChange={(e) => set("cep", e.target.value)} /></div>
            <div className="grid gap-2"><Label>Saldo crédito</Label><Input value={brl(Number(c.saldo_credito ?? 0))} disabled /></div>
          </div>
          <div className="grid gap-2"><Label>Observações</Label><Textarea value={c.observacoes ?? ""} onChange={(e) => set("observacoes", e.target.value)} /></div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={busy}>Salvar</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ClientePerfil({ clienteId, onClose, onChanged }: { clienteId: string | null; onClose: () => void; onChanged: () => void }) {
  const [c, setC] = useState<Cliente | null>(null);
  const [vendas, setVendas] = useState<any[]>([]);
  const [consigs, setConsigs] = useState<any[]>([]);
  const [credOpen, setCredOpen] = useState(false);
  const [credValor, setCredValor] = useState(0);
  const [credDesc, setCredDesc] = useState("");

  useEffect(() => {
    if (!clienteId) { setC(null); return; }
    (async () => {
      const { data } = await supabase.from("clientes").select("*").eq("id", clienteId).maybeSingle();
      setC(data as any);
      const { data: vs } = await supabase.from("vendas").select("id, created_at, total, pagamentos(forma)").eq("cliente_id", clienteId).order("created_at", { ascending: false });
      setVendas(vs ?? []);
      const { data: cs } = await supabase.from("consignacoes").select("id, data_saida, status, total").eq("cliente_id", clienteId).order("data_saida", { ascending: false });
      setConsigs(cs ?? []);
    })();
  }, [clienteId]);

  const totalGasto = vendas.reduce((s, v) => s + Number(v.total ?? 0), 0);
  const ultima = vendas[0];

  const addCredito = async () => {
    if (!c || credValor === 0) return;
    const novo = Number(c.saldo_credito ?? 0) + credValor;
    const { error } = await supabase.from("clientes").update({ saldo_credito: novo }).eq("id", c.id);
    if (error) return toast.error(error.message);
    // Registra em caixa_movimentos (sessão de caixa atualmente aberta, se houver)
    const { data: sessao } = await supabase
      .from("caixa_sessoes")
      .select("id, funcionario_id")
      .eq("status", "aberta")
      .order("abertura_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sessao) {
      await supabase.from("caixa_movimentos").insert({
        sessao_id: sessao.id,
        tipo: "recebimento",
        valor: credValor,
        descricao: credDesc || `Crédito/vale-troca para ${c.nome}`,
        funcionario_id: sessao.funcionario_id ?? null,
      });
    }
    toast.success("Crédito atualizado");
    setC({ ...c, saldo_credito: novo });
    setCredOpen(false); setCredValor(0); setCredDesc("");
    onChanged();
  };

  return (
    <Dialog open={!!clienteId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{c?.nome ?? "Cliente"}</DialogTitle></DialogHeader>
        {c && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total gasto</p><p className="text-xl font-bold">{brl(totalGasto)}</p></CardContent></Card>
              <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Compras</p><p className="text-xl font-bold">{vendas.length}</p></CardContent></Card>
              <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Última compra</p><p className="text-sm font-medium">{ultima ? new Date(ultima.created_at).toLocaleDateString("pt-BR") : "—"}</p></CardContent></Card>
              <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Crédito</p><p className="text-xl font-bold">{brl(Number(c.saldo_credito ?? 0))}</p></CardContent></Card>
            </div>
            <Button onClick={() => setCredOpen(true)} variant="outline"><Wallet className="h-4 w-4 mr-1" />Adicionar crédito / vale-troca</Button>

            <div>
              <h3 className="font-semibold mb-2">Histórico de vendas</h3>
              <Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Total</TableHead><TableHead>Pagamento</TableHead></TableRow></TableHeader>
                <TableBody>
                  {vendas.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell>{new Date(v.created_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>{brl(Number(v.total ?? 0))}</TableCell>
                      <TableCell>{(v.pagamentos ?? []).map((p: any) => p.forma).join(", ") || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {vendas.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Sem vendas.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Histórico de condicionais</h3>
              <Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {consigs.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{new Date(c.data_saida).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>{brl(Number(c.total ?? 0))}</TableCell>
                      <TableCell><Badge variant="outline">{c.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {consigs.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Sem condicionais.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <Dialog open={credOpen} onOpenChange={setCredOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Adicionar crédito</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-2"><Label>Valor (use negativo para debitar)</Label><Input type="number" step="0.01" value={credValor} onChange={(e) => setCredValor(Number(e.target.value))} /></div>
              <div className="grid gap-2"><Label>Descrição</Label><Input value={credDesc} onChange={(e) => setCredDesc(e.target.value)} /></div>
            </div>
            <DialogFooter><Button onClick={addCredito}>Confirmar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
