import {
  collection,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  Timestamp,
  getDoc,
} from "firebase/firestore";
import { db } from "../lib/firebaseconfig";
import { Cut, CreateCutData, UpdateCutData } from "../types/cut";

const CUTS_COLLECTION = "cuts";

/**
 * Converter Firestore document para Cut
 */
function convertFirestoreToCut(docId: string, data: any): Cut {
  const rawPrice = data.pricePerPiece;
  const pricePerPiece =
    typeof rawPrice === "number" && Number.isFinite(rawPrice)
      ? rawPrice
      : undefined;

  const uniqueRef =
    typeof data.uniqueRef === "string" && data.uniqueRef.length > 0
      ? data.uniqueRef
      : docId;

  return {
    id: docId,
    uniqueRef,
    type: data.type,
    totalPieces: data.totalPieces,
    pricePerPiece,
    observations: data.observations || "",
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
 * Criar um novo corte
 */
export async function createCut(
  userId: string,
  cutData: CreateCutData,
): Promise<Cut> {
  try {
    if (!userId) {
      throw new Error("User ID is required");
    }

    if (!cutData.type || cutData.type.trim().length < 3) {
      throw new Error("Tipo/modelo é obrigatório (mínimo 3 caracteres)");
    }

    if (!cutData.totalPieces || cutData.totalPieces <= 0) {
      throw new Error("Quantidade de peças deve ser maior que zero");
    }

    if (
      typeof cutData.pricePerPiece !== "number" ||
      !Number.isFinite(cutData.pricePerPiece) ||
      cutData.pricePerPiece <= 0
    ) {
      throw new Error("Preço por peça deve ser maior que zero");
    }

    const now = Timestamp.now();
    const newCutRef = doc(collection(db, CUTS_COLLECTION));
    const newId = newCutRef.id;

    const newCut = {
      type: cutData.type.trim(),
      totalPieces: cutData.totalPieces,
      pricePerPiece: cutData.pricePerPiece,
      observations: cutData.observations?.trim() || "",
      userId,
      uniqueRef: newId,
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(newCutRef, newCut);

    return convertFirestoreToCut(newId, {
      ...newCut,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error: any) {
    console.error("Error creating cut:", error);
    throw new Error(error.message || "Erro ao criar corte");
  }
}

/**
 * Buscar todos os cortes de um usuário
 */
export async function getCutsByUser(userId: string): Promise<Cut[]> {
  try {
    if (!userId) {
      throw new Error("User ID is required");
    }

    const q = query(
      collection(db, CUTS_COLLECTION),
      where("userId", "==", userId),
    );

    const querySnapshot = await getDocs(q);
    const cuts: Cut[] = [];

    querySnapshot.forEach((doc) => {
      cuts.push(convertFirestoreToCut(doc.id, doc.data()));
    });

    return cuts.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  } catch (error: any) {
    console.error("Error fetching cuts:", error);
    throw new Error(error.message || "Erro ao buscar cortes");
  }
}

/**
 * Buscar um corte por ID
 */
export async function getCutById(cutId: string): Promise<Cut | null> {
  try {
    if (!cutId) {
      throw new Error("Cut ID is required");
    }

    const docRef = doc(db, CUTS_COLLECTION, cutId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return convertFirestoreToCut(docSnap.id, docSnap.data());
  } catch (error: any) {
    console.error("Error fetching cut:", error);
    throw new Error(error.message || "Erro ao buscar corte");
  }
}

/**
 * Atualizar um corte
 */
export async function updateCut(
  cutId: string,
  updateData: UpdateCutData,
): Promise<void> {
  try {
    if (!cutId) {
      throw new Error("Cut ID is required");
    }

    if (updateData.totalPieces !== undefined && updateData.totalPieces <= 0) {
      throw new Error("Quantidade de peças deve ser maior que zero");
    }

    if (updateData.pricePerPiece !== undefined) {
      if (
        typeof updateData.pricePerPiece !== "number" ||
        !Number.isFinite(updateData.pricePerPiece) ||
        updateData.pricePerPiece <= 0
      ) {
        throw new Error("Preço por peça deve ser maior que zero");
      }
    }

    const docRef = doc(db, CUTS_COLLECTION, cutId);
    const updatePayload: Record<string, unknown> = {
      updatedAt: Timestamp.now(),
    };
    if (updateData.type !== undefined) updatePayload.type = updateData.type;
    if (updateData.totalPieces !== undefined)
      updatePayload.totalPieces = updateData.totalPieces;
    if (updateData.pricePerPiece !== undefined)
      updatePayload.pricePerPiece = updateData.pricePerPiece;
    if (updateData.observations !== undefined)
      updatePayload.observations = updateData.observations;

    await updateDoc(docRef, updatePayload as any);
  } catch (error: any) {
    console.error("Error updating cut:", error);
    throw new Error(error.message || "Erro ao atualizar corte");
  }
}

/**
 * Deletar um corte
 */
export async function deleteCut(cutId: string): Promise<void> {
  try {
    if (!cutId) {
      throw new Error("Cut ID is required");
    }

    const docRef = doc(db, CUTS_COLLECTION, cutId);
    await deleteDoc(docRef);
  } catch (error: any) {
    console.error("Error deleting cut:", error);
    throw new Error(error.message || "Erro ao deletar corte");
  }
}

/**
 * Obter estatísticas de cortes do usuário
 */
export async function getCutStatistics(userId: string): Promise<{
  totalCuts: number;
  totalPieces: number;
}> {
  try {
    const cuts = await getCutsByUser(userId);
    const totalPieces = cuts.reduce((sum, cut) => sum + cut.totalPieces, 0);

    return {
      totalCuts: cuts.length,
      totalPieces,
    };
  } catch (error: any) {
    console.error("Error calculating statistics:", error);
    throw new Error(error.message || "Erro ao calcular estatísticas");
  }
}
