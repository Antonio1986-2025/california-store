import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Power, FileSpreadsheet, Tag } from "lucide-react";
import { ProdutoForm } from "@/components/erp/produtos/produto-form";
import { ImportarPlanilhaModal } from "@/components/erp/produtos/importar-modal";
import { EtiquetaModal } from "@/components/erp/produtos/etiqueta-modal";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/produtos")({
  component: Page,
});

type Row = {
  id: string; nome: string; ativo: boolean; preco_venda: number; foto_url: string | null;
  categoria_id: string | null; categorias?: { nome: string } | null;
  produto_variantes: { id: string; qtd_estoque: number; codigo_barras: string | null }[];
};

function Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [categorias, setCategorias] = useState<{ id: string; nome: string }[]>([]);
  const [busca, setBusca] = useState("");
  const [catFiltro, setCatFiltro] = useState<string>("todas");
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const [etiquetaId, setEtiquetaId] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("produtos")
      .select("id, nome, ativo, preco_venda, foto_url, categoria_id, categorias(nome), produto_variantes(id, qtd_estoque, codigo_barras)")
      .order("nome");
    setRows((data as any) ?? []);
    const { data: cats } = await supabase.from("categorias").select("id, nome").order("nome");
    setCategorias(cats ?? []);
  };

  useEffect(() => { load(); }, []);

  const norm = (s: string) =>
    (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const driveImg = (url?: string | null, size = 1600): string | null => {
    if (!url) return null;
    // https://lh3.googleusercontent.com/d/{id}
    const m1 = url.match(/lh3\.googleusercontent\.com\/d\/([A-Za-z0-9_-]+)/);
    if (m1) return `https://drive.google.com/thumbnail?id=${m1[1]}&sz=w${size}`;
    // https://drive.google.com/file/d/{id}/view
    const m2 = url.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/);
    if (m2) return `https://drive.google.com/thumbnail?id=${m2[1]}&sz=w${size}`;
    // https://drive.google.com/open?id={id}
    const m3 = url.match(/drive\.google\.com\/open\?id=([A-Za-z0-9_-]+)/);
    if (m3) return `https://drive.google.com/thumbnail?id=${m3[1]}&sz=w${size}`;
    return url;
  };

  const filtered = useMemo(() => {
    const t = norm(busca);
    return rows.filter((r) => {
      if (catFiltro !== "todas" && r.categoria_id !== catFiltro) return false;
      if (statusFiltro === "ativos" && !r.ativo) return false;
      if (statusFiltro === "inativos" && r.ativo) return false;
      if (t) {
        const inNome = norm(r.nome).includes(t);
        const inCod = r.produto_variantes.some((v) => norm(v.codigo_barras ?? "").includes(t));
        if (!inNome && !inCod) return false;
      }
      return true;
    });
  }, [rows, busca, catFiltro, statusFiltro]);

  const toggleAtivo = async (r: Row) => {
    const { error } = await supabase.from("produtos").update({ ativo: !r.ativo }).eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success(r.ativo ? "Desativado" : "Ativado");
    load();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Produtos</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <FileSpreadsheet className="h-4 w-4 mr-1" /> Importar planilha
            </Button>
            <Button onClick={() => { setEditId(null); setOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Novo Produto
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input placeholder="Buscar por nome ou código..." value={busca} onChange={(e) => setBusca(e.target.value)} className="max-w-xs" />
            <Select value={catFiltro} onValueChange={setCatFiltro}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas categorias</SelectItem>
                {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFiltro} onValueChange={setStatusFiltro}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativos">Ativos</SelectItem>
                <SelectItem value="inativos">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Foto</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Variantes</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Estoque</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const estoque = r.produto_variantes.reduce((s, v) => s + Number(v.qtd_estoque ?? 0), 0);
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                       {r.foto_url && driveImg(r.foto_url)
                         ? <img
                             src={driveImg(r.foto_url, 200)!}
                             alt=""
                             referrerPolicy="no-referrer"
                             loading="lazy"
                             onClick={() => setZoomUrl(driveImg(r.foto_url, 1600)!)}
                             className="h-12 w-12 object-cover rounded cursor-zoom-in hover:opacity-80 transition"
                             onError={(e)=>{(e.currentTarget as HTMLImageElement).style.visibility='hidden';}}
                           />
                         : <div className="h-12 w-12 bg-muted rounded" />}
                    </TableCell>
                    <TableCell className="font-medium">{r.nome}</TableCell>
                    <TableCell>{r.categorias?.nome ?? "—"}</TableCell>
                    <TableCell>{r.produto_variantes.length}</TableCell>
                    <TableCell>R$ {Number(r.preco_venda ?? 0).toFixed(2)}</TableCell>
                    <TableCell>{estoque}</TableCell>
                    <TableCell>
                      <Badge variant={r.ativo ? "default" : "secondary"}>{r.ativo ? "Ativo" : "Inativo"}</Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => { setEditId(r.id); setOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" title="Etiqueta" onClick={() => setEtiquetaId(r.id)}>
                        <Tag className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => toggleAtivo(r)}>
                        <Power className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nenhum produto.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ProdutoForm open={open} onOpenChange={setOpen} produtoId={editId} onSaved={load} />
      <ImportarPlanilhaModal open={importOpen} onOpenChange={setImportOpen} onImported={load} />
      <EtiquetaModal
        produtoId={etiquetaId}
        open={!!etiquetaId}
        onOpenChange={(o) => !o && setEtiquetaId(null)}
      />
      <Dialog open={!!zoomUrl} onOpenChange={(o) => !o && setZoomUrl(null)}>
        <DialogContent className="max-w-3xl p-2 bg-background">
          {zoomUrl && (
            <img
              src={zoomUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="w-full h-auto max-h-[80vh] object-contain rounded"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
