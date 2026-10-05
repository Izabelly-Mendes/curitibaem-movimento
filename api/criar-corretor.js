// api/criar-corretor.js — Gestor cadastra um corretor novo (Fase 1 / ADR 0001 / Bloco C)
//
// POST, com:
//   Authorization: Bearer <JWT do gestor autenticado>
//   body JSON: { nome, email, whatsapp }
//
// NAO envia convite nem e-mail nenhum — a criacao da conta e o disparo
// do convite sao, de propósito, acoes separadas (o convite so acontece
// numa etapa futura, com autorizacao explicita).
//
// REGRA: a SUPABASE_SERVICE_ROLE_KEY so existe aqui, como variavel de
// ambiente do servidor. Nunca aparece em nenhum arquivo versionado, nunca
// vai para o navegador.
//
// ATENCAO: este endpoint cria uma conta REAL no Supabase Auth quando
// chamado. NAO deve ser invocado contra nenhum e-mail real antes da
// autorizacao explicita do Bloco D. Nao foi executado nem testado em
// runtime nesta etapa (Bloco C) — ver docs/testes/bloco-c-*.md para o
// que foi e nao foi validado.

const supabaseUrl = process.env.SUPABASE_URL || 'https://uocnikcoynoflxgcknii.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_nWEHxISod-7kWfXptMj6Ow_RQU6hsf2';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!serviceRoleKey) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY nao configurada no ambiente.' });
  }

  const authHeader = req.headers['authorization'] || '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) return res.status(401).json({ error: 'Token ausente.' });

  try {
    // 1) Identifica quem esta chamando, validando o JWT dele contra o
    //    proprio Supabase Auth (nao confiamos em nada vindo do corpo
    //    da requisicao para decidir quem e o chamador).
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${jwt}` }
    });
    if (!userRes.ok) return res.status(401).json({ error: 'Sessao invalida.' });
    const caller = await userRes.json();

    // 2) Confirma que quem chama e gestor ativo. Usa service_role (ignora
    //    RLS de proposito, pois este e o contexto confiavel server-side
    //    que a propria RLS foi desenhada para delegar).
    const perfilRes = await fetch(`${supabaseUrl}/rest/v1/perfis?id=eq.${caller.id}&select=role,ativo`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` }
    });
    const perfisChamador = await perfilRes.json();
    const perfilChamador = Array.isArray(perfisChamador) ? perfisChamador[0] : null;
    if (!perfilChamador || !perfilChamador.ativo || perfilChamador.role !== 'gestor') {
      return res.status(403).json({ error: 'Apenas um gestor ativo pode cadastrar corretores.' });
    }

    // 3) Valida entrada
    const { nome, email, whatsapp } = req.body || {};
    if (!nome || !email) {
      return res.status(400).json({ error: 'Nome e email sao obrigatorios.' });
    }

    // 4) Fase 1 (ver docs/migrations/migracao-corretores-preparada.md):
    //    cria a conta no Supabase Auth. Sem senha, sem convite — o
    //    gatilho criar_perfil_no_signup ja cria a linha base em perfis
    //    (role='corretor', ativo=true, sempre fixos).
    const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, email_confirm: true, user_metadata: { nome } })
    });
    const novoUsuario = await createRes.json();
    if (!createRes.ok) {
      return res.status(createRes.status).json({ error: novoUsuario.msg || novoUsuario.error_description || 'Erro ao criar usuario.' });
    }

    // 5) Fase 2: completa o perfil com os campos que o gatilho nao
    //    preenche (whatsapp, portal_token gerado na hora — e um
    //    corretor novo, nao uma migracao, entao nao ha token antigo a
    //    preservar).
    const portalToken = Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    const updateRes = await fetch(`${supabaseUrl}/rest/v1/perfis?id=eq.${novoUsuario.id}`, {
      method: 'PATCH',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify({ whatsapp: whatsapp || null, portal_token: portalToken })
    });
    const perfilAtualizado = await updateRes.json();
    const perfilFinal = Array.isArray(perfilAtualizado) ? perfilAtualizado[0] : perfilAtualizado;

    return res.status(200).json({ ok: true, perfil: perfilFinal });

  } catch (err) {
    console.error('[criar-corretor] erro:', err);
    return res.status(500).json({ error: err.message });
  }
}
