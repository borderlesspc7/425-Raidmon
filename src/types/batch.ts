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
}

export interface UpdateBatchData extends Partial<CreateBatchData> {}
