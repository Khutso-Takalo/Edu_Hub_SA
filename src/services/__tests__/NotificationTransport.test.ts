import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/runtimeEnv', () => ({
  runtimeEnv: {
    notificationWebhookUrl: 'https://example.test/notify',
    notificationEmailWebhookUrl: '',
    notificationSmsWebhookUrl: '',
  },
}));

vi.mock('@/lib/notificationReliabilityConfig', () => ({
  getNotificationReliabilityConfig: () => ({
    maxAttempts: 1,
    baseDelayMs: 100,
    sloTargetPercent: 99,
    circuitBreakerFailureThreshold: 2,
    circuitBreakerCooldownMs: 60_000,
  }),
}));

import { NotificationTransport } from '@/services/NotificationTransport';

function makeResponse(status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
  } as Response;
}

describe('NotificationTransport circuit breaker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-16T10:00:00.000Z'));
    NotificationTransport.resetCircuitBreakers();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    NotificationTransport.resetCircuitBreakers();
    vi.useRealTimers();
  });

  it('opens the circuit after consecutive failures and short-circuits further requests', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(500))
      .mockResolvedValueOnce(makeResponse(500));

    vi.stubGlobal('fetch', fetchMock);

    const first = await NotificationTransport.sendEmail({
      userId: 'user-1',
      title: 't1',
      message: 'm1',
    });

    expect(first.delivered).toBe(false);
    expect(first.circuitBreakerState).toBe('closed');
    expect(first.blockedByCircuitBreaker).toBe(false);

    const second = await NotificationTransport.sendEmail({
      userId: 'user-1',
      title: 't2',
      message: 'm2',
    });

    expect(second.delivered).toBe(false);
    expect(second.circuitBreakerState).toBe('open');
    expect(second.blockedByCircuitBreaker).toBe(true);

    const third = await NotificationTransport.sendEmail({
      userId: 'user-1',
      title: 't3',
      message: 'm3',
    });

    expect(third.delivered).toBe(false);
    expect(third.blockedByCircuitBreaker).toBe(true);
    expect(third.statusCode).toBe(503);
    expect(third.attempts).toBe(0);
    expect((third.cooldownRemainingMs ?? 0) > 0).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('transitions to half-open after cooldown and closes on successful probe', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(500))
      .mockResolvedValueOnce(makeResponse(500))
      .mockResolvedValueOnce(makeResponse(200));

    vi.stubGlobal('fetch', fetchMock);

    await NotificationTransport.sendEmail({ userId: 'user-1', title: 'a', message: 'a' });
    await NotificationTransport.sendEmail({ userId: 'user-1', title: 'b', message: 'b' });

    const blocked = await NotificationTransport.sendEmail({ userId: 'user-1', title: 'c', message: 'c' });
    expect(blocked.blockedByCircuitBreaker).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.setSystemTime(new Date('2026-04-16T10:01:01.000Z'));

    const recovered = await NotificationTransport.sendEmail({ userId: 'user-1', title: 'd', message: 'd' });
    expect(recovered.delivered).toBe(true);
    expect(recovered.circuitBreakerState).toBe('closed');

    const snapshot = NotificationTransport.getCircuitBreakerState('email');
    expect(snapshot?.state).toBe('closed');
    expect(snapshot?.consecutiveFailures).toBe(0);

    const summary = NotificationTransport.getCircuitBreakerIncidentSummary(24);
    expect(summary.email.openedCount).toBe(1);
    expect(summary.email.recoveredCount).toBe(1);
    expect(summary.sms.openedCount).toBe(0);

    const openedTrend = NotificationTransport.getCircuitBreakerIncidentTrend({
      channel: 'email',
      type: 'opened',
      windows: 7,
      windowHours: 24,
    });
    const recoveredTrend = NotificationTransport.getCircuitBreakerIncidentTrend({
      channel: 'email',
      type: 'recovered',
      windows: 7,
      windowHours: 24,
    });

    expect(openedTrend).toHaveLength(7);
    expect(recoveredTrend).toHaveLength(7);
    expect(openedTrend.some((point) => point.rate === 1)).toBe(true);
    expect(recoveredTrend.some((point) => point.rate === 1)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
