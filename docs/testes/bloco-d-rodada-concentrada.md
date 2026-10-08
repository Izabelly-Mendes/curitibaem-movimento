# Fase 1 — Bloco D: Rodada concentrada de validação (sessão real)

- **Data:** 2026-10-06 a 2026-10-08
- **Branch:** `reestruturacao-v2`
- **Conta usada:** primeiro gestor real (`izabelly@adiferencial.com.br`),
  criado via bootstrap documentado abaixo. Nenhum corretor fictício foi
  criado (decisão consciente — ver seção "Lacuna aceita").

## Bootstrap do primeiro gestor

Problema identificado antes da execução: o gatilho `proteger_campos_sensiveis_perfis`
(Etapa 2) só reconhece promoção a `gestor` quando `is_gestor()` já é
verdadeiro para quem faz a alteração — o que é impossível para o
**primeiro** gestor, já que não existe nenhum ainda. `is_gestor()` depende
de `auth.uid()`, que não existe numa sessão de SQL Editor.

**Solução aplicada** (única vez, documentada, reversível): desabilitar o
gatilho, promover, reabilitar — tudo numa única transação.

```sql
begin;
alter table perfis disable trigger trg_proteger_campos_sensiveis_perfis;
update perfis set role = 'gestor'
  where id = (select id from auth.users where email = 'izabelly@adiferencial.com.br')
  returning id, nome, role, ativo;
alter table perfis enable trigger trg_proteger_campos_sensiveis_perfis;
commit;
```

Resultado confirmado: `role = gestor`, `ativo = true`. Gatilho confirmado
reabilitado (`tgenabled = 'O'`) logo em seguida.

## Checklist validado (sessão real, não simulada)

| Item | Resultado |
|---|---|
| Login real (`signInWithPassword`) | ✅ |
| Sessão criada | ✅ |
| `auth.uid()` em contexto real | ✅ (implícito — sem isso o perfil não seria lido) |
| Carregamento do próprio perfil | ✅ |
| `role = gestor` reconhecida | ✅ |
| Equivalente real de `is_gestor()` (`verificarSessaoGestor()`) | ✅ — `admin.html` reconheceu a sessão automaticamente, **sem pedir a senha antiga** |
| RLS permitindo a leitura do próprio perfil | ✅ |
| Redirecionamento por role (login → admin.html) | ✅ |
| Acesso ao Admin | ✅ |
| "Meu perfil" (`perfil.html` via `protegerPagina()`) | ✅ |
| Logout | ✅ |
| Persistência de sessão (reabrir `admin.html` direto, sem logar de novo) | ✅ |
| Registro de acesso (`acessos_corretores.perfil_id`) | ⚠️ falhou na 1ª tentativa, corrigido e **✅ confirmado na 2ª** |

## Bug encontrado, corrigido e revalidado

Ver [docs/migrations/0005_fix_grant_acessos_corretores_authenticated.sql](../migrations/0005_fix_grant_acessos_corretores_authenticated.sql)
para o relato completo (falha → causa → correção). Resumo: `authenticated`
não tinha `GRANT` em `acessos_corretores`; corrigido; re-teste com novo
login confirmou 3 registros gravados corretamente com `perfil_id`.

## Não testado nesta rodada (adiado por decisão explícita, não por limitação técnica)

- **Troca de senha** (`perfil.html` → `auth.updateUser()`): não exercitada para não gastar trocas de senha reais só por checklist. Lógica já revisada no Bloco C.
- **Recuperação de senha por e-mail**: adiada para a rodada junto da identidade dos e-mails (cutover).
- **Lado corretor com sessão real**: nenhum corretor fictício foi criado. Lacuna aceita conscientemente — a lógica de RLS/trigger para `role=corretor` já foi exaustivamente provada por simulação na Etapa 3; o que falta é só a confirmação de que uma sessão real com `role=corretor` é redirecionada e protegida corretamente pelo frontend (`login.html`/`index.html`). Fica registrado como item a cobrir durante a Fase 2, quando o lado corretor for o foco do trabalho.
- **Endpoint `api/criar-corretor.js` em runtime**: adiado — depende de `SUPABASE_SERVICE_ROLE_KEY` na Vercel, fora de escopo agora.

## Nenhuma ação de cutover foi executada

Nenhum corretor real migrado, nenhum e-mail disparado, nenhuma alteração em
`main`/produção, login antigo e senha administrativa antiga continuam
ativos e intactos.
