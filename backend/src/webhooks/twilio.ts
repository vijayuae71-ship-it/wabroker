import { Router, Request, Response } from 'express';
import { leadService } from '../services/lead';
import { processMessage } from '../ai/conversation';
import { query } from '../db';
import { getDefaultAgencyId } from '../db/init';

export const twilioWebhookRouter = Router();

// DB-backed dedup — returns true if this SID is NEW (first time seen)
async function tryClaimSid(sid: string): Promise<boolean> {
  try {
    await query(
      `CREATE TABLE IF NOT EXISTS processed_message_sids (
        sid TEXT PRIMARY KEY,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      []
    );
    const result = await query(
      `INSERT INTO processed_message_sids (sid) VALUES ($1) ON CONFLICT (sid) DO NOTHING RETURNING sid`,
      [sid]
    );
    // Returns 1 row if INSERT succeeded (new SID), 0 rows if conflict (duplicate)
    return (result.rows?.length ?? 0) > 0;
  } catch {
    return true; // On error, allow processing (better to duplicate than drop)
  }
}

twilioWebhookRouter.post('/', async (req: Request, res: Response) => {
  const body = req.body as Record<string, string>;
  const from = body.From?.replace('whatsapp:', '') || '';
  const incomingText = body.Body || '';
  const contactName = body.ProfileName || '';
  const messageId = body.MessageSid || '';

  if (!from || !incomingText) {
    res.status(200).set('Content-Type', 'text/xml').send('<Response></Response>');
    return;
  }

  // ── Dedup: drop Twilio retries ────────────────────────────────────────────
  if (messageId) {
    const isNew = await tryClaimSid(messageId);
    if (!isNew) {
      console.log(`[twilio] Duplicate SID dropped: ${messageId}`);
      res.status(200).set('Content-Type', 'text/xml').send('<Response></Response>');
      return;
    }
  }

  try {
    const agencyId = getDefaultAgencyId();
    const { lead } = await leadService.findOrCreate(agencyId, from, contactName || undefined);

    // ── New session detection (greeting or 30-min gap) ────────────────────
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

    const conversation = await leadService.getOrCreateConversation(lead.id as string, agencyId);

    await leadService.saveMessage(conversation.id as string, 'inbound', incomingText, {
      senderType: 'lead',
      messageType: 'text',
      whatsappMessageId: messageId || undefined,
    });

    if (conversation.handling_mode === 'agent') {
      res.status(200).set('Content-Type', 'text/xml').send('<Response></Response>');
      return;
    }

    // Re-fetch lead (may have been reset above)
    const freshLead = await query(`SELECT * FROM leads WHERE id = $1`, [lead.id]);
    const currentLead = freshLead.rows[0] || lead;

    const aiResponse = await processMessage(
      conversation.id as string,
      currentLead.id as string,
      incomingText,
      'text',
      undefined
    );

    // ── Persist lead updates returned by stage machine ────────────────────
    if (aiResponse.leadUpdates && Object.keys(aiResponse.leadUpdates).length > 0) {
      await leadService.updateLead(currentLead.id as string, aiResponse.leadUpdates);
    }

    await leadService.saveMessage(conversation.id as string, 'outbound', aiResponse.message, {
      senderType: 'ai',
      messageType: 'text',
    });

    // ── Respond via TwiML (synchronous, reliable) ─────────────────────────
    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(aiResponse.message)}</Message></Response>`;
    res.status(200).set('Content-Type', 'text/xml').send(twiml);

  } catch (err) {
    console.error('[twilio] processing error:', err);
    const errMsg = `Hi! I'm Layla 👋 I had a small hiccup. Are you looking to *Buy* or *Rent* in Dubai?\n\nReply 1 for Buy, 2 for Rent.`;
    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(errMsg)}</Message></Response>`;
    res.status(200).set('Content-Type', 'text/xml').send(twiml);
  }
});

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
