import type { Alert } from './alerting';
import { runtimeEnv } from './runtimeEnv';
import { getNotificationReliabilityConfig } from './notificationReliabilityConfig';
import {
  evaluateFailureRateAlert,
  evaluateConsecutiveFailureAlert,
  createWebhookUnconfiguredAlert,
  createPersistentSloBreachAlert,
  createPersistentCircuitBreakerAlert,
  resolveAlert,
  isAlertActive,
} from './alerting';
import { NotificationTransport } from '@/services/NotificationTransport';

export type NotificationDeliveryChannel = 'in-app' | 'email' | 'sms';
export type NotificationDeliveryStatus = 'sent' | 'failed' | 'skipped';

export interface NotificationDeliveryLogEntry {
  id: string;
  userId: string;
  channel: NotificationDeliveryChannel;
  status: NotificationDeliveryStatus;
  title: string;
  message: string;
  applicationId?: string;
  provider?: string;
  details?: string;
  createdAt: string;
}

const STORAGE_KEY = 'eduhub:notification-delivery-log:v1';
const ALERTS_STORAGE_KEY = 'eduhub:notification-alerts:v1';
const SUPPORT_TICKETS_STORAGE_KEY = 'eduhub:support-tickets:v1';
const DEAD_LETTER_STORAGE_KEY = 'eduhub:notification-dead-letter:v1';
const MAX_LOG_ENTRIES = 500;
const MAX_ALERT_ENTRIES = 50;
const MAX_SUPPORT_TICKETS = 100;
const MAX_DEAD_LETTER_ENTRIES = 200;

export interface SupportTicket {
  id: string;
  alertId: string;
  alertType: Alert['type'];
  severity: Alert['severity'];
  status: 'open' | 'acknowledged' | 'resolved';
  summary: string;
  details: string;
  createdAt: string;
  updatedAt: string;
  timeline: SupportTicketTimelineEvent[];
}

export interface SupportTicketTimelineEvent {
  id: string;
  type: 'created' | 'acknowledged' | 'resolved' | 'reopened' | 'auto_resolved';
  status: SupportTicket['status'];
  createdAt: string;
  actor: 'system' | 'admin';
  note?: string;
}

export interface NotificationDeadLetterEntry {
  id: string;
  userId: string;
  channel: 'email' | 'sms';
  applicationId?: string;
  title: string;
  message: string;
  attempts: number;
  error: string;
  statusCode?: number;
  endpoint?: string;
  createdAt: string;
}

function readLog(): NotificationDeliveryLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as NotificationDeliveryLogEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLog(entries: NotificationDeliveryLogEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_LOG_ENTRIES)));
  } catch {
    // Monitoring must never block notifications.
  }
}

