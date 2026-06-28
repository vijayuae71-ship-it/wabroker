import axios from 'axios';
import { config } from '../config';

const waClient = axios.create({
  baseURL: config.whatsappBaseUrl,
  headers: {
    'Authorization': `Bearer ${config.whatsappToken}`,
    'Content-Type': 'application/json',
  },
});

export const whatsappService = {
  async sendTextMessage(to: string, text: string): Promise<string | null> {
    try {
      const response = await waClient.post(`/${config.whatsappPhoneNumberId}/messages`, {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to.replace('+', '').replace(/\s/g, ''),
        type: 'text',
        text: { body: text },
      });
      return response.data?.messages?.[0]?.id || null;
    } catch (err) {
      console.error('WhatsApp send error:', err);
      return null;
    }
  },

  async sendTemplateMessage(to: string, templateName: string, params: string[]): Promise<string | null> {
    try {
      const response = await waClient.post(`/${config.whatsappPhoneNumberId}/messages`, {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to.replace('+', '').replace(/\s/g, ''),
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'en' },
          components: [{
            type: 'body',
            parameters: params.map(p => ({ type: 'text', text: p })),
          }],
        },
      });
      return response.data?.messages?.[0]?.id || null;
    } catch (err) {
      console.error('WhatsApp template error:', err);
      return null;
    }
  },

  async getMediaUrl(mediaId: string): Promise<string | null> {
    try {
      const response = await waClient.get(`/${mediaId}`);
      return response.data?.url || null;
    } catch (err) {
      console.error('WhatsApp media URL error:', err);
      return null;
    }
  },

  async downloadMedia(mediaUrl: string): Promise<Buffer | null> {
    try {
      const response = await axios.get(mediaUrl, {
        responseType: 'arraybuffer',
        headers: { 'Authorization': `Bearer ${config.whatsappToken}` },
      });
      return Buffer.from(response.data);
    } catch (err) {
      console.error('WhatsApp download error:', err);
      return null;
    }
  },

  // Parse Meta WhatsApp Cloud API webhook format
  parseWebhookMessage(body: Record<string, unknown>) {
    try {
      const entry = (body?.entry as Record<string, unknown>[])?.[0];
      if (!entry) return null;

      const changes = (entry?.changes as Record<string, unknown>[])?.[0];
      if (!changes) return null;

      const value = changes?.value as Record<string, unknown>;
      if (!value) return null;

      const messages = value?.messages as Record<string, unknown>[];
      if (!messages || !messages.length) return null;

      const msg = messages[0] as Record<string, unknown>;
      const contacts = (value?.contacts as Record<string, unknown>[]) || [];
      const contact = contacts[0] as Record<string, unknown>;

      return {
        messageId: msg.id as string,
        from: msg.from as string,
        timestamp: msg.timestamp as string,
        type: msg.type as string,
        text: msg.type === 'text' ? (msg.text as Record<string, string>)?.body : null,
        audioId: msg.type === 'audio' ? (msg.audio as Record<string, string>)?.id : null,
        imageId: msg.type === 'image' ? (msg.image as Record<string, string>)?.id : null,
        contactName: (contact?.profile as Record<string, string>)?.name || null,
      };
    } catch (err) {
      console.error('WhatsApp parse error:', err);
      return null;
    }
  },
};
