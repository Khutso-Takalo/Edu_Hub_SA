import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { NotificationService } from '@/services/NotificationService';
import type { Application, NotificationRecord } from '@/infrastructure/database/indexeddb/schema';

function createApplication(deadlineDate: string): Application {
  return {
    id: 'app-1',
    userId: 'user-1',
    bursaryId: 'b-1',
    status: 'draft',
    deadlineDate,
    checklist: {
      idCopy: false,
      transcript: false,
      motivationLetter: false,
      references: false,
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('NotificationService escalation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates critical reminder when deadline is in 1 day', async () => {
    const add = vi.fn().mockResolvedValue('n-1');
    const getUserNotifications = vi.fn().mockResolvedValue([] as NotificationRecord[]);

    await NotificationService.runDeadlineReminderCheck({
      userId: 'user-1',
      applications: [createApplication('2026-01-02')],
      notificationRepo: {
        getUserNotifications,
        add,
        markRead: vi.fn(),
        markAllRead: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      toast: vi.fn(),
    });

    const inAppCall = add.mock.calls.find((call) => call[0].channel === 'in-app');
    expect(inAppCall).toBeTruthy();
    expect(inAppCall?.[0].title).toBe('Urgent: application deadline imminent');
  });

  it('does not duplicate reminders for same severity key', async () => {
    const add = vi.fn().mockResolvedValue('n-1');
    const existing: NotificationRecord[] = [
      {
        id: 'existing-1',
        userId: 'user-1',
        title: 'Urgent: application deadline imminent',
        message: 'existing',
        channel: 'in-app',
        type: 'deadline-reminder',
        entityId: 'app-1',
        dueDate: '2026-01-02',
        createdAt: '2026-01-01T00:00:00.000Z',
        read: false,
      },
    ];

    await NotificationService.runDeadlineReminderCheck({
      userId: 'user-1',
      applications: [createApplication('2026-01-02')],
      notificationRepo: {
        getUserNotifications: vi.fn().mockResolvedValue(existing),
        add,
        markRead: vi.fn(),
        markAllRead: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      toast: vi.fn(),
    });

    expect(add).not.toHaveBeenCalled();
  });

  it('escalates by creating higher-severity reminder', async () => {
    const add = vi.fn().mockResolvedValue('n-2');
    const existing: NotificationRecord[] = [
      {
        id: 'existing-medium',
        userId: 'user-1',
        title: 'Reminder: upcoming application deadline',
        message: 'existing medium',
        channel: 'in-app',
        type: 'deadline-reminder',
        entityId: 'app-1',
        dueDate: '2026-01-03',
        createdAt: '2026-01-01T00:00:00.000Z',
        read: false,
      },
    ];

    await NotificationService.runDeadlineReminderCheck({
      userId: 'user-1',
      applications: [createApplication('2026-01-03')],
      notificationRepo: {
        getUserNotifications: vi.fn().mockResolvedValue(existing),
        add,
        markRead: vi.fn(),
        markAllRead: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      toast: vi.fn(),
    });

    const inAppCall = add.mock.calls.find((call) => call[0].channel === 'in-app');
    expect(inAppCall).toBeTruthy();
    expect(inAppCall?.[0].title).toBe('Important: application deadline approaching');
  });
});
