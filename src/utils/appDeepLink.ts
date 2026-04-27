import * as Linking from "expo-linking";
import type { ParsedURL } from "expo-linking";

/**
 * Origem HTTPS (Firebase Hosting) para App Links / links clicáveis.
 * Ex.: https://raidmon-1ddee.web.app — sem barra no final.
 * Paths: batch-offer, receive-checkout, owner-batch-checkout (dono), owner-workshop-pay (PIX direto).
 * Se vazio, compartilhamento usa só o scheme costuraconectada://.
 */
export function getInviteWebOrigin(): string | null {
  const raw = process.env.EXPO_PUBLIC_INVITE_WEB_ORIGIN?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

/**
 * Deep link nativo (scheme costuraconectada). Bom para uso interno; no WhatsApp costuma aparecer como texto puro.
 */
export function buildBatchOfferUrl(batchId: string, token: string): string {
  return Linking.createURL("batch-offer", {
    queryParams: { batchId, token },
  });
}

/**
 * URL para colar em WhatsApp: HTTPS clicável → página que abre o app.
 */
export function buildBatchOfferShareUrl(batchId: string, token: string): string {
  const origin = getInviteWebOrigin();
  if (origin) {
    const q = new URLSearchParams({ batchId, token });
    return `${origin}/batch-offer.html?${q.toString()}`;
  }
  return buildBatchOfferUrl(batchId, token);
}

export function buildReceiveCheckoutUrl(
  receiveId: string,
  token: string,
): string {
  return Linking.createURL("receiveCheckout", {
    queryParams: { receiveId, token },
  });
}

export function buildReceiveCheckoutShareUrl(
  receiveId: string,
  token: string,
): string {
  const origin = getInviteWebOrigin();
  if (origin) {
    const q = new URLSearchParams({ receiveId, token });
    return `${origin}/receive-checkout?${q.toString()}`;
  }
  return buildReceiveCheckoutUrl(receiveId, token);
}

/** Dono: conferência de peças antes do PIX (batchId + token da oficina). */
export function buildOwnerBatchCheckoutUrl(batchId: string, token: string): string {
  return Linking.createURL("owner-batch-checkout", {
    queryParams: { batchId, token, ownerCheckout: "1" },
  });
}

export function buildOwnerBatchCheckoutShareUrl(batchId: string, token: string): string {
  const origin = getInviteWebOrigin();
  if (origin) {
    const q = new URLSearchParams({
      batchId,
      token,
      ownerCheckout: "1",
    });
    return `${origin}/owner-batch-checkout.html?${q.toString()}`;
  }
  return buildOwnerBatchCheckoutUrl(batchId, token);
}

export function buildOwnerWorkshopPayUrl(paymentId: string, token: string): string {
  return Linking.createURL("owner-workshop-pay", {
    queryParams: { paymentId, token },
  });
}

/** Link HTTPS (WhatsApp) → página que abre o app na tela de PIX do dono. */
export function buildOwnerWorkshopPayShareUrl(
  paymentId: string,
  token: string,
): string {
  const origin = getInviteWebOrigin();
  if (origin) {
    const q = new URLSearchParams({ paymentId, token });
    return `${origin}/owner-workshop-pay.html?${q.toString()}`;
  }
  return buildOwnerWorkshopPayUrl(paymentId, token);
}

/**
 * Fallback no arranque (Android às vezes devolve `getInitialURL()` vazio mas
 * `parseInitialURLAsync()` traz os query params).
 */
export function appUrlFromParsedOrNull(parsed: ParsedURL): string | null {
  const qp = parsed.queryParams;
  if (!qp) return null;
  const token = qp.token;
  if (typeof token !== "string") return null;
  if (typeof qp.batchId === "string") {
    const oc = qp.ownerCheckout;
    if (oc === "1" || (Array.isArray(oc) && oc[0] === "1")) {
      return buildOwnerBatchCheckoutUrl(qp.batchId, token);
    }
    return buildBatchOfferUrl(qp.batchId, token);
  }
  if (typeof qp.receiveId === "string") {
    return buildReceiveCheckoutUrl(qp.receiveId, token);
  }
  if (typeof qp.paymentId === "string") {
    return buildOwnerWorkshopPayUrl(qp.paymentId, token);
  }
  return null;
}
