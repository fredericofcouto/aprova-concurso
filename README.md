# Aprova Concurso

Plataforma de preparação para o concurso público da Prefeitura de São Miguel do Araguaia–GO, organizada a partir do edital consolidado e das atualizações oficiais do Instituto Verbena/UFG.

> Projeto educacional independente. As questões são autorais e não representam questões oficiais da banca.

## Visão geral

O Aprova Concurso transforma o conteúdo do edital em uma experiência de prova completa, com cadernos sequenciais, controle de tempo, cartão-resposta, acompanhamento individual e revisão comentada.

O sistema contempla os cinco cargos solicitados:

- Técnico de Informática
- Psicólogo
- Assistente Social
- Agente Comunitário de Saúde
- Professor/Pedagogo

## Funcionalidades

### Experiência de prova

- Caderno único com questões em sequência por disciplina.
- Composição de questões e pesos conforme o edital.
- Cronômetro de quatro horas com referência de horário do servidor.
- Alternativas de A a D com correção das alternativas após a entrega.
- Cartão-resposta visual com indicação de questões respondidas e marcadas.
- Questões em branco permitidas até a finalização.
- Marcação de itens para revisão.
- Bloqueio de alterações depois da entrega ou do encerramento do prazo.

### Banco de questões

- Banco revisado e isolado no Supabase.
- 1.000 questões efetivas: 644 itens revisados no banco principal e 356 itens autorais de expansão.
- 524 famílias semânticas no banco revisado, somadas a famílias próprias da expansão autoral.
- Questões comuns para os níveis médio/técnico e superior.
- Questões específicas para os cinco cargos.
- Estoque adicional equilibrado entre Português, Raciocínio Lógico, Goiás/São Miguel do Araguaia e Conhecimentos Específicos.
- Expansão autoral distribuída entre as cinco trilhas: 72 itens para Informática e 71 para cada outro cargo.
- Priorização de famílias ainda não utilizadas pelo candidato.
- Bloqueio de duplicidade da mesma família dentro do caderno.
- Histórico de reutilização quando o estoque inédito de uma disciplina se esgota.
- Referência do item do edital associada a cada questão.
- Revisão estrutural automática antes do uso: identifica IDs duplicados, gabarito fora de A–D, alternativas vazias/repetidas, campos obrigatórios ausentes e metadados inválidos.
- Relatório de avisos editoriais para itens sem vínculo explícito ao subitem do edital ou com comentário curto, sem descartar variantes válidas de uma mesma família.

### Progresso individual

- Entrada com a conta ChatGPT.
- Histórico separado por usuário.
- Salvamento automático das respostas e da redação.
- Retomada da prova em outro dispositivo.
- Controle de revisão para evitar sobrescrita de respostas antigas.
- Caderno de erros com questões erradas ou deixadas em branco.
- Resultados por disciplina, quantidade de acertos e pontuação ponderada.

### Redação para Pedagogia

- Proposta dissertativo-argumentativa autoral.
- Textos motivadores.
- Limite de 30 linhas.
- Folha digital com linhas para escrita.
- Rubrica baseada em modalidade escrita, gênero textual, coesão/coerência e desenvolvimento do tema.
- Sem promessa de correção automática ou nota oficial.

### Acessibilidade

- Link para saltar diretamente ao conteúdo principal.
- Foco visível e navegação por teclado em botões, links, alternativas e cartão-resposta.
- Controles persistentes de texto maior e alto contraste, também disponíveis pelos atalhos `Alt + Shift + L` e `Alt + Shift + C`.
- Suporte a `prefers-contrast` e `prefers-reduced-motion`, além de layout responsivo para telas pequenas.

## Fidelidade ao edital

O projeto reproduz a estrutura de preparação indicada no edital: disciplinas, quantidade de questões, pesos, duração, pontuação ponderada, redação para o cargo aplicável e informações sobre etapas complementares.

O resultado do simulador é apenas uma referência de estudo. Atingir 50 pontos na prova objetiva não garante aprovação, classificação dentro das vagas ou aprovação em outras etapas.

Fontes principais utilizadas no projeto:

