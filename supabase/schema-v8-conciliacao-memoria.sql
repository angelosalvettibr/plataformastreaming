-- ═══ v8: MEMÓRIA DA CONCILIAÇÃO — linhas ignoradas não voltam nunca mais ═══
create table if not exists public.conciliacao_ignorados (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  tipo text not null check (tipo in ('saida','entrada')),
  data date not null,
  valor numeric(12,2) not null,
  descricao text not null default '',
  criado_por text not null
);
create unique index if not exists conc_ign_unq
  on public.conciliacao_ignorados (tipo, data, valor, descricao);
alter table public.conciliacao_ignorados enable row level security;
drop policy if exists ci_all on public.conciliacao_ignorados;
create policy ci_all on public.conciliacao_ignorados for all to authenticated
  using (public.meu_role() in ('admin','financeiro'))
  with check (public.meu_role() in ('admin','financeiro'));
