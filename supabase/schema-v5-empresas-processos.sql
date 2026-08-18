-- ═══ LIFE COMPANION v5 — EMPRESAS DO GRUPO + SEED JURÍDICO COMPLETO ═══
-- Fonte: Controle_Processos_atualizado.xlsx + GRUPO_MB_BANCOS_2025.xlsx (12/08/2026)

-- 1. TABELA DE EMPRESAS (visível a financeiro E jurídico)
create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nome text not null,
  cnpj text,
  status text,
  obs text,
  criado_por text not null
);
alter table public.empresas enable row level security;
drop policy if exists emp_all on public.empresas;
create policy emp_all on public.empresas for all to authenticated
  using (public.meu_role() in ('admin','financeiro','juridico'))
  with check (public.meu_role() in ('admin','financeiro','juridico'));

-- 2. PROCESSOS ganham coluna empresa
alter table public.processos add column if not exists empresa text;

-- 3. SEED EMPRESAS
insert into public.empresas (nome, obs, criado_por) values
  ('MEDIA BRIDGE PRODUÇÕES LTDA','Produção — PAUSADA. Maior volume de processos: trabalhistas, execuções Caixa, 9 PCs ANCINE, execução fiscal','seed'),
  ('AGREGA (Provedor de Acesso)','Crítica: 7 execuções fiscais Fazenda Nacional/RS (~R$ 3,4M) + trabalhistas + Daycoval/Itaú','seed'),
  ('GENCO ADMINISTRAÇÃO','Hospitalidade (Villa Irvana + Angra) — operacional. 1 trabalhista compartilhado; denúncia espontânea em curso','seed'),
  ('MB TECH','1 trabalhista compartilhado (Rayol)','seed'),
  ('PMTB','2 execuções Caixa Econômica (~R$ 3,1M somadas)','seed'),
  ('NEW WAVE MEDIA PRODUÇÕES','Execução SICOOB + contratos Caixa atrasados','seed'),
  ('DIGITAL MEDIA BRIDGE','Ação monitória Caixa R$ 618k','seed'),
  ('ANGELO — PESSOA FÍSICA','Revisional Itaú, anulatória condomínio, arbitragem Mofarrej (arquivada). Serasa: ~R$ 2,7M mapeados jul/26','seed')
on conflict do nothing;

-- 4. SEED ADVOGADOS (dos arquivos + os conhecidos)
insert into public.advogados (nome, escritorio, email, telefone, area, obs, criado_por) values
  ('CH.Teixeira Advogados',null,null,null,'Trabalhista + execuções bancárias','Maior volume do grupo','seed'),
  ('Dr. Wesley',null,null,null,'Tributário + bancos','Execuções fiscais Fazenda Nacional; acordo Itaú','seed'),
  ('Dra. Rosana',null,null,null,'ANCINE / prestação de contas','9 PCs de projetos audiovisuais','seed'),
  ('Dra. Solange',null,null,null,'Trabalhista','Processo Rayol/Agrega','seed'),
  ('Dra. Nathália',null,null,null,'Bancário','Execução Daycoval','seed'),
  ('BRZ Advogados',null,null,null,'Cível','Prudential, indenizatórias','seed'),
  ('VR Advogados',null,null,null,'Bancário','Revisional Itaú PF','seed'),
  ('Fonseca & Kahn Advogados',null,null,null,'Cível','Anulatória condomínio PF','seed'),
  ('Bruno Burini',null,null,null,'Tributário / societário','Denúncia espontânea Genco; conselheiro geral','seed'),
  ('Avv. Melegari',null,null,null,'Penal Itália','Appello Corte di Milano (Pure Bros)','seed'),
  ('Avv. Pino',null,null,null,'Cível Itália','Incidente di esecuzione — sequestro €12,3M','seed'),
  ('Dr. Quiroga',null,null,null,'Tributário','CARF ~R$ 34M (co-obrigação Altino)','seed'),
  ('Marques & Melo',null,null,null,'Trabalhista/cível BR','Carteira de 27 processos','seed')
