import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Download, AlertTriangle } from "lucide-react";
import { analisarPlanilha, importarPlanilha } from "@/lib/import-planilha.functions";

type Analise = Awaited<ReturnType<typeof analisarPlanilha>>;

export function ImportarPlanilhaModal({
  open, onOpenChange, onImported,
}: { open: boolean; onOpenChange: (v: boolean) => void; onImported: () => void }) {
  const analisar = useServerFn(analisarPlanilha);
  const importar = useServerFn(importarPlanilha);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [data, setData] = useState<Analise | null>(null);

  const carregar = async () => {
    setLoading(true);
    setData(null);
    try {
      const r = await analisar();
      setData(r);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao analisar planilha");
    } finally {
      setLoading(false);
    }
  };

  const confirmar = async () => {
    setImporting(true);
    try {
      const r = await importar({ data: { confirm: true } });
      toast.success(
        `Importado: ${r.produtosCriados} produtos · ${r.variantesCriadas} variantes · ${r.categoriasCriadas} categorias novas` +
          (r.variantesPuladas ? ` · ${r.variantesPuladas} já existiam` : ""),
      );
      onImported();
      onOpenChange(false);
      setData(null);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao importar");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => { onOpenChange(v); if (!v) setData(null); }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar planilha (California)</DialogTitle>
        </DialogHeader>

        {!data && !loading && (
          <div className="py-8 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Clique em <strong>Analisar planilha</strong> para ver a prévia antes de importar.
              Nada é salvo no banco até você confirmar.
            </p>
            <Button onClick={carregar}><Download className="h-4 w-4 mr-2" />Analisar planilha</Button>
          </div>
        )}

        {loading && (
          <div className="space-y-2 py-6">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        )}

        {data && (
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <Card v="Linhas" n={data.totalLinhas} />
                <Card v="Produtos únicos" n={data.totalProdutos} />
                <Card v="Variantes" n={data.totalVariantes} />
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Categorias normalizadas</h4>
                <div className="flex flex-wrap gap-1.5">
                  {data.categorias.map((c) => (
                    <Badge key={c.nome} variant="secondary">
                      {c.nome} <span className="ml-1 text-muted-foreground">{c.qtd}</span>
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Marcas</h4>
                <div className="flex flex-wrap gap-1.5">
                  {data.marcas.map((m) => (
                    <Badge key={m.nome} variant="outline">
                      {m.nome} <span className="ml-1 text-muted-foreground">{m.qtd}</span>
                    </Badge>
                  ))}
                </div>
              </div>

              {data.avisos.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-amber-600">
                    <AlertTriangle className="h-4 w-4" /> Avisos ({data.avisos.length})
                  </h4>
                  <ul className="text-xs text-muted-foreground space-y-0.5 max-h-32 overflow-y-auto">
                    {data.avisos.map((a, i) => (
                      <li key={i}><span className="font-mono">{a.sku}</span> — {a.motivo}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <h4 className="text-sm font-semibold mb-2">Prévia (primeiros 10 produtos)</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Variantes</TableHead>
                      <TableHead className="text-right">Preço</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.grupos.slice(0, 10).map((g) => (
                      <TableRow key={g.chave}>
                        <TableCell className="text-xs">{g.nome}</TableCell>
                        <TableCell className="text-xs">{g.categoria}</TableCell>
                        <TableCell className="text-right">{g.variantes.length}</TableCell>
                        <TableCell className="text-right">R$ {g.precoVendaMax.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            Cancelar
          </Button>
          {data && (
            <Button onClick={confirmar} disabled={importing}>
              {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar importação
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Card({ v, n }: { v: string; n: number }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-2xl font-semibold">{n}</div>
      <div className="text-xs text-muted-foreground">{v}</div>
    </div>
  );
}