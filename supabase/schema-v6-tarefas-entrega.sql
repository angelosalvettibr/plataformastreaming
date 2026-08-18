-- ═══ LIFE COMPANION v6 — TAREFAS COM ENTREGA OBRIGATÓRIA ═══
-- A tarefa só se completa entregando o que ela pede: arquivo ou resposta.

alter table public.tarefas add column if not exists exige text not null default 'nenhum'
  check (exige in ('nenhum','arquivo','resposta'));
alter table public.tarefas add column if not exists resposta text;
alter table public.tarefas add column if not exists arquivo_url text;

-- Calibrar as tarefas de agosto já semeadas:
update public.tarefas set exige = 'resposta'
  where mes = '2026-08' and titulo like 'Confirmar e pagar os vales%';
update public.tarefas set exige = 'arquivo'
  where mes = '2026-08' and titulo like 'Fechamento: subir extrato%';
update public.tarefas set exige = 'resposta'
  where mes = '2026-08' and titulo like 'Status da denúncia espontânea%';
update public.tarefas set exige = 'resposta'
  where mes = '2026-08' and titulo like 'Definir data do Bradesco%';
update public.tarefas set exige = 'resposta'
  where mes = '2026-08' and titulo like 'Regra nº 1%';
