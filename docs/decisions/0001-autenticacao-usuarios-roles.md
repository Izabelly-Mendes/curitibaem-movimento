# ADR 0001 — Autenticação, Usuários e Roles

- **Status:** Aprovado para implementação em etapas
- **Data:** 2026-10-05
- **Fase:** Fase 1 da reestruturação (ver `docs/FASE-0-ESTADO-ATUAL.md` para o
  estado do sistema antes desta decisão)
- **Decisores:** Izabelly (produto) · Claude (arquitetura/implementação)

---

## 1. Problema original

A auditoria inicial e a Fase 0 (`docs/FASE-0-ESTADO-ATUAL.md`) encontraram:

- Senha de administrador fixa, hardcoded em `admin.html`, visível a qualquer
  pessoa que inspecione o código-fonte da página.
- Senhas de corretores com hash SHA-256 sem sal, comparadas via uma query
  Supabase exposta pela `anon key` pública — qualquer pessoa com a anon key
  consegue ler a tabela `corretores` inteira, hashes incluídos.
- RLS habilitada em todas as tabelas, mas com policies `USING (true)` —
  equivalente, na prática, a não ter RLS nenhuma.
- 7 chaves diferentes de sessão espalhadas entre `sessionStorage` e
  `localStorage`, com lógica de verificação duplicada e divergente entre
  páginas — hipótese mais provável para os relatos de "funciona para admin,
  não funciona para corretor".
- Duas funções órfãs no banco (`handle_new_auth_user`,
  `enforce_usuario_update_rules`), referenciando uma tabela `usuarios` e uma
  função `is_gestor_admin()` que nunca existiram — evidência de uma tentativa
  anterior, não documentada e não concluída, de estruturar autenticação/
  permissões de forma mais correta.

## 2. Contexto

Sistema estático (HTML+JS sem build step) + Supabase como backend direto via
API REST/anon key, sem servidor próprio além de 3 funções serverless na
Vercel. Há corretores já cadastrados e em uso (`corretores`), com links
pessoais já distribuídos a clientes (`portal_token` embutido em
`cliente.html?c=<token>`), que não podem ser invalidados.

## 3. Alternativas consideradas

1. **Terminar o desenho órfão como estava** (reaproveitar `usuarios`/
   `is_gestor_admin()` literalmente) — descartada: nomes e campos não foram
   validados com o produto, função incompleta sem explicação do abandono.
2. **Implementação nova com Supabase Auth**, desenhada para este produto —
   **escolhida**.
3. **Endurecer a tabela `corretores` customizada** (checagem de senha via
   serverless + `service_role`, sessão assinada por nós) — descartada por
   decisão de produto: reinventaria, por conta própria, o que o Supabase Auth
   já resolve (hash seguro, sessão, refresh, recuperação de senha, rate
   limiting).

## 4. Decisão tomada

Adotar **Supabase Auth** como único mecanismo de autenticação, com uma
tabela de perfil (`perfis`) 1:1 com `auth.users`, dois papéis apenas
(`corretor`, `gestor`), **login único** para ambos, e RLS real aplicada no
banco (não apenas escondendo botão no frontend).

## 5. Justificativa

Elimina simultaneamente os 3 problemas mais graves da auditoria (senha fixa
do admin, hash sem sal, RLS sem efeito) sem exigir manutenção de lógica de
autenticação própria. É a única das 3 alternativas compatível com a decisão
explícita de produto de não construir um sistema de login próprio quando o
Supabase Auth já resolve adequadamente.

## 6. Modelo `auth.users` + `perfis`

```sql
create type app_role as enum ('corretor', 'gestor');

create table perfis (
  id                      uuid primary key references auth.users(id) on delete cascade,
  nome                    text not null,
  whatsapp                text,
  portal_token            text unique,
  role                    app_role not null default 'corretor',
  ativo                   boolean not null default true,
  criado_em               timestamptz not null default now(),
  atualizado_em           timestamptz not null default now(),
  migrado_de_corretor_id  uuid references corretores(id)
);
```

`perfis.id` é sempre o mesmo UUID de `auth.users.id` (relação 1:1). Nenhuma
senha é armazenada em `perfis` — senha é gerenciada **exclusivamente** pelo
Supabase Auth, nunca em `perfis`, tabela própria, frontend, `localStorage`,
`sessionStorage`, logs ou documentação.

