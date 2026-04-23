import { httpsCallable, type HttpsCallableResult } from "firebase/functions";
import { app } from "../lib/firebaseconfig";
import { getFunctions } from "firebase/functions";
import type { WorkshopAsaasSubaccountInput } from "../types/auth";

const REGION =
  (typeof process !== "undefined" &&
    process.env?.EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION) ||
  "southamerica-east1";

export type CreateAsaasSubaccountResult = {
  success: boolean;
  alreadyExists?: boolean;
  asaasSubaccountId: string;
  walletId: string | null;
};

/**
 * Cria a subconta Asaas (Cloud Function `createAsaasSubaccount`).
 * Só após o login do usuário recém-criado.
 */
export async function createAsaasSubaccount(
  input: WorkshopAsaasSubaccountInput
): Promise<CreateAsaasSubaccountResult> {
  const functions = getFunctions(app, REGION);
  const callable = httpsCallable(functions, "createAsaasSubaccount");
  const res: HttpsCallableResult = await callable(input);
  return res.data as CreateAsaasSubaccountResult;
}
