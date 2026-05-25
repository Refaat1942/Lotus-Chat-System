# WhatsApp Integration Setup Guide

## Overview
This project includes WhatsApp Business API integration for:
- Receiving incoming messages via Webhook
- Sending outgoing messages to customers
- Managing conversation status and message delivery

## Prerequisites
1. **WhatsApp Business Account** - [Create here](https://business.facebook.com)
2. **Meta App** - Create an app for WhatsApp API
3. **Webhook URL** - Your public server URL (required for webhook)

## Step 1: Get WhatsApp API Credentials

### 1.1 Create Meta App
1. Go to [Facebook Developers](https://developers.facebook.com)
2. Create a new app
3. Add "WhatsApp" product
4. Go to **Settings → Basic** and copy:
   - App ID
   - App Secret

### 1.2 Get API Token
1. In your app, go to **WhatsApp → Getting Started**
2. Create or link a WhatsApp Business Account
3. Get your **Phone Number ID** and **Business Account ID**
4. Generate a **Permanent Access Token** (Temporarily use a 24-hour token for testing)

### 1.3 Create Webhook Verify Token
Generate a random token (e.g., using OpenSSL):
```bash
openssl rand -hex 32
```

## Step 2: Configure Environment Variables

Add to your `.env` file:
```env
WHATSAPP_API_TOKEN=EAABsZC...your_token_here
WHATSAPP_BUSINESS_PHONE_ID=102401234567890
WHATSAPP_WEBHOOK_VERIFY_TOKEN=dev-webhook-verify-token
```

**Never commit your actual API token to git!** Use `.env.local` for sensitive data.

## Step 3: Setup Webhook

### 3.1 Configure Webhook in Meta App
1. Go to your Meta App → **WhatsApp → Configuration**
2. Under **Webhook**, set:
   - **Callback URL**: `https://yourdomain.com/api/whatsapp/webhook`
   - **Verify Token**: The token you created (must match `WHATSAPP_WEBHOOK_VERIFY_TOKEN`)
3. Click **Verify and Save**

### 3.2 Subscribe to Webhook Events
In the same section, under **Webhook Fields**, subscribe to:
- ✓ `messages` - Receive incoming messages
- ✓ `message_status` - Track message delivery status

## Step 4: Test Webhook Locally (Optional)

### Using ngrok for Local Development
```bash
# Install ngrok: https://ngrok.com/download

# Start ngrok to expose your local server
ngrok http 3000

# You'll get a URL like: https://abc123.ngrok.io
# Use this as your Callback URL in Meta App settings
```

## API Endpoints

### Receive Messages (Webhook)
```
GET/POST /api/whatsapp/webhook
```
- **GET**: Webhook verification (called by WhatsApp)
- **POST**: Receive incoming messages and status updates

### Send Message (Future Implementation)
```typescript
import whatsappClient from '@workspace/integrations-openai-ai-server/src/whatsapp-client'

// Send text message
await whatsappClient.sendTextMessage('1234567890', 'Hello from CRM!');

// Send media message
await whatsappClient.sendMediaMessage('1234567890', 'https://example.com/image.jpg', 'image', 'Check this out!');

// Send template message
await whatsappClient.sendTemplateMessage('1234567890', 'hello_world');
```

## Database Schema

The integration creates/updates these records:
- **Customers**: Auto-created from incoming phone numbers
- **Conversations**: Created with `source: 'whatsapp'`
- **Messages**: Stored with `external_message_id` for tracking

## Flow Diagram

```
WhatsApp Business API
        ↓
  Webhook (POST)
        ↓
API Server (/api/whatsapp/webhook)
        ↓
[Verify Token] → [Extract Message] → [Find/Create Customer] → [Find/Create Conversation] → [Save Message]
        ↓
CRM Dashboard (Display in Chat)
```

## Testing

### 1. Test Webhook Verification
```bash
curl -X GET "http://localhost:3000/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=dev-webhook-verify-token&hub.challenge=test_challenge_string"
```
Expected response: `test_challenge_string`

### 2. Test Message Receipt
```bash
curl -X POST http://localhost:3000/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "1234567890",
            "id": "msg_123",
            "type": "text",
            "text": { "body": "Hello!" },
            "timestamp": "'$(date +%s)'"
          }]
        }
      }]
    }]
  }'
```

## Troubleshooting

### Webhook not verifying
- ❌ Check that `WHATSAPP_WEBHOOK_VERIFY_TOKEN` matches Meta App settings
- ❌ Ensure callback URL is publicly accessible (ngrok if local)
- ❌ Check API server logs for errors

### Messages not being received
- ❌ Verify webhook subscription includes `messages` field
- ❌ Check that webhook is marked as "Active" in Meta App
- ❌ Review API server logs

### API errors
- ❌ Verify `WHATSAPP_API_TOKEN` is valid and not expired
- ❌ Verify `WHATSAPP_BUSINESS_PHONE_ID` is correct
- ❌ Check API rate limits (WhatsApp: 80 API calls/sec)

## Production Notes

1. **Use Permanent Access Tokens** for production
2. **Secure webhook verification** - Keep verify token secret
3. **Rate Limiting** - WhatsApp enforces API rate limits
4. **Message Retry Logic** - Implement retry for failed messages
5. **Error Logging** - Monitor webhook failures
6. **Environment Separation** - Use different tokens for dev/staging/prod

## Resources

- [WhatsApp Business API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Webhook Reference](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/subscribe-to-messages)
- [Message Types](https://developers.facebook.com/docs/whatsapp/cloud-api/messages)
- [Rate Limits](https://developers.facebook.com/docs/whatsapp/cloud-api/rate-limiting)
