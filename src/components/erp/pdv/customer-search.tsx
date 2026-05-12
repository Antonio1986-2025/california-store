import { useEffect, useState } from "react";
import { UserPlus, X, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { brl, type Cliente } from "@/lib/pdv-types";

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
      const { data } = await supabase.rpc("buscar_clientes", { termo: term });
      setResults(
        (data ?? []).map((c: any) => ({
          id: c.id,
          nome: c.nome,
          cpf: c.cpf,
          saldo_credito: Number(c.saldo_credito) || 0,
        }))
      );
      setOpen(true);
    }, 250);
    return () => clearTimeout(t);
  }, [q, cliente]);

  if (cliente) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border bg-accent/50 px-3 py-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{cliente.nome}</p>
          <p className="text-xs text-muted-foreground">
            {cliente.cpf ?? "Sem CPF"} · Crédito: {brl(cliente.saldo_credito)}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClear}>
          <X className="h-4 w-4" />
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
          placeholder="Buscar cliente por nome ou CPF (opcional)"
          className="pl-9"
        />
        <UserPlus className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
      {!cliente && (
        <p className="text-xs text-muted-foreground mt-1">
          Deixe em branco para "Venda sem cadastro".
        </p>
      )}
    </div>
  );
}