# Fase 0 — Estado atual do sistema (ANTES da reestruturação)

> **Este documento é uma fotografia do sistema em 2026-10-05, antes de qualquer
> correção da reestruturação.** Ele descreve o que existe, não o que deveria
> existir. Não deve ser tratado como documentação definitiva — será substituído
> por `ARQUITETURA.md`, `BANCO-DE-DADOS.md`, `AUTENTICACAO.md` etc. ao final das
> fases seguintes.
>
> Convenção: 🔵 confirmado no código ou por introspecção direta do banco ·
> 🟡 inferido/dedução lógica, não testado ao vivo · 🔴 não foi possível
> confirmar.

## 1. Estado do Git no início da Fase 0

- Branch de trabalho: `reestruturacao-v2`, criada a partir de `main` no commit
  `34a195b` ("wip: card de impacto economico do Airbnb no portal do cliente").
- `main` estava 1 commit à frente de `origin/main` no momento da criação da
  branch (não foi feito push).
- Branch local `master` é órfã (1 commit único, sem ancestral comum com
  `main`) — não utilizada, não alterada.
- Achado: o arquivo local não versionado `.claude/settings.local.json`
  mostrava evidência de chamadas `curl` diretas contra a API REST do Supabase
  em produção, feitas por uma sessão anterior deste assistente, incluindo uma
  tentativa de `ALTER TABLE corretores ADD COLUMN whatsapp/portal_token` via
  um suposto endpoint `rpc/sql`. Busca completa no repositório e em todo o
  histórico Git (todas as branches) não encontrou nenhuma referência a esse
  endpoint — a introspecção do banco real (seção 3) confirma que ele **não
  existe hoje**.

## 2. Schema real do Supabase (introspecção direta, 2026-10-05)

### 2.1 Tabelas e colunas confirmadas

| Tabela | Colunas confirmadas no banco real | Em uso pelo código? |
|---|---|---|
| `corretores` | id, nome, email, senha_hash, ativo, criado_em, atualizado_em, **whatsapp**, **portal_token** (UNIQUE) | Sim |
| `acessos_corretores` | id, corretor_id (FK→corretores.id), entrou_em, saiu_em, duracao_minutos, ip, user_agent | Sim |
| `blocos_conteudo` | id, titulo, conteudo, tipo, visivel_cliente, ordem, created_at, updated_at, slug, link_fonte | Sim |
| `rascunhos_curadoria` | id, titulo, conteudo, status, created_at, tema, link_fonte, kpi_valor, kpi_label, foi_publicado, **imagem_url** | Sim |
| `config_visual` | id, cor_principal, cor_fundo, cor_header, fonte_titulo, fonte_corpo, tamanho_fonte, updated_at | Não (nenhuma referência no frontend) |
| `empreendimentos` | id, nome, slug (UNIQUE), percentual_obra, descricao, foto_url, proximas_etapas, comunicados, ativo, created_at, updated_at | Não |
| `clientes` | id, nome, email, token (UNIQUE), empreendimentos_ids (array), created_at | Não |

Negrito = colunas confirmadas no banco real que **não existem em nenhum
arquivo `.sql` do repositório**.

### 2.2 Constraints e integridade

- Única `FOREIGN KEY` de todo o banco: `acessos_corretores.corretor_id →
  corretores.id`.
- `clientes.empreendimentos_ids` é um array de texto solto, **sem FK real**
  para `empreendimentos` — confirma que a relação nunca foi implementada de
  verdade.
- `corretores.email`, `corretores.portal_token`, `clientes.token`,
  `empreendimentos.slug` têm constraint UNIQUE.
- Nenhum índice manual de performance — só os automáticos de PK/UNIQUE.
- Nenhum trigger ativo em nenhuma tabela do schema `public`.

### 2.3 RLS — confirmado ao vivo

Todas as 7 tabelas têm `relrowsecurity = true` (RLS habilitada).

