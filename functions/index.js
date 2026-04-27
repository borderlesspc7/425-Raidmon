/**
 * Integração Asaas: cliente + cobrança PIX + webhook.
 * createAsaasCharge: com `payments.workshopId` → split marketplace (users/{workshops.userId}.asaasSubaccountWalletId
 * + carteira plataforma); sem oficina → legado: só % plataforma e saldo na raiz.
 * App (Expo): httpsCallable `createAsaasCharge`, `createAsaasSubaccount` + região EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION.
 * Secrets (Firebase): ASAAS_API_KEY, ASAAS_WEBHOOK_TOKEN, MP_ACCESS_TOKEN, MP_CLIENT_SECRET
 * Opcional: ASAAS_ADMIN_WALLET_ID (obrig. para taxa em marketplace com taxa>0), PLATFORM_FEE_PERCENT, ASAAS_API_URL
 * Mercado Pago: `firebase functions:secrets:set MP_ACCESS_TOKEN` e `MP_CLIENT_SECRET` (nomes no Secret Manager)
 * Parâmetros Firebase (recomendado) ou, no emulador, variáveis de ambiente com os mesmos nomes.
 */
const admin = require("firebase-admin");
const fetch = require("node-fetch");
const { logger } = require("firebase-functions/logger");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret, defineString } = require("firebase-functions/params");
const { setGlobalOptions } = require("firebase-functions/v2");

admin.initializeApp();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const asaasApiKey = defineSecret("ASAAS_API_KEY");
const webhookToken = defineSecret("ASAAS_WEBHOOK_TOKEN");
/** Mercado Pago — mesmos nomes no GCP (Secret Manager). Emulador: defina em `functions/.env` */
const mpAccessToken = defineSecret("MP_ACCESS_TOKEN");
const mpClientSecret = defineSecret("MP_CLIENT_SECRET");

const asaasApiUrl = defineString("ASAAS_API_URL", {
  default: "https://api.asaas.com/v3",
});
const platformFeePercentParam = defineString("PLATFORM_FEE_PERCENT", {
  default: "2.5",
});
/** UUID da carteira Asaas que recebe a taxa da plataforma (nunca expor no app; só Functions) */
const adminWalletIdParam = defineString("ASAAS_ADMIN_WALLET_ID", { default: "" });

/** Percentual padrão da plataforma; sobrescrito por param/env PLATFORM_FEE_PERCENT */
const DEFAULT_PLATFORM_FEE_PERCENT = 2.5;

setGlobalOptions({
  region: "southamerica-east1",
  maxInstances: 10,
});

function roundMoney(n) {
  return Math.round(n * 100) / 100;
}

function batchRemainingPiecesFromData(d) {
  const T =
    typeof d.totalPieces === "number" && Number.isFinite(d.totalPieces) ? d.totalPieces : 0;
  const cum =
    typeof d.piecesDeliveredCumulative === "number" &&
    Number.isFinite(d.piecesDeliveredCumulative)
      ? d.piecesDeliveredCumulative
      : 0;
  return Math.max(0, T - cum);
}

function batchRemainingMonetaryBase(d) {
  const rem = batchRemainingPiecesFromData(d);
  if (rem <= 0) return null;
  const gt =
    typeof d.guaranteedTotal === "number" && Number.isFinite(d.guaranteedTotal)
      ? d.guaranteedTotal
      : null;
  if (gt != null && gt > 0) return roundMoney(gt);
  const pp =
    typeof d.pricePerPiece === "number" && Number.isFinite(d.pricePerPiece)
      ? d.pricePerPiece
      : null;
  if (pp != null && pp > 0) return roundMoney(pp * rem);
  return null;
}

function partialWaveBaseFromBatch(d, wavePieces) {
  const rem = batchRemainingPiecesFromData(d);
  if (rem <= 0 || wavePieces <= 0) return null;
  const baseFull = batchRemainingMonetaryBase(d);
  if (baseFull == null || baseFull <= 0) return null;
  return roundMoney((wavePieces / rem) * baseFull);
}

/** Valor cobrado do dono (base da oficina + % plataforma), alinhado ao app (`applyMarketplaceFeeToBase`). */
function grossAmountWithPlatformFee(base) {
  const b = Number(base);
  if (!Number.isFinite(b) || b <= 0) return 0;
  const pct = getPlatformFeePercent();
  return roundMoney(b * (1 + pct / 100));
}

/**
 * Carteira admin para split. Prioridade: parâmetro Firebase → process.env (emulador/CI).
 */
function getAdminWalletId() {
  const fromParam = adminWalletIdParam.value()?.trim() || "";
  if (fromParam) return fromParam;
  return String(process.env.ASAAS_ADMIN_WALLET_ID || "").trim();
}

/**
 * Percentual (0–100) que vai para a wallet da plataforma no split.
 */
function getPlatformFeePercent() {
  const raw =
    platformFeePercentParam.value()?.trim() ||
    String(process.env.PLATFORM_FEE_PERCENT || "").trim();
  if (!raw) return DEFAULT_PLATFORM_FEE_PERCENT;
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return DEFAULT_PLATFORM_FEE_PERCENT;
  return Math.min(100, Math.max(0, n));
}

