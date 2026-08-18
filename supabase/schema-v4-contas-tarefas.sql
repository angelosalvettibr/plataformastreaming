-- ═══ LIFE COMPANION v4 — CONTAS DO MÊS + TAREFAS GUIADAS (seed agosto/26) ═══
-- Rodar no SQL Editor. Seguro rodar por cima de tudo.

-- 1. CONTAS DO MÊS (a pagar: previsto, vencimento, status)
create table if not exists public.contas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  mes text not null,                -- 'YYYY-MM'
  descricao text not null,
  categoria text not null,
  valor_previsto numeric(12,2) not null default 0,
  vencimento date,                  -- null = sem data definida
  pago boolean not null default false,
  pago_em date,
  valor_pago numeric(12,2),
  obs text,
  criado_por text not null
);
alter table public.contas enable row level security;
drop policy if exists contas_all on public.contas;
create policy contas_all on public.contas for all to authenticated
  using (public.meu_role() in ('admin','financeiro'))
  with check (public.meu_role() in ('admin','financeiro'));

-- 2. TAREFAS GUIADAS (o sistema pede o que precisa, por papel)
create table if not exists public.tarefas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  mes text not null,
  para text not null check (para in ('admin','financeiro','juridico')),
  titulo text not null,
  detalhe text,
  link text,
  prioridade int not null default 2,  -- 1=vermelho, 2=amarelo, 3=branco
  feito boolean not null default false,
  feito_por text,
  feito_em timestamptz,
  criado_por text not null default 'claude'
);
alter table public.tarefas enable row level security;
drop policy if exists tarefas_sel on public.tarefas;
create policy tarefas_sel on public.tarefas for select to authenticated
  using (public.meu_role() is not null);
drop policy if exists tarefas_mod on public.tarefas;
create policy tarefas_mod on public.tarefas for update to authenticated
  using (public.meu_role() = 'admin' or public.meu_role() = para);
drop policy if exists tarefas_ins on public.tarefas;
create policy tarefas_ins on public.tarefas for insert to authenticated
  with check (public.meu_role() = 'admin' or public.meu_role() = para);
drop policy if exists tarefas_del on public.tarefas;
create policy tarefas_del on public.tarefas for delete to authenticated
  using (public.meu_role() = 'admin');

-- 3. SEED — CONTAS DE AGOSTO/26 (a partir de 12/08; conferir vales)
insert into public.contas (mes, descricao, categoria, valor_previsto, vencimento, obs, criado_por) values
  ('2026-08','Light Villa Irvana','Villa fixo',7477,'2026-08-15','Conta de luz da Villa','seed'),
  ('2026-08','Vale Uillian (VR 608 + transporte 520)','Villa fixo',1128,'2026-08-14','Confirmar se já saiu','seed'),
  ('2026-08','Vale Roselange (VR 270 + transporte 753)','Villa fixo',1023,'2026-08-14','Confirmar se já saiu','seed'),
  ('2026-08','Vale Daniely (VR 450 + transporte 200)','Angra',650,'2026-08-14','Confirmar se já saiu','seed'),
  ('2026-08','Vale Luciana (transporte)','Angelo PF',600,'2026-08-14','Confirmar se já saiu','seed'),
  ('2026-08','Pluxee (VR Edson + Letícia)','Angelo PJ',1400,'2026-08-14','Confirmar se já saiu','seed'),
  ('2026-08','Folha PJ 2ª quinzena (William + Priscilla + Letícia + Edson)','Angelo PJ',19300,'2026-08-20','5.000+5.000+4.595+~4.732','seed'),
  ('2026-08','Claro Villa','Villa fixo',642,'2026-08-25',null,'seed'),
  ('2026-08','Água Villa','Villa fixo',3500,'2026-08-30',null,'seed'),
  ('2026-08','Bradesco (financiamento Villa)','Villa fixo',65000,null,'⚠️ SEM DATA CONFIRMADA — pendência-mãe: definir com o banco','seed')
on conflict do nothing;

-- 4. SEED — TAREFAS DE AGOSTO/26
insert into public.tarefas (mes, para, titulo, detalhe, link, prioridade) values
  ('2026-08','financeiro','Registrar no Caixa cada conta paga','Toda conta de agosto: registra na hora com comprovante anexado','/caixa',1),
  ('2026-08','financeiro','Confirmar e pagar os vales pendentes','Uillian, Roselange, Daniely, Lu e Pluxee — total ~R$ 4.901. Marcar pagos em Contas do Mês','/contas',1),
  ('2026-08','financeiro','Completar cadastro dos 28 fornecedores','PIX/conta e contato de cada um (categoria e valor já estão)','/fornecedores',2),
  ('2026-08','financeiro','Fechamento: subir extrato Genco (CSV) + fatura do cartão','Até dia 3/set, em Extratos & Faturas, mês = agosto','/extratos',2),
  ('2026-08','juridico','Cadastrar advogados ativos com contato','Bruno Burini, Melegari, Pino, Quiroga, Marques & Melo','/advogados',1),
  ('2026-08','juridico','Cadastrar processos com próximo prazo','Cada processo com data — o semáforo cobra sozinho depois','/advogados',1),
  ('2026-08','juridico','Status da denúncia espontânea com Bruno','Registrar na Mesa o que o Bruno disser sobre o parcelamento parado','/mesa',1),
  ('2026-08','admin','Definir data do Bradesco com o banco','Quanto/quando volta a parcela e o que virou dos meses pulados','/contas',1),
  ('2026-08','admin','Regra nº 1: recarga única de R$ 10.000 na segunda 17/08','Uma recarga por semana no pré-pago — fim do gotejo','/cockpit',1)
on conflict do nothing;
