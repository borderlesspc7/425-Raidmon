export type WorkshopReceiveApprovalStatus =
  | 'none'
  | 'pending'
  | 'approved'
  | 'rejected';

export interface ReceivePieces {
  id: string;
  batchId: string; // ID do lote
  batchName: string; // Nome do lote (para exibição)
  workshopId?: string; // ID da oficina
  workshopName?: string; // Nome da oficina (para exibição)
  piecesReceived: number; // Quantidade de peças recebidas
  /** Peças com defeito (descontadas do valor a pagar, se preenchido) */
  defectivePieces?: number;
  receiveDate: Date; // Data do recebimento
  quality: 'excellent' | 'good' | 'regular' | 'poor'; // Qualidade das peças
  observations?: string; // Observações sobre o recebimento
  userId: string; // ID do dono da confecção
  /** Cópia do preço/peça do lote no momento do checklist */
  unitPriceAtReceive?: number;
  /** Valor a pagar à oficina (peças válidas × preço) */
  amountDue?: number;
  /** Conta oficina (Auth) para aprovar checkout via link */
  linkedWorkshopUserIdForCheckout?: string;
  /** Segredo p/ link WhatsApp + deep link da oficina */
  checkoutToken?: string;
  workshopApprovalStatus?: WorkshopReceiveApprovalStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReceivePiecesData {
  batchId: string;
  batchName: string;
  workshopId?: string;
  workshopName?: string;
  piecesReceived: number;
  defectivePieces?: number;
  receiveDate: Date;
  quality: 'excellent' | 'good' | 'regular' | 'poor';
  observations?: string;
  unitPriceAtReceive?: number;
  amountDue?: number;
  linkedWorkshopUserIdForCheckout?: string;
  checkoutToken?: string;
  workshopApprovalStatus?: WorkshopReceiveApprovalStatus;
}

export interface UpdateReceivePiecesData extends Partial<CreateReceivePiecesData> {}
