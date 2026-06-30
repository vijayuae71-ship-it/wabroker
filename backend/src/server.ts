import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { whatsappWebhookRouter } from './webhooks/whatsapp';
import { twilioWebhookRouter } from './webhooks/twilio';
import { leadsRouter } from './routes/leads';
import { analyticsRouter } from './routes/analytics';
import { authRouter } from './routes/auth';
import { pool } from './db';
import { initDatabase } from './db/init';

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: config.dashboardUrl, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api', limiter);

app.use('/webhook', whatsappWebhookRouter);
app.use('/webhook/twilio', twilioWebhookRouter);

app.use('/api/auth', authRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/analytics', analyticsRouter);

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

async function bootstrap() {
  try {
    await initDatabase();
  } catch (err) {
    console.error('❌ Database initialization failed:', err);
    process.exit(1);
  }

  app.listen(config.port, () => {
    console.log(`
  ╔═══════════════════════════════════════╗
  ║   WABroker Backend — Running 🚀       ║
  ║   Port: ${config.port}                         ║
  ║   Env:  ${config.nodeEnv}                  ║
  ╚═══════════════════════════════════════╝
    `);
  });
}

bootstrap();

export default app;
