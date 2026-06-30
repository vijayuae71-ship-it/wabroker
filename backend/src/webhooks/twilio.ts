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
    const conversation = await leadService.getOrCreateConversation(lead.id, agencyId);

    await leadService.saveMessage(conversation.id, 'inbound', incomingText, {
      senderType: 'lead',
      messageType: 'text',
      whatsappMessageId: messageId,
    });

    if (conversation.handling_mode === 'agent') {
      return res.status(200).set('Content-Type', 'text/xml').send('<Response></Response>');
    }

    await leadService.updateLead(lead.id, { last_contacted_at: new Date() });

    const aiResponse = await processMessage(
      conversation.id,
      lead.id,
      incomingText,
      'text',
      undefined
    );

    if (Object.keys(aiResponse.leadUpdates).length > 0) {
      await leadService.updateLead(lead.id, aiResponse.leadUpdates);
    }

    await leadService.saveMessage(conversation.id, 'outbound', aiResponse.message, {
      senderType: 'ai',
      whatsappMessageId: undefined,
    });

    if (aiResponse.handoffRequired) {
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
        await leadService.updateLead(lead.id, { assigned_agent_id: agent.id, status: 'in_progress' });
        await leadService.notifyAgent(agent.id, lead.id, `🔥 Hot lead ready! ${lead.name || lead.whatsapp_number} — ${aiResponse.handoffReason || 'Qualified buyer'}`);
      }
    }

    const score = aiResponse.leadUpdates.score as number;
    if (score >= 80) await leadService.updateLead(lead.id, { status: 'hot' });
    else if (score >= 40) await leadService.updateLead(lead.id, { status: 'qualifying' });

    return res.status(200).set('Content-Type', 'text/xml').send(twiml(aiResponse.message));

  } catch (err) {
    console.error('Twilio webhook error:', err);
    return res.status(200).set('Content-Type', 'text/xml').send('<Response><Message>Sorry, I am having a technical issue. Please try again in a moment.</Message></Response>');
  }
});
