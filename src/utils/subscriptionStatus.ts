import type { User } from "../types/auth";
import type { SubscriptionPlanId } from "../constants/planPricing";

export type SubscriptionState =
  | "active"
  | "overdue"
  | "cancelled"
  | "expired"
  | "inactive";

/** Plano efetivo do usuário (default `basic`). */
export function getCurrentPlan(user: User | null | undefined): SubscriptionPlanId {
  const p = user?.plan;
  if (p === "premium" || p === "enterprise" || p === "basic") return p;
  return "basic";
}

/**
 * Estado normalizado da assinatura para uso na UI.
 * Considera tanto `subscriptionStatus` (vindo do webhook) quanto a presença
 * de `asaasSubscriptionId` + plano pago (`premium` / `enterprise`).
 */
export function getSubscriptionState(user: User | null | undefined): SubscriptionState {
  const status = String(user?.subscriptionStatus || "").toUpperCase();
  if (status === "ACTIVE") return "active";
  if (status === "OVERDUE") return "overdue";
  if (status === "CANCELLED") return "cancelled";
  if (status === "EXPIRED") return "expired";
  if (status === "INACTIVE") return "inactive";
  // Sem status reportado: se o usuário tem um plano pago e um id de assinatura,
  // tratamos como ativo (estado transitório logo após pagamento confirmado).
  const plan = getCurrentPlan(user);
  if (plan !== "basic" && user?.asaasSubscriptionId) return "active";
  return "inactive";
}

/**
 * O usuário considera que "tem" o plano X agora?
 * - basic: sempre verdadeiro quando user.plan é basic ou indefinido.
 * - premium/enterprise: verdadeiro quando user.plan === plan E o estado é
 *   `active` ou `overdue` (overdue ainda mantém acesso, só está em atraso).
 */
export function isUserOnPlan(
  user: User | null | undefined,
  planId: SubscriptionPlanId,
): boolean {
  const current = getCurrentPlan(user);
  if (current !== planId) return false;
  if (planId === "basic") return true;
  const state = getSubscriptionState(user);
  return state === "active" || state === "overdue";
}

/** Pode iniciar uma nova compra para o plano `planId`? */
export function canSubscribeTo(
  user: User | null | undefined,
  planId: SubscriptionPlanId,
): boolean {
  if (planId === "basic") {
    return getCurrentPlan(user) !== "basic";
  }
  return !isUserOnPlan(user, planId);
}

/** Formata YYYY-MM-DD em DD/MM/AAAA (pt-BR). Volta `null` se inválido. */
export function formatNextDueDate(value: string | undefined): string | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  return `${m[3]}/${m[2]}/${m[1]}`;
}
