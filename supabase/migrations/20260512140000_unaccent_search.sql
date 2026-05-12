-- Busca sem acento para produtos e clientes
create extension if not exists unaccent;
create extension if not exists pg_trgm;

-- Wrapper IMMUTABLE (unaccent padrão é STABLE; não permitido em generated column)
create or replace function public.f_unaccent(t text)
returns text
language sql
immutable
strict
parallel safe
as $$ select translate(
  $1,
  'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
  'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
) $$;

alter table public.produtos
  add column if not exists nome_norm text
  generated always as (lower(public.f_unaccent(nome))) stored;

create index if not exists produtos_nome_norm_idx
  on public.produtos using gin (nome_norm gin_trgm_ops);

alter table public.clientes
  add column if not exists nome_norm text
  generated always as (lower(public.f_unaccent(nome))) stored;

create index if not exists clientes_nome_norm_idx
  on public.clientes using gin (nome_norm gin_trgm_ops);

notify pgrst, 'reload schema';
