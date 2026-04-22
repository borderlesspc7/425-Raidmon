# Pagamentos reais com Asaas

O app chama **Firebase Cloud Functions** (`functions/`) via `httpsCallable` — nunca envia a chave Asaas no cliente. Com o deploy das functions e o `.env` com a região certa, o fluxo de PIX fica ativo.

## Segurança da API Key

- Guarde a chave só em **secrets do Firebase** ou em `.env` local (não versionado) para testes.
- **Não** commite chaves no Git.
- Se a chave foi exposta em chat, e-mail ou ticket, **revogue e crie outra** no painel Asaas.

## Pré-requisitos

- CLI: [Firebase CLI](https://firebase.google.com/docs/cli) (`npm i -g firebase-tools`)
- Projeto Firebase igual ao do app (`EXPO_PUBLIC_*` no `.env`)
- Conta Asaas com API em produção ou sandbox

## Secrets (produção)

```bash
firebase login
firebase use <seu-project-id>

firebase functions:secrets:set ASAAS_API_KEY
firebase functions:secrets:set ASAAS_WEBHOOK_TOKEN
```

Opcionais (strings de configuração, não precisam ser “secret” em alguns setups):

```bash
firebase functions:config:set asaas.api_url="https://api.asaas.com/v3"
firebase functions:config:set asaas.platform_fee_percent="5"
# Carteira Asaas que recebe a taxa da plataforma (~5%), se usar split:
firebase functions:config:set asaas.admin_wallet_id="SEU_WALLET_ID"
```

> Na **v2** do Functions, preferir `defineString` no código já previsto em `functions/index.js` via parâmetros do Firebase. Para `ASAAS_API_URL`, `PLATFORM_FEE_PERCENT` e `ASAAS_ADMIN_WALLET_ID`, configure no console do Firebase **Parameters** para o extension Functions ou use variáveis de ambiente no deploy conforme a documentação atual do seu projeto.

Para **secrets** usados no código (`asaasApiKey`, `webhookToken`), o deploy pede binding automático se você seguir o `defineSecret` já presente em `functions/index.js`.

## Deploy das functions

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

Funções expostas:

- `createAsaasCharge` — callable autenticado; cria cliente/cobrança PIX e grava metadados no documento `payments/{id}`.
- `asaasWebhook` — HTTP `POST`; URL pública para o Asaas notificar pagamentos.

## Webhook no painel Asaas

1. URL (substitua projeto e região):

   `https://southamerica-east1-<PROJECT_ID>.cloudfunctions.net/asaasWebhook?token=<ASAAS_WEBHOOK_TOKEN>`

2. Ou configure o **mesmo** token no painel Asaas como “token de autenticação” do webhook; o servidor aceita o header `asaas-access-token` igual ao secret `ASAAS_WEBHOOK_TOKEN`.

3. Inscreva-se nos eventos de **cobrança** (ex.: pagamento recebido / confirmado).

## App (Expo)

No `.env` (não commitar) adicione a **região** das functions (deve coincidir com `southamerica-east1` no código):

```env
EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION=southamerica-east1
```

Reinicie o Expo (`npm start`).

## Uso no app

1. Usuário deve ter **CPF válido** no perfil (exigência Asaas para cadastro de cliente).
2. Em **Pagamentos**, crie o registro e use **Gerar cobrança PIX (Asaas)**.
3. O status **Pago** deve ser atualizado pelo **webhook** (não marque manualmente depois de gerar PIX).

## Taxa da plataforma (~5%)

- O valor da cobrança é o valor do pagamento; são gravados `platformFeeAmount` e `netAmountAfterFee`.
- Se `ASAAS_ADMIN_WALLET_ID` estiver configurado, o split Asaas envia ~5% para essa carteira (ajuste fino no painel Asaas se necessário).
