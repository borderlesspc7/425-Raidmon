import type { Batch, ProductionFlowStatus } from '../types/batch';

/**
 * Cores alinhadas entre dono e oficina:
 * - Vermelho: produção atrasada (data de entrega < hoje, lote ativo)
 * - Verde: lote pronto (pronto para retirada ou concluído)
 * - Amarelo: em produção (incl. pausa informada)
 * - Laranja: conclusão / entrega parcial
 */
export const BATCH_PRODUCTION_COLORS = {
  // Tons mais vivos para destacar bem em light e dark mode.
  late: { bg: '#FECACA', fg: '#DC2626' },
  green: { bg: '#BBF7D0', fg: '#16A34A' },
  orange: { bg: '#FED7AA', fg: '#EA580C' },
  yellow: { bg: '#FDE047', fg: '#CA8A04' },
  /** Concluído: mesmo verde de “produção ok” */
  completed: { bg: '#BBF7D0', fg: '#16A34A' },
  cancelled: { bg: '#E5E7EB', fg: '#374151' },
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
  if (flow === 'partial') {
    return { ...BATCH_PRODUCTION_COLORS.orange };
  }
  if (flow === 'ready_for_pickup') {
    return { ...BATCH_PRODUCTION_COLORS.green };
  }
  if (flow === 'in_production' || flow === 'paused') {
    return { ...BATCH_PRODUCTION_COLORS.yellow };
  }
  return { ...BATCH_PRODUCTION_COLORS.yellow };
}

/** Cor de borda/acento (ex.: card oficina no dashboard) — tom principal do estado. */
export function getBatchProductionAccentColor(batch: Batch): string {
  return getBatchProductionPillColors(batch).fg;
}
