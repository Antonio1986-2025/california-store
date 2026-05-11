const SEPARADOR_CORES = /[\s/,\-+&]+/;

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function abreviarCor(cor: string): string {
  const limpa = semAcento((cor ?? "").trim().toUpperCase());
  if (!limpa) return "XXX";
  const primeira = limpa.split(SEPARADOR_CORES).filter(Boolean)[0] ?? "XXX";
  return primeira.replace(/[^A-Z0-9]/g, "").slice(0, 3).padEnd(3, "X");
}

export function normTamanho(t: string): string {
  const u = (t ?? "").trim().toUpperCase();
  if (!u || u === "UNICO" || u === "ÚNICO" || u === "UNI") return "";
  return u.replace(/\s+/g, "");
}

export function gerarCodigoVariante(opts: {
  prefixo: string;
  cor: string;
  tamanho: string;
}): string {
  const pref = (opts.prefixo ?? "").trim();
  if (!pref) return "";
  const cor = abreviarCor(opts.cor);
  const tam = normTamanho(opts.tamanho);
  return tam ? `${pref}-${cor}-${tam}` : `${pref}-${cor}`;
}

/** Gera códigos para um lote, resolvendo colisões com sufixo -2, -3, ... */
export function gerarCodigosLote(
  prefixo: string,
  variantes: { cor: string; tamanho: string }[],
): string[] {
  const usados = new Map<string, number>();
  return variantes.map((v) => {
    const base = gerarCodigoVariante({ prefixo, cor: v.cor, tamanho: v.tamanho });
    if (!base) return "";
    const n = (usados.get(base) ?? 0) + 1;
    usados.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  });
}