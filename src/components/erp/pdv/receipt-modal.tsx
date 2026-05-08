import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";
import { brl, type ItemCarrinho, type Pagamento } from "@/lib/pdv-types";

export type ReceiptData = {
  numero: string;
  data: Date;
  itens: ItemCarrinho[];
  subtotal: number;
  desconto: number;
  total: number;
  pagamentos: Pagamento[];
  cliente_nome: string | null;
};

const metodoLabel: Record<Pagamento["metodo"], string> = {
  dinheiro: "Dinheiro",
  debito: "Cartão Débito",
  credito: "Cartão Crédito",
  pix: "PIX",
  credito_cliente: "Crédito do Cliente",
};

export function ReceiptModal({
  data,
  onClose,
}: {
  data: ReceiptData | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!data} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        {data && (
          <>
            <div id="receipt-print" className="p-6 font-mono text-sm bg-white text-black">
              <div className="text-center border-b border-dashed border-black pb-3 mb-3">
                <p className="text-lg font-bold tracking-wider">CALIFORNIA STORES</p>
                <p className="text-xs">Cupom não fiscal</p>
              </div>
              <div className="text-xs space-y-0.5 mb-3">
                <p>Venda: <span className="font-bold">{data.numero}</span></p>
                <p>Data: {data.data.toLocaleString("pt-BR")}</p>
                {data.cliente_nome && <p>Cliente: {data.cliente_nome}</p>}
              </div>
              <div className="border-t border-dashed border-black pt-2 space-y-1.5">
                {data.itens.map((it) => {
                  const sub = it.qtd * it.preco_unit - it.desconto;
                  return (
                    <div key={it.variante_id}>
                      <p className="leading-tight">{it.nome}</p>
                      {it.variante_label && <p className="text-xs">{it.variante_label}</p>}
                      <div className="flex justify-between text-xs">
                        <span>{it.qtd} x {brl(it.preco_unit)}{it.desconto > 0 && ` (- ${brl(it.desconto)})`}</span>
                        <span>{brl(sub)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-dashed border-black mt-3 pt-2 space-y-0.5">
                <div className="flex justify-between"><span>Subtotal</span><span>{brl(data.subtotal)}</span></div>
                {data.desconto > 0 && (
                  <div className="flex justify-between"><span>Desconto</span><span>- {brl(data.desconto)}</span></div>
                )}
                <div className="flex justify-between text-base font-bold"><span>TOTAL</span><span>{brl(data.total)}</span></div>
              </div>
              <div className="border-t border-dashed border-black mt-2 pt-2 space-y-0.5 text-xs">
                {data.pagamentos.map((p, i) => (
                  <div key={i} className="flex justify-between">
                    <span>
                      {metodoLabel[p.metodo]}
                      {p.metodo === "credito" && ` (${p.parcelas}x)`}
                    </span>
                    <span>{brl(p.valor)}</span>
                  </div>
                ))}
                {data.pagamentos.some((p) => p.metodo === "dinheiro") && (() => {
                  const din = data.pagamentos.find((p) => p.metodo === "dinheiro") as
                    | Extract<Pagamento, { metodo: "dinheiro" }>
                    | undefined;
                  if (!din) return null;
                  const troco = Math.max(0, din.valor_recebido - din.valor);
                  return (
                    <div className="flex justify-between"><span>Troco</span><span>{brl(troco)}</span></div>
                  );
                })()}
              </div>
              <p className="text-center text-xs mt-4 pt-3 border-t border-dashed border-black">
                Obrigado pela preferência!
              </p>
            </div>

            <div className="flex gap-2 p-4 border-t bg-muted/30 print:hidden">
              <Button variant="outline" className="flex-1" onClick={onClose}>
                <X className="h-4 w-4 mr-1" /> Fechar
              </Button>
              <Button className="flex-1" onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-1" /> Imprimir
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}