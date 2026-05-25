import { Router, type Request, type Response } from "express";
import { db, messages } from "@workspace/db";
import whatsappClient from "@workspace/integrations-openai-ai-server/src/whatsapp-client";
import { requireAuth } from "../middlewares/auth";
import { eq } from "drizzle-orm";

const router = Router();

/**
 * POST /api/messages
 * Create a new message in a conversation
 * If conversation is with a customer via WhatsApp, send message via WhatsApp API
 */
router.post("/messages", requireAuth, async (req: Request, res: Response) => {
  try {
    const { conversation_id, content } = req.body;
    const userId = (req as any).user.id;

    // Get conversation details
    const conversation = await db.query.conversations.findFirst({
      where: (conversations, { eq }) => eq(conversations.id, conversation_id),
      with: {
        customer: true,
      },
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Save message to database
    const message = await db
      .insert(messages)
      .values({
        conversation_id,
        sender_id: userId,
        sender_type: "agent",
        content,
      })
      .returning();

    // If conversation is via WhatsApp, send message to WhatsApp API
    if (
      conversation.source === "whatsapp" &&
      conversation.customer?.phone_number
    ) {
      try {
        const externalMessageId = await whatsappClient.sendTextMessage(
          conversation.customer.phone_number,
          content
        );

        // Update message with external message ID
        await db
          .update(messages)
          .set({ external_message_id: externalMessageId })
          .where(eq(messages.id, message[0].id));

        console.log(
          `Message sent to WhatsApp: ${externalMessageId} to ${conversation.customer.phone_number}`
        );
      } catch (error) {
        console.error("Error sending message to WhatsApp:", error);
        // Message is saved in DB even if WhatsApp send fails
        // You may want to add a retry mechanism or notify the user
      }
    }

    res.status(201).json(message[0]);
  } catch (error) {
    console.error("Error creating message:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
