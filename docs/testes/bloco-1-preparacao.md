# Fase 2 — Bloco 1: Preparação (validação)

- **Data:** 2026-10-08
- **Branch:** `reestruturacao-v2`
- **ADR:** [0002-portal-unico.md](../decisions/0002-portal-unico.md)

## O que foi feito

Criado [portal-shared.js](../../portal-shared.js), com o que o inventário
confirmou ser **genuinamente idêntico** (ou seguro de unificar) entre
`index.html` e `cliente.html`:

| Item | Como foi tratado |
|---|---|
| `TEMA_LABELS`, `CATEGORIA_IMG` | Idênticos nos dois arquivos — movidos como estão |
| `IMAGEM_FALLBACK` | Só existia em `cliente.html` — `index.html` ganhou o mesmo fallback (correção, não regressão) |
| `toggleFontes()` | 100% idêntica — movida como está |
| `mostrarToast()` | Saída visual idêntica (cores finais batiam, só a forma de montar o objeto `cores` diferia) — movida como está |
| `trocarIdioma(lang)` | **Não era idêntica**: `index.html` usava cores de um tema escuro antigo (`#FF6B00`, `rgba(255,255,255,...)`). Unificada usando `var(--color-primary)`/`var(--color-border)`/`var(--color-bg-secondary)` — corrige o resíduo em vez de preservá-lo |
| Busca de clima | Lógica de fetch/mapeamento extraída (`buscarDadosClima()`); **cada arquivo continua desenhando o widget com sua própria marcação atual** — zero mudança visual aqui, unificação de HTML fica para o Bloco 2 |

**Deliberadamente NÃO extraído ainda** (fica para o Bloco 2, junto da
unificação visual, para não misturar "organizar código" com "mudar
aparência" no mesmo passo): `navegarSecao`/`toggleMobileSidebar` (mecânica
de menu mobile diferente entre os dois), `renderizarCard*`/
`renderizarCardAwards*` (geram HTML com classes/estrutura diferentes).

Criado `obterContextoVisitante()` em [auth.js](../../auth.js) — versão não
bloqueante de `protegerPagina()`, para o portal único do Bloco 2. **Ainda
não é chamada por nenhuma página.**

## Validação

| Checagem | Resultado |
|---|---|
| `cliente.html` local — console | ✅ sem erros |
| `cliente.html` — widget de clima renderizou (`☁️ 27°C, 8 de outubro de 2026, Curitiba, PR`) | ✅ |
| `cliente.html` — troca de idioma PT→EN (via `trocarIdioma` compartilhada) | ✅ todo o conteúdo trocou corretamente |
| `cliente.html` — WhatsApp flutuante com número padrão (sem `?c=`) | ✅ presente, `wa.me/5541999999999` |
| `cliente.html` — bloco exclusivo `#dc-airbnb-impact` | ✅ presente, intacto |
| `index.html` local — console | ✅ sem erros, nenhum símbolo removido (`TEMA_LABELS_INTERNO`/`CATEGORIA_IMG_INTERNO`) ficou referenciado em lugar nenhum |
| `index.html` — redirecionamento sem sessão | ✅ foi para `login.html` corretamente (comportamento inalterado) |
| Produção real (`login.html`) | ✅ inalterada, sem erros |

## Pendente (não é falha, é limite da validação sem sessão)

O conteúdo pós-login de `index.html` (onde `carregarClima`,
`renderizarCardInternoSupabase` etc. realmente executam) não foi
re-verificado visualmente com uma sessão real nesta rodada — as mesmas
funções, usando o mesmo módulo compartilhado, já foram confirmadas
funcionando em `cliente.html` (testável sem login). Risco residual baixo,
registrado para conferência na rodada de validação do Bloco 3.

## Confirmações

Nenhum dado real alterado. Nenhuma página de produção afetada (branch não
publicada). `cliente.html` continua na mesma URL, `portal_token` e
personalização intactos.
