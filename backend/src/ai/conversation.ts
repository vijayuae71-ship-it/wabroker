import OpenAI from 'openai';
import { config } from '../config';
import { query } from '../db';
import { whatsappService } from '../services/whatsapp';

const openai = new OpenAI({ apiKey: config.openaiApiKey });

const WEB_CHAT_URL = process.env.WEB_CHAT_URL || 'https://backend-production-41ca9.up.railway.app';

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

// ─── Stage machine: derive current qualifying stage from lead data ────────────
function getQualifyingStage(lead: Record<string, unknown>): string {
  if (!lead.intent) return 'ask_intent';
  if (!lead.property_type) return 'ask_type';
  if (!lead.preferred_areas || (lead.preferred_areas as string[]).length === 0) return 'ask_area';
  if (!lead.budget_max) return 'ask_budget';
  if (!lead.timeline) return 'ask_timeline';
  return 'qualified'; // All done → send link
}

// ─── Question messages for each stage ─────────────────────────────────────────
const STAGE_QUESTIONS: Record<string, string> = {
  ask_intent: `Hi! I'm Layla 👋 Your personal Dubai property expert.

Are you looking to *Buy* or *Rent*?

Reply with:
1️⃣ Buy
2️⃣ Rent`,

  ask_type: `Great choice! What type of property are you looking for?

Reply with:
1️⃣ Studio
2️⃣ 1 Bedroom
3️⃣ 2 Bedrooms
4️⃣ 3 Bedrooms
5️⃣ Villa / Townhouse
6️⃣ Penthouse`,

  ask_area: `Perfect! Which area in Dubai interests you?

Reply with:
1️⃣ Downtown Dubai
2️⃣ Dubai Marina / JBR
3️⃣ Palm Jumeirah
4️⃣ Business Bay
5️⃣ JVC / JVT
6️⃣ Dubai Hills
7️⃣ Any area (show me the best options)`,

  ask_budget: `And what's your budget range?

Reply with:
1️⃣ Under AED 500K
2️⃣ AED 500K – 1M
3️⃣ AED 1M – 2M
4️⃣ AED 2M – 5M
5️⃣ AED 5M+`,

  ask_timeline: `Almost there! ⚡ When are you looking to move or invest?

Reply with:
1️⃣ Immediately (within 1 month)
2️⃣ 1–3 months
3️⃣ 3–6 months
4️⃣ Just exploring options`,
};

// ─── Parse user reply into structured data ───────────────────────────────────
function parseIntentReply(text: string): string | null {
  const t = text.toLowerCase().trim();
  if (/^1$|buy|purchase|buying|invest/.test(t)) return 'buy';
  if (/^2$|rent|lease|rental/.test(t)) return 'rent';
  return null;
}

function parseTypeReply(text: string): string | null {
  const t = text.toLowerCase().trim();
  if (/^1$|studio/.test(t)) return 'Studio';
  if (/^2$|1\s*bed|1\s*bhk|one\s*bed/.test(t)) return '1BR';
  if (/^3$|2\s*bed|2\s*bhk|two\s*bed/.test(t)) return '2BR';
  if (/^4$|3\s*bed|3\s*bhk|three\s*bed/.test(t)) return '3BR';
  if (/^5$|villa|townhouse|town/.test(t)) return 'Villa';
  if (/^6$|penthouse|pent/.test(t)) return 'Penthouse';
  return null;
}

function parseAreaReply(text: string): string | null {
  const t = text.toLowerCase().trim();
  if (/^1$|downtown/.test(t)) return 'Downtown Dubai';
  if (/^2$|marina|jbr/.test(t)) return 'Dubai Marina';
  if (/^3$|palm/.test(t)) return 'Palm Jumeirah';
  if (/^4$|business bay|bay/.test(t)) return 'Business Bay';
  if (/^5$|jvc|jvt/.test(t)) return 'JVC';
  if (/^6$|hills|dubai hills/.test(t)) return 'Dubai Hills';
  if (/^7$|any/.test(t)) return 'Any';
  return null;
}

