import { Router, type Request, type Response } from "express";
import { db, conversations, messages, customers } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// GET /api/whatsapp/webhook - Verify webhook token (required by WhatsApp)
router.get("/whatsapp/webhook", (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (
    mode === "subscribe" &&
    token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
  ) {
    console.log("Webhook verified successfully");
    res.status(200).send(challenge);
  } else {
    res.status(403).json({ error: "Forbidden" });
  }
});

// POST /api/whatsapp/webhook - Receive incoming messages from WhatsApp
router.post("/whatsapp/webhook", async (req: Request, res: Response) => {
  try {
    const body = req.body;

    // Acknowledge receipt immediately
    res.status(200).json({ success: true });

    // Check if this is a message event
    if (body.object !== "whatsapp_business_account") {
      return;
    }

    const entries = body.entry || [];

    for (const entry of entries) {
      const changes = entry.changes || [];

      for (const change of changes) {
        const messageData = change.value;
        const messages_data = messageData.messages || [];
        const statusData = messageData.statuses || [];

        // Handle incoming messages
        for (const message of messages_data) {
          if (message.type === "text") {
            const phoneNumber = message.from;
            const messageText = message.text.body;
            const messageId = message.id;
            const timestamp = message.timestamp;

            // Find or create customer by phone
            let customer = await db.query.customers.findFirst({
              where: (customers, { eq }) =>
                eq(customers.phone_number, phoneNumber),
            });

            if (!customer) {
              // Create new customer if doesn't exist
              const result = await db
                .insert(customers)
                .values({
                  name: `Customer ${phoneNumber}`,
                  phone_number: phoneNumber,
                  email: null,
                  branch_id: null,
                  is_blocked: false,
                })
                .returning();

              customer = result[0];
            }

            // Find or create conversation
            let conversation = await db.query.conversations.findFirst({
              where: (conversations, { and, eq }) =>
                and(
                  eq(conversations.customer_id, customer.id),
                  eq(conversations.status, "open")
                ),
            });

            if (!conversation) {
              const result = await db
                .insert(conversations)
                .values({
                  customer_id: customer.id,
                  assigned_to: null,
                  status: "open",
                  source: "whatsapp",
                })
                .returning();

              conversation = result[0];
            }

            // Save incoming message
            await db.insert(messages).values({
              conversation_id: conversation.id,
              sender_id: null,
              sender_type: "customer",
              content: messageText,
              external_message_id: messageId,
              created_at: new Date(parseInt(timestamp) * 1000),
            });

            console.log(
              `WhatsApp message received from ${phoneNumber}: ${messageText}`
            );
          }
        }

        // Handle message status updates (delivered, read, failed)
        for (const status of statusData) {
          const messageId = status.id;
          const statusType = status.status; // delivered, read, failed, sent

          console.log(`Message ${messageId} status: ${statusType}`);

          // Update message status in DB if needed
          if (statusType === "read") {
            await db
              .update(messages)
              .set({ read_at: new Date() })
              .where(eq(messages.external_message_id, messageId));
          }
        }
      }
    }
  } catch (error) {
    console.error("Error processing WhatsApp webhook:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
