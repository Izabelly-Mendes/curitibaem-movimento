# Autenticação — Curitiba em Movimento

> Reflete o estado **implementado e validado** em 2026-10-08 (Fase 1,
> Blocos A-D). Ver [docs/decisions/0001-autenticacao-usuarios-roles.md](decisions/0001-autenticacao-usuarios-roles.md)
> para a decisão arquitetural completa e o histórico de alternativas
> consideradas. **Cutover pendente** (ver seção final) — o sistema antigo
> continua ativo em produção em paralelo.

## Visão geral

Autenticação é inteiramente delegada ao **Supabase Auth**. Não existe mais
hash de senha próprio, nem senha administrativa fixa no código do sistema
novo (o sistema antigo, em produção, ainda tem ambos — ver "Cutover
pendente").

```
usuário → login único (email+senha) → Supabase Auth → sessão (JWT)
        → perfis (role, ativo) → redirecionamento → RLS garante o resto
```

## Login único

Uma única tela (`login.html`) para `corretor` e `gestor`. Fluxo:

1. `authClient.auth.signInWithPassword({ email, password })`
2. Carrega o perfil correspondente em `perfis` (`select * where id = auth.uid()`)
3. Verifica `ativo` — se falso, desloga e mostra mensagem
4. Lê `role` e redireciona: `gestor` → `admin.html`, `corretor` → `index.html`
5. Registra o acesso em `acessos_corretores` (`perfil_id`, auxiliar de UX — não é prova de autenticação)

## Sessão

Gerenciada inteiramente pela biblioteca `supabase-js` — 1 única chave de
armazenamento (gerenciada pela lib, não por nós), persistência automática
via refresh token. Substitui as 7 chaves soltas de `sessionStorage`/
`localStorage` do sistema antigo.

Validado na prática (Bloco D): sessão persiste entre reloads/fechamento de
aba sem exigir novo login.

`sessionStorage['acesso_id']`/`['acesso_entrou_em']` continuam existindo,
mas só como dado **auxiliar** (calcular duração de sessão ao sair) — nunca
tratado como prova de autenticação ou autorização em nenhum ponto do
código.

## Helper único (`auth.js`)

Usado por `login.html`, `perfil.html`, `index.html`:
- `getSessaoAtual()` / `getPerfilAtual()`
- `protegerPagina({ exigirRole })` — redireciona para `login.html` se não
  houver sessão, perfil ou `ativo`; redireciona para `index.html` se a
  role exigida não bater
- `fazerLogout()`

`admin.html` **não** usa `auth.js` (evita 2 instâncias de `GoTrueClient` no
mesmo navegador — usa o cliente Supabase que já tinha, `sb`, para a mesma
checagem).

**Importante, documentado desde a primeira versão do helper:** nada nessa
camada decide autorização de verdade — é só UX/navegação. A autorização
real é sempre a RLS no banco (ver [USUARIOS-E-PERMISSOES.md](USUARIOS-E-PERMISSOES.md)).

## Proteção de páginas

| Página | Mecanismo |
|---|---|
| `index.html` | `protegerPagina()` |
| `perfil.html` | `protegerPagina()` |
| `admin.html` | caminho antigo (senha fixa, inalterado) **+** caminho novo (`verificarSessaoGestor()`, reconhece sessão real com `role=gestor` e `ativo=true`) |
| `cliente.html` | nenhuma — público por design, identificação de corretor via `?c=<portal_token>` |

## Senha

- **Definição/troca:** `authClient.auth.updateUser({ password })` — não
  exige mais senha atual (desnecessário com sessão Supabase válida).
- **Recuperação:** `authClient.auth.resetPasswordForEmail()`, implementada
  em `login.html`. **Não testada contra envio real** — nenhum e-mail foi
  disparado até agora, de propósito (ver cutover).
- Senha nunca é armazenada fora do Supabase Auth — não em `perfis`, não em
  frontend, não em log, não em documentação.

## Bootstrap do primeiro gestor (já executado)

Como `is_gestor()` depende de já existir um gestor, o primeiro não pode ser
promovido pelo caminho normal da aplicação. Procedimento usado (único,
documentado em [docs/testes/bloco-d-rodada-concentrada.md](testes/bloco-d-rodada-concentrada.md)):
criar a conta via Supabase Dashboard (sem convite/e-mail) → desabilitar o
gatilho de proteção → `UPDATE perfis SET role='gestor'` → reabilitar o
gatilho. Mesmo procedimento não deve ser necessário de novo (gestores
seguintes são promovidos por um gestor já existente, pelo caminho normal).

## Criação de novo corretor (pelo gestor)

Endpoint `api/criar-corretor.js` (serverless, `service_role`, nunca exposto
ao navegador) — código revisado, **não exercitado em runtime** (falta
`SUPABASE_SERVICE_ROLE_KEY` configurada na Vercel). Fluxo em 2 fases
documentado em [docs/migrations/migracao-corretores-preparada.md](migrations/migracao-corretores-preparada.md).

## Cutover pendente (sistema antigo ainda ativo, nada abaixo foi feito)

- Migração dos 32 corretores reais para `auth.users`/`perfis`
- Disparo de convites/recuperação de senha para qualquer usuário real
- Identidade visual/texto dos e-mails de autenticação
- Deploy em `main`/produção
- Remoção do login antigo (hash SHA-256) e da senha administrativa fixa
- Remoção das 2 funções órfãs da Fase 0
- Teste do caminho de sessão real para `role=corretor` (só testado por
  simulação, não com login real — ver Bloco D)
- Teste em runtime do endpoint `criar-corretor`
