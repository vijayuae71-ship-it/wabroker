import OpenAI from 'openai';
import { config } from '../config';
import { SYSTEM_PROMPT } from './prompts';
import { query } from '../db';
import { quickMarketSearch } from '../services/dld';

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
  // Get conversation history
  const historyResult = await query(
    `SELECT direction, content, sender_type, message_type, media_transcription
     FROM messages 
     WHERE conversation_id = $1 
     ORDER BY created_at DESC 
     LIMIT 20`,
    [conversationId]
  );

  // Get lead context
  const leadResult = await query(
    `SELECT * FROM leads WHERE id = $1`,
    [leadId]
  );
  const lead = leadResult.rows[0];

  // Build conversation history for OpenAI
  const messages: ConversationMessage[] = historyResult.rows
    .reverse()
    .map((row) => ({
      role: row.direction === 'inbound' ? 'user' : 'assistant',
      content: row.media_transcription 
        ? `[Voice note transcribed]: ${row.media_transcription}` 
        : row.content,
    }));

  // Detect if message has market/price intent → fetch live DLD + listings data
  let priceContext = '';
  const priceKeywords = [
    'price', 'cost', 'rent', 'how much', 'afford', 'budget', 'cheap', 'expensive',
    'average', 'market', 'invest', 'roi', 'yield', 'transaction', 'value', 'worth',
    'negotiate', 'offer', 'sqft', 'per foot', 'bedroom', 'bhk', 'studio', 'apartment',
    'villa', 'townhouse', 'buy', 'sale', 'purchase',
    'سعر', 'إيجار', 'شراء', 'سوق', 'استثمار', // Arabic
  ];
  const hasMarketIntent = priceKeywords.some(kw =>
    incomingMessage.toLowerCase().includes(kw)
  );

  if (hasMarketIntent) {
    try {
      const marketData = await quickMarketSearch(incomingMessage);
      priceContext = `\n\nLIVE MARKET DATA (DLD verified — use this to inform your response):\n${marketData}`;
    } catch (err) {
      console.error('Market data fetch error:', err);
      // Non-fatal: Layla responds without market data
    }
  }

  // Add lead context to system prompt
  const leadContext = `\n\nCurrent lead info: ${JSON.stringify({
    name: lead?.name,
    intent: lead?.intent,
    budget_min: lead?.budget_min,
    budget_max: lead?.budget_max,
    preferred_areas: lead?.preferred_areas,
    property_type: lead?.property_type,
    score: lead?.score,
    nationality: lead?.nationality,
  })}`;

  const systemPrompt = SYSTEM_PROMPT + leadContext + priceContext;

  // Format incoming message
  let userMessage = incomingMessage;
  if (messageType === 'audio' && mediaTranscription) {
    userMessage = `[Voice note]: ${mediaTranscription}`;
  }

  // Call OpenAI
  const completion = await openai.chat.completions.create({
    model: config.openaiModel,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
      { role: 'user', content: userMessage },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 800,
  });

  const rawResponse = completion.choices[0].message.content || '{}';
  
  try {
    const parsed = JSON.parse(rawResponse) as AIResponse;
    return parsed;
  } catch {
    // Fallback if JSON parsing fails
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
  const formData = new FormData();
  const blob = new Blob([audioBuffer], { type: 'audio/ogg' });
  formData.append('file', blob, 'voice.ogg');
  formData.append('model', 'whisper-1');
  formData.append('language', 'ar'); // Default Arabic, Whisper auto-detects

  const transcription = await openai.audio.transcriptions.create({
    file: new File([audioBuffer], 'voice.ogg', { type: 'audio/ogg' }),
    model: 'whisper-1',
  });

  return transcription.text;
}
