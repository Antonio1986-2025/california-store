import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type V = { id: string; cor: string; tamanho: string; produtos: { nome: string } | null };

export function AjusteModal({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
  const [variantes, setVariantes] = useState<V[]>([]);
  const [varianteId, setVarianteId] = useState<string>("");
  const [tipo, setTipo] = useState<"positivo" | "negativo">("positivo");
  const [qtd, setQtd] = useState<number>(1);
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    if (!open) return;
    supabase.from("produto_variantes").select("id, cor, tamanho, produtos(nome)").order("id")
      .then(({ data }) => setVariantes((data as any) ?? []));
  }, [open]);

  const save = async () => {
    if (!varianteId || qtd <= 0) { toast.error("Preencha os campos"); return; }
    const delta = tipo === "positivo" ? qtd : -qtd;
    const { data: v } = await supabase.from("produto_variantes").select("qtd_estoque").eq("id", varianteId).single();
    if (!v) return;
    const novo = Number(v.qtd_estoque ?? 0) + delta;
    if (novo < 0) { toast.error("Estoque insuficiente"); return; }
    const { error: e1 } = await supabase.from("produto_variantes").update({ qtd_estoque: novo }).eq("id", varianteId);
    if (e1) return toast.error(e1.message);
    await supabase.from("movimentacoes_estoque").insert({
      variante_id: varianteId,
      tipo: tipo === "positivo" ? "ajuste_positivo" : "ajuste_negativo",
      quantidade: delta,
      motivo,
    });
    toast.success("Ajuste registrado");
    onSaved(); onOpenChange(false);
    setQtd(1); setMotivo(""); setVarianteId("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Ajuste de Inventário</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label>Variante</Label>
            <Select value={varianteId} onValueChange={setVarianteId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {variantes.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.produtos?.nome ?? "?"} — {v.cor}/{v.tamanho}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="positivo">Positivo (+)</SelectItem>
                  <SelectItem value="negativo">Negativo (-)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Quantidade</Label>
              <Input type="number" min={1} value={qtd} onChange={(e) => setQtd(Number(e.target.value))} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Motivo</Label>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex: contagem, perda, devolução" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}