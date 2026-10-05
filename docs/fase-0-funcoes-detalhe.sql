-- FASE 0 — detalhe das 2 funções encontradas em public (somente leitura)
SELECT
  n.nspname AS schema,
  p.proname AS function_name,
  pg_get_functiondef(p.oid) AS definicao_completa,
  CASE p.prosecdef WHEN true THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS modo_seguranca,
  pg_get_userbyid(p.proowner) AS dono_da_funcao
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('enforce_usuario_update_rules', 'handle_new_auth_user')
ORDER BY p.proname;

-- Em quais tabelas/eventos cada uma está amarrada como trigger (se for o caso)
SELECT event_object_schema, event_object_table, trigger_name, action_timing,
       event_manipulation, action_statement
FROM information_schema.triggers
WHERE action_statement ILIKE '%enforce_usuario_update_rules%'
   OR action_statement ILIKE '%handle_new_auth_user%';

-- Se handle_new_auth_user for trigger em auth.users, essa tabela confirma
-- se o Supabase Auth tem usuários cadastrados (só a CONTAGEM, não os dados)
SELECT count(*) AS total_usuarios_auth FROM auth.users;
