import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@costura_conectada:pendingOwnerBatchCheckout";

export type PendingOwnerBatchCheckout = { batchId: string; token: string };

export async function storePendingOwnerBatchCheckout(
  data: PendingOwnerBatchCheckout,
): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(data));
}

export async function readPendingOwnerBatchCheckout(): Promise<PendingOwnerBatchCheckout | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingOwnerBatchCheckout;
    if (!parsed?.batchId || !parsed?.token) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearPendingOwnerBatchCheckout(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
