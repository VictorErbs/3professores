# Backend (Firebase Functions)

Este scaffold cria um backend em Node usando Firebase Functions + Express e conecta ao Firebase Realtime Database pelo Admin SDK.

Arquivos principais:
- `backend/functions/index.js` — endpoints de exemplo (health, clients CRUD, predict placeholder)
- `backend/functions/package.json` — dependências

Como usar localmente:

1. Instale dependências:

```powershell
cd backend/functions
npm install
```

2. Testar localmente (recomendado usar emulador do Firebase):

```powershell
npx firebase emulators:start --only functions,database
```

Deploy automático (GitHub Actions):

- Crie um token de serviço do Firebase e adicione como segredo `FIREBASE_TOKEN` no GitHub.
- O workflow `.github/workflows/firebase-deploy.yml` (adicionado) irá usar esse token para deployar as functions no push para `master`.

Observações:
- Este scaffold é um ponto de partida. Integre o modelo preditivo (ML) num serviço separado (Cloud Run) ou chame um endpoint de inferência a partir do endpoint `/predict`.
- O Realtime Database tem limites no plano gratuito; monitore uso.
