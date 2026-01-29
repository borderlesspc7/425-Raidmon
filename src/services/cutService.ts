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
} from "firebase/firestore";
import { db } from "../lib/firebaseconfig";
import { Cut, CreateCutData, UpdateCutData } from "../types/cut";

const CUTS_COLLECTION = "cuts";

/**
 * Converter Firestore document para Cut
 */
function convertFirestoreToCut(docId: string, data: any): Cut {
  return {
    id: docId,
    type: data.type,
    totalPieces: data.totalPieces,
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

    const now = Timestamp.now();
    const newCut = {
      type: cutData.type.trim(),
      totalPieces: cutData.totalPieces,
      observations: cutData.observations?.trim() || "",
      userId,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(collection(db, CUTS_COLLECTION), newCut);

    return convertFirestoreToCut(docRef.id, {
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
      orderBy("createdAt", "desc"),
    );

    const querySnapshot = await getDocs(q);
    const cuts: Cut[] = [];

    querySnapshot.forEach((doc) => {
      cuts.push(convertFirestoreToCut(doc.id, doc.data()));
    });

    return cuts;
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

    const docRef = doc(db, CUTS_COLLECTION, cutId);
    const updatePayload: any = {
      ...updateData,
      updatedAt: Timestamp.now(),
    };

    await updateDoc(docRef, updatePayload);
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
