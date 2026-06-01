// ═══════════════════════════════════════════════════════════════
// api/curadoria.js — Curadoria automática semanal (terças 09h Brasília)
// Vercel Serverless Function + Cron Job
//
// Variáveis de ambiente (Vercel → Settings → Environment Variables):
//   RESEND_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY
// ═══════════════════════════════════════════════════════════════

const resendKey   = process.env.RESEND_API_KEY;
const supabaseUrl = process.env.SUPABASE_URL  || 'https://uocnikcoynoflxgcknii.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_nWEHxISod-7kWfXptMj6Ow_RQU6hsf2';
const EMAIL_DEST  = 'izabelly@adiferencial.com.br';
const BASE_URL    = 'https://curitibaem-movimento.vercel.app';
const TOKEN       = 'bicalho2025';

// ── Fontes de busca ──
const FONTES = [
  { url: 'https://www.curitiba.pr.gov.br/noticias',      tema: 'geral' },
  { url: 'https://turismo.curitiba.pr.gov.br',           tema: 'turismo' },
  { url: 'https://www.curitibacvb.com.br',               tema: 'congresso' },
  { url: 'https://www.sehapr.com.br',                    tema: 'hotelaria' },
  { url: 'https://diariodoturismo.com.br/?s=curitiba',   tema: 'turismo' },
  { url: 'https://www.curitiba.pr.gov.br/cultura',       tema: 'eventos' },
  { url: 'https://atleticoparanaense.com',               tema: 'esportivo' },
];

// ── Definição dos 8 tópicos com keywords ──
const TOPICOS = {
  eventos: {
    label: 'Eventos e Shows',
    keywords: ['show','concert','espetáculo','festival','evento','teatro','anitta','madonna','twenty one','olivia','beyoncé','taylor','luan','zé neto','confirmado para','confirmados para','pedro sampaio','jorge mateus','henrique e julianos','henrique julianos'],
    items: []
  },
  esportivo: {
    label: 'Eventos Esportivos',
    keywords: ['arena da baixada','atletico','athletico','copa','campeonato','libertadores','sul-americana','final','semifinal','internacional','partida','futebol','jogo em curitiba','paranaense'],
    items: []
  },
  congresso: {
    label: 'Congressos e Eventos Corporativos',
    keywords: ['congresso','convenção','feira','ccvb','mice','captou','captação','corporate','corporativo','convenções','centro de eventos','expotrade','viasoft'],
    items: []
  },
  hotelaria: {
    label: 'Hotelaria',
    keywords: ['ocupação','hotel','hospedagem','seha','diária média','taxa de ocupação','pernoite','rede hoteleira','RevPAR'],
    items: []
  },
  aeroporto: {
    label: 'Aeroporto',
    keywords: ['aeroporto','afonso pena','passageiro','rota','voo','decolagem','pouso','companhia aérea','tap','gol','latam','azul','aviação'],
    items: []
  },
  turismo: {
    label: 'Turismo',
    keywords: ['turismo','turista','visitante','imt','curitibatur','lonely planet','destino','reconhecimento','premiação','linha turismo','embarque','embarques'],
    items: []
  },
  imobiliario: {
    label: 'Mercado Imobiliário',
    keywords: ['imóvel','imobiliário','airbnb','short stay','aluguel','valorização','m²','metro quadrado','lançamento','studio','incorporadora','bicalho'],
    items: []
  },
  comparativo: {
    label: 'Comparativos de Dados',
    keywords: ['crescimento de','aumento de','alta de','cresceu','aumentou','subiu','% em relação','% vs','% a mais','% acima','recorde','histórico','supera','superou'],
    items: []
  }
};

// ── Busca e extrai texto de uma URL ──
async function fetchTexto(fonte) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(fonte.url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'CuritibaEmMovimento/2.0 (+' + BASE_URL + ')' }
    });
    clearTimeout(timer);
    if (!res.ok) return { ...fonte, texto: '' };
    const html = await res.text();
    const texto = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 12000);
    return { ...fonte, texto };
  } catch(e) {
    return { ...fonte, texto: '' };
  }
}

