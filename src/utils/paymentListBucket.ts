import type { Payment } from '../types/payment';
import type { Batch } from '../types/batch';
import { isBatchDeliveryLate } from './batchProductionStatusStyle';

/**
 * Agrupamento de pagamentos para filtros/“marcadores” (Pendentes, Pagos, Atrasados),
 * alinhado ao lote vinculado: atraso de entrega da oficina = “Atrasado” mesmo com
 * `payment.status` ainda `pending` no Firestore.
 */
export type PaymentListBucket = 'pending' | 'paid' | 'overdue' | 'cancelled';

export function getPaymentListBucket(
  p: Payment,
  batch: Batch | undefined,
): PaymentListBucket {
  if (p.status === 'cancelled') return 'cancelled';
  if (p.status === 'paid') return 'paid';
  if (p.status === 'overdue') return 'overdue';
  if (batch) {
    if (
      isBatchDeliveryLate(batch) &&
      batch.status !== 'completed' &&
      batch.status !== 'cancelled'
    ) {
      return 'overdue';
    }
  }
  return 'pending';
}
