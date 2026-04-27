import { z } from 'zod';

const runtimeEnvSchema = z
  .object({
    VITE_SUPABASE_URL: z.string().trim().optional(),
    VITE_SUPABASE_ANON_KEY: z.string().trim().optional(),
    VITE_ENABLE_CHAT_LEARNING_SYNC: z.enum(['true', 'false']).optional(),
    VITE_GOOGLE_CUSTOM_SEARCH_API_KEY: z.string().trim().optional(),
    VITE_GOOGLE_CUSTOM_SEARCH_ENGINE_ID: z.string().trim().optional(),
    VITE_GOOGLE_CUSTOM_SEARCH_BASE_URL: z.string().trim().optional(),
    VITE_SENTRY_DSN: z.string().trim().optional(),
    VITE_LOGGING_URL: z.string().trim().optional(),
    VITE_NOTIFICATION_WEBHOOK_URL: z.string().trim().optional(),
    VITE_NOTIFICATION_EMAIL_WEBHOOK_URL: z.string().trim().optional(),
    VITE_NOTIFICATION_SMS_WEBHOOK_URL: z.string().trim().optional(),
    VITE_SENDGRID_API_KEY: z.string().trim().optional(),
    VITE_TWILIO_ACCOUNT_SID: z.string().trim().optional(),
    VITE_TWILIO_AUTH_TOKEN: z.string().trim().optional(),
    VITE_TWILIO_PHONE_NUMBER: z.string().trim().optional(),
    VITE_NOTIFICATION_MAX_ATTEMPTS: z.string().trim().optional(),
    VITE_NOTIFICATION_BASE_DELAY_MS: z.string().trim().optional(),
    VITE_NOTIFICATION_SLO_TARGET_PERCENT: z.string().trim().optional(),
    VITE_NOTIFICATION_CIRCUIT_BREAKER_FAILURE_THRESHOLD: z.string().trim().optional(),
    VITE_NOTIFICATION_CIRCUIT_BREAKER_COOLDOWN_MS: z.string().trim().optional(),
    VITE_ENABLE_BACKGROUND_VERIFICATION: z.enum(['true', 'false']).optional(),
    VITE_VERIFICATION_INTERVAL_MINUTES: z.string().trim().optional(),
    VITE_VERIFICATION_BATCH_SIZE: z.string().trim().optional(),
  })
  .passthrough();

