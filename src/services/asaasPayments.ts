import { getFunctions, httpsCallable, type HttpsCallableResult } from "firebase/functions";
import { app } from "../lib/firebaseconfig";

const REGION =
  (typeof process !== "undefined" &&
    process.env?.EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION) ||
  "southamerica-east1";

export type CreateAsaasChargeResult = {
  asaasPaymentId: string;
  invoiceUrl: string | null;
  pixCopyPaste: string | null;
  pixEncodedImage: string | null;
  pixExpirationDate: string | null;
  platformFeePercent: number;
  platformFeeAmount: number;
  grossAmount: number;
};

export type SubscriptionCheckoutBillingType = "PIX" | "BOLETO";

export type CreateAsaasSubscriptionResult = {
  subscriptionId: string;
  planId: "premium" | "enterprise";
  subscriptionStatus: string;
  nextDueDate: string | null;
  billingType: SubscriptionCheckoutBillingType;
  invoiceUrl: string | null;
  pixCopyPaste: string | null;
  pixEncodedImage: string | null;
  bankSlipUrl: string | null;
  identificationField: string | null;
  alreadyExists?: boolean;
};

export type CancelAsaasSubscriptionResult = {
  success: boolean;
  subscriptionId: string;
  subscriptionStatus: "CANCELLED";
  plan: "basic";
};

/**
 * Chama a Cloud Function `createAsaasCharge` (mesma região que o deploy em `functions/`).
 * Após `firebase deploy --only functions` e secrets Asaas, o app já usa isso.
 */
export async function createAsaasChargeForPayment(
  paymentId: string,
  ownerPaymentInviteToken?: string | null,
): Promise<CreateAsaasChargeResult> {
  const functions = getFunctions(app, REGION);
  const callable = httpsCallable(functions, "createAsaasCharge");
  const payload: { paymentId: string; ownerPaymentInviteToken?: string } = { paymentId };
  if (ownerPaymentInviteToken && String(ownerPaymentInviteToken).trim()) {
    payload.ownerPaymentInviteToken = String(ownerPaymentInviteToken).trim();
  }
  const res: HttpsCallableResult = await callable(payload);
  return res.data as CreateAsaasChargeResult;
}

export async function createAsaasSubscriptionForPlan(input: {
  planId: "premium" | "enterprise";
  value: number;
  nextDueDate?: string;
  billingType?: SubscriptionCheckoutBillingType;
}): Promise<CreateAsaasSubscriptionResult> {
  const functions = getFunctions(app, REGION);
  const callable = httpsCallable(functions, "createAsaasSubscription");
  const res: HttpsCallableResult = await callable(input);
  return res.data as CreateAsaasSubscriptionResult;
}

export async function cancelAsaasSubscription(input: {
  subscriptionId?: string;
}): Promise<CancelAsaasSubscriptionResult> {
  const functions = getFunctions(app, REGION);
  const callable = httpsCallable(functions, "cancelAsaasSubscription");
  const res: HttpsCallableResult = await callable(input || {});
  return res.data as CancelAsaasSubscriptionResult;
}
