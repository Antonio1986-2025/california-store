import { useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ProductSearch } from "@/components/erp/pdv/product-search";
import { CustomerSearch } from "@/components/erp/pdv/customer-search";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { brl, type Cliente, type ProdutoBusca } from "@/lib/pdv-types";
import type { ConsignacaoItemNova } from "./types";
import { ComprovanteModal, type ComprovanteData } from "./comprovante-modal";

export function NovaConsignacao({ onCriada }: { onCriada: () => void }) {
  const { user } = useAuth();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const defaultPrazo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  }, []);
  const [prazo, setPrazo] = useState<Date>(defaultPrazo);
  const [itens, setItens] = useState<ConsignacaoItemNova[]>([]);
  const [obs, setObs] = useState("");
  const [busy, setBusy] = useState(false);
  const [comprovante, setComprovante] = useState<ComprovanteData | null>(null);

  const total = useMemo(
    () => itens.reduce((a, i) => a + i.quantidade * i.preco_unitario, 0),
    [itens]
  );

  function addItem(p: ProdutoBusca) {
    setItens((prev) => {
      const ex = prev.find((i) => i.variante_id === p.variante_id);
      if (ex) {
        if (ex.quantidade >= p.qtd_estoque) {
          toast.error("Estoque insuficiente.");
          return prev;
        }
        return prev.map((i) =>
          i.variante_id === p.variante_id ? { ...i, quantidade: i.quantidade + 1 } : i
        );
      }
      return [
        ...prev,
        {
          variante_id: p.variante_id,
          produto_id: p.produto_id,
          nome: p.nome,
          variante_label: [p.cor, p.tamanho].filter(Boolean).join(" · "),
          preco_unitario: p.preco,
          quantidade: 1,
          estoque_max: p.qtd_estoque,
        },
      ];
    });
  }
  function setQtd(id: string, v: number) {
    setItens((p) =>
      p.map((i) =>
        i.variante_id === id
          ? { ...i, quantidade: Math.min(i.estoque_max, Math.max(1, v)) }
          : i
      )
    );
  }
  function setPreco(id: string, v: number) {
    setItens((p) => p.map((i) => (i.variante_id === id ? { ...i, preco_unitario: Math.max(0, v) } : i)));
  }
  function removeItem(id: string) {
    setItens((p) => p.filter((i) => i.variante_id !== id));
  }

  async function registrar() {
    if (!cliente) return toast.error("Selecione um cliente.");
    if (itens.length === 0) return toast.error("Adicione ao menos uma peça.");
    setBusy(true);
    try {
      const { data: cons, error: consErr } = await supabase
        .from("consignacoes")
        .insert({
          cliente_id: cliente.id,
          prazo_devolucao: prazo.toISOString().slice(0, 10),
          status: "aberta",
          total,
          observacoes: obs || null,
          funcionario_id: user?.id ?? null,
        })
        .select("id, data_saida")
        .single();
      if (consErr || !cons) throw consErr ?? new Error("Falha ao criar consignação");
      const consignacao_id = cons.id as string;

      const itensRows = itens.map((i) => ({
        consignacao_id,
        variante_id: i.variante_id,
        qtd_saiu: i.quantidade,
        qtd_devolvida: 0,
        preco_unitario: i.preco_unitario,
      }));
      const { error: itErr } = await supabase.from("consignacao_itens").insert(itensRows);
      if (itErr) throw itErr;

      const movRows = itens.map((i) => ({
        variante_id: i.variante_id,
        tipo: "saida_consig",
        quantidade: -i.quantidade,
        consignacao_id,
      }));
      await supabase.from("movimentacoes_estoque").insert(movRows);

      for (const i of itens) {
        await supabase
          .from("produto_variantes")
          .update({ qtd_estoque: i.estoque_max - i.quantidade })
          .eq("id", i.variante_id);
      }

      const numero = String(consignacao_id).slice(0, 8).toUpperCase();
      setComprovante({
        numero,
        data: new Date(cons.data_saida ?? Date.now()),
        prazo,
        cliente_nome: cliente.nome,
        itens,
        total,
        observacoes: obs || null,
      });
      toast.success(`Consignação ${numero} registrada!`);
      // reset
      setCliente(null);
      setItens([]);
      setObs("");
      setPrazo(defaultPrazo);
      onCriada();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao registrar consignação.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 grid-cols-1 lg:grid-cols-[3fr_2fr]">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Buscar peças</CardTitle></CardHeader>
        <CardContent>
          <ProductSearch onAdd={addItem} />
        </CardContent>
      </Card>

      <Card className="flex flex-col">
        <CardHeader className="pb-3"><CardTitle className="text-base">Dados da consignação</CardTitle></CardHeader>
        <CardContent className="space-y-4 flex-1">
          <div className="space-y-1">
            <Label className="text-xs">Cliente *</Label>
            <CustomerSearch
              cliente={cliente}
              onSelect={setCliente}
              onClear={() => setCliente(null)}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Prazo de devolução</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {format(prazo, "dd/MM/yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={prazo}
                  onSelect={(d) => d && setPrazo(d)}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Peças adicionadas</Label>
            {itens.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center border rounded-md">
                Nenhuma peça selecionada.
              </p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {itens.map((i) => (
                  <div key={i.variante_id} className="rounded-md border p-2.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{i.nome}</p>
                        <p className="text-xs text-muted-foreground">{i.variante_label || "—"}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem(i.variante_id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-[10px] uppercase text-muted-foreground">Qtd</Label>
                        <Input
                          type="number"
                          min={1}
                          max={i.estoque_max}
                          value={i.quantidade}
                          onChange={(e) => setQtd(i.variante_id, Number(e.target.value) || 1)}
                          className="h-8"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase text-muted-foreground">Preço</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={i.preco_unitario}
                          onChange={(e) => setPreco(i.variante_id, Number(e.target.value) || 0)}
                          className="h-8"
                        />
                      </div>
                      <div className="text-right self-end">
                        <p className="text-xs text-muted-foreground">Subtotal</p>
                        <p className="text-sm font-semibold">{brl(i.quantidade * i.preco_unitario)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Observações</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
          </div>
        </CardContent>

        <div className="border-t bg-muted/30 px-4 py-3 space-y-3">
          <div className="flex justify-between text-base font-bold">
            <span>Total em consignação</span>
            <span>{brl(total)}</span>
          </div>
          <Button
            size="lg"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={registrar}
            disabled={busy || itens.length === 0 || !cliente}
          >
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Registrar Saída
          </Button>
        </div>
      </Card>

      <ComprovanteModal data={comprovante} onClose={() => setComprovante(null)} />
    </div>
  );
}