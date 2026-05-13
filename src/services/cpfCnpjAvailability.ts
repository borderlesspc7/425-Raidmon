import { httpsCallable } from "firebase/functions";
import { functions } from "../lib/firebaseconfig";

const checkCpfCnpjAvailable = httpsCallable(functions, "checkCpfCnpjAvailable");

/**
 * Garante que não exista outro usuário com o mesmo CPF/CNPJ (via Cloud Function + Admin SDK).
 */
export async function assertCpfCnpjAvailableForRegistration(digits: string): Promise<void> {
  const d = String(digits || "").replace(/\D/g, "");
  if (d.length !== 11 && d.length !== 14) {
    return;
  }
  const res = await checkCpfCnpjAvailable({ cpfCnpj: d });
  const data = res.data as { available?: boolean };
  if (data?.available !== true) {
    throw new Error("Já existe uma conta cadastrada com este CPF/CNPJ");
  }
}
