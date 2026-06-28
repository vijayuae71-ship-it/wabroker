import { pool } from './index';

let defaultAgencyId: string | null = null;

export async function initDatabase(): Promise<void> {
  console.log('🔧 Initializing database schema...');

  await pool.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS agencies (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name VARCHAR(255) NOT NULL,
      whatsapp_number VARCHAR(20) UNIQUE NOT NULL,
      subscription_tier VARCHAR(20) DEFAULT 'starter',
      subscription_status VARCHAR(20) DEFAULT 'trial',
      trial_ends_at TIMESTAMP,
      settings JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS agents (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      whatsapp_number VARCHAR(20),
      role VARCHAR(20) DEFAULT 'agent',
      is_active BOOLEAN DEFAULT true,
      language_preference VARCHAR(10) DEFAULT 'en',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS leads (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
      assigned_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
      whatsapp_number VARCHAR(20) NOT NULL,
      name VARCHAR(255),
      language VARCHAR(10) DEFAULT 'en',
      nationality VARCHAR(50),
      intent VARCHAR(20),
      budget_min DECIMAL(15,2),
      budget_max DECIMAL(15,2),
      preferred_areas TEXT[],
      property_type VARCHAR(50),
      bedrooms VARCHAR(20),
      timeline VARCHAR(50),
      score INTEGER DEFAULT 0,
      status VARCHAR(30) DEFAULT 'new',
      source VARCHAR(50) DEFAULT 'whatsapp',
      utm_source VARCHAR(100),
      notes TEXT,
      last_contacted_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(agency_id, whatsapp_number)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
      agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
      status VARCHAR(20) DEFAULT 'active',
      handling_mode VARCHAR(10) DEFAULT 'ai',
      taken_over_by UUID REFERENCES agents(id) ON DELETE SET NULL,
      taken_over_at TIMESTAMP,
      ai_context JSONB DEFAULT '{}',
      started_at TIMESTAMP DEFAULT NOW(),
      last_message_at TIMESTAMP DEFAULT NOW(),
      closed_at TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
      direction VARCHAR(10) NOT NULL,
      sender_type VARCHAR(10),
      message_type VARCHAR(20) DEFAULT 'text',
      content TEXT,
      media_url VARCHAR(500),
      media_transcription TEXT,
      whatsapp_message_id VARCHAR(100),
      status VARCHAR(20) DEFAULT 'sent',
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS property_inquiries (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
      conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
      area VARCHAR(100),
      property_type VARCHAR(50),
      bedrooms VARCHAR(20),
      budget_min DECIMAL(15,2),
      budget_max DECIMAL(15,2),
      is_off_plan BOOLEAN,
      move_in_date DATE,
      matched_listings JSONB DEFAULT '[]',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS market_intel (
      id SERIAL PRIMARY KEY,
      area VARCHAR(100) NOT NULL,
      beds INTEGER NOT NULL,
      listing_count INTEGER DEFAULT 0,
      min_price INTEGER DEFAULT 0,
      max_price INTEGER DEFAULT 0,
      median_price INTEGER DEFAULT 0,
      avg_price INTEGER DEFAULT 0,
      price_trend VARCHAR(10) DEFAULT 'stable',
      best_deal_url TEXT,
      sources TEXT,
      scraped_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(area, beds)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS dld_price_cache (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      area VARCHAR(100) NOT NULL,
      property_type VARCHAR(50) NOT NULL,
      beds VARCHAR(10) NOT NULL DEFAULT '1',
      median_rent DECIMAL(15,2),
      p25_rent DECIMAL(15,2),
      p75_rent DECIMAL(15,2),
      median_sale DECIMAL(15,2),
      price_per_sqft DECIMAL(10,2),
      gross_yield DECIMAL(5,2),
      tx_count INTEGER DEFAULT 0,
      avg_price_sqft DECIMAL(10,2),
      avg_sale_price DECIMAL(15,2),
      avg_rent_annual DECIMAL(15,2),
      transaction_count INTEGER,
      data_source VARCHAR(30) DEFAULT 'static-benchmark',
      data_date TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(area, property_type, beds)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
      lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
      type VARCHAR(50) NOT NULL,
      message TEXT NOT NULL,
      is_read BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Indexes (IF NOT EXISTS supported in PG 9.5+)
  const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_leads_agency ON leads(agency_id)`,
    `CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)`,
    `CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_leads_whatsapp ON leads(whatsapp_number)`,
    `CREATE INDEX IF NOT EXISTS idx_conversations_lead ON conversations(lead_id)`,
    `CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)`,
    `CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_dld_area ON dld_price_cache(area, property_type)`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_agent ON notifications(agent_id, is_read)`,
    `CREATE INDEX IF NOT EXISTS idx_market_intel_area ON market_intel(area, beds)`,
  ];
  for (const idx of indexes) {
    await pool.query(idx);
  }

  // Seed default agency if none exists
  const { rows } = await pool.query('SELECT id FROM agencies LIMIT 1');
  if (rows.length === 0) {
    const result = await pool.query(
      `INSERT INTO agencies (name, whatsapp_number, subscription_tier, subscription_status)
       VALUES ($1, $2, 'starter', 'trial') RETURNING id`,
      ['Layla Dubai RE', '+15556596204']
    );
    defaultAgencyId = result.rows[0].id;
    console.log(`✅ Seeded default agency: ${defaultAgencyId}`);
  } else {
    defaultAgencyId = rows[0].id;
    console.log(`✅ Using existing agency: ${defaultAgencyId}`);
  }

  console.log('✅ Database ready');
}

export function getDefaultAgencyId(): string {
  if (!defaultAgencyId) throw new Error('Database not initialized — call initDatabase() first');
  return defaultAgencyId;
}
