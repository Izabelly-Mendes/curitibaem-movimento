-- Execute no Supabase Dashboard > SQL Editor
-- https://supabase.com/dashboard/project/uocnikcoynoflxgcknii/sql/new

CREATE TABLE IF NOT EXISTS corretores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email text UNIQUE NOT NULL,
  senha_hash text NOT NULL,
  ativo boolean DEFAULT true,
  criado_em timestamp DEFAULT now(),
  atualizado_em timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS acessos_corretores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corretor_id uuid REFERENCES corretores(id) ON DELETE CASCADE,
  entrou_em timestamp DEFAULT now(),
  saiu_em timestamp,
  duracao_minutos integer,
  ip text,
  user_agent text
);

ALTER TABLE corretores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_corretores" ON corretores FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE acessos_corretores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_acessos" ON acessos_corretores FOR ALL USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON corretores TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON acessos_corretores TO anon;
GRANT USAGE ON SCHEMA public TO anon;
