# Fase 1 — Etapa 3: Validação comportamental de `is_gestor()` e do gatilho de perfis

- **Data:** 2026-10-05
- **Branch:** `reestruturacao-v2`
- **Migrations validadas:** `0001_criar_perfis.sql`, `0002_is_gestor_e_protecao_perfis.sql`
- **Método:** simulação controlada de `auth.uid()` via `set_config('request.jwt.claims', ...)`,
  executada como dona da tabela (`postgres`), sem criar nenhuma policy ou GRANT
  temporário. Ver ADR 0001 para a justificativa técnica dessa escolha.
- **Usuários de teste:** `teste.corretor.fase1@curitibaemmovimento.invalid` e
  `teste.gestor.fase1@curitibaemmovimento.invalid`, criados via Dashboard
  (Auto Confirm User, sem convite/e-mail), **excluídos ao final** deste
  documento ser escrito. `perfis` confirmada com 0 registros depois da
  exclusão (cascade via `on delete cascade`).

> **Importante:** esta etapa valida a lógica interna do gatilho/função,
> rodando como dona da tabela. **Não** valida o caminho real de acesso via
> RLS/API/sessão de aplicação — isso é escopo da Etapa 4, depois que as
> policies definitivas de `perfis` existirem. Os testes aqui não substituem
> os testes de acesso real da Etapa 4.

## Resultado dos 11 comportamentos obrigatórios

| # | Comportamento exigido | Teste(s) | Resultado esperado | Resultado obtido | Status |
|---|---|---|---|---|---|
| 1 | Corretor não promove a si mesmo a gestor | A, I | ERRO | `ERROR P0001: Apenas um gestor pode alterar role ou status ativo de um usuario.` (linha 5, Regra A) nas duas vezes | ✅ PASSOU |
| 2 | Corretor não altera o próprio `ativo` | B | ERRO | `ERROR P0001: Apenas um gestor pode alterar role ou status ativo de um usuario.` (linha 5) | ✅ PASSOU |
| 3 | Gestor muda `role` de outro usuário | F | sucesso | `role = 'gestor'` aplicado | ✅ PASSOU |
| 4 | Gestor ativa/desativa outro usuário | D, E | sucesso nos dois sentidos | `ativo=false` e depois `ativo=true`, ambos aplicados | ✅ PASSOU |
| 5 | Gestor não desativa a própria conta | G | ERRO | `ERROR P0001: Voce nao pode desativar a propria conta.` (linha 10, Regra B) | ✅ PASSOU |
| 6 | Último gestor ativo não perde a role `gestor` | J | ERRO | `ERROR P0001: O sistema precisa manter pelo menos um gestor ativo.` (linha 19, Regra C) | ✅ PASSOU |
| 7 | Último gestor ativo não pode ser desativado | K | ERRO | `ERROR P0001: Voce nao pode desativar a propria conta.` (linha 10, Regra B — ver nuance abaixo) | ✅ PASSOU |
| 8 | Com outro gestor ativo, alteração permitida funciona | H | sucesso | `role = 'corretor'` aplicado (backup existente) | ✅ PASSOU |
| 9 | Campo permitido não é bloqueado indevidamente | C | sucesso | `nome` alterado sem bloqueio | ✅ PASSOU |
| 10 | `atualizado_em` atualizado corretamente | C, D, E, F | timestamp muda a cada alteração bem-sucedida | confirmado em todas as 4 ocorrências | ✅ PASSOU |
| 11 | `is_gestor()` correto para cada estado | L | `true` para gestor ativo, `false` para corretor | `corretor1_eh_gestor=true`, `gestor1_eh_gestor=false` (coerente com a troca do Teste H) | ✅ PASSOU |

**12/12 testes lettered (A–L) passaram. 11/11 comportamentos obrigatórios confirmados.**

## Nuance registrada sobre o item 7 (não corrigir, apenas documentar)

A proteção "último gestor não pode ser desativado" é **sempre** alcançada pela
**Regra B** (proibição incondicional de autodesativação), e não pela Regra C
(proteção específica de último gestor), porque, no desenho atual, a única
forma de alguém chegar a tentar desativar o último gestor é o próprio gestor
tentando se autodesativar — e qualquer outro gestor que pudesse tentar isso
já contaria, por definição, como backup, fazendo a Regra C permitir a ação
(ver Teste H). A Regra C **foi** exercitada de forma direta e inequívoca no
Teste J (caminho de `role`, não de `ativo`) — confirmado pela mensagem de
erro vir da linha 19, diferente da linha 10 dos demais bloqueios de
autoproteção. O resultado funcional exigido é garantido nos dois casos; a
diferença é só qual regra é responsável por cada um.

## Confirmações finais

1. ✅ Nenhuma policy de RLS ou GRANT foi criada, alterada ou removida em
   nenhuma tabela, em nenhum momento desta etapa.
2. ✅ Nenhuma tabela além de `perfis` (e apenas os 2 registros de teste) foi
   tocada.
3. ✅ `auth.users`: os 2 usuários de teste foram excluídos ao final.
4. ✅ `perfis`: confirmado 0 registros após a exclusão (cascade).
5. ✅ Nenhum e-mail foi disparado em nenhum momento (criação via Dashboard
   "Add user" com Auto Confirm, não `inviteUserByEmail`).
6. ✅ Nenhum usuário real (corretor cadastrado ou o gestor real
   `izabelly@adiferencial.com.br`) foi afetado, criado ou mencionado em
   qualquer operação.
7. ✅ Sistema em produção (`login.html`) verificado ao vivo após a limpeza,
   sem erros no console.
8. ✅ Nenhuma correção foi aplicada à função/gatilho — todos os resultados
   bateram com o esperado na primeira tentativa, então a cláusula de "parar
   e aguardar aprovação antes de corrigir" não precisou ser acionada.

## Pendente para a Etapa 4 (não é falha, é escopo diferente)

- Validação do caminho real de acesso: sessão de aplicação de verdade
  (`supabase.auth.signInWithPassword()`), token JWT real emitido pelo
  GoTrue, passando pelas policies de RLS definitivas de `perfis` via
  PostgREST/API — ainda não existe nenhuma policy, então isso só é
  testável depois que a Etapa 4 criar as policies definitivas.
- Testes de que `anon` (sem sessão) continua sem acesso a `perfis`.
- Testes de que um corretor autenticado consegue ler o próprio perfil mas
  não o de terceiros, via API real (não simulação SQL).
