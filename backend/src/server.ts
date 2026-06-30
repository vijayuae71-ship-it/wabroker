import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { whatsappWebhookRouter } from './webhooks/whatsapp';
import { leadsRouter } from './routes/leads';
import { analyticsRouter } from './routes/analytics';
import { authRouter } from './routes/auth';
import { pool } from './db';
import { initDatabase } from './db/init';
import { whatsappService } from './services/whatsapp';

const app = express();

// Trust Railway's proxy (required for rate-limit + correct IP headers)
app.set('trust proxy', 1);

// Security
app.use(helmet());
app.use(cors({ origin: config.dashboardUrl, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api', limiter);

// Webhook (no rate limit — WhatsApp sends many messages)
app.use('/webhook', whatsappWebhookRouter);

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/analytics', analyticsRouter);

// Send hello_world template to any number (for initial contact / testing)
app.post('/api/send-template', async (req, res) => {
  const { to, template = 'hello_world' } = req.body as { to: string; template?: string };
  if (!to) {
    res.status(400).json({ error: 'Missing "to" phone number' });
    return;
  }
  const msgId = await whatsappService.sendTemplateMessage(to, template, []);
  if (msgId) {
    res.json({ success: true, messageId: msgId, to, template });
  } else {
    res.status(500).json({ success: false, error: 'WhatsApp API returned no message ID — check logs' });
  }
});

// Health check
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// Bootstrap: run DB migration + seed, then start listening
async function bootstrap() {
  try {
    await initDatabase();
  } catch (err) {
    console.error('\u274c Database initialization failed:', err);
    process.exit(1);
  }

  app.listen(config.port, () => {
    console.log(`
  \u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557
  \u2551   WABroker Backend \u2014 Running \ud83d\ude80       \u2551
  \u2551   Port: ${config.port}                         \u2551
  \u2551   Env:  ${config.nodeEnv}                  \u2551
  \u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d
    `);
  });
}

bootstrap();

export default app;
