## Objetivo

Adicionar em **Produtos** um botão **"Importar da planilha"** que:
1. Lê a planilha do Google Sheets já conectada.
2. Mostra uma **prévia detalhada** com contagens.
3. Só insere no banco depois da sua confirmação.

## Fluxo na tela

1. Botão "Importar planilha" no topo de `/produtos`, ao lado de "Novo produto".
2. Ao clicar, abre um modal que chama uma server function de **análise** (não escreve nada).
3. O modal exibe a **prévia**:
   - Total de linhas lidas
   - **Produtos únicos** (após agrupar por marca + descrição + categoria + gênero)
   - **Variantes** (total de linhas que viram variantes)
   - **Categorias normalizadas** (lista com contagem) — ex.: `BONÉ: 27, CINTO: 18, ...`
   - **Marcas** (lista com contagem)
   - **Linhas com aviso**: sem preço, sem foto, código duplicado
   - Tabela com as primeiras 10 linhas processadas para conferência
4. Dois botões: **Cancelar** ou **Confirmar importação**.
5. Ao confirmar, chama uma segunda server function que faz o insert e mostra o resultado (X produtos, Y variantes, Z categorias criadas).

## Regras de transformação

- **Categoria**: trim + uppercase, `BONÉS → BONÉ`, `BONÉ → BONÉ`, `PORTA-CARTAO → PORTA-CARTÃO`. Cria em `categorias` se não existir.
- **Marca**: trim + uppercase, salva no campo texto `produtos.marca`.
- **Agrupamento**: chave = `marca | categoria | descrição | gênero`. Linhas com a mesma chave viram **1 produto** com N variantes (cor + tamanho).
- **Nome do produto**: `MARCA – DESCRIÇÃO` (ex.: "ARIAT – BONÉ TRADICIONAL TELA").
- **SKU da variante**: `CODIGO/INTERNO` da linha (preserva rastreabilidade).
- **Preço**: parse de `R$ 59,90` → `59.90`. Vazio → `0`.
- **Quantidade**: `1,00` → `1` (inteiro).
- **Foto**: `https://drive.google.com/file/d/{ID}/view...` → `https://lh3.googleusercontent.com/d/{ID}`. Salva em `produtos.foto_url` (1ª variante do grupo).
- **Idempotência**: se o SKU já existir em `produto_variantes`, pula a linha (não duplica).

## Detalhes técnicos

- Nova server function `src/lib/import-planilha.functions.ts`:
  - `analisarPlanilha()` — busca no Google Sheets via gateway (`GOOGLE_SHEETS_API_KEY` + `LOVABLE_API_KEY`), aplica as transformações, retorna o resumo + linhas processadas. **Não escreve.**
  - `importarPlanilha(payload)` — recebe as linhas já processadas (vindas do passo de análise) e insere em `categorias`, `produtos`, `produto_variantes` usando o `client.server.ts` (service role).
- ID da planilha fica fixo no código por enquanto: `1VFs17y1R_UtU86buz_LQZfN-5a8k_sNbqn83dX_aZM4`, aba `Página1`.
- Componente novo: `src/components/erp/produtos/importar-modal.tsx` (Dialog do shadcn).
- Wire no botão de `src/routes/_authenticated/produtos.tsx`.

## Arquivos

- **Novo:** `src/lib/import-planilha.functions.ts`
- **Novo:** `src/components/erp/produtos/importar-modal.tsx`
- **Editado:** `src/routes/_authenticated/produtos.tsx` (adiciona botão + modal)

## O que NÃO entra agora

- Upload manual de planilha (usa só o link já configurado).
- Reimportação atualizando preços/estoque (a v1 só insere o que ainda não existe).
- Edição da prévia antes de confirmar (você ajusta depois em Produtos).