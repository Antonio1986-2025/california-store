-- Reapply NF de saída fields
alter table public.produtos
  add column if not exists codigo_fornecedor text,
  add column if not exists codigo_interno text;

create index if not exists idx_produtos_codigo_fornecedor
  on public.produtos (codigo_fornecedor)
  where codigo_fornecedor is not null;

alter table public.venda_itens
  add column if not exists nf_saida_emitida boolean not null default false,
  add column if not exists nf_saida_numero text,
  add column if not exists nf_saida_data timestamptz;

create index if not exists idx_venda_itens_nf_saida_emitida
  on public.venda_itens (nf_saida_emitida);

notify pgrst, 'reload schema';
