create extension if not exists unaccent;

create or replace function public.buscar_produtos(termo text)
returns table (
  variante_id uuid,
  produto_id uuid,
  nome text,
  cor text,
  tamanho text,
  codigo_barras text,
  preco_venda numeric,
  qtd_estoque numeric,
  foto_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    v.id as variante_id,
    p.id as produto_id,
    p.nome,
    v.cor,
    v.tamanho,
    v.codigo_barras,
    v.preco_venda,
    v.qtd_estoque,
    p.foto_url
  from public.produto_variantes v
  join public.produtos p on p.id = v.produto_id
  where (p.ativo is null or p.ativo is true)
    and (
      coalesce(v.codigo_barras,'') ilike '%' || termo || '%'
      or public.unaccent(lower(p.nome)) like '%' || public.unaccent(lower(termo)) || '%'
    )
  order by p.nome
  limit 60
$$;

grant execute on function public.buscar_produtos(text) to anon, authenticated;

create or replace function public.buscar_clientes(termo text)
returns table (
  id uuid,
  nome text,
  cpf text,
  saldo_credito numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.nome, c.cpf, coalesce(c.saldo_credito, 0)::numeric as saldo_credito
  from public.clientes c
  where public.unaccent(lower(c.nome)) like '%' || public.unaccent(lower(termo)) || '%'
     or coalesce(c.cpf,'') ilike '%' || termo || '%'
  order by c.nome
  limit 20
$$;

grant execute on function public.buscar_clientes(text) to anon, authenticated;

notify pgrst, 'reload schema';
