import { config } from '../config';

const TWILIO_API = `https://api.twilio.com/2010-04-01/Accounts/${config.twilioAccountSid}/Messages.json`;

function basicAuth() {
  return Buffer.from(`${config.twilioAccountSid}:${config.twilioAuthToken}`).toString('base64');
}

export const twilioService = {
  async sendTextMessage(to: string, text: string): Promise<string | null> {
    try {
      const params = new URLSearchParams({
        From: `whatsapp:${config.twilioWhatsappNumber}`,
        To: `whatsapp:${to.startsWith('+') ? to : '+' + to}`,
        Body: text,
      });

      const response = await fetch(TWILIO_API, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth()}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      const data = await response.json() as Record<string, unknown>;
      if (!response.ok) {
        console.error('Twilio send error:', data);
        return null;
      }
      return data.sid as string || null;
    } catch (err) {
      console.error('Twilio send error:', err);
      return null;
    }
  },

  parseWebhookMessage(body: Record<string, string>) {
    try {
      const from = body.From?.replace('whatsapp:', '') || null;
      const text = body.Body || null;
      const messageId = body.MessageSid || null;
      const contactName = body.ProfileName || null;
      const mediaUrl = body.MediaUrl0 || null;
      const mediaType = body.MediaContentType0 || null;

      if (!from || !messageId) return null;

      let type = 'text';
      if (mediaType?.startsWith('audio')) type = 'audio';
      else if (mediaType?.startsWith('image')) type = 'image';

      return {
        messageId,
        from,
        timestamp: String(Date.now()),
        type,
        text,
        audioId: null,
        imageId: null,
        audioUrl: type === 'audio' ? mediaUrl : null,
        imageUrl: type === 'image' ? mediaUrl : null,
        contactName,
      };
    } catch (err) {
      console.error('Twilio parse error:', err);
      return null;
    }
  },
};
