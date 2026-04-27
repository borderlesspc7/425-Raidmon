import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@costura_conectada:pendingOwnerPayment";

export type PendingOwnerPayment = { paymentId: string; token: string };

export async function storePendingOwnerPayment(
  data: PendingOwnerPayment,
): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(data));
}

export async function readPendingOwnerPayment(): Promise<PendingOwnerPayment | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingOwnerPayment;
    if (!parsed?.paymentId || !parsed?.token) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearPendingOwnerPayment(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
