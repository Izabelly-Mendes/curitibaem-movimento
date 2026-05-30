-- ═══════════════════════════════════════════════════════════
-- PASSO 1: Políticas RLS (Row Level Security)
-- Execute este arquivo em: supabase.com → SQL Editor
-- ═══════════════════════════════════════════════════════════

-- blocos_conteudo
ALTER TABLE blocos_conteudo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_public_read"   ON blocos_conteudo;
DROP POLICY IF EXISTS "allow_public_insert" ON blocos_conteudo;
DROP POLICY IF EXISTS "allow_public_update" ON blocos_conteudo;
DROP POLICY IF EXISTS "allow_public_delete" ON blocos_conteudo;
CREATE POLICY "allow_public_read"   ON blocos_conteudo FOR SELECT USING (true);
CREATE POLICY "allow_public_insert" ON blocos_conteudo FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_public_update" ON blocos_conteudo FOR UPDATE USING (true);
CREATE POLICY "allow_public_delete" ON blocos_conteudo FOR DELETE USING (true);

-- rascunhos_curadoria
ALTER TABLE rascunhos_curadoria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_public_read_rascunhos"   ON rascunhos_curadoria;
DROP POLICY IF EXISTS "allow_public_insert_rascunhos" ON rascunhos_curadoria;
DROP POLICY IF EXISTS "allow_public_update_rascunhos" ON rascunhos_curadoria;
DROP POLICY IF EXISTS "allow_public_delete_rascunhos" ON rascunhos_curadoria;
CREATE POLICY "allow_public_read_rascunhos"   ON rascunhos_curadoria FOR SELECT USING (true);
CREATE POLICY "allow_public_insert_rascunhos" ON rascunhos_curadoria FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_public_update_rascunhos" ON rascunhos_curadoria FOR UPDATE USING (true);
CREATE POLICY "allow_public_delete_rascunhos" ON rascunhos_curadoria FOR DELETE USING (true);

-- config_visual
ALTER TABLE config_visual ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_public_config" ON config_visual;
CREATE POLICY "allow_public_config" ON config_visual FOR ALL USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════
-- PASSO 2: Conteúdo inicial — blocos extraídos do index.html
-- ═══════════════════════════════════════════════════════════

INSERT INTO blocos_conteudo (titulo, conteudo, tipo, visivel_cliente, ordem) VALUES

(
  'Lonely Planet: Top 10 cidades do mundo para visitar em 2025',
  '<p>🏆 <strong>Única cidade brasileira</strong> na lista do guia de viagens mais respeitado do mundo.</p><p style="margin-top:8px;font-size:13px;color:#888">Lonely Planet · Best in Travel 2025</p>',
  'card', true, 1
),

(
  'Fluxo Turístico 2024 — Visão Geral',
  '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-bottom:12px">
    <div style="background:#1a1a1a;border-radius:10px;padding:14px;text-align:center"><div style="font-size:26px;font-weight:700;color:#FF6B00">10M</div><div style="font-size:11px;color:rgba(255,255,255,0.5)">visitantes totais em 2024</div></div>
    <div style="background:#fff;border:0.5px solid #e0ddd5;border-radius:10px;padding:14px;text-align:center"><div style="font-size:26px;font-weight:700;color:#1a1a1a">8,2<span style="color:#FF6B00">M</span></div><div style="font-size:11px;color:#888">turistas com pernoite</div></div>
    <div style="background:#fff;border:0.5px solid #e0ddd5;border-radius:10px;padding:14px;text-align:center"><div style="font-size:26px;font-weight:700;color:#1a1a1a">+3<span style="color:#FF6B00">M</span></div><div style="font-size:11px;color:#888">turistas esperados 2025</div></div>
  </div>
  <p style="font-size:13.5px;color:#555">Em dezembro de 2024 sozinho, Curitiba recebeu quase <strong>400 mil visitantes</strong> — volume que supera o ano inteiro de vários destinos brasileiros. Fonte: Prefeitura de Curitiba / IMT.</p>',
  'kpi', true, 2
),

(
  'Pela primeira vez, lazer superou negócios',
  '<p style="font-size:13.5px;color:#555;margin-bottom:14px">Em 2024 ocorreu uma virada inédita: as viagens por <span style="color:#FF6B00;font-weight:700">lazer passaram a ser a principal motivação</span>, superando o turismo corporativo que historicamente dominava a cidade.</p>
  <div style="margin-bottom:8px;display:flex;align-items:center;gap:10px"><span style="font-size:12px;color:#555;width:80px;flex-shrink:0">Lazer</span><div style="flex:1;height:6px;background:#f0ede6;border-radius:6px;overflow:hidden"><div style="width:66%;height:100%;background:#FF6B00;border-radius:6px"></div></div><span style="font-size:12px;font-weight:700;color:#1a1a1a;width:40px;text-align:right">33,3%</span></div>
  <div style="display:flex;align-items:center;gap:10px"><span style="font-size:12px;color:#555;width:80px;flex-shrink:0">Negócios</span><div style="flex:1;height:6px;background:#f0ede6;border-radius:6px;overflow:hidden"><div style="width:47%;height:100%;background:#ccc;border-radius:6px"></div></div><span style="font-size:12px;font-weight:700;color:#1a1a1a;width:40px;text-align:right">24%</span></div>
  <p style="font-size:11px;color:#bbb;margin-top:8px">Fonte: IMT</p>',
  'card', true, 3
),