function parseBudgetReply(text: string, intent: string): { min: number; max: number } | null {
  const t = text.toLowerCase().trim();
  const isRent = intent === 'rent';

  if (isRent) {
    // Rent budgets per year
    if (/^1$|under.*50|50k|50,000/.test(t)) return { min: 0, max: 50000 };
    if (/^2$|50.*100|100k/.test(t)) return { min: 50000, max: 100000 };
    if (/^3$|100.*150|150k/.test(t)) return { min: 100000, max: 150000 };
    if (/^4$|150.*200|200k/.test(t)) return { min: 150000, max: 200000 };
    if (/^5$|200\+|above 200|over 200/.test(t)) return { min: 200000, max: 9999999 };
  } else {
    // Buy budgets
    if (/^1$|under.*500|500k/.test(t)) return { min: 0, max: 500000 };
    if (/^2$|500.*1m|500k.*1m|1\s*million/.test(t)) return { min: 500000, max: 1000000 };
    if (/^3$|1m.*2m|1.*2\s*mil/.test(t)) return { min: 1000000, max: 2000000 };
    if (/^4$|2m.*5m|2.*5\s*mil/.test(t)) return { min: 2000000, max: 5000000 };
    if (/^5$|5m\+|above 5|over 5/.test(t)) return { min: 5000000, max: 99999999 };
  }

  // Generic number parsing fallback
  const numMatch = text.match(/(\d[\d,]*)/);
  if (numMatch) {
    const n = parseInt(numMatch[1].replace(/,/g, ''));
    if (n > 1000000) return { min: n * 0.8, max: n * 1.2 };
    if (n > 1000) return { min: n * 1000 * 0.8, max: n * 1000 * 1.2 };
  }

  return null;
}

function parseTimelineReply(text: string): string {
  const t = text.toLowerCase().trim();
  if (/^1$|immediate|asap|now|urgent|1 month|within/.test(t)) return 'immediate';
  if (/^2$|1.*3|three month/.test(t)) return '1-3 months';
  if (/^3$|3.*6|six month/.test(t)) return '3-6 months';
  if (/^4$|explor|later|no rush|just look/.test(t)) return 'exploring';
  return 'flexible';
}

// ─── Build the web chat URL with pre-filled filters ──────────────────────────
function buildWebChatUrl(lead: Record<string, unknown>): string {
  const params = new URLSearchParams();
  if (lead.intent) params.set('intent', lead.intent as string);
  if (lead.property_type) params.set('type', lead.property_type as string);
  if (lead.preferred_areas && (lead.preferred_areas as string[]).length > 0) {
    params.set('area', (lead.preferred_areas as string[])[0]);
  }
  if (lead.budget_max) params.set('budget_max', String(lead.budget_max));
  if (lead.budget_min) params.set('budget_min', String(lead.budget_min));
  if (lead.timeline) params.set('timeline', lead.timeline as string);
  if (lead.name) params.set('name', lead.name as string);
  return `${WEB_CHAT_URL}?${params.toString()}`;
}

