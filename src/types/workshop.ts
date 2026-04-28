export type WorkshopStatus = 'free' | 'busy';

export interface AddressFields {
  cep?: string;
  street: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  uf?: string;
}

export interface Workshop {
  id: string;
  name: string;
  address: string;
  addressFields?: AddressFields;
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
  addressFields?: AddressFields;
  contact1: string;
  contact2?: string;
  status?: WorkshopStatus;
}

export interface UpdateWorkshopData extends Partial<CreateWorkshopData> {
  totalPieces?: number;
}
