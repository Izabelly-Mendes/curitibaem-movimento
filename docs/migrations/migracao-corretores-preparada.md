# Migração de corretores reais — preparada, NÃO executar sem autorização

> Este documento descreve e versiona o mecanismo que será usado no **Bloco
> D** para migrar os corretores reais. **Nada aqui é executado pelo Bloco
> B.** A execução real contra `corretores` é um ponto de parada obrigatório
> independente (ADR 0001, Fase 1 reorganizada).

## Mapeamento exato

| Campo em `corretores` | Vira | Observação |
|---|---|---|
| `id` | `perfis.migrado_de_corretor_id` | Preservado como referência histórica. **Não** vira o novo `perfis.id` — esse é sempre o `id` gerado pelo Supabase Auth na criação da conta. |
| `nome` | `perfis.nome` | Preservado literal. |
| `email` | `auth.users.email` | Vira a identidade de login. |
| `whatsapp` | `perfis.whatsapp` | Preservado literal. |
| `portal_token` | `perfis.portal_token` | **Preservado literal, nunca regenerado** — é o que mantém os links já compartilhados com clientes funcionando. |
| `ativo` | `perfis.ativo` | Preservado literal (sobrescreve o `true` padrão do gatilho de signup, se o corretor estiver inativo). |
| `senha_hash` | *(não migrado)* | SHA-256 sem sal, incompatível e inseguro — cada corretor define senha nova via convite, fora deste bloco. |
| `criado_em` | *(não migrado para `perfis.criado_em`)* | `perfis.criado_em` registra quando o **novo** perfil foi criado; a data original de cadastro permanece intacta na linha congelada de `corretores`. |

Corretores com `portal_token` nulo (se houver) não precisam de tratamento
especial: a função `copiarMeuLink()` já existente em `index.html` gera o
token na primeira vez que o corretor o usa, caso esteja nulo — esse
comportamento continua válido depois da migração.

## Mecanismo em 2 fases (para o Bloco D)

A criação de uma conta em `auth.users` **não pode ser feita por `INSERT`
direto em SQL** — o Supabase gerencia hashing de senha e estado interno do
GoTrue por fora do schema público, então o caminho suportado é sempre a
Admin API, que exige a `service_role key` (nunca em código versionado,
nunca no navegador — sempre variável de ambiente, em execução server-side
pontual).

**Fase 1 — criar a conta (dispara `criar_perfil_no_signup` automaticamente):**
```js
// Executar manualmente, uma vez, no Bloco D, apos autorizacao.
// SUPABASE_SERVICE_ROLE_KEY vem de variavel de ambiente - nunca hardcoded.
const { data, error } = await supabaseAdmin.auth.admin.createUser({
  email: corretor.email,
  email_confirm: true,       // conta pronta, sem confirmar por e-mail
  user_metadata: { nome: corretor.nome }
  // sem senha aqui - definida depois pelo proprio corretor via convite
});
// data.user.id = novo id em auth.users (e em perfis, pelo gatilho)
```

**Fase 2 — completar o perfil com os dados preservados:**
```sql
update perfis set
  whatsapp = '<corretor.whatsapp>',
  portal_token = '<corretor.portal_token>',   -- literal, nunca gerado de novo
  ativo = <corretor.ativo>,
  migrado_de_corretor_id = '<corretor.id>'
where id = '<data.user.id da Fase 1>';
```

A Fase 2 roda com `service_role` (contorna RLS) ou, futuramente, como uma
ação de gestor autenticado — qualquer um dos dois já tem permissão pelas
policies do Bloco A.

**O que o Bloco D ainda vai precisar decidir** (não é escopo do Bloco B):
rodar a migração para todos os corretores de uma vez ou em lotes; qual
critério usar para decidir se um corretor inativo também é migrado agora ou
só quando reativado.

## Compatibilidade futura (cadastro de corretor pelo admin)

O mesmo mecanismo de 2 fases é o que o painel do gestor usará no futuro
para cadastrar um corretor novo (não migrado, genuinamente novo): Fase 1
idêntica; Fase 2 grava `portal_token` gerado na hora (não preservado, pois
não existe um antigo) e `migrado_de_corretor_id` fica nulo. Nenhuma mudança
de arquitetura é necessária para suportar os dois casos.
