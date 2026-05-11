## Formato do código de variante

`{CODIGO_FORNECEDOR}-{COR3}[-{TAMANHO}]`

- **Prefixo** = `CODIGO/FORNECEDOR` da planilha (ex.: `6361518176115`).
- **Cor** = 3 primeiras letras da **primeira** cor (split por `/`, `,`, `-`, espaço), maiúsculas, sem acento. `BRANCA→BRA`, `ROSA→ROS`, `PRETA→PRE`, `AZUL→AZU`, `MARROM/CINZA→MAR`, `VERMELHO/BEGE/AZUL→VER`.
- **Tamanho** = uppercase, trim. Se for `UNICO`, **omite** o sufixo (`6361-BRA`).
- **Sem fornecedor**: usa o `CODIGO/INTERNO` como prefixo (fallback). Sem cor: usa `XXX`.
- **Colisão**: se 2 variantes geram o mesmo código (ex.: cores `AZUL CLARO` e `AZUL ESCURO` viram `AZU`), adiciona sufixo numérico `-2`, `-3`...

## Onde aplicar

### 1. Importação da planilha (já existente)
- Em `src/lib/import-planilha.functions.ts`, gerar `codigoVariante` para cada linha durante `processar()` usando a regra acima.
- Salvar esse código em `produto_variantes.codigo_barras` (no lugar do `CODIGO/INTERNO` atual).
- Exibir o novo código na coluna "Prévia" e nos avisos quando houver colisão.

### 2. Cadastro manual em `produto-form.tsx`
- Adicionar campo **"Código fornecedor"** (texto) acima das variantes.
- Para cada linha de variante, mostrar o código gerado em **tempo real** num placeholder/badge cinza ao lado do campo "Código de barras".
- Botão **"Usar sugestão"** preenche o campo com o código gerado. O usuário ainda pode sobrescrever manualmente.
- Resolução de colisão funciona dentro da lista de variantes do formulário.

## Helper compartilhado

Criar `src/lib/sku-format.ts` (puro, isomórfico, sem deps de servidor):
- `abreviarCor(cor: string): string` — 3 letras da 1ª cor, uppercase, sem acento.
- `gerarCodigoVariante({ prefixo, cor, tamanho }): string` — aplica a regra básica.
- `gerarCodigosLote(prefixo, variantes[]): string[]` — gera para todas, resolve colisões com `-2`, `-3`.

Reutilizado pela importação e pelo formulário.

## Arquivos

- **Novo:** `src/lib/sku-format.ts`
- **Editado:** `src/lib/import-planilha.functions.ts` — usar `gerarCodigosLote` por grupo, gravar no `codigo_barras`.
- **Editado:** `src/components/erp/produtos/produto-form.tsx` — campo "Código fornecedor", sugestão automática por linha.
- **Editado:** `src/components/erp/produtos/importar-modal.tsx` — exibir o código gerado na prévia.

## Fora deste escopo

- Re-gerar códigos de produtos já existentes no banco (faria depois, com migration manual se quiser).
- Imprimir etiquetas de código de barras (próximo passo natural).