**Mas:**
- Em `blocos_conteudo` e `rascunhos_curadoria` existem **8 policies cada**,
  duplicadas: um conjunto `allow_public_*` (de `rls-e-conteudo.sql`) e outro
  `anon_*` (de `setup.sql`), ambos permissivos (`USING true` /
  `WITH CHECK true`), fazendo exatamente a mesma coisa. Os dois scripts foram
  executados contra o banco real e nunca consolidados.
- `corretores` e `acessos_corretores` têm 1 policy cada, `FOR ALL USING
  (true) WITH CHECK (true)` — permissão total, sem exceção, inclusive para
  ler/alterar `senha_hash`.
- `config_visual` tem policies parcialmente duplicadas (falta
  `anon_delete_config`, diferente das outras).
- **GRANT real por tabela** (quem o `anon` pode de fato acessar, além da
  RLS): `acessos_corretores`, `blocos_conteudo`, `config_visual`,
  `corretores` e `rascunhos_curadoria` têm GRANT completo de
  SELECT/INSERT/UPDATE/DELETE para `anon`. **`clientes` e `empreendimentos`
  NÃO têm** esse GRANT (só REFERENCES/TRIGGER/TRUNCATE) — ou seja, apesar da
  RLS permissiva, essas 2 tabelas órfãs são, na prática, inacessíveis pela
  anon key.

**Conclusão confirmada (não mais inferida):** qualquer pessoa com a anon key
pública — que está embutida em todas as páginas do site — pode ler e
escrever livremente em `corretores` (incluindo `senha_hash` de todos os
corretores), `blocos_conteudo`, `rascunhos_curadoria`, `config_visual` e
`acessos_corretores`, via chamada direta à API REST do Supabase, sem nunca
passar pelo site. **CRÍTICO.**

### 2.4 Funções

Só existem 2 funções no schema `public`, ambas **órfãs** (não amarradas a
nenhum trigger ativo hoje, confirmado por introspecção):

- **`handle_new_auth_user`** (`SECURITY DEFINER`, dono `postgres`) — padrão
  de trigger do Supabase Auth: ao criar um usuário em `auth.users`, insere
  uma linha em `public.usuarios` com `role` (`GESTOR_ADMIN`/`CORRETOR`),
  `creci`, `telefone`, `foto_url`.
- **`enforce_usuario_update_rules`** (`SECURITY INVOKER`, dono `postgres`) —
  regras de negócio sobre essa mesma tabela `usuarios`: só `GESTOR_ADMIN`
  muda `role`/`ativo`; ninguém se autodesativa; sempre precisa sobrar 1
  gestor ativo. Chama `public.is_gestor_admin()`.

**Nenhuma das duas pode funcionar hoje**: `public.usuarios` não existe como
tabela, `public.is_gestor_admin()` não existe como função, nenhuma das duas
está anexada como trigger em nada, e `auth.users` tem 0 linhas (Supabase Auth
nunca foi usado). É um desenho de RBAC mais completo que o atual, iniciado e
abandonado no meio, direto no SQL Editor — nunca versionado.

Ambas têm `EXECUTE` concedido a `PUBLIC` (padrão do Postgres, ninguém
revogou) — mas por serem funções de trigger (`RETURNS trigger`), não podem
ser chamadas diretamente fora de um contexto de trigger; na prática não são
exploráveis como RPC.

**Não existe, hoje, nenhuma função de execução de SQL arbitrário no banco.**
A suspeita levantada por evidência local (`.claude/settings.local.json`) não
se confirma no estado atual.

### 2.5 Realtime

Só `blocos_conteudo` está na publicação `supabase_realtime`.
`rascunhos_curadoria` **não está**, apesar de `realtime-e-blocos.sql` mandar
incluí-la e apesar do código (`admin.html`, `index.html`) se inscrever para
mudanças dela. **Bug funcional confirmado:** a aba "Dados de Curitiba" do
admin e o feed de novidades não atualizam sozinhos em tempo real — só em
reload manual da página.

