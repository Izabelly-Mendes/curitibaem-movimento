-- ═══════════════════════════════════════════════════════════
-- Fase 1 / ADR 0001 — Etapa 1
-- Cria app_role + perfis. Aditivo. RLS habilitada imediatamente
-- apos a criacao, SEM nenhuma policy ainda — a tabela nasce
-- fechada para qualquer acesso via API publica (anon/authenticated),
-- independente de GRANTs existentes ou privilegios padrao do schema.
-- Nenhum trigger, nenhum usuario, nenhuma migracao de dados,
-- nenhum HTML/JS alterado nesta etapa.
-- ═══════════════════════════════════════════════════════════

begin;

create type app_role as enum ('corretor', 'gestor');

create table perfis (
  id                      uuid primary key references auth.users(id) on delete cascade,
  nome                    text not null,
  whatsapp                text,
  portal_token            text unique,
  role                    app_role not null default 'corretor',
  ativo                   boolean not null default true,
  criado_em               timestamptz not null default now(),
  atualizado_em           timestamptz not null default now(),
  migrado_de_corretor_id  uuid references corretores(id)
);

comment on table perfis is
  'Perfil de autenticacao (Fase 1 / ADR 0001). 1:1 com auth.users. '
  'RLS habilitada sem policies: fechada por padrao ate a etapa seguinte '
  'definir explicitamente as permissoes.';

alter table perfis enable row level security;

commit;
