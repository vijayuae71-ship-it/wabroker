import { Router, Request, Response } from 'express';
import { twilioService } from '../services/twilio';
import { leadService } from '../services/lead';
import { processMessage } from '../ai/conversation';
import { query } from '../db';
import { getDefaultAgencyId } from '../db/init';

export const twilioWebhookRouter = Router();

twilioWebhookRouter.post('/', async (req: Request, res: Response) => {
  res.status(200).set('Content-Type', 'text/xml').send('<Response></Response>');

  try {
    const body = req.body as Record<string, string>;
    const parsed = twilioService.parseWebhookMessage(body);

    if (!parsed) return;
    if (!parsed.text && parsed.type === 'text') return;

    const { from, text, contactName, messageId } = parsed;
    const incomingText = text || '';

    const agencyId = getDefaultAgencyId();

    const { lead } = await leadService.findOrCreate(agencyId, from, contactName || undefined);
    const conversation = await leadService.getOrCreateConversation(lead.id, agencyId);

    if (conversation.handling_mode === 'agent') {
      await leadService.saveMessage(conversation.id, 'inbound', incomingText, {
        senderType: 'lead',
        messageType: parsed.type,
        whatsappMessageId: messageId,
      });
      return;
    }

    await leadService.saveMessage(conversation.id, 'inbound', incomingText, {
      senderType: 'lead',
      messageType: parsed.type,
      whatsappMessageId: messageId,
    });

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

    const sentId = await twilioService.sendTextMessage(from, aiResponse.message);

    await leadService.saveMessage(conversation.id, 'outbound', aiResponse.message, {
      senderType: 'ai',
      whatsappMessageId: sentId || undefined,
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

  } catch (err) {
    console.error('Twilio webhook error:', err);
  }
});
