// ═══════════════════════════════════════════════════════════════
// api/curadoria.js — Curadoria automática semanal
// Vercel Serverless Function — roda toda quarta-feira às 9h (UTC)
//
// Variáveis de ambiente necessárias (Vercel → Settings → Env Vars):
//   RESEND_API_KEY    — chave secreta do Resend
//   SUPABASE_URL      — URL do projeto Supabase
//   SUPABASE_ANON_KEY — chave anon do Supabase
// ═══════════════════════════════════════════════════════════════

const resendKey  = process.env.RESEND_API_KEY;
const supabaseUrl = process.env.SUPABASE_URL || 'https://uocnikcoynoflxgcknii.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_nWEHxISod-7kWfXptMj6Ow_RQU6hsf2';
const EMAIL_DEST  = 'izabelly@adiferencial.com.br';

// Fontes a rastrear por tema
const FONTES = [
  { url: 'https://www.curitiba.pr.gov.br/noticias',   tema: 'geral' },
  { url: 'https://turismo.curitiba.pr.gov.br',        tema: 'turismo' },
  { url: 'https://www.curitibacvb.com.br',            tema: 'turismo' },
  { url: 'https://www.sehapr.com.br',                 tema: 'hotelaria' },
  { url: 'https://diariodoturismo.com.br/?s=curitiba',tema: 'turismo' },
];

// ── Busca e extrai texto de uma URL ──
async function fetchTexto(url) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'CuritibaEmMovimento/1.0 (+https://curitibaem-movimento.vercel.app)' }
    });
    clearTimeout(timer);
    if (!res.ok) return { url, texto: '', erro: `HTTP ${res.status}` };
    const html = await res.text();
    // Remove scripts, styles, tags HTML
    const texto = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 8000);
    return { url, texto };
  } catch (e) {
    return { url, texto: '', erro: e.message };
  }
}

// ── Extrai frases relevantes por tema ──
function extrairPorTema(textos) {
  const temas = {
    'Eventos e Shows': {
      keywords: ['evento','show','concert','espetáculo','festival','congresso','feira','exposição'],
      frases: []
    },
    'Hotelaria': {
      keywords: ['hotel','ocupação hoteleira','hospedagem','resort','pousada','diária'],
      frases: []
    },
    'Aeroporto': {
      keywords: ['aeroporto','afonso pena','passageiro','rota aérea','voo','companhia aérea','embarque'],
      frases: []
    },
    'Turismo': {
      keywords: ['turismo','turista','visitante','atrativo','destino turístico','curitibatur'],
      frases: []
    },
    'Mercado Imobiliário': {
      keywords: ['imóvel','imobiliário','airbnb','short stay','aluguel','valorização','lançamento'],
      frases: []
    },
    'Outras Novidades': {
      keywords: ['curitiba','infraestrutura','mobilidade','economia','desenvolvimento'],
      frases: []
    }
  };

  for (const { url, texto } of textos) {
    if (!texto) continue;
    // Divide em frases
    const frases = texto.match(/[^.!?]+[.!?]/g) || [];
    for (const frase of frases) {
      const f = frase.trim().toLowerCase();
      if (f.length < 40 || f.length > 300) continue;
      // Tenta classificar a frase
      let classificada = false;
      for (const [tema, cfg] of Object.entries(temas)) {
        if (tema === 'Outras Novidades') continue;
        if (cfg.keywords.some(kw => f.includes(kw))) {
          if (cfg.frases.length < 4) {
            cfg.frases.push({ texto: frase.trim(), fonte: url });
          }
          classificada = true;
          break;
        }
      }
      if (!classificada && temas['Outras Novidades'].frases.length < 4) {
        const temCuritiba = f.includes('curitiba') || f.includes('paraná');
        if (temCuritiba) {
          temas['Outras Novidades'].frases.push({ texto: frase.trim(), fonte: url });
        }
      }
    }
  }

  return temas;
}

