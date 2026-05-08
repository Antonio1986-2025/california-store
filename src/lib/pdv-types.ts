export type ProdutoBusca = {
  variante_id: string;
  produto_id: string;
  nome: string;
  sku: string | null;
  cor: string | null;
  tamanho: string | null;
  preco: number;
  qtd_estoque: number;
  foto_url: string | null;
  codigo_barras: string | null;
};

export type ItemCarrinho = {
  variante_id: string;
  produto_id: string;
  nome: string;
  variante_label: string;
  preco_unit: number;
  qtd: number;
  desconto: number; // R$
  estoque_max: number;
};

export type Cliente = {
  id: string;
  nome: string;
  cpf: string | null;
  saldo_credito: number;
};

export type Pagamento =
  | { metodo: "dinheiro"; valor: number; valor_recebido: number }
  | { metodo: "debito"; valor: number }
  | { metodo: "credito"; valor: number; parcelas: number }
  | { metodo: "pix"; valor: number }
  | { metodo: "credito_cliente"; valor: number };

export const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });