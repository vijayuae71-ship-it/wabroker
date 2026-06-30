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
  quickReplies?: string[];
}

const WEB_SYSTEM_PROMPT = `${SYSTEM_PROMPT}

## WEB CHAT MODE — CRITICAL RULES
You are in web chat mode. The frontend renders beautiful visual property cards automatically.
- NEVER list properties as text. NEVER write "AED X/year", sqft, floors, amenities in your message.
- When properties are found, write ONLY a short warm message like: "I found 3 perfect matches for you! ✨ Take a look 👇"
- Keep ALL messages to 1-3 sentences max. Punchy, warm, conversational.
- DO NOT format property details in text. The UI handles all visual display.
- Respond in plain text only — no JSON, no markdown lists.
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
      let properties = await searchProperties(filters, 4);
      if (properties.length === 0) {
        properties = await searchPropertiesBroad(filters, 4);
      }
      matchedProperties = properties;
      if (properties.length > 0) {
        enrichedContext = `\n\n[PROPERTY DATA FOR CONTEXT ONLY — DO NOT LIST IN YOUR MESSAGE]\n${formatPropertiesForAI(properties)}\n[END PROPERTY DATA]`;
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
    temperature: 0.7,
    max_tokens: 200,
  });

  const rawMessage = (completion.choices[0].message.content || "I'm here to help! What are you looking for?").trim();

  // Detect quick replies based on stage
  const quickReplies = getQuickReplies(rawMessage, hasPropertyIntent);

  return {
    message: rawMessage,
    language: detectLanguage(rawMessage),
    stage: hasPropertyIntent ? 'showing' : 'qualifying',
    properties: matchedProperties,
    quickReplies,
  };
}

function getQuickReplies(msg: string, hasProperties: boolean): string[] {
  if (hasProperties) return ['Book Viewing 📅', 'More Options 🔍', 'Mortgage Calc 💰', 'Different Area 📍'];
  const lower = msg.toLowerCase();
  if (lower.includes('budget') || lower.includes('afford')) return ['Under AED 1M 💰', '1–2M 🏠', '2–5M 🏢', '5M+ 👑'];
  if (lower.includes('area') || lower.includes('where') || lower.includes('location')) return ['Downtown 🌆', 'Marina 🌊', 'JVC 🏘', 'Palm 🌴', 'Business Bay'];
  if (lower.includes('buy') || lower.includes('rent')) return ['Buy 🔑', 'Rent 🏠', 'Invest 📈', 'Off-Plan 🏗'];
  return ['Buy 🔑', 'Rent 🏠', 'Invest 📈', 'Off-Plan 🏗', 'Golden Visa 🏅'];
}

function detectLanguage(text: string): string {
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';
  if (/[\u0400-\u04FF]/.test(text)) return 'ru';
  return 'en';
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
