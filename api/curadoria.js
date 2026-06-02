// ═══════════════════════════════════════════════════════════════
// api/curadoria.js — Curadoria semanal via RSS (terças 09h BRT)
// Teste imediato: GET /api/curadoria?test=true
// Env: RESEND_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY
// ═══════════════════════════════════════════════════════════════

const resendKey   = process.env.RESEND_API_KEY;
const supabaseUrl = process.env.SUPABASE_URL  || 'https://uocnikcoynoflxgcknii.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_nWEHxISod-7kWfXptMj6Ow_RQU6hsf2';
const EMAIL_DEST  = 'izabelly@adiferencial.com.br';
const BASE_URL    = 'https://curitibaem-movimento.vercel.app';
const TOKEN       = 'bicalho2025';
const MAX_ITENS   = 8;

// ── Fontes RSS ──
const FONTES_RSS = [
  { url: 'https://turismo.curitiba.pr.gov.br/feed',          nome: 'IMT Curitiba',        tema: 'turismo'   },
  { url: 'https://www.curitiba.pr.gov.br/rss/noticias',      nome: 'Prefeitura Curitiba', tema: 'turismo'   },
  { url: 'https://diariodoturismo.com.br/feed',              nome: 'Diário do Turismo',   tema: 'turismo'   },
  { url: 'https://www.bemparana.com.br/feed',                nome: 'Bem Paraná',          tema: 'turismo'   },
  { url: 'https://www.parana.pr.gov.br/aen/rss',             nome: 'Governo do Paraná',   tema: 'turismo'   },
];

// ── Tópicos ──
const TOPICOS = {
  eventos:     { label: 'Eventos e Shows',           keywords: ['show','espetáculo','festival','teatro','turnê','anitta','madonna','twenty one','olivia','beyoncé','taylor','luan','zé neto','pedro sampaio','guns n','linkin park','katy perry'] },
  esportivo:   { label: 'Eventos Esportivos',         keywords: ['arena da baixada','atletico','athletico','copa','libertadores','sul-americana','final','semifinal','futebol'] },
  congresso:   { label: 'Congressos & Corp.',          keywords: ['congresso','convenção','feira','ccvb','mice','captação','corporate','expotrade','viasoft','centro de eventos'] },
  hotelaria:   { label: 'Hotelaria',                   keywords: ['ocupação','hotel','hospedagem','seha','diária','taxa de ocupação','pernoite','rede hoteleira','abih'] },
  aeroporto:   { label: 'Aeroporto',                   keywords: ['aeroporto','afonso pena','passageiro','rota aérea','voo','decolagem','tap','gol','latam','azul'] },
  turismo:     { label: 'Turismo',                     keywords: ['turismo','turista','visitante','imt','curitibatur','lonely planet','destino','reconhecimento','linha turismo','embarque','natal de curitiba'] },
  imobiliario: { label: 'Mercado Imobiliário',          keywords: ['imóvel','imobiliário','airbnb','short stay','long stay','valorização','m²','metro quadrado','lançamento','studio','aluguel'] },
  comparativo: { label: 'Comparativos de Dados',        keywords: ['cresceu','aumentou','% em relação','% vs','% a mais','recorde','histórico','supera','superou','crescimento de','alta de'] },
};

// ── Palavras que tornam relevante (pelo menos 1) ──
const RELEVANTE = [
  'curitiba','paraná','paranaense','turismo','turista','visitante',
  'hotel','hospedagem','ocupação','aeroporto','afonso pena','passageiro',
  'evento','show','festival','congresso','feira','airbnb','short stay',
  'locação','imóvel','imobiliário','apartamento','investimento','valorização',
  'linha turismo','natal de curitiba','arena da baixada',
];

// ── Palavras que descartam imediatamente ──
const DESCARTAR = [
  'senha','wordpress','login','lotofácil','mega-sena','resultado da loteria',
  'acidente','capotou','crime','assalto','roubo','homicídio',
  'pandemia','covid','2020','2021',
  'novela','famoso','horóscopo','recuperar senha',
  'bariloche','reino unido','roma','itália',
];

