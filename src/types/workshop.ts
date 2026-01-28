export type WorkshopStatus = 'green' | 'yellow' | 'orange' | 'red';

export interface Workshop {
  id: string;
  name: string;
  address: string;
  contact1: string; // WhatsApp principal
  contact2?: string; // Contato secundário
  status: WorkshopStatus;
  totalPieces: number;
  userId: string; // ID do dono da confecção
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWorkshopData {
  name: string;
  address: string;
  contact1: string;
  contact2?: string;
  status?: WorkshopStatus;
}

export interface UpdateWorkshopData extends Partial<CreateWorkshopData> {
  totalPieces?: number;
}
