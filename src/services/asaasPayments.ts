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

/**
 * Chama a Cloud Function `createAsaasCharge` (mesma região que o deploy em `functions/`).
 * Após `firebase deploy --only functions` e secrets Asaas, o app já usa isso.
 */
export async function createAsaasChargeForPayment(
  paymentId: string
): Promise<CreateAsaasChargeResult> {
  const functions = getFunctions(app, REGION);
  const callable = httpsCallable(functions, "createAsaasCharge");
  const res: HttpsCallableResult = await callable({ paymentId });
  return res.data as CreateAsaasChargeResult;
}
