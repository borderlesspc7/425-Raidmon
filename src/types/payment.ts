export type PaymentStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

export type PaymentProvider = 'manual' | 'asaas';

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

  /** manual (padrão) ou Asaas */
  provider?: PaymentProvider;
  asaasPaymentId?: string;
  asaasBillingType?: string;
  asaasInvoiceUrl?: string;
  platformFeePercent?: number;
  platformFeeAmount?: number;
  netAmountAfterFee?: number;
  /** PIX copia e cola */
  pixCopyPaste?: string | null;
  /** QR em base64 (PNG) */
  pixEncodedImage?: string | null;
  pixExpiration?: string | null;

  /** Cobrança de assinatura: ao confirmar pagamento, o webhook aplica em `users.plan`. */
  subscriptionPlan?: "basic" | "premium" | "enterprise";

  /** Split Asaas: oficina + plataforma (preenchido pelo backend) */
  marketplaceMode?: boolean;
  marketplaceWorkshopUserId?: string;
  asaasMarketplaceWorkshopWalletId?: string;
}

export interface CreatePaymentData {
  workshopId?: string;
  workshopName?: string;
  /** Conta Firebase (oficina) que aceitou o lote — usado no marketplace Asaas (subconta). */
  marketplaceWorkshopUserId?: string | null;
  batchId?: string;
  batchName?: string;
  amount: number;
  dueDate: Date;
  paidDate?: Date;
  description: string;
  status?: PaymentStatus;
  subscriptionPlan?: "basic" | "premium" | "enterprise";
}

export interface UpdatePaymentData extends Partial<CreatePaymentData> {}
