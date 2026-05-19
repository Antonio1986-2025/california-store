ALTER TABLE public.consignacoes
  ADD COLUMN IF NOT EXISTS prazo_devolucao date;
NOTIFY pgrst, 'reload schema';
