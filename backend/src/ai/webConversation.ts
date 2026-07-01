import OpenAI from 'openai';
import { config } from '../config';
import { SYSTEM_PROMPT } from './prompts';
import { searchProperties, searchPropertiesBroad, extractFiltersFromContext, formatPropertiesForAI, Property } from '../services/propertyService';
import { getLiveMarketData, formatLiveMarketMessage } from '../services/propertyScraper';

const openai = new OpenAI({ apiKey: config.openaiApiKey });

export interface WebChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface PrefilledParams {
  intent?: string;
  type?: string;
  bedrooms?: string;   // '1','2','3','4','studio' — from qualifying flow
  area?: string;
  budget_min?: number;
  budget_max?: number;
  timeline?: string;
  name?: string;
}

export interface WebChatResponse {
  message: string;
  language: string;
  stage: string;
  properties: Property[];
  quickReplies?: string[];
  contactCard?: boolean;
}

const WEB_SYSTEM_PROMPT = `${SYSTEM_PROMPT}

## WEB CHAT MODE — CRITICAL RULES
You are in web chat mode. The frontend renders beautiful visual property cards automatically.
- NEVER list properties as text. NEVER write "AED X/year", sqft, floors, amenities in your message.
- When properties are found, write ONLY a short warm message like: "I found 3 perfect matches for you! ✨ Take a look 👇"
- Keep ALL messages to 1-3 sentences max. Punchy, warm, conversational.
- DO NOT format property details in text. The UI handles all visual display.
- Respond in plain text only — no JSON, no markdown lists.
- NEVER ask for information that was already provided (the client came from WhatsApp with filters pre-set).
- After showing properties, ask for their name and contact details warmly.
- If they skip contact details, show the contact card and wish them well.
`;

export async function processWebMessage(
  message: string,
  history: WebChatMessage[],
  prefilled?: PrefilledParams,
  leadInfo?: { name?: string; phone?: string; email?: string }
): Promise<WebChatResponse> {

  // ── If this is the first message with pre-filled params from WhatsApp ────
  const isPrefilledInit = prefilled && Object.keys(prefilled).length > 0 && history.length === 0;

  if (isPrefilledInit) {
    return await handlePrefilledSearch(prefilled!);
  }

  const allText = history.map(h => h.content).join(' ') + ' ' + message;

  // ── Check if user is providing contact details ────────────────────────────
  const emailMatch = message.match(/[\w.-]+@[\w.-]+\.\w+/);
  const phoneMatch = message.match(/(\+?[\d\s\-()]{8,})/);
  const isSkipping = /skip|no thanks|no need|don't|dont|later|pass/i.test(message);

  if (isSkipping && !leadInfo?.email && !leadInfo?.phone) {
    return {
      message: `No worries at all! 😊 If you ever want to connect, here are our details below. Hope you find your perfect property! 🏠✨`,
      language: 'en',
      stage: 'contact_skipped',
      properties: [],
      quickReplies: ['Search Again 🔍', 'Different Budget 💰', 'Change Area 📍'],
      contactCard: true,
    };
  }

  // ── Detect property search intent ─────────────────────────────────────────
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
      const fakeLead = buildLeadFromContext(allText, prefilled);
      const filters = extractFiltersFromContext(message, fakeLead);
      let properties = await searchProperties(filters, 6);
      // STRICT AREA RULE: if user asked for a specific area and DB has no match,
      // NEVER fall back to other areas — that destroys authenticity.
      // Only use broad fallback (drops area) when NO area was specified.
      if (properties.length === 0 && !filters.area) {
        properties = await searchPropertiesBroad(filters, 6);
      }
      matchedProperties = properties;
      if (properties.length > 0) {
        enrichedContext = `\n\n[PROPERTY DATA FOR CONTEXT ONLY — DO NOT LIST IN YOUR MESSAGE]\n${formatPropertiesForAI(properties)}\n[END PROPERTY DATA]`;
      } else if (filters.area) {
        // DB had no match for this area — try live market scrape from PropertyFinder
        const listingType = filters.listingType || (fakeLead.intent === 'rent' ? 'rent' : 'sale');
        const bedrooms = filters.bedrooms || (fakeLead.bedrooms as string) || 'studio';
        const liveData = await getLiveMarketData(filters.area, bedrooms, listingType as 'sale' | 'rent');
        if (liveData) {
          enrichedContext = `\n\n[LIVE MARKET DATA FROM PROPERTYFINDER — USE THIS]\n${formatLiveMarketMessage(liveData)}\n[END LIVE DATA]`;
        } else {
          enrichedContext = `\n\n[AREA NOT IN DB]\nUser asked for ${filters.area}. We don't have listings there yet. Tell the user honestly we don't have ${filters.area} listings in our current portfolio, and offer to help them with nearby alternatives OR note it and follow up. Do NOT invent listings or show properties from other areas.\n[END]`;
        }
      } else {
        // No area specified, no results — broad search also returned nothing
        enrichedContext = `\n\n[NO RESULTS]\nNo properties match these exact criteria. Suggest adjusting budget or property type. Do NOT show listings from unrelated areas.\n[END]`;
      }
    } catch (err) {
      console.error('Property search error:', err);
    }
  }

  // ── Check if we should ask for contact details ────────────────────────────
  const hasShownProperties = history.some(h =>
    h.role === 'assistant' && (h.content.includes('match') || h.content.includes('found') || h.content.includes('look'))
  );
  const hasContactInfo = leadInfo?.phone || leadInfo?.email;
  const shouldAskContact = hasShownProperties && matchedProperties.length === 0 && !hasContactInfo && !isSkipping;

  if (shouldAskContact && !hasPropertyIntent) {
    return {
      message: `To keep you updated on new listings that match your criteria, may I get your name and best contact number? 😊\n\n_(Tap Skip if you prefer to stay anonymous — totally fine!)_`,
      language: 'en',
      stage: 'ask_contact',
      properties: [],
      quickReplies: ['Skip ⏭', 'Sure! 😊'],
      contactCard: false,
    };
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
  const quickReplies = getQuickReplies(rawMessage, matchedProperties.length > 0);

  return {
    message: rawMessage,
    language: detectLanguage(rawMessage),
    stage: matchedProperties.length > 0 ? 'showing' : 'qualifying',
    properties: matchedProperties,
    quickReplies,
    contactCard: false,
  };
}

