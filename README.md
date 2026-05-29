# CreditGuard AI

Plataforma analítica para recuperação de crédito e prevenção de inadimplência.

**Deploy:** https://my-app-dusky-one-15.vercel.app

## Estrutura do repositório

```
my-app/
├── front-end/          # Next.js 16 (App Router) + Supabase
│   ├── app/            # Rotas e páginas
│   ├── components/     # Componentes reutilizáveis
│   ├── features/       # Formulários e telas por domínio
│   ├── lib/            # Integrações (auth, db, i18n)
│   ├── scripts/        # Scripts de importação de dados
│   ├── supabase/       # Schema SQL do banco
│   └── assets/         # Dados reais (CSV + XLSX)
└── back-end/           # Reservado para funções futuras
```

## Tecnologias utilizadas

A plataforma foi desenvolvida utilizando uma arquitetura full-stack moderna que separa claramente as responsabilidades de interface, lógica de negócios do servidor e banco de dados:

### 💻 Front-end
*   **Next.js 16 (App Router)** — Framework React utilizado para renderização rápida, otimização de fontes/imagens e roteamento dinâmico.
*   **React 19** — Biblioteca moderna e declarativa para criação de componentes interativos e reativos.
*   **TypeScript** — Tipagem estática para garantir a segurança do código, autocomplete avançado e robustez contra bugs em tempo de execução.
*   **Tailwind CSS v4** — Framework utilitário moderno para estilização rápida, garantindo consistência com o Design System corporativo e responsividade.
*   **i18next & react-i18next** — Sistema robusto para internacionalização (i18n), permitindo a tradução dinâmica e localização da interface.

### ⚙️ Back-end
*   **Next.js Serverless Routes** — Rotas de API (`/api/*`) que funcionam como o backend da aplicação, lidando com requisições HTTP, proteção de rotas e processamento assíncrono.
*   **Motor Analítico de Risco (Heurística)** — Lógica implementada no servidor que avalia dinamicamente a inadimplência de clientes com base em contratos e parcelas em atraso, gerando scores de risco (0-100) e alertas críticos automaticamente.
*   **Scripts de Ingestão de Dados (Python)** — Scripts automatizados baseados em Python 3 para leitura de grandes volumes de dados, limpeza via Pandas, plotagem estatística e inserção em lote (batching).
*   **Reserva para Microserviços (`/back-end`)** — Diretório estruturado e reservado para futuras funções isoladas (ex: cloud functions, microsserviços adicionais de predição em Python ou Node).

### 🗄️ Banco de Dados & Segurança
*   **Supabase (PostgreSQL)** — Backend-as-a-Service relacional para armazenamento persistente dos dados. Utiliza schemas SQL estruturados, triggers e chamadas de procedimento remoto (RPC) para operações otimizadas.
*   **Supabase Auth** — Autenticação robusta e segura integrada à plataforma para controle de acesso dos analistas e administradores.

### 📊 Processamento de Dados & Utilitários (Python Analytics)
*   **pandas** — Processamento relacional ultraveloz, limpeza e unificação de grandes volumes de dados (Excel com ~100K registros e CSV com ~10K registros).
*   **openpyxl** — Parser Excel para leitura do fluxo de pagamentos.
*   **seaborn & matplotlib** — Geração automatizada de gráficos estatísticos para análise de tendências temporais e risco regional.
*   **urllib (Standard Library)** — Comunicação de rede direta de alta performance com a REST API do Supabase (zero dependências complexas).

## Progresso do projeto

