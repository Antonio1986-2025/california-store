import { useEffect, useState } from "react";
import { Search, Shirt, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
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
  const { data, error } = await supabase
    .from("produto_variantes")
    .select(
      "id, cor, tamanho, preco_venda, qtd_estoque, produto_id, codigo_barras, produtos:produto_id(id, nome, foto_url, ativo)"
    )
    .limit(240);

  if (error) throw error;

  return (data ?? [])
    .filter((row: any) => {
      const ativo = row.produtos?.ativo;
      if (ativo === false) return false;

      const normalizedHaystack = normalizeSearch(
        `${row.produtos?.nome ?? ""} ${row.codigo_barras ?? ""}`
      );

      return normalizedHaystack.includes(normalizedTerm);
    })
    .slice(0, 60)
    .map(mapProductRow);
}

export function ProductSearch({
  onAdd,
  onScan,
}: {
  onAdd: (p: ProdutoBusca) => void;
  onScan?: () => void;
}) {
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
    <div className="space-y-4">
      <div className="flex items-stretch gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome ou código de barras…"
            className="pl-12 pr-10 h-14 text-base rounded-xl border-slate-200 bg-white shadow-sm focus-visible:ring-2 focus-visible:ring-[#1E3A5F]/20 focus-visible:border-[#1E3A5F]"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        {onScan && (
          <button
            type="button"
            onClick={onScan}
            className="h-14 px-5 rounded-xl bg-[#1E3A5F] hover:bg-[#16304d] active:scale-[0.98] transition text-white font-medium text-sm flex items-center gap-2 shadow-sm"
          >
            <span className="text-lg leading-none">📷</span>
            <span className="hidden sm:inline">Escanear</span>
          </button>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {q.trim().length < 2 ? (
        <div className="text-sm text-muted-foreground py-16 text-center">
          <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
          Digite ao menos 2 caracteres para buscar.
        </div>
      ) : !loading && results.length === 0 ? (
        <div className="text-sm text-muted-foreground py-16 text-center">
          Nenhum produto encontrado.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {results.map((p) => {
            const sem = p.qtd_estoque <= 0;
            return (
              <button
                key={p.variante_id}
                disabled={sem}
                onClick={() => onAdd(p)}
                className={
                  "group relative text-left rounded-xl border bg-white p-3 transition-all duration-150 " +
                  (sem
                    ? "opacity-50 cursor-not-allowed border-slate-200"
                    : "border-slate-200 hover:border-[#1E3A5F] hover:shadow-md active:scale-[0.98] cursor-pointer shadow-sm")
                }
              >
                <span
                  className={
                    "absolute top-2 right-2 z-10 text-[10px] font-bold px-2 py-0.5 rounded-full " +
                    (sem
                      ? "bg-red-100 text-red-700"
                      : "bg-emerald-100 text-emerald-700")
                  }
                >
                  {sem ? "ESGOTADO" : `${p.qtd_estoque} un.`}
                </span>

                <div className="flex gap-3">
                  <div className="h-20 w-20 shrink-0 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center overflow-hidden">
                    {p.foto_url ? (
                      <img
                        src={p.foto_url}
                        alt={p.nome}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Shirt className="h-8 w-8 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-sm font-bold text-slate-900 line-clamp-2 leading-tight pr-12">
                      {p.nome}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 truncate">
                      {[p.cor, p.tamanho].filter(Boolean).join(" · ") ||
                        p.sku ||
                        "—"}
                    </p>
                    <p className="text-base font-bold text-emerald-700 mt-2 tabular-nums">
                      {brl(p.preco)}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}