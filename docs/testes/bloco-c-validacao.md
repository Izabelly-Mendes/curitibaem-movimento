# Fase 1 — Bloco C: Login único + aplicação (validação)

- **Data:** 2026-10-05
- **Branch:** `reestruturacao-v2` (nenhum merge em `main`, nenhum push)
- **Escopo:** construção da camada de login único + adaptação de
  `login.html`, `perfil.html`, `index.html`, `admin.html` + novo endpoint
  serverless `api/criar-corretor.js`. `cliente.html` **não foi tocado**.

## O que foi validado

### Regressão do sistema atual (produção real, só leitura)
- `login.html` em produção carrega sem erros (ainda roda o código antigo —
  nada foi publicado).

### Regressão via servidor estático local (arquivos da branch)
- `login.html`: renderiza, alterna "Esqueci minha senha" corretamente, sem
  erros de console.
- `perfil.html`: sem sessão, redireciona corretamente para `login.html`
  (via `protegerPagina()`).
- `index.html`: sem sessão, redireciona corretamente para `login.html`.
- `admin.html`:
  - Tela de senha antiga renderiza **sem nenhuma alteração visual**.
  - Login com a senha antiga (`Bicalho@2025`) continua funcionando —
    carrega blocos reais de `blocos_conteudo` (produção, só leitura).
  - Aba **Corretores** carrega a lista real da tabela `corretores`
    (32 registros) **sem nenhuma alteração** — a funcionalidade existente
    não foi tocada, exatamente como decidido (ver seção "Decisão de
    escopo" abaixo).
  - Logout (`Sair`) funciona sem erro, volta para a tela de senha.
- Nenhum erro de console em nenhuma das 4 páginas, em nenhum dos testes.

### Ausência de secrets no frontend
`grep` por `service_role`/`SERVICE_ROLE` em todos os `.html` do projeto:
**nenhuma ocorrência**. A `SUPABASE_SERVICE_ROLE_KEY` só existe em
`api/criar-corretor.js`, lida de `process.env`, nunca hardcoded.

### Revisão de código (sem execução)
`api/criar-corretor.js` foi revisado linha a linha: valida o JWT do
chamador contra o próprio Supabase Auth antes de qualquer ação; confirma
`role='gestor'` e `ativo=true` via `service_role` (contexto confiável
server-side) antes de criar qualquer conta; nunca envia convite; gera
`portal_token` novo só para corretor genuinamente novo (não se aplica a
migração, que preserva o token antigo — ver `migracao-corretores-preparada.md`).

## Decisão de escopo tomada durante a implementação (não é desvio do combinado)

A aba **Corretores** do `admin.html` continua lendo da tabela `corretores`
(não de `perfis`), e o botão de criar corretor **não foi ligado** ao novo
endpoint `api/criar-corretor.js` ainda. Motivo: como nenhuma migração real
aconteceu (Bloco D), apontar essa tela para `perfis` agora faria a
funcionalidade existente aparecer **vazia** para quem usa a senha antiga —
uma regressão real, mesmo numa branch não publicada. O endpoint novo está
pronto, revisado e documentado; **conectá-lo à interface** é trabalho do
Bloco D, quando a migração real tornar isso testável e útil de verdade.

## Pendente de validação ponta a ponta (rodada concentrada, pós-Bloco C)

Nada abaixo foi declarado como testado — todos dependem de sessão/JWT real:

- Login real de corretor e de gestor via `supabase.auth.signInWithPassword()`
- Redirecionamento correto por `role` após login real
- `protegerPagina()` com sessão real (hoje só testado no caminho "sem sessão")
- `admin.html` reconhecendo automaticamente uma sessão de gestor real
  (`verificarSessaoGestor()`) — só testado estruturalmente (revisão de
  código), nunca com uma sessão de verdade
- Troca de senha (`perfil.html` → `authClient.auth.updateUser()`)
- Recuperação de senha (`resetPasswordForEmail()`) — implementada, **não
  testada**, nenhum e-mail foi enviado
- `copiarMeuLink()` gerando/lendo `portal_token` de `perfis` com um
  corretor real autenticado
- `api/criar-corretor.js` em runtime (precisa de deploy + `service_role`
  configurada na Vercel + um gestor real autenticado — nenhuma dessas 3
  condições existe ainda)
- Registro de acesso (`acessos_corretores.perfil_id`) em uso real

## Confirmações

1. ✅ `service_role` não está em nenhum arquivo de frontend.
2. ✅ `cliente.html` e os links/`portal_token` atuais continuam
   funcionando — arquivo não foi alterado.
3. ✅ Nenhum usuário real foi criado ou alterado.
4. ✅ Nenhum e-mail foi disparado.
5. ✅ Produção (`curitibaem-movimento.vercel.app`) verificada ao vivo,
   sem alteração — branch não publicada, nada foi para `main`.
