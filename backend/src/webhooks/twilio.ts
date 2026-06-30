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

    let agencyId: string;
    try {
      agencyId = getDefaultAgencyId();
    } catch (e) {
      const err = e as Error;
      return res.status(200).set('Content-Type', 'text/xml').send(twiml(`DEBUG-AGENCY: ${err.message}`));
    }

    let lead: Record<string, unknown>;
    try {
      const result = await leadService.findOrCreate(agencyId, from, contactName || undefined);
      lead = result.lead;
    } catch (e) {
      const err = e as Error;
      return res.status(200).set('Content-Type', 'text/xml').send(twiml(`DEBUG-LEAD: ${err.message}`));
    }

    let conversation: Record<string, unknown>;
    try {
      conversation = await leadService.getOrCreateConversation(lead.id as string, agencyId);
    } catch (e) {
      const err = e as Error;
      return res.status(200).set('Content-Type', 'text/xml').send(twiml(`DEBUG-CONV: ${err.message}`));
    }

    try {
      await leadService.saveMessage(conversation.id as string, 'inbound', incomingText, {
        senderType: 'lead',
        messageType: 'text',
        whatsappMessageId: messageId,
      });
    } catch (e) {
      const err = e as Error;
      return res.status(200).set('Content-Type', 'text/xml').send(twiml(`DEBUG-SAVEMSG: ${err.message}`));
    }

    if (conversation.handling_mode === 'agent') {
      return res.status(200).set('Content-Type', 'text/xml').send('<Response></Response>');
    }

    await leadService.updateLead(lead.id as string, { last_contacted_at: new Date() });

    let aiResponse: { message: string; leadUpdates: Record<string, unknown>; handoffRequired: boolean; handoffReason: string | null };
    try {
      aiResponse = await processMessage(
        conversation.id as string,
        lead.id as string,
        incomingText,
        'text',
        undefined
      );
    } catch (e) {
      const err = e as Error;
      return res.status(200).set('Content-Type', 'text/xml').send(twiml(`DEBUG-AI: ${err.message}`));
    }

    if (Object.keys(aiResponse.leadUpdates).length > 0) {
      await leadService.updateLead(lead.id as string, aiResponse.leadUpdates);
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
          await leadService.notifyAgent(agent.id, lead.id as string, `Hot lead: ${lead.name || from}`);
        }
      } catch (e) {
        console.error('Handoff error:', e);
      }
    }

    const score = aiResponse.leadUpdates.score as number;
    if (score >= 80) await leadService.updateLead(lead.id as string, { status: 'hot' });
    else if (score >= 40) await leadService.updateLead(lead.id as string, { status: 'qualifying' });

    return res.status(200).set('Content-Type', 'text/xml').send(twiml(aiResponse.message));

  } catch (err) {
    const e = err as Error;
    console.error('Twilio webhook error:', e);
    return res.status(200).set('Content-Type', 'text/xml').send(twiml(`DEBUG-UNKNOWN: ${e.message}`));
  }
});
