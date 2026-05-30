-- ═══════════════════════════════════════════════════════════
-- CURITIBA EM MOVIMENTO — Setup do banco de dados Supabase
-- Execute este arquivo no Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════

-- 1. Extensão para UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Tabela: blocos_conteudo
CREATE TABLE IF NOT EXISTS blocos_conteudo (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo        text,
  conteudo      text,
  tipo          text CHECK (tipo IN ('kpi','card','insight','noticia','evento')),
  visivel_cliente boolean DEFAULT true,
  ordem         integer DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- 3. Tabela: empreendimentos
CREATE TABLE IF NOT EXISTS empreendimentos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome              text,
  slug              text UNIQUE,
  percentual_obra   integer DEFAULT 0,
  descricao         text,
  foto_url          text,
  proximas_etapas   text,
  comunicados       text,
  ativo             boolean DEFAULT true,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- 4. Tabela: clientes
CREATE TABLE IF NOT EXISTS clientes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                  text,
  email                 text,
  token                 text UNIQUE,
  empreendimentos_ids   text[],
  created_at            timestamptz DEFAULT now()
);

-- 5. Tabela: rascunhos_curadoria
CREATE TABLE IF NOT EXISTS rascunhos_curadoria (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo     text,
  conteudo   text,
  status     text DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','rejeitado')),
  created_at timestamptz DEFAULT now()
);

-- 6. Tabela: config_visual (editor visual do portal)
CREATE TABLE IF NOT EXISTS config_visual (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cor_principal   text DEFAULT '#FF6B00',
  cor_fundo       text DEFAULT '#f5f5f0',
  cor_header      text DEFAULT '#1a1a1a',
  fonte_titulo    text DEFAULT 'Syne',
  fonte_corpo     text DEFAULT 'DM Sans',
  tamanho_fonte   integer DEFAULT 14,
  updated_at      timestamptz DEFAULT now()
);

-- Inserir config padrão
INSERT INTO config_visual (cor_principal, cor_fundo, cor_header, fonte_titulo, fonte_corpo, tamanho_fonte)
VALUES ('#FF6B00', '#f5f5f0', '#1a1a1a', 'Syne', 'DM Sans', 14)
ON CONFLICT DO NOTHING;

-- 7. Inserir os 6 empreendimentos iniciais
INSERT INTO empreendimentos (nome, slug, percentual_obra, descricao, ativo) VALUES
  ('Yatch Tower',       'yatch-tower',      0,  '', true),
  ('Legacy Tower',      'legacy-tower',     0,  '', true),
  ('Infinity Tower',    'infinity-tower',   0,  '', true),
  ('Vértice Barigui',   'vertice-barigui',  0,  '', true),
  ('Sette Batel',       'sette-batel',      0,  '', true),
  ('Quattri Home & Spa','quattri-home-spa', 0,  '', true)
ON CONFLICT (slug) DO NOTHING;

-- 8. RLS — habilitar e criar políticas abertas (anon key lê e escreve)
ALTER TABLE blocos_conteudo    ENABLE ROW LEVEL SECURITY;
ALTER TABLE empreendimentos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE rascunhos_curadoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_visual      ENABLE ROW LEVEL SECURITY;

-- Políticas de leitura pública (anon)
CREATE POLICY "anon_read_blocos"     ON blocos_conteudo     FOR SELECT USING (true);
CREATE POLICY "anon_read_emp"        ON empreendimentos     FOR SELECT USING (true);
CREATE POLICY "anon_read_clientes"   ON clientes            FOR SELECT USING (true);
CREATE POLICY "anon_read_rascunhos"  ON rascunhos_curadoria FOR SELECT USING (true);
CREATE POLICY "anon_read_config"     ON config_visual       FOR SELECT USING (true);

-- Políticas de escrita pública (anon) — admin protegido por senha no frontend
CREATE POLICY "anon_insert_blocos"    ON blocos_conteudo    FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_blocos"    ON blocos_conteudo    FOR UPDATE USING (true);
CREATE POLICY "anon_delete_blocos"    ON blocos_conteudo    FOR DELETE USING (true);

CREATE POLICY "anon_insert_emp"       ON empreendimentos    FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_emp"       ON empreendimentos    FOR UPDATE USING (true);
CREATE POLICY "anon_delete_emp"       ON empreendimentos    FOR DELETE USING (true);

CREATE POLICY "anon_insert_clientes"  ON clientes           FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_clientes"  ON clientes           FOR UPDATE USING (true);
CREATE POLICY "anon_delete_clientes"  ON clientes           FOR DELETE USING (true);

CREATE POLICY "anon_insert_rascunhos" ON rascunhos_curadoria FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_rascunhos" ON rascunhos_curadoria FOR UPDATE USING (true);
CREATE POLICY "anon_delete_rascunhos" ON rascunhos_curadoria FOR DELETE USING (true);

CREATE POLICY "anon_insert_config"    ON config_visual       FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_config"    ON config_visual       FOR UPDATE USING (true);

-- Concluído ✓
SELECT 'Setup concluído com sucesso!' AS status;
