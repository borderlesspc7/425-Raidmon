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

/** Soma peças recebidas no mês calendário de `date` (0–11 = mês), excl. um recebimento ao editar. */
export function sumPiecesReceivedInCalendarMonth(
  receives: ReceivePieces[],
  date: Date,
  excludeReceiveId?: string
): number {
  const y = date.getFullYear();
  const m = date.getMonth();
  return receives.reduce((sum, r) => {
    if (excludeReceiveId && r.id === excludeReceiveId) return sum;
    const d = r.receiveDate;
    if (d.getFullYear() === y && d.getMonth() === m) {
      return sum + r.piecesReceived;
    }
    return sum;
  }, 0);
}

const COLLECTION_NAME = "receivePieces";

// Converter Firestore timestamp para Date
const convertTimestamps = (data: any): ReceivePieces => {
  const st = data.workshopApprovalStatus;
  const validStatus =
    st === "none" || st === "pending" || st === "approved" || st === "rejected" ? st : undefined;
  return {
    ...data,
    receiveDate: data.receiveDate?.toDate ? data.receiveDate.toDate() : data.receiveDate,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
    defectivePieces:
      typeof data.defectivePieces === "number" && Number.isFinite(data.defectivePieces)
        ? data.defectivePieces
        : undefined,
    unitPriceAtReceive:
      typeof data.unitPriceAtReceive === "number" && Number.isFinite(data.unitPriceAtReceive)
        ? data.unitPriceAtReceive
        : undefined,
    amountDue:
      typeof data.amountDue === "number" && Number.isFinite(data.amountDue)
        ? data.amountDue
        : undefined,
    linkedWorkshopUserIdForCheckout:
      typeof data.linkedWorkshopUserIdForCheckout === "string"
        ? data.linkedWorkshopUserIdForCheckout
        : undefined,
    checkoutToken:
      typeof data.checkoutToken === "string" ? data.checkoutToken : undefined,
    workshopApprovalStatus: validStatus,
  };
};

// Criar novo recebimento
export const createReceivePieces = async (
  userId: string,
  data: CreateReceivePiecesData
): Promise<ReceivePieces> => {
  try {
    const now = new Date();
    const receivePiecesData: any = {
      ...data,
      userId,
      receiveDate: Timestamp.fromDate(data.receiveDate),
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
    };
    if (data.workshopApprovalStatus === undefined) {
      receivePiecesData.workshopApprovalStatus = "none";
    }

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

/** Um mês no gráfico (0–11 = Jan–Dez) com total de peças recebidas naquele mês. */
export interface MonthlyPiecesPoint {
  year: number;
  monthIndex: number;
  pieces: number;
}

/**
 * Soma `piecesReceived` por mês calendário a partir de `receiveDate`,
 * para os últimos `months` meses (incluindo o mês atual).
 */
export async function getMonthlyPiecesReceived(
  userId: string,
  months: number = 5,
): Promise<MonthlyPiecesPoint[]> {
  const receivePieces = await getReceivePiecesByUser(userId);
  const now = new Date();

  const points: MonthlyPiecesPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    points.push({
      year: d.getFullYear(),
      monthIndex: d.getMonth(),
      pieces: 0,
    });
  }

  for (const r of receivePieces) {
    const rd = r.receiveDate;
    const y = rd.getFullYear();
    const m = rd.getMonth();
    const match = points.find((p) => p.year === y && p.monthIndex === m);
    if (match) {
      match.pieces += r.piecesReceived;
    }
  }

  return points;
}
