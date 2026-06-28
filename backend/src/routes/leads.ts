import { Router, Request, Response } from 'express';
import { leadService } from '../services/lead';
import { authMiddleware } from '../middleware/auth';

export const leadsRouter = Router();
leadsRouter.use(authMiddleware);

// GET /api/leads
leadsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { status, minScore, intent, limit, offset } = req.query;
    const agencyId = (req as Request & { agencyId: string }).agencyId;

    const leads = await leadService.getLeadsByAgency(agencyId, {
      status: status as string,
      minScore: minScore ? parseInt(minScore as string) : undefined,
      intent: intent as string,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
    });

    res.json({ leads, total: leads.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// GET /api/leads/:id/messages
leadsRouter.get('/:id/messages', async (req: Request, res: Response) => {
  try {
    const result = await leadService.getConversationMessages(req.params.id);
    res.json({ messages: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// PATCH /api/leads/:id
leadsRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    await leadService.updateLead(req.params.id, req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

// POST /api/leads/:id/takeover - agent manually takes over conversation
leadsRouter.post('/:id/takeover', async (req: Request, res: Response) => {
  try {
    const { query } = await import('../db');
    const agentId = (req as Request & { agentId: string }).agentId;

    await query(
      `UPDATE conversations SET handling_mode = 'agent', taken_over_by = $1, taken_over_at = NOW()
       WHERE lead_id = $2 AND status = 'active'`,
      [agentId, req.params.id]
    );

    res.json({ success: true, message: 'Conversation taken over' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to take over conversation' });
  }
});
