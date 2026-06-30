import { Router, Request, Response } from 'express';
import { leadService } from '../services/lead';
import { processMessage } from '../ai/conversation';
import { query } from '../db';
import { getDefaultAgencyId } from '../db/init';

export const twilioWebhookRouter = Router();

function twiml(message: string): string {
  const escaped = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`;
}

twilioWebhookRouter.post('/', async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, string>;
    const from = body.From?.replace('whatsapp:', '') || '';
    const incomingText = body.Body || '';
    const contactName = body.ProfileName || '';
    const messageId = body.MessageSid || '';

    if (!from || !incomingText) {
      return res.status(200).set('Content-Type', 'text/xml').send('<Response></Response>');
    }

    const agencyId = getDefaultAgencyId();

    const { lead } = await leadService.findOrCreate(agencyId, from, contactName || undefined);

    // ── New session detection ─────────────────────────────────────────────────
    // Detect if this is a new session: user sent a greeting OR last message was
    // more than 30 minutes ago. If so, close old conversation, start fresh, and
    // reset qualifying fields so the 5-question flow restarts from Q1.
    const greetings = /^(hi|hello|hey|start|help|hola|مرحبا|سلام|bonjour|salut|ciao|hej)\b/i;
    const isGreeting = greetings.test(incomingText.trim());

    // Find last message time across ALL conversations for this lead
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
      // Close all old active conversations for this lead
      await query(
        `UPDATE conversations SET status = 'closed' WHERE lead_id = $1 AND status IN ('active', 'ai_handling')`,
        [lead.id]
      );
      // Reset qualifying fields
      await query(
        `UPDATE leads SET intent = NULL, property_type = NULL, preferred_areas = NULL,
         budget_min = NULL, budget_max = NULL, timeline = NULL WHERE id = $1`,
        [lead.id]
      );
    }

    // Get or create conversation AFTER potential reset above
    const conversation = await leadService.getOrCreateConversation(lead.id as string, agencyId);

    await leadService.saveMessage(conversation.id as string, 'inbound', incomingText, {
      senderType: 'lead',
      messageType: 'text',
      whatsappMessageId: messageId,
    });

    if (conversation.handling_mode === 'agent') {
      return res.status(200).set('Content-Type', 'text/xml').send('<Response></Response>');
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

    if (aiResponse.handoffRequired) {
      try {
        const agentResult = await query(
          `SELECT * FROM agents WHERE agency_id = $1 AND is_active = true ORDER BY RANDOM() LIMIT 1`,
          [agencyId]
        );
        if (agentResult.rows.length) {
          const agent = agentResult.rows[0];
          await query(
            `UPDATE conversations SET handling_mode = 'agent', taken_over_by = $1, taken_over_at = NOW(), status = 'agent_takeover' WHERE id = $2`,
            [agent.id, conversation.id]
          );
          await leadService.updateLead(lead.id as string, { assigned_agent_id: agent.id, status: 'in_progress' });
          await leadService.notifyAgent(agent.id, lead.id as string, `Hot lead: ${(lead.name as string) || from}`);
        }
      } catch (e) {
        console.error('Handoff error:', e);
      }
    }

    const score = (leadUpdates.score as number) || 0;
    if (score >= 80) await leadService.updateLead(lead.id as string, { status: 'hot' });
    else if (score >= 40) await leadService.updateLead(lead.id as string, { status: 'qualifying' });

    return res.status(200).set('Content-Type', 'text/xml').send(twiml(aiResponse.message));

  } catch (err) {
    const e = err as Error;
    console.error('Twilio webhook error:', e);
    return res.status(200).set('Content-Type', 'text/xml').send(
      twiml('Sorry, I am having a technical issue. Please try again in a moment.')
    );
  }
});
