export type ConsignacaoStatus = "aberta" | "parcial" | "encerrada" | "vencida";

export type ConsignacaoRow = {
  id: string;
  numero: string;
  cliente_id: string | null;
  cliente_nome: string;
  data_saida: string;
  prazo_devolucao: string | null;
  qtd_pecas: number;
  total: number;
  status: Exclude<ConsignacaoStatus, "vencida">;
};

export type ConsignacaoItemNova = {
  variante_id: string;
  produto_id: string;
  nome: string;
  variante_label: string;
  preco_unitario: number;
  quantidade: number;
  estoque_max: number;
};

export type ConsignacaoItemConferencia = {
  id: string;
  variante_id: string;
  nome: string;
  variante_label: string;
  preco_unitario: number;
  qtd_saiu: number;
  qtd_devolvida: number;
  qtd_devolvida_atual: number;
};

export const STATUS_BADGE: Record<ConsignacaoStatus, { label: string; cls: string }> = {
  aberta: { label: "Aberta", cls: "bg-blue-100 text-blue-700 border-blue-200" },
  parcial: { label: "Parcial", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  encerrada: { label: "Encerrada", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  vencida: { label: "Vencida", cls: "bg-red-100 text-red-700 border-red-200" },
};