import { collection, getDocs, Timestamp } from "firebase/firestore";
import { db } from "../lib/firebaseconfig";
import type { AdminDashboardStats } from "../types/adminStats";
import type { BatchStatus } from "../types/batch";
import type { PaymentStatus } from "../types/payment";

const MS_PER_DAY = 86400000;

function toDate(value: unknown): Date {
  if (!value) return new Date(0);
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as Timestamp).toDate();
  }
  return new Date(value as string | number);
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function last6MonthKeys(): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d);
    const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
    out.push({ key, label });
  }
  return out;
}

/**
 * Agrega dados do Firestore para a dashboard do admin.
 * Requer regras que permitam leitura às coleções para usuários com `userType == 'admin'`.
 */
export async function fetchAdminDashboardStats(): Promise<AdminDashboardStats> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * MS_PER_DAY);

  const [
    usersSnap,
    workshopsSnap,
    batchesSnap,
    cutsSnap,
    receiveSnap,
    paymentsSnap,
  ] = await Promise.all([
    getDocs(collection(db, "users")),
    getDocs(collection(db, "workshops")),
    getDocs(collection(db, "batches")),
    getDocs(collection(db, "cuts")),
    getDocs(collection(db, "receivePieces")),
    getDocs(collection(db, "payments")),
  ]);

  let owners = 0;
  let workshopsUserType = 0;
  let admins = 0;
  let activeLast30Days = 0;

  const regByMonth: Record<string, number> = {};
  for (const k of last6MonthKeys()) {
    regByMonth[k.key] = 0;
  }

  usersSnap.forEach((doc) => {
    const data = doc.data();
    const ut = (data.userType as string) || "owner";
    if (ut === "workshop") workshopsUserType += 1;
    else if (ut === "admin") admins += 1;
    else owners += 1;

    const updated = toDate(data.updatedAt);
    if (updated >= thirtyDaysAgo) {
      activeLast30Days += 1;
    }

    const created = toDate(data.createdAt);
    const mk = monthKey(created);
    if (regByMonth[mk] !== undefined) {
      regByMonth[mk] += 1;
    }
  });

  const monthKeys = last6MonthKeys();
  const registrationsLast6Months = monthKeys.map(({ key, label }) => ({
    label,
    count: regByMonth[key] ?? 0,
  }));

  const batchesByStatus: AdminDashboardStats["batchesByStatus"] = {
    pending: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
  };

  let totalPiecesInBatches = 0;
  let piecesInOpenBatches = 0;
  let totalPiecesInCuts = 0;

  cutsSnap.forEach((doc) => {
    const data = doc.data();
    totalPiecesInCuts += Number(data.totalPieces) || 0;
  });

  batchesSnap.forEach((doc) => {
    const data = doc.data();
    const st = (data.status as BatchStatus) || "pending";
    if (st in batchesByStatus) {
      batchesByStatus[st as keyof typeof batchesByStatus] += 1;
    }
    const pieces = Number(data.totalPieces) || 0;
    totalPiecesInBatches += pieces;
    if (st === "pending" || st === "in_progress") {
      piecesInOpenBatches += pieces;
    }
  });

  const paymentsPending: { count: number; totalAmount: number } = {
    count: 0,
    totalAmount: 0,
  };
  const paymentsPaid: { count: number; totalAmount: number } = {
    count: 0,
    totalAmount: 0,
  };
  const paymentsOverdue: { count: number; totalAmount: number } = {
    count: 0,
    totalAmount: 0,
  };

  paymentsSnap.forEach((doc) => {
    const data = doc.data();
    const status = (data.status as PaymentStatus) || "pending";
    const amount = Number(data.amount) || 0;
    if (status === "pending") {
      paymentsPending.count += 1;
      paymentsPending.totalAmount += amount;
    } else if (status === "paid") {
      paymentsPaid.count += 1;
      paymentsPaid.totalAmount += amount;
    } else if (status === "overdue") {
      paymentsOverdue.count += 1;
      paymentsOverdue.totalAmount += amount;
    }
  });

  return {
    users: {
      total: usersSnap.size,
      owners,
      workshops: workshopsUserType,
      admins,
      activeLast30Days,
    },
    totalWorkshops: workshopsSnap.size,
    totalBatches: batchesSnap.size,
    totalCuts: cutsSnap.size,
    totalPiecesInCuts,
    totalReceiveEvents: receiveSnap.size,
    totalPiecesInBatches,
    piecesInOpenBatches,
    batchesByStatus,
    payments: {
      pending: paymentsPending,
      paid: paymentsPaid,
      overdue: paymentsOverdue,
    },
    registrationsLast6Months,
    fetchedAt: new Date(),
  };
}
