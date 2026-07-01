import express from 'express';
import { processWebMessage, WebChatMessage, PrefilledParams } from '../ai/webConversation';
import { leadService } from '../services/lead';
import { getDefaultAgencyId } from '../db/init';

export const webchatRouter = express.Router();

webchatRouter.post('/message', async (req, res) => {
  try {
    const { message, history = [], prefilled, leadInfo, leadId: incomingLeadId, sessionId } = req.body as {
      message: string;
      history: WebChatMessage[];
      prefilled?: PrefilledParams;
      leadInfo?: { name?: string; phone?: string; email?: string };
      leadId?: string;       // from URL param (WhatsApp hand-off) or sessionStorage
      sessionId?: string;    // browser-generated UUID for anonymous web sessions
    };

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    // ── Resolve or create a lead ───────────────────────────────────────────
    let resolvedLeadId: string | null = incomingLeadId || null;
    let conversation: { id: string; handling_mode?: string } | null = null;

    try {
      const agencyId = getDefaultAgencyId();

      if (resolvedLeadId) {
        // Known lead (came from WhatsApp or returning web visitor)
        const conv = await leadService.getOrCreateConversation(resolvedLeadId, agencyId);
        conversation = conv;
      } else if (sessionId) {
        // Anonymous web visitor — find-or-create by sessionId as a pseudo phone
        const pseudoPhone = `web_${sessionId}`;
        const { lead } = await leadService.findOrCreate(agencyId, pseudoPhone, leadInfo?.name || undefined);
        resolvedLeadId = lead.id as string;
        const conv = await leadService.getOrCreateConversation(resolvedLeadId, agencyId);
        conversation = conv;
      }

      // Save inbound message to DB
      if (conversation?.id) {
        await leadService.saveMessage(conversation.id, 'inbound', message === '__prefilled__' ? '[prefilled search]' : message, {
          senderType: 'lead', messageType: 'text',
        });
      }
    } catch (dbErr) {
      // DB errors must not block the AI response
      console.error('[webchat] DB save error (non-fatal):', dbErr);
    }

    // ── Run AI ─────────────────────────────────────────────────────────────
    const result = await processWebMessage(message.trim(), history, prefilled, leadInfo);

    // ── Save AI response to DB ─────────────────────────────────────────────
    try {
      if (conversation?.id) {
        await leadService.saveMessage(conversation.id, 'outbound', result.message, {
          senderType: 'ai',
          messageType: 'text',
        });
        // Update lead name/contact if provided
        if (resolvedLeadId && (leadInfo?.name || leadInfo?.phone || leadInfo?.email)) {
          const { query } = await import('../db');
          const updates: string[] = [];
          const values: unknown[] = [];
          let i = 1;
          if (leadInfo?.name) { updates.push(`name = $${i++}`); values.push(leadInfo.name); }
          if (leadInfo?.phone) { updates.push(`phone = $${i++}`); values.push(leadInfo.phone); }
          if (leadInfo?.email) { updates.push(`email = $${i++}`); values.push(leadInfo.email); }
          if (updates.length) {
            values.push(resolvedLeadId);
            await query(`UPDATE leads SET ${updates.join(', ')} WHERE id = $${i}`, values);
          }
        }
      }
    } catch (dbErr) {
      console.error('[webchat] DB outbound save error (non-fatal):', dbErr);
    }

    res.json({ ...result, leadId: resolvedLeadId });
  } catch (err) {
    console.error('[webchat] error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});
