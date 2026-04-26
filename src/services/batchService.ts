import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebaseconfig";
import { Batch, CreateBatchData, UpdateBatchData, BatchStatus } from "../types/batch";

const BATCHES_COLLECTION = "batches";

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function ensureDeliveryDateIsNotPast(deliveryDate: Date | undefined): void {
  if (!deliveryDate) return;
  if (startOfLocalDay(deliveryDate).getTime() < startOfLocalDay(new Date()).getTime()) {
    throw new Error("A data de entrega não pode ser anterior a hoje");
  }
}

/**
 * Converter Firestore document para Batch
 */
function convertFirestoreToBatch(docId: string, data: any): Batch {
  return {
    id: docId,
    name: data.name,
    totalPieces: data.totalPieces || 0,
    status: data.status || "pending",
    workshopId: data.workshopId || undefined,
    workshopName: data.workshopName || undefined,
    ownerName: typeof data.ownerName === "string" ? data.ownerName : undefined,
    deliveryDate: data.deliveryDate
      ? data.deliveryDate instanceof Timestamp
        ? data.deliveryDate.toDate()
        : new Date(data.deliveryDate)
      : undefined,
    observations: data.observations || undefined,
    userId: data.userId,
    cutId: data.cutId || undefined,
    pricePerPiece:
      typeof data.pricePerPiece === "number" && Number.isFinite(data.pricePerPiece)
        ? data.pricePerPiece
        : undefined,
    guaranteedTotal:
      typeof data.guaranteedTotal === "number" && Number.isFinite(data.guaranteedTotal)
        ? data.guaranteedTotal
        : undefined,
    inviteToken: typeof data.inviteToken === "string" ? data.inviteToken : undefined,
    cutListNumber:
      typeof data.cutListNumber === "number" && Number.isFinite(data.cutListNumber)
        ? data.cutListNumber
        : undefined,
    linkedWorkshopUserId:
      data.linkedWorkshopUserId === null
        ? null
        : typeof data.linkedWorkshopUserId === "string"
          ? data.linkedWorkshopUserId
          : undefined,
    acceptedFromOwnerInvite: data.acceptedFromOwnerInvite === true,
    inviteAcceptedAt: data.inviteAcceptedAt
      ? data.inviteAcceptedAt instanceof Timestamp
        ? data.inviteAcceptedAt.toDate()
        : new Date(data.inviteAcceptedAt)
      : undefined,
    inviteAcceptedByUserId:
      typeof data.inviteAcceptedByUserId === "string"
        ? data.inviteAcceptedByUserId
        : undefined,
    inviteAcceptedByName:
      typeof data.inviteAcceptedByName === "string"
        ? data.inviteAcceptedByName
        : undefined,
    inviteAcceptedVia:
      data.inviteAcceptedVia === "whatsapp_link"
        ? "whatsapp_link"
        : undefined,
    productionFlowStatus:
      data.productionFlowStatus === "in_production" ||
      data.productionFlowStatus === "ready_for_pickup" ||
      data.productionFlowStatus === "partial" ||
      data.productionFlowStatus === "paused"
        ? data.productionFlowStatus
        : undefined,
    readyForPickupAt: data.readyForPickupAt
      ? data.readyForPickupAt instanceof Timestamp
        ? data.readyForPickupAt.toDate()
        : new Date(data.readyForPickupAt)
      : undefined,
    productionNote:
      typeof data.productionNote === "string" ? data.productionNote : undefined,
    partialPiecesDone:
      typeof data.partialPiecesDone === "number" && Number.isFinite(data.partialPiecesDone)
        ? data.partialPiecesDone
        : undefined,
    createdAt:
      data.createdAt instanceof Timestamp
        ? data.createdAt.toDate()
        : new Date(),
    updatedAt:
      data.updatedAt instanceof Timestamp
        ? data.updatedAt.toDate()
        : new Date(),
  };
}

/**
 * Criar um novo lote
 */
