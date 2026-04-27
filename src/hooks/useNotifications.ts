import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDatabase } from '@/contexts/DatabaseProvider';
import { toast } from '@/components/ui/use-toast';
import { NotificationService } from '@/services/NotificationService';
import type { Application, NotificationRecord } from '@/infrastructure/database/indexeddb/schema';

export function useNotifications(userId?: string, applications: Application[] = []) {
  const { notificationRepo } = useDatabase();
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const data = (await notificationRepo.getUserNotifications(userId)) as NotificationRecord[];
    setNotifications(data.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
    setLoading(false);
  }, [notificationRepo, userId]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!userId || applications.length === 0) {
      return;
    }

    NotificationService.runDeadlineReminderCheck({
      userId,
      applications,
      notificationRepo,
      toast: ({ title, description }) => toast({ title, description }),
    }).then(loadNotifications);
  }, [applications, loadNotifications, notificationRepo, userId]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read && item.channel === 'in-app').length,
    [notifications]
  );

  const markRead = useCallback(
    async (id: string) => {
      await notificationRepo.markRead(id);
      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, read: true } : item))
      );
    },
    [notificationRepo]
  );

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    await notificationRepo.markAllRead(userId);
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
  }, [notificationRepo, userId]);

  const createDeadlineReminder = useCallback(
    async (input: { applicationId: string; dueDate: string; title?: string; message?: string }) => {
      if (!userId) {
        throw new Error('User is required to create reminders');
      }

      const title = input.title || 'Custom application reminder';
      const message = input.message || 'You have a scheduled reminder for a tracked application.';

      await notificationRepo.add({
        userId,
        title,
        message,
        channel: 'in-app',
        type: 'deadline-reminder',
        entityId: input.applicationId,
        dueDate: input.dueDate,
        read: false,
      });

      await loadNotifications();
    },
    [loadNotifications, notificationRepo, userId]
  );

  const updateReminder = useCallback(
    async (id: string, input: { dueDate?: string; title?: string; message?: string }) => {
      await notificationRepo.update(id, {
        dueDate: input.dueDate,
        title: input.title,
        message: input.message,
      });
      await loadNotifications();
    },
    [loadNotifications, notificationRepo]
  );

  const cancelReminder = useCallback(
    async (id: string) => {
      await notificationRepo.delete(id);
      await loadNotifications();
    },
    [loadNotifications, notificationRepo]
  );

  return {
    notifications,
    unreadCount,
    loading,
    markRead,
    markAllRead,
    createDeadlineReminder,
    updateReminder,
    cancelReminder,
    refresh: loadNotifications,
  };
}
