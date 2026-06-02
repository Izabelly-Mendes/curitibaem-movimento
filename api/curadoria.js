// ═══════════════════════════════════════════════════════════════
// api/curadoria.js — Curadoria automática semanal (terças 09h BRT)
// Busca notícias reais em páginas de listagem, extrai artigos individuais
// com link direto, filtra por qualidade e salva cada item separado.
//
// Variáveis de ambiente:
//   RESEND_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY
// ═══════════════════════════════════════════════════════════════

const resendKey   = process.env.RESEND_API_KEY;
const supabaseUrl = process.env.SUPABASE_URL  || 'https://uocnikcoynoflxgcknii.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_nWEHxISod-7kWfXptMj6Ow_RQU6hsf2';
const EMAIL_DEST  = 'izabelly@adiferencial.com.br';
const BASE_URL    = 'https://curitibaem-movimento.vercel.app';
const TOKEN       = 'bicalho2025';
const MAX_ITENS   = 10;

// ── Fontes: páginas de listagem de notícias ──
const FONTES_LISTAGEM = [
  { url: 'https://turismo.curitiba.pr.gov.br/noticias',           dominio: 'turismo.curitiba.pr.gov.br', tema: 'turismo' },
  { url: 'https://www.curitiba.pr.gov.br/noticias',               dominio: 'curitiba.pr.gov.br',         tema: 'geral' },
  { url: 'https://diariodoturismo.com.br/category/curitiba/',      dominio: 'diariodoturismo.com.br',     tema: 'turismo' },
  { url: 'https://www.curitibacvb.com.br/noticias',               dominio: 'curitibacvb.com.br',         tema: 'congresso' },
  { url: 'https://www.sehapr.com.br',                             dominio: 'sehapr.com.br',              tema: 'hotelaria' },
];

// ── Tópicos com keywords ──
const TOPICOS = {
  eventos:     { label: 'Eventos e Shows',               keywords: ['show','concert','espetáculo','festival','teatro','anitta','madonna','twenty one','olivia','beyoncé','taylor','luan','zé neto','pedro sampaio','confirmado para curitiba','turnê'] },
  esportivo:   { label: 'Eventos Esportivos',             keywords: ['arena da baixada','atletico','athletico','copa','libertadores','sul-americana','final','semifinal','futebol'] },
  congresso:   { label: 'Congressos e Eventos Corp.',     keywords: ['congresso','convenção','feira','ccvb','mice','captou','captação','corporate','expotrade','viasoft','centro de eventos'] },
  hotelaria:   { label: 'Hotelaria',                      keywords: ['ocupação','hotel','hospedagem','seha','diária','taxa de ocupação','pernoite','rede hoteleira'] },
  aeroporto:   { label: 'Aeroporto',                      keywords: ['aeroporto','afonso pena','passageiro','rota aérea','voo','decolagem','tap','gol','latam','azul'] },
  turismo:     { label: 'Turismo',                        keywords: ['turismo','turista','visitante','imt','curitibatur','lonely planet','destino','reconhecimento','linha turismo','embarque'] },
  imobiliario: { label: 'Mercado Imobiliário',             keywords: ['imóvel','imobiliário','airbnb','short stay','valorização','m²','metro quadrado','lançamento','studio'] },
  comparativo: { label: 'Comparativos de Dados',           keywords: ['cresceu','aumentou','% em relação','% vs','% a mais','% acima','recorde','histórico','supera','superou','crescimento de','alta de'] },
};

// ── Fetch genérico com timeout ──
async function fetchHtml(url, timeout = 12000) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'CuritibaEmMovimento/2.0 (+' + BASE_URL + ')' }
    });
    clearTimeout(t);
    if (!res.ok) return '';
    return await res.text();
  } catch(e) { return ''; }
}

// ── Extrai links de artigos de uma página de listagem ──
function extrairLinksArtigos(html, dominio, baseUrl) {
  const links = new Set();
  // Padrão 1: href absolutos
  const re1 = /href="(https?:\/\/[^"]+)"/gi;
  let m;
  while ((m = re1.exec(html)) !== null) {
    const url = m[1];
    if (url.includes(dominio) && linkParece_artigo(url)) links.add(url);
  }
  // Padrão 2: href relativos
  const re2 = /href="(\/[^"#?][^"]+)"/gi;
  while ((m = re2.exec(html)) !== null) {
    try {
      const full = new URL(m[1], baseUrl).toString();
      if (linkParece_artigo(full)) links.add(full);
    } catch(e) {}
  }
  return [...links].slice(0, 15);
}