export async function createBatch(
  userId: string,
  batchData: CreateBatchData,
): Promise<Batch> {
  try {
    if (!userId) {
      throw new Error("User ID is required");
    }
    ensureDeliveryDateIsNotPast(batchData.deliveryDate);

    // Build payload and avoid including properties with `undefined` values
    const payload: any = {
      name: batchData.name,
      totalPieces: batchData.totalPieces,
      status: batchData.status || "pending",
      userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (batchData.workshopId !== undefined) payload.workshopId = batchData.workshopId;
    if (batchData.workshopName !== undefined) payload.workshopName = batchData.workshopName;
    if (batchData.observations !== undefined) payload.observations = batchData.observations;
    if (batchData.deliveryDate) payload.deliveryDate = Timestamp.fromDate(batchData.deliveryDate);
    if (batchData.cutId !== undefined) payload.cutId = batchData.cutId;
    if (batchData.pricePerPiece !== undefined) payload.pricePerPiece = batchData.pricePerPiece;
    if (batchData.guaranteedTotal !== undefined)
      payload.guaranteedTotal = batchData.guaranteedTotal;
    if (batchData.inviteToken !== undefined) payload.inviteToken = batchData.inviteToken;
    if (batchData.cutListNumber !== undefined) payload.cutListNumber = batchData.cutListNumber;

    const batchRef = await addDoc(collection(db, BATCHES_COLLECTION), payload);

    const batchDoc = await getDoc(batchRef);
    if (!batchDoc.exists()) {
      throw new Error("Erro ao criar lote");
    }

    return convertFirestoreToBatch(batchDoc.id, batchDoc.data());
  } catch (error: any) {
    console.error("Erro ao criar lote:", error);
    throw new Error(error.message || "Erro ao criar lote");
  }
}

/**
 * Buscar todos os lotes de um usuário
 */
export async function getBatchesByUser(userId: string): Promise<Batch[]> {
  try {
    if (!userId) {
      throw new Error("User ID is required");
    }

    const q = query(
      collection(db, BATCHES_COLLECTION),
      where("userId", "==", userId),
    );

    const querySnapshot = await getDocs(q);
    const batches = querySnapshot.docs.map((doc) =>
      convertFirestoreToBatch(doc.id, doc.data()),
    );
    
    // Ordenar em memória por data de criação (mais recente primeiro)
    return batches.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (error: any) {
    console.error("Erro ao buscar lotes:", error);
    throw new Error(error.message || "Erro ao buscar lotes");
  }
}

/**
 * Lotes em que a oficina (conta utilizador) aceitou o convite (linkedWorkshopUserId).
 */
export async function getBatchesLinkedToWorkshop(
  workshopUserId: string,
): Promise<Batch[]> {
  try {
    if (!workshopUserId) {
      throw new Error("Workshop user ID is required");
    }

    const q = query(
      collection(db, BATCHES_COLLECTION),
      where("linkedWorkshopUserId", "==", workshopUserId),
    );

    const querySnapshot = await getDocs(q);
    const batches = querySnapshot.docs.map((d) =>
      convertFirestoreToBatch(d.id, d.data()),
    );

    return batches.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (error: any) {
    console.error("Erro ao buscar lotes da oficina:", error);
    throw new Error(error.message || "Erro ao buscar lotes da oficina");
  }
}

/** Token aleatório para link de convite (ligação WhatsApp). */
export function generateBatchInviteToken(): string {
  const parts: string[] = [];
  for (let i = 0; i < 4; i++) {
    parts.push(
      Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2),
    );
  }
  return parts.join("");
}

/**
 * Buscar um lote por ID
 */
export async function getBatchById(batchId: string): Promise<Batch | null> {
  try {
    const batchDoc = await getDoc(doc(db, BATCHES_COLLECTION, batchId));

    if (!batchDoc.exists()) {
      return null;
    }

    return convertFirestoreToBatch(batchDoc.id, batchDoc.data());
  } catch (error: any) {
    console.error("Erro ao buscar lote:", error);
    throw new Error(error.message || "Erro ao buscar lote");
  }
}

/**
 * Atualizar um lote
 */
export async function updateBatch(
  batchId: string,
  updateData: UpdateBatchData,
): Promise<void> {
  try {
    ensureDeliveryDateIsNotPast(updateData.deliveryDate);
    const batchRef = doc(db, BATCHES_COLLECTION, batchId);
    const updatePayload: any = {
      ...updateData,
      updatedAt: serverTimestamp(),
    };

    if (updateData.deliveryDate) {
      updatePayload.deliveryDate = Timestamp.fromDate(updateData.deliveryDate);
    }
    if (updateData.readyForPickupAt) {
      updatePayload.readyForPickupAt = Timestamp.fromDate(updateData.readyForPickupAt);
    }

    // Remove keys with undefined values to avoid Firestore errors
    Object.keys(updatePayload).forEach((key) => {
      if (updatePayload[key] === undefined) {
        delete updatePayload[key];
      }
    });

    await updateDoc(batchRef, updatePayload);
  } catch (error: any) {
    console.error("Erro ao atualizar lote:", error);
    throw new Error(error.message || "Erro ao atualizar lote");
  }
}

/**
 * Deletar um lote
 */
export async function deleteBatch(batchId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, BATCHES_COLLECTION, batchId));
  } catch (error: any) {
    console.error("Erro ao deletar lote:", error);
    throw new Error(error.message || "Erro ao deletar lote");
  }
}

/**
 * Obter estatísticas de lotes
 */
export async function getBatchStatistics(userId: string): Promise<{
  totalBatches: number;
  totalPieces: number;
  pendingBatches: number;
  inProgressBatches: number;
  completedBatches: number;
}> {
  try {
    const batches = await getBatchesByUser(userId);
    
    return {
      totalBatches: batches.length,
      totalPieces: batches.reduce((sum, batch) => sum + batch.totalPieces, 0),
      pendingBatches: batches.filter((b) => b.status === "pending").length,
      inProgressBatches: batches.filter((b) => b.status === "in_progress").length,
      completedBatches: batches.filter((b) => b.status === "completed").length,
    };
  } catch (error: any) {
    console.error("Erro ao buscar estatísticas:", error);
    throw new Error(error.message || "Erro ao buscar estatísticas");
  }
}
