-- ═══════════════════════════════════════════════════════════
-- Fase 1 / ADR 0001 — Etapa 2
-- Cria is_gestor(), o gatilho de protecao de campos sensiveis de
-- perfis (role/ativo) e o trigger que o aciona. Nenhuma policy de
-- RLS e criada nesta etapa — perfis continua fechada.
-- Nenhum usuario (real ou de teste) e criado nesta etapa.
--
-- PENDENCIA REGISTRADA: o teste comportamental completo do trigger
-- (ver docs/decisions/0001-autenticacao-usuarios-roles.md e o
-- relatorio da Etapa 2) exige ao menos um usuario de teste
-- autenticado, por causa da FK perfis.id -> auth.users.id. Fica para
-- a proxima etapa apropriada, com usuario(s) de teste controlados.
-- ═══════════════════════════════════════════════════════════

begin;

-- 1) is_gestor(): verdadeiro se o usuario autenticado agora e gestor ativo
create or replace function is_gestor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from perfis
    where id = auth.uid() and role = 'gestor' and ativo = true
  );
$$;

revoke all on function is_gestor() from public;
grant execute on function is_gestor() to anon, authenticated;

-- 2) Gatilho de protecao de role/ativo
create or replace function proteger_campos_sensiveis_perfis()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- Regra A: so gestor muda role ou ativo (de qualquer um, inclusive si mesmo)
  if new.role is distinct from old.role or new.ativo is distinct from old.ativo then
    if not is_gestor() then
      raise exception 'Apenas um gestor pode alterar role ou status ativo de um usuario.';
    end if;
  end if;

  -- Regra B: ninguem desativa a propria conta, nem um gestor
  if old.ativo = true and new.ativo = false and auth.uid() = old.id then
    raise exception 'Voce nao pode desativar a propria conta.';
  end if;

  -- Regra C: sempre precisa sobrar ao menos 1 gestor ativo
  if old.role = 'gestor' and old.ativo = true
     and (new.ativo = false or new.role <> 'gestor') then
    if not exists (
      select 1 from perfis
      where role = 'gestor' and ativo = true and id <> old.id
    ) then
      raise exception 'O sistema precisa manter pelo menos um gestor ativo.';
    end if;
  end if;

  new.atualizado_em := now();
  return new;
end;
$$;

revoke all on function proteger_campos_sensiveis_perfis() from public;

create trigger trg_proteger_campos_sensiveis_perfis
  before update on perfis
  for each row
  execute function proteger_campos_sensiveis_perfis();

commit;
