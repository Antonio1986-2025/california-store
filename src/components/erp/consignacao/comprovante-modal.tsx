import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";
import { brl } from "@/lib/pdv-types";
import type { ConsignacaoItemNova } from "./types";

export type ComprovanteData = {
  numero: string;
  data: Date;
  prazo: Date | null;
  cliente_nome: string;
  itens: ConsignacaoItemNova[];
  total: number;
  observacoes: string | null;
};

export function ComprovanteModal({
  data,
  onClose,
}: {
  data: ComprovanteData | null;
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
                <p className="text-xs">Comprovante de Consignação — Saída</p>
              </div>
              <div className="text-xs space-y-0.5 mb-3">
                <p>Consignação: <span className="font-bold">{data.numero}</span></p>
                <p>Data: {data.data.toLocaleString("pt-BR")}</p>
                {data.prazo && <p>Prazo devolução: {data.prazo.toLocaleDateString("pt-BR")}</p>}
                <p>Cliente: {data.cliente_nome}</p>
              </div>
              <div className="border-t border-dashed border-black pt-2 space-y-1.5">
                {data.itens.map((it) => (
                  <div key={it.variante_id}>
                    <p className="leading-tight">{it.nome}</p>
                    {it.variante_label && <p className="text-xs">{it.variante_label}</p>}
                    <div className="flex justify-between text-xs">
                      <span>{it.quantidade} x {brl(it.preco_unitario)}</span>
                      <span>{brl(it.quantidade * it.preco_unitario)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-dashed border-black mt-3 pt-2">
                <div className="flex justify-between text-base font-bold">
                  <span>TOTAL</span><span>{brl(data.total)}</span>
                </div>
              </div>
              {data.observacoes && (
                <p className="text-xs mt-3 italic">Obs: {data.observacoes}</p>
              )}
              <div className="mt-8 pt-2 border-t border-black text-xs text-center">
                Assinatura do Cliente
              </div>
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