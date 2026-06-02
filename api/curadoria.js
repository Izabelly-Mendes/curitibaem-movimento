// ═══════════════════════════════════════════════════════════════
// api/curadoria.js — Curadoria automática semanal (terças 09h BRT)
// Variáveis de ambiente: RESEND_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY
// Teste imediato: GET /api/curadoria?test=true
// ═══════════════════════════════════════════════════════════════

const resendKey   = process.env.RESEND_API_KEY;
const supabaseUrl = process.env.SUPABASE_URL  || 'https://uocnikcoynoflxgcknii.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_nWEHxISod-7kWfXptMj6Ow_RQU6hsf2';
const EMAIL_DEST  = 'izabelly@adiferencial.com.br';
const BASE_URL    = 'https://curitibaem-movimento.vercel.app';
const TOKEN       = 'bicalho2025';
const MAX_ITENS   = 10;

// ── Fontes abertas (sem CCVB) ──
const FONTES = [
  { nome: 'IMT Curitiba',              url: 'https://turismo.curitiba.pr.gov.br/noticias',      tema: 'turismo'    },
  { nome: 'Prefeitura de Curitiba',    url: 'https://www.curitiba.pr.gov.br/noticias',           tema: 'turismo'    },
  { nome: 'Diário do Turismo',         url: 'https://diariodoturismo.com.br/category/curitiba/', tema: 'turismo'    },
  { nome: 'Bem Paraná',                url: 'https://www.bemparana.com.br/noticias/parana/',     tema: 'turismo'    },
  { nome: 'Banda B',                   url: 'https://www.bandab.com.br/categoria/turismo/',      tema: 'turismo'    },
  { nome: 'Governo do Paraná',         url: 'https://www.parana.pr.gov.br/aen/Noticias/Turismo', tema: 'turismo'    },
  { nome: 'SEHA',                      url: 'https://www.sehapr.com.br/noticias',                tema: 'hotelaria'  },
  { nome: 'Aeroporto Afonso Pena',     url: 'https://diariodoturismo.com.br/?s=afonso+pena',    tema: 'aeroporto'  },
];

// ── Tópicos ──
const TOPICOS = {
  eventos:     { label: 'Eventos e Shows',          keywords: ['show','concert','espetáculo','festival','teatro','anitta','madonna','twenty one','olivia','beyoncé','taylor','luan','zé neto','pedro sampaio','confirmado para curitiba','turnê'] },
  esportivo:   { label: 'Eventos Esportivos',        keywords: ['arena da baixada','atletico','athletico','copa','libertadores','sul-americana','final','semifinal','futebol'] },
  congresso:   { label: 'Congressos e Eventos Corp.',keywords: ['congresso','convenção','feira','ccvb','mice','captou','captação','corporate','expotrade','viasoft','centro de eventos'] },
  hotelaria:   { label: 'Hotelaria',                 keywords: ['ocupação','hotel','hospedagem','seha','diária','taxa de ocupação','pernoite','rede hoteleira'] },
  aeroporto:   { label: 'Aeroporto',                 keywords: ['aeroporto','afonso pena','passageiro','rota aérea','voo','decolagem','tap','gol','latam','azul'] },
  turismo:     { label: 'Turismo',                   keywords: ['turismo','turista','visitante','imt','curitibatur','lonely planet','destino','reconhecimento','linha turismo','embarque'] },
  imobiliario: { label: 'Mercado Imobiliário',        keywords: ['imóvel','imobiliário','airbnb','short stay','valorização','m²','metro quadrado','lançamento','studio'] },
  comparativo: { label: 'Comparativos de Dados',      keywords: ['cresceu','aumentou','% em relação','% vs','% a mais','% acima','recorde','histórico','supera','superou','crescimento de','alta de'] },
};

// ── Strings que indicam página inválida (login, 404, Cloudflare, etc.) ──
const CONTEUDO_INVALIDO = [
  'senha perdida', 'powered by wordpress', 'digite o seu nome de usuário',
  'redefinir a sua senha', 'endereço de e-mail', 'fazer login',
  'página não encontrada', '404 not found', 'not found', 'access denied',
  'acesso negado', 'você não tem permissão', 'faça login para continuar',
  'javascript está desativado', 'enable javascript',
  'cloudflare', 'checking your browser', 'just a moment',
];

function conteudoValido(titulo, conteudo) {
  const texto = (titulo + ' ' + conteudo).toLowerCase();
  return !CONTEUDO_INVALIDO.some(termo => texto.includes(termo));
}

