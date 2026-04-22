import type { SubscriptionPlanId } from "../constants/planPricing";

export type UserPlan = SubscriptionPlanId;

/** Plano padrão quando ainda não há assinatura paga. */
export function getEffectiveUserPlan(
  plan: string | undefined
): UserPlan {
  if (plan === "premium" || plan === "enterprise" || plan === "basic") {
    return plan;
  }
  return "basic";
}

export const BASIC_MAX_PIECES_PER_MONTH = 1500;
export const BASIC_PAYMENT_HISTORY_DAYS = 30;

export function isPaymentHistoryWindowLimited(plan: UserPlan): boolean {
  return plan === "basic";
}

/** Data inicial (início do dia) para o recorte de histórico de pagamentos no plano grátuito. */
export function getBasicPaymentHistoryCutoff(): Date {
  const d = new Date();
  d.setDate(d.getDate() - BASIC_PAYMENT_HISTORY_DAYS);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isPaymentInPlanHistoryWindow(
  plan: UserPlan,
  refDate: Date
): boolean {
  if (!isPaymentHistoryWindowLimited(plan)) return true;
  return refDate >= getBasicPaymentHistoryCutoff();
}

export function getMaxWorkshopsForPlan(plan: UserPlan): number | null {
  if (plan === "basic") return 1;
  if (plan === "premium") return 3;
  return null;
}

export function canCreateAnotherWorkshop(
  plan: UserPlan,
  currentCount: number
): boolean {
  const max = getMaxWorkshopsForPlan(plan);
  if (max === null) return true;
  return currentCount < max;
}

export function canExportRomaneioPdf(plan: UserPlan): boolean {
  return plan === "premium" || plan === "enterprise";
}

export function getMonthlyPiecesLimit(plan: UserPlan): number | null {
  if (plan === "basic") return BASIC_MAX_PIECES_PER_MONTH;
  return null;
}

export function canViewEfficiencyRanking(plan: UserPlan): boolean {
  return plan === "enterprise";
}

export function canExportOwnerDataSheet(plan: UserPlan): boolean {
  return plan === "enterprise";
}