export function appendNotificationDeliveryLog(entry: Omit<NotificationDeliveryLogEntry, 'id' | 'createdAt'>) {
  const logEntry: NotificationDeliveryLogEntry = {
    ...entry,
    id: `nd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };

  const entries = readLog();
  entries.push(logEntry);
  writeLog(entries);
  return logEntry;
}

export function getNotificationDeliveryLog(limit = 100) {
  return readLog().slice(-limit).reverse();
}

export function getNotificationDeliverySummary() {
  const entries = readLog();
  const summary = {
    total: entries.length,
    sent: 0,
    failed: 0,
    skipped: 0,
    byChannel: {
      'in-app': 0,
      email: 0,
      sms: 0,
    },
    lastSentAt: null as string | null,
    lastFailure: null as NotificationDeliveryLogEntry | null,
  };

  for (const entry of entries) {
    summary.byChannel[entry.channel] += 1;
    summary[entry.status] += 1;

    if (entry.status === 'sent') {
      if (!summary.lastSentAt || entry.createdAt > summary.lastSentAt) {
        summary.lastSentAt = entry.createdAt;
      }
    }

    if (entry.status === 'failed') {
      if (!summary.lastFailure || entry.createdAt > summary.lastFailure.createdAt) {
        summary.lastFailure = entry;
      }
    }
  }

  return summary;
}

// ============= ALERT MANAGEMENT =============

function readAlerts(): Alert[] {
  try {
    const raw = localStorage.getItem(ALERTS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as Alert[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAlerts(alerts: Alert[]) {
  try {
    localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(alerts.slice(-MAX_ALERT_ENTRIES)));
  } catch {
    // Monitoring must never block
  }
}

function resolveActiveAlertsByType(type: Alert['type']) {
  const alerts = readAlerts();
  let changed = false;

  const updated = alerts.map((alert) => {
    if (alert.type !== type || alert.resolvedAt) {
      return alert;
    }

    changed = true;
    return resolveAlert(alert);
  });

  if (changed) {
    writeAlerts(updated);
  }

  return changed;
}

function readSupportTickets(): SupportTicket[] {
  try {
    const raw = localStorage.getItem(SUPPORT_TICKETS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as Array<SupportTicket & { timeline?: SupportTicketTimelineEvent[] }>;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((ticket) => {
      if (Array.isArray(ticket.timeline) && ticket.timeline.length > 0) {
        return ticket as SupportTicket;
      }

      return {
        ...ticket,
        timeline: [
          createSupportTicketTimelineEvent({
            type: 'created',
            status: ticket.status,
            actor: 'system',
            createdAt: ticket.createdAt,
            note: 'Ticket created before timeline support was enabled.',
          }),
        ],
      };
    });
  } catch {
    return [];
  }
}

function writeSupportTickets(tickets: SupportTicket[]) {
  try {
    localStorage.setItem(SUPPORT_TICKETS_STORAGE_KEY, JSON.stringify(tickets.slice(-MAX_SUPPORT_TICKETS)));
  } catch {
    // Monitoring must never block
  }
}

function resolveOpenSupportTicketsByAlertType(type: Alert['type']) {
  const tickets = readSupportTickets();
  let changed = false;

  const updated = tickets.map((ticket) => {
    if (ticket.alertType !== type || ticket.status === 'resolved') {
      return ticket;
    }

    changed = true;
    return applySupportTicketStatusTransition(ticket, 'resolved', {
      actor: 'system',
      eventType: 'auto_resolved',
      note: 'Automatically resolved after SLO recovery windows were healthy.',
    });
  });

  if (changed) {
    writeSupportTickets(updated);
  }

  return changed;
}

function readDeadLetters(): NotificationDeadLetterEntry[] {
  try {
    const raw = localStorage.getItem(DEAD_LETTER_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as NotificationDeadLetterEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeDeadLetters(entries: NotificationDeadLetterEntry[]) {
  try {
    localStorage.setItem(DEAD_LETTER_STORAGE_KEY, JSON.stringify(entries.slice(-MAX_DEAD_LETTER_ENTRIES)));
  } catch {
    // Monitoring must never block
  }
}

function appendSupportTicket(ticket: SupportTicket) {
  const tickets = readSupportTickets();
  tickets.push(ticket);
  writeSupportTickets(tickets);
}

function createSupportTicketTimelineEvent(input: {
  type: SupportTicketTimelineEvent['type'];
  status: SupportTicket['status'];
  actor: SupportTicketTimelineEvent['actor'];
  createdAt?: string;
  note?: string;
}): SupportTicketTimelineEvent {
  return {
    id: `ste-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: input.type,
    status: input.status,
    createdAt: input.createdAt ?? new Date().toISOString(),
    actor: input.actor,
    note: input.note,
  };
}

function getSupportTicketEventType(
  fromStatus: SupportTicket['status'],
  toStatus: SupportTicket['status']
): SupportTicketTimelineEvent['type'] {
  if (toStatus === 'open' && fromStatus === 'resolved') {
    return 'reopened';
  }

  if (toStatus === 'acknowledged') {
    return 'acknowledged';
  }

  return 'resolved';
}

