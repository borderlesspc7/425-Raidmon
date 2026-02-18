import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebaseconfig";
import {
  ReceivePieces,
  CreateReceivePiecesData,
  UpdateReceivePiecesData,
} from "../types/receivePieces";

const COLLECTION_NAME = "receivePieces";

// Converter Firestore timestamp para Date
const convertTimestamps = (data: any): ReceivePieces => {
  return {
    ...data,
    receiveDate: data.receiveDate?.toDate ? data.receiveDate.toDate() : data.receiveDate,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
  };
};

// Criar novo recebimento
export const createReceivePieces = async (
  userId: string,
  data: CreateReceivePiecesData
): Promise<ReceivePieces> => {
  try {
    const now = new Date();
    const receivePiecesData = {
      ...data,
      userId,
      receiveDate: Timestamp.fromDate(data.receiveDate),
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
    };

    const docRef = await addDoc(
      collection(db, COLLECTION_NAME),
      receivePiecesData
    );

    return {
      id: docRef.id,
      ...data,
      userId,
      createdAt: now,
      updatedAt: now,
    };
  } catch (error: any) {
    console.error("Erro ao criar recebimento:", error);
    throw new Error(error.message || "Erro ao criar recebimento");
  }
};

// Buscar recebimentos por usuário
export const getReceivePiecesByUser = async (
  userId: string
): Promise<ReceivePieces[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where("userId", "==", userId)
    );

    const querySnapshot = await getDocs(q);
    const receivePieces: ReceivePieces[] = [];

    querySnapshot.forEach((doc) => {
      receivePieces.push(
        convertTimestamps({
          id: doc.id,
          ...doc.data(),
        })
      );
    });

    // Ordenar por data de recebimento (mais recentes primeiro)
    receivePieces.sort((a, b) => b.receiveDate.getTime() - a.receiveDate.getTime());

    return receivePieces;
  } catch (error: any) {
    console.error("Erro ao buscar recebimentos:", error);
    throw new Error(error.message || "Erro ao buscar recebimentos");
  }
};

// Buscar recebimento por ID
export const getReceivePiecesById = async (
  id: string
): Promise<ReceivePieces | null> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return convertTimestamps({
        id: docSnap.id,
        ...docSnap.data(),
      });
    }

    return null;
  } catch (error: any) {
    console.error("Erro ao buscar recebimento:", error);
    throw new Error(error.message || "Erro ao buscar recebimento");
  }
};

// Atualizar recebimento
export const updateReceivePieces = async (
  id: string,
  data: UpdateReceivePiecesData
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const updateData: any = {
      ...data,
      updatedAt: Timestamp.fromDate(new Date()),
    };

    // Converter Date para Timestamp se necessário
    if (data.receiveDate) {
      updateData.receiveDate = Timestamp.fromDate(data.receiveDate);
    }

    await updateDoc(docRef, updateData);
  } catch (error: any) {
    console.error("Erro ao atualizar recebimento:", error);
    throw new Error(error.message || "Erro ao atualizar recebimento");
  }
};

// Excluir recebimento
export const deleteReceivePieces = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  } catch (error: any) {
    console.error("Erro ao excluir recebimento:", error);
    throw new Error(error.message || "Erro ao excluir recebimento");
  }
};

// Buscar estatísticas de recebimentos
export const getReceivePiecesStatistics = async (userId: string) => {
  try {
    const receivePieces = await getReceivePiecesByUser(userId);

    const totalReceives = receivePieces.length;
    const totalPiecesReceived = receivePieces.reduce(
      (sum, receive) => sum + receive.piecesReceived,
      0
    );

    // Recebimentos por qualidade
    const excellentCount = receivePieces.filter((r) => r.quality === "excellent").length;
    const goodCount = receivePieces.filter((r) => r.quality === "good").length;
    const regularCount = receivePieces.filter((r) => r.quality === "regular").length;
    const poorCount = receivePieces.filter((r) => r.quality === "poor").length;

    // Recebimentos do mês atual
    const now = new Date();
    const thisMonthReceives = receivePieces.filter((receive) => {
      const receiveDate = receive.receiveDate;
      return (
        receiveDate.getMonth() === now.getMonth() &&
        receiveDate.getFullYear() === now.getFullYear()
      );
    });

    return {
      totalReceives,
      totalPiecesReceived,
      excellentCount,
      goodCount,
      regularCount,
      poorCount,
      thisMonthReceives: thisMonthReceives.length,
      thisMonthPieces: thisMonthReceives.reduce(
        (sum, receive) => sum + receive.piecesReceived,
        0
      ),
    };
  } catch (error: any) {
    console.error("Erro ao buscar estatísticas:", error);
    throw error;
  }
};
