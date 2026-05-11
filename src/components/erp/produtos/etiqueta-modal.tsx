import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Printer } from "lucide-react";

type Variante = {
  id: string;
  sku: string | null;
  cor: string | null;
  tamanho: string | null;
  codigo_barras: string | null;
  preco_venda: number | null;
};

type Produto = {
  id: string;
  nome: string;
  preco_venda: number;
  codigo_barras: string | null;
  produto_variantes: Variante[];
};

const JSBARCODE_SRC = "https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js";

let jsBarcodePromise: Promise<any> | null = null;
function loadJsBarcode(): Promise<any> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if ((window as any).JsBarcode) return Promise.resolve((window as any).JsBarcode);
  if (jsBarcodePromise) return jsBarcodePromise;
  jsBarcodePromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = JSBARCODE_SRC;
    s.async = true;
    s.onload = () => resolve((window as any).JsBarcode);
    s.onerror = () => reject(new Error("Falha ao carregar JsBarcode"));
    document.head.appendChild(s);
  });
  return jsBarcodePromise;
}

export function EtiquetaModal({
  produtoId,
  open,
  onOpenChange,
}: {
  produtoId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [produto, setProduto] = useState<Produto | null>(null);
  const [varianteId, setVarianteId] = useState<string>("");
  const [copias, setCopias] = useState(1);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !produtoId) return;
    (async () => {
      const { data } = await supabase
        .from("produtos")
        .select("id, nome, preco_venda, codigo_barras, produto_variantes(id, sku, cor, tamanho, codigo_barras, preco_venda)")
        .eq("id", produtoId)
        .single();
      setProduto((data as any) ?? null);
      const first = (data as any)?.produto_variantes?.[0]?.id ?? "";
      setVarianteId(first);
      setCopias(1);
    })();
  }, [open, produtoId]);

  const variante = useMemo(
    () => produto?.produto_variantes.find((v) => v.id === varianteId) ?? null,
    [produto, varianteId],
  );

  const codigo = (variante?.codigo_barras?.trim() || variante?.sku?.trim() || produto?.codigo_barras?.trim() || produto?.id || "").toString();
  const preco = Number(variante?.preco_venda ?? produto?.preco_venda ?? 0);

  useEffect(() => {
    if (!open || !produto || !variante) return;
    let cancelled = false;
    loadJsBarcode().then((JsBarcode) => {
      if (cancelled || !JsBarcode || !printRef.current) return;
      const svgs = printRef.current.querySelectorAll<SVGElement>("svg.barcode-svg");
      svgs.forEach((svg) => {
        try {
          JsBarcode(svg, codigo || "0000", {
            format: "CODE128",
            width: 1.6,
            height: 50,
            displayValue: false,
            margin: 0,
          });
        } catch {
          /* ignore invalid */
        }
      });
    });
    return () => {
      cancelled = true;
    };
  }, [open, produto, variante, codigo, copias]);

  const handlePrint = () => window.print();

  const labels = Array.from({ length: Math.min(10, Math.max(1, copias)) });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Imprimir Etiqueta</DialogTitle>
        </DialogHeader>

        {produto && (
          <div className="space-y-4 no-print">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Variante</Label>
                <Select value={varianteId} onValueChange={setVarianteId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {produto.produto_variantes.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {[v.cor, v.tamanho].filter(Boolean).join(" / ") || "Padrão"}
                        {v.sku ? ` — ${v.sku}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cópias (1–10)</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={copias}
                  onChange={(e) => setCopias(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
              <Button onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-1" /> Imprimir
              </Button>
            </div>
          </div>
        )}

        <div ref={printRef} className="etiqueta-print-area flex flex-wrap gap-2 justify-center bg-muted/30 p-3 rounded">
          {variante && labels.map((_, i) => (
            <div key={i} className="etiqueta">
              <div className="etiqueta-nome">{produto?.nome}</div>
              <div className="etiqueta-meta">
                {[variante.cor, variante.tamanho].filter(Boolean).join(" / ")}
              </div>
              <svg className="barcode-svg" />
              <div className="etiqueta-sku">{codigo}</div>
              <div className="etiqueta-preco">
                R$ {preco.toFixed(2).replace(".", ",")}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