async function asaasFetch(apiKey, path, options = {}) {
  const base = asaasApiUrl.value().replace(/\/$/, "");
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      access_token: apiKey,
      "User-Agent": "Raidmon/1.0",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg =
      data.errors && data.errors[0]
        ? data.errors[0].description
        : data.message || text || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

/**
 * Garante cliente Asaas no usuário Firebase
 */
async function ensureAsaasCustomer(apiKey, uid) {
  const userRef = db.collection("users").doc(uid);
  const snap = await userRef.get();
  if (!snap.exists) {
    throw new HttpsError("failed-precondition", "Perfil de usuário não encontrado.");
  }
  const u = snap.data();
  const existing = u.asaasCustomerId;
  if (existing) {
    return existing;
  }

  const name = (u.name || u.email || "Cliente").trim();
  const email = (u.email || "").trim();
  const cpfCnpj = String(u.cpf || "").replace(/\D/g, "");
  if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
    throw new HttpsError(
      "failed-precondition",
      "CPF ou CNPJ válido é obrigatório no perfil para cobrança Asaas."
    );
  }

  const body = {
    name: name.slice(0, 80),
    email: email || undefined,
    cpfCnpj,
    externalReference: uid,
    notificationDisabled: false,
  };

  let created;
  try {
    created = await asaasFetch(apiKey, "/customers", {
      method: "POST",
      body: JSON.stringify(body),
    });
  } catch (e) {
    const list = await asaasFetch(
      apiKey,
      `/customers?externalReference=${encodeURIComponent(uid)}`,
      { method: "GET" }
    );
    const first = list.data && list.data[0];
    if (first?.id) {
      created = first;
    } else {
      throw e;
    }
  }

  const customerId = created.id;
  await userRef.update({
    asaasCustomerId: customerId,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return customerId;
}

const ASAAS_COMPANY_TYPES = new Set(["MEI", "LIMITED", "INDIVIDUAL", "ASSOCIATION"]);

function onlyDigits(s) {
  return String(s || "").replace(/\D/g, "");
}

function formatBrCep(d) {
  const digits = onlyDigits(d);
  if (digits.length === 8) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return String(d || "").trim();
}

function isValidCpfCnpjLength(cpfCnpj) {
  return cpfCnpj.length === 11 || cpfCnpj.length === 14;
}

/**
 * Cria subconta Asaas (POST /v3/accounts) para oficina (userType workshop).
 * Usa a chave raiz (ASAAS_API_KEY). Grava apiKey e ids no `users/{uid}` — devolvida só na criação.
 * Idempotente: se `asaasSubaccountId` já existir, retorna sucesso sem chamar a API.
 */
exports.createAsaasSubaccount = onCall(
  {
    secrets: [asaasApiKey],
    cors: true,
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Faça login para criar a subconta.");
    }
    const uid = request.auth.uid;
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      throw new HttpsError("failed-precondition", "Perfil não encontrado.");
    }
    const u = userSnap.data();
    if (u.userType !== "workshop") {
      throw new HttpsError("failed-precondition", "Subconta Asaas só é criada para contas de oficina.");
    }
    if (u.asaasSubaccountId) {
      return {
        success: true,
        alreadyExists: true,
        asaasSubaccountId: u.asaasSubaccountId,
        walletId: u.asaasSubaccountWalletId || null,
      };
    }

    const D = request.data || {};
    const emailU = (u.email || "").toLowerCase().trim();
    const emailReq = (D.email || "").toLowerCase().trim();
    if (!emailU || emailReq !== emailU) {
      throw new HttpsError("invalid-argument", "E-mail não confere com o cadastro.");
    }

    const cpfCnpj = onlyDigits(D.cpfCnpj);
    if (!isValidCpfCnpjLength(cpfCnpj)) {
      throw new HttpsError("invalid-argument", "CPF ou CNPJ inválido.");
    }
    const profileCpf = onlyDigits(u.cpf || "");
    if (profileCpf && profileCpf !== cpfCnpj) {
      throw new HttpsError("invalid-argument", "CPF/CNPJ não confere com o cadastro.");
    }

    const mobileReq = onlyDigits(D.mobilePhone);
    const phoneU = onlyDigits(u.phone || "");
    if (phoneU && mobileReq !== phoneU) {
      throw new HttpsError("invalid-argument", "Celular não confere com o cadastro.");
    }
    if (mobileReq.length < 10 || mobileReq.length > 11) {
      throw new HttpsError("invalid-argument", "Celular inválido (DDD + número).");
    }

    const w = u.workshopAsaas || {};
    const incomeValue = Number(D.incomeValue);
    if (!Number.isFinite(incomeValue) || incomeValue <= 0) {
      throw new HttpsError("invalid-argument", "Renda/faturamento mensal (incomeValue) inválido.");
    }
    if (w && w.incomeValue != null) {
      const wIncome = Number(w.incomeValue);
      if (Number.isFinite(wIncome) && wIncome > 0 && Math.abs(wIncome - incomeValue) > 0.01) {
        throw new HttpsError("invalid-argument", "Renda/faturamento não confere com o cadastro.");
      }
    }

    const address = (D.address || "").trim();
    const addressNumber = (D.addressNumber || "").trim();
    const province = (D.province || "").trim();
    const postalCode = formatBrCep(D.postalCode);
    if (!address || !addressNumber || !province || !postalCode) {
      throw new HttpsError(
        "invalid-argument",
        "Endereço, número, bairro e CEP são obrigatórios."
      );
    }

    const isPf = cpfCnpj.length === 11;
    let birthDate;
    if (isPf) {
      birthDate = (D.birthDate || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
        throw new HttpsError("invalid-argument", "Data de nascimento (YYYY-MM-DD) é obrigatória para CPF.");
      }
    }
    let companyType;
    if (!isPf) {
      companyType = (D.companyType || "").trim();
      if (!ASAAS_COMPANY_TYPES.has(companyType)) {
        throw new HttpsError(
          "invalid-argument",
          "Para CNPJ, informe companyType: MEI, LIMITED, INDIVIDUAL ou ASSOCIATION."
        );
      }
    }

    const subName =
      cpfCnpj.length === 14
        ? (u.companyName || u.name || "Oficina").trim().slice(0, 200)
        : (u.name || u.companyName || "Oficina").trim().slice(0, 200);

    const body = {
      name: subName,
      email: emailU,
      cpfCnpj,
      mobilePhone: mobileReq,
      incomeValue,
      address: address.slice(0, 200),
      addressNumber: addressNumber.slice(0, 20),
      province: province.slice(0, 200),
      postalCode: postalCode.slice(0, 20),
    };
    if (D.complement && String(D.complement).trim()) {
      body.complement = String(D.complement).trim().slice(0, 200);
    }
    if (D.phone && onlyDigits(D.phone)) {
      body.phone = onlyDigits(D.phone);
    }
    if (D.site && String(D.site).trim().startsWith("http")) {
      body.site = String(D.site).trim().slice(0, 200);
    }
    if (birthDate) {
      body.birthDate = birthDate;
    }
    if (companyType) {
      body.companyType = companyType;
    }
    if (D.loginEmail && String(D.loginEmail).includes("@")) {
      body.loginEmail = String(D.loginEmail).trim().toLowerCase();
    }

    const apiKey = asaasApiKey.value();
    let resBody;
    try {
      resBody = await asaasFetch(apiKey, "/accounts", {
        method: "POST",
        body: JSON.stringify(body),
      });
    } catch (e) {
      logger.error("[createAsaasSubaccount] Asaas error", e.message, e.body);
      const msg = e.message || "Erro ao criar subconta no Asaas.";
      await userRef.set(
        { asaasSubaccountError: msg, asaasSubaccountErrorAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
      throw new HttpsError("internal", msg);
    }

    const asaasId = resBody.id;
    const walletId = resBody.walletId || null;
    const subApiKey = resBody.apiKey || null;

    if (!asaasId) {
      throw new HttpsError("internal", "Resposta inesperada do Asaas (sem id).");
    }
    if (!subApiKey) {
      logger.warn("[createAsaasSubaccount] Asaas respondeu sem apiKey; guarde manualmente se necessário.");
    }

    await userRef.update({
      asaasSubaccountId: asaasId,
      asaasSubaccountApiKey: subApiKey,
      asaasSubaccountWalletId: walletId,
      asaasSubaccountCreatedAt: FieldValue.serverTimestamp(),
      asaasSubaccountError: FieldValue.delete(),
      asaasSubaccountErrorAt: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      asaasSubaccountId: asaasId,
      walletId,
    };
  }
);

exports.createAsaasCharge = onCall(
  {
    secrets: [asaasApiKey],
    cors: true,
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Faça login para gerar cobrança.");
    }
    const uid = request.auth.uid;
    const { paymentId } = request.data || {};
    if (!paymentId || typeof paymentId !== "string") {
      throw new HttpsError("invalid-argument", "paymentId é obrigatório.");
    }

    const apiKey = asaasApiKey.value();
    const payRef = db.collection("payments").doc(paymentId);
    const paySnap = await payRef.get();
    if (!paySnap.exists) {
      throw new HttpsError("not-found", "Pagamento não encontrado.");
    }
    const p = paySnap.data();
    if (p.userId !== uid) {
      throw new HttpsError("permission-denied", "Este pagamento não é seu.");
    }
    if (p.status === "paid" || p.status === "cancelled") {
      throw new HttpsError("failed-precondition", "Pagamento já finalizado.");
    }
    if (p.asaasPaymentId) {
      throw new HttpsError("already-exists", "Já existe cobrança Asaas para este registro.");
    }

    const gross = Number(p.amount);
    if (!gross || gross <= 0) {
      throw new HttpsError("invalid-argument", "Valor inválido.");
    }

    const platformFeePercent = getPlatformFeePercent();
    const platformPct = roundMoney(Math.min(100, Math.max(0, platformFeePercent)));
    const fee = roundMoney((gross * platformPct) / 100);
    const net = roundMoney(gross - fee);

    const customerId = await ensureAsaasCustomer(apiKey, uid);

    let due = new Date();
    if (p.dueDate) {
      if (typeof p.dueDate.toDate === "function") due = p.dueDate.toDate();
      else if (p.dueDate._seconds !== undefined)
        due = new Date(p.dueDate._seconds * 1000);
      else if (p.dueDate.seconds !== undefined)
        due = new Date(p.dueDate.seconds * 1000);
    }
    const dueStr = due.toISOString().slice(0, 10);

    const adminWallet = getAdminWalletId();
    const payload = {
      customer: customerId,
      billingType: "PIX",
      value: gross,
      dueDate: dueStr,
      description: (p.description || "Pagamento Raidmon").slice(0, 200),
      externalReference: paymentId,
    };

    const mpWorkshopUserId =
      p.marketplaceWorkshopUserId != null &&
      String(p.marketplaceWorkshopUserId).trim().length > 0
        ? String(p.marketplaceWorkshopUserId).trim()
        : null;

    const rawWorkshopId = p.workshopId;
    const hasWorkshopRow =
      rawWorkshopId != null && String(rawWorkshopId).trim().length > 0;

    let workshopWalletId = null;
    let workshopAccountUserId = null;
    let useMarketplaceSplit = false;

    async function loadWorkshopAsaasUser(wUid) {
      const wUserSnap = await db.collection("users").doc(wUid).get();
      if (!wUserSnap.exists) {
        throw new HttpsError(
          "failed-precondition",
          "Conta Asaas da oficina não encontrada (perfil inexistente)."
        );
      }
      const wu = wUserSnap.data();
      if (wu.userType !== "workshop") {
        throw new HttpsError(
          "failed-precondition",
          "O vinculado a esta oficina não possui perfil de oficina."
        );
      }
      const subId = (wu.asaasSubaccountId || "").trim();
      const wallet = (wu.asaasSubaccountWalletId || "").trim();
      if (!subId) {
        throw new HttpsError(
          "failed-precondition",
          "A oficina ainda não possui subconta Asaas. Só após a integração é possível gerar cobrança de marketplace."
        );
      }
      if (!wallet) {
        throw new HttpsError(
          "failed-precondition",
          "A oficina sem carteira (wallet) Asaas. Peça a oficina a revalidar a integração no app."
        );
      }
      if (wUid === uid) {
        throw new HttpsError(
          "invalid-argument",
          "Não é possível gerar marketplace entre a mesma conta (pagador e recebedor)."
        );
      }
      return { workshopWalletId: wallet, workshopAccountUserId: wUid };
    }

    if (mpWorkshopUserId) {
      const w = await loadWorkshopAsaasUser(mpWorkshopUserId);
      workshopWalletId = w.workshopWalletId;
      workshopAccountUserId = w.workshopAccountUserId;
      useMarketplaceSplit = true;
    } else if (hasWorkshopRow) {
      const workshopDocId = String(rawWorkshopId).trim();
      const wsRef = db.collection("workshops").doc(workshopDocId);
      const wsSnap = await wsRef.get();
      if (!wsSnap.exists) {
        throw new HttpsError(
          "failed-precondition",
          "Oficina não encontrada. Escolha uma oficina válida no pagamento."
        );
      }
      const wshop = wsSnap.data();
      const wUid = wshop && wshop.userId ? String(wshop.userId).trim() : "";
      if (!wUid) {
        throw new HttpsError(
          "failed-precondition",
          "Oficina sem usuário vinculado. Contate o suporte."
        );
      }
      const w = await loadWorkshopAsaasUser(wUid);
      workshopWalletId = w.workshopWalletId;
      workshopAccountUserId = w.workshopAccountUserId;
      useMarketplaceSplit = true;
    }

    if (useMarketplaceSplit) {
      if (platformPct > 0 && !adminWallet) {
        throw new HttpsError(
          "failed-precondition",
          "Plataforma: configure ASAAS_ADMIN_WALLET_ID no ambiente (taxa " +
            platformPct +
            "%)."
        );
      }
      const workshopPercent = roundMoney(100 - platformPct);
      if (workshopPercent <= 0) {
        throw new HttpsError(
          "failed-precondition",
          "A taxa da plataforma (PLATFORM_FEE_PERCENT) não pode ser 100% no fluxo de marketplace."
        );
      }
      if (Math.abs(workshopPercent + platformPct - 100) > 0.02) {
        throw new HttpsError("internal", "Soma de percentuais de split inválida.");
      }
      const splitList = [];
      if (workshopPercent > 0) {
        splitList.push({ walletId: workshopWalletId, percentualValue: workshopPercent });
      }
      if (platformPct > 0) {
        splitList.push({ walletId: adminWallet, percentualValue: platformPct });
      }
      if (gross > 0 && splitList.length > 0) {
        payload.split = splitList;
      }
      if (process.env.FUNCTIONS_EMULATOR === "true") {
        logger.debug(
          "[createAsaasCharge] marketplace split: oficina " +
            workshopPercent +
            "% + plataforma " +
            platformPct +
            "%"
        );
      }
    } else {
      // Assinaturas e cobranças sem oficina: emissor = conta raiz; só taxa % para a carteira admin, restante na raiz
      const shouldApplySplit =
        adminWallet && gross > 0 && platformPct > 0 && fee > 0;
      if (shouldApplySplit) {
        payload.split = [{ walletId: adminWallet, percentualValue: platformPct }];
      }
      if (process.env.FUNCTIONS_EMULATOR === "true" && shouldApplySplit) {
        logger.debug(
          "[createAsaasCharge] split legado (sem oficina): plataforma=" + platformPct + "%"
        );
      }
    }

    let charge;
    try {
      charge = await asaasFetch(apiKey, "/payments", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.error("Asaas create payment error", e.message, e.body);
      throw new HttpsError("internal", e.message || "Erro ao criar cobrança no Asaas.");
    }

    const asaasPaymentId = charge.id;
    let pixData = null;
    try {
      pixData = await asaasFetch(apiKey, `/payments/${asaasPaymentId}/pixQrCode`, {
        method: "GET",
      });
    } catch (e) {
      console.warn("pixQrCode fetch warn", e.message);
    }

    const firestorePaymentUpdate = {
      provider: "asaas",
      asaasPaymentId,
      platformFeePercent: platformPct,
      platformFeeAmount: fee,
      netAmountAfterFee: net,
      asaasInvoiceUrl: charge.invoiceUrl || null,
      asaasBillingType: "PIX",
      pixCopyPaste: pixData?.payload || null,
      pixEncodedImage: pixData?.encodedImage || null,
      pixExpiration: pixData?.expirationDate || null,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (useMarketplaceSplit && workshopAccountUserId && workshopWalletId) {
      firestorePaymentUpdate.marketplaceMode = true;
      firestorePaymentUpdate.marketplaceWorkshopUserId = workshopAccountUserId;
      firestorePaymentUpdate.asaasMarketplaceWorkshopWalletId = workshopWalletId;
    } else {
      firestorePaymentUpdate.marketplaceMode = false;
      firestorePaymentUpdate.marketplaceWorkshopUserId = FieldValue.delete();
      firestorePaymentUpdate.asaasMarketplaceWorkshopWalletId = FieldValue.delete();
    }

    await payRef.update(firestorePaymentUpdate);

    return {
      asaasPaymentId,
      invoiceUrl: charge.invoiceUrl || null,
      pixCopyPaste: pixData?.payload || null,
      pixEncodedImage: pixData?.encodedImage || null,
      pixExpirationDate: pixData?.expirationDate || null,
      platformFeePercent: platformPct,
      platformFeeAmount: fee,
      grossAmount: gross,
    };
  }
);

/**
 * HTTP webhook Asaas (POST). Autenticação: ASAAS_WEBHOOK_TOKEN (secret / process.env)
 * vs header `asaas-access-token`, query `?token=` ou campos no body.
 * Resposta de sucesso: 200 + corpo "OK" (evita reenvios desnecessários).
 * Equivalente moderno a `functions.https.onRequest` (Firebase Functions v2).
 */
exports.asaasWebhook = onRequest(
  {
    secrets: [webhookToken],
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const {
      extractWebhookToken,
      parseJsonBody,
      tokensMatch,
      dispatchAsaasEvent,
    } = require("./asaasWebhook.logic");

    const body = parseJsonBody(req);
    req.body = body;

    console.log("[asaasWebhook] body recebido:", JSON.stringify(body));

    const expected =
      process.env.ASAAS_WEBHOOK_TOKEN || webhookToken.value();
    const incoming = extractWebhookToken(req);

    if (!tokensMatch(expected, incoming)) {
      console.warn("[asaasWebhook] token inválido ou ausente");
      res.status(401).send("Unauthorized");
      return;
    }

    const eventType = typeof body.event === "string" ? body.event : null;

    try {
      await dispatchAsaasEvent(eventType, body, { db, FieldValue, admin });
    } catch (e) {
      console.error("[asaasWebhook] erro ao processar (ainda assim 200 OK):", e);
    }

    res.status(200).send("OK");
  }
);

// --- Convites de lote (dono → oficina via link WhatsApp) ---

exports.getBatchInvitePreview = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Faça login para continuar.");
  }
  const { batchId, token } = request.data || {};
  if (!batchId || typeof batchId !== "string" || !token || typeof token !== "string") {
    throw new HttpsError("invalid-argument", "Parâmetros inválidos.");
  }

  const snap = await db.collection("batches").doc(batchId).get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Lote não encontrado.");
  }
  const d = snap.data();
  if (!d.inviteToken || d.inviteToken !== token) {
    throw new HttpsError("permission-denied", "Convite inválido ou expirado.");
  }

  const ownerSnap = await db.collection("users").doc(d.userId).get();
  const ownerName = ownerSnap.exists ? ownerSnap.data().name || "" : "";

  let observations = typeof d.observations === "string" ? d.observations : "";
  let cutObservations = null;
  if (d.cutId && typeof d.cutId === "string") {
    try {
      const cutSnap = await db.collection("cuts").doc(d.cutId).get();
      if (cutSnap.exists) {
        const cd = cutSnap.data();
        cutObservations =
          typeof cd.observations === "string" && cd.observations.trim()
            ? cd.observations
            : null;
      }
    } catch (e) {
      logger.warn("[getBatchInvitePreview] cut read failed", e);
    }
  }

  let deliveryDateIso = null;
  if (d.deliveryDate) {
    const dd = toJsDate(d.deliveryDate);
    if (dd && !Number.isNaN(dd.getTime())) {
      deliveryDateIso = dd.toISOString();
    }
  }

  const workshopUid = request.auth.uid;
  let canAccept = true;
  let reason = null;
  if (d.linkedWorkshopUserId) {
    if (d.linkedWorkshopUserId !== workshopUid) {
      canAccept = false;
      reason = "other_workshop";
    } else if (d.status === "in_progress") {
      canAccept = false;
      reason = "already_yours";
    }
  }

  return {
    batchId,
    name: d.name,
    totalPieces: d.totalPieces,
    pricePerPiece:
      typeof d.pricePerPiece === "number" && Number.isFinite(d.pricePerPiece)
        ? d.pricePerPiece
        : null,
    guaranteedTotal:
      typeof d.guaranteedTotal === "number" && Number.isFinite(d.guaranteedTotal)
        ? d.guaranteedTotal
        : null,
    cutListNumber:
      typeof d.cutListNumber === "number" && Number.isFinite(d.cutListNumber)
        ? d.cutListNumber
        : null,
    ownerName,
    status: d.status,
    linkedWorkshopUserId: d.linkedWorkshopUserId || null,
    canAccept,
    reason,
    observations: observations || null,
    cutObservations,
    deliveryDateIso,
  };
});

