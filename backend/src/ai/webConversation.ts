import OpenAI from 'openai';
import { config } from '../config';
import { SYSTEM_PROMPT } from './prompts';
import { searchProperties, searchPropertiesBroad, extractFiltersFromContext, formatPropertiesForAI, Property } from '../services/propertyService';

const openai = new OpenAI({ apiKey: config.openaiApiKey });

export interface WebChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface WebChatResponse {
  message: string;
  language: string;
  stage: string;
  properties: Property[];
}

const WEB_SYSTEM_PROMPT = `${SYSTEM_PROMPT}

## WEB CHAT MODE — IMPORTANT
You are in web chat mode. The frontend renders beautiful visual property cards automatically from the API data — you do NOT need to format property listings as text.
When properties are found, write a SHORT, warm message like: "I found 3 perfect matches for you! ✨ Take a look 👇" — the cards appear automatically below your message.
Keep ALL your messages SHORT (2-4 sentences max). Be punchy, warm, conversational.
No long formatted text blocks. The UI handles the visual display.
`;

export async function processWebMessage(
  message: string,
  history: WebChatMessage[]
): Promise<WebChatResponse> {
  const allText = history.map(h => h.content).join(' ') + ' ' + message;
  
  const propertyKeywords = [
    'show','listing','properties','property','available','option','apartment','flat','villa',
    'studio','bedroom','bhk','unit','find','search','recommend','suggest','cheap','buy','rent',
    'invest','price','cost','afford','budget','how much','market','give me','show me','looking',
    'want','need','marina','downtown','jvc','palm','hills','bay','deira','barsha','jbr','difc',
  ];
  const hasPropertyIntent = propertyKeywords.some(kw => allText.toLowerCase().includes(kw));

  let matchedProperties: Property[] = [];
  let enrichedContext = '';

  if (hasPropertyIntent) {
    try {
      const fakeLead = buildLeadFromContext(allText);
      const filters = extractFiltersFromContext(message, fakeLead);
      let properties = await searchProperties(filters, 3);
      if (properties.length === 0) {
        properties = await searchPropertiesBroad(filters, 3);
      }
      matchedProperties = properties;
      if (properties.length > 0) {
        enrichedContext = `\n\n${formatPropertiesForAI(properties)}`;
      }
    } catch (err) {
      console.error('Property search error:', err);
    }
  }

  const systemPrompt = WEB_SYSTEM_PROMPT + enrichedContext;

  const completion = await openai.chat.completions.create({
    model: config.openaiModel,
    messages: [
      { role: 'system', content: systemPrompt },
      ...history.slice(-8),
      { role: 'user', content: message },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 350,
  });

  const rawResponse = completion.choices[0].message.content || '{}';

  try {
    const parsed = JSON.parse(rawResponse);
    return {
      message: parsed.message || "I'm here to help! What are you looking for?",
      language: parsed.language || 'en',
      stage: parsed.stage || 'greeting',
      properties: matchedProperties,
    };
  } catch {
    return { message: rawResponse, language: 'en', stage: 'greeting', properties: [] };
  }
}

function buildLeadFromContext(text: string): Record<string, unknown> {
  const lead: Record<string, unknown> = {};
  if (/\b(buy|purchase|buying|investment|invest)\b/i.test(text)) lead.intent = 'buy';
  else if (/\b(rent|lease|rental|renting)\b/i.test(text)) lead.intent = 'rent';
  const mMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:m|million)\b/i);
  if (mMatch) lead.budget_max = parseFloat(mMatch[1]) * 1000000;
  const kMatch = text.match(/(\d{3,4})\s*k\b/i);
  if (kMatch && !mMatch) lead.budget_max = parseInt(kMatch[1]) * 1000;
  const aedMatch = text.match(/(?:aed)\s*(\d[\d,]+)/i);
  if (aedMatch) lead.budget_max = parseInt(aedMatch[1].replace(/,/g, ''));
  const bedMatch = text.match(/(\d+)\s*(?:bed|br|bhk|bedroom)/i);
  if (bedMatch) lead.bedrooms = bedMatch[1];
  else if (/studio/i.test(text)) lead.bedrooms = 'studio';
  return lead;
}
