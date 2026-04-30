const { applyPaymentWebhookToFirestore } = require("./paymentWebhook.logic");
const { applySubscriptionWebhookToFirestore } = require("./subscriptionWebhook.logic");

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

/**
 * Switch por tipo de evento Asaas; extensível para novos casos.
 *
 * @param {string|null} eventType
 * @param {Record<string, unknown>} body
 * @param {{ db: import("firebase-admin/firestore").Firestore; FieldValue: typeof import("firebase-admin/firestore").FieldValue; admin: import("firebase-admin").default; overdueDaysThreshold?: number }} ctx
 */
async function dispatchAsaasEvent(eventType, body, ctx) {
  const { db, FieldValue, admin, overdueDaysThreshold = 3 } = ctx;

  switch (eventType) {
    case "PAYMENT_CONFIRMED":
    case "PAYMENT_RECEIVED":
      await applyPaymentWebhookToFirestore(db, FieldValue, admin, body);
      return applySubscriptionWebhookToFirestore({
        eventType,
        body,
        db,
        FieldValue,
        overdueDaysThreshold,
      });

    case "PAYMENT_FAILED":
    case "PAYMENT_REFUNDED":
    case "PAYMENT_DELETED":
      return applyPaymentWebhookToFirestore(db, FieldValue, admin, body);

    case "PAYMENT_OVERDUE":
      await applyPaymentWebhookToFirestore(db, FieldValue, admin, body);
      return applySubscriptionWebhookToFirestore({
        eventType,
        body,
        db,
        FieldValue,
        overdueDaysThreshold,
      });

    case "SUBSCRIPTION_UPDATED":
    case "SUBSCRIPTION_DELETED":
      return applySubscriptionWebhookToFirestore({
        eventType,
        body,
        db,
        FieldValue,
        overdueDaysThreshold,
      });

    default:
      if (body.payment?.id || body.subscription?.id) {
        await applyPaymentWebhookToFirestore(db, FieldValue, admin, body);
        await applySubscriptionWebhookToFirestore({
          eventType,
          body,
          db,
          FieldValue,
          overdueDaysThreshold,
        });
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
};
