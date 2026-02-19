export type PaymentStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

export interface Payment {
  id: string;
  workshopId?: string;
  workshopName?: string;
  batchId?: string;
  batchName?: string;
  amount: number; // valor em reais
  dueDate: Date; // data de vencimento
  paidDate?: Date; // data em que foi pago
  description: string; // descrição / motivo
  status: PaymentStatus;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePaymentData {
  workshopId?: string;
  workshopName?: string;
  batchId?: string;
  batchName?: string;
  amount: number;
  dueDate: Date;
  paidDate?: Date;
  description: string;
  status?: PaymentStatus;
}

export interface UpdatePaymentData extends Partial<CreatePaymentData> {}
