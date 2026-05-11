import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebaseconfig";
import type { InAppNotification } from "../types/inAppNotification";

const COL = "inAppNotifications";

const convert = (id: string, data: any): InAppNotification => ({
  id,
  userId: data.userId,
  fromUserId: data.fromUserId,
  type: data.type,
  title: data.title,
  body: data.body,
  batchId: data.batchId,
  receiveId: data.receiveId,
  read: data.read === true,
  createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
});

export async function getInAppNotificationsForUser(
  userId: string,
): Promise<InAppNotification[]> {
  // Sem `orderBy` para evitar índice composto (userId + createdAt). O volume por
  // usuário é pequeno; ordena em memória após o fetch.
  const q = query(collection(db, COL), where("userId", "==", userId));
  const snap = await getDocs(q);
  const items = snap.docs.map((d) => convert(d.id, d.data()));
  items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return items;
}

export async function markInAppNotificationRead(id: string): Promise<void> {
  const ref = doc(db, COL, id);
  await updateDoc(ref, { read: true, updatedAt: Timestamp.now() });
}
