import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Minus, Plus, Trash2, Loader2, ShoppingCart, CreditCard, Wallet, Smartphone, Banknote, UserCircle2, Camera } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { brl, type Cliente, type ItemCarrinho, type Pagamento, type ProdutoBusca } from "@/lib/pdv-types";
import { ProductSearch } from "@/components/erp/pdv/product-search";
import { CustomerSearch } from "@/components/erp/pdv/customer-search";
import { ReceiptModal, type ReceiptData } from "@/components/erp/pdv/receipt-modal";
import { ScannerModal } from "@/components/erp/pdv/scanner-modal";

export const Route = createFileRoute("/_authenticated/pdv")({
  component: PdvPage,
});

type DescontoModo = "valor" | "percentual";

function PdvPage() {
  const { user } = useAuth();
  const [itens, setItens] = useState<ItemCarrinho[]>([]);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [descontoGeral, setDescontoGeral] = useState<number>(0);
  const [descontoModo, setDescontoModo] = useState<DescontoModo>("valor");
  const [metodo, setMetodo] = useState<Pagamento["metodo"]>("dinheiro");
  const [valorRecebido, setValorRecebido] = useState<number>(0);
  const [parcelas, setParcelas] = useState<number>(1);
  const [finalizing, setFinalizing] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const subtotal = useMemo(
    () => itens.reduce((acc, it) => acc + it.qtd * it.preco_unit - it.desconto, 0),
    [itens]
  );
  const descontoEmReais = useMemo(
    () => (descontoModo === "valor" ? descontoGeral : (subtotal * descontoGeral) / 100),
    [descontoGeral, descontoModo, subtotal]
  );
  const total = Math.max(0, subtotal - descontoEmReais);
  const troco = metodo === "dinheiro" ? Math.max(0, valorRecebido - total) : 0;

  function addItem(p: ProdutoBusca) {
    setItens((prev) => {
      const ex = prev.find((i) => i.variante_id === p.variante_id);
      if (ex) {
        if (ex.qtd >= p.qtd_estoque) {
          toast.error("Estoque insuficiente.");
          return prev;
        }
        return prev.map((i) =>
          i.variante_id === p.variante_id ? { ...i, qtd: i.qtd + 1 } : i
        );
      }
      return [
        ...prev,
        {
          variante_id: p.variante_id,
          produto_id: p.produto_id,
          nome: p.nome,
          variante_label: [p.cor, p.tamanho].filter(Boolean).join(" · "),
          preco_unit: p.preco,
          qtd: 1,
          desconto: 0,
          estoque_max: p.qtd_estoque,
        },
      ];
    });
  }

  async function handleScanned(code: string) {
    setScannerOpen(false);
    const term = code.trim();
    if (!term) return;
    const { data, error } = await supabase
      .from("produto_variantes")
      .select("id, cor, tamanho, preco_venda, qtd_estoque, produto_id, codigo_barras, produtos:produto_id(id, nome, foto_url)")
      .eq("codigo_barras", term)
      .limit(1)
      .maybeSingle();
    if (error || !data) {
      toast.error("Produto não encontrado");
      return;
    }
    const r: any = data;
    addItem({
      variante_id: r.id,
      produto_id: r.produto_id ?? r.produtos?.id,
      nome: r.produtos?.nome ?? "Produto",
      sku: null,
      cor: r.cor ?? null,
      tamanho: r.tamanho ?? null,
      preco: Number(r.preco_venda) || 0,
      qtd_estoque: Number(r.qtd_estoque) || 0,
      foto_url: r.produtos?.foto_url ?? null,
      codigo_barras: r.codigo_barras ?? null,
    });
    toast.success("Produto adicionado");
  }

  function setQtd(id: string, delta: number) {
    setItens((prev) =>
      prev
        .map((i) =>
          i.variante_id === id
            ? { ...i, qtd: Math.min(i.estoque_max, Math.max(1, i.qtd + delta)) }
            : i
        )
    );
  }
  function setDescItem(id: string, v: number) {
    setItens((prev) =>
      prev.map((i) =>
        i.variante_id === id
          ? { ...i, desconto: Math.max(0, Math.min(v, i.qtd * i.preco_unit)) }
          : i
      )
    );
  }
  function removeItem(id: string) {
    setItens((prev) => prev.filter((i) => i.variante_id !== id));
  }
  function cancelar() {
    setItens([]);
    setCliente(null);
    setDescontoGeral(0);
    setValorRecebido(0);
    setParcelas(1);
    setMetodo("dinheiro");
  }

  function buildPagamento(): Pagamento | null {
    if (metodo === "dinheiro") {
      if (valorRecebido < total) return null;
      return { metodo: "dinheiro", valor: total, valor_recebido: valorRecebido };
    }
    if (metodo === "credito") return { metodo: "credito", valor: total, parcelas };
    if (metodo === "credito_cliente") {
      if (!cliente) return null;
      if (cliente.saldo_credito < total) return null;
      return { metodo: "credito_cliente", valor: total };
    }
    return { metodo, valor: total } as Pagamento;
  }

  async function finalizar() {
    if (itens.length === 0) {
      toast.error("Carrinho vazio.");
      return;
    }
    const pgto = buildPagamento();
    if (!pgto) {
      if (metodo === "dinheiro") toast.error("Valor recebido menor que o total.");
      else if (metodo === "credito_cliente" && !cliente)
        toast.error("Selecione um cliente para usar crédito.");
      else if (metodo === "credito_cliente")
        toast.error("Saldo de crédito do cliente insuficiente.");
      return;
    }
    setFinalizing(true);
    try {
      // 1) Inserir venda
      const { data: vendaData, error: vendaErr } = await supabase
        .from("vendas")
        .insert({
          cliente_id: cliente?.id ?? null,
          subtotal,
          desconto: descontoEmReais,
          total,
          funcionario_id: user?.id ?? null,
        })
        .select("id")
        .single();
      if (vendaErr || !vendaData) throw vendaErr ?? new Error("Falha ao criar venda");
      const venda_id = vendaData.id as string;

      // 2) Inserir itens
      const itensRows = itens.map((i) => ({
        venda_id,
        variante_id: i.variante_id,
        quantidade: i.qtd,
        preco_unitario: i.preco_unit,
        desconto: i.desconto,
        subtotal: i.qtd * i.preco_unit - i.desconto,
      }));
      const { error: itensErr } = await supabase.from("venda_itens").insert(itensRows);
      if (itensErr) throw itensErr;

      // 3) Inserir pagamento
      const pgtoRow: any = {
        venda_id,
        forma: pgto.metodo,
        valor: pgto.valor,
      };
      if (pgto.metodo === "credito") pgtoRow.parcelas = pgto.parcelas;
      const { error: pagErr } = await supabase.from("pagamentos").insert(pgtoRow);
      if (pagErr) throw pagErr;

      // 4) Movimentações de estoque + decrementar variante
      const movRows = itens.map((i) => ({
        variante_id: i.variante_id,
        tipo: "saida_venda",
        quantidade: -i.qtd,
        venda_id,
      }));
      await supabase.from("movimentacoes_estoque").insert(movRows);

      for (const i of itens) {
        await supabase
          .from("produto_variantes")
          .update({ qtd_estoque: i.estoque_max - i.qtd })
          .eq("id", i.variante_id);
      }

      // 5) Crédito do cliente
      if (pgto.metodo === "credito_cliente" && cliente) {
        await supabase
          .from("clientes")
          .update({ saldo_credito: cliente.saldo_credito - total })
          .eq("id", cliente.id);
      }

      const numero = String(venda_id).slice(0, 8).toUpperCase();
      setReceipt({
        numero,
        data: new Date(),
        itens,
        subtotal,
        desconto: descontoEmReais,
        total,
        pagamentos: [pgto],
        cliente_nome: cliente?.nome ?? null,
      });
      toast.success(`Venda ${numero} finalizada!`);
      cancelar();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao finalizar venda.");
    } finally {
      setFinalizing(false);
    }
  }

  return (
    <div className="grid gap-4 grid-cols-1 lg:grid-cols-[3fr_2fr] lg:h-[calc(100vh-7rem)]">
      {/* Coluna esquerda */}
      <Card className="flex flex-col overflow-hidden lg:max-h-full">
        <CardContent className="pt-6 flex-1 overflow-y-auto">
          <div className="flex justify-end mb-2">
            <Button variant="outline" size="sm" onClick={() => setScannerOpen(true)}>
              <Camera className="h-4 w-4 mr-1" /> Escanear
            </Button>
          </div>
          <ProductSearch onAdd={addItem} />
        </CardContent>
      </Card>

      {/* Coluna direita - Carrinho */}
      <Card className="flex flex-col overflow-hidden lg:max-h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" /> Carrinho ({itens.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto space-y-3 pb-3">
          <CustomerSearch
            cliente={cliente}
            onSelect={setCliente}
            onClear={() => setCliente(null)}
          />

          <Separator />

          {itens.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Adicione produtos do lado esquerdo.
            </p>
          ) : (
            <div className="space-y-2">
              {itens.map((i) => {
                const sub = i.qtd * i.preco_unit - i.desconto;
                return (
                  <div key={i.variante_id} className="rounded-md border p-2.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{i.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {i.variante_label || "—"} · {brl(i.preco_unit)}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem(i.variante_id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setQtd(i.variante_id, -1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center text-sm tabular-nums">{i.qtd}</span>
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setQtd(i.variante_id, +1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-1">
                        <Label className="text-xs text-muted-foreground">Desc R$</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          value={i.desconto || ""}
                          onChange={(e) => setDescItem(i.variante_id, Number(e.target.value) || 0)}
                          className="h-7 w-20 text-sm"
                        />
                      </div>
                      <span className="text-sm font-semibold">{brl(sub)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>

        <div className="border-t bg-muted/30 px-4 py-3 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{brl(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">Desconto</span>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                step="0.01"
                min={0}
                value={descontoGeral || ""}
                onChange={(e) => setDescontoGeral(Number(e.target.value) || 0)}
                className="h-8 w-24 text-right"
              />
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2"
                onClick={() => setDescontoModo(descontoModo === "valor" ? "percentual" : "valor")}
              >
                {descontoModo === "valor" ? "R$" : "%"}
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between text-base font-bold">
            <span>Total</span>
            <span className="tabular-nums">{brl(total)}</span>
          </div>

          <Tabs value={metodo} onValueChange={(v) => setMetodo(v as Pagamento["metodo"])}>
            <TabsList className="grid grid-cols-5 w-full h-9">
              <TabsTrigger value="dinheiro" className="text-xs"><Banknote className="h-3.5 w-3.5" /></TabsTrigger>
              <TabsTrigger value="debito" className="text-xs"><Wallet className="h-3.5 w-3.5" /></TabsTrigger>
              <TabsTrigger value="credito" className="text-xs"><CreditCard className="h-3.5 w-3.5" /></TabsTrigger>
              <TabsTrigger value="pix" className="text-xs"><Smartphone className="h-3.5 w-3.5" /></TabsTrigger>
              <TabsTrigger value="credito_cliente" className="text-xs"><UserCircle2 className="h-3.5 w-3.5" /></TabsTrigger>
            </TabsList>
            <TabsContent value="dinheiro" className="mt-2 space-y-1">
              <Label className="text-xs">Valor recebido</Label>
              <Input
                type="number"
                step="0.01"
                value={valorRecebido || ""}
                onChange={(e) => setValorRecebido(Number(e.target.value) || 0)}
                placeholder={brl(total)}
              />
              <p className="text-xs text-muted-foreground">
                Troco: <span className="font-medium text-foreground">{brl(troco)}</span>
              </p>
            </TabsContent>
            <TabsContent value="debito" className="mt-2">
              <p className="text-xs text-muted-foreground">Confirme o pagamento na maquininha.</p>
            </TabsContent>
            <TabsContent value="credito" className="mt-2 space-y-1">
              <Label className="text-xs">Parcelas</Label>
              <select
                value={parcelas}
                onChange={(e) => setParcelas(Number(e.target.value))}
                className="w-full h-9 rounded-md border bg-background px-2 text-sm"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}x de {brl(total / n)}
                  </option>
                ))}
              </select>
            </TabsContent>
            <TabsContent value="pix" className="mt-2">
              <p className="text-xs text-muted-foreground">Confirme o recebimento do PIX antes de finalizar.</p>
            </TabsContent>
            <TabsContent value="credito_cliente" className="mt-2">
              {cliente ? (
                <p className="text-xs">
                  Saldo disponível: <span className="font-semibold">{brl(cliente.saldo_credito)}</span>
                  {cliente.saldo_credito < total && (
                    <span className="text-destructive ml-1">(insuficiente)</span>
                  )}
                </p>
              ) : (
                <p className="text-xs text-destructive">Selecione um cliente acima.</p>
              )}
            </TabsContent>
          </Tabs>

          <div className="flex gap-2">
            <Button variant="destructive" size="sm" className="flex-1" onClick={cancelar} disabled={finalizing}>
              Cancelar
            </Button>
            <Button
              size="lg"
              className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={finalizar}
              disabled={finalizing || itens.length === 0}
            >
              {finalizing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Finalizar Venda
            </Button>
          </div>
        </div>
      </Card>

      <ReceiptModal data={receipt} onClose={() => setReceipt(null)} />
      <ScannerModal open={scannerOpen} onOpenChange={setScannerOpen} onDetected={handleScanned} />
    </div>
  );
}