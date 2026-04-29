import { httpsCallable } from "firebase/functions";
import { functions } from "../lib/firebaseconfig";

export type CompleteBatchInviteCheckoutResult = {
  batchId: string;
  token: string;
  alreadyCompleted?: boolean;
};

export type OwnerBatchCheckoutPreview = {
  batchId: string;
  batchName: string | null;
  totalPieces: number;
  /** Máx. de peças desta conferência (entrega parcial = menor que totalPieces) */
  conferenceMaxPieces?: number;
  /** Base BRL desta leva (checkout parcial); quando ausente, usar price/guaranteedTotal do lote */
  checkoutWaveGuaranteedBase?: number | null;
  pricePerPiece: number | null;
  guaranteedTotal: number | null;
  workshopName: string | null;
  marketplaceWorkshopUserId: string | null;
  platformFeePercent: number;
  existingPayment: {
    paymentId: string;
    inviteToken: string | null;
    status: string;
    hasCharge: boolean;
    grossAmount: number;
    baseAmount: number | null;
    piecesReceived: number | null;
    defectivePieces: number | null;
  } | null;
};

export type SubmitOwnerBatchCheckoutResult = {
  paymentId: string;
  token: string;
  grossAmount: number;
  baseAmount: number;
  billablePieces: number;
  alreadyCreated?: boolean;
};

export type OwnerPaymentInvitePreview = {
  paymentId: string;
  batchName: string | null;
  totalPieces: number | null;
  amount: number;
  workshopName: string | null;
  description: string;
  status: string;
  platformFeePercent: number;
  hasCharge: boolean;
  pixCopyPaste: string | null;
  pixEncodedImage: string | null;
  asaasInvoiceUrl: string | null;
  pixExpiration: string | null;
};

export async function completeBatchAndInviteOwnerCheckout(
  batchId: string,
): Promise<CompleteBatchInviteCheckoutResult> {
  const fn = httpsCallable(functions, "completeBatchAndInviteOwnerCheckout");
  const res = await fn({ batchId });
  return res.data as CompleteBatchInviteCheckoutResult;
}

export async function getOwnerBatchCheckoutPreview(
  batchId: string,
  token: string,
): Promise<OwnerBatchCheckoutPreview> {
  const fn = httpsCallable(functions, "getOwnerBatchCheckoutPreview");
  const res = await fn({ batchId, token });
  return res.data as OwnerBatchCheckoutPreview;
}

export async function submitOwnerBatchCheckoutAndCreatePayment(
  batchId: string,
  token: string,
  piecesReceived: number,
  defectivePieces: number,
  defectPhotoUrls?: string[],
): Promise<SubmitOwnerBatchCheckoutResult> {
  const fn = httpsCallable(functions, "submitOwnerBatchCheckoutAndCreatePayment");
  const res = await fn({ batchId, token, piecesReceived, defectivePieces, defectPhotoUrls });
  return res.data as SubmitOwnerBatchCheckoutResult;
}

export async function getOwnerPaymentInvitePreview(
  paymentId: string,
  token: string,
): Promise<OwnerPaymentInvitePreview> {
  const fn = httpsCallable(functions, "getOwnerPaymentInvitePreview");
  const res = await fn({ paymentId, token });
  return res.data as OwnerPaymentInvitePreview;
}
