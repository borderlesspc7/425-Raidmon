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
  Payment,
  CreatePaymentData,
  UpdatePaymentData,
  PaymentStatus,
} from "../types/payment";

const PAYMENTS_COLLECTION = "payments";

function convertFirestoreToPayment(id: string, data: any): Payment {
  return {
    id,
    workshopId: data.workshopId || undefined,
    workshopName: data.workshopName || undefined,
    batchId: data.batchId || undefined,
    batchName: data.batchName || undefined,
    amount: data.amount || 0,
    dueDate:
      data.dueDate instanceof Timestamp
        ? data.dueDate.toDate()
        : new Date(data.dueDate),
    paidDate: data.paidDate
      ? data.paidDate instanceof Timestamp
        ? data.paidDate.toDate()
        : new Date(data.paidDate)
      : undefined,
    description: data.description || "",
    status: (data.status as PaymentStatus) || "pending",
    userId: data.userId || "",
    createdAt:
      data.createdAt instanceof Timestamp
        ? data.createdAt.toDate()
        : new Date(data.createdAt),
    updatedAt:
      data.updatedAt instanceof Timestamp
        ? data.updatedAt.toDate()
        : new Date(data.updatedAt),
  };
}

export async function createPayment(
  userId: string,
  data: CreatePaymentData
): Promise<Payment> {
  try {
    const now = Timestamp.now();
    const docData: any = {
      workshopId: data.workshopId || null,
      workshopName: data.workshopName || null,
      batchId: data.batchId || null,
      batchName: data.batchName || null,
      amount: data.amount,
      dueDate: Timestamp.fromDate(data.dueDate),
      paidDate: data.paidDate ? Timestamp.fromDate(data.paidDate) : null,
      description: data.description,
      status: data.status || "pending",
      userId,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(collection(db, PAYMENTS_COLLECTION), docData);
    return convertFirestoreToPayment(docRef.id, {
      ...docData,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error: any) {
    console.error("Erro ao criar pagamento:", error);
    throw new Error(error.message || "Erro ao criar pagamento");
  }
}

export async function getPaymentsByUser(userId: string): Promise<Payment[]> {
  try {
    if (!userId) {
      throw new Error("User ID is required");
    }

    const q = query(
      collection(db, PAYMENTS_COLLECTION),
      where("userId", "==", userId)
    );

    const querySnapshot = await getDocs(q);
    const payments = querySnapshot.docs.map((doc) =>
      convertFirestoreToPayment(doc.id, doc.data())
    );

    // Ordenar em memória por data de vencimento (mais recentes primeiro)
    return payments.sort(
      (a, b) => b.dueDate.getTime() - a.dueDate.getTime()
    );
  } catch (error: any) {
    console.error("Erro ao buscar pagamentos:", error);
    throw new Error(error.message || "Erro ao buscar pagamentos");
  }
}

export async function getPaymentById(
  paymentId: string
): Promise<Payment | null> {
  try {
    const docRef = doc(db, PAYMENTS_COLLECTION, paymentId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;
    return convertFirestoreToPayment(docSnap.id, docSnap.data());
  } catch (error: any) {
    console.error("Erro ao buscar pagamento:", error);
    throw new Error(error.message || "Erro ao buscar pagamento");
  }
}

export async function updatePayment(
  paymentId: string,
  data: UpdatePaymentData
): Promise<void> {
  try {
    const docRef = doc(db, PAYMENTS_COLLECTION, paymentId);
    const updateData: any = {
      updatedAt: Timestamp.now(),
    };

    if (data.workshopId !== undefined) updateData.workshopId = data.workshopId;
    if (data.workshopName !== undefined)
      updateData.workshopName = data.workshopName;
    if (data.batchId !== undefined) updateData.batchId = data.batchId;
    if (data.batchName !== undefined) updateData.batchName = data.batchName;
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.dueDate !== undefined)
      updateData.dueDate = Timestamp.fromDate(data.dueDate);
    if (data.paidDate !== undefined)
      updateData.paidDate = data.paidDate
        ? Timestamp.fromDate(data.paidDate)
        : null;
    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.status !== undefined) updateData.status = data.status;

    await updateDoc(docRef, updateData);
  } catch (error: any) {
    console.error("Erro ao atualizar pagamento:", error);
    throw new Error(error.message || "Erro ao atualizar pagamento");
  }
}

export async function deletePayment(paymentId: string): Promise<void> {
  try {
    const docRef = doc(db, PAYMENTS_COLLECTION, paymentId);
    await deleteDoc(docRef);
  } catch (error: any) {
    console.error("Erro ao excluir pagamento:", error);
    throw new Error(error.message || "Erro ao excluir pagamento");
  }
}

export interface PaymentStatistics {
  total: number;
  pending: number;
  paid: number;
  overdue: number;
  totalAmount: number;
  pendingAmount: number;
  paidAmount: number;
  overdueAmount: number;
}

export async function getPaymentStatistics(
  userId: string
): Promise<PaymentStatistics> {
  try {
    const payments = await getPaymentsByUser(userId);

    const stats: PaymentStatistics = {
      total: payments.length,
      pending: 0,
      paid: 0,
      overdue: 0,
      totalAmount: 0,
      pendingAmount: 0,
      paidAmount: 0,
      overdueAmount: 0,
    };

    payments.forEach((p) => {
      stats.totalAmount += p.amount;
      if (p.status === "pending") {
        stats.pending++;
        stats.pendingAmount += p.amount;
      } else if (p.status === "paid") {
        stats.paid++;
        stats.paidAmount += p.amount;
      } else if (p.status === "overdue") {
        stats.overdue++;
        stats.overdueAmount += p.amount;
      }
    });

    return stats;
  } catch (error: any) {
    console.error("Erro ao buscar estatísticas de pagamentos:", error);
    throw new Error(error.message || "Erro ao buscar estatísticas");
  }
}