// ── Fetch com timeout curto ──
async function fetchHtml(url, timeout = 8000) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'CuritibaEmMovimento/2.0 (+' + BASE_URL + ')' }
    });
    clearTimeout(t);
    if (!res.ok) return '';
    const html = await res.text();
    return html.length >= 500 ? html : '';     // ignora páginas muito curtas
  } catch(e) { return ''; }
}

// ── Valida link específico de notícia ──
function validarLink(link) {
  if (!link) return false;
  try {
    const url = new URL(link);
    if (url.pathname === '/' || url.pathname === '') return false;
    if (url.pathname.length < 10) return false;
    if (url.pathname.match(/\.(css|js|png|jpg|gif|svg|pdf|xml|json)$/i)) return false;
    if (url.pathname.match(/^\/?(\?|#|login|wp-admin|wp-content|feed|tag|author|search|page\/\d)/i)) return false;
    return true;
  } catch { return false; }
}

// ── Extrai links de artigos de uma página de listagem ──
function extrairLinksArtigos(html, dominioFonte, baseUrl) {
  const links = new Set();
  // href absolutos do mesmo domínio
  const re1 = /href="(https?:\/\/[^"#? ]+)"/gi;
  let m;
  while ((m = re1.exec(html)) !== null) {
    const u = m[1];
    if (u.includes(dominioFonte) && validarLink(u)) links.add(u);
  }
  // href relativos
  const re2 = /href="(\/[^"#? ][^"]+)"/gi;
  while ((m = re2.exec(html)) !== null) {
    try {
      const full = new URL(m[1], baseUrl).toString();
      if (validarLink(full)) links.add(full);
    } catch(e) {}
  }
  return [...links].slice(0, 15);
}

// ── Extrai título e texto limpo de um artigo ──
function extrairConteudo(html) {
  let clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<form[\s\S]*?<\/form>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const titulo = titleMatch ? titleMatch[1].replace(/\s*[|–—-]\s*.*$/, '').trim() : '';

  return { titulo, texto: clean.substring(0, 8000) };
}

// ── Limpeza do título ──
function limparTitulo(titulo) {
  if (!titulo) return '';
  titulo = titulo.replace(/^(curitiba\s+)?conteúdo de marca\s+/i, '');
  titulo = titulo.replace(/^curitiba\s+/i, '');
  titulo = titulo.replace(/\s*[|–—-]\s*.*$/, '');
  titulo = titulo.replace(/\.\.\.$/, '');
  titulo = titulo.trim();
  if (!titulo) return '';
  return titulo.charAt(0).toUpperCase() + titulo.slice(1);
}

// ── Limpeza do conteúdo ──
function limparConteudo(conteudo) {
  if (!conteudo) return '';
  conteudo = conteudo.replace(/Clara\s+Silva\s*[-–]?\s*/gi, '');
  conteudo = conteudo.replace(/\b\d{1,2}\s+de\s+\w+\s+de\s+\d{4}\b/g, '');
  conteudo = conteudo.replace(/\b(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+\d{1,2},\s+\d{4}/gi, '');
  conteudo = conteudo.replace(/Conteúdo\s+de\s+marca\s*/gi, '');
  conteudo = conteudo.replace(/Publicidade\s*/gi, '');
  conteudo = conteudo.replace(/\s{2,}/g, ' ').trim();
  if (conteudo && !conteudo.endsWith('.')) conteudo += '.';
  return conteudo;
}

// ── Extrai KPI principal ──
function extrairKPI(texto) {
  const padroes = [
    { regex: /R\$\s*[\d,.]+\s*(bilh[õo]es?|milh[õo]es?)/i,                                     label: 'impacto econômico' },
    { regex: /\+[\d,.]+%/,                                                                       label: 'crescimento'       },
    { regex: /([\d,.]+%)\s*(de\s+)?(crescimento|aumento|ocupação|satisfação)/i,                  label: ''                  },
    { regex: /([\d,.]+\s*(mil|milh[õo]es?))\s*(pessoas|visitantes|participantes|turistas|passageiros)/i, label: ''          },
    { regex: /(\d+)[ªº°]\s*(edição|congresso|feira|evento)/i,                                   label: 'edição'            },
    { regex: /(\d+)\s*(dias|anos)\s*(de\s+)?(programação|evento|festival)/i,                    label: ''                  },
    { regex: /[\d,.]+\s*(mil|milh[õo]es?)\s*(reais|R\$)/i,                                      label: 'valor'             },
  ];
  for (const { regex, label } of padroes) {
    const match = texto.match(regex);
    if (match) {
      const val = match[0].trim();
      const lbl = label || val.replace(/[\d,.+%R$ªº°]/g,'').trim().replace(/\s+/g,' ').trim().slice(0,40);
      return { kpi_valor: val, kpi_label: lbl || 'destaque' };
    }
  }
  return { kpi_valor: null, kpi_label: null };
}

// ── Tem dado concreto ──
function temDadoConcreto(texto) {
  return /\d+[.,]\d+|\d+%|\d+ mil|\d+M|R\$\s*\d|US\$\s*\d|\d+ passageiro|\d+ visitante|\d+ turista|\d+ evento|\d+ voo|\d+ hotel/i.test(texto);
}

// ── Classifica por tópico ──
function classificarTexto(texto) {
  const t = texto.toLowerCase();
  for (const [slug, cfg] of Object.entries(TOPICOS)) {
    if (cfg.keywords.some(kw => t.includes(kw))) return slug;
  }
  if (t.includes('curitiba') || t.includes('paraná')) return 'turismo';
  return null;
}

// ── Gera resumo ──
function gerarResumo(texto) {
  const frases = texto.match(/[^.!?\n]{40,300}[.!?]/g) || [];
  const comDados = frases.filter(f => temDadoConcreto(f));
  const selecionadas = comDados.length >= 2 ? comDados.slice(0, 3) : frases.filter(f => f.length > 60).slice(0, 3);
  return selecionadas.map(f => f.trim()).join(' ');
}

// ── Limpa rascunhos antigos / inválidos ──
async function limparRascunhosAntigos() {
  const headers = { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` };
  // Pendentes com mais de 7 dias
  await fetch(
    `${supabaseUrl}/rest/v1/rascunhos_curadoria?status=eq.pendente&created_at=lt.${new Date(Date.now()-7*24*60*60*1000).toISOString()}`,
    { method:'DELETE', headers }
  );
  // Perguntas (título termina em ?)
  await fetch(
    `${supabaseUrl}/rest/v1/rascunhos_curadoria?status=eq.pendente&titulo=like.*%3F`,
    { method:'DELETE', headers }
  );
  // "Senha perdida" e similares
  await fetch(
    `${supabaseUrl}/rest/v1/rascunhos_curadoria?titulo=ilike.*senha+perdida*`,
    { method:'DELETE', headers }
  );
  await fetch(
    `${supabaseUrl}/rest/v1/rascunhos_curadoria?conteudo=ilike.*powered+by+wordpress*`,
    { method:'DELETE', headers }
  );
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
      link_fonte: item.link_fonte   || null,
      kpi_valor:  item.kpi_valor    || null,
      kpi_label:  item.kpi_label    || null,
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
      ? `<div style="background:#1a1a1a;border-radius:8px;padding:10px 14px;margin:10px 0;display:flex;align-items:center;justify-content:space-between"><span style="font-size:11px;color:rgba(255,255,255,0.5)">${item.kpi_label||''}</span><span style="font-size:20px;font-weight:700;color:#FF6B00">${item.kpi_valor}</span></div>`
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
    <div style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#fff;margin-bottom:6px">Curadoria — ${dataStr}</div>
    <div style="font-size:13px;color:rgba(255,255,255,0.4)">${salvos.length} notícia${salvos.length!==1?'s':''} · Aprove ou rejeite individualmente</div>
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
    body: JSON.stringify({
      from: 'Curitiba em Movimento <onboarding@resend.dev>',
      to:   [EMAIL_DEST],
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

  const isTest  = req.query?.test === 'true';
  const dataStr = new Date().toLocaleDateString('pt-BR',{ weekday:'long', year:'numeric', month:'long', day:'numeric' });

  console.log(`[curadoria] Iniciando${isTest?' (TESTE)':''} — ${dataStr}`);

  // Rastreamento de descartes para resposta JSON
  const motivosDescarte = [];
  let totalEncontrados  = 0;

  try {
    // 0. Limpa rascunhos antigos / inválidos
    await limparRascunhosAntigos();
    console.log('[curadoria] Limpeza concluída');

    const itensParaSalvar = [];
    const titulosVistos   = new Set();

    // 1. Para cada fonte: busca listagem → extrai links → lê artigo → filtra
    for (const fonte of FONTES) {
      if (itensParaSalvar.length >= MAX_ITENS) break;

      const dominio = (() => { try { return new URL(fonte.url).hostname; } catch(e) { return fonte.url; } })();
      console.log(`[curadoria] Buscando ${fonte.nome} (${fonte.url})`);

      const htmlListagem = await fetchHtml(fonte.url, 8000);
      if (!htmlListagem) {
        console.log(`[curadoria] ${fonte.nome}: sem resposta ou conteúdo < 500 chars`);
        continue;
      }

      const links = extrairLinksArtigos(htmlListagem, dominio, fonte.url);
      console.log(`[curadoria] ${fonte.nome}: ${links.length} links extraídos`);

      for (const linkArtigo of links.slice(0, 8)) {
        if (itensParaSalvar.length >= MAX_ITENS) break;

        const htmlArtigo = await fetchHtml(linkArtigo, 8000);
        if (!htmlArtigo) { motivosDescarte.push(`sem_html: ${linkArtigo}`); continue; }

        const { titulo, texto } = extrairConteudo(htmlArtigo);
        totalEncontrados++;

        const tituloLimpo = limparTitulo(titulo);

        // Filtro 1: página inválida (login, 404, Cloudflare, etc.)
        if (!conteudoValido(tituloLimpo, texto)) {
          motivosDescarte.push(`pagina_invalida: ${tituloLimpo || linkArtigo}`);
          continue;
        }

        // Filtro 2: título ausente ou muito curto
        if (!tituloLimpo || tituloLimpo.length < 15) { motivosDescarte.push(`titulo_curto: ${linkArtigo}`); continue; }

        // Filtro 3: é pergunta
        if (tituloLimpo.trim().endsWith('?')) { motivosDescarte.push(`pergunta: ${tituloLimpo}`); continue; }

        // Filtro 4: duplicata
        if (titulosVistos.has(tituloLimpo.toLowerCase())) { motivosDescarte.push(`duplicata: ${tituloLimpo}`); continue; }

        // Filtro 5: conteúdo muito curto
        if (texto.length < 150) { motivosDescarte.push(`texto_curto: ${tituloLimpo}`); continue; }

        // Filtro 6: sem dado concreto
        if (!temDadoConcreto(tituloLimpo + ' ' + texto)) { motivosDescarte.push(`sem_dado: ${tituloLimpo}`); continue; }

        // Filtro 7: link inválido
        if (!validarLink(linkArtigo)) { motivosDescarte.push(`link_invalido: ${linkArtigo}`); continue; }

        // Filtro 8: relevância para Curitiba/Paraná
        const textoLower = (tituloLimpo + ' ' + texto).toLowerCase();
        if (!textoLower.includes('curitiba') && !textoLower.includes('paraná') && !textoLower.includes('afonso pena')) {
          motivosDescarte.push(`sem_relevancia_curitiba: ${tituloLimpo}`); continue;
        }

        const tema      = classificarTexto(textoLower) || fonte.tema || 'turismo';
        const resumoBruto = gerarResumo(texto);
        if (!resumoBruto || resumoBruto.length < 60) { motivosDescarte.push(`resumo_vazio: ${tituloLimpo}`); continue; }
        const resumo    = limparConteudo(resumoBruto);
        const dominio_  = (() => { try { return new URL(linkArtigo).hostname; } catch(e) { return 'fonte'; } })();
        const conteudo  = `<p style="font-size:13.5px;line-height:1.7;margin:0 0 8px">${resumo}</p><p style="font-size:11px;color:#aaa;margin:0">Fonte: <a href="${linkArtigo}" target="_blank" style="color:#FF6B00">${dominio_}</a></p>`;
        const kpi       = extrairKPI(tituloLimpo + ' ' + resumo);

        titulosVistos.add(tituloLimpo.toLowerCase());
        itensParaSalvar.push({ titulo: tituloLimpo, conteudo, tema, link_fonte: linkArtigo, ...kpi });
        console.log(`[curadoria] ✓ ${tema}: ${tituloLimpo.substring(0,70)}`);
      }
    }

    console.log(`[curadoria] ${itensParaSalvar.length} itens prontos para salvar (${motivosDescarte.length} descartados)`);

    if (!itensParaSalvar.length) {
      return res.status(200).json({
        ok: true,
        itens_encontrados: totalEncontrados,
        itens_salvos: 0,
        itens_descartados: motivosDescarte.length,
        motivos_descarte: motivosDescarte,
        msg: 'Nenhuma notícia nova passou nos filtros esta semana'
      });
    }

    // 2. Salva no Supabase
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
      await enviarEmail(
        `📊 ${salvos.length} novidade${salvos.length!==1?'s':''} em Curitiba — ${new Date().toLocaleDateString('pt-BR')}`,
        html
      );
      emailOk = true;
      console.log('[curadoria] E-mail enviado para ' + EMAIL_DEST);
    } catch(e) {
      console.error('[curadoria] Erro no e-mail:', e.message);
    }

    return res.status(200).json({
      ok: true,
      itens_encontrados: totalEncontrados,
      itens_salvos:      salvos.length,
      itens_descartados: motivosDescarte.length,
      motivos_descarte:  motivosDescarte,
      email:             emailOk ? 'enviado para ' + EMAIL_DEST : 'falhou',
      data:              dataStr
    });

  } catch(err) {
    console.error('[curadoria] Erro geral:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
