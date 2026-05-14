import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Minus,
  Plus,
  Trash2,
  Loader2,
  ShoppingCart,
  CreditCard,
  Wallet,
  Smartphone,
  Banknote,
  UserCircle2,
  Check,
  Package,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  brl,
  type Cliente,
  type ItemCarrinho,
  type Pagamento,
  type ProdutoBusca,
} from "@/lib/pdv-types";
import { ProductSearch } from "@/components/erp/pdv/product-search";
import { CustomerSearch } from "@/components/erp/pdv/customer-search";
import { ReceiptModal, type ReceiptData } from "@/components/erp/pdv/receipt-modal";
import { ScannerModal } from "@/components/erp/pdv/scanner-modal";

export const Route = createFileRoute("/_authenticated/pdv")({
  component: PdvPage,
});

type DescontoModo = "valor" | "percentual";

const PAGAMENTO_OPCOES: {
  id: Pagamento["metodo"];
  label: string;
  icon: typeof Banknote;
  emoji: string;
}[] = [
  { id: "dinheiro", label: "Dinheiro", icon: Banknote, emoji: "💵" },
  { id: "debito", label: "Débito", icon: Wallet, emoji: "💳" },
  { id: "credito", label: "Crédito", icon: CreditCard, emoji: "💳" },
  { id: "pix", label: "PIX", icon: Smartphone, emoji: "📱" },
  { id: "credito_cliente", label: "Crédito Cliente", icon: UserCircle2, emoji: "👤" },
];

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
  const [mobileTab, setMobileTab] = useState<"produtos" | "carrinho">("produtos");

  const subtotal = useMemo(
    () => itens.reduce((acc, it) => acc + it.qtd * it.preco_unit - it.desconto, 0),
    [itens]
  );
  const descontoEmReais = useMemo(
    () => (descontoModo === "valor" ? descontoGeral : (subtotal * descontoGeral) / 100),
    [descontoGeral, descontoModo, subtotal]
  );
  const total = Math.max(0, subtotal - descontoEmReais);
  const troco =
    metodo === "dinheiro"
      ? Math.max(0, (valorRecebido > 0 ? valorRecebido : total) - total)
      : 0;

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
      .select(
        "id, cor, tamanho, preco_venda, qtd_estoque, produto_id, codigo_barras, produtos:produto_id(id, nome, foto_url)"
      )
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
      prev.map((i) =>
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
      const recebido = valorRecebido > 0 ? valorRecebido : total;
      if (recebido < total) return null;
      return { metodo: "dinheiro", valor: total, valor_recebido: recebido };
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

      const pgtoRow: any = { venda_id, forma: pgto.metodo, valor: pgto.valor };
      if (pgto.metodo === "credito") pgtoRow.parcelas = pgto.parcelas;
      const { error: pagErr } = await supabase.from("pagamentos").insert(pgtoRow);
      if (pagErr) throw pagErr;

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

  /* ---------- Painéis (reaproveitados em desktop e mobile) ---------- */

  const ProdutosPanel = (
    <div className="h-full bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
      <div className="px-5 pt-5 pb-2 shrink-0">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Produtos
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-5">
        <ProductSearch onAdd={addItem} onScan={() => setScannerOpen(true)} />
      </div>
    </div>
  );

  const CarrinhoPanel = (
    <div className="h-full bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-[#1E3A5F]" />
          <h2 className="font-bold text-slate-900">Carrinho</h2>
          <span className="ml-1 inline-flex items-center justify-center min-w-6 h-6 px-2 rounded-full bg-[#1E3A5F] text-white text-xs font-bold">
            {itens.length}
          </span>
        </div>
        {itens.length > 0 && (
          <button
            onClick={cancelar}
            className="text-xs text-slate-500 hover:text-red-600 transition"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Cliente */}
      <div className="px-5 py-3 border-b border-slate-100">
        <CustomerSearch
          cliente={cliente}
          onSelect={setCliente}
          onClear={() => setCliente(null)}
        />
      </div>

      {/* Itens */}
      <div className="flex-1 overflow-y-auto px-5 py-3">
        {itens.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-12">
            <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <Package className="h-7 w-7 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-700">Carrinho vazio</p>
            <p className="text-xs text-slate-500 mt-1">
              Adicione produtos para iniciar a venda
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {itens.map((i) => {
              const sub = i.qtd * i.preco_unit - i.desconto;
              return (
                <div key={i.variante_id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex gap-3">
                    <div className="h-10 w-10 shrink-0 rounded-md bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                      <Package className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {i.nome}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {i.variante_label || "—"} · {brl(i.preco_unit)}
                          </p>
                        </div>
                        <button
                          onClick={() => removeItem(i.variante_id)}
                          className="h-7 w-7 shrink-0 rounded-md flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-2">
                        <div className="inline-flex items-center rounded-full bg-slate-100 p-0.5">
                          <button
                            onClick={() => setQtd(i.variante_id, -1)}
                            className="h-7 w-7 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-700 hover:text-[#1E3A5F] transition"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-8 text-center text-sm font-semibold tabular-nums">
                            {i.qtd}
                          </span>
                          <button
                            onClick={() => setQtd(i.variante_id, +1)}
                            className="h-7 w-7 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-700 hover:text-[#1E3A5F] transition"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="flex items-center gap-1">
                          <Label className="text-[10px] text-slate-500 uppercase">
                            Desc
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            value={i.desconto || ""}
                            onChange={(e) =>
                              setDescItem(i.variante_id, Number(e.target.value) || 0)
                            }
                            className="h-7 w-16 text-xs px-2 rounded-md"
                          />
                        </div>
                        <span className="text-sm font-bold text-slate-900 tabular-nums">
                          {brl(sub)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Totais + pagamento */}
      <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4 space-y-4">
        <div className="rounded-xl bg-white border border-slate-200 p-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Subtotal</span>
            <span className="font-medium tabular-nums text-slate-900">
              {brl(subtotal)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-slate-500">Desconto</span>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                step="0.01"
                min={0}
                value={descontoGeral || ""}
                onChange={(e) => setDescontoGeral(Number(e.target.value) || 0)}
                className="h-8 w-20 text-right text-sm"
              />
              <button
                onClick={() =>
                  setDescontoModo(descontoModo === "valor" ? "percentual" : "valor")
                }
                className="h-8 px-2 rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {descontoModo === "valor" ? "R$" : "%"}
              </button>
            </div>
          </div>
          <div className="h-px bg-slate-100" />
          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-slate-900">Total</span>
            <span className="text-2xl font-extrabold tabular-nums text-emerald-700">
              {brl(total)}
            </span>
          </div>
        </div>

        {/* Métodos de pagamento */}
        <div className="grid grid-cols-5 gap-1.5">
          {PAGAMENTO_OPCOES.map((opt) => {
            const active = metodo === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setMetodo(opt.id)}
                className={
                  "flex flex-col items-center justify-center gap-1 rounded-lg py-2 px-1 text-[10px] font-semibold transition " +
                  (active
                    ? "bg-[#1E3A5F] text-white shadow-md"
                    : "bg-white border border-slate-200 text-slate-600 hover:border-[#1E3A5F]/40 hover:text-[#1E3A5F]")
                }
              >
                <span className="text-base leading-none">{opt.emoji}</span>
                <span className="leading-tight text-center">{opt.label}</span>
              </button>
            );
          })}
        </div>

        {/* Conteúdo do método */}
        <Tabs value={metodo} className="w-full">
          <TabsList className="hidden">
            {PAGAMENTO_OPCOES.map((o) => (
              <TabsTrigger key={o.id} value={o.id}>
                {o.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="dinheiro" className="mt-0 space-y-1.5">
            <Label className="text-xs text-slate-500">Valor recebido</Label>
            <Input
              type="number"
              step="0.01"
              value={valorRecebido || ""}
              onChange={(e) => setValorRecebido(Number(e.target.value) || 0)}
              placeholder={brl(total)}
              className="h-11 text-base font-semibold"
            />
            <p className="text-xs text-slate-500">
              Troco:{" "}
              <span className="font-bold text-emerald-700 text-sm">{brl(troco)}</span>
            </p>
          </TabsContent>
          <TabsContent value="debito" className="mt-0">
            <p className="text-xs text-slate-500 px-1">
              Confirme o pagamento na maquininha antes de finalizar.
            </p>
          </TabsContent>
          <TabsContent value="credito" className="mt-0 space-y-1.5">
            <Label className="text-xs text-slate-500">Parcelas</Label>
            <select
              value={parcelas}
              onChange={(e) => setParcelas(Number(e.target.value))}
              className="w-full h-11 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}x de {brl(total / n)}
                </option>
              ))}
            </select>
          </TabsContent>
          <TabsContent value="pix" className="mt-0">
            <p className="text-xs text-slate-500 px-1">
              Confirme o recebimento do PIX antes de finalizar.
            </p>
          </TabsContent>
          <TabsContent value="credito_cliente" className="mt-0">
            {cliente ? (
              <p className="text-xs text-slate-600">
                Saldo disponível:{" "}
                <span className="font-bold text-emerald-700">
                  {brl(cliente.saldo_credito)}
                </span>
                {cliente.saldo_credito < total && (
                  <span className="text-red-600 ml-1 font-semibold">(insuficiente)</span>
                )}
              </p>
            ) : (
              <p className="text-xs text-red-600 font-medium">
                Selecione um cliente acima.
              </p>
            )}
          </TabsContent>
        </Tabs>

        {/* Ações */}
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            onClick={cancelar}
            disabled={finalizing}
            className="h-14 px-4 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300 font-semibold"
          >
            Cancelar
          </Button>
          <Button
            onClick={finalizar}
            disabled={finalizing || itens.length === 0}
            className="flex-1 h-14 bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold shadow-lg shadow-emerald-600/20 disabled:opacity-50"
          >
            {finalizing ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <Check className="h-5 w-5 mr-2" />
            )}
            FINALIZAR VENDA
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-[calc(100vh-7rem)] overflow-hidden">
      {/* Desktop: 2 colunas */}
      <div className="hidden lg:grid lg:grid-cols-[1.5fr_1fr] gap-4 h-full">
        {ProdutosPanel}
        {CarrinhoPanel}
      </div>

      {/* Mobile: tabs */}
      <div className="lg:hidden h-full flex flex-col">
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl mb-3">
          <button
            onClick={() => setMobileTab("produtos")}
            className={
              "py-2 rounded-lg text-sm font-semibold transition " +
              (mobileTab === "produtos"
                ? "bg-white text-[#1E3A5F] shadow-sm"
                : "text-slate-600")
            }
          >
            Produtos
          </button>
          <button
            onClick={() => setMobileTab("carrinho")}
            className={
              "py-2 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 " +
              (mobileTab === "carrinho"
                ? "bg-white text-[#1E3A5F] shadow-sm"
                : "text-slate-600")
            }
          >
            Carrinho
            {itens.length > 0 && (
              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-[#1E3A5F] text-white text-xs font-bold">
                {itens.length}
              </span>
            )}
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          {mobileTab === "produtos" ? ProdutosPanel : CarrinhoPanel}
        </div>
      </div>

      <ReceiptModal data={receipt} onClose={() => setReceipt(null)} />
      <ScannerModal
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDetected={handleScanned}
      />
    </div>
  );
}