exports.respondBatchInvite = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Faça login para continuar.");
  }
  const { batchId, token, action, deliveryDate: deliveryDateRaw } = request.data || {};
  if (!batchId || typeof batchId !== "string" || !token || typeof token !== "string") {
    throw new HttpsError("invalid-argument", "Parâmetros inválidos.");
  }

  const uid = request.auth.uid;
  const userSnap = await db.collection("users").doc(uid).get();
  const userType = userSnap.data()?.userType;
  if (userType !== "workshop") {
    throw new HttpsError(
      "failed-precondition",
      "Esta ação é apenas para contas de oficina.",
    );
  }

  const batchRef = db.collection("batches").doc(batchId);
  const batchSnap = await batchRef.get();
  if (!batchSnap.exists) {
    throw new HttpsError("not-found", "Lote não encontrado.");
  }
  const d = batchSnap.data();
  if (!d.inviteToken || d.inviteToken !== token) {
    throw new HttpsError("permission-denied", "Convite inválido.");
  }

  if (action === "request_adjust") {
    return { ok: false, message: "em_breve" };
  }

  if (action !== "accept") {
    throw new HttpsError("invalid-argument", "Ação desconhecida.");
  }

  if (!deliveryDateRaw || typeof deliveryDateRaw !== "string") {
    throw new HttpsError("invalid-argument", "Informe a data de entrega prevista.");
  }
  const deliveryD = new Date(deliveryDateRaw);
  if (Number.isNaN(deliveryD.getTime())) {
    throw new HttpsError("invalid-argument", "Data de entrega inválida.");
  }
  const deliveryTs = admin.firestore.Timestamp.fromDate(deliveryD);

  if (d.linkedWorkshopUserId && d.linkedWorkshopUserId !== uid) {
    throw new HttpsError(
      "failed-precondition",
      "Este lote já foi aceito por outra oficina.",
    );
  }
  if (d.linkedWorkshopUserId === uid && d.status === "in_progress") {
    return { ok: true, alreadyAccepted: true };
  }
  if (d.status !== "pending" && d.status !== "in_progress") {
    throw new HttpsError(
      "failed-precondition",
      "Este lote não pode ser aceito no estado atual.",
    );
  }

  const workshopLabel =
    (userSnap.data()?.companyName || userSnap.data()?.name || "").trim() || null;
  let ownerName = null;
  if (d.userId && typeof d.userId === "string") {
    try {
      const ownerSnap = await db.collection("users").doc(d.userId).get();
      ownerName = (ownerSnap.data()?.name || ownerSnap.data()?.companyName || "").trim() || null;
    } catch (e) {
      logger.warn("[respondBatchInvite] owner lookup failed", e);
    }
  }

  await batchRef.update({
    status: "in_progress",
    linkedWorkshopUserId: uid,
    productionFlowStatus: "in_production",
    acceptedFromOwnerInvite: true,
    inviteAcceptedAt: FieldValue.serverTimestamp(),
    inviteAcceptedByUserId: uid,
    inviteAcceptedByName: workshopLabel || null,
    inviteAcceptedVia: "whatsapp_link",
    deliveryDate: deliveryTs,
    ...(ownerName ? { ownerName } : {}),
    ...(workshopLabel ? { workshopName: workshopLabel } : {}),
    updatedAt: FieldValue.serverTimestamp(),
  });

  const afterSnap = await batchRef.get();
  const after = afterSnap.data() || d;
  await updateWorkshopDocStatusForBatch({ ...d, ...after, id: batchId });

  if (d.userId && typeof d.userId === "string") {
    await createInAppNotification({
      userId: d.userId,
      fromUserId: uid,
      type: "workshop_started_from_invite",
      title: "Oficina iniciou a produção",
      body: `${workshopLabel || "Oficina"} aceitou e iniciou a produção do lote "${d.name || "lote"}".`,
      batchId,
    });
  }

  return { ok: true };
});

