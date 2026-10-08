// ══════════════════════════════════════════════════════════════════
// auth.js — Camada única de sessão (Fase 1 / ADR 0001 / Bloco C)
//
// Fonte de verdade: Supabase Auth. Este arquivo é a ÚNICA leitura/escrita
// de sessão do sistema novo — substitui as 7 chaves soltas de
// sessionStorage/localStorage usadas antes da Fase 1.
//
// IMPORTANTE: nada aqui decide autorização de verdade. Autorização real é
// sempre garantida pela RLS no banco (ver docs/decisions/0001-...md).
// As funções abaixo só cuidam de experiência/navegação no frontend —
// redirecionar quem não devia estar numa página é UX, não segurança.
// ══════════════════════════════════════════════════════════════════

const SUPABASE_URL = 'https://uocnikcoynoflxgcknii.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_nWEHxISod-7kWfXptMj6Ow_RQU6hsf2';

const authClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function getSessaoAtual() {
  const { data: { session } } = await authClient.auth.getSession();
  return session;
}

async function getPerfilAtual() {
  const session = await getSessaoAtual();
  if (!session) return null;
  const { data, error } = await authClient
    .from('perfis')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle();
  if (error) {
    console.error('[auth.js] Erro ao carregar perfil:', error);
    return null;
  }
  return data;
}

// Protege uma pagina autenticada: exige sessao + perfil existente + ativo.
// exigirRole (opcional): 'gestor' ou 'corretor' — se o perfil nao bater,
// redireciona para index.html em vez de deixar acessar.
// Retorna o perfil carregado (ou null, apos ja ter redirecionado).
async function protegerPagina(opcoes) {
  opcoes = opcoes || {};
  const session = await getSessaoAtual();
  if (!session) {
    window.location.replace('./login.html');
    return null;
  }

  const perfil = await getPerfilAtual();
  if (!perfil) {
    // Sessao existe no Auth mas sem perfil correspondente — estado
    // inconsistente, nao deveria acontecer (o gatilho de signup sempre
    // cria o perfil). Desloga por seguranca.
    await authClient.auth.signOut();
    window.location.replace('./login.html?erro=perfil_nao_encontrado');
    return null;
  }

  if (!perfil.ativo) {
    await authClient.auth.signOut();
    window.location.replace('./login.html?inativo=true');
    return null;
  }

  if (opcoes.exigirRole && perfil.role !== opcoes.exigirRole) {
    window.location.replace('./index.html');
    return null;
  }

  return perfil;
}

async function fazerLogout() {
  try { await authClient.auth.signOut(); } catch (e) { console.error('[auth.js] erro no logout:', e); }
  window.location.href = './login.html';
}

// ── Fase 2 (ADR 0002) / Bloco 1 ──────────────────────────────────────
// Versão NÃO BLOQUEANTE de protegerPagina(): nunca redireciona. Usada
// pelo futuro portal único (cliente.html), que precisa funcionar para
// visitante sem sessão — só decide o que mostrar A MAIS quando há
// sessão. Preparada agora; ainda não é chamada por nenhuma página
// (isso é trabalho do Bloco 2).
//
// Retorna sempre um objeto: { tipo, perfil }
//   tipo = 'visitante' | 'corretor' | 'gestor'
//   perfil = a linha de `perfis`, ou null para visitante
// Um perfil inativo é tratado como visitante (sem deslogar à força —
// diferente de protegerPagina, aqui não há "página exclusiva" para
// expulsar o usuário de).
async function obterContextoVisitante() {
  const session = await getSessaoAtual();
  if (!session) return { tipo: 'visitante', perfil: null };

  const perfil = await getPerfilAtual();
  if (!perfil || !perfil.ativo) return { tipo: 'visitante', perfil: null };

  return { tipo: perfil.role === 'gestor' ? 'gestor' : 'corretor', perfil };
}
