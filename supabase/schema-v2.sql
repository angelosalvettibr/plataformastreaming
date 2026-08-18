-- ═══ LIFE COMPANION v2 — PAPÉIS, FORNECEDORES, PROCESSOS, ESTORNO, COCKPIT ═══
-- Rodar TUDO no SQL Editor (pode rodar por cima da v1 sem medo).

create table if not exists public.perfis (
  email text primary key,
  nome text not null,
  role text not null check (role in ('admin','financeiro','juridico'))
);
insert into public.perfis (email, nome, role) values
  ('angelo.salvetti@naturaltalks.com', 'Angelo', 'admin'),
  ('leticia.souza@mediabridge.com.br', 'Letícia', 'financeiro'),
  ('adm.juridico@mediabridge.com.br', 'Priscilla', 'juridico')
on conflict (email) do update set nome = excluded.nome, role = excluded.role;

create or replace function public.meu_role()
returns text language sql stable security definer as $$
  select role from public.perfis where lower(email) = lower(coalesce(auth.jwt() ->> 'email',''));
$$;

alter table public.pagamentos add column if not exists estornado boolean not null default false;
alter table public.pagamentos add column if not exists estornado_por text;
alter table public.pagamentos add column if not exists estornado_em timestamptz;

create table if not exists public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nome text not null, email text, telefone text, pix_ou_conta text, categoria text, obs text,
  criado_por text not null
);

create table if not exists public.advogados (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nome text not null, escritorio text, email text, telefone text, area text, obs text,
  criado_por text not null
);
create table if not exists public.processos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  titulo text not null, numero text, advogado text,
  status text not null default 'Em andamento',
  proximo_prazo date, nota text, criado_por text not null
);

create table if not exists public.cockpit_valores (
  linha text not null, mes text not null, valor numeric(12,2) not null default 0,
  primary key (linha, mes)
);
create table if not exists public.cockpit_config (
  chave text primary key, valor jsonb not null
);
insert into public.cockpit_config (chave, valor) values
  ('meta', '{"saldoInicial": 2913, "envelopePct": 5, "envelopeGoal": 12000, "comissaoPct": 15}')
on conflict (chave) do update set valor = excluded.valor;

insert into public.cockpit_valores (linha, mes, valor) values
  ('villaConf','2026-08',53047),('villaConf','2026-09',104037),('villaConf','2026-10',81451),
  ('villaConf','2026-11',77312),('villaConf','2026-12',121217),('villaConf','2027-01',36747),
  ('villaConf','2027-02',159110),('villaConf','2027-03',36451),
  ('villaVender','2026-08',20000),('villaVender','2026-09',60000),('villaVender','2026-10',100000),
  ('villaVender','2026-11',110000),('villaVender','2026-12',123000),('villaVender','2027-01',163000),
  ('villaVender','2027-02',41000),('villaVender','2027-03',164000),
  ('tim','2026-08',27000),('tim','2026-09',20000),('tim','2026-10',17000),('tim','2026-11',14000),
  ('tim','2026-12',11000),('tim','2027-01',8000),('tim','2027-02',5000),('tim','2027-03',0),
  ('ntalks','2026-09',15000),('ntalks','2026-10',15000),('ntalks','2026-11',15000),('ntalks','2026-12',15000),
  ('ntalks','2027-01',15000),('ntalks','2027-02',15000),('ntalks','2027-03',15000),('ntalks','2027-04',15000),
  ('meridiano','2026-08',2500)
on conflict (linha, mes) do update set valor = excluded.valor;

alter table public.perfis enable row level security;
alter table public.fornecedores enable row level security;
alter table public.advogados enable row level security;
alter table public.processos enable row level security;
alter table public.cockpit_valores enable row level security;
alter table public.cockpit_config enable row level security;

drop policy if exists perfis_sel on public.perfis;
create policy perfis_sel on public.perfis for select to authenticated using (true);

drop policy if exists "pagamentos_select" on public.pagamentos;
create policy "pagamentos_select" on public.pagamentos for select to authenticated
  using (public.meu_role() in ('admin','financeiro'));
drop policy if exists "pagamentos_insert" on public.pagamentos;
create policy "pagamentos_insert" on public.pagamentos for insert to authenticated
  with check (public.meu_role() in ('admin','financeiro'));
drop policy if exists "pagamentos_update" on public.pagamentos;
create policy "pagamentos_update" on public.pagamentos for update to authenticated
  using (public.meu_role() in ('admin','financeiro'));
drop policy if exists "pagamentos_delete" on public.pagamentos;
create policy "pagamentos_delete" on public.pagamentos for delete to authenticated
  using (public.meu_role() = 'admin');

drop policy if exists forn_all on public.fornecedores;
create policy forn_all on public.fornecedores for all to authenticated
  using (public.meu_role() in ('admin','financeiro')) with check (public.meu_role() in ('admin','financeiro'));

drop policy if exists "registros_select" on public.registros;
create policy "registros_select" on public.registros for select to authenticated
  using (public.meu_role() in ('admin','juridico'));
drop policy if exists "registros_insert" on public.registros;
create policy "registros_insert" on public.registros for insert to authenticated
  with check (public.meu_role() in ('admin','juridico'));
drop policy if exists "registros_delete" on public.registros;
create policy "registros_delete" on public.registros for delete to authenticated
  using (public.meu_role() in ('admin','juridico'));

drop policy if exists adv_all on public.advogados;
create policy adv_all on public.advogados for all to authenticated
  using (public.meu_role() in ('admin','juridico')) with check (public.meu_role() in ('admin','juridico'));
drop policy if exists proc_all on public.processos;
create policy proc_all on public.processos for all to authenticated
  using (public.meu_role() in ('admin','juridico')) with check (public.meu_role() in ('admin','juridico'));

drop policy if exists ck_val on public.cockpit_valores;
create policy ck_val on public.cockpit_valores for all to authenticated
  using (public.meu_role() = 'admin') with check (public.meu_role() = 'admin');
drop policy if exists ck_cfg on public.cockpit_config;
create policy ck_cfg on public.cockpit_config for all to authenticated
  using (public.meu_role() = 'admin') with check (public.meu_role() = 'admin');
