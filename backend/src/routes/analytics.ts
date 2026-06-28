import { Router, Request, Response } from 'express';
import { query } from '../db';
import { authMiddleware } from '../middleware/auth';

export const analyticsRouter = Router();
analyticsRouter.use(authMiddleware);

// GET /api/analytics/overview
analyticsRouter.get('/overview', async (req: Request, res: Response) => {
  try {
    const agencyId = (req as Request & { agencyId: string }).agencyId;

    const [totalLeads, hotLeads, todayLeads, avgScore, conversionRate] = await Promise.all([
      query('SELECT COUNT(*) FROM leads WHERE agency_id = $1', [agencyId]),
      query('SELECT COUNT(*) FROM leads WHERE agency_id = $1 AND status = $2', [agencyId, 'hot']),
      query('SELECT COUNT(*) FROM leads WHERE agency_id = $1 AND DATE(created_at) = CURRENT_DATE', [agencyId]),
      query('SELECT AVG(score) FROM leads WHERE agency_id = $1', [agencyId]),
      query(
        `SELECT 
          COUNT(CASE WHEN status = 'converted' THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100 as rate
         FROM leads WHERE agency_id = $1`,
        [agencyId]
      ),
    ]);

    res.json({
      totalLeads: parseInt(totalLeads.rows[0].count),
      hotLeads: parseInt(hotLeads.rows[0].count),
      todayLeads: parseInt(todayLeads.rows[0].count),
      avgScore: Math.round(parseFloat(avgScore.rows[0].avg || '0')),
      conversionRate: parseFloat(conversionRate.rows[0].rate || '0').toFixed(1),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// GET /api/analytics/leads-by-intent
analyticsRouter.get('/leads-by-intent', async (req: Request, res: Response) => {
  try {
    const agencyId = (req as Request & { agencyId: string }).agencyId;
    const result = await query(
      `SELECT intent, COUNT(*) as count FROM leads WHERE agency_id = $1 GROUP BY intent`,
      [agencyId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// GET /api/analytics/leads-over-time
analyticsRouter.get('/leads-over-time', async (req: Request, res: Response) => {
  try {
    const agencyId = (req as Request & { agencyId: string }).agencyId;
    const result = await query(
      `SELECT DATE(created_at) as date, COUNT(*) as count 
       FROM leads WHERE agency_id = $1 
       AND created_at > NOW() - INTERVAL '30 days'
       GROUP BY DATE(created_at) ORDER BY date`,
      [agencyId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// GET /api/analytics/notifications
analyticsRouter.get('/notifications', async (req: Request, res: Response) => {
  try {
    const agentId = (req as Request & { agentId: string }).agentId;
    const result = await query(
      `SELECT n.*, l.name as lead_name, l.whatsapp_number 
       FROM notifications n 
       JOIN leads l ON n.lead_id = l.id
       WHERE n.agent_id = $1 AND n.is_read = false
       ORDER BY n.created_at DESC LIMIT 20`,
      [agentId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});