// ── Parse RSS/XML sem biblioteca ──
function parseRSS(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const raw = m[1];
    const get = (tag) => {
      const r = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i');
      const match = raw.match(r);
      return match ? match[1].trim() : '';
    };
    const titulo    = get('title');
    const link      = get('link') || get('guid');
    const descricao = get('description') || get('content:encoded') || get('summary');
    const pubDate   = get('pubDate') || get('dc:date') || get('published');
    if (titulo) items.push({ titulo, link, descricao, pubDate });
  }
  return items;
}

// ── Limpa HTML e metadados do texto ──
function limparTexto(texto) {
  if (!texto) return '';
  return texto
    .replace(/<!\[CDATA\[/g,'').replace(/\]\]>/g,'')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#\d+;/g,' ')
    .replace(/https?:\/\/\S+/g,'')            // remove URLs soltos
    .replace(/[\w.-]+@[\w.-]+\.\w+/g,'')      // remove e-mails
    .replace(/[A-Z][a-z]+ [A-Z][a-z]+\s*[-–]\s*/g,'') // remove "Nome Sobrenome - "
    .replace(/\b\d{1,2}\s+de\s+\w+\s+de\s+\d{4}\b/g,'')
    .replace(/\b\w+\s+\d{1,2},\s+\d{4}\b/g,'')
    .replace(/Conteúdo de marca\s*/gi,'')
    .replace(/Publicidade\s*/gi,'')
    .replace(/\s{2,}/g,' ')
    .trim();
}

// ── Limpa e normaliza título ──
function limparTitulo(titulo) {
  if (!titulo) return '';
  titulo = limparTexto(titulo);
  titulo = titulo.replace(/^(curitiba\s+)?conteúdo de marca\s+/i,'');
  titulo = titulo.replace(/\s*[|–—]\s*.*$/,'');
  titulo = titulo.replace(/\.\.\.$|\.$/, '');
  titulo = titulo.trim();
  if (!titulo) return '';
  return titulo.charAt(0).toUpperCase() + titulo.slice(1);
}

// ── Gera 2-3 frases do conteúdo com dados ──
function formatarConteudo(descricao, tituloLimpo) {
  const texto = limparTexto(descricao);
  const frases = texto.match(/[^.!?\n]{50,400}[.!?]/g) || [];
  const comDados = frases.filter(f => temDadoConcreto(f));
  const selecionadas = comDados.length >= 2
    ? comDados.slice(0, 3)
    : frases.filter(f => f.length > 80).slice(0, 3);
  if (!selecionadas.length) return '';
  let resultado = selecionadas.map(f => f.trim()).join(' ');
  if (!resultado.endsWith('.')) resultado += '.';
  return resultado;
}

// ── Tem dado concreto ──
function temDadoConcreto(texto) {
  return /\d+[.,]\d+|\d+%|\d+ mil|\d+M|R\$\s*\d|US\$\s*\d|\d+ passageiro|\d+ visitante|\d+ turista|\d+ evento|\d+ voo|\d+ hotel|\d+ show/i.test(texto);
}

