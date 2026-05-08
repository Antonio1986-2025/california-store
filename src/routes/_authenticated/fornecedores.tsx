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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, ListOrdered, PackageCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { brl } from "@/lib/pdv-types";

export const Route = createFileRoute("/_authenticated/fornecedores")({
  component: Page,
});

type Fornecedor = {
  id: string; nome: string; cnpj: string | null; contato_nome: string | null;
  contato_telefone: string | null; email: string | null; prazo_pagamento: number | null;
  endereco: string | null; observacoes: string | null; ativo: boolean | null;
};

function Page() {
  const [rows, setRows] = useState<Fornecedor[]>([]);
  const [pedidosCount, setPedidosCount] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [pedidosFor, setPedidosFor] = useState<Fornecedor | null>(null);

  const load = async () => {
    const { data } = await supabase.from("fornecedores").select("*").order("nome");
    setRows((data as any) ?? []);
    const { data: ped } = await supabase.from("pedidos_compra").select("fornecedor_id");
    const c: Record<string, number> = {};
    (ped ?? []).forEach((p: any) => { c[p.fornecedor_id] = (c[p.fornecedor_id] ?? 0) + 1; });
    setPedidosCount(c);
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Fornecedores</CardTitle>
          <Button onClick={() => { setEditId(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1" />Novo Fornecedor</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nome</TableHead><TableHead>CNPJ</TableHead><TableHead>Contato</TableHead>
              <TableHead>Prazo (dias)</TableHead><TableHead>Pedidos</TableHead><TableHead className="text-right">Ações</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.nome}</TableCell>
                  <TableCell>{r.cnpj ?? "—"}</TableCell>
                  <TableCell>{r.contato_nome ? `${r.contato_nome}${r.contato_telefone ? ` · ${r.contato_telefone}` : ""}` : (r.contato_telefone ?? "—")}</TableCell>
                  <TableCell>{r.prazo_pagamento ?? "—"}</TableCell>
                  <TableCell>{pedidosCount[r.id] ?? 0}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="icon" variant="ghost" onClick={() => setPedidosFor(r)}><ListOrdered className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { setEditId(r.id); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum fornecedor.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <FornecedorForm open={open} onOpenChange={setOpen} id={editId} onSaved={load} />
      <PedidosDialog fornecedor={pedidosFor} onClose={() => { setPedidosFor(null); load(); }} />
    </div>
  );
}

function FornecedorForm({ open, onOpenChange, id, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; id: string | null; onSaved: () => void }) {
  const [f, setF] = useState<Partial<Fornecedor>>({});
  useEffect(() => {
    if (!open) return;
    if (id) supabase.from("fornecedores").select("*").eq("id", id).maybeSingle().then(({ data }) => setF((data as any) ?? {}));
    else setF({});
  }, [open, id]);
  const set = (k: keyof Fornecedor, v: any) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.nome) return toast.error("Informe o nome");
    const payload: any = { ...f }; delete payload.id;
    const op = id ? supabase.from("fornecedores").update(payload).eq("id", id) : supabase.from("fornecedores").insert(payload);
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success("Fornecedor salvo"); onSaved(); onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader><SheetTitle>{id ? "Editar" : "Novo"} fornecedor</SheetTitle></SheetHeader>
        <div className="grid gap-3 py-4">
          <div className="grid gap-2"><Label>Nome *</Label><Input value={f.nome ?? ""} onChange={(e) => set("nome", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2"><Label>CNPJ</Label><Input value={f.cnpj ?? ""} onChange={(e) => set("cnpj", e.target.value)} /></div>
            <div className="grid gap-2"><Label>Contato (nome)</Label><Input value={f.contato_nome ?? ""} onChange={(e) => set("contato_nome", e.target.value)} /></div>
            <div className="grid gap-2"><Label>Telefone</Label><Input value={f.contato_telefone ?? ""} onChange={(e) => set("contato_telefone", e.target.value)} /></div>
            <div className="grid gap-2"><Label>Email</Label><Input value={f.email ?? ""} onChange={(e) => set("email", e.target.value)} /></div>
            <div className="grid gap-2"><Label>Prazo pagamento (dias)</Label><Input type="number" value={f.prazo_pagamento ?? ""} onChange={(e) => set("prazo_pagamento", Number(e.target.value))} /></div>
          </div>
          <div className="grid gap-2"><Label>Endereço</Label><Input value={f.endereco ?? ""} onChange={(e) => set("endereco", e.target.value)} /></div>
          <div className="grid gap-2"><Label>Observações</Label><Textarea value={f.observacoes ?? ""} onChange={(e) => set("observacoes", e.target.value)} /></div>
        </div>
        <SheetFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={save}>Salvar</Button></SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

type PedidoItem = { variante_id: string; label: string; quantidade: number; preco_unitario: number };

function PedidosDialog({ fornecedor, onClose }: { fornecedor: Fornecedor | null; onClose: () => void }) {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [novoOpen, setNovoOpen] = useState(false);
  const [variantes, setVariantes] = useState<{ id: string; label: string }[]>([]);
  const [itens, setItens] = useState<PedidoItem[]>([]);
  const [varSel, setVarSel] = useState("");
  const [previsao, setPrevisao] = useState("");

  const loadPedidos = async () => {
    if (!fornecedor) return;
    const { data } = await supabase.from("pedidos_compra").select("*, pedido_compra_itens(quantidade, preco_unitario)")
      .eq("fornecedor_id", fornecedor.id).order("created_at", { ascending: false });
    setPedidos(data ?? []);
  };
  useEffect(() => { loadPedidos(); }, [fornecedor]);

  useEffect(() => {
    if (!novoOpen) return;
    supabase.from("produto_variantes").select("id, cor, tamanho, produtos(nome)").order("id")
      .then(({ data }) => setVariantes((data ?? []).map((v: any) => ({
        id: v.id, label: `${v.produtos?.nome ?? "?"} — ${v.cor}/${v.tamanho}`,
      }))));
    setItens([]); setPrevisao("");
  }, [novoOpen]);

  const addItem = () => {
    const v = variantes.find((x) => x.id === varSel);
    if (!v) return;
    setItens((p) => [...p, { variante_id: v.id, label: v.label, quantidade: 1, preco_unitario: 0 }]);
    setVarSel("");
  };

  const total = useMemo(() => itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0), [itens]);

  const salvarPedido = async () => {
    if (!fornecedor || itens.length === 0) return toast.error("Adicione itens");
    const { data: ped, error } = await supabase.from("pedidos_compra").insert({
      fornecedor_id: fornecedor.id, status: "pendente", previsao: previsao || null, total,
    }).select("id").single();
    if (error || !ped) return toast.error(error?.message ?? "Erro");
    const its = itens.map((i) => ({ pedido_id: ped.id, variante_id: i.variante_id, quantidade: i.quantidade, preco_unitario: i.preco_unitario }));
    await supabase.from("pedido_compra_itens").insert(its);
    toast.success("Pedido criado"); setNovoOpen(false); loadPedidos();
  };

  const receber = async (pedido: any) => {
    if (!fornecedor) return;
    const { data: its } = await supabase.from("pedido_compra_itens").select("id, variante_id, quantidade").eq("pedido_id", pedido.id);
    for (const it of its ?? []) {
      const { data: v } = await supabase.from("produto_variantes").select("qtd_estoque").eq("id", it.variante_id).single();
      const atual = Number(v?.qtd_estoque ?? 0);
      await supabase.from("produto_variantes").update({ qtd_estoque: atual + Number(it.quantidade) }).eq("id", it.variante_id);
      await supabase.from("movimentacoes_estoque").insert({ variante_id: it.variante_id, tipo: "entrada", quantidade: it.quantidade, motivo: `Pedido ${pedido.id.slice(0, 8)}` });
      await supabase.from("pedido_compra_itens").update({ qtd_recebida: it.quantidade }).eq("id", it.id);
    }
    const venc = new Date(); venc.setDate(venc.getDate() + (fornecedor.prazo_pagamento ?? 30));
    await supabase.from("contas").insert({
      tipo: "pagar", descricao: `Pedido fornecedor ${fornecedor.nome}`, valor: pedido.total,
      vencimento: venc.toISOString().slice(0, 10), status: "pendente",
      fornecedor_id: fornecedor.id, pedido_id: pedido.id,
    });
    await supabase.from("pedidos_compra").update({ status: "recebido", recebido_em: new Date().toISOString() }).eq("id", pedido.id);
    toast.success("Pedido recebido, estoque atualizado e conta gerada"); loadPedidos();
  };

  return (
    <Dialog open={!!fornecedor} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Pedidos — {fornecedor?.nome}</DialogTitle></DialogHeader>
        <div className="flex justify-end"><Button onClick={() => setNovoOpen(true)}><Plus className="h-4 w-4 mr-1" />Novo pedido</Button></div>
        <Table>
          <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Itens</TableHead><TableHead>Total</TableHead><TableHead>Previsão</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {pedidos.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{new Date(p.created_at).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell>{(p.pedido_compra_itens ?? []).reduce((s: number, i: any) => s + Number(i.quantidade), 0)}</TableCell>
                <TableCell>{brl(Number(p.total ?? 0))}</TableCell>
                <TableCell>{p.previsao ? new Date(p.previsao).toLocaleDateString("pt-BR") : "—"}</TableCell>
                <TableCell><Badge variant={p.status === "recebido" ? "default" : "outline"}>{p.status}</Badge></TableCell>
                <TableCell>{p.status !== "recebido" && (
                  <Button size="sm" variant="outline" onClick={() => receber(p)}><PackageCheck className="h-4 w-4 mr-1" />Receber</Button>
                )}</TableCell>
              </TableRow>
            ))}
            {pedidos.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sem pedidos.</TableCell></TableRow>}
          </TableBody>
        </Table>

        <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Novo pedido</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-2"><Label>Previsão de entrega</Label><Input type="date" value={previsao} onChange={(e) => setPrevisao(e.target.value)} /></div>
              <div className="flex gap-2 items-end">
                <div className="flex-1 grid gap-2"><Label>Adicionar item</Label>
                  <Select value={varSel} onValueChange={setVarSel}>
                    <SelectTrigger><SelectValue placeholder="Variante" /></SelectTrigger>
                    <SelectContent>{variantes.map((v) => <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button onClick={addItem} disabled={!varSel}><Plus className="h-4 w-4" /></Button>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {itens.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_80px_100px_auto] gap-2 items-center">
                    <span className="text-sm">{it.label}</span>
                    <Input type="number" min={1} value={it.quantidade} onChange={(e) => setItens((p) => p.map((x, i) => i === idx ? { ...x, quantidade: Number(e.target.value) } : x))} />
                    <Input type="number" step="0.01" placeholder="Preço" value={it.preco_unitario} onChange={(e) => setItens((p) => p.map((x, i) => i === idx ? { ...x, preco_unitario: Number(e.target.value) } : x))} />
                    <Button size="icon" variant="ghost" onClick={() => setItens((p) => p.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
              <div className="text-right font-bold">Total: {brl(total)}</div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setNovoOpen(false)}>Cancelar</Button><Button onClick={salvarPedido}>Salvar pedido</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
