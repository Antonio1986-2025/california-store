import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { gerarCodigosLote } from "./sku-format";

const SHEET_ID = "1VFs17y1R_UtU86buz_LQZfN-5a8k_sNbqn83dX_aZM4";
const SHEET_RANGE = "A1:L999";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";

const CATEGORIA_MAP: Record<string, string> = {
  "BONÉS": "BONÉ",
  "BONÉ": "BONÉ",
  "PORTA-CARTAO": "PORTA-CARTÃO",
  "PORTA-CARTÃO": "PORTA-CARTÃO",
};

function norm(s: string | undefined): string {
  return (s ?? "").trim().replace(/\s+/g, " ");
}
function normUpper(s: string | undefined): string {
  return norm(s).toUpperCase();
}
function parseMoney(s: string | undefined): number {
  if (!s) return 0;
  const m = s.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(m);
  return Number.isFinite(n) ? n : 0;
}
function parseQtd(s: string | undefined): number {
  if (!s) return 0;
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n) : 0;
}
function convertFoto(url: string | undefined): string | null {
  if (!url) return null;
  const m = url.match(/\/file\/d\/([^/]+)/) || url.match(/[?&]id=([^&]+)/);
  if (m) return `https://lh3.googleusercontent.com/d/${m[1]}`;
  return url || null;
}
function normCategoria(s: string): string {
  const u = normUpper(s);
  return CATEGORIA_MAP[u] ?? u;
}

export type LinhaProcessada = {
  sku: string;
  fornecedorCodigo: string;
  categoria: string;
  marca: string;
  descricao: string;
  genero: string;
  tamanho: string;
  cor: string;
  qtd: number;
  custo: number;
  venda: number;
  foto: string | null;
  codigoVariante?: string;
};

export type Grupo = {
  chave: string;
  nome: string;
  marca: string;
  categoria: string;
  genero: string;
  foto: string | null;
  precoCustoMax: number;
  precoVendaMax: number;
  variantes: LinhaProcessada[];
};

