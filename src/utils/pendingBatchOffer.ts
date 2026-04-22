import AsyncStorage from "@react-native-async-storage/async-storage";

const PENDING_BATCH_OFFER_KEY = "@costura_conectada:pendingBatchOffer";

export type PendingBatchOffer = { batchId: string; token: string };

export async function storePendingBatchOffer(data: PendingBatchOffer): Promise<void> {
  await AsyncStorage.setItem(PENDING_BATCH_OFFER_KEY, JSON.stringify(data));
}

export async function readPendingBatchOffer(): Promise<PendingBatchOffer | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_BATCH_OFFER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingBatchOffer;
    if (!parsed?.batchId || !parsed?.token) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearPendingBatchOffer(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_BATCH_OFFER_KEY);
}
