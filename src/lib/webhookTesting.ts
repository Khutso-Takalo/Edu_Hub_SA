/**
 * Webhook testing utility for development and debugging
 * Allows local testing of notification webhooks before production deployment
 */

import type { WebhookNotificationPayload, WebhookResponse } from './WebhookAdapter';
import { runtimeEnv, runtimeEnvStatus } from '@/lib/runtimeEnv';

export interface WebhookTestConfig {
  webhookUrl: string;
  userEmail?: string;
  userPhoneNumber?: string;
  signatureSecret?: string;
}

export interface WebhookTestResult {
  success: boolean;
  status: number;
  responseTime: number;
  response: WebhookResponse | Record<string, unknown>;
  error?: string;
}

/**
 * Create HMAC-SHA256 signature for webhook request
 */
async function createWebhookSignature(body: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  return Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Send test notification to webhook endpoint
 */
export async function testWebhookDelivery(
  payload: WebhookNotificationPayload,
  config: WebhookTestConfig
): Promise<WebhookTestResult> {
  const startTime = performance.now();

  try {
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add signature if secret provided
    if (config.signatureSecret) {
      const signature = await createWebhookSignature(body, config.signatureSecret);
      headers['X-EduHub-Signature'] = signature;
    }

    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers,
      body,
    });

    const responseData = (await response.json()) as Record<string, unknown>;
    const responseTime = performance.now() - startTime;

    return {
      success: response.ok,
      status: response.status,
      responseTime,
      response: responseData,
    };
  } catch (error) {
    const responseTime = performance.now() - startTime;
    return {
      success: false,
      status: 0,
      responseTime,
      response: {},
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Create sample test payloads for different scenarios
 */
export function createTestPayloads(): Record<string, WebhookNotificationPayload> {
  return {
    urgentDeadline: {
      channel: 'email',
      userId: 'test-user-001',
      title: '⚠️ URGENT: Application deadline in 3 days',
      message:
        'Your application for the National Bursary Programme is closing in 3 days. Submit your application now to avoid missing this opportunity.',
      applicationId: 'app-test-001',
      dueDate: '2026-04-19',
    },
    reminderEmail: {
      channel: 'email',
      userId: 'test-user-002',
      title: 'Application reminder: NSFAS Bursary',
      message:
        'A reminder that your application for the NSFAS Bursary Programme requires additional documents. Please upload the required documents within 7 days.',
      applicationId: 'app-test-002',
      dueDate: '2026-04-23',
    },
    smsPeriodic: {
      channel: 'sms',
      userId: 'test-user-003',
      title: 'Bursary update',
      message: 'You have 2 new bursary opportunities matching your profile. Check your Dashboard now!',
    },
    smsUrgent: {
      channel: 'sms',
      userId: 'test-user-004',
      title: 'URGENT: Final day to apply',
      message: 'This is your last day to apply for the Careers Bursary. Apply now at eduhub.app',
      dueDate: '2026-04-16',
    },
  };
}

/**
 * Run comprehensive webhook test suite
 */
export async function runWebhookTestSuite(config: WebhookTestConfig): Promise<{
  configValid: boolean;
  configIssues: string[];
  tests: Record<string, WebhookTestResult>;
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    avgResponseTime: number;
  };
}> {
  const configIssues: string[] = [];

  // Validate configuration
  if (!config.webhookUrl) {
    configIssues.push('webhookUrl is required');
  } else if (!config.webhookUrl.startsWith('http')) {
    configIssues.push('webhookUrl must start with http:// or https://');
  }

  if (!config.userEmail && config.webhookUrl?.includes('email')) {
    configIssues.push('userEmail recommended for email webhook tests');
  }

  if (!config.userPhoneNumber && config.webhookUrl?.includes('sms')) {
    configIssues.push('userPhoneNumber recommended for SMS webhook tests');
  }

  const configValid = configIssues.length === 0;

  // Skip tests if config is invalid
  if (!configValid) {
    return {
      configValid: false,
      configIssues,
      tests: {},
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        avgResponseTime: 0,
      },
    };
  }

  // Run tests
  const testPayloads = createTestPayloads();
  const tests: Record<string, WebhookTestResult> = {};

  for (const [testName, payload] of Object.entries(testPayloads)) {
    tests[testName] = await testWebhookDelivery(payload, config);
  }

  // Calculate summary
  const results = Object.values(tests);
  const passed = results.filter((r) => r.success).length;
  const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;

  return {
    configValid,
    configIssues,
    tests,
    summary: {
      totalTests: results.length,
      passed,
      failed: results.length - passed,
      avgResponseTime: Math.round(avgResponseTime * 100) / 100,
    },
  };
}

/**
 * Get recommended webhook URL based on environment configuration
 */
export function getRecommendedWebhookUrl(): string {
  // In development, use localhost
  if (import.meta.env.DEV) {
    return 'http://localhost:3000/api/webhooks/notifications';
  }

  // In production, use configured webhook URL
  if (runtimeEnv.notificationWebhookUrl) {
    return runtimeEnv.notificationWebhookUrl;
  }

  // Fallback to channel-specific
  if (runtimeEnv.notificationEmailWebhookUrl) {
    return runtimeEnv.notificationEmailWebhookUrl;
  }

  if (runtimeEnv.notificationSmsWebhookUrl) {
    return runtimeEnv.notificationSmsWebhookUrl;
  }

  return 'https://your-domain.vercel.app/api/webhooks/notifications';
}

/**
 * Get webhook configuration status and recommendations
 */
export function getWebhookConfigStatus(): {
  isConfigured: boolean;
  endpoints: {
    email: boolean;
    sms: boolean;
  };
  recommendation: string;
} {
  return {
    isConfigured: runtimeEnvStatus.isNotificationConfigured,
    endpoints: {
      email: runtimeEnvStatus.hasEmailNotificationWebhook,
      sms: runtimeEnvStatus.hasSmsNotificationWebhook,
    },
    recommendation: !runtimeEnvStatus.isNotificationConfigured
      ? 'Configure VITE_NOTIFICATION_WEBHOOK_URL or channel-specific URLs in your .env.local file'
      : `Configured: ${[
          runtimeEnvStatus.hasEmailNotificationWebhook ? 'email' : null,
          runtimeEnvStatus.hasSmsNotificationWebhook ? 'sms' : null,
        ]
          .filter(Boolean)
          .join(', ')}`,
  };
}