async function buscarPlanilha(): Promise<string[][]> {
  const lov = process.env.LOVABLE_API_KEY;
  const key = process.env.GOOGLE_SHEETS_API_KEY;
  if (!lov) throw new Error("LOVABLE_API_KEY não configurada");
  if (!key) throw new Error("GOOGLE_SHEETS_API_KEY não configurada");
  const url = `${GATEWAY_URL}/spreadsheets/${SHEET_ID}/values/${SHEET_RANGE}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${lov}`,
      "X-Connection-Api-Key": key,
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Sheets [${res.status}]: ${txt}`);
  }
  const j = (await res.json()) as { values?: string[][] };
  return j.values ?? [];
}

function processar(values: string[][]) {
  // localizar linha de cabeçalho com "CODIGO/INTERNO"
  let headerIdx = values.findIndex((r) => (r[0] ?? "").includes("CODIGO/INTERNO"));
  if (headerIdx < 0) headerIdx = 5;
  const data = values.slice(headerIdx + 1);
  const linhas: LinhaProcessada[] = [];
  const avisos: { sku: string; motivo: string }[] = [];
  const skuSeen = new Set<string>();

  for (const r of data) {
    const sku = norm(r[0]);
    if (!sku) continue;
    const linha: LinhaProcessada = {
      sku,
      fornecedorCodigo: norm(r[1]),
      categoria: normCategoria(r[2] ?? ""),
      marca: normUpper(r[3]),
      descricao: normUpper(r[4]),
      genero: normUpper(r[5]),
      tamanho: normUpper(r[6]),
      cor: normUpper(r[7]),
      qtd: parseQtd(r[8]),
      custo: parseMoney(r[9]),
      venda: parseMoney(r[10]),
      foto: convertFoto(r[11]),
    };
    if (skuSeen.has(linha.sku)) {
      avisos.push({ sku: linha.sku, motivo: "SKU duplicado na planilha" });
      continue;
    }
    skuSeen.add(linha.sku);
    if (linha.venda === 0 && linha.custo === 0) {
      avisos.push({ sku: linha.sku, motivo: "Sem preço (custo e venda)" });
    }
    if (!linha.foto) avisos.push({ sku: linha.sku, motivo: "Sem foto" });
    if (!linha.categoria || !linha.marca) {
      avisos.push({ sku: linha.sku, motivo: "Categoria ou marca vazia" });
    }
    linhas.push(linha);
  }

  // agrupar por marca|categoria|descricao|genero
  const mapa = new Map<string, Grupo>();
  for (const l of linhas) {
    const chave = `${l.marca}|${l.categoria}|${l.descricao}|${l.genero}`;
    let g = mapa.get(chave);
    if (!g) {
      g = {
        chave,
        nome: `${l.marca} – ${l.descricao}`.trim(),
        marca: l.marca,
        categoria: l.categoria,
        genero: l.genero,
        foto: l.foto,
        precoCustoMax: l.custo,
        precoVendaMax: l.venda,
        variantes: [],
      };
      mapa.set(chave, g);
    }
    g.variantes.push(l);
    if (!g.foto && l.foto) g.foto = l.foto;
    if (l.custo > g.precoCustoMax) g.precoCustoMax = l.custo;
    if (l.venda > g.precoVendaMax) g.precoVendaMax = l.venda;
  }

  const grupos = [...mapa.values()];
  // Gera código no formato CODFORN-COR3[-TAM] por grupo (resolve colisões)
  for (const g of grupos) {
    const prefixos = g.variantes.map(
      (v) => v.fornecedorCodigo || v.sku || "",
    );
    // Se todas as variantes do grupo compartilham o mesmo fornecedorCodigo, usa ele;
    // caso contrário, cada variante usa seu próprio prefixo.
    const unico = prefixos.every((p) => p === prefixos[0]) ? prefixos[0] : null;
    if (unico) {
      const codigos = gerarCodigosLote(unico, g.variantes);
      g.variantes.forEach((v, i) => (v.codigoVariante = codigos[i] || v.sku));
    } else {
      g.variantes.forEach((v) => {
        const pref = v.fornecedorCodigo || v.sku;
        const [c] = gerarCodigosLote(pref, [v]);
        v.codigoVariante = c || v.sku;
      });
    }
  }

  const categorias = new Map<string, number>();
  const marcas = new Map<string, number>();
  for (const l of linhas) {
    categorias.set(l.categoria, (categorias.get(l.categoria) ?? 0) + 1);
    marcas.set(l.marca, (marcas.get(l.marca) ?? 0) + 1);
  }

  return {
    totalLinhas: linhas.length,
    totalProdutos: grupos.length,
    totalVariantes: linhas.length,
    categorias: [...categorias.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([nome, qtd]) => ({ nome, qtd })),
    marcas: [...marcas.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([nome, qtd]) => ({ nome, qtd })),
    avisos,
    grupos,
  };
}

export const analisarPlanilha = createServerFn({ method: "POST" }).handler(async () => {
  const values = await buscarPlanilha();
  return processar(values);
});

const importarSchema = z.object({ confirm: z.literal(true) });

export const importarPlanilha = createServerFn({ method: "POST" })
  .inputValidator((input) => importarSchema.parse(input))
  .handler(async () => {
    const values = await buscarPlanilha();
    const { grupos } = processar(values);

    // Categorias existentes
    const { data: catsExist } = await supabaseAdmin.from("categorias").select("id, nome");
    const catMap = new Map<string, string>();
    (catsExist ?? []).forEach((c: any) => catMap.set(String(c.nome).toUpperCase(), c.id));

    // SKUs já existentes
    const { data: varsExist } = await supabaseAdmin
      .from("produto_variantes")
      .select("codigo_barras");
    const skuExistentes = new Set<string>(
      (varsExist ?? []).map((v: any) => String(v.codigo_barras ?? "")).filter(Boolean),
    );

    let categoriasCriadas = 0;
    let produtosCriados = 0;
    let variantesCriadas = 0;
    let variantesPuladas = 0;

    for (const g of grupos) {
      // 1) categoria
      let catId: string | undefined = catMap.get(g.categoria);
      if (!catId && g.categoria) {
        const { data: nc, error } = await supabaseAdmin
          .from("categorias")
          .insert({ nome: g.categoria })
          .select("id")
          .single();
        if (error) throw new Error(`categoria ${g.categoria}: ${error.message}`);
        catId = nc.id;
        catMap.set(g.categoria, catId!);
        categoriasCriadas++;
      }

      // 2) produto
      const { data: np, error: pe } = await supabaseAdmin
        .from("produtos")
        .insert({
          nome: g.nome,
          categoria_id: catId ?? null,
          marca: g.marca || null,
          descricao: null,
          preco_custo: g.precoCustoMax,
          preco_venda: g.precoVendaMax,
          estoque_minimo: 0,
          foto_url: g.foto,
          ativo: true,
        })
        .select("id")
        .single();
      if (pe) throw new Error(`produto ${g.nome}: ${pe.message}`);
      produtosCriados++;

      // 3) variantes
      for (const v of g.variantes) {
        const codigo = v.codigoVariante || v.sku;
        if (codigo && skuExistentes.has(codigo)) {
          variantesPuladas++;
          continue;
        }
        const { error: ve } = await supabaseAdmin.from("produto_variantes").insert({
          produto_id: np.id,
          cor: v.cor || null,
          tamanho: v.tamanho || null,
          codigo_barras: codigo || null,
          qtd_estoque: v.qtd,
          preco_venda: v.venda || g.precoVendaMax,
          preco_custo: v.custo || g.precoCustoMax,
        });
        if (ve) throw new Error(`variante ${codigo}: ${ve.message}`);
        if (codigo) skuExistentes.add(codigo);
        variantesCriadas++;
      }
    }

    return { categoriasCriadas, produtosCriados, variantesCriadas, variantesPuladas };
  });