/**
 * Integração Asaas: cliente + cobrança PIX + webhook.
 * App (Expo): httpsCallable `createAsaasCharge` + região EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION.
 * Secrets (Firebase): ASAAS_API_KEY, ASAAS_WEBHOOK_TOKEN
 * Opcional: ASAAS_ADMIN_WALLET_ID (split 5% plataforma), ASAAS_API_URL
 */
const admin = require("firebase-admin");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret, defineString } = require("firebase-functions/params");
const { setGlobalOptions } = require("firebase-functions/v2");
const {
  extractWebhookToken,
  parseJsonBody,
  tokensMatch,
  dispatchAsaasEvent,
} = require("./asaasWebhook.logic");

admin.initializeApp();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const asaasApiKey = defineSecret("ASAAS_API_KEY");
const webhookToken = defineSecret("ASAAS_WEBHOOK_TOKEN");

const asaasApiUrl = defineString("ASAAS_API_URL", {
  default: "https://api.asaas.com/v3",
});
const platformFeePercent = defineString("PLATFORM_FEE_PERCENT", {
  default: "5",
});
/** UUID da carteira Asaas que recebe a taxa da plataforma (opcional) */
const adminWalletId = defineString("ASAAS_ADMIN_WALLET_ID", { default: "" });

setGlobalOptions({
  region: "southamerica-east1",
  maxInstances: 10,
});

function roundMoney(n) {
  return Math.round(n * 100) / 100;
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

    const pct = Math.min(
      100,
      Math.max(0, parseFloat(platformFeePercent.value()) || 5)
    );
    const fee = roundMoney((gross * pct) / 100);
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

    const splitWallet = adminWalletId.value()?.trim();
    const payload = {
      customer: customerId,
      billingType: "PIX",
      value: gross,
      dueDate: dueStr,
      description: (p.description || "Pagamento Raidmon").slice(0, 200),
      externalReference: paymentId,
    };

    if (splitWallet && fee > 0) {
      payload.split = [{ walletId: splitWallet, percentualValue: pct }];
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

    await payRef.update({
      provider: "asaas",
      asaasPaymentId,
      platformFeePercent: pct,
      platformFeeAmount: fee,
      netAmountAfterFee: net,
      asaasInvoiceUrl: charge.invoiceUrl || null,
      asaasBillingType: "PIX",
      pixCopyPaste: pixData?.payload || null,
      pixEncodedImage: pixData?.encodedImage || null,
      pixExpiration: pixData?.expirationDate || null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      asaasPaymentId,
      invoiceUrl: charge.invoiceUrl || null,
      pixCopyPaste: pixData?.payload || null,
      pixEncodedImage: pixData?.encodedImage || null,
      pixExpirationDate: pixData?.expirationDate || null,
      platformFeePercent: pct,
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
  };
});

exports.respondBatchInvite = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Faça login para continuar.");
  }
  const { batchId, token, action } = request.data || {};
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

  await batchRef.update({
    status: "in_progress",
    linkedWorkshopUserId: uid,
    ...(workshopLabel ? { workshopName: workshopLabel } : {}),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { ok: true };
});