function applySupportTicketStatusTransition(
  ticket: SupportTicket,
  status: SupportTicket['status'],
  input?: {
    actor?: SupportTicketTimelineEvent['actor'];
    eventType?: SupportTicketTimelineEvent['type'];
    note?: string;
  }
): SupportTicket {
  const updatedAt = new Date().toISOString();
  const eventType = input?.eventType ?? getSupportTicketEventType(ticket.status, status);

  return {
    ...ticket,
    status,
    updatedAt,
    timeline: [
      ...(ticket.timeline || []),
      createSupportTicketTimelineEvent({
        type: eventType,
        status,
        actor: input?.actor ?? 'admin',
        createdAt: updatedAt,
        note: input?.note,
      }),
    ],
  };
}

function escalateAlertToSupport(alert: Alert): SupportTicket {
  const now = new Date().toISOString();
  const ticket: SupportTicket = {
    id: `st-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    alertId: alert.id,
    alertType: alert.type,
    severity: alert.severity,
    status: 'open',
    summary: alert.title,
    details: alert.message,
    createdAt: now,
    updatedAt: now,
    timeline: [
      createSupportTicketTimelineEvent({
        type: 'created',
        status: 'open',
        actor: 'system',
        createdAt: now,
        note: 'Escalated from active alert.',
      }),
    ],
  };

  appendSupportTicket(ticket);
  return ticket;
}

function maybeCreateEscalationTicket(alert: Alert) {
  const shouldEscalate = alert.severity === 'critical' || alert.type === 'consecutive_failures';
  if (!shouldEscalate) {
    return null;
  }

  const existing = readSupportTickets().find(
    (ticket) => ticket.alertId === alert.id || (ticket.status !== 'resolved' && ticket.alertType === alert.type)
  );

  if (existing) {
    return existing;
  }

  return escalateAlertToSupport(alert);
}

function buildConsecutiveFailureAlerts(entries: NotificationDeliveryLogEntry[]) {
  const latestByUser = new Map<string, number>();

  const sortedEntries = [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const entry of sortedEntries) {
    if (!entry.userId) {
      continue;
    }

    const current = latestByUser.get(entry.userId) ?? 0;
    if (entry.status === 'failed') {
      latestByUser.set(entry.userId, current + 1);
      continue;
    }

    if (entry.status === 'sent') {
      latestByUser.set(entry.userId, 0);
    }
  }

  return [...latestByUser.entries()]
    .map(([userId, consecutiveCount]) => evaluateConsecutiveFailureAlert(consecutiveCount, userId))
    .filter((alert): alert is Alert => Boolean(alert));
}

function getPersistentCircuitBreakerStatus(input: { minCooldownCycles?: number; minOpenTransitions?: number } = {}) {
  const config = getNotificationReliabilityConfig();
  const minCooldownCycles = input.minCooldownCycles ?? 2;
  const minOpenTransitions = input.minOpenTransitions ?? 3;
  const channels: Array<'email' | 'sms'> = ['email', 'sms'];
  const now = Date.now();
  const persistentChannels: Array<'email' | 'sms'> = [];
  let highestCycleCount = 0;

  for (const channel of channels) {
    const state = NotificationTransport.getCircuitBreakerState(channel);
    if (!state || state.state !== 'open' || !state.openedAt) {
      continue;
    }

    const openDurationMs = Math.max(0, now - state.openedAt);
    const cooldownCycles = Math.floor(openDurationMs / config.circuitBreakerCooldownMs);
    const isPersistent = cooldownCycles >= minCooldownCycles || state.openTransitions >= minOpenTransitions;

    if (!isPersistent) {
      continue;
    }

    highestCycleCount = Math.max(highestCycleCount, cooldownCycles);
    persistentChannels.push(channel);
  }

  return {
    isPersistent: persistentChannels.length > 0,
    channels: persistentChannels,
    highestCycleCount,
  };
}

/**
 * Append a new alert to the alert log
 */
export function appendAlert(alert: Alert) {
  const alerts = readAlerts();
  alerts.push(alert);
  writeAlerts(alerts);
}

/**
 * Get all active alerts (not resolved)
 */
export function getActiveAlerts(): Alert[] {
  return readAlerts().filter(isAlertActive);
}

/**
 * Get recent alerts with limit
 */
export function getRecentAlerts(limit = 10): Alert[] {
  return readAlerts().slice(-limit).reverse();
}

export function appendDeadLetterEntry(entry: Omit<NotificationDeadLetterEntry, 'id' | 'createdAt'>) {
  const next: NotificationDeadLetterEntry = {
    ...entry,
    id: `dl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };

  const entries = readDeadLetters();
  entries.push(next);
  writeDeadLetters(entries);
  return next;
}

