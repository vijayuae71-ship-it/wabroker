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
      avg_price_sqft DECIMAL(10,2),
      transaction_count INTEGER DEFAULT 0,
      data_source VARCHAR(50) DEFAULT 'dld',
      fetched_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
      UNIQUE(area, property_type, beds)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
      agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
      lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT,
      is_read BOOLEAN DEFAULT false,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Properties table — 60 Dubai listings
  await pool.query(`
    CREATE TABLE IF NOT EXISTS properties (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
      ref_no VARCHAR(50) UNIQUE NOT NULL,
      title VARCHAR(255) NOT NULL,
      area VARCHAR(100) NOT NULL,
      community VARCHAR(100),
      building VARCHAR(100),
      property_type VARCHAR(50) NOT NULL,
      listing_type VARCHAR(20) NOT NULL,
      bedrooms VARCHAR(10) NOT NULL,
      bathrooms INTEGER,
      sqft INTEGER,
      floor INTEGER,
      total_floors INTEGER,
      view VARCHAR(100),
      price DECIMAL(15,2) NOT NULL,
      price_per_sqft DECIMAL(10,2),
      service_charge_per_sqft DECIMAL(10,2),
      cheques_accepted INTEGER DEFAULT 4,
      furnished VARCHAR(20) DEFAULT 'unfurnished',
      amenities TEXT[],
      photo_urls TEXT[],
      days_on_market INTEGER DEFAULT 0,
      is_golden_visa_eligible BOOLEAN DEFAULT false,
      gross_yield DECIMAL(5,2),
      is_off_plan BOOLEAN DEFAULT false,
      developer VARCHAR(100),
      payment_plan VARCHAR(255),
      is_featured BOOLEAN DEFAULT false,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_properties_area ON properties(area)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_properties_listing_type ON properties(listing_type)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_properties_bedrooms ON properties(bedrooms)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_properties_price ON properties(price)`);

  // Seed agency
  const agencyResult = await pool.query(`
    INSERT INTO agencies (name, whatsapp_number, subscription_tier, subscription_status)
    VALUES ('Dubai RE Agency', '+971501234567', 'professional', 'active')
    ON CONFLICT (whatsapp_number) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `);
  defaultAgencyId = agencyResult.rows[0].id;

  await pool.query(`
    INSERT INTO agents (agency_id, name, email, password_hash, role)
    VALUES ($1, 'Vijay Admin', 'vijay@dubaiagency.com',
      '$2b$10$rMDp7MBFRfzh5XrJbGvmCONf7HzL3qE1YqQgP5vX8wKDnUhJkLT1u', 'admin')
    ON CONFLICT (email) DO NOTHING
  `, [defaultAgencyId]);

  console.log('✅ Database schema initialized');
}

export function getDefaultAgencyId(): string {
  if (!defaultAgencyId) throw new Error('Database not initialized');
  return defaultAgencyId;
}
