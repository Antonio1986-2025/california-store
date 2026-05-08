import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

type Variante = {
  id?: string;
  cor: string;
  tamanho: string;
  codigo_barras: string;
  qtd_estoque: number;
  preco_venda: number | null;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  produtoId?: string | null;
  onSaved: () => void;
};

export function ProdutoForm({ open, onOpenChange, produtoId, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [categorias, setCategorias] = useState<{ id: string; nome: string }[]>([]);
  const [fornecedores, setFornecedores] = useState<{ id: string; nome: string }[]>([]);
  const [nome, setNome] = useState("");
  const [categoriaId, setCategoriaId] = useState<string>("");
  const [marca, setMarca] = useState("");
  const [colecao, setColecao] = useState("");
  const [fornecedorId, setFornecedorId] = useState<string>("");
  const [descricao, setDescricao] = useState("");
  const [precoCusto, setPrecoCusto] = useState<number>(0);
  const [precoVenda, setPrecoVenda] = useState<number>(0);
  const [estoqueMinimo, setEstoqueMinimo] = useState<number>(0);
  const [foto, setFoto] = useState<string>("");
  const [variantes, setVariantes] = useState<Variante[]>([
    { cor: "", tamanho: "", codigo_barras: "", qtd_estoque: 0, preco_venda: null },
  ]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [cat, forn] = await Promise.all([
        supabase.from("categorias").select("id, nome").order("nome"),
        supabase.from("fornecedores").select("id, nome").order("nome"),
      ]);
      setCategorias(cat.data ?? []);
      setFornecedores(forn.data ?? []);

      if (produtoId) {
        const { data: p } = await supabase.from("produtos").select("*").eq("id", produtoId).maybeSingle();
        if (p) {
          setNome(p.nome ?? "");
          setCategoriaId(p.categoria_id ?? "");
          setMarca(p.marca ?? "");
          setColecao(p.colecao ?? "");
          setFornecedorId(p.fornecedor_id ?? "");
          setDescricao(p.descricao ?? "");
          setPrecoCusto(Number(p.preco_custo ?? 0));
          setPrecoVenda(Number(p.preco_venda ?? 0));
          setEstoqueMinimo(Number(p.estoque_minimo ?? 0));
          setFoto(p.foto_url ?? "");
        }
        const { data: vs } = await supabase
          .from("produto_variantes")
          .select("id, cor, tamanho, codigo_barras, qtd_estoque, preco_venda")
          .eq("produto_id", produtoId);
        if (vs && vs.length > 0) {
          setVariantes(
            vs.map((v: any) => ({
              id: v.id,
              cor: v.cor ?? "",
              tamanho: v.tamanho ?? "",
              codigo_barras: v.codigo_barras ?? "",
              qtd_estoque: Number(v.qtd_estoque ?? 0),
              preco_venda: v.preco_venda ?? null,
            })),
          );
        }
      } else {
        setNome(""); setCategoriaId(""); setMarca(""); setColecao(""); setFornecedorId("");
        setDescricao(""); setPrecoCusto(0); setPrecoVenda(0); setEstoqueMinimo(0); setFoto("");
        setVariantes([{ cor: "", tamanho: "", codigo_barras: "", qtd_estoque: 0, preco_venda: null }]);
      }
    })();
  }, [open, produtoId]);

  const onUpload = async (file: File) => {
    const path = `${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("produtos").upload(path, file, { upsert: true });
    if (error) {
      toast.error("Erro no upload: " + error.message);
      return;
    }
    const { data } = supabase.storage.from("produtos").getPublicUrl(path);
    setFoto(data.publicUrl);
  };

  const updateVar = (i: number, patch: Partial<Variante>) => {
    setVariantes((p) => p.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  };

  const save = async () => {
    if (!nome.trim()) { toast.error("Informe o nome"); return; }
    setLoading(true);
    try {
      const payload: any = {
        nome,
        categoria_id: categoriaId || null,
        marca: marca || null,
        colecao: colecao || null,
        fornecedor_id: fornecedorId || null,
        descricao: descricao || null,
        preco_custo: precoCusto,
        preco_venda: precoVenda,
        estoque_minimo: estoqueMinimo,
        foto_url: foto || null,
        ativo: true,
      };

      let pid = produtoId ?? null;
      if (pid) {
        const { error } = await supabase.from("produtos").update(payload).eq("id", pid);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("produtos").insert(payload).select("id").single();
        if (error) throw error;
        pid = data.id;
      }

      // Upsert variantes
      for (const v of variantes) {
        if (!v.cor && !v.tamanho && !v.codigo_barras) continue;
        if (v.id) {
          await supabase.from("produto_variantes").update({
            cor: v.cor, tamanho: v.tamanho, codigo_barras: v.codigo_barras,
            qtd_estoque: v.qtd_estoque, preco_venda: v.preco_venda ?? precoVenda,
          }).eq("id", v.id);
        } else {
          const { data: nv, error } = await supabase.from("produto_variantes").insert({
            produto_id: pid,
            cor: v.cor, tamanho: v.tamanho, codigo_barras: v.codigo_barras,
            qtd_estoque: v.qtd_estoque, preco_venda: v.preco_venda ?? precoVenda,
          }).select("id").single();
          if (error) throw error;
          if (v.qtd_estoque > 0 && nv) {
            await supabase.from("movimentacoes_estoque").insert({
              variante_id: nv.id, tipo: "entrada", quantidade: v.qtd_estoque,
              motivo: "Estoque inicial",
            });
          }
        }
      }

      toast.success("Produto salvo!");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{produtoId ? "Editar produto" : "Novo produto"}</SheetTitle>
        </SheetHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Foto</Label>
            {foto && <img src={foto} alt="" className="h-32 w-32 object-cover rounded" />}
            <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
          </div>
          <div className="grid gap-2">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Categoria</Label>
              <Select value={categoriaId} onValueChange={setCategoriaId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Fornecedor</Label>
              <Select value={fornecedorId} onValueChange={setFornecedorId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {fornecedores.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Marca</Label>
              <Input value={marca} onChange={(e) => setMarca(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Coleção</Label>
              <Input value={colecao} onChange={(e) => setColecao(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Preço de custo</Label>
              <Input type="number" step="0.01" value={precoCusto} onChange={(e) => setPrecoCusto(Number(e.target.value))} />
            </div>
            <div className="grid gap-2">
              <Label>Preço de venda</Label>
              <Input type="number" step="0.01" value={precoVenda} onChange={(e) => setPrecoVenda(Number(e.target.value))} />
            </div>
            <div className="grid gap-2">
              <Label>Estoque mínimo</Label>
              <Input type="number" value={estoqueMinimo} onChange={(e) => setEstoqueMinimo(Number(e.target.value))} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Variantes</h3>
              <Button size="sm" variant="outline" onClick={() => setVariantes((p) => [...p, { cor: "", tamanho: "", codigo_barras: "", qtd_estoque: 0, preco_venda: null }])}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            </div>
            <div className="grid gap-2">
              {variantes.map((v, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1.5fr_0.7fr_0.9fr_auto] gap-2 items-end">
                  <div><Label className="text-xs">Cor</Label><Input value={v.cor} onChange={(e) => updateVar(i, { cor: e.target.value })} /></div>
                  <div><Label className="text-xs">Tamanho</Label><Input value={v.tamanho} onChange={(e) => updateVar(i, { tamanho: e.target.value })} /></div>
                  <div><Label className="text-xs">Código de barras</Label><Input value={v.codigo_barras} onChange={(e) => updateVar(i, { codigo_barras: e.target.value })} /></div>
                  <div><Label className="text-xs">Estoque</Label><Input type="number" value={v.qtd_estoque} onChange={(e) => updateVar(i, { qtd_estoque: Number(e.target.value) })} /></div>
                  <div><Label className="text-xs">Preço</Label><Input type="number" step="0.01" value={v.preco_venda ?? ""} onChange={(e) => updateVar(i, { preco_venda: e.target.value === "" ? null : Number(e.target.value) })} /></div>
                  <Button size="icon" variant="ghost" onClick={() => setVariantes((p) => p.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={loading}>{loading ? "Salvando..." : "Salvar"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}