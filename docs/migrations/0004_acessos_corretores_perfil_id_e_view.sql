-- ═══════════════════════════════════════════════════════════
-- Fase 1 / ADR 0001 — Bloco B
-- Adiciona acessos_corretores.perfil_id (nullable, aditivo) e cria
-- a view consolidada de historico. corretor_id NAO e tocado - todo
-- historico existente permanece exatamente como esta.
--
-- ATENCAO DE SEGURANCA (achado durante a implementacao, nao estava
-- no desenho original por escrito, mas nao muda a estrategia -
-- apenas corrige como implementa-la com seguranca):
-- Por padrao, uma view no Postgres avalia RLS das tabelas de origem
-- com o contexto do DONO da view (postgres, que ignora RLS como
-- dono/owner), nao de quem consulta a view. Sem a opcao abaixo,
-- QUALQUER usuario autenticado que consultasse esta view enxergaria
-- o historico de TODOS os corretores, nao so o proprio - um furo de
-- seguranca por fora da RLS cuidadosamente desenhada nas tabelas.
-- 'security_invoker = true' (Postgres 15+) corrige isso, fazendo a
-- view respeitar a RLS de quem a consulta, nao a do dono.
-- ═══════════════════════════════════════════════════════════

begin;

alter table acessos_corretores
  add column if not exists perfil_id uuid references perfis(id);

create index if not exists idx_acessos_corretores_perfil_id
  on acessos_corretores(perfil_id);

create view acessos_corretores_consolidado
with (security_invoker = true)
as
select
  a.id,
  a.entrou_em,
  a.saiu_em,
  a.duracao_minutos,
  coalesce(p.nome, c.nome)                              as nome_corretor,
  case when a.perfil_id is not null then 'novo' else 'historico' end as origem,
  coalesce(a.perfil_id::text, a.corretor_id::text)       as origem_id
from acessos_corretores a
left join perfis     p on p.id = a.perfil_id
left join corretores c on c.id = a.corretor_id;

grant select on acessos_corretores_consolidado to authenticated;

commit;