- [Portal oficial do Instituto Verbena/UFG](https://sistemas.institutoverbena.ufg.br/2026/concurso-prefeitura-sao-miguel-do-araguaia/)
- [Edital consolidado](https://sistemas.institutoverbena.ufg.br/2026/concurso-prefeitura-sao-miguel-do-araguaia/sistema/arquivos/anexos/Edital_Consolidado_Concurso_P%C3%BAblico_da_Prefeitura_Municipal_de_S%C3%A3o_Miguel_do_Araguaia-GO.pdf)
- Legislação federal publicada no Portal Planalto.
- Normas profissionais do CFP e do CFESS.
- BNCC, PNAB, SUS, SUAS, ECA, LBI, LDB e legislação específica dos cargos.
- Lei Orgânica do Município, conforme texto disponibilizado pela Câmara Municipal.

## Arquitetura

```text
Next.js/Vinext + React
          │
          ├── Interface de estudo e prova
          ├── API de catálogo e tentativas
          ├── Motor de seleção, ordenação e correção
          ├── D1: tentativas privadas por usuário
          └── Supabase: banco público de questões revisadas
```

### Camadas principais

- `app/page.tsx`: interface do painel, guia do edital, prova, histórico e resultados.
- `app/api/study/route.ts`: início, salvamento, retomada, entrega e consulta de tentativas.
- `app/api/catalog/route.ts`: catálogo público do banco disponível.
- `lib/exam-engine.ts`: blueprint dos cargos, seleção, famílias, embaralhamento e correção.
- `lib/attempt-store.ts`: persistência privada das tentativas no D1.
- `lib/question-bank.ts`: leitura do banco revisado no Supabase.
- `lib/syllabus.json`: conteúdo programático estruturado por cargo e nível.
- `data/`: questões autorais e importações revisadas.
- `supabase/migrations/`: estrutura e políticas do banco de questões revisado.
- `tests/`: testes do motor, banco, API, renderização e componentes.

## Segurança e privacidade

- Tentativas e redações ficam vinculadas ao e-mail identificado pelo servidor.
- Usuários não conseguem consultar tentativas de outras contas.
- Respostas corretas e comentários não são enviados durante uma prova ativa.
- Escritas concorrentes são protegidas por controle de revisão.
- O banco revisado possui RLS ativo.
- Visitantes podem consultar questões de estudo, mas não podem inserir, alterar ou excluir questões.
- Importações não revisadas permanecem fora do banco usado pelos simulados.
- O Supabase utiliza chave pública somente para leitura controlada do material de estudo.
- Dados privados das tentativas não são armazenados na tabela pública de questões.

## Stack

- React 19
- Next.js/Vinext
- TypeScript
- Cloudflare Workers
- Cloudflare D1
- Supabase Postgres e REST
- Drizzle ORM
- Lucide React
- ESLint
- Node.js 22+

## Desenvolvimento local

Requisitos:

- Node.js `>=22.13.0`
- npm
- Ambiente Linux com `timeout` GNU para os scripts do Sites

Instalação:

```bash
npm run install:ci
```

Executar em desenvolvimento:

```bash
npm run dev
```

Validar o build:

```bash
npm run build
```

Executar os testes:

```bash
npm test
```

Verificações individuais:

```bash
npm run lint
npx tsc --noEmit
node --test tests/*.test.mjs
```

## Qualidade validada

O projeto possui testes automatizados para:

- 2.500 cadernos gerados com ordem e pesos corretos.
- Ausência de famílias duplicadas no mesmo caderno.
- Prioridade para questões ainda não vistas.
- Geração de provas completas para os cinco cargos.
- Correção de alternativas embaralhadas.
- Cálculo ponderado de 100 pontos.
- Regra de mínimo de 50 pontos.
- Salvamento, retomada e isolamento entre contas.
- Conflitos de edição entre dispositivos.
- Encerramento automático por prazo.
- Limite de 30 linhas para redação.
- Renderização SSR em português.

## Publicação

Site em produção:

**[aprova-concurso.frederico.chatgpt.site](https://aprova-concurso.frederico.chatgpt.site)**

O projeto é hospedado pelo Sites e utiliza a configuração declarada em `.openai/hosting.json`.

## Limitações importantes

- O site não prevê as perguntas reais da prova.
- A semelhança com o estilo do Instituto Verbena é de formato, contextualização e abordagem de treinamento, não de identidade ou vínculo institucional.
- A dificuldade das questões é didática e não foi calibrada oficialmente pela banca.
- A redação precisa ser revisada por um professor ou avaliador humano para uma estimativa mais confiável.
- O banco finito prioriza questões inéditas; não existe geração ilimitada sem repetição.

## Licença

Uso educacional. A definição da licença de distribuição do código e do banco de questões deve ser confirmada antes de uma publicação aberta ou reutilização comercial.
