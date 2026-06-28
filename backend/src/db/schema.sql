-- WABroker Database Schema
-- Dubai Real Estate WhatsApp AI Platform

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Agencies (your customers)
CREATE TABLE agencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  whatsapp_number VARCHAR(20) UNIQUE NOT NULL,
  subscription_tier VARCHAR(20) DEFAULT 'starter' CHECK (subscription_tier IN ('starter', 'team', 'enterprise')),
  subscription_status VARCHAR(20) DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'suspended', 'cancelled')),
  trial_ends_at TIMESTAMP,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Agents (brokers within an agency)
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  whatsapp_number VARCHAR(20),
  role VARCHAR(20) DEFAULT 'agent' CHECK (role IN ('admin', 'agent')),
  is_active BOOLEAN DEFAULT true,
  language_preference VARCHAR(10) DEFAULT 'en',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Leads (incoming buyers/sellers via WhatsApp)
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  assigned_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  whatsapp_number VARCHAR(20) NOT NULL,
  name VARCHAR(255),
  language VARCHAR(10) DEFAULT 'en',
  nationality VARCHAR(50),
  
  -- Lead qualification
  intent VARCHAR(20) CHECK (intent IN ('buy', 'sell', 'rent', 'invest', 'unknown')),
  budget_min DECIMAL(15,2),
  budget_max DECIMAL(15,2),
  preferred_areas TEXT[],
  property_type VARCHAR(50),
  bedrooms VARCHAR(20),
  timeline VARCHAR(50),
  
  -- Lead scoring
  score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  status VARCHAR(30) DEFAULT 'new' CHECK (status IN ('new', 'qualifying', 'qualified', 'hot', 'in_progress', 'converted', 'lost', 'archived')),
  
  -- Source tracking
  source VARCHAR(50) DEFAULT 'whatsapp',
  utm_source VARCHAR(100),
  
  notes TEXT,
  last_contacted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(agency_id, whatsapp_number)
);

-- Conversations (WhatsApp sessions)
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'ai_handling', 'agent_takeover', 'closed')),
  handling_mode VARCHAR(10) DEFAULT 'ai' CHECK (handling_mode IN ('ai', 'agent')),
  taken_over_by UUID REFERENCES agents(id) ON DELETE SET NULL,
  taken_over_at TIMESTAMP,
  
  ai_context JSONB DEFAULT '{}', -- conversation state for AI
  
  started_at TIMESTAMP DEFAULT NOW(),
  last_message_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP
);

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  sender_type VARCHAR(10) CHECK (sender_type IN ('lead', 'ai', 'agent')),
  
  message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'audio', 'image', 'document', 'location', 'template')),
  content TEXT,
  media_url VARCHAR(500),
  media_transcription TEXT, -- for voice notes
  
  whatsapp_message_id VARCHAR(100),
  status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Property inquiries (structured property requests extracted from conversations)
CREATE TABLE property_inquiries (
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
);

-- ─── Multi-Source Market Intelligence ────────────────────────────────────────
CREATE TABLE market_intel (
  id           SERIAL PRIMARY KEY,
  area         VARCHAR(100) NOT NULL,
  beds         INTEGER NOT NULL,
  listing_count INTEGER DEFAULT 0,
  min_price    INTEGER DEFAULT 0,
  max_price    INTEGER DEFAULT 0,
  median_price INTEGER DEFAULT 0,
  avg_price    INTEGER DEFAULT 0,
  price_trend  VARCHAR(10) DEFAULT 'stable', -- rising | stable | falling
  best_deal_url TEXT,
  sources      TEXT, -- comma-separated: bayut,propertyfinder,dubizzle
  scraped_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(area, beds)
);

CREATE INDEX idx_market_intel_area ON market_intel(area, beds);

-- DLD Price Data Cache (live transaction data from BayutAPI / DLD)
CREATE TABLE dld_price_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  area VARCHAR(100) NOT NULL,
  property_type VARCHAR(50) NOT NULL,   -- 'rent' or 'sale'
  beds VARCHAR(10) NOT NULL DEFAULT '1',
  -- Transaction-derived stats
  median_rent DECIMAL(15,2),
  p25_rent DECIMAL(15,2),
  p75_rent DECIMAL(15,2),
  median_sale DECIMAL(15,2),
  price_per_sqft DECIMAL(10,2),
  gross_yield DECIMAL(5,2),
  tx_count INTEGER DEFAULT 0,
  -- Legacy columns (kept for compatibility)
  avg_price_sqft DECIMAL(10,2),
  avg_sale_price DECIMAL(15,2),
  avg_rent_annual DECIMAL(15,2),
  transaction_count INTEGER,
  -- Metadata
  data_source VARCHAR(30) DEFAULT 'static-benchmark',
  data_date TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(area, property_type, beds)
);

-- Agent notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_leads_agency ON leads(agency_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_score ON leads(score DESC);
CREATE INDEX idx_leads_whatsapp ON leads(whatsapp_number);
CREATE INDEX idx_conversations_lead ON conversations(lead_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(created_at);
CREATE INDEX idx_dld_area ON dld_price_cache(area, property_type);
CREATE INDEX idx_notifications_agent ON notifications(agent_id, is_read);
