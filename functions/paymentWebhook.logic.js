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
  if (flow === "ready_for_pickup") status = "green";
  else if (flow === "partial") status = "orange";
  else if (flow === "in_production" || flow === "paused") status = "yellow";
  if (isActiveBatchDelayedWh(d)) status = "red";
  await wRef.update({ status, updatedAt: FieldValue.serverTimestamp() });
}

function statusFromAsaasEvent(event, paymentStatus) {
  if (event === "PAYMENT_REFUNDED") return "refunded";
  if (event === "PAYMENT_FAILED") return "failed";
  if (event === "PAYMENT_DELETED") return "cancelled";
  if (event === "PAYMENT_OVERDUE" || paymentStatus === "OVERDUE") return "overdue";
  if (
    event === "PAYMENT_RECEIVED" ||
    event === "PAYMENT_CONFIRMED" ||
    paymentStatus === "RECEIVED" ||
    paymentStatus === "CONFIRMED"
  ) {
    return "paid";
  }
  return null;
}

async function ensureRecurringPaymentDoc({
  db,
  FieldValue,
  admin,
  payment,
  asaasSubscriptionId,
  subscriptionUserDoc,
  externalRef,
}) {
  const asaasId = payment.id;
  const byAsaas = await db
    .collection("payments")
    .where("asaasPaymentId", "==", asaasId)
    .limit(1)
    .get();
  if (!byAsaas.empty) return byAsaas.docs[0].ref;

  if (externalRef) {
    const extRef = db.collection("payments").doc(externalRef);
    const extSnap = await extRef.get();
    if (extSnap.exists) return extRef;
  }

  if (!subscriptionUserDoc) {
    return null;
  }

  const userData = subscriptionUserDoc.data() || {};
  const planId = userData.subscriptionPlan || userData.plan || "basic";
  const dueDateRaw =
    typeof payment.dueDate === "string" && payment.dueDate
      ? admin.firestore.Timestamp.fromDate(new Date(`${payment.dueDate}T00:00:00`))
      : FieldValue.serverTimestamp();

  const payload = {
    userId: subscriptionUserDoc.id,
    amount: Number(payment.value) || 0,
    dueDate: dueDateRaw,
    description:
      (typeof payment.description === "string" && payment.description) ||
      `Recorrência assinatura ${planId}`,
    status: "pending",
    provider: "asaas",
    subscriptionPlan: planId,
    asaasSubscriptionId: asaasSubscriptionId || null,
    asaasPaymentId: payment.id || null,
    asaasInvoiceUrl: payment.invoiceUrl || null,
    asaasBillingType: payment.billingType || null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  const docRef = externalRef
    ? db.collection("payments").doc(externalRef)
    : db.collection("payments").doc();
  const existing = await docRef.get();
  if (existing.exists) return docRef;
  await docRef.set(payload, { merge: true });
  return docRef;
}

async function applyPaymentWebhookToFirestore(db, FieldValue, admin, body) {
  const event = typeof body.event === "string" ? body.event : null;
  const payment = body.payment && typeof body.payment === "object" ? body.payment : null;
  if (!payment?.id) {
    return { skipped: true, reason: "no_payment_id" };
  }

  const asaasId = payment.id;
  const asaasSubscriptionId =
    typeof payment.subscription === "string"
      ? payment.subscription
      : body.subscription && typeof body.subscription === "object" && typeof body.subscription.id === "string"
        ? body.subscription.id
        : null;
  const externalRef =
    typeof payment.externalReference === "string" ? payment.externalReference : null;

  const userBySubscription =
    asaasSubscriptionId && typeof asaasSubscriptionId === "string"
      ? await db
          .collection("users")
          .where("asaasSubscriptionId", "==", asaasSubscriptionId)
          .limit(1)
          .get()
      : null;
  const subscriptionUserDoc =
    userBySubscription && !userBySubscription.empty ? userBySubscription.docs[0] : null;

  const payRef = await ensureRecurringPaymentDoc({
    db,
    FieldValue,
    admin,
    payment,
    asaasSubscriptionId,
    subscriptionUserDoc,
    externalRef,
  });

  if (!payRef && !subscriptionUserDoc) {
    return { skipped: true, reason: "no_match" };
  }

  const paymentStatus = typeof payment.status === "string" ? payment.status : null;
  const mappedStatus = statusFromAsaasEvent(event, paymentStatus);
  const paid =
    mappedStatus === "paid" ||
    payment.confirmedDate ||
    (payment.paymentDate && paymentStatus === "RECEIVED");

  let paidDate = new Date();
  if (payment.confirmedDate) {
    paidDate = new Date(payment.confirmedDate);
  } else if (payment.paymentDate) {
    paidDate = new Date(payment.paymentDate);
  }

  const update = {
    asaasWebhookEvent: event || null,
    asaasPaymentStatus: paymentStatus || null,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (mappedStatus) {
    update.status = mappedStatus;
  }
  if (paid) {
    update.paidDate = admin.firestore.Timestamp.fromDate(paidDate);
  }

  let pdata = {};
  if (payRef) {
    const paySnapBefore = await payRef.get();
    pdata = paySnapBefore.data() || {};
    await payRef.update(update);
  }

  const isOverdueEvt = mappedStatus === "overdue";
  const planToApply = pdata.subscriptionPlan || subscriptionUserDoc?.data()?.subscriptionPlan;
  const shouldApplyPlan =
    !isOverdueEvt &&
    mappedStatus === "paid" &&
    planToApply &&
    ["basic", "premium", "enterprise"].includes(planToApply) &&
    (pdata.userId || subscriptionUserDoc?.id);

  if (shouldApplyPlan) {
    await db.collection("users").doc(pdata.userId || subscriptionUserDoc.id).update({
      plan: planToApply,
      subscriptionStatus: "ACTIVE",
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  const paidOk = !isOverdueEvt && mappedStatus === "paid";
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
    paymentId: payRef ? payRef.id : null,
    asaasSubscriptionId: asaasSubscriptionId || null,
    subscriptionUserId: subscriptionUserDoc ? subscriptionUserDoc.id : null,
    rawStatus: paymentStatus || null,
  });

  return { skipped: false, paymentRefId: payRef ? payRef.id : null };
}

module.exports = {
  applyPaymentWebhookToFirestore,
};