| Status | Item | Detalhes |
| --- | --- | --- |
| ✅ | Schema Supabase | Tabelas: clients, contracts, installments, payments, risk_scores, alerts, source_cobranca_assessorias, source_fluxo_pagamentos, contract_metadata + staging |
| ✅ | Receber CSVs | `cobranca_assessorias.csv` (10K linhas) + `fluxo_pagamentos.xlsx` (100K linhas) |
| ✅ | Importação real | Script `npm run import-real-data` — lê CSV+XLSX, truncata via RPC, insere em lotes |
| ✅ | Score de risco | Calculado por contrato (CSV ou heurística por atraso) |
| ✅ | Clientes críticos | Alertas gerados automaticamente para contratos em atraso |
| ✅ | Fila de cobrança | Tela `/collections` com busca e priorização |
| ✅ | Dashboard executivo | KPIs, alertas, projeção de caixa |
| ✅ | Tela de clientes | Lista `/clients` e detalhe `/clients/[id]` com parcelas e pagamentos |
| ✅ | Autenticação | Registro/login com Supabase Auth |
| ✅ | LGPD | Página `/privacy` com política em pt + checkbox no cadastro |
| ✅ | Upload CSV | Página `/upload` com textarea, validação e importação via API |
| ✅ | Badge ambiente | Header mostra "Supabase" ou "Base Simulada" via `/api/health` |
| ✅ | Proteção API | Rotas protegidas com `getAuthedUser()` (atualmente retorna mock user) |
| ✅ | Deploy Vercel | Build 0 erros, deploy automatizado |
| 🔲 | Previsão real `/api/predict` | Hoje retorna placeholder aleatório |
| 🔲 | Projeção de caixa real | cashFlowProjection ainda zerado |
| 🔲 | Filtros gerenciais | Busca por faixa de risco, status e período |

## Dados carregados (após `npm run import-real-data`)

| Tabela | Registros |
| --- | --- |
| source_cobranca_assessorias | 10.000 |
| source_fluxo_pagamentos | 100.000 |
| clients | 10.000 |
| contracts | 10.000 |
| installments | 92.150 |
| payments | 72.642 |
| risk_scores | 10.000 |
| alerts | 9.097 |
| contract_metadata | 10.000 |

## Rotas

### Páginas

| Rota | Descrição |
| --- | --- |
| `/` | Dashboard executivo (KPIs, alertas cliqueáveis, projeção) |
| `/clients` | Lista de clientes com busca |
| `/clients/[id]` | Detalhe do cliente (contratos, parcelas, pagamentos) |
| `/clients/create` | Cadastro manual de cliente |
| `/collections` | Fila de cobrança priorizada |
| `/login` | Login |
| `/register` | Cadastro com checkbox LGPD |
| `/privacy` | Política de privacidade (LGPD) |
| `/upload` | Ingestão de CSV |

### API

| Rota | Descrição |
| --- | --- |
| `GET /api/health` | Status do banco (`dbMode` + `authed`) |
| `GET /api/dashboard` | KPIs, alertas, projeção de caixa |
| `GET /api/clients` | Lista de clientes com scores |
| `GET /api/clients?q=` | Busca textual |
| `GET /api/clients/:id` | (via SSR em `/clients/[id]`) |
| `GET /api/collections` | Fila de cobrança com metadados |
| `POST /api/predict` | Previsão de risco (placeholder) |
| `POST /api/installments/pay` | Registrar pagamento |
| `POST /api/alerts/resolve` | Arquivar alerta |
| `POST /api/upload-csv` | Ingerir CSV em staging |
| `GET /api/seed` | Popular com dados sintéticos |

## Como rodar localmente

```powershell
cd my-app\front-end
npm install
npm run dev
```

Acesse `http://localhost:3000`.

## Variáveis de ambiente

Crie `front-end/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Carga oficial no Supabase (Python Pipeline)

1. Execute `front-end/supabase/schema.sql` no SQL Editor do Supabase.
2. Certifique-se de que os seguintes pacotes Python estejam instalados:
   ```powershell
   pip install pandas openpyxl matplotlib seaborn
   ```
3. Coloque os arquivos brutos em `front-end/assets/`:
   - `cobranca_assessorias.csv`
   - `fluxo_pagamentos.xlsx`
4. Rode:
   ```powershell
   cd my-app\front-end
   npm run import-real-data
   ```

O script em Python limpa os dois arquivos brutos via Pandas, exporta os gráficos analíticos em Seaborn para `public/analysis_plots.png`, trunca os dados antigos via chamada RPC do Supabase, e insere os novos dados estruturados de forma relacional em lotes de 500.


## Deploy

```powershell
cd my-app\front-end
npm run build
npx vercel deploy --prod
```
