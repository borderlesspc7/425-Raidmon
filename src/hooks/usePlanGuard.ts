import { useAuth } from "./useAuth";
import { useNavigation } from "../routes/NavigationContext";

export type PlanLimits = {
  maxWorkshops: number;
  maxBatchesPerMonth: number;
};

type PlanKey = "basic" | "premium" | "enterprise";

const PLAN_LIMITS: Record<PlanKey, PlanLimits> = {
  basic: {
    maxWorkshops: 3,
    maxBatchesPerMonth: 10,
  },
  premium: {
    maxWorkshops: Infinity,
    maxBatchesPerMonth: Infinity,
  },
  enterprise: {
    maxWorkshops: Infinity,
    maxBatchesPerMonth: Infinity,
  },
};

export function usePlanGuard() {
  const { user } = useAuth();
  const { navigate } = useNavigation();

  const getUserLimits = (): PlanLimits => {
    const rawPlan = user?.plan;

    if (rawPlan === "premium") return PLAN_LIMITS.premium;
    if (rawPlan === "enterprise") return PLAN_LIMITS.enterprise;

    return PLAN_LIMITS.basic;
  };

  const canAddWorkshop = (currentCount: number): boolean => {
    const { maxWorkshops } = getUserLimits();
    const safeCount = Math.max(0, currentCount || 0);

    return safeCount < maxWorkshops;
  };

  const canAddBatch = (currentMonthCount: number): boolean => {
    const { maxBatchesPerMonth } = getUserLimits();
    const safeCount = Math.max(0, currentMonthCount || 0);

    return safeCount < maxBatchesPerMonth;
  };

  const getRemainingWorkshops = (currentCount: number): number => {
    const { maxWorkshops } = getUserLimits();
    if (maxWorkshops === Infinity) return Infinity;

    const safeCount = Math.max(0, currentCount || 0);
    return Math.max(0, maxWorkshops - safeCount);
  };

  const getRemainingBatches = (currentMonthCount: number): number => {
    const { maxBatchesPerMonth } = getUserLimits();
    if (maxBatchesPerMonth === Infinity) return Infinity;

    const safeCount = Math.max(0, currentMonthCount || 0);
    return Math.max(0, maxBatchesPerMonth - safeCount);
  };

  const navigateToPlans = () => {
    navigate("Plans");
  };

  return {
    PLAN_LIMITS,
    getUserLimits,
    canAddWorkshop,
    canAddBatch,
    getRemainingWorkshops,
    getRemainingBatches,
    navigateToPlans,
  };
}
