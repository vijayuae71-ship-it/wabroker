import OpenAI from 'openai';
import { config } from '../config';
import { SYSTEM_PROMPT } from './prompts';
import { query } from '../db';
import { quickMarketSearch } from '../services/dld';
import { searchProperties, searchPropertiesBroad, extractFiltersFromContext, formatPropertiesForAI } from '../services/propertyService';

const openai = new OpenAI({ apiKey: config.openaiApiKey });

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  message: string;
  language: string;
  leadUpdates: Record<string, unknown>;
  handoffRequired: boolean;
  handoffReason: string | null;
  stage: string;
}

export async function processMessage(
  conversationId: string,
  leadId: string,
  incomingMessage: string,
  messageType: 'text' | 'audio' = 'text',
  mediaTranscription?: string
): Promise<AIResponse> {
  const historyResult = await query(
    `SELECT direction, content, sender_type, message_type, media_transcription
     FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 20`,
    [conversationId]
  );

  const leadResult = await query(`SELECT * FROM leads WHERE id = $1`, [leadId]);
  const lead = leadResult.rows[0];

  const messages: ConversationMessage[] = historyResult.rows
    .reverse()
    .map((row) => ({
      role: row.direction === 'inbound' ? 'user' : 'assistant',
      content: row.media_transcription
        ? `[Voice note transcribed]: ${row.media_transcription}`
        : row.content,
    }));

  // Detect property listing intent
  const propertyKeywords = [
    'show', 'listing', 'properties', 'property', 'available', 'option',
    'apartment', 'flat', 'villa', 'studio', 'bedroom', 'bhk', 'unit',
    'photos', 'pics', 'pictures', 'see', 'find', 'search', 'recommend',
    'suggest', 'cheap', 'buy', 'rent', 'invest', 'price', 'cost', 'afford',
    'how much', 'budget', 'market', 'any', 'give me', 'show me',
  ];
  const hasPropertyIntent = propertyKeywords.some(kw => incomingMessage.toLowerCase().includes(kw));

  let enrichedContext = '';

  // Always try to fetch market data + properties when there's property intent
  if (hasPropertyIntent) {
    // 1. Market data
    try {
      const marketData = await quickMarketSearch(incomingMessage);
      enrichedContext += `\n\nLIVE DLD MARKET DATA:\n${marketData}`;
    } catch (err) {
      console.error('Market data fetch error:', err);
    }

    // 2. Property listings from DB
    try {
      const filters = extractFiltersFromContext(incomingMessage, lead);
      let properties = await searchProperties(filters, 3);
      if (properties.length === 0) {
        // Broaden — drop area + price constraints
        properties = await searchPropertiesBroad(filters, 3);
      }
      if (properties.length > 0) {
        enrichedContext += `\n\n${formatPropertiesForAI(properties)}`;
      } else {
        enrichedContext += `\n\nDATABASE: No matching properties found. Use your knowledge of Dubai market to suggest alternatives.`;
      }
    } catch (err) {
      console.error('Property search error:', err);
    }
  }

  const leadContext = `\n\nCURRENT LEAD PROFILE:\n${JSON.stringify({
    name: lead?.name,
    intent: lead?.intent,
    budget_min: lead?.budget_min,
    budget_max: lead?.budget_max,
    preferred_areas: lead?.preferred_areas,
    property_type: lead?.property_type,
    bedrooms: lead?.bedrooms,
    nationality: lead?.nationality,
    score: lead?.score,
    timeline: lead?.timeline,
  }, null, 2)}`;

  const systemPrompt = SYSTEM_PROMPT + leadContext + enrichedContext;

  let userMessage = incomingMessage;
  if (messageType === 'audio' && mediaTranscription) {
    userMessage = `[Voice note]: ${mediaTranscription}`;
  }

  const completion = await openai.chat.completions.create({
    model: config.openaiModel,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
      { role: 'user', content: userMessage },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 1000,
  });

  const rawResponse = completion.choices[0].message.content || '{}';

  try {
    const parsed = JSON.parse(rawResponse) as AIResponse;
    return parsed;
  } catch {
    return {
      message: rawResponse,
      language: 'en',
      leadUpdates: {},
      handoffRequired: false,
      handoffReason: null,
      stage: 'qualifying',
    };
  }
}

export async function transcribeVoiceNote(audioBuffer: Buffer): Promise<string> {
  const transcription = await openai.audio.transcriptions.create({
    file: new File([audioBuffer], 'voice.ogg', { type: 'audio/ogg' }),
    model: 'whisper-1',
  });
  return transcription.text;
}