// ── Valida link específico ──
function validarLink(link) {
  if (!link) return false;
  try {
    const u = new URL(link);
    return u.pathname.length >= 10 && u.pathname !== '/' &&
           !u.pathname.match(/\.(css|js|png|jpg|gif|xml|json)$/i) &&
           !u.pathname.match(/^\/?(\?|#|login|wp-admin|wp-content|feed\/)/i);
  } catch { return false; }
}

// ── Verifica relevância ──
function ehRelevante(titulo, conteudo) {
  const texto = (titulo + ' ' + conteudo).toLowerCase();
  return RELEVANTE.some(p => texto.includes(p));
}

// ── Verifica se deve descartar ──
function deveDescartar(titulo, conteudo) {
  const texto = (titulo + ' ' + conteudo).toLowerCase();
  return DESCARTAR.some(p => texto.includes(p));
}

// ── Classifica por tópico ──
function classificar(texto) {
  const t = texto.toLowerCase();
  for (const [slug, cfg] of Object.entries(TOPICOS)) {
    if (cfg.keywords.some(kw => t.includes(kw))) return slug;
  }
  return 'turismo';
}

// ── Extrai KPI ──
function extrairKPI(titulo, conteudo) {
  const texto = titulo + ' ' + conteudo;
  const padroes = [
    { regex: /R\$\s*[\d,.]+\s*(bilh[õo]es?|milh[õo]es?)/i,                              label: 'impacto econômico' },
    { regex: /\+[\d,.]+%/,                                                               label: 'crescimento'       },
    { regex: /([\d,.]+%)\s*(de\s+)?(ocupação|crescimento|aumento|satisfação)/i,           label: ''                  },
    { regex: /([\d,.]+)\s*(mil|milh[õo]es?)\s*(turistas|visitantes|passageiros|pessoas)/i, label: ''                 },
    { regex: /(\d+)\s*shows?\s*(internacionais?)?/i,                                     label: 'shows em Curitiba'  },
    { regex: /([\d,.]+)\s*(mil|milh[õo]es?)\s*(de\s+)?passageiros/i,                    label: 'passageiros'        },
  ];
  for (const { regex, label } of padroes) {
    const match = texto.match(regex);
    if (match) {
      const val = match[0].replace(/\s+/g,' ').trim();
      const lbl = label || val.replace(/[\d,.+%R$]/g,'').trim().replace(/\s+/g,' ').trim().slice(0,40);
      return { kpi_valor: val, kpi_label: lbl || 'destaque' };
    }
  }
  return { kpi_valor: null, kpi_label: null };
}

// ── Fetch com timeout ──
async function fetchUrl(url, timeout = 8000) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'CuritibaEmMovimento/3.0 (+' + BASE_URL + ')' }
    });
    clearTimeout(t);
    if (!res.ok) return '';
    const text = await res.text();
    return text.length >= 200 ? text : '';
  } catch(e) { return ''; }
}

// ── Limpa rascunhos pendentes antigos ──
async function limparPendentesAntigos() {
  const h = { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` };
  const cutoff = new Date(Date.now() - 7*24*60*60*1000).toISOString();
  await fetch(`${supabaseUrl}/rest/v1/rascunhos_curadoria?status=eq.pendente&created_at=lt.${cutoff}`, { method:'DELETE', headers:h });
  await fetch(`${supabaseUrl}/rest/v1/rascunhos_curadoria?status=eq.pendente&titulo=like.*%3F`, { method:'DELETE', headers:h });
}

// ── Salva item no Supabase ──
async function salvarItem(item) {
  const res = await fetch(`${supabaseUrl}/rest/v1/rascunhos_curadoria`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Prefer':        'return=representation'
    },
    body: JSON.stringify({
      titulo:     item.titulo,
      conteudo:   item.conteudo,
      tema:       item.tema,
      link_fonte: item.link_fonte  || null,
      kpi_valor:  item.kpi_valor   || null,
      kpi_label:  item.kpi_label   || null,
      status:     'pendente'
    })
  });
  if (!res.ok) return null;
  const [salvo] = await res.json();
  return salvo;
}

// ── Gera HTML do e-mail ──
function gerarEmail(salvos, dataStr) {
  const CORES = {
    eventos:'#e74c3c', esportivo:'#2ecc71', congresso:'#3498db',
    hotelaria:'#9b59b6', aeroporto:'#1abc9c', turismo:'#f39c12',
    imobiliario:'#e67e22', comparativo:'#2c3e50'
  };
  const cardsHtml = salvos.map(item => {
    const cor      = CORES[item.tema] || '#FF6B00';
    const label    = TOPICOS[item.tema]?.label || item.tema;
    const aprovUrl = `${BASE_URL}/api/aprovar?id=${item.id}&token=${TOKEN}`;
    const rejUrl   = `${BASE_URL}/api/rejeitar?id=${item.id}&token=${TOKEN}`;
    const linkBtn  = validarLink(item.link_fonte)
      ? `<p style="margin:10px 0 0"><a href="${item.link_fonte}" target="_blank" style="font-size:11px;color:#FF6B00;text-decoration:none;display:inline-block;border:0.5px solid rgba(255,107,0,0.3);border-radius:20px;padding:4px 10px">↗ Ler notícia completa</a></p>`
      : '';
    const kpiBlock = item.kpi_valor
      ? `<div style="background:#1a1a1a;border-radius:8px;padding:10px 14px;margin:10px 0;display:flex;align-items:center;justify-content:space-between"><span style="font-size:11px;color:rgba(255,255,255,0.5)">${item.kpi_label||''}</span><span style="font-size:22px;font-weight:700;color:#FF6B00">${item.kpi_valor}</span></div>`
      : '';
    return `
      <div style="background:#fff;border-radius:12px;border:0.5px solid #e8e8e8;border-left:4px solid ${cor};padding:20px 24px;margin-bottom:14px">
        <span style="font-size:9px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${cor};background:${cor}18;padding:3px 8px;border-radius:20px">${label}</span>
        <div style="font-size:15px;font-weight:700;color:#1a1a1a;margin:10px 0 8px;line-height:1.3">${item.titulo}</div>
        ${kpiBlock}
        <div style="font-size:13px;color:#555;line-height:1.65">${item.conteudo}</div>
        ${linkBtn}
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
    <div style="font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#FF6B00;margin-bottom:8px">DADOS DE CURITIBA</div>
    <div style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#fff;margin-bottom:6px">Curadoria — ${dataStr}</div>
    <div style="font-size:13px;color:rgba(255,255,255,0.4)">${salvos.length} item${salvos.length!==1?'s':''} para aprovação</div>
  </div>
  <div style="padding:0 24px">${cardsHtml}</div>
  <div style="padding:20px 24px 32px">
    <a href="${BASE_URL}/admin.html" style="display:inline-block;background:#333;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:700">✏️ Ver todos no painel admin</a>
  </div>
  <div style="background:#1a1a1a;padding:16px 24px;text-align:center">
    <p style="font-size:11px;color:rgba(255,255,255,0.3);margin:0">Curitiba em Movimento · Bicalho Imóveis × Diferencial</p>
  </div>
</div>
</body></html>`;
}

// ── Envia e-mail ──
async function enviarEmail(assunto, html) {
  if (!resendKey) throw new Error('RESEND_API_KEY não configurada');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${resendKey}` },
    body: JSON.stringify({ from:'Curitiba em Movimento <onboarding@resend.dev>', to:[EMAIL_DEST], subject:assunto, html })
  });
  if (!res.ok) throw new Error('Resend: ' + await res.text());
  return res.json();
}

