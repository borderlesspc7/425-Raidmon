import { httpsCallable } from "firebase/functions";
import { functions } from "../lib/firebaseconfig";

export type BatchInvitePreview = {
  batchId: string;
  /** Mesmo # da lista Cortes */
  cutListNumber: number | null;
  name: string;
  totalPieces: number;
  pricePerPiece: number | null;
  guaranteedTotal: number | null;
  ownerName: string;
  status: string;
  linkedWorkshopUserId: string | null;
  canAccept: boolean;
  reason: string | null;
};

export async function getBatchInvitePreview(
  batchId: string,
  token: string,
): Promise<BatchInvitePreview> {
  const fn = httpsCallable(functions, "getBatchInvitePreview");
  const res = await fn({ batchId, token });
  return res.data as BatchInvitePreview;
}

export async function respondBatchInvite(
  batchId: string,
  token: string,
  action: "accept" | "request_adjust",
): Promise<{ ok: boolean; alreadyAccepted?: boolean; message?: string }> {
  const fn = httpsCallable(functions, "respondBatchInvite");
  const res = await fn({ batchId, token, action });
  return res.data as { ok: boolean; alreadyAccepted?: boolean; message?: string };
}
