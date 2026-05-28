# ✅ WhatsApp Integration - Getting Missing Credentials

## Current Status

```
✓ WHATSAPP_API_TOKEN          - CONFIGURED
✓ WHATSAPP_APP_ID             - CONFIGURED  
✓ WHATSAPP_APP_SECRET         - CONFIGURED
✗ WHATSAPP_BUSINESS_PHONE_ID  - MISSING (NEED THIS!)
✗ WHATSAPP_WEBHOOK_VERIFY_TOKEN - MISSING (CREATE THIS!)
```

---

## 🔴 Step 1: Get WHATSAPP_BUSINESS_PHONE_ID

This is the phone number ID of your WhatsApp Business Account.

### Method A: From Meta App Dashboard (Easiest)

1. Go to https://developers.facebook.com
2. Select your app (the one you used for the API token)
3. Go to **WhatsApp → Getting Started** or **WhatsApp → API Setup**
4. You should see a section like:
   ```
   Phone Number ID:  123456789
   ```
5. Copy this number and add to `.env.local`:
   ```env
   WHATSAPP_BUSINESS_PHONE_ID=123456789
   ```

### Method B: Using Graph API

If you have the API token, you can get it via API:

```bash
curl -X GET "https://graph.instagram.com/v18.0/me/phone_numbers?access_token=YOUR_API_TOKEN"
```

Look for `id` field in the response.

---

## 🟡 Step 2: Generate WHATSAPP_WEBHOOK_VERIFY_TOKEN

This is a custom token YOU create (not provided by Meta).

### Generate a random token:

#### Option 1: Using OpenSSL (Mac/Linux/WSL)
```bash
openssl rand -hex 32
```

#### Option 2: Using Node.js
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Option 3: Online Tool
https://www.random.org/strings/

Copy the generated token and add to `.env.local`:
```env
WHATSAPP_WEBHOOK_VERIFY_TOKEN=abc123def456...
```

**Example:**
```env
WHATSAPP_WEBHOOK_VERIFY_TOKEN=5e8f7a9b4c2d1e0f3a6b8c9d2e1f4a5b
```

---

## 🟢 Step 3: Verify Everything

Once you have both missing credentials, run:

```bash
node scripts/verify-whatsapp.mjs
```

You should see:
```
✓ WhatsApp API Token (WHATSAPP_API_TOKEN)
✓ WhatsApp App ID (WHATSAPP_APP_ID)
✓ WhatsApp App Secret (WHATSAPP_APP_SECRET)
✓ WhatsApp Business Phone ID (WHATSAPP_BUSINESS_PHONE_ID)
✓ Webhook Verify Token (WHATSAPP_WEBHOOK_VERIFY_TOKEN)

✅ All credentials are configured!
```

---

## 🔗 Step 4: Configure Webhook in Meta Dashboard

1. Go to your Meta App → **WhatsApp → Configuration**
2. Under **Webhook**, click **Edit**
3. Set:
   - **Callback URL**: `https://yourdomain.com/api/whatsapp/webhook`
   - **Verify Token**: The token you created in Step 2
4. Click **Verify and Save**

### 📝 Testing Locally (with ngrok)

If testing locally, use ngrok:

```bash
# Install ngrok: https://ngrok.com/download
ngrok http 3000

# You'll get: https://abc123.ngrok.io
# Use as: https://abc123.ngrok.io/api/whatsapp/webhook
```

---

## 📋 Final .env.local Configuration

```env
# Already have these ✓
WHATSAPP_API_TOKEN=EAAqreGkA8UUBRviCZC7ChV1qcZCRJPfj3c9gVF18YV3Bk3agMFQD1ZCZBOIlhI5ayh9fOx30rMuY4kTe8q9P9jw50gZAUSd8p7aP4baY9mLoSxdyo7itM0ZBfsL0Bz3DOcQ9fB0hJ78rgfDeZC7Q3ugC5Fqr7i68l3bH2ZCB8hu1PwrGhXAIehxDN5ZBLRJhFDNiaKqIVcPzX3kJXrA0cDNie9UubsLh2p9IlQOxeKuYOIHzZBR90LyQlU4T7ZAl2ZBeN0dkWvGmSuTYFXTdybR0LsRAMi8l4gZDZD
WHATSAPP_APP_ID=3003283413201221
WHATSAPP_APP_SECRET=65a5ef6debdf5bd5f67b4e5f268bb573

# Need to add these:
WHATSAPP_BUSINESS_PHONE_ID=YOUR_PHONE_ID_HERE
WHATSAPP_WEBHOOK_VERIFY_TOKEN=YOUR_VERIFY_TOKEN_HERE
```

---

## ✅ When Configured, You Can:

1. **Receive messages** from WhatsApp customers
2. **Send messages** back via API
3. **Track delivery status**
4. **Manage conversations** in the CRM

---

## 🆘 Troubleshooting

### "Callback URL verification failed"
- Ensure URL is publicly accessible (not localhost)
- Check verify token matches exactly
- API server must be running

### "Cannot get phone number ID"
- Go to Meta App Dashboard
- Make sure WhatsApp product is added
- Check you're viewing the right app

### "Webhook not receiving messages"
- Verify `messages` field is checked in webhook subscription
- Ensure webhook is "Active" in Meta dashboard
- Check API server logs

---

## 📞 Need Help?

Refer to: [WHATSAPP_SETUP.md](../WHATSAPP_SETUP.md)
