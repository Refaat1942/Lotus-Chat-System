/**
 * WhatsApp API Client
 * Handles sending messages and media via WhatsApp Business API
 */

export interface WhatsAppMessage {
  phone_number: string;
  message_type: "text" | "media" | "template";
  text?: string;
  media_url?: string;
  media_type?: "image" | "video" | "audio" | "document";
}

export class WhatsAppClient {
  private apiToken: string;
  private phoneId: string;
  private apiUrl = "https://graph.instagram.com/v18.0";

  constructor(apiToken?: string, phoneId?: string) {
    this.apiToken = apiToken || process.env.WHATSAPP_API_TOKEN || "";
    this.phoneId = phoneId || process.env.WHATSAPP_BUSINESS_PHONE_ID || "";

    if (!this.apiToken || !this.phoneId) {
      throw new Error(
        "WhatsApp API token and phone ID are required. Set WHATSAPP_API_TOKEN and WHATSAPP_BUSINESS_PHONE_ID in environment variables."
      );
    }
  }

  /**
   * Send a text message
   */
  async sendTextMessage(phoneNumber: string, text: string): Promise<string> {
    try {
      const response = await fetch(
        `${this.apiUrl}/${this.phoneId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiToken}`,
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: phoneNumber,
            type: "text",
            text: {
              preview_url: false,
              body: text,
            },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`);
      }

      const data = (await response.json()) as { messages: Array<{ id: string }> };
      return data.messages[0].id;
    } catch (error) {
      console.error("Error sending WhatsApp message:", error);
      throw error;
    }
  }

  /**
   * Send a media message (image, video, audio, document)
   */
  async sendMediaMessage(
    phoneNumber: string,
    mediaUrl: string,
    mediaType: "image" | "video" | "audio" | "document",
    caption?: string
  ): Promise<string> {
    try {
      const payload: Record<string, unknown> = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phoneNumber,
        type: mediaType,
        [mediaType]: {
          link: mediaUrl,
        },
      };

      if (caption && (mediaType === "image" || mediaType === "video")) {
        payload[mediaType] = {
          ...payload[mediaType],
          caption,
        };
      }

      const response = await fetch(
        `${this.apiUrl}/${this.phoneId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiToken}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`);
      }

      const data = (await response.json()) as { messages: Array<{ id: string }> };
      return data.messages[0].id;
    } catch (error) {
      console.error("Error sending WhatsApp media message:", error);
      throw error;
    }
  }

  /**
   * Send a template message
   */
  async sendTemplateMessage(
    phoneNumber: string,
    templateName: string,
    languageCode: string = "en",
    parameters?: string[]
  ): Promise<string> {
    try {
      const payload: Record<string, unknown> = {
        messaging_product: "whatsapp",
        to: phoneNumber,
        type: "template",
        template: {
          name: templateName,
          language: {
            code: languageCode,
          },
        },
      };

      if (parameters && parameters.length > 0) {
        payload.template = {
          ...payload.template,
          components: [
            {
              type: "body",
              parameters: parameters.map((p) => ({ type: "text", text: p })),
            },
          ],
        };
      }

      const response = await fetch(
        `${this.apiUrl}/${this.phoneId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiToken}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`);
      }

      const data = (await response.json()) as { messages: Array<{ id: string }> };
      return data.messages[0].id;
    } catch (error) {
      console.error("Error sending WhatsApp template message:", error);
      throw error;
    }
  }

  /**
   * Mark a message as read
   */
  async markMessageAsRead(messageId: string): Promise<void> {
    try {
      await fetch(`${this.apiUrl}/${this.phoneId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiToken}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          status: "read",
          message_id: messageId,
        }),
      });
    } catch (error) {
      console.error("Error marking WhatsApp message as read:", error);
      throw error;
    }
  }
}

export default new WhatsAppClient();
