export type BatchStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface Batch {
  id: string;
  name: string; // Nome/identificação do lote
  totalPieces: number; // Quantidade total de peças no lote
  status: BatchStatus; // Status do lote
  workshopId?: string; // ID da oficina associada (opcional)
  workshopName?: string; // Nome da oficina (para exibição)
  deliveryDate?: Date; // Data de entrega prevista (opcional)
  observations?: string; // Observações adicionais
  userId: string; // ID do dono da confecção
  /** Corte de origem (dropdown Cortes), opcional */
  cutId?: string;
  /** Oferta por peça (BRL), quando vindo do fluxo de corte/convite */
  pricePerPiece?: number;
  /** totalPieces * pricePerPiece */
  guaranteedTotal?: number;
  /** Segredo para link WhatsApp / convite */
  inviteToken?: string;
  /** Mesmo índice exibido em Cortes (#1, #2…) para o corte escolhido */
  cutListNumber?: number;
  /** User ID da oficina que aceitou o convite */
  linkedWorkshopUserId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBatchData {
  name: string;
  totalPieces: number;
  status?: BatchStatus;
  workshopId?: string;
  workshopName?: string;
  deliveryDate?: Date;
  observations?: string;
  cutId?: string;
  pricePerPiece?: number;
  guaranteedTotal?: number;
  inviteToken?: string;
  cutListNumber?: number;
}

export interface UpdateBatchData extends Partial<CreateBatchData> {
  linkedWorkshopUserId?: string | null;
}
