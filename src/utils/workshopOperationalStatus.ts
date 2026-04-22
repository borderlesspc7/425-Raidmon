import type { Batch } from '../types/batch';
import type { Workshop } from '../types/workshop';

export type OperationalDisplay =
  | 'ready_pickup'
  | 'pendencies'
  | 'sewing'
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

const COLORS: Record<OperationalDisplay, string> = {
  ready_pickup: '#22c55e',
  pendencies: '#f97316',
  sewing: '#eab308',
  delayed: '#ef4444',
};

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isBatchDelayed(batch: Batch): boolean {
  if (batch.status === 'completed' || batch.status === 'cancelled') return false;
  if (!batch.deliveryDate) return false;
  return startOfDay(batch.deliveryDate).getTime() < startOfDay(new Date()).getTime();
}

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

  const delayed = rel.some((b) => isBatchDelayed(b));

  let status: OperationalDisplay;
  if (delayed) {
    status = 'delayed';
  } else if (workshop.status === 'orange') {
    status = 'pendencies';
  } else if (rel.some((b) => b.status === 'in_progress')) {
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
