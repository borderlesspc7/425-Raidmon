import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@costura_conectada:pendingReceiveCheckout";

export type PendingReceiveCheckout = { receiveId: string; token: string };

export async function storePendingReceiveCheckout(
  data: PendingReceiveCheckout,
): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(data));
}

export async function readPendingReceiveCheckout(): Promise<PendingReceiveCheckout | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingReceiveCheckout;
    if (!parsed?.receiveId || !parsed?.token) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearPendingReceiveCheckout(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
