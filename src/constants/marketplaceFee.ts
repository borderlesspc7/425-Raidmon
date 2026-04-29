/** Taxa de plataforma (%) — espelhado em `PLATFORM_FEE_PERCENT` nas Cloud Functions. */
export const MARKETPLACE_FEE_PERCENT = 1;

export function applyMarketplaceFeeToBase(base: number): number {
  if (!Number.isFinite(base) || base <= 0) return 0;
  return Math.round(base * (1 + MARKETPLACE_FEE_PERCENT / 100) * 100) / 100;
}
