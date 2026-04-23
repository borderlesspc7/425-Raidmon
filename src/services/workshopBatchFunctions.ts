import { httpsCallable } from "firebase/functions";
import { functions } from "../lib/firebaseconfig";

export type WorkshopBatchAction =
  | "ready_for_pickup"
  | "mark_partial"
  | "mark_pause"
  | "set_delivery";

export async function callWorkshopBatchAction(input: {
  batchId: string;
  action: WorkshopBatchAction;
  message?: string;
  partialPiecesDone?: number;
  /** ISO string */
  deliveryDate?: string;
}): Promise<{ ok: boolean }> {
  const fn = httpsCallable(functions, "workshopBatchAction");
  const res = await fn(input);
  return res.data as { ok: boolean };
}
