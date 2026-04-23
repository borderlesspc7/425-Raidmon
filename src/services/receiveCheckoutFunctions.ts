import { httpsCallable } from "firebase/functions";
import { functions } from "../lib/firebaseconfig";

export type ReceiveCheckoutPreview = {
  receiveId: string;
  batchName: string;
  piecesReceived: number;
  defectivePieces: number;
  amountDue: number;
  quality: string;
  observations: string;
  workshopApprovalStatus: string;
  pricePerPiece: number | null;
};

export async function prepareReceiveForWorkshopApproval(
  receiveId: string,
): Promise<{ ok: boolean; token?: string }> {
  const fn = httpsCallable(functions, "prepareReceiveForWorkshopApproval");
  const res = await fn({ receiveId });
  return res.data as { ok: boolean; token?: string };
}

export async function getReceiveCheckoutPreview(
  receiveId: string,
  token: string,
): Promise<ReceiveCheckoutPreview> {
  const fn = httpsCallable(functions, "getReceiveCheckoutPreview");
  const res = await fn({ receiveId, token });
  return res.data as ReceiveCheckoutPreview;
}

export async function respondReceiveCheckout(
  receiveId: string,
  token: string,
  action: "approve" | "reject",
): Promise<{ ok: boolean; status: string }> {
  const fn = httpsCallable(functions, "respondReceiveCheckout");
  const res = await fn({ receiveId, token, action });
  return res.data as { ok: boolean; status: string };
}
