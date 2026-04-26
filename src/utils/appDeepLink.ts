import * as Linking from "expo-linking";
import type { ParsedURL } from "expo-linking";

/**
 * Origem HTTPS onde o Firebase Hosting serve invite-web/ (batch-offer.html, receive-checkout.html).
 * Ex.: https://SEU-PROJETO.web.app — sem barra no final.
 * Se vazio, compartilhamento usa só o deep link nativo (não vira link no WhatsApp).
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
    return `${origin}/receive-checkout.html?${q.toString()}`;
  }
  return buildReceiveCheckoutUrl(receiveId, token);
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
    return buildBatchOfferUrl(qp.batchId, token);
  }
  if (typeof qp.receiveId === "string") {
    return buildReceiveCheckoutUrl(qp.receiveId, token);
  }
  return null;
}
