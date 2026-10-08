# Banco de Dados — Curitiba em Movimento

> Schema real, confirmado por introspecção direta do Supabase. Última
> atualização: 2026-10-08 (após Fase 1, Blocos A-D). Substitui a
> necessidade de reconstruir o entendimento do banco via `git log` ou
> tentativa e erro. `docs/FASE-0-ESTADO-ATUAL.md` continua congelado como
> fotografia do estado **antes** da reestruturação — este documento é o
> estado **atual**.

## Tabelas

### `perfis` (nova, Fase 1)
1:1 com `auth.users` (schema do Supabase Auth, não listado aqui).

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | uuid, PK | = `auth.users.id` |
| `nome` | text, not null | |
| `whatsapp` | text | |
| `portal_token` | text, UNIQUE | preservado literal na migração de corretor |
| `role` | `app_role` enum (`corretor`\|`gestor`), not null, default `corretor` | só alterável por gestor, via trigger |
| `ativo` | boolean, not null, default `true` | idem |
| `criado_em` / `atualizado_em` | timestamptz | `atualizado_em` mantido pelo trigger |
| `migrado_de_corretor_id` | uuid, FK → `corretores.id` | nulo para corretor genuinamente novo |

RLS habilitada desde a criação. Policies e grants: ver [USUARIOS-E-PERMISSOES.md](USUARIOS-E-PERMISSOES.md).

### `corretores` (legada, pré-Fase 1, não alterada)
`id, nome, email, senha_hash, ativo, criado_em, atualizado_em, whatsapp, portal_token`.
Continua ativa e em uso pelo sistema antigo em produção. Vira referência
histórica (`migrado_de_corretor_id`) após a migração real (cutover, não
feita ainda). **Nunca será apagada** enquanto `acessos_corretores.corretor_id`
depender dela via FK.

### `acessos_corretores`
`id, corretor_id (FK→corretores), entrou_em, saiu_em, duracao_minutos, ip,
user_agent, perfil_id (FK→perfis, nova no Bloco B)`.

Linhas históricas: `corretor_id` preenchido, `perfil_id` nulo — nunca
reescritas. Linhas novas (pós login único): `perfil_id` preenchido,
`corretor_id` nulo. Distinção por presença de campo, sem coluna de flag
redundante.

### `blocos_conteudo`, `rascunhos_curadoria`, `config_visual`, `empreendimentos`, `clientes`
Sem alteração estrutural na Fase 1. Ver `docs/FASE-0-ESTADO-ATUAL.md` para
o detalhe completo — `empreendimentos` e `clientes` continuam órfãs, sem
uso no frontend.

## View

### `acessos_corretores_consolidado` (nova, Bloco B)
Unifica histórico antigo (`corretor_id`→`corretores`) e novo
(`perfil_id`→`perfis`) numa única consulta (`nome_corretor`, `origem`
`'historico'`/`'novo'`, `origem_id`).

**Criada com `security_invoker = true`** — correção de segurança aplicada
durante a implementação: por padrão uma view no Postgres avalia RLS com o
contexto do dono (que ignora RLS), não de quem consulta; sem essa opção,
qualquer autenticado veria o histórico de todos os corretores.

## Funções

| Função | `security_type` | `search_path` | Uso |
|---|---|---|---|
| `is_gestor()` | DEFINER | fixo (`public`) | RLS de `perfis` |
| `proteger_campos_sensiveis_perfis()` | INVOKER | fixo | trigger de `perfis` |
| `criar_perfil_no_signup()` | DEFINER | fixo | trigger de `auth.users` |
| `handle_new_auth_user()`, `enforce_usuario_update_rules()` | — | — | **órfãs (Fase 0)**, sem trigger ativo, referenciam objetos inexistentes (`usuarios`, `is_gestor_admin()`); remoção aprovada, não executada |

## Triggers

| Trigger | Tabela | Evento |
|---|---|---|
| `trg_proteger_campos_sensiveis_perfis` | `public.perfis` | `BEFORE UPDATE` |
| `trg_criar_perfil_no_signup` | `auth.users` | `AFTER INSERT` |

## Migrations versionadas (ordem de aplicação)

1. `0001_criar_perfis.sql` — tabela `perfis`, RLS habilitada sem policies
2. `0002_is_gestor_e_protecao_perfis.sql` — `is_gestor()`, gatilho de proteção
3. `0003_policies_grants_signup_perfis.sql` — policies definitivas, GRANTs, gatilho de signup
4. `0004_acessos_corretores_perfil_id_e_view.sql` — coluna `perfil_id`, view consolidada
5. `0005_fix_grant_acessos_corretores_authenticated.sql` — correção de GRANT faltante, encontrada na validação real

Mais o script de migração de corretores preparado (não executado):
`docs/migrations/migracao-corretores-preparada.md`.

## Pendente (cutover)

Migração real dos 32 corretores; RLS das tabelas legadas (`corretores`,
`blocos_conteudo`, `rascunhos_curadoria`, `config_visual`) continua aberta,
sem revisão — fora do escopo da Fase 1; remoção das 2 funções órfãs.
