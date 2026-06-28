import { query } from '../db';
import { v4 as uuidv4 } from 'uuid';

export const leadService = {
  async findOrCreate(agencyId: string, whatsappNumber: string, contactName?: string) {
    const existing = await query(
      'SELECT * FROM leads WHERE agency_id = $1 AND whatsapp_number = $2',
      [agencyId, whatsappNumber]
    );

    if (existing.rows.length > 0) {
      return { lead: existing.rows[0], isNew: false };
    }

    const result = await query(
      `INSERT INTO leads (id, agency_id, whatsapp_number, name, status)
       VALUES ($1, $2, $3, $4, 'new')
       RETURNING *`,
      [uuidv4(), agencyId, whatsappNumber, contactName || null]
    );

    return { lead: result.rows[0], isNew: true };
  },

  async updateLead(leadId: string, updates: Record<string, unknown>) {
    const allowedFields = [
      'name', 'language', 'nationality', 'intent', 'budget_min', 'budget_max',
      'preferred_areas', 'property_type', 'bedrooms', 'timeline', 'score', 'status',
      'assigned_agent_id', 'notes', 'last_contacted_at'
    ];

    const fields = Object.keys(updates).filter(k => allowedFields.includes(k));
    if (!fields.length) return;

    const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const values = fields.map(f => updates[f]);

    await query(
      `UPDATE leads SET ${setClause}, updated_at = NOW() WHERE id = $1`,
      [leadId, ...values]
    );
  },

  async getOrCreateConversation(leadId: string, agencyId: string) {
    const existing = await query(
      `SELECT * FROM conversations 
       WHERE lead_id = $1 AND status IN ('active', 'ai_handling')
       ORDER BY started_at DESC LIMIT 1`,
      [leadId]
    );

    if (existing.rows.length > 0) {
      return existing.rows[0];
    }

    const result = await query(
      `INSERT INTO conversations (id, lead_id, agency_id, status, handling_mode)
       VALUES ($1, $2, $3, 'active', 'ai')
       RETURNING *`,
      [uuidv4(), leadId, agencyId]
    );

    return result.rows[0];
  },

  async saveMessage(conversationId: string, direction: 'inbound' | 'outbound', content: string, options: {
    senderType: 'lead' | 'ai' | 'agent';
    messageType?: string;
    mediaUrl?: string;
    transcription?: string;
    whatsappMessageId?: string;
  }) {
    await query(
      `INSERT INTO messages (id, conversation_id, direction, sender_type, message_type, content, media_url, media_transcription, whatsapp_message_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        uuidv4(),
        conversationId,
        direction,
        options.senderType,
        options.messageType || 'text',
        content,
        options.mediaUrl || null,
        options.transcription || null,
        options.whatsappMessageId || null,
      ]
    );

    // Update conversation last message time
    await query(
      'UPDATE conversations SET last_message_at = NOW() WHERE id = $1',
      [conversationId]
    );
  },

  async notifyAgent(agentId: string, leadId: string, message: string) {
    await query(
      `INSERT INTO notifications (id, agent_id, lead_id, type, message)
       VALUES ($1, $2, $3, 'hot_lead', $4)`,
      [uuidv4(), agentId, leadId, message]
    );
  },

  async getLeadsByAgency(agencyId: string, filters: {
    status?: string;
    minScore?: number;
    intent?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    let whereClause = 'WHERE l.agency_id = $1';
    const params: unknown[] = [agencyId];
    let paramIdx = 2;

    if (filters.status) {
      whereClause += ` AND l.status = $${paramIdx++}`;
      params.push(filters.status);
    }
    if (filters.minScore !== undefined) {
      whereClause += ` AND l.score >= $${paramIdx++}`;
      params.push(filters.minScore);
    }
    if (filters.intent) {
      whereClause += ` AND l.intent = $${paramIdx++}`;
      params.push(filters.intent);
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const result = await query(
      `SELECT l.*, a.name as assigned_agent_name,
              COUNT(m.id) as message_count,
              MAX(m.created_at) as last_message_at
       FROM leads l
       LEFT JOIN agents a ON l.assigned_agent_id = a.id
       LEFT JOIN conversations c ON c.lead_id = l.id
       LEFT JOIN messages m ON m.conversation_id = c.id
       ${whereClause}
       GROUP BY l.id, a.name
       ORDER BY l.score DESC, l.updated_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    return result.rows;
  },

  async getConversationMessages(leadId: string) {
    return query(
      `SELECT m.* FROM messages m
       JOIN conversations c ON m.conversation_id = c.id
       WHERE c.lead_id = $1
       ORDER BY m.created_at ASC`,
      [leadId]
    );
  }
};