export function getDeadLetterEntries(limit = 20) {
  return readDeadLetters().slice(-limit).reverse();
}

export function getDeliverySloSummary(windowHours = 24, targetPercent = getNotificationReliabilityConfig().sloTargetPercent) {
  const entries = readLog();
  const cutoff = Date.now() - windowHours * 60 * 60 * 1000;
  const windowEntries = entries.filter((entry) => new Date(entry.createdAt).getTime() >= cutoff);
  const deliveryEntries = windowEntries.filter((entry) => entry.channel === 'email' || entry.channel === 'sms');
  const delivered = deliveryEntries.filter((entry) => entry.status === 'sent').length;
  const failed = deliveryEntries.filter((entry) => entry.status === 'failed').length;
  const skipped = deliveryEntries.filter((entry) => entry.status === 'skipped').length;
  const total = delivered + failed + skipped;
  const availability = total > 0 ? Math.round((delivered / total) * 1000) / 10 : 100;
  const target = targetPercent;

  return {
    windowHours,
    total,
    delivered,
    failed,
    skipped,
    availability,
    target,
    isBreaching: availability < target,
    errorBudgetRemaining: Math.max(0, Math.round((target - (100 - availability)) * 10) / 10),
  };
}

export function getChannelDeliverySloSummary(
  windowHours = 24,
  targetPercent = getNotificationReliabilityConfig().sloTargetPercent
) {
  const entries = readLog();
  const cutoff = Date.now() - windowHours * 60 * 60 * 1000;
  const deliveryEntries = entries.filter((entry) => {
    const timestamp = new Date(entry.createdAt).getTime();
    return timestamp >= cutoff && (entry.channel === 'email' || entry.channel === 'sms');
  });

  const buildSummary = (channel: 'email' | 'sms') => {
    const scoped = deliveryEntries.filter((entry) => entry.channel === channel);
    const delivered = scoped.filter((entry) => entry.status === 'sent').length;
    const failed = scoped.filter((entry) => entry.status === 'failed').length;
    const skipped = scoped.filter((entry) => entry.status === 'skipped').length;
    const total = delivered + failed + skipped;
    const availability = total > 0 ? Math.round((delivered / total) * 1000) / 10 : 100;

    return {
      channel,
      total,
      delivered,
      failed,
      skipped,
      availability,
      target: targetPercent,
      isBreaching: availability < targetPercent,
    };
  };

  return {
    email: buildSummary('email'),
    sms: buildSummary('sms'),
  };
}

