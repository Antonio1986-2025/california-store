-- Force PostgREST to reload schema cache to pick up new clientes columns
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS rg text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS rua text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS observacoes text,
  ADD COLUMN IF NOT EXISTS saldo_credito numeric NOT NULL DEFAULT 0;

NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst', 'reload schema');
