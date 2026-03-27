export const paths = {
    languageSelection: "LanguageSelection",
    login: "Login",
    register: "Register",
    dashboard: "Dashboard",
    profile: "Profile",
    workshops: "Workshops",
    cuts: "Cuts",
    batches: "Batches",
    workshopStatus: "WorkshopStatus",
    finishedProduction: "FinishedProduction",
    receivePieces: "ReceivePieces",
    payments: "Payments",
    financialHistory: "FinancialHistory",
    generalHistory: "GeneralHistory",
    metrics: "Metrics",
    plans: "Plans",
    basicPlan: "BasicPlan",
    premiumPlan: "PremiumPlan",
    enterprisePlan: "EnterprisePlan",
} as const;

export type ScreenName = (typeof paths)[keyof typeof paths];

export const publicRoutes: ScreenName[] = [
    paths.languageSelection,
    paths.login,
    paths.register,
];

export const protectedRoutes: ScreenName[] = [
    paths.dashboard,
    paths.profile,
    paths.workshops,
    paths.cuts,
    paths.batches,
    paths.workshopStatus,
    paths.finishedProduction,
    paths.receivePieces,
    paths.payments,
    paths.financialHistory,
    paths.generalHistory,
    paths.metrics,
    paths.plans,
    paths.basicPlan,
    paths.premiumPlan,
    paths.enterprisePlan,
];