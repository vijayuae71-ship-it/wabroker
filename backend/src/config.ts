import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',

  // OpenAI
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o',

  // WhatsApp (Meta Cloud API)
  whatsappToken: process.env.WHATSAPP_TOKEN || '',
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  whatsappWebhookToken: process.env.WHATSAPP_VERIFY_TOKEN || 'layla2024',
  whatsappBaseUrl: 'https://graph.facebook.com/v19.0',

  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/wabroker',

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'change_this_in_production',
  jwtExpiresIn: '7d',

  // App
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  dashboardUrl: process.env.DASHBOARD_URL || 'http://localhost:5173',

  // Business
  agentHandoffThreshold: 80, // Lead score above this → notify agent
  sessionTimeoutMinutes: 60,
};