/**
 * Oficina: conclui o lote e gera link para o dono preencher recebimento (peças/defeitos) antes do PIX.
 */
exports.completeBatchAndInviteOwnerCheckout = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Faça login para continuar.");
  }
  const { batchId } = request.data || {};
  if (!batchId || typeof batchId !== "string") {
    throw new HttpsError("invalid-argument", "Lote inválido.");
  }
  const uid = request.auth.uid;
  const userSnap = await db.collection("users").doc(uid).get();
  if (userSnap.data()?.userType !== "workshop") {
    throw new HttpsError("failed-precondition", "Apenas contas de oficina.");
  }

  const batchRef = db.collection("batches").doc(batchId);
  const preSnap = await batchRef.get();
  if (!preSnap.exists) {
    throw new HttpsError("not-found", "Lote não encontrado.");
  }
  const pre = preSnap.data();
  if (pre.linkedWorkshopUserId !== uid) {
    throw new HttpsError("permission-denied", "Este lote não está vinculado a você.");
  }

  if (pre.status === "completed" && pre.ownerBatchCheckoutToken) {
    return {
      batchId,
      token: pre.ownerBatchCheckoutToken,
      alreadyCompleted: true,
    };
  }

  if (pre.status !== "in_progress" && pre.status !== "pending") {
    throw new HttpsError(
      "failed-precondition",
      "Só é possível concluir lotes em produção ou pendentes vinculados a você.",
    );
  }

  const ownerId = pre.userId;
  if (!ownerId || typeof ownerId !== "string") {
    throw new HttpsError("failed-precondition", "Lote sem dono vinculado.");
  }

  const workshopLabel =
    (pre.workshopName ||
      userSnap.data()?.companyName ||
      userSnap.data()?.name ||
      "").trim() || "Oficina";
  const pieceLabel = pre.name || "Lote";
  const checkoutToken = genToken();

  const rem = batchRemainingPiecesFromData(pre);
  const partialN = pre.partialPiecesDone;
  const isPartialWave =
    pre.productionFlowStatus === "partial" &&
    typeof partialN === "number" &&
    Number.isFinite(partialN) &&
    partialN >= 1 &&
    partialN <= rem;

  await db.runTransaction(async (tx) => {
    const s = await tx.get(batchRef);
    if (!s.exists) {
      throw new HttpsError("not-found", "Lote não encontrado.");
    }
    const cur = s.data();
    if (cur.linkedWorkshopUserId !== uid) {
      throw new HttpsError("permission-denied", "Este lote não está vinculado a você.");
    }
    if (cur.status === "completed" && cur.ownerBatchCheckoutToken) {
      return;
    }
    if (cur.status !== "in_progress" && cur.status !== "pending") {
      throw new HttpsError("failed-precondition", "Estado do lote não permite concluir.");
    }

    const remTx = batchRemainingPiecesFromData(cur);
    const pN = cur.partialPiecesDone;
    const partialWave =
      cur.productionFlowStatus === "partial" &&
      typeof pN === "number" &&
      Number.isFinite(pN) &&
      pN >= 1 &&
      pN <= remTx;

    if (partialWave) {
      const waveBase = partialWaveBaseFromBatch(cur, pN);
      if (waveBase == null || waveBase <= 0) {
        throw new HttpsError(
          "failed-precondition",
          "Não foi possível calcular o valor desta entrega parcial (preço/total do lote).",
        );
      }
      tx.update(batchRef, {
        status: "in_progress",
        productionFlowStatus: "ready_for_pickup",
        ownerBatchCheckoutToken: checkoutToken,
        checkoutReferencePieces: pN,
        checkoutWaveGuaranteedBase: waveBase,
        partialPiecesDone: FieldValue.delete(),
        productionNote: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      tx.update(batchRef, {
        status: "completed",
        productionFlowStatus: "ready_for_pickup",
        completedAt: FieldValue.serverTimestamp(),
        ownerBatchCheckoutToken: checkoutToken,
        productionNote: FieldValue.delete(),
        partialPiecesDone: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  });

  const afterSnap = await batchRef.get();
  const after = afterSnap.data() || {};
  const finalToken = after.ownerBatchCheckoutToken || checkoutToken;
  await updateWorkshopDocStatusForBatch({ ...pre, ...after, id: batchId });

  const notifyPartial = isPartialWave;
  await createInAppNotification({
    userId: ownerId,
    fromUserId: uid,
    type: "owner_workshop_payment",
    title: notifyPartial ? "Entrega parcial — conferir e pagar" : "Produção concluída",
    body: notifyPartial
      ? `${workshopLabel} registrou entrega parcial de "${pieceLabel}". Abra o link, confira as peças e gere o PIX (proporcional). O lote segue em produção até fechar o total.`
      : `${workshopLabel} concluiu "${pieceLabel}". Abra o link, confira as peças recebidas e gere o PIX.`,
    batchId,
  });

  return {
    batchId,
    token: finalToken,
    alreadyCompleted: false,
  };
});

/**
 * Dono: dados do lote para tela de conferência antes do pagamento.
 */
exports.getOwnerBatchCheckoutPreview = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Faça login para continuar.");
  }
  const { batchId, token } = request.data || {};
  if (!batchId || typeof batchId !== "string" || !token || typeof token !== "string") {
    throw new HttpsError("invalid-argument", "Dados inválidos.");
  }
  const uid = request.auth.uid;
  const bRef = db.collection("batches").doc(batchId);
  const bSnap = await bRef.get();
  if (!bSnap.exists) {
    throw new HttpsError("not-found", "Lote não encontrado.");
  }
  const d = bSnap.data();
  if (d.userId !== uid) {
    throw new HttpsError("permission-denied", "Este link não é para sua conta.");
  }
  if (!d.ownerBatchCheckoutToken || d.ownerBatchCheckoutToken !== token) {
    throw new HttpsError("permission-denied", "Link inválido ou expirado.");
  }
  const checkoutRef =
    typeof d.checkoutReferencePieces === "number" && Number.isFinite(d.checkoutReferencePieces)
      ? d.checkoutReferencePieces
      : null;
  const partialWaveCheckout =
    d.status === "in_progress" && checkoutRef != null && checkoutRef > 0;
  if (d.status !== "completed" && !partialWaveCheckout) {
    throw new HttpsError("failed-precondition", "Este lote ainda não foi concluído pela oficina.");
  }

  const totalPieces =
    typeof d.totalPieces === "number" && Number.isFinite(d.totalPieces) ? d.totalPieces : 0;
  const pricePerPiece =
    typeof d.pricePerPiece === "number" && Number.isFinite(d.pricePerPiece)
      ? d.pricePerPiece
      : null;
  const guaranteedTotal =
    typeof d.guaranteedTotal === "number" && Number.isFinite(d.guaranteedTotal)
      ? d.guaranteedTotal
      : null;
  const checkoutWaveGuaranteedBase =
    typeof d.checkoutWaveGuaranteedBase === "number" && Number.isFinite(d.checkoutWaveGuaranteedBase)
      ? d.checkoutWaveGuaranteedBase
      : null;
  const conferenceMaxPieces =
    checkoutRef != null && checkoutRef > 0 ? checkoutRef : totalPieces;
  const workshopName =
    typeof d.workshopName === "string" && d.workshopName.trim()
      ? d.workshopName.trim()
      : null;
  const wUid = d.linkedWorkshopUserId;
  let marketplaceWorkshopUserId = typeof wUid === "string" ? wUid : null;

  let existingPayment = null;
  if (d.ownerWorkshopPayPaymentId && typeof d.ownerWorkshopPayPaymentId === "string") {
    const pSnap = await db.collection("payments").doc(d.ownerWorkshopPayPaymentId).get();
    if (pSnap.exists) {
      const pd = pSnap.data();
      existingPayment = {
        paymentId: d.ownerWorkshopPayPaymentId,
        inviteToken: pd.ownerPaymentInviteToken || null,
        status: pd.status || "pending",
        hasCharge: !!(pd.asaasPaymentId && String(pd.asaasPaymentId).trim()),
        grossAmount: typeof pd.amount === "number" ? pd.amount : Number(pd.amount) || 0,
        baseAmount:
          pd.ownerCheckoutBaseAmount != null ? Number(pd.ownerCheckoutBaseAmount) : null,
        piecesReceived:
          pd.batchPiecesReceived != null ? Number(pd.batchPiecesReceived) : null,
        defectivePieces:
          pd.batchDefectivePieces != null ? Number(pd.batchDefectivePieces) : null,
      };
    }
  }

  return {
    batchId,
    batchName: d.name || null,
    totalPieces,
    conferenceMaxPieces,
    checkoutWaveGuaranteedBase,
    pricePerPiece,
    guaranteedTotal,
    workshopName,
    marketplaceWorkshopUserId,
    platformFeePercent: getPlatformFeePercent(),
    existingPayment,
  };
});

