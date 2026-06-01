// api/aprovar.js — Aprova item de curadoria via link do e-mail
// GET /api/aprovar?id=UUID&token=bicalho2025

const supabaseUrl = process.env.SUPABASE_URL  || 'https://uocnikcoynoflxgcknii.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_nWEHxISod-7kWfXptMj6Ow_RQU6hsf2';
const TOKEN_VALIDO = 'bicalho2025';

export default async function handler(req, res) {
  const { id, token } = req.query || {};

  if (token !== TOKEN_VALIDO) {
    return res.status(403).send(paginaHtml('❌ Acesso negado', 'Token inválido.', '#e74c3c'));
  }
  if (!id) {
    return res.status(400).send(paginaHtml('❌ Erro', 'ID não informado.', '#e74c3c'));
  }

  try {
    const r = await fetch(`${supabaseUrl}/rest/v1/rascunhos_curadoria?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ status: 'aprovado' })
    });

    if (!r.ok) throw new Error('Supabase: ' + await r.text());
    return res.status(200).send(paginaHtml(
      '✓ Item aprovado',
      'O item foi aprovado e aparecerá no portal do cliente como "Novidades da semana".',
      '#27ae60'
    ));
  } catch(e) {
    return res.status(500).send(paginaHtml('❌ Erro', e.message, '#e74c3c'));
  }
}

function paginaHtml(titulo, msg, cor) {
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titulo}</title></head>
<body style="font-family:'Helvetica Neue',Arial,sans-serif;background:#f5f5f0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
  <div style="background:#fff;border-radius:16px;padding:40px 48px;text-align:center;max-width:480px;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="font-size:48px;margin-bottom:16px">${cor === '#27ae60' ? '✅' : '❌'}</div>
    <h2 style="font-size:20px;color:#1a1a1a;margin-bottom:10px">${titulo}</h2>
    <p style="font-size:14px;color:#888;line-height:1.6;margin-bottom:24px">${msg}</p>
    <a href="https://curitibaem-movimento.vercel.app/admin.html"
       style="display:inline-block;background:#FF6B00;color:#fff;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:700">
      Ir para o painel admin
    </a>
  </div>
</body></html>`;
}
