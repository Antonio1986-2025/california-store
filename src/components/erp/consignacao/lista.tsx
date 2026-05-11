import { useEffect, useMemo, useState } from "react";
import { Search, Plus, ClipboardCheck, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/pdv-types";
import { STATUS_BADGE, type ConsignacaoRow, type ConsignacaoStatus } from "./types";

export function ListaConsignacoes({
  onNova,
  onConferir,
  refreshKey,
}: {
  onNova: () => void;
  onConferir: (id: string) => void;
  refreshKey: number;
}) {
  const [rows, setRows] = useState<ConsignacaoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | ConsignacaoStatus>("todos");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("consignacoes")
        .select(
          "id, status, data_saida, prazo_devolucao, total, observacoes, cliente_id, clientes:cliente_id(nome), consignacao_itens(quantidade:qtd_saiu)"
        )
        .order("data_saida", { ascending: false })
        .limit(200);
      if (cancelled) return;
      if (error) {
        setRows([]);
      } else {
        setRows(
          (data ?? []).map((r: any) => ({
            id: r.id,
            numero: String(r.id).slice(0, 8).toUpperCase(),
            cliente_id: r.cliente_id,
            cliente_nome: r.clientes?.nome ?? "—",
            data_saida: r.data_saida,
            prazo_devolucao: r.prazo_devolucao,
            qtd_pecas: (r.consignacao_itens ?? []).reduce(
              (a: number, it: any) => a + (Number(it.quantidade) || 0),
              0
            ),
            total: Number(r.total) || 0,
            status: r.status,
          }))
        );
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filtered = useMemo(() => {
    const lower = q.trim().toLowerCase();
    return rows.filter((r) => {
      const isVencida =
        r.prazo_devolucao && new Date(r.prazo_devolucao) < today && r.status !== "encerrada";
      const effectiveStatus: ConsignacaoStatus = isVencida ? "vencida" : r.status;
      if (statusFilter !== "todos" && effectiveStatus !== statusFilter) return false;
      if (lower && !r.cliente_nome.toLowerCase().includes(lower)) return false;
      return true;
    });
  }, [rows, q, statusFilter, today]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por cliente…"
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="aberta">Aberta</SelectItem>
            <SelectItem value="parcial">Parcial</SelectItem>
            <SelectItem value="encerrada">Encerrada</SelectItem>
            <SelectItem value="vencida">Vencida</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={onNova}>
          <Plus className="h-4 w-4 mr-1" /> Nova Condicional
        </Button>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Saída</TableHead>
              <TableHead>Prazo</TableHead>
              <TableHead className="text-right">Peças</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <Loader2 className="h-4 w-4 animate-spin inline" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nenhuma condicional encontrada.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => {
                const isVencida =
                  r.prazo_devolucao &&
                  new Date(r.prazo_devolucao) < today &&
                  r.status !== "encerrada";
                const status: ConsignacaoStatus = isVencida ? "vencida" : r.status;
                const badge = STATUS_BADGE[status];
                return (
                  <TableRow key={r.id} className={isVencida ? "bg-red-50/60" : ""}>
                    <TableCell className="font-mono text-xs">{r.numero}</TableCell>
                    <TableCell className="font-medium">{r.cliente_nome}</TableCell>
                    <TableCell>
                      {new Date(r.data_saida).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className={isVencida ? "text-red-600 font-medium" : ""}>
                      {r.prazo_devolucao
                        ? new Date(r.prazo_devolucao).toLocaleDateString("pt-BR")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">{r.qtd_pecas}</TableCell>
                    <TableCell className="text-right">{brl(r.total)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={badge.cls}>
                        {badge.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {status !== "encerrada" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onConferir(r.id)}
                        >
                          <ClipboardCheck className="h-3.5 w-3.5 mr-1" />
                          Encerrar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}