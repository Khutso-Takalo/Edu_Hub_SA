import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  evaluateNotificationAlerts,
  getActiveAlerts,
  getPersistentSloBreachStatus,
  getSupportTickets,
  updateSupportTicketStatus,
} from '@/lib/notificationMonitoring';
import { NotificationTransport } from '@/services/NotificationTransport';

type DeliveryStatus = 'sent' | 'failed' | 'skipped';

const DELIVERY_LOG_KEY = 'eduhub:notification-delivery-log:v1';
const ALERTS_KEY = 'eduhub:notification-alerts:v1';
const SUPPORT_TICKETS_KEY = 'eduhub:support-tickets:v1';

function seedDeliveryLog(entries: Array<{ createdAt: string; status: DeliveryStatus; userId?: string }>) {
  const serialized = entries.map((entry, index) => ({
    id: `nd-test-${index}`,
    userId: entry.userId || 'user-1',
    channel: 'email',
    status: entry.status,
    title: 'Test notification',
    message: 'Test message',
    createdAt: entry.createdAt,
  }));

  localStorage.setItem(DELIVERY_LOG_KEY, JSON.stringify(serialized));
}

describe('notificationMonitoring SLO persistence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-16T12:00:00.000Z'));
    localStorage.removeItem(DELIVERY_LOG_KEY);
    localStorage.removeItem(ALERTS_KEY);
    localStorage.removeItem(SUPPORT_TICKETS_KEY);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.removeItem(DELIVERY_LOG_KEY);
    localStorage.removeItem(ALERTS_KEY);
    localStorage.removeItem(SUPPORT_TICKETS_KEY);
  });

  it('detects persistent SLO breach over 3 consecutive windows', () => {
    seedDeliveryLog([
      { createdAt: '2026-04-16T10:00:00.000Z', status: 'failed' },
      { createdAt: '2026-04-15T10:00:00.000Z', status: 'failed' },
      { createdAt: '2026-04-14T10:00:00.000Z', status: 'failed' },
    ]);

    const status = getPersistentSloBreachStatus({ windowHours: 24, requiredConsecutiveWindows: 3, targetPercent: 99 });

    expect(status.consecutiveBreaches).toBe(3);
    expect(status.isPersistentBreach).toBe(true);
    expect(status.isRecovered).toBe(false);
  });

  it('auto-resolves persistent SLO alert and support ticket after recovery windows', () => {
    seedDeliveryLog([
      { createdAt: '2026-04-16T10:00:00.000Z', status: 'failed' },
      { createdAt: '2026-04-15T10:00:00.000Z', status: 'failed' },
      { createdAt: '2026-04-14T10:00:00.000Z', status: 'failed' },
    ]);

    evaluateNotificationAlerts(true);

    const activeAfterBreach = getActiveAlerts();
    const sloAlert = activeAfterBreach.find((alert) => alert.type === 'slo_breach_persistent');
    expect(sloAlert).toBeTruthy();

    const openTicket = getSupportTickets(10).find((ticket) => ticket.alertType === 'slo_breach_persistent');
    expect(openTicket?.status).toBe('open');

    seedDeliveryLog([
      { createdAt: '2026-04-16T10:00:00.000Z', status: 'sent' },
      { createdAt: '2026-04-15T10:00:00.000Z', status: 'sent' },
      { createdAt: '2026-04-14T10:00:00.000Z', status: 'failed' },
    ]);

    evaluateNotificationAlerts(true);

    const activeAfterRecovery = getActiveAlerts();
    expect(activeAfterRecovery.some((alert) => alert.type === 'slo_breach_persistent')).toBe(false);

    const resolvedTicket = getSupportTickets(10).find((ticket) => ticket.alertType === 'slo_breach_persistent');
    expect(resolvedTicket?.status).toBe('resolved');
    expect(resolvedTicket?.timeline.some((event) => event.type === 'auto_resolved')).toBe(true);
  });

  it('records timeline transitions when ticket is acknowledged, resolved, and reopened', () => {
    seedDeliveryLog([
      { createdAt: '2026-04-16T10:00:00.000Z', status: 'failed' },
      { createdAt: '2026-04-15T10:00:00.000Z', status: 'failed' },
      { createdAt: '2026-04-14T10:00:00.000Z', status: 'failed' },
    ]);

    evaluateNotificationAlerts(true);

    const ticket = getSupportTickets(10).find((row) => row.alertType === 'slo_breach_persistent');
    expect(ticket).toBeTruthy();
    expect(ticket?.timeline.map((event) => event.type)).toEqual(['created']);

    expect(updateSupportTicketStatus(ticket!.id, 'acknowledged')).toBe(true);
    expect(updateSupportTicketStatus(ticket!.id, 'resolved')).toBe(true);
    expect(updateSupportTicketStatus(ticket!.id, 'open')).toBe(true);

    const updatedTicket = getSupportTickets(10).find((row) => row.id === ticket!.id);
    expect(updatedTicket?.status).toBe('open');
    expect(updatedTicket?.timeline.map((event) => event.type)).toEqual([
      'created',
      'acknowledged',
      'resolved',
      'reopened',
    ]);
  });

  it('raises and auto-resolves persistent circuit breaker alert', () => {
    const transportSpy = vi
      .spyOn(NotificationTransport, 'getCircuitBreakerState')
      .mockImplementation((channel) => {
        if (channel === 'email') {
          return {
            state: 'open',
            consecutiveFailures: 5,
            openedAt: Date.now() - 130_000,
            openTransitions: 3,
          };
        }

        return {
          state: 'closed',
          consecutiveFailures: 0,
          openedAt: null,
          openTransitions: 0,
        };
      });

    evaluateNotificationAlerts(true);

    const breakerAlert = getActiveAlerts().find((alert) => alert.type === 'circuit_breaker_open_persistent');
    expect(breakerAlert).toBeTruthy();
    expect(breakerAlert?.severity).toBe('critical');

    const breakerTicket = getSupportTickets(10).find((ticket) => ticket.alertType === 'circuit_breaker_open_persistent');
    expect(breakerTicket?.status).toBe('open');

    transportSpy.mockImplementation(() => ({
      state: 'closed',
      consecutiveFailures: 0,
      openedAt: null,
      openTransitions: 3,
    }));

    evaluateNotificationAlerts(true);

    expect(getActiveAlerts().some((alert) => alert.type === 'circuit_breaker_open_persistent')).toBe(false);
    const resolvedTicket = getSupportTickets(10).find((ticket) => ticket.alertType === 'circuit_breaker_open_persistent');
    expect(resolvedTicket?.status).toBe('resolved');
  });
});
