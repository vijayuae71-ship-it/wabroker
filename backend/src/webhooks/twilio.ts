import { Router, Request, Response } from 'express';
import { leadService } from '../services/lead';
import { processMessage } from '../ai/conversation';
import { query } from '../db';
import { getDefaultAgencyId } from '../db/init';

export const twilioWebhookRouter = Router();

// DB-backed dedup table (created on first use)
async function ensureDedupTable() {
  await query(
    `CREATE TABLE IF NOT EXISTS processed_message_sids (
      sid TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    []
  );
}

// Returns true if this SID was already processed (atomic insert)
async function markSidProcessed(sid: string): Promise<boolean> {
  try {
    await ensureDedupTable();
    const result = await query(
      `INSERT INTO processed_message_sids (sid) VALUES ($1) ON CONFLICT (sid) DO NOTHING`,
      [sid]
    );
    return (result.rowCount ?? 0) === 0; // 0 rows inserted = duplicate
  } catch {
    return false;
  }
}

twilioWebhookRouter.post('/', async (req: Request, res: Response) => {
  const body = req.body as Record<string, string>;
  const from = body.From?.replace('whatsapp:', '') || '';
  const twilioFrom = body.To || 'whatsapp:+14155238886'; // our sandbox number
  const incomingText = body.Body || '';
  const contactName = body.ProfileName || '';
  const messageId = body.MessageSid || '';

  // ── Respond to Twilio IMMEDIATELY — prevents 5s timeout retries ──────────
  res.status(200).set('Content-Type', 'text/xml').send('<Response></Response>');

  if (!from || !incomingText || !messageId) return;

  // ── DB-level idempotency — drop Twilio retries for same MessageSid ────────
  const isDuplicate = await markSidProcessed(messageId);
  if (isDuplicate) {
    console.log(`[twilio] Duplicate SID dropped: ${messageId}`);
    return;
  }

  // ── Process message async (Twilio already has its 200) ───────────────────
  setImmediate(async () => {
    try {
      const agencyId = getDefaultAgencyId();
      const { lead } = await leadService.findOrCreate(agencyId, from, contactName || undefined);

      // ── New session detection ─────────────────────────────────────────────
      const greetings = /^(hi|hello|hey|start|help|hola|مرحبا|سلام|bonjour|salut|ciao|hej)\b/i;
      const isGreeting = greetings.test(incomingText.trim());

      const lastMsgResult = await query(
        `SELECT m.created_at FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
         WHERE c.lead_id = $1
         ORDER BY m.created_at DESC LIMIT 1`,
        [lead.id]
      );
      const lastMsgAt = lastMsgResult.rows[0]?.created_at
        ? new Date(lastMsgResult.rows[0].created_at)
        : null;
      const minutesSinceLast = lastMsgAt
        ? (Date.now() - lastMsgAt.getTime()) / 60000
        : Infinity;
      const isNewSession = isGreeting || minutesSinceLast >= 30;

      if (isNewSession) {
        // Close existing conversations and clear qualifying fields
        await query(
          `UPDATE conversations SET status = 'completed' WHERE lead_id = $1 AND status = 'active'`,
          [lead.id]
        );
        await query(
          `UPDATE leads SET
            intent = NULL,
            property_type = NULL,
            preferred_areas = NULL,
            budget_min = NULL,
            budget_max = NULL,
            timeline = NULL
          WHERE id = $1`,
          [lead.id]
        );
      }

      // Get or create a fresh conversation
      const conversation = await leadService.getOrCreateConversation(lead.id as string, agencyId);

      // Save inbound message
      await leadService.saveMessage(conversation.id as string, 'inbound', incomingText, {
        senderType: 'lead',
        messageType: 'text',
        whatsappMessageId: messageId,
      });

      // Skip if agent is handling manually
      if (conversation.handling_mode === 'agent') {
        console.log(`[twilio] Lead ${lead.id} in agent mode — AI skipped`);
        return;
      }

      // Run stage machine
      const aiResponse = await processMessage(
        conversation.id as string,
        lead.id as string,
        incomingText,
        'text',
        undefined
      );

      // Save outbound message
      await leadService.saveMessage(conversation.id as string, 'outbound', aiResponse.message, {
        senderType: 'ai',
        messageType: 'text',
      });

      // Send reply via Twilio REST API
      await sendWhatsApp(twilioFrom, `whatsapp:${from.startsWith('+') ? from : '+' + from}`, aiResponse.message);

    } catch (err) {
      console.error('[twilio] async processing error:', err);
    }
  });
});

async function sendWhatsApp(from: string, to: string, body: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
  const authToken = process.env.TWILIO_AUTH_TOKEN || '';
  if (!accountSid || !authToken) {
    console.error('[twilio] Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN');
    return;
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const params = new URLSearchParams({ From: from, To: to, Body: body });
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    if (!resp.ok) {
      const errData = await resp.json() as Record<string, unknown>;
      console.error('[twilio] send failed:', errData);
    } else {
      console.log('[twilio] message sent to', to);
    }
  } catch (e) {
    console.error('[twilio] send error:', e);
  }
}
