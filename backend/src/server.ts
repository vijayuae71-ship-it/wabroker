import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { config } from './config';
import { whatsappWebhookRouter } from './webhooks/whatsapp';
import { twilioWebhookRouter } from './webhooks/twilio';
import { leadsRouter } from './routes/leads';
import { analyticsRouter } from './routes/analytics';
import { authRouter } from './routes/auth';
import { webchatRouter } from './routes/webchat';
import { bookingsRouter } from './routes/bookings';
import { pool } from './db';
import { initDatabase, getDefaultAgencyId } from './db/init';
import { seedProperties } from './db/seed-properties';

const app = express();

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*', credentials: false }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use('/api', limiter);

app.use('/webhook', whatsappWebhookRouter);
app.use('/webhook/twilio', twilioWebhookRouter);

app.use('/api/auth', authRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/webchat', webchatRouter);
app.use('/api/bookings', bookingsRouter);

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// Serve web chat frontend
app.use(express.static(path.join(__dirname, '../public')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

async function bootstrap() {
  try {
    await initDatabase();
    const agencyId = getDefaultAgencyId();
    await seedProperties(agencyId);
  } catch (err) {
    console.error('❌ Database initialization failed:', err);
    process.exit(1);
  }
  app.listen(config.port, () => {
    console.log(`\n  ╔═══════════════════════════════════════╗\n  ║   WABroker + WebChat — Running 🚀     ║\n  ║   Port: ${config.port}                         ║\n  ╚═══════════════════════════════════════╝\n`);
  });
}

bootstrap();
export default app;
