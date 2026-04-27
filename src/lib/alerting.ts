/**
 * Alert thresholds and evaluation for system health monitoring
 */

export type AlertType =
  | 'failure_rate_high'
  | 'consecutive_failures'
  | 'webhook_unconfigured'
  | 'provider_down'
  | 'slo_breach_persistent'
  | 'circuit_breaker_open_persistent';
export type AlertSeverity = 'warning' | 'critical';

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  triggeredAt: number;
  resolvedAt?: number;
  supportTicketId?: string;
  data: {
    failureRate?: number;
    userId?: string;
    consecutiveCount?: number;
    provider?: string;
    sloAvailability?: number;
    sloTarget?: number;
    consecutiveBreachWindows?: number;
    channels?: string[];
    openCycleCount?: number;
  };
}

export interface AlertThresholds {
  failureRateThreshold: number; // 0-100, default 20%
  consecutiveFailureThreshold: number; // default 3
  enableWebhookConfigWarning: boolean; // default true
}

const DEFAULT_THRESHOLDS: AlertThresholds = {
  failureRateThreshold: 20,
  consecutiveFailureThreshold: 3,
  enableWebhookConfigWarning: true,
};

/**
 * Get stored alert thresholds from localStorage or defaults
 */
export function getAlertThresholds(): AlertThresholds {
  try {
    const stored = localStorage.getItem('eduhub:alert-thresholds:v1');
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<AlertThresholds>;
      return { ...DEFAULT_THRESHOLDS, ...parsed };
    }
  } catch {
    // Ignore parsing errors
  }
  return DEFAULT_THRESHOLDS;
}

/**
 * Update alert thresholds
 */
export function setAlertThresholds(thresholds: Partial<AlertThresholds>) {
  try {
    const current = getAlertThresholds();
    const updated = { ...current, ...thresholds };
    localStorage.setItem('eduhub:alert-thresholds:v1', JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Evaluate delivery failure rate and return alert if threshold exceeded
 * @param total Total delivery attempts
 * @param failed Failed delivery count
 * @param thresholds Current alert thresholds
 */
export function evaluateFailureRateAlert(
  total: number,
  failed: number,
  thresholds = getAlertThresholds()
): Alert | null {
  if (total === 0) return null;

  const failureRate = Math.round((failed / total) * 100);
  const isHigh = failureRate > thresholds.failureRateThreshold;

  if (!isHigh) return null;

  return {
    id: `alert-failure-rate-${Date.now()}`,
    type: 'failure_rate_high',
    severity: failureRate > 50 ? 'critical' : 'warning',
    title: 'High notification failure rate',
    message: `${failureRate}% of notifications failed to deliver (threshold: ${thresholds.failureRateThreshold}%)`,
    triggeredAt: Date.now(),
    data: { failureRate },
  };
}

/**
 * Evaluate consecutive failures for a user and return alert if threshold exceeded
 * @param consecutiveCount Number of consecutive failures
 * @param userId User ID for context
 * @param thresholds Current alert thresholds
 */
export function evaluateConsecutiveFailureAlert(
  consecutiveCount: number,
  userId: string,
  thresholds = getAlertThresholds()
): Alert | null {
  if (consecutiveCount < thresholds.consecutiveFailureThreshold) return null;

  return {
    id: `alert-consecutive-failures-${userId}-${Date.now()}`,
    type: 'consecutive_failures',
    severity: consecutiveCount >= 5 ? 'critical' : 'warning',
    title: 'Repeated delivery failures for user',
    message: `User ${userId} has ${consecutiveCount} consecutive failed delivery attempts`,
    triggeredAt: Date.now(),
    data: { userId, consecutiveCount },
  };
}

/**
 * Create webhook unconfigured alert
 */
export function createWebhookUnconfiguredAlert(): Alert {
  return {
    id: `alert-webhook-unconfigured-${Date.now()}`,
    type: 'webhook_unconfigured',
    severity: 'warning',
    title: 'Notification webhooks not configured',
    message: 'Email and SMS notifications are disabled. Configure webhook URLs in environment variables to enable delivery.',
    triggeredAt: Date.now(),
    data: {},
  };
}

/**
 * Create provider-specific alert
 */
export function createProviderDownAlert(provider: string): Alert {
  return {
    id: `alert-provider-down-${provider}-${Date.now()}`,
    type: 'provider_down',
    severity: 'critical',
    title: `${provider} provider unavailable`,
    message: `The ${provider} notification provider is not responding. Delivery is disabled.`,
    triggeredAt: Date.now(),
    data: { provider },
  };
}

/**
 * Create alert when SLO is breached for consecutive windows.
 */
export function createPersistentSloBreachAlert(input: {
  consecutiveBreachWindows: number;
  availability: number;
  target: number;
  windowHours: number;
}): Alert {
  return {
    id: `alert-slo-breach-${Date.now()}`,
    type: 'slo_breach_persistent',
    severity: 'critical',
    title: 'Persistent delivery SLO breach',
    message: `Delivery SLO has been below target for ${input.consecutiveBreachWindows} consecutive ${input.windowHours}h windows (${input.availability}% vs ${input.target}% target).`,
    triggeredAt: Date.now(),
    data: {
      sloAvailability: input.availability,
      sloTarget: input.target,
      consecutiveBreachWindows: input.consecutiveBreachWindows,
    },
  };
}

/**
 * Create alert when a notification channel circuit breaker remains open across cooldown cycles.
 */
export function createPersistentCircuitBreakerAlert(input: {
  channels: Array<'email' | 'sms'>;
  cooldownCycles: number;
}): Alert {
  const channelLabel = input.channels.map((channel) => channel.toUpperCase()).join(', ');

  return {
    id: `alert-circuit-breaker-persistent-${Date.now()}`,
    type: 'circuit_breaker_open_persistent',
    severity: 'critical',
    title: 'Persistent circuit breaker open state',
    message: `${channelLabel} notification circuit breaker has remained open across ${input.cooldownCycles}+ cooldown cycles. Provider stability is degraded.`,
    triggeredAt: Date.now(),
    data: {
      channels: input.channels,
      openCycleCount: input.cooldownCycles,
    },
  };
}

/**
 * Resolve an alert (mark as resolved)
 */
export function resolveAlert(alert: Alert): Alert {
  return {
    ...alert,
    resolvedAt: Date.now(),
  };
}

/**
 * Check if alert is active (not resolved)
 */
export function isAlertActive(alert: Alert): boolean {
  return !alert.resolvedAt;
}