function getDeliverySloSummaryForWindow(
  windowHours = 24,
  offsetWindows = 0,
  targetPercent = getNotificationReliabilityConfig().sloTargetPercent,
  channel: 'email' | 'sms' | 'all' = 'all'
) {
  const entries = readLog();
  const now = Date.now();
  const windowMs = windowHours * 60 * 60 * 1000;
  const windowEnd = now - offsetWindows * windowMs;
  const windowStart = windowEnd - windowMs;
  const windowEntries = entries.filter((entry) => {
    const timestamp = new Date(entry.createdAt).getTime();
    return timestamp >= windowStart && timestamp < windowEnd;
  });

  const deliveryEntries = windowEntries.filter((entry) => {
    if (channel === 'all') {
      return entry.channel === 'email' || entry.channel === 'sms';
    }
    return entry.channel === channel;
  });
  const delivered = deliveryEntries.filter((entry) => entry.status === 'sent').length;
  const failed = deliveryEntries.filter((entry) => entry.status === 'failed').length;
  const skipped = deliveryEntries.filter((entry) => entry.status === 'skipped').length;
  const total = delivered + failed + skipped;
  const availability = total > 0 ? Math.round((delivered / total) * 1000) / 10 : 100;

  return {
    windowHours,
    offsetWindows,
    total,
    delivered,
    failed,
    skipped,
    availability,
    target: targetPercent,
    isBreaching: availability < targetPercent,
  };
}

export function getDeliverySloTrend(input: {
  windows?: number;
  windowHours?: number;
  targetPercent?: number;
  channel?: 'email' | 'sms' | 'all';
} = {}) {
  const windows = input.windows ?? 7;
  const windowHours = input.windowHours ?? 24;
  const targetPercent = input.targetPercent ?? getNotificationReliabilityConfig().sloTargetPercent;
  const channel = input.channel ?? 'all';

  const points = Array.from({ length: windows }, (_, index) => {
    const reverseIndex = windows - 1 - index;
    const summary = getDeliverySloSummaryForWindow(windowHours, reverseIndex, targetPercent, channel);
    const end = new Date(Date.now() - reverseIndex * windowHours * 60 * 60 * 1000);
    const label = `${String(end.getDate()).padStart(2, '0')}/${String(end.getMonth() + 1).padStart(2, '0')}`;

    return {
      label,
      rate: summary.availability,
    };
  });

  return points;
}

export function getPersistentSloBreachStatus(
  input: { windowHours?: number; requiredConsecutiveWindows?: number; targetPercent?: number } = {}
) {
  const windowHours = input.windowHours ?? 24;
  const requiredConsecutiveWindows = input.requiredConsecutiveWindows ?? 3;
  const requiredHealthyWindows = 2;
  const targetPercent = input.targetPercent ?? getNotificationReliabilityConfig().sloTargetPercent;

  const windowCount = Math.max(requiredConsecutiveWindows, requiredHealthyWindows);
  const windows = Array.from({ length: windowCount }, (_, index) =>
    getDeliverySloSummaryForWindow(windowHours, index, targetPercent)
  );

  let consecutiveBreaches = 0;
  for (const windowSummary of windows) {
    if (windowSummary.isBreaching) {
      consecutiveBreaches += 1;
      continue;
    }
    break;
  }

  let consecutiveHealthy = 0;
  for (const windowSummary of windows) {
    if (!windowSummary.isBreaching) {
      consecutiveHealthy += 1;
      continue;
    }
    break;
  }

  return {
    windowHours,
    requiredConsecutiveWindows,
    requiredHealthyWindows,
    consecutiveBreaches,
    consecutiveHealthy,
    isPersistentBreach: consecutiveBreaches >= requiredConsecutiveWindows,
    isRecovered: consecutiveHealthy >= requiredHealthyWindows,
    windows,
  };
}

export function getSupportTickets(limit = 20): SupportTicket[] {
  return readSupportTickets().slice(-limit).reverse();
}

export function getOpenSupportTickets(limit = 20): SupportTicket[] {
  return getSupportTickets(limit).filter((ticket) => ticket.status !== 'resolved');
}

export function updateSupportTicketStatus(ticketId: string, status: SupportTicket['status']) {
  const tickets = readSupportTickets();
  const index = tickets.findIndex((ticket) => ticket.id === ticketId);
  if (index === -1) {
    return false;
  }

  if (tickets[index].status === status) {
    return true;
  }

  tickets[index] = applySupportTicketStatusTransition(tickets[index], status, {
    actor: 'admin',
  });

  writeSupportTickets(tickets);
  return true;
}

