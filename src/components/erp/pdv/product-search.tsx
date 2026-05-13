import { useEffect, useState } from "react";
import { Search, Package, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { brl, type ProdutoBusca } from "@/lib/pdv-types";

const normalizeSearch = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function mapProductRow(r: any): ProdutoBusca {
  return {
    variante_id: r.id ?? r.variante_id,
    produto_id: r.produto_id ?? r.produtos?.id,
    nome: r.nome ?? r.produtos?.nome ?? "Produto",
    sku: r.codigo_barras ?? null,
    cor: r.cor ?? null,
    tamanho: r.tamanho ?? null,
    preco: Number(r.preco_venda) || 0,
    qtd_estoque: Number(r.qtd_estoque) || 0,
    foto_url: r.foto_url ?? r.produtos?.foto_url ?? null,
    codigo_barras: r.codigo_barras ?? null,
  };
}

async function searchProductsFallback(term: string): Promise<ProdutoBusca[]> {
  const normalizedTerm = normalizeSearch(term);
  const [barcodeRes, productRes] = await Promise.all([
    supabase
      .from("produto_variantes")
      .select(
        "id, cor, tamanho, preco_venda, qtd_estoque, produto_id, codigo_barras, produtos:produto_id(id, nome, foto_url)"
      )
      .ilike("codigo_barras", `%${term}%`)
      .limit(60),
    supabase
      .from("produtos")
      .select("id")
      .like("nome_norm", `%${normalizedTerm}%`)
      .or("ativo.is.null,ativo.eq.true")
      .limit(60),
  ]);

  if (barcodeRes.error) throw barcodeRes.error;
  if (productRes.error) throw productRes.error;

  const productIds = (productRes.data ?? []).map((p) => p.id).filter(Boolean);
  let nameRows: any[] = [];

  if (productIds.length > 0) {
    const { data, error } = await supabase
      .from("produto_variantes")
      .select(
        "id, cor, tamanho, preco_venda, qtd_estoque, produto_id, codigo_barras, produtos:produto_id(id, nome, foto_url)"
      )
      .in("produto_id", productIds)
      .limit(60);

    if (error) throw error;
    nameRows = data ?? [];
  }

  return Array.from(
    new Map([...(barcodeRes.data ?? []), ...nameRows].map((row: any) => [row.id, row])).values()
  )
    .slice(0, 60)
    .map(mapProductRow);
}

export function ProductSearch({ onAdd }: { onAdd: (p: ProdutoBusca) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ProdutoBusca[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const { data, error: rpcErr } = await supabase.rpc("buscar_produtos", { termo: term });
        if (cancelled) return;
        if (rpcErr) {
          const fallbackResults = await searchProductsFallback(term);
          if (cancelled) return;
          setResults(fallbackResults);
          setError(null);
          return;
        }
        const mapped: ProdutoBusca[] = (data ?? []).map(mapProductRow);
        setResults(mapped);
        setError(null);
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? "Erro na busca");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome ou código de barras…"
          className="pl-9 h-12 text-base"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {q.trim().length < 2 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">
          Digite ao menos 2 caracteres para buscar.
        </p>
      ) : !loading && results.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">
          Nenhum produto encontrado.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {results.map((p) => {
            const sem = p.qtd_estoque <= 0;
            return (
              <button
                key={p.variante_id}
                disabled={sem}
                onClick={() => onAdd(p)}
                className={
                  "text-left rounded-lg border bg-card p-3 transition " +
                  (sem
                    ? "opacity-60 cursor-not-allowed"
                    : "hover:border-primary hover:shadow-sm")
                }
              >
                <div className="aspect-square w-full rounded-md bg-muted flex items-center justify-center overflow-hidden mb-2">
                  {p.foto_url ? (
                    <img src={p.foto_url} alt={p.nome} className="h-full w-full object-cover" />
                  ) : (
                    <Package className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <p className="text-sm font-medium line-clamp-2">{p.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {[p.cor, p.tamanho].filter(Boolean).join(" · ") || p.sku || "—"}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm font-semibold">{brl(p.preco)}</span>
                  {sem ? (
                    <Badge variant="destructive">Sem estoque</Badge>
                  ) : (
                    <Badge variant="secondary">{p.qtd_estoque} un.</Badge>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}