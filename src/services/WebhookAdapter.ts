/**
 * Webhook adapter for translating EduHub notification format to provider APIs
 * Supports: SendGrid (email), Twilio (SMS)
 */

export interface WebhookNotificationPayload {
  channel: 'email' | 'sms';
  userId: string;
  title: string;
  message: string;
  applicationId?: string;
  dueDate?: string;
}

export interface SendGridEmailRequest {
  personalizations: Array<{
    to: Array<{ email: string }>;
    subject: string;
  }>;
  from: { email: string; name: string };
  content: Array<{
    type: 'text/plain' | 'text/html';
    value: string;
  }>;
  reply_to?: { email: string };
}

export interface TwilioSmsRequest {
  To: string;
  From: string;
  Body: string;
}

export interface WebhookResponse {
  success: boolean;
  provider: 'sendgrid' | 'twilio' | 'mock';
  messageId?: string;
  error?: string;
}

/**
 * Create SendGrid email request from EduHub notification
 * Requires: user email from database lookup or user context
 */
export function createSendGridRequest(
  payload: WebhookNotificationPayload,
  userEmail: string,
  options: {
    fromEmail?: string;
    fromName?: string;
  } = {}
): SendGridEmailRequest {
  const fromEmail = options.fromEmail || 'notifications@eduhub.local';
  const fromName = options.fromName || 'EduHub Notifications';

  return {
    personalizations: [
      {
        to: [{ email: userEmail }],
        subject: payload.title,
      },
    ],
    from: {
      email: fromEmail,
      name: fromName,
    },
    content: [
      {
        type: 'text/html',
        value: createEmailHtml(payload),
      },
      {
        type: 'text/plain',
        value: payload.message,
      },
    ],
  };
}

/**
 * Create Twilio SMS request from EduHub notification
 */
export function createTwilioRequest(
  payload: WebhookNotificationPayload,
  userPhoneNumber: string,
  options: {
    fromNumber?: string;
  } = {}
): TwilioSmsRequest {
  return {
    To: userPhoneNumber,
    From: options.fromNumber || process.env.TWILIO_PHONE_NUMBER || '+1234567890',
    Body: `${payload.title}\n\n${payload.message}${payload.dueDate ? `\n\nDue: ${payload.dueDate}` : ''}`,
  };
}

/**
 * Format HTML email body for EduHub notifications
 */
function createEmailHtml(payload: WebhookNotificationPayload): string {
  const bgColor = payload.title.toLowerCase().includes('urgent') ? '#fff3cd' : '#f8f9fa';
  const accentColor = payload.title.toLowerCase().includes('urgent') ? '#e74c3c' : '#3498db';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; background: ${bgColor}; padding: 20px; border-radius: 8px; }
          .header { border-left: 4px solid ${accentColor}; padding-left: 16px; margin-bottom: 20px; }
          .header h1 { margin: 0 0 8px 0; color: #333; font-size: 20px; font-weight: 600; }
          .header p { margin: 0; color: #666; font-size: 14px; }
          .content { background: white; padding: 16px; border-radius: 6px; margin-bottom: 20px; color: #333; line-height: 1.6; }
          .meta { font-size: 12px; color: #999; margin-top: 12px; padding-top: 12px; border-top: 1px solid #eee; }
          .footer { text-align: center; font-size: 12px; color: #999; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${escapeHtml(payload.title)}</h1>
            <p>EduHub Notification</p>
          </div>
          <div class="content">
            ${payload.message.split('\n').map((line) => `<p>${escapeHtml(line)}</p>`).join('')}
          </div>
          ${
            payload.dueDate
              ? `<div class="meta"><strong>Due:</strong> ${escapeHtml(payload.dueDate)}</div>`
              : ''
          }
          ${
            payload.applicationId
              ? `<div class="meta"><strong>Application ID:</strong> ${escapeHtml(payload.applicationId)}</div>`
              : ''
          }
          <div class="footer">
            <p>This is an automated notification from EduHub. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Escape HTML special characters (security)
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char] || char);
}

/**
 * Send request to SendGrid API
 */
export async function sendViasendGrid(
  payload: WebhookNotificationPayload,
  userEmail: string,
  apiKey: string
): Promise<WebhookResponse> {
  try {
    const request = createSendGridRequest(payload, userEmail);

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        provider: 'sendgrid',
        error: `SendGrid API error: ${response.status} ${errorText}`,
      };
    }

    // SendGrid returns 202 Accepted with empty body on success
    return {
      success: true,
      provider: 'sendgrid',
      messageId: `sg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
  } catch (error) {
    return {
      success: false,
      provider: 'sendgrid',
      error: `SendGrid request failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Send request to Twilio SMS API
 */
export async function sendViaTwilio(
  payload: WebhookNotificationPayload,
  userPhoneNumber: string,
  accountSid: string,
  authToken: string
): Promise<WebhookResponse> {
  try {
    const request = createTwilioRequest(payload, userPhoneNumber);

    // Twilio uses Basic Auth with accountSid:authToken
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(request).toString(),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        provider: 'twilio',
        error: `Twilio API error: ${response.status} ${errorText}`,
      };
    }

    const data = (await response.json()) as { sid?: string };
    return {
      success: true,
      provider: 'twilio',
      messageId: data.sid,
    };
  } catch (error) {
    return {
      success: false,
      provider: 'twilio',
      error: `Twilio request failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Route notification to appropriate provider based on channel and config
 */
export async function routeNotificationToProvider(
  payload: WebhookNotificationPayload,
  userEmail: string,
  userPhoneNumber: string,
  config: {
    sendgridApiKey?: string;
    twilioAccountSid?: string;
    twilioAuthToken?: string;
  }
): Promise<WebhookResponse> {
  if (payload.channel === 'email') {
    if (!config.sendgridApiKey) {
      return {
        success: false,
        provider: 'sendgrid',
        error: 'SendGrid API key not configured',
      };
    }
    return sendViaSendGrid(payload, userEmail, config.sendgridApiKey);
  }

  if (payload.channel === 'sms') {
    if (!config.twilioAccountSid || !config.twilioAuthToken) {
      return {
        success: false,
        provider: 'twilio',
        error: 'Twilio credentials not configured',
      };
    }
    return sendViaTwilio(payload, userPhoneNumber, config.twilioAccountSid, config.twilioAuthToken);
  }

  return {
    success: false,
    provider: 'mock',
    error: `Unknown channel: ${payload.channel}`,
  };
}
