-- ═══════════════════════════════════════════════════════════
-- Execute no Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════

-- 1. Adicionar coluna slug (se não existir)
ALTER TABLE blocos_conteudo ADD COLUMN IF NOT EXISTS slug text;

-- 2. Ativar Realtime nas tabelas
ALTER PUBLICATION supabase_realtime ADD TABLE blocos_conteudo;
ALTER PUBLICATION supabase_realtime ADD TABLE rascunhos_curadoria;

-- 3. Limpar conteúdo existente (execute só na primeira vez)
-- DELETE FROM blocos_conteudo;

-- 4. Verificar estrutura
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'blocos_conteudo'
ORDER BY ordinal_position;

SELECT 'Realtime ativado com sucesso!' AS status;