(
  'Linha Turismo: quase 1 milhão de embarques em 2025',
  '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
    <div style="background:#fff;border:0.5px solid #e0ddd5;border-radius:10px;padding:14px"><div style="font-size:24px;font-weight:700">908<span style="color:#FF6B00">mil</span></div><div style="font-size:11px;color:#888">embarques na Linha Turismo em 2025</div></div>
    <div style="background:#fff;border:0.5px solid #e0ddd5;border-radius:10px;padding:14px"><div style="font-size:24px;font-weight:700">+<span style="color:#FF6B00">13,6%</span></div><div style="font-size:11px;color:#888">crescimento vs. 2024</div></div>
  </div>
  <p style="font-size:13.5px;color:#555">Quase <strong>1 milhão de pessoas</strong> circulando pelos 26 pontos turísticos da cidade ao longo do ano. A Linha Turismo é o indicador mais direto do turista que veio para conhecer Curitiba, não para trabalhar. Fonte: SEHA / Prefeitura de Curitiba.</p>',
  'kpi', true, 4
),

(
  'Natal de Curitiba 2025 — Recordes históricos',
  '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px">
    <div style="background:#fff;border:0.5px solid #e0ddd5;border-radius:10px;padding:12px;text-align:center"><div style="font-size:22px;font-weight:700">3,09<span style="color:#FF6B00">M</span></div><div style="font-size:10px;color:#888">espectadores</div><div style="font-size:10px;color:#aaa">+35% vs. 2024</div></div>
    <div style="background:#1a1a1a;border-radius:10px;padding:12px;text-align:center"><div style="font-size:22px;font-weight:700;color:#FF6B00">R$722M</div><div style="font-size:10px;color:rgba(255,255,255,0.5)">impacto econômico</div><div style="font-size:10px;color:rgba(255,255,255,0.3)">+80% vs. 2024</div></div>
    <div style="background:#fff;border:0.5px solid #e0ddd5;border-radius:10px;padding:12px;text-align:center"><div style="font-size:22px;font-weight:700">469<span style="color:#FF6B00">mil</span></div><div style="font-size:10px;color:#888">turistas no período</div><div style="font-size:10px;color:#aaa">+60% vs. 2024</div></div>
  </div>
  <p style="font-size:13.5px;color:#555"><strong>44 dias de programação</strong> com mais de <strong>150 atrações gratuitas</strong>, incluindo parceria inédita com a Disney no Parque Barigui. Taxa de ocupação dos hotéis: <strong>90%</strong>, chegando a <strong>100%</strong> nas áreas centrais. Tempo médio de permanência: <strong>4,1 pernoites</strong>. Fonte: Prefeitura de Curitiba / IMT.</p>',
  'kpi', true, 5
),

(
  'Eventos e Shows: Curitiba como polo nacional',
  '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
    <div style="background:#fff;border:0.5px solid #e0ddd5;border-radius:10px;padding:12px;text-align:center"><div style="font-size:22px;font-weight:700;color:#FF6B00">140</div><div style="font-size:10px;color:#888">eventos em 2024 (congressos, feiras, técnico-científicos)</div></div>
    <div style="background:#fff;border:0.5px solid #e0ddd5;border-radius:10px;padding:12px;text-align:center"><div style="font-size:22px;font-weight:700;color:#FF6B00">85</div><div style="font-size:10px;color:#888">eventos jan–ago 2025</div></div>
    <div style="background:#1a1a1a;border-radius:10px;padding:12px;text-align:center"><div style="font-size:22px;font-weight:700;color:#FF6B00">+40</div><div style="font-size:10px;color:rgba(255,255,255,0.5)">shows internacionais confirmados 2026</div></div>
  </div>
  <p style="font-size:13.5px;color:#555">A cidade reduziu o ISS de <strong>5% para 2%</strong> para shows e eventos, tornando-a diretamente mais atrativa para grandes turnês. Em março de 2025, uma semana com Festival de Teatro, Smart City Expo, Olivia Rodrigo e Expo Turismo simultâneos resultou em <strong>100% de ocupação</strong> hoteleira. Fonte: CCVB / Prefeitura de Curitiba.</p>',
  'evento', true, 6
),

(
  'Curitiba como polo de congressos médicos e turismo estético',
  '<p style="font-size:13.5px;color:#555;margin-bottom:10px">Curitiba está entre os <strong>cinco maiores polos de turismo médico do Brasil</strong>. Mais de 50% dos eventos captados pelo CCVB pertencem à área da saúde.</p>
  <p style="font-size:13.5px;color:#555;margin-bottom:10px">Os 3 maiores congressos de 2025: <strong>CBMI</strong> (Medicina Intensiva, 3 mil participantes), <strong>SBCCV</strong> (Cirurgia Cardiovascular) e <strong>CBR</strong> (Radiologia, 4 mil profissionais).</p>
  <div style="background:rgba(255,107,0,0.06);border-left:3px solid #FF6B00;border-radius:0 8px 8px 0;padding:12px 14px;font-size:13px;color:#c85200">Cada congresso médico de grande porte gera entre 3 e 5 pernoites por participante. Um evento com 3 mil pessoas representa até <strong>15 mil diárias</strong> concentradas em poucos dias.</div>',
  'card', true, 7
),

