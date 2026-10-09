# Usuários e Permissões — Curitiba em Movimento

> Reflete o estado **implementado e validado** em 2026-10-09. Ver
> [ADR 0001](decisions/0001-autenticacao-usuarios-roles.md) (autenticação)
> e [ADR 0002](decisions/0002-portal-unico.md) (portal único, Fase 2, em
> implementação) para as decisões completas.

## Portal único — separação de contextos (ADR 0002)

A partir da Fase 2, cliente/corretor/gestor compartilham a mesma base de
portal (`cliente.html`). Dois mecanismos **independentes** decidem coisas
diferentes, e não se misturam:

| Mecanismo | Fonte | Decide |
|---|---|---|
| Sessão autenticada (`obterContextoVisitante()` em `auth.js`) | Supabase Auth + `perfis.role` | **O que o usuário pode fazer** — quais ferramentas/permissões aparecem (Meu link, Meu perfil, Sair, Administração) |
| Parâmetro `?c=<portal_token>` na URL | Tabela `corretores` (e, após migração, `perfis`) | **Qual contato é mostrado ao visitante** — WhatsApp/nome nos CTAs públicos |

**Regra explícita:** o parâmetro `?c=` nunca concede nem retira permissão
— só personaliza a vitrine pública. Um corretor autenticado que abra um
link com `?c=` de outro corretor continua vendo suas **próprias**
ferramentas (da sessão), nunca as de quem o token identifica. Os dois
mecanismos podem coexistir na mesma página sem conflito porque respondem
perguntas diferentes.

## Papéis

Dois papéis autenticados, em `perfis.role` (`app_role`): **`corretor`** e
**`gestor`**. Visitante/cliente não é um papel de banco — é a ausência de
sessão.

## Matriz de permissões

| Ação | Visitante | Corretor | Gestor |
|---|:---:|:---:|:---:|
| Visualizar portal público (`cliente.html`) | ✅ | ✅ | ✅ |
| Acessar área autenticada | ❌ | ✅ | ✅ |
| Gerar/copiar link pessoal | ❌ | ✅ (próprio) | — |
| Alterar próprio perfil (nome, whatsapp) | — | ✅ | ✅ |
| Alterar própria senha | — | ✅ | ✅ |
| Visualizar outros perfis | ❌ | ❌ | ✅ |
| Cadastrar corretor | ❌ | ❌ | ✅ (preparado, não testado em runtime) |
| Editar/ativar/desativar corretor | ❌ | ❌ | ✅ |
| Alterar `role` de um usuário | ❌ | ❌ | ✅ |
| Editar conteúdo do portal | ❌ | ❌ | ✅ (via mecanismo legado, inalterado) |
| Aprovar/rejeitar curadoria | ❌ | ❌ | ✅ (via mecanismo legado, inalterado) |

Aplicada de verdade pela RLS no banco, não só escondendo botão — validado
na Etapa 3 (simulação) e no Bloco D (sessão real de gestor).

## RLS por tabela (estado atual)

| Tabela | SELECT | INSERT | UPDATE | DELETE | GRANT `authenticated` | GRANT `anon` |
|---|---|---|---|---|---|---|
| `perfis` | próprio ou `is_gestor()` | só o gatilho de signup | próprio ou gestor (campos sensíveis protegidos por trigger) | ninguém | SELECT, UPDATE | nenhum |
| `acessos_corretores` | **legado** — `allow_all_acessos` (`USING true`), não revisada ainda | idem | idem | idem | SELECT, INSERT, UPDATE (corrigido no Bloco D — faltava) | SELECT, INSERT, UPDATE, DELETE (legado) |
| `corretores` | **legado**, inalterada (RLS aberta) | idem | idem | idem | — | SELECT, INSERT, UPDATE, DELETE (legado) |
| `blocos_conteudo`, `rascunhos_curadoria`, `config_visual` | **legado**, inalteradas | idem | idem | idem | — | legado, amplo |

**Importante:** só `perfis` recebeu o desenho de RLS novo (Bloco A). Todas
as outras tabelas continuam com a RLS aberta encontrada na Fase 0 — isso é
deliberado (fora de escopo da Fase 1, que tratou só de autenticação/
usuários), não um esquecimento. Endereçar essas RLS é trabalho futuro,
fora desta fase.

## Funções auxiliares

- **`is_gestor()`** — `SECURITY DEFINER`, `search_path` fixo, sem
  parâmetros, `EXECUTE` restrito a `anon`/`authenticated`. Usada dentro das
  policies de `perfis` para evitar recursão de RLS.
- **`proteger_campos_sensiveis_perfis()`** (trigger `BEFORE UPDATE` em
  `perfis`) — impede: corretor alterar `role`/`ativo` (de si ou de
  terceiros); qualquer um (inclusive gestor) se autodesativar; o último
  gestor ativo perder a role ou ser desativado sem outro gestor para
  cobrir. Validado exaustivamente por simulação (Etapa 3, 12 cenários) e
  confirmado no caminho real (Bloco D).
- **`criar_perfil_no_signup()`** (trigger `AFTER INSERT` em `auth.users`,
  `SECURITY DEFINER`) — cria a linha em `perfis` para todo novo usuário.
  **Garantia estrutural:** `role` e `ativo` são sempre literais fixos
  (`'corretor'`, `true`) no código — nunca lidos de `raw_user_meta_data` ou
  qualquer dado controlado pelo usuário. Confirmado lendo o código-fonte
  direto do banco (Bloco A).

## Funções órfãs (Fase 0, não removidas ainda)

`handle_new_auth_user` e `enforce_usuario_update_rules` — referenciam uma
tabela `usuarios` e uma função `is_gestor_admin()` que nunca existiram.
Confirmado sem trigger ativo, sem dependência. Remoção aprovada em
princípio, mas é item de **cutover**, não executado ainda.

## Gestão de corretores pelo gestor

Preparado (não executado): `api/criar-corretor.js` valida que quem chama é
gestor ativo (via `service_role`, nunca confia em dado vindo do navegador),
cria a conta via Admin API, completa o perfil preservando/gerando
`portal_token`. Ver [AUTENTICACAO.md](AUTENTICACAO.md).