// ── Gera HTML do e-mail ──
function gerarEmailHtml(temas, dataStr) {
  const topicosHtml = Object.entries(temas)
    .filter(([, cfg]) => cfg.frases.length > 0)
    .map(([tema, cfg]) => {
      const fontesUnicas = [...new Set(cfg.frases.map(f => f.fonte))];
      const frasesHtml = cfg.frases.map(f =>
        `<p style="font-size:14px;color:#444;line-height:1.7;margin:0 0 8px">${f.texto}</p>`
      ).join('');
      const fontesHtml = fontesUnicas.map(f =>
        `<a href="${f}" style="font-size:11px;color:#999;text-decoration:none;display:inline-block;margin-right:12px;margin-top:4px">🔗 ${new URL(f).hostname}</a>`
      ).join('');
      return `
        <div style="background:#fff;border-radius:12px;border:0.5px solid #e8e8e8;padding:20px 24px;margin-bottom:16px">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;color:#FF6B00;margin-bottom:8px">${tema}</div>
          ${frasesHtml}
          <div style="margin-top:10px;padding-top:10px;border-top:0.5px solid #f5f5f5">${fontesHtml}</div>
        </div>`;
    }).join('');

  // Preview de card — como ficará no portal do cliente
  const previewItems = Object.entries(temas)
    .filter(([,c]) => c.frases.length > 0)
    .slice(0, 3)
    .map(([tema, cfg]) => `
      <div style="background:#fff;border-radius:10px;border:0.5px solid #e0ddd5;padding:16px 18px;margin-bottom:10px">
        <span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#FF6B00">${tema}</span>
        <div style="font-size:14px;font-weight:700;color:#1a1a1a;margin:6px 0 8px;font-family:Georgia,serif">${tema}</div>
        <p style="font-size:13px;color:#555;line-height:1.65;margin:0">${cfg.frases[0]?.texto||''}</p>
      </div>`).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:640px;margin:0 auto">

    <!-- Header -->
    <div style="background:#1a1a1a;padding:32px 40px;border-radius:0 0 16px 16px;margin-bottom:24px">
      <div style="font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#FF6B00;margin-bottom:8px">CURITIBA EM MOVIMENTO</div>
      <div style="font-family:Georgia,serif;font-size:24px;font-weight:700;color:#fff;margin-bottom:6px">Curadoria Semanal</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.4)">${dataStr}</div>
    </div>

    <!-- Intro -->
    <div style="padding:0 24px;margin-bottom:20px">
      <p style="font-size:14px;color:#555;line-height:1.7;margin:0">
        Olá Izabelly! Aqui está o resumo das novidades de Curitiba desta semana,
        separado por tema para facilitar a revisão. Aprove para publicar diretamente no portal dos clientes.
      </p>
    </div>

    <!-- Tópicos -->
    <div style="padding:0 24px">${topicosHtml}</div>

    <!-- Preview portal -->
    <div style="padding:0 24px;margin-top:24px;margin-bottom:24px">
      <div style="background:#1a1a1a;border-radius:12px;padding:20px 24px;margin-bottom:16px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;color:#FF6B00;margin-bottom:12px">📱 Preview — Como ficará no portal do cliente</div>
        ${previewItems}
      </div>
    </div>

    <!-- Botões de ação -->
    <div style="padding:0 24px 32px;display:flex;gap:12px;flex-wrap:wrap">
      <a href="https://curitibaem-movimento.vercel.app/admin.html#rascunhos"
         style="display:inline-block;background:#FF6B00;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:15px">
        ✓ Ver e aprovar no painel
      </a>
      <a href="https://curitibaem-movimento.vercel.app/admin.html"
         style="display:inline-block;background:#333;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:15px">
        ✏️ Editar antes de publicar
      </a>
    </div>

    <!-- Footer -->
    <div style="background:#1a1a1a;padding:16px 24px;text-align:center">
      <p style="font-size:11px;color:rgba(255,255,255,0.3);margin:0">
        Curitiba em Movimento · Bicalho Imóveis × Diferencial · Curadoria automática semanal
      </p>
    </div>
  </div>
