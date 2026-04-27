import type { Application, NotificationRecord } from '@/infrastructure/database/indexeddb/schema';
import type { NotificationRepository } from '@/contexts/DatabaseProvider';
import { NotificationTransport } from '@/services/NotificationTransport';
import { appendDeadLetterEntry, appendNotificationDeliveryLog } from '@/lib/notificationMonitoring';
import { runtimeEnvStatus } from '@/lib/runtimeEnv';

interface NotificationServiceOptions {
  userId: string;
  applications: Application[];
  notificationRepo: NotificationRepository;
  toast: (input: { title: string; description: string }) => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const REMINDER_WINDOW_DAYS = 7;

type ReminderSeverity = 'medium' | 'high' | 'critical';

function getReminderSeverity(daysLeft: number): ReminderSeverity {
  if (daysLeft <= 1) return 'critical';
  if (daysLeft <= 3) return 'high';
  return 'medium';
}

function getReminderTitle(severity: ReminderSeverity) {
  if (severity === 'critical') return 'Urgent: application deadline imminent';
  if (severity === 'high') return 'Important: application deadline approaching';
  return 'Reminder: upcoming application deadline';
}

async function deliverEmailReminder(input: {
  userId: string;
  title: string;
  message: string;
  applicationId: string;
  dueDate: string;
}) {
  const result = await NotificationTransport.sendEmail({
    userId: input.userId,
    title: input.title,
    message: input.message,
    applicationId: input.applicationId,
    dueDate: input.dueDate,
  });

  appendNotificationDeliveryLog({
    userId: input.userId,
    channel: 'email',
    status: result.delivered ? 'sent' : result.provider === 'disabled' ? 'skipped' : 'failed',
    title: input.title,
    message: input.message,
    applicationId: input.applicationId,
    provider: result.provider,
    details:
      result.error ||
      [
        typeof result.statusCode === 'number' ? `HTTP ${result.statusCode}` : null,
        typeof result.attempts === 'number' ? `attempts:${result.attempts}` : null,
        typeof result.latencyMs === 'number' ? `latency:${result.latencyMs}ms` : null,
      ]
        .filter(Boolean)
        .join(' | '),
  });

  if (!result.delivered && result.provider === 'webhook') {
    appendDeadLetterEntry({
      userId: input.userId,
      channel: 'email',
      applicationId: input.applicationId,
      title: input.title,
      message: input.message,
      attempts: result.attempts,
      error: result.error || 'Webhook delivery failed',
      statusCode: result.statusCode,
      endpoint: result.endpoint,
    });
  }

  return result;
}

async function deliverSmsReminder(input: {
  userId: string;
  title: string;
  message: string;
  applicationId: string;
  dueDate: string;
}) {
  const result = await NotificationTransport.sendSms({
    userId: input.userId,
    title: input.title,
    message: input.message,
    applicationId: input.applicationId,
    dueDate: input.dueDate,
  });

  appendNotificationDeliveryLog({
    userId: input.userId,
    channel: 'sms',
    status: result.delivered ? 'sent' : result.provider === 'disabled' ? 'skipped' : 'failed',
    title: input.title,
    message: input.message,
    applicationId: input.applicationId,
    provider: result.provider,
    details:
      result.error ||
      [
        typeof result.statusCode === 'number' ? `HTTP ${result.statusCode}` : null,
        typeof result.attempts === 'number' ? `attempts:${result.attempts}` : null,
        typeof result.latencyMs === 'number' ? `latency:${result.latencyMs}ms` : null,
      ]
        .filter(Boolean)
        .join(' | '),
  });

  if (!result.delivered && result.provider === 'webhook') {
    appendDeadLetterEntry({
      userId: input.userId,
      channel: 'sms',
      applicationId: input.applicationId,
      title: input.title,
      message: input.message,
      attempts: result.attempts,
      error: result.error || 'Webhook delivery failed',
      statusCode: result.statusCode,
      endpoint: result.endpoint,
    });
  }

  return result;
}

export class NotificationService {
  static async runDeadlineReminderCheck(options: NotificationServiceOptions) {
    const { userId, applications, notificationRepo, toast } = options;
    const now = Date.now();
    const windowEnd = now + REMINDER_WINDOW_DAYS * DAY_MS;

    const existing = (await notificationRepo.getUserNotifications(userId)) as NotificationRecord[];
    const keys = new Set(
      existing
        .filter((item) => item.type === 'deadline-reminder')
        .map((item) => `${item.entityId}:${item.dueDate}:${item.title}`)
    );

    let deliveredCount = 0;
    let failedCount = 0;

    for (const application of applications) {
      if (!application.deadlineDate) {
        continue;
      }

      const deadlineMs = new Date(application.deadlineDate).getTime();
      if (Number.isNaN(deadlineMs) || deadlineMs < now || deadlineMs > windowEnd) {
        continue;
      }

      const daysLeft = Math.max(1, Math.ceil((deadlineMs - now) / DAY_MS));
      const severity = getReminderSeverity(daysLeft);
      const title = getReminderTitle(severity);
      const key = `${application.id}:${application.deadlineDate}:${title}`;
      if (keys.has(key)) {
        continue;
      }

      const message =
        severity === 'critical'
          ? `A tracked application is due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Complete documents and submit immediately.`
          : severity === 'high'
          ? `A tracked application is due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Prioritize remaining checklist items.`
          : `A tracked application is due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Keep your preparation on track.`;

      await notificationRepo.add({
        userId,
        title,
        message,
        channel: 'in-app',
        type: 'deadline-reminder',
        entityId: application.id,
        dueDate: application.deadlineDate,
        read: false,
      });

      const [emailResult, smsResult] = await Promise.all([
        deliverEmailReminder({
          userId,
          title,
          message,
          applicationId: application.id,
          dueDate: application.deadlineDate,
        }),
        deliverSmsReminder({
          userId,
          title,
          message,
          applicationId: application.id,
          dueDate: application.deadlineDate,
        }),
      ]);

      await notificationRepo.add({
        userId,
        title: runtimeEnvStatus.isNotificationConfigured ? title : `[Email pending] ${title}`,
        message,
        channel: 'email',
        type: 'deadline-reminder',
        entityId: application.id,
        dueDate: application.deadlineDate,
        read: false,
      });

      await notificationRepo.add({
        userId,
        title: runtimeEnvStatus.isNotificationConfigured ? title : `[SMS pending] ${title}`,
        message,
        channel: 'sms',
        type: 'deadline-reminder',
        entityId: application.id,
        dueDate: application.deadlineDate,
        read: false,
      });

      if (emailResult.delivered || smsResult.delivered) {
        deliveredCount += 1;
      } else {
        failedCount += 1;
      }

      toast({ title, description: message });
      keys.add(key);
    }

    localStorage.setItem('eduhub:lastNotificationCheck', new Date().toISOString());
    localStorage.setItem(
      'eduhub:lastNotificationSummary',
      JSON.stringify({
        checkedAt: new Date().toISOString(),
        deliveredCount,
        failedCount,
        configured: runtimeEnvStatus.isNotificationConfigured,
      })
    );
  }
}