## 7. Roles: `corretor | gestor`

Apenas estes dois valores. Visitante/cliente não é um papel de banco — é a
ausência de sessão (`auth.uid()` nulo). Sem hierarquia de múltiplos papéis
nesta fase.

## 8. Login único

Uma única tela/endereço de login para todo usuário autenticado
(`corretor` e `gestor`), usando e-mail + senha via
`supabase.auth.signInWithPassword()`. **Não existe mais um mecanismo de
autenticação administrativa separado.** Depois da autenticação, o sistema lê
`perfis.role` do usuário logado para liberar as funcionalidades
correspondentes.

## 9. RLS

Resumo (definição completa na proposta consolidada da Fase 1 já
compartilhada na conversa — a ser aplicada em migration própria, não nesta
etapa):

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `perfis` | próprio ou gestor | só trigger de signup | próprio ou gestor (campos sensíveis protegidos por trigger) | ninguém |
| `acessos_corretores` | próprio ou gestor | próprio | próprio (aberto) ou gestor | ninguém |
| `blocos_conteudo` | público | só gestor | só gestor | só gestor |
| `rascunhos_curadoria` | público (aprovados) / gestor (tudo) | gestor / `service_role` | só gestor | só gestor |
| `corretores` (legado) | só gestor | — | — | — |

Função auxiliar: `is_gestor()` (`security definer`), evita recursão de RLS.

## 10. Estratégia de sessão

Sessão inteiramente gerenciada pela biblioteca `supabase-js` (1 chave, não 7
como hoje). Login, manter conectado, logout, expiração e recuperação de
senha usam as funções nativas do Supabase Auth. Um único helper de proteção
de página substitui as verificações duplicadas atuais.

## 11. Gestão de corretores pelo próprio sistema (requisito futuro)

A arquitetura precisa suportar, via painel administrativo (sem acesso direto
a Supabase/código), que um gestor: cadastre corretor (nome, e-mail,
WhatsApp), gere/preserve `portal_token`, edite dados, ative/desative,
visualize status, envie/reenvie convite de definição de senha, e inicie
recuperação de acesso. Toda operação que exigir `service_role` (criação de
usuário no Auth, envio de convite) acontece **exclusivamente** em
código server-side/serverless — a `service_role key` nunca é exposta ao
navegador. A UX definitiva dessa área pode evoluir depois; a arquitetura
desta fase precisa apenas suportar corretamente o fluxo.

## 12. Migração dos corretores atuais

Preservar literalmente: `nome`, `email` (vira identidade de login),
`whatsapp`, **`portal_token`** (crítico para não quebrar links já
distribuídos), `ativo`, e a relação com o histórico via
`migrado_de_corretor_id`. Senhas antigas (hash SHA-256 sem sal) **não são
migradas nem convertidas de nenhuma forma** — cada corretor define a própria
senha nova pelo fluxo de convite do Supabase Auth.

## 13. Preservação do histórico (`acessos_corretores`)

- Linhas históricas mantêm `corretor_id` (FK existente para `corretores`),
  **nunca reescritas**.
- Coluna nova `perfil_id` (FK para `perfis`, nullable) usada **somente** em
  linhas novas, a partir da migração.
- Distinção entre histórico e novo é pela presença dos campos
  (`corretor_id` preenchido = histórico; `perfil_id` preenchido = novo), sem
  coluna de flag redundante.
- View `acessos_corretores_consolidado` unifica as duas origens para
  consultas/telas de histórico, sem exigir que o restante do sistema saiba
  da divisão.
- `corretores` pode deixar de ser usada **operacionalmente** no futuro, mas
  nunca é apagada enquanto for parte da integridade referencial do
  histórico. Preservação de dados tem prioridade sobre "banco mais limpo".

## 14. Regra crítica — nenhum e-mail para corretores reais durante o desenvolvimento

Durante toda a construção, migração técnica e testes da Fase 1: **nenhum**
convite, recuperação de senha, confirmação ou comunicação de autenticação
real é disparado para corretores reais já cadastrados. `inviteUserByEmail()`
e fluxos equivalentes só são executados contra e-mails de teste previamente
autorizados pela Izabelly. Preparação técnica dos dados (migração) e disparo
dos convites reais são etapas **distintas e independentes**. O disparo real
só acontece após autorização explícita, depois de validados: login único,
role `corretor`, role `gestor`, RLS, definição de senha, recuperação de
senha, troca de senha, sessão persistente, logout, experiência do corretor,
gestão de corretores, fluxo administrativo, identidade dos e-mails, testes
ponta a ponta, documentação da Fase 1, e estabilidade geral. **Ausência de
resposta da Izabelly não é autorização.**

