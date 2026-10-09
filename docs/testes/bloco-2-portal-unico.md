# Fase 2 — Bloco 2: Construção do portal único (validação)

- **Data:** 2026-10-09
- **Branch:** `reestruturacao-v2`
- **ADR:** [0002-portal-unico.md](../decisions/0002-portal-unico.md)
- **Conta usada:** gestor real (`izabelly@adiferencial.com.br`), sessão já
  existente, reaproveitada sem nova criação nem alteração de dados.

## O que foi feito em `cliente.html`

1. **Consolidação dos 2 clients Supabase em 1**: `supabaseClient` e `sb`
   (que criavam cada um sua própria instância de `GoTrueClient` com a
   mesma anon key hardcoded duas vezes) agora apontam para o `authClient`
   único de `auth.js`. Nenhuma lógica de consulta foi alterada — só a
   origem do client.
2. **Bloco de ferramentas internas** (`#ferramentas-internas`), inserido
   no fim da navegação lateral, depois das 16 seções, separado por um
   divisor discreto. Populado via `inicializarFerramentasInternas()`:
   - Visitante (`obterContextoVisitante().tipo === 'visitante'`): bloco
     permanece `display:none`, nada é renderizado.
   - Corretor: "🔗 Meu link", "👤 Meu perfil", "↪ Sair".
   - Gestor: tudo do corretor + "⚙️ Administração" (`admin.html`).
3. **`copiarMeuLinkPortal()`**: gera (se não existir) ou reaproveita
   `perfis.portal_token` do usuário autenticado e copia
   `<origem atual>/cliente.html?c=<token>` — usa `window.location.origin`
   em vez de URL hardcoded, funcionando igual em local/preview/produção.
4. **Nenhuma mudança em** `getCorretor()`/`inicializarPortal()` (a
   personalização pública por `?c=`) — só a origem do client, lógica
   idêntica.

## Separação de contextos — confirmada na prática

`inicializarFerramentasInternas()` só lê `obterContextoVisitante()`
(sessão). `inicializarPortal()` só lê o parâmetro `?c=` da URL. As duas
funções não compartilham estado, não se chamam uma à outra, e foram
testadas separadamente (ver abaixo) — exatamente a regra registrada em
`docs/USUARIOS-E-PERMISSOES.md`.

## Testes executados

| Cenário | Resultado |
|---|---|
| Visitante sem sessão, sem `?c=` | ✅ portal carrega normalmente, nenhuma ferramenta interna aparece, console sem erros |
| Visitante com `?c=` **inválido** | ✅ sem erro, cai no fallback padrão (WhatsApp genérico), nenhuma ferramenta interna aparece |
| Responsividade mobile (375px) | ✅ layout correto, sem erro de console |
| **Gestor autenticado (sessão real)** | ✅ as 4 ferramentas aparecem corretamente, incluindo "Administração" — confirma `role='gestor'` sendo lido corretamente da sessão real |
| Produção (`cliente.html` real) | ✅ inalterada, console sem erros |

## Pendente (não testado nesta rodada, risco considerado baixo)

- **Clique em "Meu link"** (geração/cópia do `portal_token` da gestora) —
  não exercitado para não escrever em `perfis` fora do necessário agora;
  mesmo padrão de código já validado em `index.html` na Fase 1.
- **Navegação "Administração" → `admin.html`** sem novo login — não
  reclicado nesta rodada; o mecanismo (`verificarSessaoGestor()`
  reconhecendo a mesma sessão) já foi exaustivamente validado no
  **Bloco D da Fase 1**.
- **`?c=` com token real válido** — não testado com token de corretor
  real nesta rodada (evita consulta desnecessária); a função é
  byte-idêntica à anterior, só mudou a origem do client.
- Corretor comum (não gestor) com sessão real — segue a mesma lacuna já
  registrada desde a Fase 1 (só testado por simulação/estrutura).

## Correções técnicas do inventário — status

| Item do inventário | Status |
|---|---|
| Funções JS duplicadas | Resolvidas no Bloco 1 (6 de 10) — as 4 restantes (`navegarSecao`/`toggleMobileSidebar`/`renderizarCard*`) ficam obsoletas quando `index.html` virar redirect no Bloco 3, não precisam de merge agora |
| Clients Supabase duplicados | ✅ Resolvido neste bloco |
| CTAs sem funcionamento | Bug vive só em `index.html` (preservado como está, por decisão explícita, até o Bloco 3) — `cliente.html` nunca teve esse problema |
| Resíduos técnicos de estilo | Resolvido no Bloco 1 (`trocarIdioma`) |

## Confirmações

Nenhum dado real alterado (sessão da gestora só foi lida, não escrita).
Nenhum e-mail disparado. Nenhum merge em `main`. Produção intacta.
`index.html` não foi tocado neste bloco. `admin.html` não foi tocado.
