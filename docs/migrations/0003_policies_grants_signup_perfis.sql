-- ═══════════════════════════════════════════════════════════
-- Fase 1 / ADR 0001 — Bloco A
-- Policies definitivas de perfis, GRANTs minimos necessarios, e o
-- gatilho de auto-criacao de perfil no signup.
--
-- GARANTIA DE SEGURANCA (ver adendo ao ADR 0001): o gatilho abaixo
-- NUNCA le 'role' ou 'ativo' de raw_user_meta_data ou de qualquer
-- dado controlado pelo usuario. Os dois campos sao sempre hardcoded.
-- 'nome' pode vir de metadata (campo de conveniencia, nao de
-- autorizacao) com fallback seguro.
--
-- anon continua SEM nenhum GRANT em perfis.
-- ═══════════════════════════════════════════════════════════

begin;

-- 1) Policies definitivas
create policy "perfis_select_proprio_ou_gestor" on perfis
  for select
  using (id = auth.uid() or is_gestor());

create policy "perfis_update_proprio_ou_gestor" on perfis
  for update
  using (id = auth.uid() or is_gestor())
  with check (id = auth.uid() or is_gestor());

-- Sem policy de INSERT (so o trigger de signup escreve, via security
-- definer, contornando RLS de forma controlada).
-- Sem policy de DELETE (desativar via 'ativo', nunca apagar).

-- 2) GRANTs minimos (tabela criada como 'postgres' nao concede
-- select/insert/update a 'authenticated' por padrao - confirmado na
-- Etapa 1 via pg_default_acl)
grant select, update on perfis to authenticated;
-- anon: nenhum GRANT. Mantido assim conforme decisao do Bloco A.

-- 3) Gatilho de auto-criacao de perfil no signup
create or replace function criar_perfil_no_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfis (id, nome, role, ativo)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1)),
    'corretor',  -- SEMPRE fixo, nunca lido de metadata/payload
    true         -- SEMPRE fixo, nunca lido de metadata/payload
  );
  return new;
end;
$$;

revoke all on function criar_perfil_no_signup() from public;

create trigger trg_criar_perfil_no_signup
  after insert on auth.users
  for each row
  execute function criar_perfil_no_signup();

commit;
