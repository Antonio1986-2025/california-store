-- Habilita unaccent e cria coluna normalizada para busca sem acento
create extension if not exists unaccent;

-- Função IMMUTABLE wrapper (unaccent é STABLE, não pode ser usada em generated column)
create or replace function public.f_unaccent(text)
returns text
language sql
immutable
strict
parallel safe
as $$ select public.unaccent('public.unaccent', $1) $$;

alter table public.produtos
  add column if not exists nome_norm text
  generated always as (lower(public.f_unaccent(nome))) stored;

create index if not exists produtos_nome_norm_idx
  on public.produtos using gin (nome_norm gin_trgm_ops);

-- garante extensão pg_trgm para o índice
create extension if not exists pg_trgm;

alter table public.clientes
  add column if not exists nome_norm text
  generated always as (lower(public.f_unaccent(nome))) stored;

create index if not exists clientes_nome_norm_idx
  on public.clientes using gin (nome_norm gin_trgm_ops);

notify pgrst, 'reload schema';