/**
 * Evaluate and update alerts based on current delivery metrics
 * Returns newly triggered alerts
 */
export function evaluateNotificationAlerts(isWebhookConfigured: boolean): Alert[] {
  const summary = getNotificationDeliverySummary();
  const entries = readLog();
  const newAlerts: Alert[] = [];
  const activeAlerts = getActiveAlerts();
  const persistentSloStatus = getPersistentSloBreachStatus();
  const persistentCircuitBreakerStatus = getPersistentCircuitBreakerStatus();

  const pushAlert = (alert: Alert) => {
    const ticket = maybeCreateEscalationTicket(alert);
    const alertWithTicket = ticket ? { ...alert, supportTicketId: ticket.id } : alert;
    newAlerts.push(alertWithTicket);
    appendAlert(alertWithTicket);
  };

  // Check failure rate alert
  const failureRateAlert = evaluateFailureRateAlert(summary.total, summary.failed);
  if (failureRateAlert) {
    const existingFailureAlert = activeAlerts.find((a) => a.type === 'failure_rate_high');
    if (!existingFailureAlert) {
      pushAlert(failureRateAlert);
    }
  }

  // Check consecutive user failures
  const consecutiveFailureAlerts = buildConsecutiveFailureAlerts(entries);
  for (const alert of consecutiveFailureAlerts) {
    const exists = activeAlerts.find((active) => active.type === 'consecutive_failures' && active.data.userId === alert.data.userId);
    if (!exists) {
      pushAlert(alert);
    }
  }

  // Check webhook configuration alert
  if (!isWebhookConfigured) {
    const existingWebhookAlert = activeAlerts.find((a) => a.type === 'webhook_unconfigured');
    if (!existingWebhookAlert) {
      const webhookAlert = createWebhookUnconfiguredAlert();
      pushAlert(webhookAlert);
    }
  }

  // Check persistent SLO breach alert
  if (persistentSloStatus.isPersistentBreach) {
    const existingSloAlert = activeAlerts.find((a) => a.type === 'slo_breach_persistent');
    if (!existingSloAlert) {
      const currentWindow = persistentSloStatus.windows[0];
      const sloAlert = createPersistentSloBreachAlert({
        consecutiveBreachWindows: persistentSloStatus.consecutiveBreaches,
        availability: currentWindow?.availability ?? 0,
        target: currentWindow?.target ?? getNotificationReliabilityConfig().sloTargetPercent,
        windowHours: persistentSloStatus.windowHours,
      });
      pushAlert(sloAlert);
    }
  } else if (persistentSloStatus.isRecovered) {
    resolveActiveAlertsByType('slo_breach_persistent');
    resolveOpenSupportTicketsByAlertType('slo_breach_persistent');
  }

  if (persistentCircuitBreakerStatus.isPersistent) {
    const existingCircuitAlert = activeAlerts.find((a) => a.type === 'circuit_breaker_open_persistent');
    if (!existingCircuitAlert) {
      const circuitAlert = createPersistentCircuitBreakerAlert({
        channels: persistentCircuitBreakerStatus.channels,
        cooldownCycles: Math.max(2, persistentCircuitBreakerStatus.highestCycleCount),
      });
      pushAlert(circuitAlert);
    }
  } else {
    resolveActiveAlertsByType('circuit_breaker_open_persistent');
    resolveOpenSupportTicketsByAlertType('circuit_breaker_open_persistent');
  }

  return newAlerts;
}

/**
 * Clear resolved alerts older than 1 hour
 */
export function pruneOldResolvedAlerts() {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const alerts = readAlerts();
  const pruned = alerts.filter((alert) => {
    // Keep unresolved alerts
    if (!alert.resolvedAt) return true;
    // Keep recently resolved alerts
    if (alert.resolvedAt > oneHourAgo) return true;
    // Prune old resolved alerts
    return false;
  });
  writeAlerts(pruned);
}

