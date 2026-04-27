/**
 * Example Vercel Edge Function for EduHub Notification Webhooks
 * 
 * Deploy this as: api/webhooks/notifications.ts
 * 
 * Environment variables needed:
 * - SENDGRID_API_KEY
 * - TWILIO_ACCOUNT_SID
 * - TWILIO_AUTH_TOKEN
 * - WEBHOOK_SIGNATURE_SECRET (optional, for request validation)
 * 
 * Usage:
 * POST https://your-domain.vercel.app/api/webhooks/notifications
 * 
 * Request body:
 * {
 *   "channel": "email" | "sms",
 *   "userId": "user-123",
 *   "title": "Urgent: application deadline",
 *   "message": "Your application deadline is in 7 days",
 *   "applicationId": "app-456",
 *   "dueDate": "2026-04-20"
 * }
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// You would normally fetch user data from your database
// This is a placeholder showing the expected structure
async function getUserContactInfo(userId: string): Promise<{ email: string; phoneNumber: string }> {
  // TODO: Replace with actual database query
  // Example using Supabase:
  // const { data } = await supabase.from('users').select('email, phone_number').eq('id', userId).single();
  // return { email: data.email, phoneNumber: data.phone_number };

  // For now, return a mock response
  return {
    email: `user-${userId}@example.com`,
    phoneNumber: '+1234567890',
  };
}

/**
 * Hash and verify webhook signature for security
 */
async function verifyWebhookSignature(
  body: string,
  signature: string | undefined,
  secret: string
): Promise<boolean> {
  if (!signature || !secret) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const computedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return computedSignature === signature;
}

interface NotificationPayload {
  channel: 'email' | 'sms';
  userId: string;
  title: string;
  message: string;
  applicationId?: string;
  dueDate?: string;
}

async function sendViaProvider(
  payload: NotificationPayload,
  userEmail: string,
  userPhoneNumber: string
): Promise<{ success: boolean; provider: string; messageId?: string; error?: string }> {
  const sendgridApiKey = process.env.SENDGRID_API_KEY;
  const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;

  if (payload.channel === 'email') {
    if (!sendgridApiKey) {
      return { success: false, provider: 'sendgrid', error: 'SendGrid API key not configured' };
    }

    try {
      const sendgridRequest = {
        personalizations: [
          {
            to: [{ email: userEmail }],
            subject: payload.title,
          },
        ],
        from: {
          email: process.env.SENDGRID_FROM_EMAIL || 'notifications@eduhub.app',
          name: 'EduHub Notifications',
        },
        content: [
          {
            type: 'text/plain',
            value: payload.message,
          },
        ],
      };

      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sendgridApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sendgridRequest),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          success: false,
          provider: 'sendgrid',
          error: `SendGrid error: ${response.status} ${errorBody}`,
        };
      }

      return {
        success: true,
        provider: 'sendgrid',
        messageId: `sg-${Date.now()}`,
      };
    } catch (error) {
      return {
        success: false,
        provider: 'sendgrid',
        error: `SendGrid exception: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  if (payload.channel === 'sms') {
    if (!twilioAccountSid || !twilioAuthToken) {
      return { success: false, provider: 'twilio', error: 'Twilio credentials not configured' };
    }

    try {
      const auth = Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64');
      const body = new URLSearchParams({
        To: userPhoneNumber,
        From: process.env.TWILIO_PHONE_NUMBER || '+1234567890',
        Body: `${payload.title}\n\n${payload.message}${payload.dueDate ? `\n\nDue: ${payload.dueDate}` : ''}`,
      });

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: body.toString(),
        }
      );

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          success: false,
          provider: 'twilio',
          error: `Twilio error: ${response.status} ${errorBody}`,
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
        error: `Twilio exception: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  return {
    success: false,
    provider: 'unknown',
    error: `Unknown channel: ${payload.channel}`,
  };
}

export async function POST(request: NextRequest) {
  // Optional: Verify webhook signature
  const signature = request.headers.get('X-EduHub-Signature');
  const secret = process.env.WEBHOOK_SIGNATURE_SECRET;
  let payload: NotificationPayload;

  if (secret) {
    const body = await request.text();
    const isValid = await verifyWebhookSignature(body, signature || undefined, secret);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Re-parse body since we consumed it
    try {
      payload = JSON.parse(body) as NotificationPayload;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
  } else {
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
  }

  // Validate required fields
  if (!payload.channel || !payload.userId || !payload.title || !payload.message) {
    return NextResponse.json(
      { error: 'Missing required fields: channel, userId, title, message' },
      { status: 400 }
    );
  }

  if (!['email', 'sms'].includes(payload.channel)) {
    return NextResponse.json({ error: 'Invalid channel' }, { status: 400 });
  }

  // Fetch user contact info
  try {
    const contactInfo = await getUserContactInfo(payload.userId);

    // Send via provider
    const result = await sendViaProvider(payload, contactInfo.email, contactInfo.phoneNumber);

    if (result.success) {
      return NextResponse.json(
        {
          success: true,
          provider: result.provider,
          messageId: result.messageId,
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        {
          success: false,
          provider: result.provider,
          error: result.error,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: `Server error: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    );
  }
}
