/**
 * Lógica do webhook Asaas: token, parsing e efeitos no Firestore.
 * Separado de index.js para facilitar testes e novos tipos de evento.
 */

/**
 * @param {import("express").Request} req
 * @returns {string|null}
 */
function extractWebhookToken(req) {
  const h =
    req.headers["asaas-access-token"] ||
    req.headers["Asaas-Access-Token"] ||
    req.headers["x-asaas-access-token"];
  if (typeof h === "string" && h.trim()) return h.trim();

  const q = req.query?.token;
  if (typeof q === "string" && q.trim()) return q.trim();

  const body = req.body;
  if (body && typeof body === "object") {
    const t = body.token ?? body.webhookToken ?? body.access_token;
    if (typeof t === "string" && t.trim()) return t.trim();
  }
  return null;
}

/**
 * @param {import("express").Request} req
 * @returns {Record<string, unknown>}
 */
function parseJsonBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  if (!body || typeof body !== "object") return {};
  return body;
}

/**
 * @param {string|null|undefined} expected from process.env / secret
 * @param {string|null} incoming from request
 */
function tokensMatch(expected, incoming) {
  if (!expected || typeof expected !== "string") return false;
  if (!incoming || typeof incoming !== "string") return false;
  return incoming === expected;
}

function roundMoneyWh(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}

function toJsDateWh(fireOrDate) {
  if (!fireOrDate) return null;
  if (typeof fireOrDate.toDate === "function") return fireOrDate.toDate();
  if (fireOrDate._seconds !== undefined) return new Date(fireOrDate._seconds * 1000);
  if (fireOrDate.seconds !== undefined) return new Date(fireOrDate.seconds * 1000);
  return new Date(fireOrDate);
}