</body>
</html>`;
}

// ── Gera conteúdo HTML do rascunho (para salvar no Supabase) ──
function gerarConteudoRascunho(temas) {
  return Object.entries(temas)
    .filter(([, cfg]) => cfg.frases.length > 0)
    .map(([tema, cfg]) => {
      const frasesHtml = cfg.frases.map(f => `<p>${f.texto}</p>`).join('');
      const fontesUnicas = [...new Set(cfg.frases.map(f => f.fonte))];
      const fontesHtml = fontesUnicas.map(f =>
        `<a href="${f}" target="_blank">${new URL(f).hostname}</a>`
      ).join(' · ');
      return `<h3 style="color:#FF6B00">${tema}</h3>${frasesHtml}<p><small>Fontes: ${fontesHtml}</small></p>`;
    }).join('<hr>');
}

// ── Salva rascunho no Supabase ──
async function salvarRascunho(titulo, conteudo) {
  const res = await fetch(`${supabaseUrl}/rest/v1/rascunhos_curadoria`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ titulo, conteudo, status: 'pendente' })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase error: ${err}`);
  }
}

// ── Envia e-mail via Resend ──
async function enviarEmail(assunto, html) {
  if (!resendKey) throw new Error('RESEND_API_KEY não configurada');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${resendKey}`
    },
    body: JSON.stringify({
      from: 'Curitiba em Movimento <onboarding@resend.dev>',
      to: [EMAIL_DEST],
      subject: assunto,
      html
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error: ${err}`);
  }
  return res.json();
}

// ── HANDLER PRINCIPAL ──
export default async function handler(req, res) {
  // Aceita GET (cron) ou POST (trigger manual)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const dataStr = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const semana = new Date().toLocaleDateString('pt-BR');

  console.log(`[curadoria] Iniciando curadoria semanal — ${dataStr}`);

  try {
    // 1. Busca conteúdo das fontes
    console.log('[curadoria] Buscando fontes...');
    const textos = await Promise.all(FONTES.map(f => fetchTexto(f.url)));
    const comConteudo = textos.filter(t => t.texto.length > 100);
    console.log(`[curadoria] ${comConteudo.length}/${FONTES.length} fontes com conteúdo`);

    // 2. Classifica por tema
    const temas = extrairPorTema(comConteudo);
    const temasComConteudo = Object.values(temas).filter(c => c.frases.length > 0).length;
    console.log(`[curadoria] ${temasComConteudo} temas com conteúdo`);

    // 3. Gera conteúdo
    const titulo = `Curadoria Semanal Curitiba em Movimento — ${semana}`;
    const conteudoRascunho = gerarConteudoRascunho(temas);
    const emailHtml = gerarEmailHtml(temas, dataStr);

    // 4. Salva rascunho no Supabase
    await salvarRascunho(titulo, conteudoRascunho);
    console.log('[curadoria] Rascunho salvo no Supabase');

    // 5. Envia e-mail
    let emailResult;
    try {
      emailResult = await enviarEmail(`📊 ${titulo}`, emailHtml);
      console.log('[curadoria] E-mail enviado:', emailResult?.id);
    } catch (emailErr) {
      console.error('[curadoria] Erro ao enviar e-mail:', emailErr.message);
      // Não falha a função se o e-mail não enviar
      emailResult = { erro: emailErr.message };
    }

    return res.status(200).json({
      ok: true,
      rascunho: 'salvo',
      temas: temasComConteudo,
      email: emailResult?.id ? 'enviado' : 'erro',
      data: dataStr
    });

  } catch (err) {
    console.error('[curadoria] Erro:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