/**
 * Dono: informa peças recebidas / defeitos e cria cobrança (valor proporcional + taxa plataforma).
 */
exports.submitOwnerBatchCheckoutAndCreatePayment = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Faça login para continuar.");
  }
  const { batchId, token, piecesReceived: prRaw, defectivePieces: defRaw } = request.data || {};
  if (!batchId || typeof batchId !== "string" || !token || typeof token !== "string") {
    throw new HttpsError("invalid-argument", "Dados inválidos.");
  }
  const piecesReceived = Number(prRaw);
  const defectivePieces = defRaw == null || defRaw === "" ? 0 : Number(defRaw);
  if (!Number.isFinite(piecesReceived) || piecesReceived < 0) {
    throw new HttpsError("invalid-argument", "Quantidade de peças recebidas inválida.");
  }
  if (!Number.isFinite(defectivePieces) || defectivePieces < 0) {
    throw new HttpsError("invalid-argument", "Quantidade com defeito inválida.");
  }

  const uid = request.auth.uid;
  const batchRef = db.collection("batches").doc(batchId);

  const preSnap = await batchRef.get();
  if (!preSnap.exists) {
    throw new HttpsError("not-found", "Lote não encontrado.");
  }
  const pre = preSnap.data();
  if (pre.userId !== uid) {
    throw new HttpsError("permission-denied", "Acesso negado.");
  }
  if (!pre.ownerBatchCheckoutToken || pre.ownerBatchCheckoutToken !== token) {
    throw new HttpsError("permission-denied", "Link inválido ou expirado.");
  }
  const checkoutRef =
    typeof pre.checkoutReferencePieces === "number" && Number.isFinite(pre.checkoutReferencePieces)
      ? pre.checkoutReferencePieces
      : null;
  const partialWaveCheckout =
    pre.status === "in_progress" && checkoutRef != null && checkoutRef > 0;
  if (pre.status !== "completed" && !partialWaveCheckout) {
    throw new HttpsError("failed-precondition", "Lote não está concluído.");
  }

  const totalPieces =
    typeof pre.totalPieces === "number" && Number.isFinite(pre.totalPieces)
      ? pre.totalPieces
      : 0;
  if (totalPieces <= 0) {
    throw new HttpsError("failed-precondition", "Lote sem quantidade válida.");
  }
  const refCap = checkoutRef != null && checkoutRef > 0 ? checkoutRef : totalPieces;
  if (piecesReceived > refCap) {
    throw new HttpsError(
      "invalid-argument",
      `Peças recebidas não podem ultrapassar o máximo desta entrega (${refCap}).`,
    );
  }
  if (defectivePieces > piecesReceived) {
    throw new HttpsError(
      "invalid-argument",
      "Peças com defeito não podem ser maiores que as recebidas.",
    );
  }

  const billable = Math.floor(piecesReceived - defectivePieces);
  if (billable < 1) {
    throw new HttpsError(
      "invalid-argument",
      "É necessário pelo menos uma peça em condição de uso para gerar o pagamento.",
    );
  }

  const wShopUid = pre.linkedWorkshopUserId;
  if (!wShopUid || typeof wShopUid !== "string") {
    throw new HttpsError("failed-precondition", "Lote sem oficina vinculada para repasse.");
  }

  if (pre.ownerWorkshopPayPaymentId && typeof pre.ownerWorkshopPayPaymentId === "string") {
    const existingRef = db.collection("payments").doc(pre.ownerWorkshopPayPaymentId);
    const exSnap = await existingRef.get();
    if (exSnap.exists) {
      const ep = exSnap.data();
      if (ep.status === "paid") {
        throw new HttpsError("failed-precondition", "Este lote já foi pago.");
      }
      if (ep.status === "pending" || ep.status === "overdue") {
        const inviteTok = ep.ownerPaymentInviteToken || null;
        if (!inviteTok) {
          throw new HttpsError("internal", "Pagamento pendente sem token.");
        }
        return {
          paymentId: pre.ownerWorkshopPayPaymentId,
          token: inviteTok,
          grossAmount: typeof ep.amount === "number" ? ep.amount : Number(ep.amount) || 0,
          baseAmount:
            ep.ownerCheckoutBaseAmount != null ? Number(ep.ownerCheckoutBaseAmount) : null,
          billablePieces: ep.batchBillablePieces != null ? Number(ep.batchBillablePieces) : billable,
          alreadyCreated: true,
        };
      }
    }
  }

  let base = null;
  const waveBase =
    typeof pre.checkoutWaveGuaranteedBase === "number" &&
    Number.isFinite(pre.checkoutWaveGuaranteedBase)
      ? pre.checkoutWaveGuaranteedBase
      : null;
  if (checkoutRef != null && checkoutRef > 0 && waveBase != null && waveBase > 0) {
    base = roundMoney((billable / checkoutRef) * waveBase);
  } else {
    const pp = pre.pricePerPiece;
    const pOk = typeof pp === "number" && Number.isFinite(pp) && pp > 0;
    if (pOk) {
      base = roundMoney(billable * pp);
    } else {
      const gt = pre.guaranteedTotal;
      const gOk = typeof gt === "number" && Number.isFinite(gt) && gt > 0;
      if (gOk) {
        base = roundMoney((billable / totalPieces) * gt);
      }
    }
  }
  if (base == null || base <= 0) {
    throw new HttpsError(
      "failed-precondition",
      "Não foi possível calcular o valor (preço por peça ou total garantido ausente).",
    );
  }

  const gross = grossAmountWithPlatformFee(base);
  const due = new Date();
  due.setDate(due.getDate() + 7);
  const dueTs = admin.firestore.Timestamp.fromDate(due);
  const payToken = genToken();
  const payRef = db.collection("payments").doc();
  const workshopLabel =
    (typeof pre.workshopName === "string" && pre.workshopName.trim()
      ? pre.workshopName
      : "Oficina") || "Oficina";
  const pieceLabel = pre.name || "Lote";
  const desc = `Lote "${pieceLabel}" — ${billable} peça(s) ok (${piecesReceived} receb., ${defectivePieces} defeito)`;

  await db.runTransaction(async (tx) => {
    const s = await tx.get(batchRef);
    if (!s.exists) {
      throw new HttpsError("not-found", "Lote não encontrado.");
    }
    const cur = s.data();
    if (cur.userId !== uid || cur.ownerBatchCheckoutToken !== token) {
      throw new HttpsError("permission-denied", "Sessão inválida.");
    }
    if (cur.ownerWorkshopPayPaymentId) {
      throw new HttpsError("already-exists", "Pagamento já registrado para este lote.");
    }

    tx.set(payRef, {
      userId: uid,
      amount: gross,
      dueDate: dueTs,
      description: desc.slice(0, 200),
      status: "pending",
      batchId,
      batchName: pre.name || null,
      workshopName: workshopLabel,
      marketplaceWorkshopUserId: wShopUid,
      ownerPaymentInviteToken: payToken,
      ownerPaymentInviteKind: "owner_batch_checkout",
      batchPiecesReceived: piecesReceived,
      batchDefectivePieces: defectivePieces,
      batchBillablePieces: billable,
      ownerCheckoutBaseAmount: base,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.update(batchRef, {
      ownerWorkshopPayPaymentId: payRef.id,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return {
    paymentId: payRef.id,
    token: payToken,
    grossAmount: gross,
    baseAmount: base,
    billablePieces: billable,
    alreadyCreated: false,
  };
});

/**
 * Dono: valida token do link e obtém resumo + dados PIX se a cobrança já existir.
 */
exports.getOwnerPaymentInvitePreview = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Faça login para continuar.");
  }
  const { paymentId, token } = request.data || {};
  if (!paymentId || typeof paymentId !== "string" || !token || typeof token !== "string") {
    throw new HttpsError("invalid-argument", "Dados inválidos.");
  }
  const uid = request.auth.uid;
  const payRef = db.collection("payments").doc(paymentId);
  const paySnap = await payRef.get();
  if (!paySnap.exists) {
    throw new HttpsError("not-found", "Pagamento não encontrado.");
  }
  const p = paySnap.data();
  if (p.userId !== uid) {
    throw new HttpsError("permission-denied", "Este link não é para sua conta.");
  }
  if (!p.ownerPaymentInviteToken || p.ownerPaymentInviteToken !== token) {
    throw new HttpsError("permission-denied", "Link inválido ou expirado.");
  }

  let batchName = p.batchName || null;
  let totalPieces = null;
  if (p.batchId && typeof p.batchId === "string") {
    try {
      const bSnap = await db.collection("batches").doc(p.batchId).get();
      if (bSnap.exists) {
        const bd = bSnap.data();
        batchName = bd.name || batchName;
        if (typeof bd.totalPieces === "number" && Number.isFinite(bd.totalPieces)) {
          totalPieces = bd.totalPieces;
        }
      }
    } catch (e) {
      logger.warn("[getOwnerPaymentInvitePreview] batch read failed", e);
    }
  }

  const platformFeePercent = getPlatformFeePercent();

  return {
    paymentId,
    batchName,
    totalPieces,
    amount: typeof p.amount === "number" ? p.amount : Number(p.amount) || 0,
    workshopName: p.workshopName || null,
    description: p.description || "",
    status: p.status || "pending",
    platformFeePercent,
    hasCharge: !!(p.asaasPaymentId && String(p.asaasPaymentId).trim()),
    pixCopyPaste: p.pixCopyPaste || null,
    pixEncodedImage: p.pixEncodedImage || null,
    asaasInvoiceUrl: p.asaasInvoiceUrl || null,
    pixExpiration: p.pixExpiration || null,
  };
});

const IN_APP_NOTIFICATIONS = "inAppNotifications";

function genToken() {
  return [...Array(4)]
    .map(() => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2))
    .join("");
}

