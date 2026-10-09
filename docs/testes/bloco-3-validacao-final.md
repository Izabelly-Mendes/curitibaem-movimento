# Fase 2 — Bloco 3: Validação e consolidação do portal único

- **Data:** 2026-10-09
- **Branch:** `reestruturacao-v2`
- **ADR:** [0002-portal-unico.md](../decisions/0002-portal-unico.md)

## Resultado consolidado dos testes

| Contexto | Resultado |
|---|---|
| Visitante sem sessão, sem `?c=` | ✅ portal carrega normalmente, 16 seções, sem ferramentas internas, **sem redirecionamento para login** |
| Visitante com `?c=` inválido | ✅ fallback padrão, sem erro |
| Responsividade mobile (375px) | ✅ sem erro, layout correto |
| Gestor autenticado — ferramentas visíveis | ✅ (Bloco 2) |
| Gestor autenticado — **"Administração"** | ✅ **testado agora**: abre `admin.html` direto, sessão reconhecida automaticamente, sem pedir senha |
| Gestor autenticado — **"Meu perfil"** | ✅ **testado agora**: carrega `perfil.html` com dados reais (nome "izabelly", e-mail, role "Gestor", campo WhatsApp vazio mostrando placeholder corretamente) |
| Preservação dos 32 `portal_token` | ✅ **confirmado por consulta somente leitura**: 32 corretores, 32 com token, 32 tokens distintos — nenhuma duplicação, nenhuma perda, nenhum token exposto no relatório |
| `index.html` → redirect para `cliente.html` | ✅ testado localmente, sem erro de console relacionado |
| Produção real | ✅ inalterada |

## Links públicos e personalização

Confirmado: os 32 `portal_token` preservados e únicos (consulta acima).
`?c=` continua funcionando pela mesma função (`getCorretor`/
`inicializarPortal`), código inalterado desde antes da Fase 2 — só a
origem do client Supabase mudou (Bloco 2). Token inválido não gera erro.
Sessão autenticada permanece independente do parâmetro `?c=` — confirmado
por desenho (funções sem estado compartilhado) e por todos os testes
acima rodando sem interferência cruzada.

## Ferramentas por perfil — funcionamento

Visitante: nenhuma ferramenta interna, nunca exigido login. Corretor:
Meu link/Meu perfil/Sair (lógica idêntica à do gestor, não re-testada com
conta de corretor real — ver pendências). Gestor: tudo do corretor +
Administração — **as 2 ações mais importantes (Administração, Meu perfil)
testadas com sucesso nesta rodada**, com sessão real.

## Situação final de `index.html`

Transformado em redirect para `cliente.html`, ativo **somente nesta
branch**. Reversível: um único bloco `<script>` no topo do `<body>`; todo
o conteúdo original permanece intacto, abaixo, nunca executado enquanto o
redirect estiver ativo. Nenhuma alteração em produção.

## Arquivos alterados neste bloco

- `index.html` — redirect preparado (reversível).
- `docs/decisions/0002-portal-unico.md` — status atualizado (nenhuma
  decisão alterada).
- `docs/USUARIOS-E-PERMISSOES.md` — seção de portal único expandida para
  refletir o estado final validado da Fase 2.
- `docs/testes/bloco-3-validacao-final.md` — este documento.

## Correções realizadas neste bloco

Nenhuma correção de bug foi necessária — tudo funcionou como desenhado.

## Código legado que permanece até o cutover

`index.html` continua existindo fisicamente (conteúdo original intacto
abaixo do redirect) — será removido/substituído de verdade só no cutover.
As funções duplicadas remanescentes do inventário original
(`navegarSecao`, `toggleMobileSidebar`, `renderizarCard*`) dentro desse
conteúdo tornaram-se código morto (nunca executado enquanto o redirect
estiver ativo) — não há necessidade de refatorá-las antes do cutover,
quando o arquivo inteiro deixará de existir na forma atual.

## Segurança — confirmações

- Supabase Auth: única fonte de autenticação (confirmado, nenhum mecanismo paralelo foi criado).
- `perfis.role`: única referência de permissão/ferramenta exibida.
- `portal_token`: usado exclusivamente para personalização pública — confirmado por grep: nunca aparece em nenhuma checagem de autorização, só em consultas de leitura/exibição de contato.
- `service_role`: ausente de todo o frontend (`grep` em todos os `.html` — zero ocorrências).
- Nenhuma nova credencial ou senha hardcoded foi introduzida.
- Painel administrativo: continua protegido pelas 2 vias já existentes (senha antiga intacta + sessão de gestor real) — nenhuma via nova criada.

## Pendências para o cutover (não bloqueiam a Fase 3)

- Clique real em **"Meu link"** (geração/cópia de `portal_token` pela sessão autenticada) — não testado nesta rodada; mesmo padrão de código já validado em `index.html` na Fase 1.
- **Corretor comum** (não gestor) com sessão real — nenhuma conta de corretor existe ainda (só a gestora). Só será possível testar quando os 32 corretores forem migrados (ou com 1 conta de corretor fictícia, se você autorizar especificamente). Relevância: baixa a moderada — a lógica de RLS/trigger para `role=corretor` já foi exaustivamente validada por simulação (Etapa 3, Fase 1); o que falta é só a confirmação de que o *frontend* do portal único trata essa role corretamente, algo estruturalmente idêntico ao tratamento de `gestor` já comprovado.
- `?c=` com token real de um corretor existente — não testado (evita consulta desnecessária); função de código idêntica à anterior à Fase 2.
- Ativação do redirect de `index.html` em produção, migração dos 32 corretores, convites, remoção do login antigo/senha administrativa — cutover definitivo, fora de escopo da Fase 2 por decisão já registrada.

## Confirmação de produção

Verificada ao vivo (console sem erros) antes e depois das mudanças deste bloco. Nenhum merge em `main`. Nenhum dado real alterado — a sessão da gestora foi só lida/navegada, nunca escrita.
