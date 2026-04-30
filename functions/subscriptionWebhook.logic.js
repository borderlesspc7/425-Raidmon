function parseDateLike(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value._seconds !== undefined) return new Date(value._seconds * 1000);
  if (value.seconds !== undefined) return new Date(value.seconds * 1000);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function overdueDaysSince(dateLike, now = new Date()) {
  const since = parseDateLike(dateLike);
  if (!since) return 0;
  const diffMs = startOfDay(now).getTime() - startOfDay(since).getTime();
  return diffMs <= 0 ? 0 : Math.floor(diffMs / 86400000);
}

async function markSubscriptionOverdue({ userRef, userData, FieldValue }) {
  const update = {
    subscriptionStatus: "OVERDUE",
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (!userData.subscriptionOverdueSince) {
    update.subscriptionOverdueSince = FieldValue.serverTimestamp();
  }
  await userRef.update(update);
}

async function clearSubscriptionOverdue({ userRef, FieldValue }) {
  await userRef.update({
    subscriptionOverdueSince: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

async function maybeDowngradeOverduePlan({
  userRef,
  userData,
  overdueDaysThreshold,
  FieldValue,
}) {
  const overdueDays = overdueDaysSince(userData.subscriptionOverdueSince);
  if (overdueDays < overdueDaysThreshold) {
    return { downgraded: false, overdueDays };
  }
  if (userData.plan !== "basic") {
    await userRef.update({
      plan: "basic",
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { downgraded: true, overdueDays };
  }
  return { downgraded: false, overdueDays };
}

async function applySubscriptionWebhookToFirestore({
  eventType,
  body,
  db,
  FieldValue,
  overdueDaysThreshold,
}) {
  const subscription =
    body.subscription && typeof body.subscription === "object" ? body.subscription : null;
  const subscriptionId =
    (subscription && typeof subscription.id === "string" && subscription.id) ||
    (body.payment &&
    typeof body.payment === "object" &&
    typeof body.payment.subscription === "string"
      ? body.payment.subscription
      : null);
  if (!subscriptionId) {
    return { skipped: true, reason: "no_subscription_id" };
  }

  const userQuery = await db
    .collection("users")
    .where("asaasSubscriptionId", "==", subscriptionId)
    .limit(1)
    .get();
  if (userQuery.empty) {
    return { skipped: true, reason: "subscription_user_not_found" };
  }
  const userDoc = userQuery.docs[0];
  const userRef = userDoc.ref;
  const userData = userDoc.data() || {};

  const statusFromPayload =
    (subscription && typeof subscription.status === "string" && subscription.status) || null;

  const baseUpdate = {
    subscriptionLastWebhookEvent: eventType || null,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (statusFromPayload) {
    baseUpdate.subscriptionStatus = statusFromPayload;
  }
  if (
    subscription &&
    typeof subscription.nextDueDate === "string" &&
    subscription.nextDueDate
  ) {
    baseUpdate.subscriptionNextDueDate = subscription.nextDueDate;
  }
  if (eventType === "SUBSCRIPTION_DELETED") {
    baseUpdate.subscriptionStatus = "CANCELLED";
    baseUpdate.plan = "basic";
  }

  await userRef.update(baseUpdate);

  if (eventType === "PAYMENT_OVERDUE") {
    await markSubscriptionOverdue({ userRef, userData, FieldValue });
    const refreshed = (await userRef.get()).data() || {};
    const downgradeInfo = await maybeDowngradeOverduePlan({
      userRef,
      userData: refreshed,
      overdueDaysThreshold,
      FieldValue,
    });
    return { skipped: false, downgraded: downgradeInfo.downgraded };
  }

  if (eventType === "PAYMENT_RECEIVED" || eventType === "PAYMENT_CONFIRMED") {
    await clearSubscriptionOverdue({ userRef, FieldValue });
    return { skipped: false };
  }

  return { skipped: false };
}

module.exports = {
  parseDateLike,
  overdueDaysSince,
  applySubscriptionWebhookToFirestore,
};