function toJsDate(fireOrDate) {
  if (!fireOrDate) return null;
  if (typeof fireOrDate.toDate === "function") return fireOrDate.toDate();
  return new Date(fireOrDate);
}

function startOfLocalDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Atraso: data de entrega (lote) antes de hoje e ainda ativo.
 */
function isActiveBatchDelayed(batch) {
  if (batch.status === "completed" || batch.status === "cancelled") return false;
  const dd = toJsDate(batch.deliveryDate);
  if (!dd) return false;
  return startOfLocalDay(dd).getTime() < startOfLocalDay(new Date()).getTime();
}

async function createInAppNotification({
  userId,
  fromUserId,
  type,
  title,
  body,
  batchId,
  receiveId,
}) {
  await db.collection(IN_APP_NOTIFICATIONS).add({
    userId,
    fromUserId: fromUserId || null,
    type,
    title,
    body,
    batchId: batchId || null,
    receiveId: receiveId || null,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Sincroniza a bolinha de status do cadastro de oficina (dono) com o lote.
 */
async function updateWorkshopDocStatusForBatch(batch) {
  if (!batch || !batch.workshopId) return;
  const wRef = db.collection("workshops").doc(batch.workshopId);
  const wSnap = await wRef.get();
  if (!wSnap.exists) return;
  if (wSnap.data().userId !== batch.userId) return;
  const flow = batch.productionFlowStatus;
  let status = "yellow";
  if (flow === "ready_for_pickup") {
    status = "green";
  } else if (flow === "partial") {
    status = "orange";
  } else if (flow === "in_production" || flow === "paused") {
    status = "yellow";
  }
  if (isActiveBatchDelayed(batch)) {
    status = "red";
  }
  await wRef.update({ status, updatedAt: FieldValue.serverTimestamp() });
}

/**
 * Ações da oficina no lote (o cliente Firestore não permite update no lote p/ oficina).
 * action: ready_for_pickup | mark_partial | mark_pause | set_delivery
 */
exports.workshopBatchAction = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Faça login para continuar.");
  }
  const { batchId, action, message, partialPiecesDone, deliveryDate } = request.data || {};
  if (!batchId || typeof batchId !== "string") {
    throw new HttpsError("invalid-argument", "Lote inválido.");
  }

  const uid = request.auth.uid;
  const userSnap = await db.collection("users").doc(uid).get();
  if (userSnap.data()?.userType !== "workshop") {
    throw new HttpsError("failed-precondition", "Apenas contas de oficina.");
  }

  const batchRef = db.collection("batches").doc(batchId);
  const batchSnap = await batchRef.get();
  if (!batchSnap.exists) {
    throw new HttpsError("not-found", "Lote não encontrado.");
  }
  const d = batchSnap.data();
  if (d.linkedWorkshopUserId !== uid) {
    throw new HttpsError("permission-denied", "Este lote não está vinculado a você.");
  }
  if (d.status !== "in_progress" && d.status !== "pending") {
    throw new HttpsError("failed-precondition", "Este lote não está em produção.");
  }

  const ownerId = d.userId;
  const pieceLabel = d.name || "Lote";
  const labelFromWorkshop = (d.workshopName || "Oficina").trim() || "Oficina";

  if (action === "ready_for_pickup") {
    await batchRef.update({
      productionFlowStatus: "ready_for_pickup",
      readyForPickupAt: FieldValue.serverTimestamp(),
      productionNote: FieldValue.delete(),
      partialPiecesDone: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await createInAppNotification({
      userId: ownerId,
      fromUserId: uid,
      type: "workshop_ready",
      title: "Pronta para coletar",
      body: `${labelFromWorkshop} avisou: "${pieceLabel}" está pronta para coleta.`,
      batchId,
    });
  } else if (action === "mark_partial" || action === "mark_pause") {
    const m = typeof message === "string" ? message.trim() : "";
    if (m.length < 3) {
      throw new HttpsError("invalid-argument", "Explique a situação (mínimo 3 caracteres).");
    }
    const rem = batchRemainingPiecesFromData(d);
    if (action === "mark_partial") {
      const n = partialPiecesDone == null ? NaN : Number(partialPiecesDone);
      if (!Number.isFinite(n) || n < 1 || n > rem) {
        throw new HttpsError(
          "invalid-argument",
          rem < 1
            ? "Não há peças pendentes neste lote para registrar entrega parcial."
            : `Informe quantas peças serão entregues nesta etapa (1 a ${rem}).`,
        );
      }
    }
    const u = {
      productionFlowStatus: action === "mark_partial" ? "partial" : "paused",
      productionNote: m,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (action === "mark_partial") {
      u.partialPiecesDone = Number(partialPiecesDone);
    } else {
      u.partialPiecesDone = FieldValue.delete();
    }
    await batchRef.update(u);
    const isPartial = action === "mark_partial";
    await createInAppNotification({
      userId: ownerId,
      fromUserId: uid,
      type: isPartial ? "workshop_partial" : "workshop_pause",
      title: isPartial ? "Produção parcial" : "Pausa na produção",
      body: `${labelFromWorkshop} — ${pieceLabel}: ${m}`,
      batchId,
    });
  } else if (action === "set_delivery") {
    if (!deliveryDate) {
      throw new HttpsError("invalid-argument", "Informe a data de entrega.");
    }
    const dt = new Date(deliveryDate);
    if (Number.isNaN(dt.getTime())) {
      throw new HttpsError("invalid-argument", "Data inválida.");
    }
    const ts = admin.firestore.Timestamp.fromDate(dt);
    await batchRef.update({
      deliveryDate: ts,
      updatedAt: FieldValue.serverTimestamp(),
    });
  } else {
    throw new HttpsError("invalid-argument", "Ação desconhecida.");
  }

  const after = (await batchRef.get()).data() || d;
  await updateWorkshopDocStatusForBatch({ ...d, ...after, id: batchId });
  return { ok: true };
});

/** Dono: gera token e notifica a oficina que há um check-list a aprovar. */
exports.prepareReceiveForWorkshopApproval = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Faça login para continuar.");
  }
  const { receiveId } = request.data || {};
  if (!receiveId || typeof receiveId !== "string") {
    throw new HttpsError("invalid-argument", "Recebimento inválido.");
  }
  const uid = request.auth.uid;
  const rRef = db.collection("receivePieces").doc(receiveId);
  const rSnap = await rRef.get();
  if (!rSnap.exists) {
    throw new HttpsError("not-found", "Recebimento não encontrado.");
  }
  const r = rSnap.data();
  if (r.userId !== uid) {
    throw new HttpsError("permission-denied", "Acesso negado.");
  }
  const bRef = db.collection("batches").doc(r.batchId);
  const bSnap = await bRef.get();
  if (!bSnap.exists) {
    throw new HttpsError("failed-precondition", "Lote não encontrado.");
  }
  const b = bSnap.data();
  const wUser = b.linkedWorkshopUserId;
  if (!wUser) {
    throw new HttpsError("failed-precondition", "Lote sem oficina vinculada a uma conta do app.");
  }
  const token = genToken();
  await rRef.update({
    checkoutToken: token,
    linkedWorkshopUserIdForCheckout: wUser,
    workshopApprovalStatus: "pending",
    updatedAt: FieldValue.serverTimestamp(),
  });
  const ownerName = (await db.collection("users").doc(uid).get()).data()?.name || "Dono";
  await createInAppNotification({
    userId: wUser,
    fromUserId: uid,
    type: "receive_checkout",
    title: "Aprovar valor do recebimento",
    body: `${ownerName} enviou o check-list de "${r.batchName || "lote"}" para você validar o valor.`,
    receiveId,
    batchId: r.batchId,
  });
  return { ok: true, token };
});

