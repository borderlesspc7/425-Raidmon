import type { Batch, ProductionFlowStatus } from "../types/batch";

export function batchRemainingContractPieces(batch: Batch): number {
  const T = batch.totalPieces;
  const cum = batch.piecesDeliveredCumulative ?? 0;
  return Math.max(0, T - cum);
}

/**
 * A RECEBER: cortes ainda “no caminho” (não desmembrado em oficina).
 * NA MESA: peças em costura.
 * PRONTAS: prontas aguardando coleta do dono.
 */
export function computeWorkshopHubPieceColumns(batch: Batch): {
  toReceiveCuts: number;
  onTablePieces: number;
  readyPieces: number;
} {
  if (batch.status === "completed" || batch.status === "cancelled") {
    return { toReceiveCuts: 0, onTablePieces: 0, readyPieces: 0 };
  }
  const rem = batchRemainingContractPieces(batch);
  const flow: ProductionFlowStatus | undefined = batch.productionFlowStatus;

  if (flow === "ready_for_pickup") {
    return { toReceiveCuts: 0, onTablePieces: 0, readyPieces: rem };
  }
  if (flow === "in_production" || flow === "partial" || flow === "paused") {
    return { toReceiveCuts: 0, onTablePieces: rem, readyPieces: 0 };
  }
  // Ainda sem fluxo: convite aceito, aguardando início (1 corte a receber)
  return { toReceiveCuts: rem > 0 ? 1 : 0, onTablePieces: 0, readyPieces: 0 };
}

export function computeGuaranteedEarningsProgress(batch: Batch): {
  current: number;
  goal: number;
  ratio: number;
} {
  const goal = batch.guaranteedTotal;
  if (goal == null || !Number.isFinite(goal) || goal <= 0) {
    return { current: 0, goal: 0, ratio: 0 };
  }
  if (batch.status === "completed") {
    return { current: goal, goal, ratio: 1 };
  }
  const T = Math.max(1, batch.totalPieces);
  const cum = batch.piecesDeliveredCumulative ?? 0;
  const rem = batchRemainingContractPieces(batch);
  const flow = batch.productionFlowStatus;
  // Já pago (acumulado) + lote pronto p/ retirada conta como “ganho de produção” exibido
  const volumePieces =
    cum + (flow === "ready_for_pickup" && batch.status === "in_progress" ? rem : 0);
  const ratio = Math.min(1, Math.max(0, volumePieces / T));
  return { current: Math.round(goal * ratio * 100) / 100, goal, ratio };
}
