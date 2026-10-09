# ADR 0002 — Portal Único (Cliente + Corretor + Gestor)

- **Status:** Blocos 1, 2 e 3 implementados e validados (2026-10-09). Base
  técnica da Fase 2 aprovada para a Fase 3. **Cutover definitivo
  (produção, migração dos 32 corretores, desligamento do legado)
  continua pendente** — ver `docs/testes/bloco-3-validacao-final.md`.
- **Data:** 2026-10-08 (criação) · atualizado 2026-10-09
- **Fase:** Fase 2 da reestruturação (depende da base técnica validada na
  Fase 1 — ver [ADR 0001](0001-autenticacao-usuarios-roles.md) e
  `docs/testes/bloco-d-rodada-concentrada.md`)
- **Decisores:** Izabelly (produto) · Claude (arquitetura/implementação)

---

## 1. Problema original

`index.html` ("material interno", exige login) e `cliente.html` (portal
público, sem login) cobrem as **mesmas 16 seções de conteúdo**, byte a
byte idênticas na maior parte dos casos, mas evoluíram como dois arquivos
separados desde que `cliente.html` foi redesenhado (commits "redesign
header and hero", "redesign cards Dados de Curitiba"). Inventário
levantado antes desta decisão encontrou:

- **10 funções JavaScript duplicadas**, várias em pares com sufixo
  "Interno" (`renderizarCard`/`renderizarCardInternoSupabase`,
  `TEMA_LABELS`/`TEMA_LABELS_INTERNO` etc.) — evidência direta de fork
  por copy-paste, divergindo organicamente desde então.
- **1 bug real**: os 3 botões de CTA do WhatsApp existem em `index.html`,
  mas estão mortos (`href="#"`, nenhuma função os ativa) — foram colados
  de `cliente.html` sem a lógica.
- **Resíduos de estilo**: `index.html` ainda tinha cores de um tema escuro
  antigo (`#FF6B00`, `rgba(255,255,255,...)`) em vez dos tokens atuais do
  design system.
- **2 clients Supabase independentes** dentro do próprio `cliente.html`,
  com a mesma anon key hardcoded duas vezes.
- **1 conteúdo genuinamente exclusivo**: o bloco `#dc-airbnb-impact`
  (impacto econômico do Airbnb, dados FGV) só existe em `cliente.html`.

## 2. Decisão tomada

Unificar em **uma única base de portal**, servida na URL pública atual
(`cliente.html` — preservada exatamente, nenhum link quebra), que se
adapta por perfil via `auth.js`:

```
visitante (sem sessão)          → portal público, igual a hoje
  + ?c=<portal_token>            → personalizado (corretor/WhatsApp)
corretor (sessão, role=corretor) → + Meu link / Meu perfil / Sair
gestor (sessão, role=gestor)     → + tudo do corretor + link para Administração
```

Direção visual: a de `cliente.html` (mais recente, já alinhada ao design
system). `index.html` perde suas poucas peças exclusivas (ferramentas de
corretor) só depois de portadas para a base única — não é apagado até a
validação completa (Bloco 3).

## 3. Alternativas consideradas

1. **Dois arquivos, conteúdo compartilhado via include em runtime** —
   descartada: resolveria só a duplicação de conteúdo, manteria 2 arquivos
   "quase" sincronizados para sempre, e não atende ao pedido explícito de
   "não quero três portais diferentes".
2. **Arquivo único com renderização por perfil** — **escolhida**. Alinhada
   diretamente ao que foi pedido; elimina a categoria inteira de
   duplicação, não só uma parte.

## 4. Escopo — o que entra e o que fica para a Fase 3

**Fase 2:** unificação de `cliente.html`/`index.html`, ponto de entrada
"Administração" para gestor (sessão já reconhecida por `admin.html` desde
o Bloco C da Fase 1 — não exige mudança de autenticação), correção dos
achados técnicos do inventário.

**Fase 3 (fora de escopo agora):** redesenho do `admin.html` em si.

## 5. Blocos de implementação

- **Bloco 1 — Preparação**: extrair lógica genuinamente duplicada para
  `portal-shared.js`; criar `obterContextoVisitante()` (versão não
  bloqueante de `protegerPagina()`) em `auth.js`; este ADR.
- **Bloco 2 — Portal único**: unificar o HTML/CSS em `cliente.html`,
  portar ferramentas de corretor/gestor condicionadas à sessão, corrigir
  achados técnicos restantes (CTAs mortos, client Supabase duplicado).
- **Bloco 3 — Validação e cutover**: testar os 3 perfis na base única;
  `index.html` vira redirect para `cliente.html`; documentação final.

## 6. O que está fora de escopo mesmo dentro da Fase 2

Migração dos 32 corretores reais, convites/e-mails, deploy em
`main`/produção, remoção de autenticação antiga — seguem exatamente as
mesmas regras e pontos de parada já em vigor desde a Fase 1.

## 7. Riscos

Maior risco: quebrar um link de `portal_token` já compartilhado com
cliente real — mitigado por manter a URL/arquivo público (`cliente.html`)
intacto como destino, nunca renomeado. Escolher a direção visual de
`cliente.html` como vencedora é decisão de produto, já validada com a
Izabelly antes deste ADR.

## 8. Consequências

Elimina 10 duplicações de função, 1 bug de CTA morto, resíduos de estilo
fora do design system, e 1 duplicação de client Supabase. Deixa uma única
fonte de conteúdo para as 16 seções, preparada para evoluir sem o risco de
divergência que motivou este ADR.
