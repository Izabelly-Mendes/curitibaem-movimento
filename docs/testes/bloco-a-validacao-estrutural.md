# Fase 1 — Bloco A: Validação estrutural (RLS, GRANTs, gatilhos)

- **Data:** 2026-10-05
- **Branch:** `reestruturacao-v2`
- **Migrations:** `0001_criar_perfis.sql`, `0002_is_gestor_e_protecao_perfis.sql`,
  `0003_policies_grants_signup_perfis.sql`
- **Escopo desta validação:** **somente estrutural.** Por decisão explícita,
  nenhum usuário do Supabase Auth foi criado nesta etapa, e nenhum teste de
  sessão/login real foi realizado. Ver seção "Pendente" abaixo.

## O que foi validado (confirmado por introspecção direta do banco)

### 1. Policies de `perfis`
| Policy | Comando | `USING` | `WITH CHECK` |
|---|---|---|---|
| `perfis_select_proprio_ou_gestor` | SELECT | `(id = auth.uid()) OR is_gestor()` | — |
| `perfis_update_proprio_ou_gestor` | UPDATE | `(id = auth.uid()) OR is_gestor()` | `(id = auth.uid()) OR is_gestor()` |

Sem policy de INSERT (só o trigger de signup escreve) e sem policy de DELETE
(nunca se apaga, só se desativa) — confirmado pela ausência de qualquer
outra policy na lista.

### 2. GRANTs em `perfis`
- `anon`: **REFERENCES, TRIGGER, TRUNCATE apenas** — sem SELECT/INSERT/UPDATE/DELETE.
  **Confirmado: `anon` não tem nenhum acesso a `perfis`**, como exigido.
- `authenticated`: REFERENCES, **SELECT**, TRIGGER, TRUNCATE, **UPDATE** — exatamente
  o grant explícito feito na migration 0003, sem INSERT/DELETE (protegido em
  duas camadas: nem GRANT nem policy existem para essas operações).

### 3. Funções — `security_type` e `search_path`
| Função | `security_type` | `search_path` fixado |
|---|---|---|
| `is_gestor` | DEFINER | `search_path=public` ✅ |
| `proteger_campos_sensiveis_perfis` | INVOKER | `search_path=public` ✅ |
| `criar_perfil_no_signup` | DEFINER | `search_path=public` ✅ |

Todas as 3 funções têm `search_path` travado — proteção contra sequestro de
search_path confirmada nas 3, não só nas 2 anteriores.

### 4. Triggers
| Trigger | Tabela | Evento | Timing |
|---|---|---|---|
| `trg_proteger_campos_sensiveis_perfis` | `public.perfis` | UPDATE | BEFORE |
| `trg_criar_perfil_no_signup` | `auth.users` | INSERT | AFTER |

Os dois gatilhos esperados existem, nos eventos e tabelas corretos.

### 5. Garantia estrutural: `role`/`ativo` nunca vêm de metadata

Código-fonte completo de `criar_perfil_no_signup()` obtido diretamente do
banco (não do arquivo de migration — prova que o que está rodando é
exatamente o que pretendíamos):

```sql
CREATE OR REPLACE FUNCTION public.criar_perfil_no_signup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.perfis (id, nome, role, ativo)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1)),
    'corretor',
    true
  );
  return new;
end;
$function$
```

Confirmado: `role` e `ativo` são **literais fixos** (`'corretor'`, `true`) no
corpo da função — não há nenhuma leitura de `raw_user_meta_data` para esses
dois campos, em nenhum caminho. Só `nome` lê metadata, com fallback seguro
(e-mail como nome), e `nome` não é um campo de autorização. **Não existe,
estruturalmente, nenhum caminho pelo qual um dado controlado pelo usuário
resulte em `role='gestor'`.**

### 6. Integridade do restante do banco
- As 7 tabelas pré-existentes: contagem de colunas idêntica à Fase 0/Etapas
  1-3 (7/10/6/8/9/11/11) — nenhuma alteração inesperada.
- `perfis`: 0 registros — nenhum resíduo de teste, nenhum dado criado.

### 7. Sistema em produção
`login.html` verificado ao vivo, sem erros no console.

## PENDENTE DE VALIDAÇÃO PONTA A PONTA

Por decisão explícita (priorizar construção da estrutura agora, concentrar
testes de autenticação numa rodada posterior quando o fluxo novo estiver
completo), os itens abaixo **não foram testados** e não devem ser
considerados aprovados — só a estrutura que os viabiliza foi preparada:

- Login real via `supabase.auth.signInWithPassword()`
- Emissão e validação de JWT real
- `auth.uid()` resolvendo corretamente numa sessão real (só foi validado via
  simulação, na Etapa 3)
- Corretor autenticado lendo o próprio perfil via API real
- Corretor autenticado impedido de acessar perfil de outro via API real
- Gestor autenticado enxergando os perfis permitidos via API real
- RLS filtrando corretamente com usuário autenticado de verdade (não
  simulado)
- Gestor inativo perdendo privilégios de gestor em sessão real
- Logout e persistência de sessão
- Definição de senha (fluxo de convite)
- Recuperação de senha
- Fluxo completo de autenticação pela aplicação (login único)

Esses itens serão concentrados numa rodada de validação própria, quando o
login único e a experiência nova (Bloco C) já estiverem implementados —
evitando criar e descartar usuários de teste repetidamente a cada bloco
técnico.
