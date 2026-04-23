import {
  collection,
  query,
  where,
  orderBy,
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
  const q = query(
    collection(db, COL),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => convert(d.id, d.data()));
}

export async function markInAppNotificationRead(id: string): Promise<void> {
  const ref = doc(db, COL, id);
  await updateDoc(ref, { read: true, updatedAt: Timestamp.now() });
}
