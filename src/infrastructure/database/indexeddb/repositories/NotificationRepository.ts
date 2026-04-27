import { v4 as uuidv4 } from 'uuid';
import { db, type NotificationRecord } from '../schema';

export const notificationRepository = {
  async getUserNotifications(userId: string): Promise<NotificationRecord[]> {
    return db.notifications.where('userId').equals(userId).reverse().sortBy('createdAt');
  },

  async add(notification: Omit<NotificationRecord, 'id' | 'createdAt'>): Promise<string> {
    const id = uuidv4();
    const createdAt = new Date().toISOString();
    await db.notifications.put({ id, createdAt, ...notification });
    return id;
  },

  async markRead(id: string): Promise<number> {
    return db.notifications.update(id, { read: true });
  },

  async markAllRead(userId: string): Promise<number> {
    const all = await db.notifications.where('userId').equals(userId).toArray();
    await Promise.all(all.map((item) => db.notifications.update(item.id, { read: true })));
    return all.length;
  },

  async update(id: string, changes: Partial<NotificationRecord>): Promise<number> {
    return db.notifications.update(id, changes);
  },

  async delete(id: string): Promise<void> {
    await db.notifications.delete(id);
  },
};