exports.getReceiveCheckoutPreview = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Faça login para continuar.");
  }
  const { receiveId, token } = request.data || {};
  if (!receiveId || !token || typeof receiveId !== "string" || typeof token !== "string") {
    throw new HttpsError("invalid-argument", "Dados inválidos.");
  }
  const uid = request.auth.uid;
  const uSnap = await db.collection("users").doc(uid).get();
  if (uSnap.data()?.userType !== "workshop") {
    throw new HttpsError("failed-precondition", "Apenas oficina.");
  }
  const rRef = db.collection("receivePieces").doc(receiveId);
  const rSnap = await rRef.get();
  if (!rSnap.exists) {
    throw new HttpsError("not-found", "Não encontrado.");
  }
  const r = rSnap.data();
  if (r.checkoutToken !== token) {
    throw new HttpsError("permission-denied", "Link inválido.");
  }
  if (r.linkedWorkshopUserIdForCheckout && r.linkedWorkshopUserIdForCheckout !== uid) {
    throw new HttpsError("permission-denied", "Esta aprovação é para outra oficina.");
  }
  const bRef = db.collection("batches").doc(r.batchId);
  const bSnap = await bRef.get();
  if (!bSnap.exists) {
    throw new HttpsError("not-found", "Lote não encontrado.");
  }
  const b = bSnap.data();
  if (b.linkedWorkshopUserId !== uid) {
    throw new HttpsError("permission-denied", "Lote não vinculado a você.");
  }
  return {
    receiveId,
    batchName: r.batchName || b.name,
    piecesReceived: r.piecesReceived,
    defectivePieces: r.defectivePieces != null ? r.defectivePieces : 0,
    amountDue: r.amountDue != null ? r.amountDue : 0,
    quality: r.quality,
    observations: r.observations || "",
    workshopApprovalStatus: r.workshopApprovalStatus || "none",
    pricePerPiece: b.pricePerPiece != null ? b.pricePerPiece : null,
  };
});

