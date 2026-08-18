-- ═══ LIFE COMPANION v7 — RECEITAS ═══
create table if not exists public.receitas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  data date not null,
  origem text not null,
  valor numeric(12,2) not null check (valor >= 0),
  categoria text not null,
  obs text,
  comprovante_url text,
  criado_por text not null
);
alter table public.receitas enable row level security;
drop policy if exists rec_all on public.receitas;
create policy rec_all on public.receitas for all to authenticated
  using (public.meu_role() in ('admin','financeiro'))
  with check (public.meu_role() in ('admin','financeiro'));

-- Importar ENTRADAS de agosto (1-11) do extrato Genco já conhecido
insert into public.receitas (data, origem, valor, categoria, obs, criado_por)
select * from (values
  ('2026-08-07'::date,'Banco Inter (reserva Villa)','34838.10'::numeric,'Villa Irvana','entrada identificada no extrato','extrato-import'),
  ('2026-08-06'::date,'ITSFW / TIM','500.00'::numeric,'TIM via NT','⚠️ agosto muito abaixo do previsto (27k)','extrato-import')
) as v(data,origem,valor,categoria,obs,criado_por)
where not exists (select 1 from public.receitas r where r.data = v.data and r.valor = v.valor);
