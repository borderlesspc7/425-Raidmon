---
name: asaas-subaccount-integration
description: Improve reliability of Asaas integrations with emphasis on workshop subaccount creation. Use when implementing or debugging Asaas onboarding, createAsaasSubaccount, Firebase callable functions, Asaas headers/secrets, or errors like permission-denied, fetch is not a function, invalid email, and ByteString/BOM issues.
---

# Asaas Subaccount Integration

## When to use

Use this skill when working on:
- workshop signup and Asaas subaccount creation
- Firebase callable `createAsaasSubaccount`
- Asaas payload validation for CPF/CNPJ flows
- production incidents in Asaas onboarding

## Success criteria

- Workshop account is created in Firebase Auth and Firestore.
- Asaas subaccount is created and persisted in `users/{uid}` with:
  - `asaasSubaccountId`
  - `asaasSubaccountWalletId`
- If Asaas fails, user still gets a clear message and Firestore stores `asaasSubaccountError`.

## Standard workflow

1. Confirm environment consistency.
2. Validate input and payload mapping.
3. Validate secret/header hygiene.
4. Validate backend behavior and error handling.
5. Validate post-create persistence in Firestore.
6. Validate user-facing alert quality.

## 1) Environment consistency

- Confirm app and functions point to the same Firebase project.
- Confirm function region is aligned:
  - app: `EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION`
  - backend deployment region
- Confirm latest function code is deployed after backend changes.

## 2) Required data for subaccount creation

For workshop account creation, ensure:
- `email` (real and deliverable)
- `cpfCnpj` (11 or 14 digits)
- `mobilePhone` (digits only)
- `incomeValue` (> 0)
- `address`, `addressNumber`, `province`, `postalCode`
- If CPF (11): `birthDate` required
- If CNPJ (14): `companyType` required

If any field is missing, fail with explicit message before calling Asaas.

## 3) Secret and header hygiene (critical)

Before any Asaas call:
- Trim and sanitize tokens/keys used in headers.
- Remove BOM and control chars from secrets.
- Reject empty API key early with clear error.

Use this sanitizer pattern in backend:

```js
function sanitizeAsciiHeaderValue(v) {
  return String(v || "")
    .replace(/^\uFEFF/, "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();
}
```

Known failure signature:
- `Cannot convert argument to a ByteString ... value of 65279`
- Root cause: invisible BOM at start of token/key.

## 4) Node/runtime compatibility

For Firebase Functions on Node 20:
- Prefer native `fetch`.
- Avoid CommonJS `require("node-fetch")` with v3 unless using ESM interop correctly.

Known failure signature:
- `fetch is not a function`

## 5) Firestore rules and client limitations

Do not rely on broad client reads from `users` for uniqueness checks if rules block collection queries.
- If uniqueness checks are needed, move to backend (callable/transaction/index doc).
- Client must not fail hard on permission-denied for non-essential prechecks.

Known failure signature:
- `missing or insufficient permissions`

## 6) Error handling pattern (backend + app)

Backend (`createAsaasSubaccount`):
- Log upstream error details.
- Persist `asaasSubaccountError` + timestamp on user doc.
- Return structured error message.

App (workshop register):
- If account created but subaccount failed, show alert with:
  - plain-language summary
  - technical detail snippet
  - next action (retry later / contact support)

## 7) Post-deploy verification checklist

- [ ] Create new workshop account with valid real email.
- [ ] Confirm `users/{uid}` contains `workshopAsaas`.
- [ ] Confirm `asaasSubaccountId` is present.
- [ ] Confirm `asaasSubaccountWalletId` is present.
- [ ] Confirm `asaasSubaccountError` is absent.
- [ ] Retry with invalid data and confirm clear error path.

## Fast triage map

- `missing or insufficient permissions`
  - Firestore rules blocking client query.
- `fetch is not a function`
  - Wrong fetch implementation/runtime mismatch.
- `ByteString ... 65279`
  - BOM/control char in secret/header.
- `invalid email`
  - Asaas rejected domain/deliverability; test with real provider address.

## Implementation preference order

1. Keep registration resilient: create app account even if Asaas fails.
2. Persist operational error in Firestore for support visibility.
3. Return actionable alerts to the user.
4. Make retries idempotent where possible.
