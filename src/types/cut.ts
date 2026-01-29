export interface Cut {
  id: string;
  type: string; // Tipo/modelo da peça (ex: "Calça Jeans", "Camisa Social")
  totalPieces: number; // Quantidade total de peças no corte
  observations?: string; // Observações adicionais
  userId: string; // ID do dono da confecção
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCutData {
  type: string;
  totalPieces: number;
  observations?: string;
}

export interface UpdateCutData extends Partial<CreateCutData> {}
