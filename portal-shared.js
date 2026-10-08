// ══════════════════════════════════════════════════════════════════
// portal-shared.js — Fase 2 (ADR 0002) / Bloco 1
//
// Lógica/dados genuinamente idênticos entre index.html e cliente.html,
// extraídos para um único lugar. Critério usado: só entrou aqui o que
// produzia o MESMO resultado visível nos dois arquivos (ou passou a
// produzir, corrigindo um resíduo de estilo antigo — ver trocarIdioma).
// Funções que ainda geram HTML/CSS diferentes entre os dois arquivos
// (navegarSecao, toggleMobileSidebar, os cards de "Dados de Curitiba")
// ficam para o Bloco 2, junto da unificação visual — evita misturar
// "organizar código" com "mudar aparência" no mesmo passo.
// ══════════════════════════════════════════════════════════════════

// ── Mapas de tema/imagem para cards de "Dados de Curitiba" ─────────
const TEMA_LABELS = {
  eventos:'Eventos e Shows', esportivo:'Eventos Esportivos',
  congresso:'Congressos & Corp.', hotelaria:'Hotelaria',
  aeroporto:'Aeroporto', turismo:'Turismo',
  imobiliario:'Mercado Imobiliário', comparativo:'Comparativos de Dados'
};

const CATEGORIA_IMG = {
  imobiliario: 'https://images.unsplash.com/photo-1649180436242-aeb0b92a4aab?q=80&w=900&auto=format&fit=crop',
  aeroporto:   'https://images.unsplash.com/photo-1741835906792-eb13a54af7d9?q=80&w=900&auto=format&fit=crop',
  eventos:     'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?q=80&w=900&auto=format&fit=crop',
  esportivo:   'https://images.unsplash.com/photo-1569863959165-56dae551d4fc?q=80&w=900&auto=format&fit=crop',
  congresso:   'https://images.unsplash.com/photo-1769740333462-9a63bfa914bc?q=80&w=900&auto=format&fit=crop',
  hotelaria:   'https://images.unsplash.com/photo-1677129667171-92abd8740fa3?q=80&w=900&auto=format&fit=crop',
  turismo:     'jardim-botanico.jpg',
  comparativo: 'https://images.unsplash.com/photo-1774112168796-69c896af2730?q=80&w=900&auto=format&fit=crop',
  default:     'https://images.unsplash.com/photo-1774112168796-69c896af2730?q=80&w=900&auto=format&fit=crop'
};

// Fallback para registros sem coluna imagem_url no banco ainda
// (existia só em cliente.html; index.html ganha a mesma correção aqui)
const IMAGEM_FALLBACK = {
  'f78e8df9-b52b-4b68-9bb1-f64e5c904948': 'Foto para 09.06.png'
};

// ── Fontes colapsável ────────────────────────────────────────────
function toggleFontes() {
  const panel = document.getElementById('fontes-panel');
  const arrow = document.getElementById('fontes-arrow');
  if (panel.style.display === 'none') {
    panel.style.display = 'block';
    arrow.style.transform = 'rotate(180deg)';
  } else {
    panel.style.display = 'none';
    arrow.style.transform = 'rotate(0deg)';
  }
}

// ── Troca de idioma (data-pt / data-en / data-zh) ───────────────────
// Usa var(--color-primary)/var(--color-border)/var(--color-bg-secondary)
// em vez de hex fixo: a versão anterior de index.html tinha cores de um
// tema escuro antigo (#FF6B00/rgba branca) que não existe mais no design
// system atual — corrigido aqui, não é mudança de comportamento, é
// alinhar ao token que já é usado em todo o resto da página.
function trocarIdioma(lang) {
  document.querySelectorAll('[data-pt]').forEach(function(el) {
    const texto = el.getAttribute('data-' + lang);
    if (texto !== null) el.innerHTML = texto;
  });
  document.querySelectorAll('.sidebar-item[data-tip-en]').forEach(function(item) {
    if (lang === 'pt') {
      item.setAttribute('data-tooltip', item.getAttribute('data-tip-pt') || '');
    } else {
      item.setAttribute('data-tooltip', item.getAttribute('data-tip-' + lang) || '');
    }
  });
  document.querySelectorAll('.lang-btn').forEach(function(btn) {
    const ativo = btn.getAttribute('data-lang') === lang;
    btn.style.opacity = ativo ? '1' : '0.45';
    btn.style.borderColor = ativo ? 'var(--color-primary)' : 'var(--color-border)';
    btn.style.borderWidth = ativo ? '1.5px' : '1px';
    btn.style.background = ativo ? 'rgba(10,77,140,0.08)' : 'var(--color-bg-secondary)';
    btn.classList.toggle('lang-btn-active', ativo);
  });
  document.documentElement.lang = lang === 'pt' ? 'pt-BR' : lang === 'en' ? 'en' : 'zh-CN';
  localStorage.setItem('idioma', lang);
}

// ── Toast de feedback ────────────────────────────────────────────
function mostrarToast(mensagem, tipo = 'sucesso') {
  const cores = { sucesso: { border: '#FF6B00' }, erro: { border: '#e24b4a' } };
  const border = (cores[tipo] || cores.sucesso).border;
  const toast = document.createElement('div');
  toast.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(80px);background:#1a1a1a;border:0.5px solid ${border};color:#fff;padding:12px 20px;border-radius:10px;font-size:13px;font-family:'DM Sans',Arial,sans-serif;z-index:99999;transition:transform 0.3s ease,opacity 0.3s ease;opacity:0;box-shadow:0 8px 32px rgba(0,0,0,0.3);white-space:nowrap;`;
  toast.textContent = mensagem;
  document.body.appendChild(toast);
  requestAnimationFrame(() => { toast.style.transform = 'translateX(-50%) translateY(0)'; toast.style.opacity = '1'; });
  setTimeout(() => { toast.style.transform = 'translateX(-50%) translateY(80px)'; toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

// ── Dados de clima (só a busca/mapeamento — cada pagina continua
// desenhando o widget com seu proprio HTML/CSS ate o Bloco 2 unificar
// a marcacao visual tambem) ──────────────────────────────────────
async function buscarDadosClima() {
  const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-25.4284&longitude=-49.2733&current=temperature_2m,weathercode&timezone=America%2FSao_Paulo');
  const data = await res.json();
  const temp = Math.round(data.current.temperature_2m);
  const code = data.current.weathercode;

  const icones = {
    0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
    45: '🌫️', 48: '🌫️', 51: '🌦️', 61: '🌧️',
    71: '❄️', 80: '🌦️', 95: '⛈️'
  };
  const condicoes = {
    0: 'Ensolarado', 1: 'Poucas nuvens', 2: 'Parcialmente nublado',
    3: 'Nublado', 45: 'Neblina', 51: 'Garoa', 61: 'Chuva',
    71: 'Neve', 80: 'Pancadas', 95: 'Tempestade'
  };

  const now = new Date();
  return {
    temp,
    icone: icones[code] || '🌡️',
    condicao: condicoes[code] || 'Curitiba',
    dataFormatada: now.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
  };
}