function linkParece_artigo(url) {
  try {
    const u = new URL(url);
    const path = u.pathname;
    // Deve ter path com pelo menos 2 segmentos e não ser uma página genérica
    if (path.length < 5 || path === '/') return false;
    if (path.match(/\.(css|js|png|jpg|gif|svg|pdf|xml|json)$/i)) return false;
    if (path.match(/^\/?(page|tag|categoria|author|search|wp-content|feed)\//i)) return false;
    // Deve ter pelo menos um segmento de slug (contém letras e hífens)
    const lastSegment = path.split('/').filter(Boolean).pop() || '';
    return lastSegment.length > 5 && /[a-z]/.test(lastSegment);
  } catch(e) { return false; }
}

// ── Limpeza do título ──
function limparTitulo(titulo) {
  if (!titulo) return '';
  titulo = titulo.replace(/^(curitiba\s+)?conteúdo de marca\s+/i, '');
  titulo = titulo.replace(/^curitiba\s+/i, '');
  titulo = titulo.replace(/\s*[|–-—]\s*.*$/, '');   // remove sufixo de site
  titulo = titulo.replace(/\.\.\.$/, '');
  titulo = titulo.charAt(0).toUpperCase() + titulo.slice(1);
  return titulo.trim();
}

// ── Limpeza do resumo/conteúdo ──
function limparConteudo(conteudo) {
  if (!conteudo) return '';
  conteudo = conteudo.replace(/Clara\s+Silva\s*[-–]?\s*/gi, '');
  conteudo = conteudo.replace(/\b\d{1,2}\s+de\s+\w+\s+de\s+\d{4}\b/g, '');
  conteudo = conteudo.replace(/\b(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+\d{1,2},\s+\d{4}/gi, '');
  conteudo = conteudo.replace(/^[A-ZÁÉÍÓÚ][^.]*?-[A-Z]+\s+/, '');
  conteudo = conteudo.replace(/Conteúdo\s+de\s+marca\s*/gi, '');
  conteudo = conteudo.replace(/Publicidade\s*/gi, '');
  conteudo = conteudo.replace(/\s{2,}/g, ' ').trim();
  if (conteudo && !conteudo.endsWith('.')) conteudo += '.';
  return conteudo;
}

// ── Extrai KPI principal do texto ──
function extrairKPI(texto) {
  const padroes = [
    { regex: /R\$\s*[\d,.]+\s*(bilh[õo]es?|milh[õo]es?)/i,                           label: 'impacto econômico' },
    { regex: /\+[\d,.]+%/,                                                             label: 'crescimento' },
    { regex: /([\d,.]+%)\s*(de\s+)?(crescimento|aumento|ocupação|satisfação)/i,        label: '' },
    { regex: /([\d,.]+\s*(mil|milh[õo]es?))\s*(pessoas|visitantes|participantes|turistas|passageiros)/i, label: '' },
    { regex: /(\d+)[ªº°]\s*(edição|congresso|feira|evento)/i,                          label: 'edição' },
    { regex: /(\d+)\s*(dias|anos)\s*(de\s+)?(programação|evento|festival)/i,           label: '' },
    { regex: /[\d,.]+\s*(mil|milh[õo]es?)\s*(reais|R\$)/i,                            label: 'valor' },
  ];
  for (const { regex, label } of padroes) {
    const match = texto.match(regex);
    if (match) {
      const val = match[0].trim();
      const lbl = label || val.replace(/[\d,.+%R$]/g, '').trim().replace(/\s+/g,' ').trim().slice(0, 40);
      return { kpi_valor: val, kpi_label: lbl || 'destaque' };
    }
  }
  return { kpi_valor: null, kpi_label: null };
}

// ── Extrai conteúdo de um artigo individual ──
function extrairConteudo(html) {
  // Remove scripts, styles, nav, footer, header, sidebar
  let clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Tenta extrair o título da página
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const titulo = titleMatch ? titleMatch[1].replace(/\s*[|–-].*$/, '').trim() : '';

  return { titulo, texto: clean.substring(0, 8000) };
}

// ── Verifica se tem dado concreto ──
function temDadoConcreto(texto) {
  return /\d+[.,]\d+|\d{4}|\d+%|\d+ mil|\d+M|R\$\s*\d|US\$\s*\d|\d+ passageiro|\d+ visitante|\d+ turista|\d+ evento|\d+ voo|\d+ hotel|janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro/i.test(texto);
}

// ── Valida link de fonte (deve ter path além do domínio) ──
function linkFonteValido(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.pathname && u.pathname.length > 3 && u.pathname !== '/';
  } catch(e) { return false; }
}

// ── Classifica texto por tópico ──
function classificarTexto(texto) {
  const t = texto.toLowerCase();
  for (const [slug, cfg] of Object.entries(TOPICOS)) {
    if (cfg.keywords.some(kw => t.includes(kw))) return slug;
  }
  // Fallback: qualquer coisa sobre Curitiba
  if (t.includes('curitiba') || t.includes('paraná')) return 'turismo';
  return null;
}

// ── Gera resumo de 2-4 frases com dados concretos ──
function gerarResumo(texto) {
  const frases = texto.match(/[^.!?\n]{40,300}[.!?]/g) || [];
  const comDados = frases.filter(f => temDadoConcreto(f));
  const selecionadas = comDados.length >= 2 ? comDados.slice(0, 3) : frases.filter(f => f.length > 60).slice(0, 3);
  return selecionadas.map(f => f.trim()).join(' ');
}

// ── Limpa rascunhos antigos ou ruins ──
async function limparRascunhosAntigos() {
  // Deleta pendentes com mais de 7 dias
  await fetch(`${supabaseUrl}/rest/v1/rascunhos_curadoria?status=eq.pendente&created_at=lt.${new Date(Date.now() - 7*24*60*60*1000).toISOString()}`, {
    method: 'DELETE',
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
  });
  // Deleta pendentes com título terminando em "?" (perguntas de FAQ)
  await fetch(`${supabaseUrl}/rest/v1/rascunhos_curadoria?status=eq.pendente&titulo=like.*%3F`, {
    method: 'DELETE',
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
  });
}

// ── Salva item no Supabase ──
async function salvarItem(item) {
  const body = JSON.stringify({
    titulo: item.titulo,
    conteudo: item.conteudo,
    tema: item.tema,
    link_fonte: item.link_fonte || null,
    kpi_valor: item.kpi_valor || null,
    kpi_label: item.kpi_label || null,
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
  if (!res.ok) return null;
  const [salvo] = await res.json();
  return salvo;
}

// ── Gera e-mail HTML ──
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
    const linkBtn  = linkFonteValido(item.link_fonte)
      ? `<p style="margin:10px 0 0"><a href="${item.link_fonte}" target="_blank" style="font-size:11px;color:#FF6B00;text-decoration:none;display:inline-block;border:0.5px solid rgba(255,107,0,0.3);border-radius:20px;padding:4px 10px">↗ Ler notícia completa</a></p>`
      : '';
    const kpiBlock = item.kpi_valor
      ? `<div style="background:#1a1a1a;border-radius:8px;padding:10px 14px;margin:10px 0;display:flex;align-items:center;justify-content:space-between"><span style="font-size:11px;color:rgba(255,255,255,0.5)">${item.kpi_label || ''}</span><span style="font-size:20px;font-weight:700;color:#FF6B00">${item.kpi_valor}</span></div>`
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
    <div style="font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#FF6B00;margin-bottom:8px">CURITIBA EM MOVIMENTO</div>
    <div style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#fff;margin-bottom:6px">Curadoria de terça — ${dataStr}</div>
    <div style="font-size:13px;color:rgba(255,255,255,0.4)">${salvos.length} notícia${salvos.length !== 1 ? 's' : ''} encontrada${salvos.length !== 1 ? 's' : ''} · Aprove ou rejeite individualmente</div>
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

// ═══════════════════════════════════════════════════
// HANDLER PRINCIPAL
// ═══════════════════════════════════════════════════
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const dataStr = new Date().toLocaleDateString('pt-BR',{ weekday:'long', year:'numeric', month:'long', day:'numeric' });
  console.log(`[curadoria] Iniciando — ${dataStr}`);

  try {
    // 0. Limpa rascunhos antigos / ruins
    await limparRascunhosAntigos();
    console.log('[curadoria] Limpeza de rascunhos antigos concluída');

    const itensParaSalvar = [];
    const titulosVistos   = new Set(); // evita duplicatas

    // 1. Para cada fonte: busca listagem → extrai links de artigos → lê artigo → filtra
    for (const fonte of FONTES_LISTAGEM) {
      if (itensParaSalvar.length >= MAX_ITENS) break;

      console.log(`[curadoria] Buscando ${fonte.url}`);
      const htmlListagem = await fetchHtml(fonte.url);
      if (!htmlListagem) continue;

      const links = extrairLinksArtigos(htmlListagem, fonte.dominio, fonte.url);
      console.log(`[curadoria] ${links.length} links encontrados em ${fonte.dominio}`);

      for (const linkArtigo of links.slice(0, 8)) {
        if (itensParaSalvar.length >= MAX_ITENS) break;

        const htmlArtigo = await fetchHtml(linkArtigo, 10000);
        if (!htmlArtigo) continue;

        const { titulo, texto } = extrairConteudo(htmlArtigo);

        // Limpeza e normalização
        const tituloLimpo = limparTitulo(titulo);

        // Filtros de qualidade
        if (!tituloLimpo || tituloLimpo.length < 15) continue;
        if (tituloLimpo.trim().endsWith('?')) continue;
        if (titulosVistos.has(tituloLimpo.toLowerCase())) continue;
        if (texto.length < 150) continue;
        if (!temDadoConcreto(tituloLimpo + ' ' + texto)) continue;
        if (!linkFonteValido(linkArtigo)) continue;

        const textoLower = (tituloLimpo + ' ' + texto).toLowerCase();
        if (!textoLower.includes('curitiba') && !textoLower.includes('paraná') && !textoLower.includes('afonso pena')) continue;

        const tema = classificarTexto(textoLower) || fonte.tema || 'turismo';

        // Gera resumo limpo
        const resumoBruto = gerarResumo(texto);
        if (!resumoBruto || resumoBruto.length < 60) continue;
        const resumo = limparConteudo(resumoBruto);

        const dominioArtigo = (() => { try { return new URL(linkArtigo).hostname; } catch(e) { return 'fonte'; } })();
        const conteudo = `<p style="font-size:13.5px;line-height:1.7;margin:0 0 8px">${resumo}</p><p style="font-size:11px;color:#aaa;margin:0">Fonte: <a href="${linkArtigo}" target="_blank" style="color:#FF6B00">${dominioArtigo}</a></p>`;

        // Extrai KPI
        const kpi = extrairKPI(tituloLimpo + ' ' + resumo);

        titulosVistos.add(tituloLimpo.toLowerCase());
        itensParaSalvar.push({ titulo: tituloLimpo, conteudo, tema, link_fonte: linkArtigo, ...kpi });
        console.log(`[curadoria] ✓ ${tema}: ${titulo.substring(0,60)}`);
      }
    }

    console.log(`[curadoria] ${itensParaSalvar.length} itens aprovados para salvar`);

    if (!itensParaSalvar.length) {
      return res.status(200).json({ ok: true, itens: 0, msg: 'Nenhuma notícia nova encontrada esta semana' });
    }

    // 2. Salva cada item no Supabase
    const salvos = [];
    for (const item of itensParaSalvar) {
      const salvo = await salvarItem(item);
      if (salvo) salvos.push(salvo);
    }
    console.log(`[curadoria] ${salvos.length} itens salvos no Supabase`);

    // 3. Envia e-mail
    let emailOk = false;
    try {
      const html = gerarEmail(salvos, dataStr);
      await enviarEmail(`📊 ${salvos.length} novidade${salvos.length !== 1 ? 's' : ''} em Curitiba — ${new Date().toLocaleDateString('pt-BR')}`, html);
      emailOk = true;
      console.log('[curadoria] E-mail enviado');
    } catch(e) {
      console.error('[curadoria] Erro no e-mail:', e.message);
    }

    return res.status(200).json({
      ok: true,
      itens: salvos.length,
      email: emailOk ? 'enviado' : 'falhou',
      data: dataStr
    });

  } catch(err) {
    console.error('[curadoria] Erro geral:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
