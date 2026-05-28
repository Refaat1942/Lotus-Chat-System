#!/usr/bin/env node
/**
 * WhatsApp Integration Verification Script
 * Checks if all required credentials are configured
 */

import * as fs from "fs";
import * as path from "path";

const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(color, text) {
  console.log(`${colors[color]}${text}${colors.reset}`);
}

async function main() {
  log("cyan", "\n╔════════════════════════════════════════════════════════════╗");
  log("cyan", "║     WhatsApp Integration Verification                      ║");
  log("cyan", "╚════════════════════════════════════════════════════════════╝\n");

  const envFile = ".env.local";
  const envPath = path.join(process.cwd(), envFile);

  if (!fs.existsSync(envPath)) {
    log("red", `❌ ${envFile} file not found!`);
    log("yellow", `\n📝 Create ${envFile} with the following credentials:\n`);
    console.log(`WHATSAPP_API_TOKEN=your_token_here
WHATSAPP_APP_ID=your_app_id_here
WHATSAPP_APP_SECRET=your_app_secret_here
WHATSAPP_BUSINESS_PHONE_ID=your_phone_id_here
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_verify_token_here
`);
    return;
  }

  const envContent = fs.readFileSync(envPath, "utf-8");
  const envVars = new Map();

  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, value] = trimmed.split("=");
      if (key && value) {
        envVars.set(key, value);
      }
    }
  });

  const requiredCredentials = [
    {
      key: "WHATSAPP_API_TOKEN",
      description: "WhatsApp API Token",
      status: envVars.has("WHATSAPP_API_TOKEN"),
    },
    {
      key: "WHATSAPP_APP_ID",
      description: "WhatsApp App ID",
      status: envVars.has("WHATSAPP_APP_ID"),
    },
    {
      key: "WHATSAPP_APP_SECRET",
      description: "WhatsApp App Secret",
      status: envVars.has("WHATSAPP_APP_SECRET"),
    },
    {
      key: "WHATSAPP_BUSINESS_PHONE_ID",
      description: "WhatsApp Business Phone ID",
      status: envVars.has("WHATSAPP_BUSINESS_PHONE_ID"),
    },
    {
      key: "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
      description: "Webhook Verify Token",
      status: envVars.has("WHATSAPP_WEBHOOK_VERIFY_TOKEN"),
    },
  ];

  log("blue", "📋 Checking Required Credentials:\n");

  let allPresent = true;
  requiredCredentials.forEach(({ key, description, status }) => {
    if (status) {
      log("green", `  ✓ ${description} (${key})`);
    } else {
      log("red", `  ✗ ${description} (${key})`);
      allPresent = false;
    }
  });

  console.log("");

  if (allPresent) {
    log("green", "✅ All credentials are configured!\n");
    log("cyan", "Next steps:");
    log("cyan", "1. Configure webhook in Meta App Dashboard:");
    log("cyan", "   - Callback URL: https://yourdomain.com/api/whatsapp/webhook");
    log("cyan", "   - Verify Token: (Use WHATSAPP_WEBHOOK_VERIFY_TOKEN value)");
    log("cyan", "2. Subscribe to webhook events: messages, message_status");
    log("cyan", "3. Test webhook with: npm run test:whatsapp\n");
  } else {
    log("red", "❌ Missing required credentials!\n");
    log("yellow", "📝 To get these credentials:");
    log("yellow", "1. Go to https://developers.facebook.com");
    log("yellow", "2. Create/select your app");
    log("yellow", "3. Add WhatsApp product");
    log("yellow", "4. Go to WhatsApp → Getting Started");
    log("yellow", "5. Create a WhatsApp Business Account");
    log("yellow", "6. Get your credentials and add them to .env.local\n");
  }

  log("cyan", "📚 Documentation: See WHATSAPP_SETUP.md\n");
}

main().catch(console.error);
