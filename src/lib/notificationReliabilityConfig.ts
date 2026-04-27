import { runtimeEnv } from './runtimeEnv';

const STORAGE_KEY = 'eduhub:notification-reliability-overrides:v1';

export interface NotificationReliabilityConfig {
  maxAttempts: number;
  baseDelayMs: number;
  sloTargetPercent: number;
  circuitBreakerFailureThreshold: number;
  circuitBreakerCooldownMs: number;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function sanitize(input: Partial<NotificationReliabilityConfig>): Partial<NotificationReliabilityConfig> {
  const output: Partial<NotificationReliabilityConfig> = {};

  if (typeof input.maxAttempts === 'number' && Number.isFinite(input.maxAttempts)) {
    output.maxAttempts = clamp(Math.floor(input.maxAttempts), 1, 10);
  }

  if (typeof input.baseDelayMs === 'number' && Number.isFinite(input.baseDelayMs)) {
    output.baseDelayMs = clamp(Math.floor(input.baseDelayMs), 100, 10000);
  }

  if (typeof input.sloTargetPercent === 'number' && Number.isFinite(input.sloTargetPercent)) {
    output.sloTargetPercent = clamp(input.sloTargetPercent, 90, 100);
  }

  if (
    typeof input.circuitBreakerFailureThreshold === 'number' &&
    Number.isFinite(input.circuitBreakerFailureThreshold)
  ) {
    output.circuitBreakerFailureThreshold = clamp(Math.floor(input.circuitBreakerFailureThreshold), 1, 20);
  }

  if (typeof input.circuitBreakerCooldownMs === 'number' && Number.isFinite(input.circuitBreakerCooldownMs)) {
    output.circuitBreakerCooldownMs = clamp(Math.floor(input.circuitBreakerCooldownMs), 1000, 600000);
  }

  return output;
}

export function getNotificationReliabilityDefaults(): NotificationReliabilityConfig {
  return {
    maxAttempts: runtimeEnv.notificationMaxAttempts,
    baseDelayMs: runtimeEnv.notificationBaseDelayMs,
    sloTargetPercent: runtimeEnv.notificationSloTargetPercent,
    circuitBreakerFailureThreshold: runtimeEnv.notificationCircuitBreakerFailureThreshold,
    circuitBreakerCooldownMs: runtimeEnv.notificationCircuitBreakerCooldownMs,
  };
}

export function getNotificationReliabilityOverrides(): Partial<NotificationReliabilityConfig> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as Partial<NotificationReliabilityConfig>;
    return sanitize(parsed);
  } catch {
    return {};
  }
}

export function getNotificationReliabilityConfig(): NotificationReliabilityConfig {
  return {
    ...getNotificationReliabilityDefaults(),
    ...getNotificationReliabilityOverrides(),
  };
}

export function setNotificationReliabilityOverrides(overrides: Partial<NotificationReliabilityConfig>) {
  const current = getNotificationReliabilityOverrides();
  const next = {
    ...current,
    ...sanitize(overrides),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Best effort.
  }

  return next;
}

export function clearNotificationReliabilityOverrides() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Best effort.
  }
}
