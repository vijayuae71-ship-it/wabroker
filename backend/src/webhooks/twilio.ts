import { Router, Request, Response } from 'express';
import { leadService } from '../services/lead';
import { processMessage } from '../ai/conversation';
import { query } from '../db';
import { getDefaultAgencyId } from '../db/init';

export const twilioWebhookRouter = Router();

// In-memory set to deduplicate concurrent requests for the same MessageSid
// (prevents Twilio retry doubles when processing is slow)
const processingIds = new Set<string>();

twilioWebhookRouter.post('/', async (req: Request, res: Response) => {
  const body = req.body as Record<string, string>;
  const from = body.From?.replace('whatsapp:', '') || '';
  const incomingText = body.Body || '';
  const contactName = body.ProfileName || '';
  const messageId = body.MessageSid || '';

  const sendTwiML = (text: string) => {
    // Escape XML special chars
    const safe = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    res.status(200).set('Content-Type', 'text/xml').send(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${safe}</Message></Response>`
    );
  };

  const sendEmpty = () => {
    res.status(200).set('Content-Type', 'text/xml').send('<Response></Response>');
  };

  if (!from || !incomingText) {
    return sendEmpty();
  }

  // ── Idempotency: deduplicate by MessageSid ────────────────────────────────
  // If we're already processing this exact MessageSid (Twilio retry), drop it
  if (messageId && processingIds.has(messageId)) {
    return sendEmpty();
  }
  if (messageId) processingIds.add(messageId);

  try {
    const agencyId = getDefaultAgencyId();
    const { lead } = await leadService.findOrCreate(agencyId, from, contactName || undefined);

    // ── New session detection ─────────────────────────────────────────────────
    const greetings = /^(hi|hello|hey|start|help|hola|مرحبا|سلام|bonjour|salut|ciao|hej)\b/i;
    const isGreeting = greetings.test(incomingText.trim());

    const lastMsgResult = await query(
      `SELECT m.created_at FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE c.lead_id = $1
       ORDER BY m.created_at DESC LIMIT 1`,
      [lead.id]
    );
    const lastMsgTime = lastMsgResult.rows[0]?.created_at
      ? new Date(lastMsgResult.rows[0].created_at)
      : null;
    const minutesSinceLast = lastMsgTime
      ? (Date.now() - lastMsgTime.getTime()) / 60000
      : 9999;

    const isNewSession = isGreeting || minutesSinceLast > 30 || !lastMsgTime;

    if (isNewSession) {
      await query(
        `UPDATE conversations SET status = 'closed' WHERE lead_id = $1 AND status IN ('active', 'ai_handling')`,
        [lead.id]
      );
      await query(
        `UPDATE leads SET intent = NULL, property_type = NULL, preferred_areas = NULL,
         budget_min = NULL, budget_max = NULL, timeline = NULL WHERE id = $1`,
        [lead.id]
      );
    }

    const conversation = await leadService.getOrCreateConversation(lead.id as string, agencyId);

    // ── Check if this MessageSid was already saved (DB-level dedup) ──────────
    if (messageId) {
      const dup = await query(
        `SELECT id FROM messages WHERE whatsapp_message_id = $1 LIMIT 1`,
        [messageId]
      );
      if (dup.rows.length > 0) {
        processingIds.delete(messageId);
        return sendEmpty();
      }
    }

    await leadService.saveMessage(conversation.id as string, 'inbound', incomingText, {
      senderType: 'lead',
      messageType: 'text',
      whatsappMessageId: messageId,
    });

    if (conversation.handling_mode === 'agent') {
      processingIds.delete(messageId);
      return sendEmpty();
    }

    await leadService.updateLead(lead.id as string, { last_contacted_at: new Date() });

    const aiResponse = await processMessage(
      conversation.id as string,
      lead.id as string,
      incomingText,
      'text',
      undefined
    );

    const leadUpdates = aiResponse.leadUpdates || {};
    if (Object.keys(leadUpdates).length > 0) {
      await leadService.updateLead(lead.id as string, leadUpdates);
    }

    await leadService.saveMessage(conversation.id as string, 'outbound', aiResponse.message, {
      senderType: 'ai',
      whatsappMessageId: undefined,
    });

    // ── Handoff (disabled — Layla is the closer) ──────────────────────────────
    // aiResponse.handoffRequired is ignored

    const score = (leadUpdates.score as number) || 0;
    if (score >= 80) await leadService.updateLead(lead.id as string, { status: 'hot' });
    else if (score >= 40) await leadService.updateLead(lead.id as string, { status: 'qualifying' });

    // ── Reply via TwiML ───────────────────────────────────────────────────────
    sendTwiML(aiResponse.message);

  } catch (err) {
    console.error('Twilio webhook error:', err);
    sendTwiML('Sorry, I\'m having a technical issue. Please try again in a moment.');
  } finally {
    if (messageId) processingIds.delete(messageId);
  }
});
