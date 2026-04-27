# Webhook Setup & Deployment Guide

This guide explains how to set up production notification delivery for EduHub using SendGrid (email) and Twilio (SMS).

## Architecture Overview

```
EduHub App
    ↓ (POST to webhook URL)
Webhook Endpoint (Vercel Edge Function / API Route)
    ├→ SendGrid API (email)
    └→ Twilio API (SMS)
```

## Prerequisites

- SendGrid account (for email delivery)
- Twilio account (for SMS delivery)
- Deployment platform (Vercel, AWS Lambda, or similar)
- EduHub environment variables configured

## Step 1: Set Up SendGrid

### 1.1 Create SendGrid Account
1. Go to [sendgrid.com](https://sendgrid.com) and create an account
2. Complete email verification
3. Navigate to Settings → API Keys
4. Create a new API key with "Mail Send" permission
5. Copy the API key (treat as secret, don't commit to git)

### 1.2 Verify Sender Domain (Production)
For production emails, SendGrid requires domain verification:
1. Go to Settings → Sender Authentication
2. Click "Authenticate Your Domain"
3. Add DNS records to your domain provider
4. Verify the domain

For testing/development, you can use SendGrid's sandbox mode or send emails to verified addresses.

### 1.3 Environment Variables
Add to your `.env.local` (development) or deployment platform (production):

```bash
VITE_SENDGRID_API_KEY=SG.xxxxxxxxxxxx
SENDGRID_FROM_EMAIL=notifications@yourdomain.com
```

## Step 2: Set Up Twilio

### 2.1 Create Twilio Account
1. Go to [twilio.com](https://twilio.com) and create an account
2. Complete account verification
3. Navigate to Account → Keys and tokens
4. Note your **Account SID** and **Auth Token**

### 2.2 Get Phone Number
1. Go to Phone Numbers → Manage
2. Get or buy a phone number for sending SMS
3. Copy the phone number (format: +1234567890)

### 2.3 Environment Variables
Add to your `.env.local` or deployment platform:

```bash
VITE_TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxx
VITE_TWILIO_AUTH_TOKEN=xxxxxxxxxxxx
VITE_TWILIO_PHONE_NUMBER=+1234567890
```

## Step 3: Deploy Webhook Handler

### Option A: Vercel (Recommended)

1. **Copy the example edge function:**
   ```bash
   cp api/webhooks/notifications.example.ts api/webhooks/notifications.ts
   ```

2. **Update getUserContactInfo function** to fetch from your database:
   ```typescript
   // Replace with your database query
   const { data } = await supabase
     .from('users')
     .select('email, phone_number')
     .eq('id', userId)
     .single();
   ```

3. **Deploy to Vercel:**
   ```bash
   npm i -g vercel
   vercel deploy
   ```

4. **Add environment variables in Vercel dashboard:**
   - Settings → Environment Variables
   - Add: `SENDGRID_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`

5. **Your webhook URL will be:**
   ```
   https://your-project.vercel.app/api/webhooks/notifications
   ```

### Option B: AWS Lambda

1. **Package the handler:**
   ```bash
   # Create a directory for Lambda code
   mkdir lambda-handler
   cd lambda-handler
   npm init -y
   npm install node-fetch
   ```

2. **Create handler.js** with similar logic to the Vercel example

3. **Deploy with AWS SAM or Serverless Framework:**
   ```bash
   serverless deploy
   ```

4. **Your webhook URL will be:**
   ```
   https://your-lambda-function-url.lambda-url.region.on.aws/
   ```

### Option C: Self-Hosted

If hosting on your own server:

1. **Create API endpoint** (for example, with Express.js):
   ```typescript
   app.post('/api/webhooks/notifications', async (req, res) => {
     // Handle incoming notification payload
     // Route to SendGrid/Twilio based on channel
     // Return { success: true, provider, messageId }
   });
   ```

2. **Install required packages:**
   ```bash
   npm install @sendgrid/mail twilio @twilio/sdk
   ```

3. **Deploy and configure firewall** to allow requests from EduHub

## Step 4: Configure EduHub

### 4.1 Development (.env.local)
```bash
# For local testing with Vercel deployment
VITE_NOTIFICATION_WEBHOOK_URL=https://your-project.vercel.app/api/webhooks/notifications

# Or channel-specific (will override catch-all)
VITE_NOTIFICATION_EMAIL_WEBHOOK_URL=https://your-project.vercel.app/api/webhooks/notifications
VITE_NOTIFICATION_SMS_WEBHOOK_URL=https://your-project.vercel.app/api/webhooks/notifications

# Provider credentials (if testing locally)
VITE_SENDGRID_API_KEY=SG.xxxxxxxxxxxx
VITE_TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxx
VITE_TWILIO_AUTH_TOKEN=xxxxxxxxxxxx
VITE_TWILIO_PHONE_NUMBER=+1234567890
```

### 4.2 Production (Deployment Platform)
Set the same environment variables in your production deployment (Vercel, Netlify, etc.):
- Go to project settings
- Add environment variables for production environment
- Redeploy

## Step 5: Test the Webhook

### 5.1 Local Testing
Use the webhook testing utility:

```typescript
import { runWebhookTestSuite } from '@/lib/webhookTesting';

const results = await runWebhookTestSuite({
  webhookUrl: 'https://your-project.vercel.app/api/webhooks/notifications',
  userEmail: 'test@example.com',
  userPhoneNumber: '+1234567890',
  signatureSecret: process.env.WEBHOOK_SIGNATURE_SECRET,
});

console.log(results.summary);
console.log(results.tests);
```

### 5.2 Manual Testing
Send a test notification:

```bash
curl -X POST https://your-project.vercel.app/api/webhooks/notifications \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "email",
    "userId": "test-user",
    "title": "Test notification",
    "message": "This is a test",
    "applicationId": "app-123",
    "dueDate": "2026-04-20"
  }'
```

Expected response:
```json
{
  "success": true,
  "provider": "sendgrid",
  "messageId": "sg-xxx"
}
```

### 5.3 Verify in Dashboard
1. Check EduHub AdminPanel → System alerts → Notification delivery metrics
2. Metrics should show sent/failed counts
3. Recent audit trail should show delivery logs

## Step 6: Monitor & Troubleshoot

### 6.1 Check Alert Dashboard
- Open AdminPanel in dev tools
- Look at "System alerts" section
- Red alerts = critical issues (check logs)
- Amber alerts = configuration warnings

### 6.2 Monitor SendGrid
1. Go to Mail → Statistics
2. View delivery rates, bounces, opens
3. Check Suppressions for bounce list

### 6.3 Monitor Twilio
1. Go to Messaging → Logs
2. View delivery status for each SMS
3. Check error codes for failures

### 6.4 Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `SENDGRID_API_KEY not configured` | Missing or invalid key | Add VITE_SENDGRID_API_KEY to .env |
| `Invalid sender address` | Domain not verified | Verify domain in SendGrid settings |
| `Twilio credentials not configured` | Missing SID/token | Add VITE_TWILIO_ACCOUNT_SID, VITE_TWILIO_AUTH_TOKEN |
| `Invalid phone number format` | Phone not in E.164 format | Use format: +1234567890 |
| `Webhook timeout` | Endpoint not responding | Check deployment logs, verify URL |
| `Authentication failed` | Invalid API key | Regenerate key in provider dashboard |

## Step 7: Production Checklist

Before deploying to production:

- [ ] SendGrid account created and domain verified
- [ ] Twilio account created with phone number
- [ ] API keys stored securely (not in code)
- [ ] Webhook endpoint deployed and tested
- [ ] VITE_NOTIFICATION_WEBHOOK_URL set in production environment
- [ ] Send test notification and verify delivery
- [ ] Monitor AdminPanel alerts (should show 0 configuration warnings)
- [ ] Set up monitoring/alerting for failed deliveries
- [ ] Document webhook URL and API keys for team

## Step 8: Cost Optimization

### SendGrid Pricing
- **Free tier:** 100 emails/day, unlimited recipients
- **Paid tier:** $9.95+/month for higher volumes
- **Recommendation:** Start with free tier for testing, upgrade as needed

### Twilio Pricing
- **SMS:** $0.0075 per message (inbound) + $0.0075 per message (outbound)
- **Recommendation:** ~$100/month for 1,000 SMS/day
- Use SMS only for urgent notifications

## Advanced Configuration

### Rate Limiting
Add rate limiting to prevent abuse:

```typescript
// Example: Max 5 notifications per user per hour
const rateLimiter = new Map<string, number[]>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  const recent = rateLimiter.get(userId)?.filter((t) => t > oneHourAgo) || [];
  
  if (recent.length >= 5) return false;
  
  rateLimiter.set(userId, [...recent, now]);
  return true;
}
```

### Webhook Signatures
For security, sign all webhook requests:

```typescript
import crypto from 'crypto';

function createSignature(body: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
}
```

### Batching
For high-volume notifications, batch requests:

```typescript
async function batchNotifications(notifications: WebhookNotificationPayload[]) {
  const batches = chunk(notifications, 100);
  
  for (const batch of batches) {
    await Promise.all(
      batch.map((notif) => 
        routeNotificationToProvider(notif, config)
      )
    );
  }
}
```

## Support & Resources

- **SendGrid Docs:** https://docs.sendgrid.com
- **Twilio Docs:** https://www.twilio.com/docs
- **Vercel Deployment:** https://vercel.com/docs
- **EduHub Issues:** [Link to your issue tracker]
