export interface ReceivePieces {
  id: string;
  batchId: string; // ID do lote
  batchName: string; // Nome do lote (para exibição)
  workshopId?: string; // ID da oficina
  workshopName?: string; // Nome da oficina (para exibição)
  piecesReceived: number; // Quantidade de peças recebidas
  receiveDate: Date; // Data do recebimento
  quality: 'excellent' | 'good' | 'regular' | 'poor'; // Qualidade das peças
  observations?: string; // Observações sobre o recebimento
  userId: string; // ID do dono da confecção
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReceivePiecesData {
  batchId: string;
  batchName: string;
  workshopId?: string;
  workshopName?: string;
  piecesReceived: number;
  receiveDate: Date;
  quality: 'excellent' | 'good' | 'regular' | 'poor';
  observations?: string;
}

export interface UpdateReceivePiecesData extends Partial<CreateReceivePiecesData> {}