## 3. Diferenças banco real × repositório

| Item | Banco real | Repositório | Diferença | Impacto |
|---|---|---|---|---|
| `corretores.whatsapp` | existe | não existe | schema divergente | Alto |
| `corretores.portal_token` (UNIQUE) | existe | não existe | schema divergente | Alto |
| `rascunhos_curadoria.imagem_url` | existe | não existe | schema divergente | Médio |
| `public.usuarios` (tabela) | não existe | não existe (nunca existiu) | função órfã referencia tabela inexistente | Médio (risco p/ Fase 1) |
| `public.is_gestor_admin()` | não existe | não existe | função órfã referencia função inexistente | Médio (risco p/ Fase 1) |
| `enforce_usuario_update_rules` (função) | existe, órfã | não existe em nenhum `.sql` | função não versionada | Médio |
| `handle_new_auth_user` (função) | existe, órfã, `SECURITY DEFINER` | não existe em nenhum `.sql` | função não versionada | Médio |
| RPC de SQL arbitrário | **não existe** | não existe | suspeita inicial não confirmada | Resolvido |
| `rascunhos_curadoria` no Realtime | **não está** publicada | script manda incluir | Realtime quebrado para curadoria | Alto (bug confirmado) |
| Policies RLS em `blocos_conteudo`/`rascunhos_curadoria` | 8 policies duplicadas cada | 2 scripts diferentes, nunca consolidados | redundância, não insegurança adicional | Baixo/Médio |
| GRANT `anon` em `clientes`/`empreendimentos` | ausente (sem SELECT/INSERT/UPDATE/DELETE) | `setup.sql` dá RLS permissiva | tabelas órfãs são inacessíveis na prática, apesar da RLS aberta | Informativo |
| GRANT + RLS nas outras 5 tabelas | GRANT completo + RLS `true` | confirma intenção dos `.sql` | acesso irrestrito real via anon key, senhas incluídas | **Crítico confirmado** |

## 4. Configurações e variáveis (ver também auditoria original)

Confirmado por leitura de código — ver mensagem da auditoria inicial para a
tabela completa de variáveis de ambiente e segredos hardcoded. Não repetido
aqui para evitar duplicidade; nenhuma mudança desde então.

🔴 **Não confirmado:** se as variáveis `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`CRON_SECRET` e `RESEND_API_KEY` estão de fato configuradas no painel da
Vercel (só sei o que o código *espera*, não o que está *setado* em
produção). Verificável em Vercel → Settings → Environment Variables, ou nos
logs de execução do cron em Vercel → Deployments → Functions.

## 5. Mapas de experiência (cliente / corretor / admin) e pipeline de curadoria

Sem mudanças em relação à auditoria original — ambos continuam válidos como
fotografia do estado atual, já que nada foi alterado nesta fase.

## 6. Riscos a considerar antes da Fase 1

1. Existe um desenho de RBAC mais maduro (`usuarios` + `role` +
   `is_gestor_admin()`) começado e abandonado direto no banco — vale
   perguntar à pessoa responsável se foi intencional antes de decidir se a
   Fase 1 parte do zero ou retoma esse caminho.
2. `rascunhos_curadoria` fora da publicação Realtime é um bug ativo, não
   hipotético — afeta a experiência do admin hoje.
3. Produção já foi alterada por fora do Git pelo menos duas vezes
   (`whatsapp`/`portal_token`, `imagem_url`) — o hábito de alterar o schema
   direto no SQL Editor sem registrar em arquivo deve ser interrompido antes
   da Fase 1, ou a divergência só vai crescer.
4. Policies RLS duplicadas em 2 tabelas não representam risco adicional (são
   logicamente equivalentes), mas tornam qualquer revisão de RLS na Fase 1
   mais trabalhosa — precisam ser lidas com atenção para não se perder no
   meio da duplicidade.
