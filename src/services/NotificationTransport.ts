import { runtimeEnv } from '@/lib/runtimeEnv';
import { getNotificationReliabilityConfig } from '@/lib/notificationReliabilityConfig';

export type NotificationChannel = 'email' | 'sms';

export interface NotificationDispatchPayload {
  userId: string;
  title: string;
  message: string;
  applicationId?: string;
  dueDate?: string;
}

export interface NotificationDispatchResult {
  channel: NotificationChannel;
  delivered: boolean;
  provider: 'webhook' | 'disabled';
  endpoint?: string;
  attempts: number;
  latencyMs: number;
  statusCode?: number;
  error?: string;
  circuitBreakerState: 'closed' | 'open' | 'half-open';
  blockedByCircuitBreaker?: boolean;
  cooldownRemainingMs?: number;
}

export interface CircuitBreakerIncidentSummary {
  windowHours: number;
  email: {
    openedCount: number;
    recoveredCount: number;
    lastOpenedAt: number | null;
    lastRecoveredAt: number | null;
  };
  sms: {
    openedCount: number;
    recoveredCount: number;
    lastOpenedAt: number | null;
    lastRecoveredAt: number | null;
  };
}

export interface CircuitBreakerIncidentTrendPoint {
  label: string;
  rate: number;
}

interface NotificationDispatchOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
}

interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  consecutiveFailures: number;
  openedAt: number | null;
  halfOpenProbeInFlight: boolean;
  openTransitions: number;
}

interface CircuitBreakerIncidentEvent {
  id: string;
  channel: NotificationChannel;
  endpoint: string;
  type: 'opened' | 'recovered';
  occurredAt: number;
}

const circuitBreakers = new Map<string, CircuitBreakerState>();
const INCIDENT_STORAGE_KEY = 'eduhub:notification-circuit-breaker-incidents:v1';
const MAX_INCIDENT_ENTRIES = 400;

function getNotificationEndpoint(channel: NotificationChannel) {
  if (channel === 'email') {
    return runtimeEnv.notificationEmailWebhookUrl || runtimeEnv.notificationWebhookUrl;
  }

  return runtimeEnv.notificationSmsWebhookUrl || runtimeEnv.notificationWebhookUrl;
}

