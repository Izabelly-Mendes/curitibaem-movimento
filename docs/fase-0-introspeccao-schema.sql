-- ═══════════════════════════════════════════════════════════
-- FASE 0 — Introspecção do schema real (SOMENTE LEITURA)
-- Rode cada bloco separadamente no Supabase Dashboard → SQL Editor
-- e cole o resultado de volta na conversa.
-- Nenhum ALTER / INSERT / UPDATE / DELETE / DROP é executado aqui.
-- Nenhuma linha de dado real (email, senha, nome) é lida — apenas
-- metadados de estrutura do schema 'public'.
-- ═══════════════════════════════════════════════════════════

-- 1) TABELAS, COLUNAS, TIPOS, DEFAULT, NULLABLE
SELECT table_name, ordinal_position, column_name, data_type,
       character_maximum_length, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- 2) PRIMARY KEYS, FOREIGN KEYS, UNIQUE CONSTRAINTS
SELECT tc.table_name, tc.constraint_type, tc.constraint_name,
       kcu.column_name, ccu.table_name AS referenced_table,
       ccu.column_name AS referenced_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
WHERE tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_type;

-- 3) ÍNDICES
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 4) QUAIS TABELAS TÊM RLS HABILITADA
SELECT relname AS table_name, relrowsecurity AS rls_enabled, relforcerowsecurity AS rls_forced
FROM pg_class
WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'
ORDER BY relname;

-- 5) POLICIES RLS (definição completa de cada policy)
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 6) FUNÇÕES / RPCs expostas no schema public (inclui qualquer função
--    de execução de SQL arbitrário, se existir — ponto crítico a confirmar)
SELECT routine_name, routine_type, data_type AS return_type, security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- 7) PERMISSÕES concedidas aos papéis anon / authenticated por tabela
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee IN ('anon','authenticated')
ORDER BY table_name, grantee, privilege_type;

-- 8) TRIGGERS
SELECT event_object_table AS table_name, trigger_name, action_timing, event_manipulation, action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY table_name, trigger_name;

-- 9) PUBLICAÇÕES REALTIME (quais tabelas estão com Realtime ativado)
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';

-- ═══════════════════════════════════════════════════════════
-- 10) INVESTIGAÇÃO DO POSSÍVEL RPC DE SQL ARBITRÁRIO
-- Objetivo: confirmar existência, ver a definição completa, e ver
-- EXATAMENTE quem pode executar. NUNCA executa a função em si —
-- só lê seus metadados (nome, código-fonte, dono, permissões).
-- ═══════════════════════════════════════════════════════════

-- 10a) Existe alguma função com nome "sql", "exec_sql", "query" ou
--      similar, exposta via PostgREST (schema public)? Mostra a
--      DEFINIÇÃO COMPLETA do código-fonte de cada uma encontrada.
SELECT
  n.nspname AS schema,
  p.proname AS function_name,
  pg_get_functiondef(p.oid) AS definicao_completa,
  CASE p.prosecdef WHEN true THEN 'SECURITY DEFINER (roda com privilégio do dono — atenção)'
                    ELSE 'SECURITY INVOKER (roda com privilégio de quem chama)' END AS modo_seguranca,
  pg_get_userbyid(p.proowner) AS dono_da_funcao
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (
    p.proname ILIKE '%sql%'
    OR p.proname ILIKE '%exec%'
    OR p.proname ILIKE '%query%'
    OR p.proname ILIKE '%run%'
  )
ORDER BY p.proname;

-- 10b) Para TODAS as funções do schema public (não só as suspeitas
--      acima): quem tem permissão de EXECUTE, explicitamente concedida.
SELECT routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
ORDER BY routine_name, grantee;

-- 10c) Permissão efetiva via ACL do Postgres (captura também o
--      privilégio padrão a PUBLIC quando ninguém revogou EXECUTE —
--      isto é o que information_schema pode não deixar óbvio).
--      Se "anon" ou "public" aparecer aqui com 'X' (execute) para
--      uma função de SQL arbitrário, é prova concreta de que
--      qualquer pessoa com a anon key consegue rodar SQL livre.
SELECT
  n.nspname AS schema,
  p.proname AS function_name,
  (aclexplode(p.proacl)).grantee::regrole::text AS grantee,
  (aclexplode(p.proacl)).privilege_type
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proacl IS NOT NULL
ORDER BY p.proname;

-- 10d) Se 10c vier vazio para alguma função (proacl NULL = nenhuma
--      ACL customizada), o padrão do Postgres é EXECUTE liberado
--      para PUBLIC automaticamente. Esta consulta sinaliza isso:
SELECT p.proname AS function_name,
       (p.proacl IS NULL) AS acl_customizada_ausente,
       CASE WHEN p.proacl IS NULL
            THEN 'ACL padrão do Postgres: EXECUTE liberado para PUBLIC (inclui anon via PostgREST), a menos que REVOKE tenha sido feito'
            ELSE 'ACL customizada presente — ver resultado da consulta 10c'
       END AS interpretacao
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname;