// ── Classifica sentenças por tópico ──
function classificar(textos) {
  // Reset
  Object.values(TOPICOS).forEach(t => { t.items = []; });

  for (const { url, texto, tema: temaPrimario } of textos) {
    if (!texto) continue;
    const frases = texto.match(/[^.!?]{40,350}[.!?]/g) || [];

    for (const frase of frases) {
      const f = frase.trim().toLowerCase();

      // Tenta classificar por tema primário da fonte primeiro
      let alocado = false;
      for (const [slug, cfg] of Object.entries(TOPICOS)) {
        if (alocado) break;
        const matchPrimario = temaPrimario === slug;
        const matchKeyword  = cfg.keywords.some(kw => f.includes(kw));
        const relevante     = f.includes('curitiba') || f.includes('paraná') || f.includes('afonso pena') || matchPrimario;
        if (matchKeyword && relevante && cfg.items.length < 5) {
          cfg.items.push({ texto: frase.trim(), fonte: url });
          alocado = true;
        }
      }
    }
  }

  // Filtra tópicos com ≥ 1 item
  return Object.entries(TOPICOS)
    .filter(([, cfg]) => cfg.items.length > 0)
    .map(([slug, cfg]) => ({ slug, label: cfg.label, items: cfg.items }));
}

// ── Monta itens individuais para salvar no Supabase ──
function montarItens(topicos) {
  const resultado = [];
  for (const topico of topicos) {
    for (const item of topico.items) {
      const fonteDomain = (() => { try { return new URL(item.fonte).hostname; } catch(e) { return item.fonte; } })();
      const titulo = gerarTitulo(item.texto, topico.label);
      const conteudo = `<p style="font-size:13.5px;line-height:1.7">${item.texto}</p><p style="font-size:11px;color:#aaa;margin-top:8px">Fonte: <a href="${item.fonte}" target="_blank" style="color:#FF6B00">${fonteDomain}</a></p>`;
      resultado.push({ titulo, conteudo, tema: topico.slug });
    }
  }
  return resultado;
}

function gerarTitulo(texto, label) {
  // Usa as primeiras 80 chars do texto como título aproximado
  const limpo = texto.replace(/<[^>]*>/g,'').trim();
  return limpo.length > 80 ? limpo.substring(0, 77) + '...' : limpo;
}

// ── Salva itens individuais no Supabase ──
async function salvarItens(itens) {
  const salvos = [];
  for (const item of itens) {
    const body = JSON.stringify({
      titulo: item.titulo,
      conteudo: item.conteudo,
      tema: item.tema,
      status: 'pendente'
    });
    const res = await fetch(`${supabaseUrl}/rest/v1/rascunhos_curadoria`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=representation'
      },
      body
    });
    if (res.ok) {
      const [salvo] = await res.json();
      salvos.push(salvo);
    }
  }
  return salvos;
}

