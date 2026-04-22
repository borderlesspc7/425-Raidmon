export interface Cut {
  id: string;
  /**
   * ID único global do corte (mesmo valor que `id` do documento Firestore).
   * Persistido para integrações e para não confundir com o # da lista (#1, #2…),
   * que é só ordem visual por usuário.
   */
  uniqueRef: string;
  type: string; // Tipo/modelo da peça (ex: "Calça Jeans", "Camisa Social")
  totalPieces: number; // Quantidade total de peças no corte
  /** Preço unitário por peça (BRL). Cortes antigos podem não ter o campo. */
  pricePerPiece?: number;
  observations?: string; // Observações adicionais
  userId: string; // ID do dono da confecção
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCutData {
  type: string;
  totalPieces: number;
  pricePerPiece: number;
  observations?: string;
}

export interface UpdateCutData extends Partial<CreateCutData> {}