// ─── Handle first load with pre-filled params from WhatsApp ──────────────────
async function handlePrefilledSearch(prefilled: PrefilledParams): Promise<WebChatResponse> {
  try {
    const fakeLead: Record<string, unknown> = {
      intent: prefilled.intent,
      property_type: prefilled.type,
      bedrooms: prefilled.bedrooms,  // ← pass through bedrooms
      preferred_areas: prefilled.area && prefilled.area !== 'Any' ? [prefilled.area] : [],
      budget_max: prefilled.budget_max,
      budget_min: prefilled.budget_min,
    };

    const searchContext = `${prefilled.intent || 'buy'} ${prefilled.type || ''} ${prefilled.area || ''} budget ${prefilled.budget_max || ''}`;
    const filters = extractFiltersFromContext(searchContext, fakeLead);

    let properties = await searchProperties(filters, 6);
    // STRICT AREA RULE: never drop area filter to fill results with wrong-area properties
    if (properties.length === 0 && !filters.area) {
      properties = await searchPropertiesBroad(filters, 6);
    }

    const nameGreet = prefilled.name ? `, ${prefilled.name}` : '';
    const intentWord = prefilled.intent === 'rent' ? 'rental' : 'properties';
    const areaWord = prefilled.area && prefilled.area !== 'Any' ? ` in ${prefilled.area}` : ' in Dubai';

    if (properties.length > 0) {
      return {
        message: `Welcome${nameGreet}! 🌟 Based on your search, I found *${properties.length} ${intentWord}*${areaWord} that match your criteria. Take a look below 👇`,
        language: 'en',
        stage: 'showing',
        properties,
        quickReplies: ['Book Viewing 📅', 'More Options 🔍', 'Mortgage Calc 💰', 'Different Area 📍'],
        contactCard: false,
      };
    }

    // ── DB has no match — try live market data from PropertyFinder ───────────
    if (prefilled.area && prefilled.area !== 'Any') {
      const listingType = prefilled.intent === 'rent' ? 'rent' : 'sale';
      const bedrooms = prefilled.bedrooms || 'studio';
      const liveData = await getLiveMarketData(prefilled.area, bedrooms, listingType);
      if (liveData) {
        return {
          message: formatLiveMarketMessage(liveData),
          language: 'en',
          stage: 'live_market',
          properties: [],
          quickReplies: ['Show Nearby Areas 📍', 'Change Budget 💰', 'Book Viewing 📅'],
          contactCard: false,
        };
      }
    }

    return {
      message: `Welcome${nameGreet}! 👋 I couldn't find an exact match, but let me broaden the search a little for you. What's most important — area, budget, or property type?`,
      language: 'en',
      stage: 'qualifying',
      properties: [],
      quickReplies: ['Change Area 📍', 'Adjust Budget 💰', 'Different Type 🏠'],
      contactCard: false,
    };
  } catch (err) {
    console.error('Prefilled search error:', err);
    return {
      message: `Welcome! 👋 I'm Layla, your Dubai property expert. Tell me what you're looking for and I'll find the best options for you! 🏠`,
      language: 'en',
      stage: 'qualifying',
      properties: [],
      quickReplies: ['Buy 🔑', 'Rent 🏠', 'Invest 📈', 'Off-Plan 🏗'],
      contactCard: false,
    };
  }
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

function buildLeadFromContext(text: string, prefilled?: PrefilledParams): Record<string, unknown> {
  const lead: Record<string, unknown> = {};

  // Use prefilled params first
  if (prefilled?.intent) lead.intent = prefilled.intent;
  if (prefilled?.type) lead.property_type = prefilled.type;
  if (prefilled?.bedrooms) lead.bedrooms = prefilled.bedrooms;   // ← CRITICAL: carry bedroom count
  if (prefilled?.area && prefilled.area !== 'Any') lead.preferred_areas = [prefilled.area];
  if (prefilled?.budget_max) lead.budget_max = prefilled.budget_max;
  if (prefilled?.budget_min) lead.budget_min = prefilled.budget_min;

  // Then parse from text
  if (!lead.intent) {
    if (/\b(buy|purchase|buying|investment|invest)\b/i.test(text)) lead.intent = 'buy';
    else if (/\b(rent|lease|rental|renting)\b/i.test(text)) lead.intent = 'rent';
  }
  if (!lead.budget_max) {
    const mMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:m|million)\b/i);
    if (mMatch) lead.budget_max = parseFloat(mMatch[1]) * 1000000;
    const kMatch = text.match(/(\d{3,4})\s*k\b/i);
    if (kMatch && !mMatch) lead.budget_max = parseInt(kMatch[1]) * 1000;
  }
  if (!lead.property_type) {
    const bedMatch = text.match(/(\d+)\s*(?:bed|br|bhk|bedroom)/i);
    if (bedMatch) lead.property_type = bedMatch[1] + 'BR';
    else if (/studio/i.test(text)) lead.property_type = 'Studio';
  }
  return lead;
}