const rawEnv = ((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {}) as Record<
  string,
  string | undefined
>;

const parsedEnv = runtimeEnvSchema.safeParse(rawEnv);
const env = parsedEnv.success ? parsedEnv.data : rawEnv;

const normalize = (value: string | undefined) => value?.trim() || '';
const parseNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const runtimeEnv = {
  supabaseUrl: normalize(env.VITE_SUPABASE_URL),
  supabaseAnonKey: normalize(env.VITE_SUPABASE_ANON_KEY),
  enableChatLearningSync: env.VITE_ENABLE_CHAT_LEARNING_SYNC === 'true',
  googleCustomSearchApiKey: normalize(env.VITE_GOOGLE_CUSTOM_SEARCH_API_KEY),
  googleCustomSearchEngineId: normalize(env.VITE_GOOGLE_CUSTOM_SEARCH_ENGINE_ID),
  googleCustomSearchBaseUrl: normalize(env.VITE_GOOGLE_CUSTOM_SEARCH_BASE_URL) || 'https://customsearch.googleapis.com/customsearch/v1',
  sentryDsn: normalize(env.VITE_SENTRY_DSN),
  loggingUrl: normalize(env.VITE_LOGGING_URL),
  notificationWebhookUrl: normalize(env.VITE_NOTIFICATION_WEBHOOK_URL),
  notificationEmailWebhookUrl: normalize(env.VITE_NOTIFICATION_EMAIL_WEBHOOK_URL),
  notificationSmsWebhookUrl: normalize(env.VITE_NOTIFICATION_SMS_WEBHOOK_URL),
  sendgridApiKey: normalize(env.VITE_SENDGRID_API_KEY),
  twilioAccountSid: normalize(env.VITE_TWILIO_ACCOUNT_SID),
  twilioAuthToken: normalize(env.VITE_TWILIO_AUTH_TOKEN),
  twilioPhoneNumber: normalize(env.VITE_TWILIO_PHONE_NUMBER),
  notificationMaxAttempts: clamp(Math.floor(parseNumber(env.VITE_NOTIFICATION_MAX_ATTEMPTS, 3)), 1, 10),
  notificationBaseDelayMs: clamp(Math.floor(parseNumber(env.VITE_NOTIFICATION_BASE_DELAY_MS, 400)), 100, 10000),
  notificationSloTargetPercent: clamp(parseNumber(env.VITE_NOTIFICATION_SLO_TARGET_PERCENT, 99), 90, 100),
  notificationCircuitBreakerFailureThreshold: clamp(
    Math.floor(parseNumber(env.VITE_NOTIFICATION_CIRCUIT_BREAKER_FAILURE_THRESHOLD, 5)),
    1,
    20
  ),
  notificationCircuitBreakerCooldownMs: clamp(
    Math.floor(parseNumber(env.VITE_NOTIFICATION_CIRCUIT_BREAKER_COOLDOWN_MS, 60000)),
    1000,
    600000
  ),
  enableBackgroundVerification: env.VITE_ENABLE_BACKGROUND_VERIFICATION !== 'false',
  verificationIntervalMinutes: Number(env.VITE_VERIFICATION_INTERVAL_MINUTES || 60),
  verificationBatchSize: Number(env.VITE_VERIFICATION_BATCH_SIZE || 10),
};

export const runtimeEnvStatus = {
  isSupabaseConfigured: Boolean(runtimeEnv.supabaseUrl && runtimeEnv.supabaseAnonKey),
  isSentryConfigured: Boolean(runtimeEnv.sentryDsn),
  isLoggingConfigured: Boolean(runtimeEnv.loggingUrl),
  isNotificationConfigured: Boolean(
    runtimeEnv.notificationWebhookUrl || runtimeEnv.notificationEmailWebhookUrl || runtimeEnv.notificationSmsWebhookUrl
  ),
  hasEmailNotificationWebhook: Boolean(runtimeEnv.notificationEmailWebhookUrl || runtimeEnv.notificationWebhookUrl),
  hasSmsNotificationWebhook: Boolean(runtimeEnv.notificationSmsWebhookUrl || runtimeEnv.notificationWebhookUrl),
  isSendgridConfigured: Boolean(runtimeEnv.sendgridApiKey),
  isTwilioConfigured: Boolean(runtimeEnv.twilioAccountSid && runtimeEnv.twilioAuthToken && runtimeEnv.twilioPhoneNumber),
  isBackgroundVerificationEnabled: runtimeEnv.enableBackgroundVerification,
  missingSupabaseKeys: [
    runtimeEnv.supabaseUrl ? null : 'VITE_SUPABASE_URL',
    runtimeEnv.supabaseAnonKey ? null : 'VITE_SUPABASE_ANON_KEY',
  ].filter((value): value is string => Boolean(value)),
};

export const runtimeEnvMessages = {
  missingSupabaseConfig:
    'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable authentication and sync.',
  missingSentryConfig: 'Sentry error tracking is not configured. Set VITE_SENTRY_DSN for production error tracking.',
  missingLoggingConfig: 'Server-side logging is not configured. Set VITE_LOGGING_URL for centralized log collection.',
  missingNotificationConfig:
    'Notification delivery is not configured. Set VITE_NOTIFICATION_WEBHOOK_URL or channel-specific webhook URLs to send real email and SMS reminders.',
  missingSendgridConfig: 'SendGrid is not configured. Set VITE_SENDGRID_API_KEY to enable email notifications.',
  missingTwilioConfig: 'Twilio is not configured. Set VITE_TWILIO_ACCOUNT_SID, VITE_TWILIO_AUTH_TOKEN, and VITE_TWILIO_PHONE_NUMBER to enable SMS.',
  backgroundVerificationDisabled:
    'Background verification is disabled. Set VITE_ENABLE_BACKGROUND_VERIFICATION=true to run periodic link and freshness checks.',
};