function startOfLocalDayWh(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isActiveBatchDelayedWh(batch) {
  if (batch.status === "completed" || batch.status === "cancelled") return false;
  const dd = toJsDateWh(batch.deliveryDate);
  if (!dd) return false;
  return startOfLocalDayWh(dd).getTime() < startOfLocalDayWh(new Date()).getTime();
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {typeof import("firebase-admin/firestore").FieldValue} FieldValue
 * @param {string} batchId
 */
async function syncWorkshopDocStatusForBatchWh(db, FieldValue, batchId) {
  const bSnap = await db.collection("batches").doc(batchId).get();
  if (!bSnap.exists) return;
  const d = bSnap.data() || {};
  const workshopId = d.workshopId;
  const userId = d.userId;
  if (!workshopId || !userId) return;
  const wRef = db.collection("workshops").doc(workshopId);
  const wSnap = await wRef.get();
  if (!wSnap.exists || wSnap.data().userId !== userId) return;
  const flow = d.productionFlowStatus;
  let status = "yellow";
  if (flow === "ready_for_pickup") {
    status = "green";
  } else if (flow === "partial") {
    status = "orange";
  } else if (flow === "in_production" || flow === "paused") {
    status = "yellow";
  }
  if (isActiveBatchDelayedWh(d)) {
    status = "red";
  }
  await wRef.update({ status, updatedAt: FieldValue.serverTimestamp() });
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {typeof import("firebase-admin/firestore").FieldValue} FieldValue
 * @param {import("firebase-admin").default} admin
 * @param {Record<string, unknown>} body
 */
async function applyPaymentWebhookToFirestore(db, FieldValue, admin, body) {
  const event = typeof body.event === "string" ? body.event : null;
  const payment = body.payment && typeof body.payment === "object" ? body.payment : null;
  if (!payment?.id) {
    return { skipped: true, reason: "no_payment_id" };
  }

  const asaasId = payment.id;
  const externalRef =
    typeof payment.externalReference === "string" ? payment.externalReference : null;

  const payQuery = await db
    .collection("payments")
    .where("asaasPaymentId", "==", asaasId)
    .limit(1)
    .get();

  let payRef;
  if (!payQuery.empty) {
    payRef = payQuery.docs[0].ref;
  } else if (externalRef) {
    payRef = db.collection("payments").doc(externalRef);
    const exists = await payRef.get();
    if (!exists.exists) {
      return { skipped: true, reason: "payment_doc_not_found" };
    }
  } else {
    return { skipped: true, reason: "no_match" };
  }

  const statusReceived =
    event === "PAYMENT_RECEIVED" ||
    event === "PAYMENT_CONFIRMED" ||
    payment.status === "RECEIVED" ||
    payment.status === "CONFIRMED";

  const paid =
    statusReceived ||
    payment.confirmedDate ||
    (payment.paymentDate && payment.status === "RECEIVED");

  let paidDate = new Date();
  if (payment.confirmedDate) {
    paidDate = new Date(payment.confirmedDate);
  } else if (payment.paymentDate) {
    paidDate = new Date(payment.paymentDate);
  }

  const update = {
    asaasWebhookEvent: event || null,
    asaasPaymentStatus: payment.status || null,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (paid || statusReceived) {
    update.status = "paid";
    update.paidDate = admin.firestore.Timestamp.fromDate(paidDate);
  }

  if (event === "PAYMENT_OVERDUE" || payment.status === "OVERDUE") {
    update.status = "overdue";
  }

  const paySnapBefore = await payRef.get();
  const pdata = paySnapBefore.data() || {};

  const isOverdueEvt = event === "PAYMENT_OVERDUE" || payment.status === "OVERDUE";

  await payRef.update(update);

  const planToApply = pdata.subscriptionPlan;
  const shouldApplyPlan =
    !isOverdueEvt &&
    (paid || statusReceived) &&
    planToApply &&
    ["basic", "premium", "enterprise"].includes(planToApply) &&
    pdata.userId;

  if (shouldApplyPlan) {
    await db.collection("users").doc(pdata.userId).update({
      plan: planToApply,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  const paidOk = !isOverdueEvt && (paid || statusReceived);
  if (
    paidOk &&
    pdata.batchId &&
    typeof pdata.batchId === "string" &&
    pdata.ownerPaymentInviteKind === "owner_batch_checkout"
  ) {
    try {
      const bRef = db.collection("batches").doc(pdata.batchId);
      const bSnap = await bRef.get();
      if (bSnap.exists) {
        const b = bSnap.data() || {};
        const hasWave =
          typeof b.checkoutReferencePieces === "number" && b.checkoutReferencePieces > 0;
        if (hasWave && b.status === "in_progress") {
          const paidBase =
            pdata.ownerCheckoutBaseAmount != null
              ? Number(pdata.ownerCheckoutBaseAmount)
              : 0;
          const billable =
            pdata.batchBillablePieces != null ? Number(pdata.batchBillablePieces) : 0;
          const T =
            typeof b.totalPieces === "number" && Number.isFinite(b.totalPieces)
              ? b.totalPieces
              : 0;
          const prevCum =
            typeof b.piecesDeliveredCumulative === "number" &&
            Number.isFinite(b.piecesDeliveredCumulative)
              ? b.piecesDeliveredCumulative
              : 0;
          const safeBill = Number.isFinite(billable) ? billable : 0;
          const newCum = prevCum + safeBill;
          const prevGT =
            typeof b.guaranteedTotal === "number" && Number.isFinite(b.guaranteedTotal)
              ? b.guaranteedTotal
              : 0;
          const pp =
            typeof b.pricePerPiece === "number" && Number.isFinite(b.pricePerPiece)
              ? b.pricePerPiece
              : null;
          let newGT;
          if (pp != null && pp > 0 && T > 0) {
            newGT = roundMoneyWh(pp * Math.max(0, T - newCum));
          } else {
            newGT = roundMoneyWh(Math.max(0, prevGT - paidBase));
          }
          const allDone = T > 0 && newCum >= T;
          /** @type {Record<string, unknown>} */
          const batchUpdate = {
            piecesDeliveredCumulative: newCum,
            guaranteedTotal: newGT,
            ownerBatchCheckoutToken: FieldValue.delete(),
            checkoutReferencePieces: FieldValue.delete(),
            checkoutWaveGuaranteedBase: FieldValue.delete(),
            ownerWorkshopPayPaymentId: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
          };
          if (allDone) {
            batchUpdate.status = "completed";
            batchUpdate.productionFlowStatus = "ready_for_pickup";
            batchUpdate.completedAt = FieldValue.serverTimestamp();
          } else {
            batchUpdate.status = "in_progress";
            batchUpdate.productionFlowStatus = "in_production";
          }
          await bRef.update(batchUpdate);
          await syncWorkshopDocStatusForBatchWh(db, FieldValue, pdata.batchId);
        }
      }
    } catch (e) {
      console.error("[asaasWebhook] batch partial checkout resume failed", e);
    }
  }

  await db.collection("asaasWebhookEvents").add({
    receivedAt: FieldValue.serverTimestamp(),
    event: event || null,
    asaasPaymentId: asaasId,
    paymentId: payRef.id,
    rawStatus: payment.status || null,
  });

  return { skipped: false, paymentRefId: payRef.id };
}

/**
 * Switch por tipo de evento Asaas; extensível para novos casos.
 *
 * @param {string|null} eventType
 * @param {Record<string, unknown>} body
 * @param {{ db: import("firebase-admin/firestore").Firestore; FieldValue: typeof import("firebase-admin/firestore").FieldValue; admin: import("firebase-admin").default }} ctx
 */
async function dispatchAsaasEvent(eventType, body, ctx) {
  const { db, FieldValue, admin } = ctx;

  switch (eventType) {
    case "PAYMENT_CONFIRMED":
      console.log(
        "[asaasWebhook] Pagamento confirmado",
        JSON.stringify({
          event: eventType,
          paymentId: body.payment?.id,
          externalReference: body.payment?.externalReference,
          status: body.payment?.status,
        })
      );
      return applyPaymentWebhookToFirestore(db, FieldValue, admin, body);

    case "PAYMENT_RECEIVED":
      console.log(
        "[asaasWebhook] Pagamento recebido",
        JSON.stringify({
          event: eventType,
          paymentId: body.payment?.id,
          externalReference: body.payment?.externalReference,
          status: body.payment?.status,
        })
      );
      return applyPaymentWebhookToFirestore(db, FieldValue, admin, body);

    case "PAYMENT_OVERDUE":
      console.log(
        "[asaasWebhook] Pagamento em atraso",
        body.payment?.id || "(sem id)"
      );
      return applyPaymentWebhookToFirestore(db, FieldValue, admin, body);

    default:
      if (body.payment?.id) {
        await applyPaymentWebhookToFirestore(db, FieldValue, admin, body);
      } else {
        console.log(
          "[asaasWebhook] Evento sem handler dedicado:",
          eventType || "(sem tipo)",
          Object.keys(body)
        );
      }
      return { skipped: false };
  }
}

module.exports = {
  extractWebhookToken,
  parseJsonBody,
  tokensMatch,
  dispatchAsaasEvent,
  applyPaymentWebhookToFirestore,
};