on conflict do nothing;

-- 5. SEED PROCESSOS (38 do controle atualizado)
insert into public.processos (titulo, numero, advogado, status, proximo_prazo, nota, empresa, criado_por) values
  ('[TRABALHISTA] RECLAMAÇÃO TRABALHISTA — RAFAELLA ROCHA LEITE (CLT)','0100869-33.2024.5.01.0080','CH.Teixeira Advogados','Em andamento',null,'Penhora  MB · R$ 205.097,50','MEDIA BRIDGE','seed'),
  ('[TRABALHISTA] ACORDO HOMOLOGADO — FRANCISCO VEREZA (PJ)','0100977-65.2023.5.01.0058','CH.Teixeira Advogados','Em andamento',null,'Penhora online realizada · R$ 7.380,00','MEDIA BRIDGE','seed'),
  ('[TRABALHISTA] RECLAMAÇÃO TRABALHISTA — LEONARDO LOPES DA SILVA (PJ)','0100713-77.2023.5.01.0016','CH.Teixeira Advogados','Suspenso',null,'Suspenso · R$ 609.655,03','MEDIA BRIDGE/AGREGA/PMTB E ANGELO','seed'),
  ('[TRABALHISTA] RECLAMAÇÃO TRABALHISTA — MARCOS VINICIUS RAYOL SOBREIRO (CLT)','0100690-33.2023.5.01.0081','Dra. Solange','Em andamento',null,'Penhora · R$ 112.644,99','AGREGA','seed'),
  ('[TRABALHISTA] RECLAMAÇÃO TRABALHISTA — MARCOS VINICIUS RAYOL SOBREIRO (PJ)','0101353-11.2024.5.01.0060','CH.Teixeira Advogados','Suspenso',null,'Suspenso · R$ 617.942,70','GENCO/MB TECH/AGREGA','seed'),
  ('[TRABALHISTA] RECLAMAÇÃO TRABALHISTA — DAVID RAUH (PJ)','0100047-45.2025.5.01.0036','CH.Teixeira Advogados','Em andamento',null,'Desistência da ação (temporariamente) · R$ 170.000,00','MEDIA BRIDGE','seed'),
  ('[TRABALHISTA] RECLAMAÇÃO TRABALHISTA — LISIANE SOARES (CLT)','0020279-85.2025.5.04.0004','CH.Teixeira Advogados','Em andamento',null,'Penhora online realizada · R$ 79.054,09','AGREGA','seed'),
  ('[TRABALHISTA] RECLAMAÇÃO TRABALHISTA — PAULO SERGIO RODRIGUES VARGATT','0021022-56.2025.5.04.0017','CH.Teixeira Advogados','Em andamento',null,'Prazo para baixa na CTPS · R$ 401.110,32','AGREGA','seed'),
  ('[CÍVEL] AÇÃO REVISIONAL — BANCO ITAÚ','0821446-39.2024.8.19.0209','VR Advogados','Em andamento',null,'Laudo de avaliação','ANGELO - PESSOA FÍSICA','seed'),
  ('[CÍVEL] EXECUÇÃO DE TÍTULO EXTRAJUDICIAL — FRANCISCO SLADE FERNANDES E GABRIELAARAÚJO DAMASCENO','0850201-79.2026.8.19.0209','CH.Teixeira Advogados','Em andamento',null,'Citação · R$ 32.124,24','MEDIA BRIDGE','seed'),
  ('[CÍVEL] EXECUÇÃO — PRUDENTIAL','0864892-37.2024.8.19.0001','BRZ Advogados','Em andamento',null,'Recurso · BURINI','MEDIA BRIDGE','seed'),
  ('[CÍVEL] EMBARGOS À EXECUÇÃO — PRUDENTIAL','0804941-36.2025.8.19.0209','BRZ Advogados','Em andamento',null,'Embagos à execução · BURINI','MEDIA BRIDGE','seed'),
  ('[CÍVEL] EXECUÇÃO DE TÍTULO EXTRAJUDICIAL — PK PRODUÇÕES','0822519-12.2025.8.19.0209','CH.Teixeira Advogados','Em andamento',null,'Citação · R$ 47.117,09.','MEDIA BRIDGE','seed'),
  ('[CÍVEL] EXECUÇÃO DE TÍTULO EXTRAJUDICIAL — AD AGÊNCIA DE VIAGENS','4001024-15.2025.8.26.0100','CH.Teixeira Advogados','Em andamento',null,'Citação · R$ 188.074,63','MEDIA BRIDGE','seed'),
  ('[ANCINE] TOMADA DE CONTAS ESPECIAL - CAPTADO R$ 3.000.000,00 — TCU/ANCINE','018.700/2024-1','Dra. Rosana','Em andamento',null,'Processo encaminhado de volta à ANCINE para análise financeira','MEDIA BRIDGE (PC INTERVENÇÃO)','seed'),
  ('[ANCINE] PRESTAÇÃO DE CONTAS - CAPTADO R$ 300.000,00 — ANCINE','0416.001244/2019-17','Dra. Rosana','Em andamento',null,'Recurso interposto na ANCINE','MEDIA BRIDGE (PC RDB)','seed'),
  ('[ANCINE] PRESTAÇÃO DE CONTAS - CAPTADO R$ 1.200.000,00 — ANCINE','01580.043473/2015-75','Dra. Rosana','Em andamento',null,'Prestação de Contas Projeto Não aprendi dizer adeus','MEDIA BRIDGE (PC NADA)','seed'),
  ('[ANCINE] PRESTAÇÃO DE CONTAS - CAPTADO R$ 2.000.000,00 — ANCINE','01416.021323/2017-74','Dra. Rosana','Em andamento',null,'Prestação de Contas Projeto Casagrande','MEDIA BRIDGE (PC CASAGRANDE)','seed'),
  ('[ANCINE] PRESTAÇÃO DE CONTAS - CAPTADO R$ 2.000.000,00 — ANCINE','01416.021311/2017-40','Dra. Rosana','Em andamento',null,'Prestação de Contas Projeto Chacrinha - eu vim p/ confundir não p/explicar','MEDIA BRIDGE (PC CHACRINHA - EU VIM)','seed'),
  ('[ANCINE] PRESTAÇÃO DE CONTAS - CAPTADO R$ 3.280.000,00 — ANCINE','01416.027431/2017-51','Dra. Rosana','Em andamento',null,'Prestação de Contas Projeto Chacrinha - o velho guerreiro','MEDIA BRIDGE (PC CHACRINHA - O VELHO G.)','seed'),
  ('[ANCINE] PRESTAÇÃO DE CONTAS - CAPTADO R$ 1.240.072,06 — ANCINE','01580.040561/2015-15','Dra. Rosana','Em andamento',null,'Prestação de Contas Projeto A Cerca','MEDIA BRIDGE (PC - A CERCA)','seed'),
  ('[ANCINE] PRESTAÇÃO DE CONTAS - CAPTADO R$ 200.000,00 — ANCINE','01580.062985/2015-31','Dra. Rosana','Em andamento',null,'Prestação de Contas Projeto Chacrinha','MEDIA BRIDGE (PC CHACRINHA - DESEN.)','seed'),
  ('[ANCINE] PRESTAÇÃO DE CONTAS - CAPTADO - R$ 2.792.762,50 — ANCINE','01416.000742/2016-91','Dra. Rosana','Em andamento',null,'Prestação de Contas projeto A vida sexual da mulher feia','MEDIA BRIDGE (ASMF)','seed'),
  ('[ANCINE] CUMPRIMENTO DE OBJETO - CAPTADO R$ 250.000,00 — RIOFILME','RIOFILME','Dra. Rosana','Em andamento',null,'Cumprimento do objeto','MEDIA BRIDGE (BARRO E ASFALTO)','seed'),
  ('[BANCO] EXECUÇÃO DE TÍTULO EXTRAJUDICIAL — BANCO DAYCOVAL','1024991-77.2024.8.26.0100','Dra. Nathália','Em andamento',null,'Resultado parcial do bloqueio de valores. Aguardando julgamento dos Embargos à Execução','AGREGA','seed'),
  ('[BANCO] EXECUÇÃO DE TÍTULO EXTRAJUDICIAL — BANCO ITAU','0930734-61.2024.8.19.0001','Dr. Wesley','Em andamento',null,'Acordo - Confissão de dívida','AGREGA','seed'),
  ('[BANCO] AÇÃO MONITÓRIA - 618.067,37 — CAIXA ECONÔNICA FEDERAL','5054834-19.2025.4.02.5101','CH.Teixeira Advogados','Em andamento',null,'Aguardando mandado de citação nos autos','DIGITAL MEDIA BRIDGE','seed'),
  ('[BANCO] EXECUÇÃO DE TÍTULO EXTRAJUDICIAL - 258.983,07 - MÁQUINA — SICOOB','0817984-40.2025.8.19.0209','CH.Teixeira Advogados','Em andamento',null,'Aguardando mandado de citação nos autos','NEW WAVE MEDIA PRODUCOES','seed'),
  ('[BANCO] EXECUÇÃO DE TÍTULO EXTRAJUDICAL - 186.480,23 — CAIXA ECONÔNICA FEDERAL','5073452-12.2025.4.02.5101','CH.Teixeira Advogados','Em andamento',null,'Aguardando mandado de citação nos autos','PMTB','seed'),
  ('[BANCO] EXECUÇÃO DE TÍTULO EXTRAJUDICAL - 436.487,08 — CAIXA ECONÔNICA FEDERAL','5085194-34.2025.4.02.5101','CH.Teixeira Advogados','Em andamento',null,'Bloqueio conta bancária','MEDIA BRIDGE','seed'),
  ('[BANCO] EXECUÇÃO DE TÍRULO EXTRAJUDICIAL - 1.059.893,77 — CAIXA ECONÔNICA FEDERAL','5132267-02.2025.4.02.5101','CH.Teixeira Advogados','Em andamento',null,'Aguardando mandado de citação','PMTB','seed'),
  ('[TRIBUTÁRIO] EXECUÇÃO FISCAL — FAZENDA NACIONAL','5059076-21.2025.4.02.5101','Dr. Wesley','Em andamento',null,'Defesa advogado · R$ 102.061,07','MEDIA BRIDGE','seed'),
  ('[TRIBUTÁRIO] EXECUÇÃO FISCAL — FAZENDA NACIONAL','5036751-86.2024.4.02.5101','Dr. Wesley','Em andamento',null,'Defesa advogado · R$ 569.818,42','AGREGA','seed'),
  ('[TRIBUTÁRIO] EXECUÇÃO FISCAL — FAZENDA NACIONAL','5045773-37.2025.4.02.5101','Dr. Wesley','Em andamento',null,'Defesa advogado · R$ 1.260.270,50','AGREGA','seed'),
  ('[TRIBUTÁRIO] EXECUÇÃO FISCAL — FAZENDA NACIONAL','5048966-60.2025.4.02.5101','Dr. Wesley','Em andamento',null,'Defesa advogado · R$ 121.469,50','AGREGA','seed'),
  ('[TRIBUTÁRIO] EXECUÇÃO FISCAL — FAZENDA NACIONAL','5059057-15.2025.4.02.5101','Dr. Wesley','Em andamento',null,'Defesa advogado · R$ 189.317,50','AGREGA','seed'),
  ('[TRIBUTÁRIO] EXECUÇÃO FISCAL — FAZENDA NACIONAL','5067129-88.2025.4.02.5101','Dr. Wesley','Em andamento',null,'Defesa advogado · R$ 310.276,50','AGREGA','seed'),
  ('[TRIBUTÁRIO] EXECUÇÃO FISCAL — ESTADO DO RIO GRANDE DO SUL','5031904-56.2021.8.21.0001','Dr. Wesley','Em andamento',null,'Defesa advogado · R$ 932.116,50','AGREGA','seed')
on conflict do nothing;
