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
    deliveryDate: data.deliveryDate
      ? data.deliveryDate instanceof Timestamp
        ? data.deliveryDate.toDate()
        : new Date(data.deliveryDate)
      : undefined,
    observations: data.observations || undefined,
    userId: data.userId,
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

    const batchRef = await addDoc(collection(db, BATCHES_COLLECTION), {
      ...batchData,
      userId,
      status: batchData.status || "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      deliveryDate: batchData.deliveryDate
        ? Timestamp.fromDate(batchData.deliveryDate)
        : undefined,
    });

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
    const batchRef = doc(db, BATCHES_COLLECTION, batchId);
    const updatePayload: any = {
      ...updateData,
      updatedAt: serverTimestamp(),
    };

    if (updateData.deliveryDate) {
      updatePayload.deliveryDate = Timestamp.fromDate(updateData.deliveryDate);
    }

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