O teste ponta a ponta do fluxo de senha é obrigatório e precisa cobrir o
ciclo completo: convite de teste → link → definição da senha → logout →
novo login com e-mail + senha recém-definida → sessão válida → perfil
correto → role correta → funcionalidades corretas. Não é considerado
validado só porque a tela aceitou a digitação de uma senha.

## 15. Identidade futura dos e-mails (requisito de arquitetura, não de conteúdo)

Quando os disparos reais forem autorizados, as comunicações de autenticação
(convite, recuperação de senha) devem ser identificáveis como do **Curitiba
em Movimento** — plataforma criada por Iza Mendes e Gabriel Polli para
reunir informações e dados relevantes sobre Curitiba, ampliando o repertório
dos corretores em conversas com clientes e investidores. Texto, assunto,
remetente, identidade visual e layout finais serão definidos e aprovados
separadamente, **antes** de qualquer disparo real — não fazem parte desta
decisão. A arquitetura só precisa garantir que seja possível personalizar:
remetente, assunto, conteúdo, identidade visual, botão/link, redirecionamento
pós-definição de senha, recuperação de senha e demais comunicações de
autenticação (o Supabase Auth permite customizar os templates de e-mail e o
remetente via SMTP próprio — suficiente para este requisito).

## 16. Funções órfãs (`handle_new_auth_user`, `enforce_usuario_update_rules`)

Remoção **aprovada em princípio**, mas **não executada agora**. Só serão
removidas: na etapa prevista da sequência de implementação, depois das
validações anteriores, por migration versionada própria, depois de
reconfirmar que continuam sem triggers/dependências, com a decisão
registrada explicitamente no commit daquela migration.

## 17. Fora do escopo desta fase

- Bug confirmado de Realtime em `rascunhos_curadoria` (Fase 0) — registrado,
  não corrigido aqui.
- Evolução/IA na curadoria de notícias — fase própria, futura.
- Unificação visual das experiências cliente/corretor/gestor — a Fase 1
  garante que autenticação e roles permitam isso depois, mas não implementa
  a unificação agora.

## 18. Riscos

- E-mails cadastrados hoje podem estar desatualizados — mitigado pela regra
  de não-disparo (seção 14) até validação completa e identidade de e-mail
  aprovada.
- `portal_token` precisa ser copiado literal, nunca regenerado.
- RLS mal calibrada pode travar o próprio gestor — mitigado por testes antes
  de qualquer corte do sistema antigo.
- `service_role key` só em ambiente servidor/serverless, nunca no navegador.
- Perda de histórico por reescrita de dados — mitigado pela estratégia
  estritamente aditiva da seção 13.

## 19. Rollback

Cada etapa da sequência de implementação é projetada para ser aditiva e
reversível independentemente, enquanto `corretores` e o login antigo não
forem desligados. O corte do sistema antigo só acontece depois de um período
de validação com o sistema novo funcionando em paralelo, e é o único passo
sem reversão trivial.

## 20. Consequências

- Elimina senha fixa de admin, hash sem sal, e RLS sem efeito.
- Introduz dependência total do Supabase Auth para autenticação (aceitável:
  é a plataforma já usada para todo o resto).
- Exige que cada corretor redefina a própria senha uma vez (comunicação e
  timing cuidadosos, ver seção 14).
- Deixa a base pronta para a futura unificação visual cliente/corretor/
  gestor sem exigir nova mudança de arquitetura de autenticação.
- Formaliza, pela primeira vez neste projeto, uma regra de documentação
  obrigatória por fase (ver `docs/FASE-0-ESTADO-ATUAL.md` como fotografia
  histórica, e este ADR como registro de decisão — `docs/AUTENTICACAO.md`,
  `docs/USUARIOS-E-PERMISSOES.md` e `docs/BANCO-DE-DADOS.md` serão
  criados/atualizados ao final da Fase 1, refletindo o que foi de fato
  implementado e testado).