exports.respondReceiveCheckout = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Faça login para continuar.");
  }
  const { receiveId, token, action } = request.data || {};
  if (!receiveId || !token || !action) {
    throw new HttpsError("invalid-argument", "Dados inválidos.");
  }
  if (action !== "approve" && action !== "reject") {
    throw new HttpsError("invalid-argument", "Ação inválida.");
  }
  const uid = request.auth.uid;
  if ((await db.collection("users").doc(uid).get()).data()?.userType !== "workshop") {
    throw new HttpsError("failed-precondition", "Apenas oficina.");
  }
  const rRef = db.collection("receivePieces").doc(receiveId);
  const rSnap = await rRef.get();
  if (!rSnap.exists) {
    throw new HttpsError("not-found", "Não encontrado.");
  }
  const r = rSnap.data();
  if (r.checkoutToken !== token) {
    throw new HttpsError("permission-denied", "Link inválido.");
  }
  const bRef = db.collection("batches").doc(r.batchId);
  const bSnap = await bRef.get();
  if (!bSnap.exists) {
    throw new HttpsError("not-found", "Lote.");
  }
  if (bSnap.data().linkedWorkshopUserId !== uid) {
    throw new HttpsError("permission-denied", "Acesso negado.");
  }
  const next = action === "approve" ? "approved" : "rejected";
  await rRef.update({
    workshopApprovalStatus: next,
    updatedAt: FieldValue.serverTimestamp(),
  });
  const ownerId = r.userId;
  await createInAppNotification({
    userId: ownerId,
    fromUserId: uid,
    type: "receive_checkout",
    title: action === "approve" ? "Aprovação: recebimento" : "Recusa: recebimento",
    body:
      action === "approve"
        ? `A oficina aprovou o check-list e o valor de "${r.batchName || "lote"}".`
        : `A oficina recusou o check-list de "${r.batchName || "lote"}". Revise e envie de novo, se for o caso.`,
    receiveId,
    batchId: r.batchId,
  });
  return { ok: true, status: next };
});

/**
 * Diagnóstico: confirma que as secrets Mercado Pago estão vinculadas e legíveis no runtime.
 * Não devolve o access token nem o client secret. Só contas autenticadas.
 */
exports.verifyMercadopagoSecrets = onCall(
  {
    secrets: [mpAccessToken, mpClientSecret],
    cors: true,
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Faça login para verificar.");
    }
    const t = (mpAccessToken.value() || "").trim();
    const s = (mpClientSecret.value() || "").trim();
    if (!t || !s) {
      logger.warn("[verifyMercadopagoSecrets] variáveis vazias (emulador: functions/.env?)");
      return { ok: false, configured: false };
    }
    return { ok: true, configured: true };
  }
);