// ═══════════════════════════════════════════════════
// HANDLER PRINCIPAL
// ═══════════════════════════════════════════════════
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const isTest  = req.query?.test === 'true';
  const dataStr = new Date().toLocaleDateString('pt-BR',{ weekday:'long', year:'numeric', month:'long', day:'numeric' });
  console.log(`[curadoria] Iniciando${isTest?' (TESTE)':''} — ${dataStr}`);

  const motivosDescarte  = [];
  const itensSalvosDetalhes = [];
  let   totalEncontrados = 0;

  try {
    // 0. Limpa pendentes antigos
    await limparPendentesAntigos();

    const itensParaSalvar = [];
    const titulosVistos   = new Set();
    const QUATORZE_DIAS   = 14 * 24 * 60 * 60 * 1000;

    // 1. Para cada fonte RSS
    for (const fonte of FONTES_RSS) {
      if (itensParaSalvar.length >= MAX_ITENS) break;
      console.log(`[curadoria] RSS ${fonte.nome}`);

      const xml = await fetchUrl(fonte.url);
      if (!xml) { console.log(`[curadoria] ${fonte.nome}: sem resposta`); continue; }

      const items = parseRSS(xml);
      console.log(`[curadoria] ${fonte.nome}: ${items.length} itens no feed`);

      for (const item of items) {
        if (itensParaSalvar.length >= MAX_ITENS) break;
        totalEncontrados++;

        const tituloLimpo = limparTitulo(item.titulo);

        // Filtro: notícia com mais de 14 dias
        if (item.pubDate) {
          const age = Date.now() - new Date(item.pubDate).getTime();
          if (age > QUATORZE_DIAS) { motivosDescarte.push(`antiga: ${tituloLimpo}`); continue; }
        }

        // Filtro: título ausente/curto
        if (!tituloLimpo || tituloLimpo.length < 15) { motivosDescarte.push(`titulo_curto`); continue; }

        // Filtro: é pergunta
        if (tituloLimpo.endsWith('?')) { motivosDescarte.push(`pergunta: ${tituloLimpo}`); continue; }

        // Filtro: duplicata
        if (titulosVistos.has(tituloLimpo.toLowerCase())) { motivosDescarte.push(`duplicata: ${tituloLimpo}`); continue; }

        // Filtro: link inválido
        if (!validarLink(item.link)) { motivosDescarte.push(`link_invalido: ${item.link}`); continue; }

        // Filtro: descartar por conteúdo ruim
        const descLimpa = limparTexto(item.descricao);
        if (deveDescartar(tituloLimpo, descLimpa)) { motivosDescarte.push(`descartado: ${tituloLimpo}`); continue; }

        // Filtro: relevância para Curitiba/Paraná
        if (!ehRelevante(tituloLimpo, descLimpa)) { motivosDescarte.push(`sem_relevancia: ${tituloLimpo}`); continue; }

        // Filtro: descrição muito curta
        if (descLimpa.length < 80) { motivosDescarte.push(`desc_curta: ${tituloLimpo}`); continue; }

        // Formata conteúdo
        const conteudoFmt = formatarConteudo(item.descricao, tituloLimpo);
        const conteudoFinal = conteudoFmt.length >= 80 ? conteudoFmt : descLimpa.substring(0, 400) + (descLimpa.length > 400 ? '.' : '');
        if (!conteudoFinal || conteudoFinal.length < 60) { motivosDescarte.push(`conteudo_vazio: ${tituloLimpo}`); continue; }

        const dominio   = (() => { try { return new URL(item.link).hostname; } catch(e) { return 'fonte'; } })();
        const conteudo  = `<p style="font-size:13.5px;line-height:1.7;margin:0 0 8px">${conteudoFinal}</p><p style="font-size:11px;color:#aaa;margin:0">Fonte: <a href="${item.link}" target="_blank" style="color:#FF6B00">${dominio}</a></p>`;
        const tema      = classificar(tituloLimpo + ' ' + descLimpa);
        const kpi       = extrairKPI(tituloLimpo, conteudoFinal);

        titulosVistos.add(tituloLimpo.toLowerCase());
        itensParaSalvar.push({ titulo: tituloLimpo, conteudo, tema, link_fonte: item.link, ...kpi });
        console.log(`[curadoria] ✓ ${tema}: ${tituloLimpo.substring(0,70)}`);
      }
    }

    if (!itensParaSalvar.length) {
      return res.status(200).json({
        ok: true, itens_encontrados: totalEncontrados, itens_salvos: 0,
        itens_descartados: motivosDescarte.length, motivos_descarte: motivosDescarte,
        itens_salvos_detalhes: [],
        msg: 'Nenhum item passou nos filtros'
      });
    }

    // 2. Salva no Supabase
    const salvos = [];
    for (const item of itensParaSalvar) {
      const salvo = await salvarItem(item);
      if (salvo) {
        salvos.push(salvo);
        itensSalvosDetalhes.push({ titulo: salvo.titulo, tema: salvo.tema, kpi: salvo.kpi_valor });
      }
    }

    // 3. Envia e-mail
    let emailOk = false;
    try {
      const html = gerarEmail(salvos, dataStr);
      await enviarEmail(`📊 ${salvos.length} novidade${salvos.length!==1?'s':''} — Dados de Curitiba ${new Date().toLocaleDateString('pt-BR')}`, html);
      emailOk = true;
    } catch(e) { console.error('[curadoria] Erro e-mail:', e.message); }

    return res.status(200).json({
      ok: true,
      itens_encontrados: totalEncontrados,
      itens_salvos:      salvos.length,
      itens_descartados: motivosDescarte.length,
      motivos_descarte:  motivosDescarte,
      itens_salvos_detalhes: itensSalvosDetalhes,
      email: emailOk ? 'enviado para ' + EMAIL_DEST : 'falhou',
      data: dataStr
    });

  } catch(err) {
    console.error('[curadoria] Erro geral:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
