/** Valores mensais (BRL) alinhados à listagem em `Plans.tsx`. */
export type SubscriptionPlanId = "basic" | "premium" | "enterprise";

export const PLAN_PRICES_BRL: Record<SubscriptionPlanId, number> = {
  basic: 0,
  premium: 59,
  enterprise: 149,
};

export function isSubscriptionPlanId(
  v: string | undefined
): v is SubscriptionPlanId {
  return v === "basic" || v === "premium" || v === "enterprise";
}
