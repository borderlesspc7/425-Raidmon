export interface AdminUserBreakdown {
  total: number;
  owners: number;
  workshops: number;
  admins: number;
  /** Usuários com `updatedAt` nos últimos 30 dias (aprox. uso recente) */
  activeLast30Days: number;
}

export interface AdminBatchByStatus {
  pending: number;
  in_progress: number;
  completed: number;
  cancelled: number;
}

export interface AdminPaymentSummary {
  count: number;
  totalAmount: number;
}

export interface AdminPaymentsBlock {
  pending: AdminPaymentSummary;
  paid: AdminPaymentSummary;
  overdue: AdminPaymentSummary;
}

export interface AdminRegistrationsPoint {
  label: string;
  count: number;
}

export interface AdminDashboardStats {
  users: AdminUserBreakdown;
  totalWorkshops: number;
  totalBatches: number;
  totalCuts: number;
  /** Soma de peças em cortes registrados */
  totalPiecesInCuts: number;
  totalReceiveEvents: number;
  /** Soma de totalPieces em todos os lotes */
  totalPiecesInBatches: number;
  /** Peças em lotes não concluídos */
  piecesInOpenBatches: number;
  batchesByStatus: AdminBatchByStatus;
  payments: AdminPaymentsBlock;
  /** Cadastros de usuários nos últimos 6 meses (por mês) */
  registrationsLast6Months: AdminRegistrationsPoint[];
  fetchedAt: Date;
}