// ─── Main WhatsApp message processor ────────────────────────────────────────
export async function processMessage(
  conversationId: string,
  leadId: string,
  incomingMessage: string,
  messageType: 'text' | 'audio' = 'text',
  mediaTranscription?: string
): Promise<AIResponse> {
  // Get lead data
  const leadResult = await query(`SELECT * FROM leads WHERE id = $1`, [leadId]);
  let lead = leadResult.rows[0] || {};

  const userText = (mediaTranscription || incomingMessage || '').trim();

  const stage = getQualifyingStage(lead);

  // ── Handle FAQs / off-topic with GPT (only when not in structured flow) ────
  const isGreeting = /^(hi|hello|hey|salaam|مرحبا|السلام|howdy|yo|hola|good morning|good afternoon|good evening)/i.test(userText);

  if (isGreeting && stage === 'ask_intent') {
    const greetMsg = `Hi there! 👋 I'm *Layla*, your personal Dubai property expert.\n\nI'll find you the perfect property in under 2 minutes. Let's start:\n\nAre you looking to *Buy* or *Rent*?\n\nReply:\n1️⃣ Buy\n2️⃣ Rent`;
    return {
      message: greetMsg,
      language: 'en',
      leadUpdates: {},
      handoffRequired: false,
      handoffReason: null,
      stage: 'greeting',
    };
  }

  // ── Process answer based on current stage ────────────────────────────────
  let leadUpdates: Record<string, unknown> = {};
  let nextQuestion = '';
  let isQualified = false;

  switch (stage) {
    case 'ask_intent': {
      const intent = parseIntentReply(userText);
      if (!intent) {
        return {
          message: STAGE_QUESTIONS.ask_intent,
          language: 'en',
          leadUpdates: {},
          handoffRequired: false,
          handoffReason: null,
          stage: 'ask_intent',
        };
      }
      leadUpdates.intent = intent;
      // Update rent budget options label
      nextQuestion = intent === 'rent'
        ? STAGE_QUESTIONS.ask_type.replace('looking for?', 'looking to rent?')
        : STAGE_QUESTIONS.ask_type;
      break;
    }

    case 'ask_type': {
      const ptype = parseTypeReply(userText);
      if (!ptype) {
        return {
          message: STAGE_QUESTIONS.ask_type,
          language: 'en',
          leadUpdates: {},
          handoffRequired: false,
          handoffReason: null,
          stage: 'ask_type',
        };
      }
      leadUpdates.property_type = ptype;
      nextQuestion = STAGE_QUESTIONS.ask_area;
      break;
    }

    case 'ask_area': {
      const area = parseAreaReply(userText);
      if (!area) {
        return {
          message: STAGE_QUESTIONS.ask_area,
          language: 'en',
          leadUpdates: {},
          handoffRequired: false,
          handoffReason: null,
          stage: 'ask_area',
        };
      }
      leadUpdates.preferred_areas = area === 'Any' ? [] : [area];
      nextQuestion = lead.intent === 'rent'
        ? `What's your monthly/yearly rent budget?\n\nReply with:\n1️⃣ Under AED 50K/year\n2️⃣ AED 50K–100K/year\n3️⃣ AED 100K–150K/year\n4️⃣ AED 150K–200K/year\n5️⃣ AED 200K+/year`
        : STAGE_QUESTIONS.ask_budget;
      break;
    }

    case 'ask_budget': {
      const budget = parseBudgetReply(userText, (lead.intent as string) || 'buy');
      if (!budget) {
        return {
          message: lead.intent === 'rent'
            ? `What's your monthly/yearly rent budget?\n\nReply with:\n1️⃣ Under AED 50K/year\n2️⃣ AED 50K–100K/year\n3️⃣ AED 100K–150K/year\n4️⃣ AED 150K–200K/year\n5️⃣ AED 200K+/year`
            : STAGE_QUESTIONS.ask_budget,
          language: 'en',
          leadUpdates: {},
          handoffRequired: false,
          handoffReason: null,
          stage: 'ask_budget',
        };
      }
      leadUpdates.budget_min = budget.min;
      leadUpdates.budget_max = budget.max;
      nextQuestion = STAGE_QUESTIONS.ask_timeline;
      break;
    }

    case 'ask_timeline': {
      const timeline = parseTimelineReply(userText);
      leadUpdates.timeline = timeline;
      isQualified = true;
      break;
    }

    case 'qualified': {
      // Already qualified — handle free-form questions with GPT
      return await handleFreeFormMessage(userText, lead, conversationId);
    }
  }

  // ── Save lead updates ─────────────────────────────────────────────────────
  if (Object.keys(leadUpdates).length > 0) {
    const mergedLead = { ...lead, ...leadUpdates };

    if (isQualified) {
      // Build and send the web chat URL
      const url = buildWebChatUrl(mergedLead);
      const urgencyNote = (mergedLead.timeline as string) === 'immediate'
        ? '⚡ Since you need something immediately, I\'ve prioritised the best available options for you.'
        : '';
      const intentWord = mergedLead.intent === 'rent' ? 'rent' : 'buy';
      const msg = `Perfect! I've found some great matches for you. 🎯\n\n${urgencyNote ? urgencyNote + '\n\n' : ''}Your personalised property results are ready 👇\n\n🔗 ${url}\n\n_Tap the link to see full photos, DLD data, pricing and book a viewing — all in one place._`;

      return {
        message: msg,
        language: 'en',
        leadUpdates: { ...leadUpdates, status: 'hot', score: 75 },
        handoffRequired: false,
        handoffReason: null,
        stage: 'qualified',
      };
    }

    return {
      message: nextQuestion,
      language: 'en',
      leadUpdates,
      handoffRequired: false,
      handoffReason: null,
      stage,
    };
  }

  // Fallback
  return {
    message: STAGE_QUESTIONS[stage] || STAGE_QUESTIONS.ask_intent,
    language: 'en',
    leadUpdates: {},
    handoffRequired: false,
    handoffReason: null,
    stage,
  };
}

// ─── Free-form GPT handler (post-qualification or FAQs) ──────────────────────
async function handleFreeFormMessage(
  message: string,
  lead: Record<string, unknown>,
  _conversationId: string
): Promise<AIResponse> {
  const systemPrompt = `You are Layla, a Dubai real estate expert. The client has already been qualified. Answer their question helpfully and concisely. Keep replies under 3 sentences. Never hand off to another person — you are the expert. Lead context: ${JSON.stringify({ intent: lead.intent, property_type: lead.property_type, budget_max: lead.budget_max, preferred_areas: lead.preferred_areas })}`;

  try {
    const completion = await openai.chat.completions.create({
      model: config.openaiModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });
    const reply = completion.choices[0].message.content || 'I\'m here to help! What would you like to know?';
    return {
      message: reply,
      language: 'en',
      leadUpdates: {},
      handoffRequired: false,
      handoffReason: null,
      stage: 'qualified',
    };
  } catch {
    return {
      message: 'Happy to help! Feel free to ask me anything about your property search. 😊',
      language: 'en',
      leadUpdates: {},
      handoffRequired: false,
      handoffReason: null,
      stage: 'qualified',
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
