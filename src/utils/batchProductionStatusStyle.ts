import type { Batch, ProductionFlowStatus } from '../types/batch';

/**
 * Cores alinhadas entre dono e oficina:
 * - Vermelho: atraso (data de entrega < hoje, lote ainda ativo)
 * - Verde: in_production ou ready_for_pickup (lote concluído = verde)
 * - Laranja claro: partial ou paused
 * - Amarelo claro: demais estados
 */
export const BATCH_PRODUCTION_COLORS = {
  late: { bg: '#FEE2E2', fg: '#B91C1C' },
  green: { bg: '#DCFCE7', fg: '#166534' },
  orange: { bg: '#FFEDD5', fg: '#C2410C' },
  yellow: { bg: '#FEF9C3', fg: '#854D0E' },
  /** Concluído: mesmo verde de “produção ok” */
  completed: { bg: '#DCFCE7', fg: '#166534' },
  cancelled: { bg: '#F3F4F6', fg: '#4B5563' },
} as const;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Atraso na entrega (mesma regra da tela Produção do workshop). */
export function isBatchDeliveryLate(batch: Batch): boolean {
  if (batch.status === 'completed' || batch.status === 'cancelled') return false;
  if (!batch.deliveryDate) return false;
  return startOfDay(batch.deliveryDate).getTime() < startOfDay(new Date()).getTime();
}

/**
 * Pílula / badge: fundo e texto.
 */
export function getBatchProductionPillColors(
  batch: Batch,
): { bg: string; fg: string } {
  if (batch.status === 'completed') {
    return { ...BATCH_PRODUCTION_COLORS.completed };
  }
  if (batch.status === 'cancelled') {
    return { ...BATCH_PRODUCTION_COLORS.cancelled };
  }
  if (isBatchDeliveryLate(batch)) {
    return { ...BATCH_PRODUCTION_COLORS.late };
  }
  const flow: ProductionFlowStatus | undefined = batch.productionFlowStatus;
  if (flow === 'ready_for_pickup' || flow === 'in_production') {
    return { ...BATCH_PRODUCTION_COLORS.green };
  }
  if (flow === 'partial' || flow === 'paused') {
    return { ...BATCH_PRODUCTION_COLORS.orange };
  }
  return { ...BATCH_PRODUCTION_COLORS.yellow };
}

/** Cor de borda/acento (ex.: card oficina no dashboard) — tom principal do estado. */
export function getBatchProductionAccentColor(batch: Batch): string {
  return getBatchProductionPillColors(batch).fg;
}
