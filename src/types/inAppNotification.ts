export type InAppNotificationType =
  | 'workshop_ready'
  | 'workshop_partial'
  | 'workshop_pause'
  | 'receive_checkout';

export interface InAppNotification {
  id: string;
  userId: string;
  fromUserId?: string;
  type: InAppNotificationType;
  title: string;
  body: string;
  batchId?: string;
  receiveId?: string;
  read: boolean;
  createdAt: Date;
}