function isRetriableStatus(statusCode: number) {
  return statusCode === 408 || statusCode === 429 || statusCode >= 500;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function readIncidentEvents(): CircuitBreakerIncidentEvent[] {
  try {
    const raw = localStorage.getItem(INCIDENT_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as CircuitBreakerIncidentEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeIncidentEvents(events: CircuitBreakerIncidentEvent[]) {
  try {
    localStorage.setItem(INCIDENT_STORAGE_KEY, JSON.stringify(events.slice(-MAX_INCIDENT_ENTRIES)));
  } catch {
    // Best effort diagnostics only.
  }
}

function parseCircuitBreakerKey(key: string): { channel: NotificationChannel; endpoint: string } | null {
  const separatorIndex = key.indexOf(':');
  if (separatorIndex === -1) {
    return null;
  }

  const channel = key.slice(0, separatorIndex);
  if (channel !== 'email' && channel !== 'sms') {
    return null;
  }

  return {
    channel,
    endpoint: key.slice(separatorIndex + 1),
  };
}

function appendIncidentEvent(key: string, type: CircuitBreakerIncidentEvent['type']) {
  const parsed = parseCircuitBreakerKey(key);
  if (!parsed) {
    return;
  }

  const events = readIncidentEvents();
  events.push({
    id: `cbi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    channel: parsed.channel,
    endpoint: parsed.endpoint,
    type,
    occurredAt: Date.now(),
  });

  writeIncidentEvents(events);
}

function getCircuitBreakerKey(channel: NotificationChannel, endpoint: string) {
  return `${channel}:${endpoint}`;
}

function getCircuitBreakerState(key: string): CircuitBreakerState {
  const current = circuitBreakers.get(key);
  if (current) {
    return current;
  }

  const initial: CircuitBreakerState = {
    state: 'closed',
    consecutiveFailures: 0,
    openedAt: null,
    halfOpenProbeInFlight: false,
    openTransitions: 0,
  };

  circuitBreakers.set(key, initial);
  return initial;
}

function acquireCircuitBreakerPermit(key: string, cooldownMs: number) {
  const breaker = getCircuitBreakerState(key);
  const now = Date.now();

  if (breaker.state === 'open') {
    const openedAt = breaker.openedAt ?? now;
    const elapsed = now - openedAt;
    if (elapsed < cooldownMs) {
      return {
        allowed: false as const,
        reason: 'circuit_open' as const,
        cooldownRemainingMs: cooldownMs - elapsed,
        state: breaker.state,
      };
    }

    breaker.state = 'half-open';
    breaker.halfOpenProbeInFlight = false;
  }

  if (breaker.state === 'half-open') {
    if (breaker.halfOpenProbeInFlight) {
      return {
        allowed: false as const,
        reason: 'probe_in_flight' as const,
        cooldownRemainingMs: 0,
        state: breaker.state,
      };
    }

    breaker.halfOpenProbeInFlight = true;
  }

  circuitBreakers.set(key, breaker);

  return {
    allowed: true as const,
    state: breaker.state,
  };
}

function releaseCircuitBreakerPermit(key: string) {
  const breaker = getCircuitBreakerState(key);
  if (!breaker.halfOpenProbeInFlight) {
    return;
  }

  breaker.halfOpenProbeInFlight = false;
  circuitBreakers.set(key, breaker);
}

function recordCircuitBreakerSuccess(key: string) {
  const breaker = getCircuitBreakerState(key);
  const wasRecovering = breaker.state === 'open' || breaker.state === 'half-open';

  if (wasRecovering) {
    appendIncidentEvent(key, 'recovered');
  }

  breaker.state = 'closed';
  breaker.consecutiveFailures = 0;
  breaker.openedAt = null;
  breaker.halfOpenProbeInFlight = false;
  circuitBreakers.set(key, breaker);
}

function recordCircuitBreakerFailure(key: string, failureThreshold: number) {
  const breaker = getCircuitBreakerState(key);
  const now = Date.now();
  const wasOpen = breaker.state === 'open';

  if (breaker.state === 'half-open') {
    breaker.state = 'open';
    breaker.openedAt = now;
    breaker.consecutiveFailures = Math.max(failureThreshold, 1);
    breaker.halfOpenProbeInFlight = false;
    breaker.openTransitions += 1;
    appendIncidentEvent(key, 'opened');
    circuitBreakers.set(key, breaker);
    return;
  }

  breaker.consecutiveFailures += 1;
  if (breaker.consecutiveFailures >= failureThreshold) {
    breaker.state = 'open';
    breaker.openedAt = now;
    if (!wasOpen) {
      breaker.openTransitions += 1;
      appendIncidentEvent(key, 'opened');
    }
  } else {
    breaker.state = 'closed';
  }

  breaker.halfOpenProbeInFlight = false;
  circuitBreakers.set(key, breaker);
}

function getCircuitBreakerSnapshot(key: string) {
  const breaker = getCircuitBreakerState(key);
  return {
    state: breaker.state,
    consecutiveFailures: breaker.consecutiveFailures,
    openedAt: breaker.openedAt,
    openTransitions: breaker.openTransitions,
  };
}

async function postNotification(
  channel: NotificationChannel,
  payload: NotificationDispatchPayload,
  options: NotificationDispatchOptions = {}
): Promise<NotificationDispatchResult> {
  const endpoint = getNotificationEndpoint(channel);
  const reliability = getNotificationReliabilityConfig();
  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts ?? reliability.maxAttempts));
  const baseDelayMs = Math.max(100, Math.floor(options.baseDelayMs ?? reliability.baseDelayMs));
  const failureThreshold = Math.max(1, Math.floor(reliability.circuitBreakerFailureThreshold));
  const cooldownMs = Math.max(1000, Math.floor(reliability.circuitBreakerCooldownMs));

  if (!endpoint) {
    return {
      channel,
      delivered: false,
      provider: 'disabled',
      attempts: 0,
      latencyMs: 0,
      error: `${channel} notifications are not configured`,
      circuitBreakerState: 'closed',
    };
  }

  const circuitBreakerKey = getCircuitBreakerKey(channel, endpoint);
  const permit = acquireCircuitBreakerPermit(circuitBreakerKey, cooldownMs);
  if (!permit.allowed) {
    return {
      channel,
      delivered: false,
      provider: 'webhook',
      endpoint,
      attempts: 0,
      latencyMs: 0,
      statusCode: 503,
      error:
        permit.reason === 'probe_in_flight'
          ? 'Circuit breaker half-open probe in progress'
          : `Circuit breaker open for ${channel} delivery`,
      circuitBreakerState: permit.state,
      blockedByCircuitBreaker: true,
      cooldownRemainingMs: permit.cooldownRemainingMs,
    };
  }

  const startedAt = performance.now();
  let attempts = 0;
  let lastStatusCode: number | undefined;
  let lastError: string | undefined;

  while (attempts < maxAttempts) {
    attempts += 1;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel,
          ...payload,
        }),
      });

      lastStatusCode = response.status;

      if (response.ok) {
        recordCircuitBreakerSuccess(circuitBreakerKey);
        const breaker = getCircuitBreakerSnapshot(circuitBreakerKey);
        return {
          channel,
          delivered: true,
          provider: 'webhook',
          endpoint,
          attempts,
          latencyMs: Math.round(performance.now() - startedAt),
          statusCode: response.status,
          circuitBreakerState: breaker.state,
        };
      }

      lastError = `HTTP ${response.status}`;
      if (attempts < maxAttempts && isRetriableStatus(response.status)) {
        await wait(baseDelayMs * Math.pow(2, attempts - 1));
        continue;
      }

      break;
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown transport error';
      if (attempts < maxAttempts) {
        await wait(baseDelayMs * Math.pow(2, attempts - 1));
        continue;
      }
      break;
    }
  }

  recordCircuitBreakerFailure(circuitBreakerKey, failureThreshold);
  const breaker = getCircuitBreakerSnapshot(circuitBreakerKey);
  releaseCircuitBreakerPermit(circuitBreakerKey);

  return {
    channel,
    delivered: false,
    provider: 'webhook',
    endpoint,
    attempts,
    latencyMs: Math.round(performance.now() - startedAt),
    statusCode: lastStatusCode,
    error: lastError || 'Delivery failed',
    circuitBreakerState: breaker.state,
    blockedByCircuitBreaker: breaker.state === 'open',
  };
}

export class NotificationTransport {
  static async sendEmail(payload: NotificationDispatchPayload) {
    return postNotification('email', payload);
  }

  static async sendSms(payload: NotificationDispatchPayload) {
    return postNotification('sms', payload);
  }

  static resetCircuitBreakers() {
    circuitBreakers.clear();
    try {
      localStorage.removeItem(INCIDENT_STORAGE_KEY);
    } catch {
      // Best effort diagnostics only.
    }
  }

  static getCircuitBreakerState(channel: NotificationChannel) {
    const endpoint = getNotificationEndpoint(channel);
    if (!endpoint) {
      return null;
    }

    const key = getCircuitBreakerKey(channel, endpoint);
    return getCircuitBreakerSnapshot(key);
  }

  static getCircuitBreakerIncidentSummary(windowHours = 24): CircuitBreakerIncidentSummary {
    const cutoff = Date.now() - windowHours * 60 * 60 * 1000;
    const events = readIncidentEvents().filter((event) => event.occurredAt >= cutoff);

    const buildSummary = (channel: NotificationChannel) => {
      const channelEvents = events.filter((event) => event.channel === channel);
      const opened = channelEvents.filter((event) => event.type === 'opened');
      const recovered = channelEvents.filter((event) => event.type === 'recovered');

      return {
        openedCount: opened.length,
        recoveredCount: recovered.length,
        lastOpenedAt: opened.length > 0 ? opened[opened.length - 1].occurredAt : null,
        lastRecoveredAt: recovered.length > 0 ? recovered[recovered.length - 1].occurredAt : null,
      };
    };

    return {
      windowHours,
      email: buildSummary('email'),
      sms: buildSummary('sms'),
    };
  }

  static getCircuitBreakerIncidentTrend(input: {
    channel: NotificationChannel;
    type?: 'opened' | 'recovered';
    windows?: number;
    windowHours?: number;
  }): CircuitBreakerIncidentTrendPoint[] {
    const windows = input.windows ?? 7;
    const windowHours = input.windowHours ?? 24;
    const type = input.type ?? 'opened';
    const now = Date.now();
    const windowMs = windowHours * 60 * 60 * 1000;
    const events = readIncidentEvents().filter((event) => event.channel === input.channel && event.type === type);

    return Array.from({ length: windows }, (_, index) => {
      const reverseIndex = windows - 1 - index;
      const windowEnd = now - reverseIndex * windowMs;
      const windowStart = windowEnd - windowMs;
      const count = events.filter((event) => {
        const lowerBound = event.occurredAt >= windowStart;
        const upperBound = reverseIndex === 0 ? event.occurredAt <= windowEnd : event.occurredAt < windowEnd;
        return lowerBound && upperBound;
      }).length;
      const end = new Date(windowEnd);
      const label = `${String(end.getDate()).padStart(2, '0')}/${String(end.getMonth() + 1).padStart(2, '0')}`;

      return {
        label,
        rate: count,
      };
    });
  }
}