// ── Gera e-mail HTML com cards individuais e botões aprovar/rejeitar ──
function gerarEmail(topicos, itensSalvos, dataStr) {
  const CORES = {
    eventos:'#e74c3c', esportivo:'#2ecc71', congresso:'#3498db',
    hotelaria:'#9b59b6', aeroporto:'#1abc9c', turismo:'#f39c12',
    imobiliario:'#e67e22', comparativo:'#2c3e50'
  };

  const cardsHtml = itensSalvos.map(item => {
    const cor = CORES[item.tema] || '#FF6B00';
    const aprovUrl = `${BASE_URL}/api/aprovar?id=${item.id}&token=${TOKEN}`;
    const rejUrl   = `${BASE_URL}/api/rejeitar?id=${item.id}&token=${TOKEN}`;
    return `
      <div style="background:#fff;border-radius:12px;border:0.5px solid #e8e8e8;padding:20px 24px;margin-bottom:14px">
        <span style="font-size:9px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${cor};background:${cor}18;padding:3px 8px;border-radius:20px">${TOPICOS[item.tema]?.label || item.tema}</span>
        <div style="font-size:15px;font-weight:700;color:#1a1a1a;margin:10px 0 8px;line-height:1.3">${item.titulo}</div>
        <div style="font-size:13px;color:#555;line-height:1.65">${item.conteudo}</div>
        <div style="margin-top:14px;display:flex;gap:8px">
          <a href="${aprovUrl}" style="display:inline-block;background:#FF6B00;color:#fff;text-decoration:none;padding:8px 18px;border-radius:8px;font-size:13px;font-weight:700">✓ Aprovar</a>
          <a href="${rejUrl}"   style="display:inline-block;background:#f5f5f0;color:#555;text-decoration:none;padding:8px 18px;border-radius:8px;font-size:13px;border:0.5px solid #ddd">✕ Rejeitar</a>
        </div>
      </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:'Helvetica Neue',Arial,sans-serif">
<div style="max-width:660px;margin:0 auto">
  <div style="background:#1a1a1a;padding:32px 40px;border-radius:0 0 16px 16px;margin-bottom:24px">
    <div style="font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#FF6B00;margin-bottom:8px">CURITIBA EM MOVIMENTO</div>
    <div style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#fff;margin-bottom:6px">Curadoria Semanal — ${dataStr}</div>
    <div style="font-size:13px;color:rgba(255,255,255,0.4)">${itensSalvos.length} item${itensSalvos.length !== 1 ? 's' : ''} para revisão · Aprove ou rejeite cada um individualmente</div>
  </div>
  <div style="padding:0 24px">${cardsHtml}</div>
  <div style="padding:24px 24px 32px">
    <a href="${BASE_URL}/admin.html" style="display:inline-block;background:#333;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:700">✏️ Ver todos no painel admin</a>
  </div>
  <div style="background:#1a1a1a;padding:16px 24px;text-align:center">
    <p style="font-size:11px;color:rgba(255,255,255,0.3);margin:0">Curitiba em Movimento · Bicalho Imóveis × Diferencial</p>
  </div>
</div>
</body></html>`;
}

// ── Envia e-mail via Resend ──
async function enviarEmail(assunto, html) {
  if (!resendKey) throw new Error('RESEND_API_KEY não configurada');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${resendKey}` },
    body: JSON.stringify({
      from: 'Curitiba em Movimento <onboarding@resend.dev>',
      to: [EMAIL_DEST],
      subject: assunto,
      html
    })
  });
  if (!res.ok) throw new Error('Resend: ' + await res.text());
  return res.json();
}

// ── HANDLER PRINCIPAL ──
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const isTest = req.query?.test === 'true';
  const dataStr = new Date().toLocaleDateString('pt-BR',{ weekday:'long', year:'numeric', month:'long', day:'numeric' });

  console.log(`[curadoria] Iniciando${isTest ? ' (TESTE)' : ''} — ${dataStr}`);

  try {
    // 1. Busca conteúdo das fontes
    console.log('[curadoria] Buscando fontes...');
    const textos = await Promise.all(FONTES.map(fetchTexto));
    const validos = textos.filter(t => t.texto.length > 80);
    console.log(`[curadoria] ${validos.length}/${FONTES.length} fontes com conteúdo`);

    // 2. Classifica por tópico
    const topicos = classificar(validos);
    const totalItens = topicos.reduce((acc, t) => acc + t.items.length, 0);
    console.log(`[curadoria] ${topicos.length} tópicos, ${totalItens} itens encontrados`);

    if (totalItens === 0) {
      console.log('[curadoria] Nenhum item encontrado');
      return res.status(200).json({ ok: true, itens: 0, msg: 'Nenhum item encontrado nesta semana' });
    }

    // 3. Monta itens individuais
    const itens = montarItens(topicos);

    // 4. Salva cada item separado no Supabase
    const salvos = await salvarItens(itens);
    console.log(`[curadoria] ${salvos.length} itens salvos no Supabase`);

    // 5. Envia e-mail com cards individuais
    let emailOk = false;
    try {
      const html = gerarEmail(topicos, salvos, dataStr);
      await enviarEmail(`📊 Curadoria de terça — ${salvos.length} novidades · ${new Date().toLocaleDateString('pt-BR')}`, html);
      emailOk = true;
      console.log('[curadoria] E-mail enviado');
    } catch(e) {
      console.error('[curadoria] Erro no e-mail:', e.message);
    }

    return res.status(200).json({
      ok: true,
      itens: salvos.length,
      topicos: topicos.map(t => ({ label: t.label, count: t.items.length })),
      email: emailOk ? 'enviado' : 'falhou',
      data: dataStr
    });

  } catch(err) {
    console.error('[curadoria] Erro geral:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
