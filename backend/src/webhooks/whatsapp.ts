import { Router, Request, Response } from 'express';
import { config } from '../config';
import { whatsappService } from '../services/whatsapp';
import { leadService } from '../services/lead';
import { processMessage, transcribeVoiceNote } from '../ai/conversation';
import { query } from '../db';
import { getDefaultAgencyId } from '../db/init';

export const whatsappWebhookRouter = Router();

// Webhook verification (360dialog)
whatsappWebhookRouter.get('/', (req: Request, res: Response) => {
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  if (token === config.whatsappWebhookToken) {
    res.status(200).send(challenge);
  } else {
    res.status(403).send('Forbidden');
  }
});

// Incoming messages
whatsappWebhookRouter.post('/', async (req: Request, res: Response) => {
  // Always respond 200 immediately to WhatsApp
  res.status(200).json({ status: 'ok' });

  try {
    const body = req.body as Record<string, unknown>;
    const parsed = whatsappService.parseWebhookMessage(body);
    
    if (!parsed) return;
    if (!['text', 'audio', 'image'].includes(parsed.type)) return;

    const { from, text, audioId, contactName, messageId } = parsed;

    // Use the default agency seeded at startup
    const agencyId = getDefaultAgencyId();

    // Check if conversation is in agent takeover mode
    const { lead, isNew } = await leadService.findOrCreate(agencyId, from, contactName || undefined);
    const conversation = await leadService.getOrCreateConversation(lead.id, agencyId);

    // If agent has taken over, don't process with AI
    if (conversation.handling_mode === 'agent') {
      // Just save the message and notify the agent
      await leadService.saveMessage(conversation.id, 'inbound', text || '[media]', {
        senderType: 'lead',
        messageType: parsed.type,
        whatsappMessageId: messageId,
      });
      return;
    }

    let incomingText = text || '';
    let transcription: string | undefined;

    // Handle voice notes
    if (parsed.type === 'audio' && audioId) {
      const mediaUrl = await whatsappService.getMediaUrl(audioId);
      if (mediaUrl) {
        const audioBuffer = await whatsappService.downloadMedia(mediaUrl);
        if (audioBuffer) {
          transcription = await transcribeVoiceNote(audioBuffer);
          incomingText = transcription;
        }
      }
    }

    // Save inbound message
    await leadService.saveMessage(conversation.id, 'inbound', incomingText, {
      senderType: 'lead',
      messageType: parsed.type,
      transcription,
      whatsappMessageId: messageId,
    });

    // Update last contacted
    await leadService.updateLead(lead.id, { last_contacted_at: new Date() });

    // Process with AI
    const aiResponse = await processMessage(
      conversation.id,
      lead.id,
      incomingText,
      parsed.type === 'audio' ? 'audio' : 'text',
      transcription
    );

    // Update lead with AI-extracted data
    if (Object.keys(aiResponse.leadUpdates).length > 0) {
      await leadService.updateLead(lead.id, aiResponse.leadUpdates);
    }

    // Send AI response
    const sentId = await whatsappService.sendTextMessage(from, aiResponse.message);

    // Save outbound message
    await leadService.saveMessage(conversation.id, 'outbound', aiResponse.message, {
      senderType: 'ai',
      whatsappMessageId: sentId || undefined,
    });

    // Handle handoff if required
    if (aiResponse.handoffRequired) {
      await handleAgentHandoff(conversation.id, lead, agencyId, aiResponse.handoffReason);
    }

    // Update lead status based on score
    const score = aiResponse.leadUpdates.score as number;
    if (score >= 80) {
      await leadService.updateLead(lead.id, { status: 'hot' });
    } else if (score >= 40) {
      await leadService.updateLead(lead.id, { status: 'qualifying' });
    }

  } catch (err) {
    console.error('Webhook processing error:', err);
  }
});

async function handleAgentHandoff(
  conversationId: string,
  lead: Record<string, unknown>,
  agencyId: string,
  reason: string | null
) {
  // Find available agent
  const agentResult = await query(
    `SELECT * FROM agents WHERE agency_id = $1 AND is_active = true ORDER BY RANDOM() LIMIT 1`,
    [agencyId]
  );

  if (!agentResult.rows.length) return;

  const agent = agentResult.rows[0];

  // Update conversation to agent mode
  await query(
    `UPDATE conversations SET handling_mode = 'agent', taken_over_by = $1, taken_over_at = NOW(), status = 'agent_takeover'
     WHERE id = $2`,
    [agent.id, conversationId]
  );

  // Assign lead to agent
  await leadService.updateLead(lead.id as string, {
    assigned_agent_id: agent.id,
    status: 'in_progress',
  });

  // Create notification for agent
  await leadService.notifyAgent(
    agent.id,
    lead.id as string,
    `🔥 Hot lead ready for handoff! ${lead.name || lead.whatsapp_number} — ${reason || 'Qualified buyer'}`
  );

  // Send WhatsApp notification to agent (if they have a WA number)
  if (agent.whatsapp_number) {
    const leadSummary = `
🔥 *New Hot Lead - Action Required*

*Name:* ${lead.name || 'Unknown'}
*Number:* ${lead.whatsapp_number}
*Intent:* ${lead.intent || 'Buyer'}
*Budget:* AED ${lead.budget_min?.toLocaleString() || '?'} – ${lead.budget_max?.toLocaleString() || '?'}
*Areas:* ${(lead.preferred_areas as string[])?.join(', ') || 'TBC'}
*Score:* ${lead.score}/100

Reply to their number directly. Full conversation in your dashboard.`.trim();

    await whatsappService.sendTextMessage(agent.whatsapp_number, leadSummary);
  }
}
