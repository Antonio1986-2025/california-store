import { useEffect, useState } from "react";
import { UserPlus, X, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { brl, type Cliente } from "@/lib/pdv-types";

async function searchCustomersFallback(term: string): Promise<Cliente[]> {
  const [nameRes, cpfRes] = await Promise.all([
    supabase
      .from("clientes")
      .select("id, nome, cpf, saldo_credito")
      .ilike("nome", `%${term}%`)
      .limit(20),
    supabase
      .from("clientes")
      .select("id, nome, cpf, saldo_credito")
      .ilike("cpf", `%${term}%`)
      .limit(20),
  ]);

  if (nameRes.error) throw nameRes.error;
  if (cpfRes.error) throw cpfRes.error;

  return Array.from(
    new Map([...(nameRes.data ?? []), ...(cpfRes.data ?? [])].map((row) => [row.id, row])).values()
  )
    .slice(0, 20)
    .map((c: any) => ({
      id: c.id,
      nome: c.nome,
      cpf: c.cpf,
      saldo_credito: Number(c.saldo_credito) || 0,
    }));
}

export function CustomerSearch({
  cliente,
  onSelect,
  onClear,
}: {
  cliente: Cliente | null;
  onSelect: (c: Cliente) => void;
  onClear: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Cliente[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (cliente) return;
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const { data, error } = await supabase.rpc("buscar_clientes", { termo: term });

        if (error) {
          setResults(await searchCustomersFallback(term));
          setOpen(true);
          return;
        }

        setResults(
          (data ?? []).map((c: any) => ({
            id: c.id,
            nome: c.nome,
            cpf: c.cpf,
            saldo_credito: Number(c.saldo_credito) || 0,
          }))
        );
        setOpen(true);
      } catch {
        setResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, cliente]);

  if (cliente) {
    const initials = cliente.nome
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("");
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-[#1E3A5F]/20 bg-[#1E3A5F]/5 px-2 py-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-7 w-7 shrink-0 rounded-full bg-[#1E3A5F] text-white text-[11px] font-bold flex items-center justify-center">
            {initials || "?"}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate text-slate-900 leading-tight">{cliente.nome}</p>
            <p className="text-[10px] text-slate-500 leading-tight">
              {cliente.cpf ?? "Sem CPF"} ·{" "}
              <span className="font-semibold text-emerald-700">{brl(cliente.saldo_credito)}</span>
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClear} className="h-6 w-6 shrink-0">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Cliente (opcional)"
          className="pl-9 h-8 text-xs rounded-md border-slate-200 bg-white"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-md max-h-64 overflow-y-auto">
          {results.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                onSelect(c);
                setQ("");
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
            >
              <p className="font-medium">{c.nome}</p>
              <p className="text-xs text-muted-foreground">
                {c.cpf ?? "Sem CPF"} · Crédito: {brl(c.saldo_credito)}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}