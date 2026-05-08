import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, History } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/funcionarios")({
  component: FuncionariosPage,
});

const brl = (n: number) =>
  (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Func = {
  id: string;
  user_id: string | null;
  nome: string;
  cargo: string | null;
  perfil: "admin" | "vendedor" | "caixa";
  cpf: string | null;
  whatsapp: string | null;
  comissao_pct: number | null;
  ativo: boolean;
};

const schema = z.object({
  nome: z.string().trim().min(2, "Nome obrigatório").max(100),
  cargo: z.string().trim().max(60).optional(),
  perfil: z.enum(["admin", "vendedor", "caixa"]),
  cpf: z.string().trim().max(20).optional(),
  whatsapp: z.string().trim().max(20).optional(),
  comissao_pct: z.number().min(0).max(100),
  ativo: z.boolean(),
  email: z.string().trim().email("E-mail inválido").optional().or(z.literal("")),
  password: z.string().min(6, "Mínimo 6 caracteres").optional().or(z.literal("")),
});

function FuncionariosPage() {
  const [list, setList] = useState<Func[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Func | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("funcionarios")
      .select("*")
      .order("nome");
    setList((data ?? []) as Func[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function novo() { setEditing(null); setOpen(true); }
  function editar(f: Func) { setEditing(f); setOpen(true); }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Funcionários</h2>
        <Button onClick={novo}><Plus className="h-4 w-4 mr-2" />Novo Funcionário</Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead className="text-right">Comissão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.nome}</TableCell>
                    <TableCell>{f.cargo ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={f.perfil === "admin" ? "default" : "secondary"}>{f.perfil}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{Number(f.comissao_pct ?? 0).toFixed(2)}%</TableCell>
                    <TableCell>
                      <Badge variant={f.ativo ? "default" : "outline"}>{f.ativo ? "Ativo" : "Inativo"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setHistoryId(f.id)}>
                        <History className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => editar(f)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <FuncSheet open={open} onClose={() => setOpen(false)} editing={editing} onSaved={load} />
      <HistoricoSheet id={historyId} onClose={() => setHistoryId(null)} />
    </div>
  );
}

function FuncSheet({ open, onClose, editing, onSaved }: {
  open: boolean; onClose: () => void; editing: Func | null; onSaved: () => void;
}) {
  const [form, setForm] = useState<any>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setErrors({});
    if (editing) {
      setForm({
        nome: editing.nome ?? "",
        cargo: editing.cargo ?? "",
        perfil: editing.perfil ?? "vendedor",
        cpf: editing.cpf ?? "",
        whatsapp: editing.whatsapp ?? "",
        comissao_pct: Number(editing.comissao_pct ?? 0),
        ativo: editing.ativo,
        email: "", password: "",
      });
    } else {
      setForm({
        nome: "", cargo: "", perfil: "vendedor", cpf: "", whatsapp: "",
        comissao_pct: 0, ativo: true, email: "", password: "",
      });
    }
  }, [editing, open]);

  function set<K extends string>(k: K, v: any) { setForm((f: any) => ({ ...f, [k]: v })); }

  async function salvar() {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => { errs[i.path[0] as string] = i.message; });
      setErrors(errs);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const payload: any = {
        nome: form.nome, cargo: form.cargo || null, perfil: form.perfil,
        cpf: form.cpf || null, whatsapp: form.whatsapp || null,
        comissao_pct: Number(form.comissao_pct), ativo: form.ativo,
      };
      if (editing) {
        const { error } = await supabase.from("funcionarios").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Funcionário atualizado");
      } else {
        let user_id: string | null = null;
        if (form.email && form.password) {
          const { data, error } = await supabase.auth.signUp({
            email: form.email, password: form.password,
          });
          if (error) {
            toast.error("Falha ao criar login: " + error.message);
          } else {
            user_id = data.user?.id ?? null;
          }
        }
        const { error } = await supabase.from("funcionarios").insert({ ...payload, user_id });
        if (error) throw error;
        toast.success("Funcionário criado");
      }
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{editing ? "Editar Funcionário" : "Novo Funcionário"}</SheetTitle>
        </SheetHeader>
        <div className="space-y-3 py-4">
          <Field label="Nome" error={errors.nome}>
            <Input value={form.nome ?? ""} onChange={(e) => set("nome", e.target.value)} />
          </Field>
          <Field label="Cargo">
            <Input value={form.cargo ?? ""} onChange={(e) => set("cargo", e.target.value)} />
          </Field>
          <Field label="Perfil">
            <Select value={form.perfil} onValueChange={(v) => set("perfil", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="vendedor">Vendedor</SelectItem>
                <SelectItem value="caixa">Caixa</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="CPF"><Input value={form.cpf ?? ""} onChange={(e) => set("cpf", e.target.value)} /></Field>
            <Field label="WhatsApp"><Input value={form.whatsapp ?? ""} onChange={(e) => set("whatsapp", e.target.value)} /></Field>
          </div>
          <Field label="Comissão (%)" error={errors.comissao_pct}>
            <Input type="number" step="0.01" min="0" max="100"
              value={form.comissao_pct ?? 0}
              onChange={(e) => set("comissao_pct", Number(e.target.value))} />
          </Field>
          <div className="flex items-center justify-between border rounded-md px-3 py-2">
            <Label>Ativo</Label>
            <Switch checked={!!form.ativo} onCheckedChange={(v) => set("ativo", v)} />
          </div>
          {!editing && (
            <>
              <div className="text-xs text-muted-foreground pt-2 border-t">
                Opcional: criar um login para este funcionário acessar o sistema.
              </div>
              <Field label="E-mail (login)" error={errors.email}>
                <Input type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
              </Field>
              <Field label="Senha inicial" error={errors.password}>
                <Input type="password" value={form.password ?? ""} onChange={(e) => set("password", e.target.value)} />
              </Field>
            </>
          )}
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button onClick={salvar} disabled={busy}>{busy ? "Salvando..." : "Salvar"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function HistoricoSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const [vendas, setVendas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    supabase
      .from("vendas")
      .select("id,created_at,total")
      .eq("funcionario_id", id)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => { setVendas(data ?? []); setLoading(false); });
  }, [id]);
  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader><SheetTitle>Últimas 10 vendas</SheetTitle></SheetHeader>
        <div className="py-4">
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : vendas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma venda registrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Data</TableHead><TableHead className="text-right">Total</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {vendas.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>{new Date(v.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-right font-medium">{brl(v.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}