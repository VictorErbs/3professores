# CreditGuard AI

Plataforma analítica para recuperação de crédito e prevenção de inadimplência.

Este repositório está organizado em duas partes:

- `front-end/`: aplicação Next.js responsável pelas telas, rotas e integração com Supabase
- `back-end/`: espaço reservado para funções, jobs e integrações futuras

## Contexto do projeto

O problema apresentado pela administradora de consórcios envolve:

- aumento da inadimplência
- baixa previsibilidade financeira
- perda de receita após contemplação
- dificuldade em priorizar cobranças
- dashboards desconectados
- ausência de inteligência preditiva

O objetivo da solução é criar uma plataforma capaz de:

- prever risco de inadimplência
- identificar clientes críticos
- otimizar recuperação de crédito
- apoiar decisões estratégicas
- melhorar a previsibilidade de caixa

## Proposta de solução

A solução será baseada em dados enviados pelo professor em 2 arquivos CSV e armazenados no Supabase. A ideia é transformar esses arquivos em uma base estruturada para permitir análise, priorização de cobrança e cálculo de risco.

Fluxo proposto:

1. receber os 2 CSVs do professor
2. importar os arquivos para tabelas de staging no Supabase
3. normalizar os dados em tabelas operacionais
4. calcular indicadores de risco e comportamento financeiro
5. exibir listas priorizadas de clientes críticos e painéis gerenciais
6. retornar uma previsão simples de risco pela API `POST /api/predict`

## Backlog do programa

### Épico 1: Base de dados e ingestão

| Prioridade | Item | Entrega esperada |
| --- | --- | --- |
| P0 | Modelar o schema no Supabase | Tabelas para clientes, contratos, parcelas, pagamentos e risco |
| P0 | Receber os 2 CSVs do professor | Arquivos prontos para carga no banco |
| P0 | Criar rotina de importação | Processo de carga para staging e validação dos dados |
| P1 | Tratar inconsistências | Padronização de CPF, datas, valores e campos nulos |

### Épico 2: Inteligência analítica

| Prioridade | Item | Entrega esperada |
| --- | --- | --- |
| P0 | Calcular score de risco | Classificação simples por perfil e histórico |
| P0 | Identificar clientes críticos | Lista priorizada para cobrança |
| P1 | Detectar sinais de atraso | Regras para atraso, reincidência e concentração de risco |
| P1 | Gerar indicadores de recuperação | Taxa de recuperação, atraso médio e volume exposto |

### Épico 3: Recuperação de crédito

| Prioridade | Item | Entrega esperada |
| --- | --- | --- |
| P0 | Montar fila de cobrança | Priorização por risco e impacto financeiro |
| P1 | Sugerir ações de cobrança | Segmentação por criticidade e canal de contato |
| P1 | Registrar status de tratamento | Acompanhar aberto, em negociação, recuperado e inadimplente |

### Épico 4: Previsibilidade financeira

| Prioridade | Item | Entrega esperada |
| --- | --- | --- |
| P0 | Estimar caixa futuro | Projeção de recebimento por período |
| P1 | Simular cenários | Melhor, base e pior cenário de inadimplência |
| P1 | Apoiar decisão da diretoria | Indicadores para estratégia e operação |

### Épico 5: Interface e gestão

| Prioridade | Item | Entrega esperada |
| --- | --- | --- |
| P0 | Dashboard executivo | Visão geral da inadimplência e do risco |
| P0 | Tela de clientes | Cadastro e consulta de clientes |
| P1 | Tela de previsão | Resultado da análise de risco por cliente |
| P1 | Filtros gerenciais | Busca por faixa de risco, status e período |

## Modelo de dados sugerido

Os 2 CSVs podem ser tratados como origem para estas entidades:

- `clients`: dados cadastrais do cliente
- `contracts`: contrato ou vínculo de consórcio
- `installments`: parcelas previstas
- `payments`: pagamentos realizados
- `risk_scores`: score calculado por cliente ou contrato
- `alerts`: alertas de inadimplência e prioridade de cobrança

Se os CSVs tiverem colunas diferentes, o mapeamento deverá ser ajustado no momento da importação.

## Como os CSVs entram no Supabase

1. criar as tabelas definitivas no arquivo `front-end/supabase/schema.sql`
2. importar os CSVs em tabelas temporárias ou staging
3. validar tipos, duplicidades e campos obrigatórios
4. mover os dados limpos para as tabelas finais
5. calcular os indicadores usados pela aplicação

Essa abordagem evita carregar dados sujos direto na estrutura principal.

## Rotas atuais

- `/` página inicial
- `/login` autenticação
- `/register` criação de conta
- `/clients/create` cadastro de cliente
- `/api/clients` API de clientes no Supabase
- `/api/predict` API de previsão de risco

Observação importante: a rota `POST /api/predict` ainda está como placeholder e hoje retorna um valor aleatório. Ela deve ser substituída pela lógica real baseada nos dados importados do Supabase.

## Estrutura principal

Dentro de `front-end/`:

- `app/` rotas e páginas
- `components/` componentes reutilizáveis
- `features/` formulários e telas por domínio
- `lib/` integrações com API e Supabase
- `supabase/` schema SQL do banco

Dentro de `back-end/`:

- espaço reservado para funções de servidor, jobs e automações futuras

## Como rodar localmente

Abra o terminal em `my-app/front-end` e rode:

```powershell
npm install
npm run dev
```

Depois acesse `http://localhost:3000`.

## Variáveis de ambiente

Crie `front-end/.env.local` com as variáveis do Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Deploy

O front-end já está preparado para Vercel.

Para validar antes do deploy:

```powershell
cd my-app\front-end
npm run build
```

## Próximos passos recomendados

1. receber os 2 CSVs do professor e confirmar o cabeçalho de cada arquivo
2. ajustar o schema do Supabase para refletir as colunas reais
3. implementar a importação e a limpeza dos dados
4. trocar a previsão aleatória por uma regra ou modelo simples baseado no histórico
5. montar o dashboard com prioridade de cobrança e visão executiva
