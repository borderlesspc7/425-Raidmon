import type { Batch } from '../types/batch';
import type { Workshop } from '../types/workshop';
import { isBatchDeliveryLate } from './batchProductionStatusStyle';

export type OperationalDisplay =
  | 'ready_pickup'
  | 'pendencies'
  | 'sewing'
  | 'producing_ok'
  | 'delayed';

export interface WorkshopCardModel {
  workshopId: string;
  title: string;
  subtitle: string;
  status: OperationalDisplay;
  color: string;
  productLine: string;
  moreActiveCount: number;
}

/** Acento do card: alinhado a `getBatchProductionPillColors` (dono + oficina). */
const COLORS: Record<OperationalDisplay, string> = {
  ready_pickup: '#166534',
  pendencies: '#C2410C',
  sewing: '#854D0E',
  producing_ok: '#854D0E',
  delayed: '#B91C1C',
};

/**
 * Agrega o estado operacional exibido no card da oficina a partir dos lotes do dono.
 * Quando existir fluxo dedicado no app da oficina, pode-se priorizar campos explícitos no lote.
 */
export function deriveWorkshopCardState(
  workshop: Workshop,
  allBatches: Batch[],
): WorkshopCardModel {
  const rel = allBatches.filter(
    (b) => b.workshopId === workshop.id && b.status !== 'cancelled',
  );

  const activeBatches = rel.filter(
    (b) => b.status === 'pending' || b.status === 'in_progress',
  );

  const delayed = rel.some((b) => isBatchDeliveryLate(b));

  const anyReadyForPickup = rel.some(
    (b) => b.productionFlowStatus === 'ready_for_pickup',
  );
  const anyPartial = rel.some((b) => b.productionFlowStatus === 'partial');
  const anyPaused = rel.some((b) => b.productionFlowStatus === 'paused');

  const anyProducingOk = activeBatches.some(
    (b) =>
      b.status === 'in_progress' &&
      b.productionFlowStatus === 'in_production' &&
      !isBatchDeliveryLate(b),
  );

  let status: OperationalDisplay;
  if (delayed) {
    status = 'delayed';
  } else if (anyReadyForPickup) {
    status = 'ready_pickup';
  } else if (workshop.status === 'orange' || anyPartial) {
    status = 'pendencies';
  } else if (anyProducingOk) {
    status = 'producing_ok';
  } else if (anyPaused || rel.some((b) => b.status === 'in_progress')) {
    status = 'sewing';
  } else if (rel.some((b) => b.status === 'pending')) {
    status = 'sewing';
  } else {
    status = 'ready_pickup';
  }

  const sortedActive = [...activeBatches].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
  );
  const primaryActive = sortedActive[0];
  let productLine = primaryActive?.name ?? '';
  if (!productLine && rel.length) {
    const latestAny = [...rel].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    )[0];
    productLine = latestAny?.name ?? '';
  }

  const moreActiveCount =
    activeBatches.length > 1 ? activeBatches.length - 1 : 0;

  return {
    workshopId: workshop.id,
    title: workshop.name,
    subtitle: workshop.contact1,
    status,
    color: COLORS[status],
    productLine,
    moreActiveCount,
  };
}
