import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query } from '../db';
import { config } from '../config';
import { v4 as uuidv4 } from 'uuid';

export const authRouter = Router();

// POST /api/auth/login
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    const result = await query(
      'SELECT * FROM agents WHERE email = $1 AND is_active = true',
      [email]
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const agent = result.rows[0];
    const valid = await bcrypt.compare(password, agent.password_hash);
    
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { agentId: agent.id, agencyId: agent.agency_id, role: agent.role },
      config.jwtSecret as string,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      agent: {
        id: agent.id,
        name: agent.name,
        email: agent.email,
        role: agent.role,
        agencyId: agent.agency_id,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/register (first-time setup)
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { agencyName, whatsappNumber, adminName, email, password } = req.body;

    // Check if any agency exists (prevent multiple registrations)
    const existing = await query('SELECT COUNT(*) FROM agencies');
    if (parseInt(existing.rows[0].count) > 0 && process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Registration closed. Contact admin.' });
    }

    const agencyId = uuidv4();
    const agentId = uuidv4();
    const passwordHash = await bcrypt.hash(password, 12);

    await query(
      `INSERT INTO agencies (id, name, whatsapp_number, subscription_tier, subscription_status, trial_ends_at)
       VALUES ($1, $2, $3, 'starter', 'trial', NOW() + INTERVAL '14 days')`,
      [agencyId, agencyName, whatsappNumber]
    );

    await query(
      `INSERT INTO agents (id, agency_id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5, 'admin')`,
      [agentId, agencyId, adminName, email, passwordHash]
    );

    // Set DEFAULT_AGENCY_ID (in production, set this via env)
    console.log(`✅ Agency created: ${agencyId}`);

    const token = jwt.sign(
      { agentId, agencyId, role: 'admin' },
      config.jwtSecret as string,
      { expiresIn: '7d' }
    );

    res.json({ token, agencyId, agentId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});
