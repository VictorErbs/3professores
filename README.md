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

A plataforma foi desenvolvida utilizando tecnologias modernas que garantem alta performance, escalabilidade e tipagem forte:

*   **Front-end & Core:**
    *   **Next.js 16 (App Router)** — Framework React para renderização híbrida, rotas dinâmicas e otimização.
    *   **React 19** — Biblioteca declarativa e eficiente para construção de interfaces.
    *   **TypeScript** — Tipagem estática para robustez do código e prevenção de erros em tempo de execução.
    *   **Tailwind CSS v4** — Framework CSS utilitário para design responsivo e consistente com o Design System.
    *   **i18next & react-i18next** — Gerenciamento dinâmico de internacionalização (tradução).

*   **Banco de Dados & Autenticação:**
    *   **Supabase (PostgreSQL)** — Backend-as-a-Service para persistência relacional, autenticação segura de usuários (Supabase Auth) e controle de acessos.
    *   **Firebase** — Serviço adicional configurado na stack para integrações secundárias.

*   **Processamento & Ingestão de Dados:**
    *   **xlsx (SheetJS)** — Ferramenta de alta performance para importação e parsing de planilhas Excel (`fluxo_pagamentos.xlsx` com ~100K registros).
    *   **csv-parse** — Utilitário de parsing de fluxos CSV para ingestão de dados em lote (`cobranca_assessorias.csv` com ~10K registros).
    *   **pdf-parse** — Biblioteca para extração e processamento de informações contidas em documentos PDF.

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

## Carga oficial no Supabase

1. Execute `front-end/supabase/schema.sql` no SQL Editor do Supabase
2. Coloque os arquivos em `front-end/assets/`:
   - `cobranca_assessorias.csv`
   - `fluxo_pagamentos.xlsx`
3. Rode:

```powershell
cd my-app\front-end
npm run import-real-data
```

O script lê os dois arquivos, trunca os dados existentes via RPC e insere em lotes de 500.

## Deploy

```powershell
cd my-app\front-end
npm run build
npx vercel deploy --prod
```