(
  'Hotelaria: ocupação e crescimento',
  '<p style="font-size:13.5px;color:#555;margin-bottom:12px">Curitiba registra <strong>ocupação média de 65–70%</strong> ao longo do ano, com picos acima de <strong>90%</strong> durante eventos de grande porte. A demanda por short stay (Airbnb) cresce como complemento à rede hoteleira, especialmente durante congressos e shows. Fonte: SEHA-PR.</p>
  <div style="background:rgba(255,107,0,0.06);border-left:3px solid #FF6B00;border-radius:0 8px 8px 0;padding:12px 14px;font-size:13px;color:#c85200">O participante de evento corporativo fica em média <strong>3 noites</strong> e tem ticket de hospedagem <strong>40% mais alto</strong> que o turista de lazer.</div>',
  'insight', true, 8
),

(
  'Aeroporto Afonso Pena: crescimento de 56% em 3 anos',
  '<p style="font-size:13.5px;color:#555;margin-bottom:12px">O Aeroporto Internacional Afonso Pena <strong>superou 6 milhões de passageiros</strong> em 2025 e cresceu <strong>56% em três anos</strong>. Somente no 1º trimestre de 2026: <strong>mais de 1,4 milhão de passageiros</strong>. Novas rotas domésticas e internacionais foram abertas, aumentando a conectividade da cidade. Fonte: Diário do Turismo / CBN Curitiba.</p>',
  'kpi', true, 9
),

(
  'Mercado Imobiliário: valorização por bairro em 2025',
  '<p style="font-size:13.5px;color:#555;margin-bottom:12px">Destaques de valorização em 2025 (Fonte: Loft, dez/2025):</p>
  <ul style="list-style:none;padding:0;display:flex;flex-direction:column;gap:6px">
    <li style="font-size:13px;color:#555"><span style="color:#FF6B00;font-weight:700">›</span> <strong>Centro:</strong> +48% no preço/m², chegando a R$ 10.250/m²</li>
    <li style="font-size:13px;color:#555"><span style="color:#FF6B00;font-weight:700">›</span> <strong>Água Verde:</strong> +33% no tíquete médio, chegando a R$ 1,3 milhão</li>
    <li style="font-size:13px;color:#555"><span style="color:#FF6B00;font-weight:700">›</span> <strong>Batel:</strong> R$ 16.240/m² — metro quadrado mais valorizado de Curitiba</li>
    <li style="font-size:13px;color:#555"><span style="color:#FF6B00;font-weight:700">›</span> <strong>Bigorrilho:</strong> +23% no tíquete médio, +31% no preço/m²</li>
  </ul>
  <div style="background:rgba(255,107,0,0.06);border-left:3px solid #FF6B00;border-radius:0 8px 8px 0;padding:12px 14px;margin-top:12px;font-size:13px;color:#c85200">Um studio nessas regiões tem dois motores simultâneos: <strong>valorização patrimonial acima da média</strong> e <strong>renda de short stay consistente</strong> ao longo de todos os meses do ano.</div>',
  'card', true, 10
),

(
  'Airbnb em Curitiba: dados de mercado',
  '<p style="font-size:13.5px;color:#555;margin-bottom:12px">Curitiba se consolidou como um dos mercados de short stay mais estáveis do Brasil:</p>
  <ul style="list-style:none;padding:0;display:flex;flex-direction:column;gap:6px">
    <li style="font-size:13px;color:#555"><span style="color:#FF6B00;font-weight:700">›</span> Diárias no <strong>Bigorrilho</strong>: de R$ 107 a R$ 247 por noite (studios)</li>
    <li style="font-size:13px;color:#555"><span style="color:#FF6B00;font-weight:700">›</span> Eixo <strong>Centro/Batel</strong>: maiores diárias e maior taxa de ocupação da cidade</li>
    <li style="font-size:13px;color:#555"><span style="color:#FF6B00;font-weight:700">›</span> Crescimento de locações de curta duração durante shows e eventos: comprovado por dados da Band Paraná</li>
    <li style="font-size:13px;color:#555"><span style="color:#FF6B00;font-weight:700">›</span> Brasil é o 2º país do mundo em cirurgias plásticas — turistas estéticos demandam 7–14 dias de hospedagem</li>
  </ul>
  <p style="font-size:11px;color:#aaa;margin-top:10px">Fontes: Airbtics, Airbnb Curitiba; XV Curitiba; Band Paraná</p>',
  'card', true, 11
);

SELECT 'Conteúdo inserido com sucesso! Total de blocos: ' || COUNT(*) AS status FROM blocos_conteudo;
