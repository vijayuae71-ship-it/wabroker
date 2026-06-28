# 🏙️ WABroker — WhatsApp AI Broker for Dubai Real Estate

## What's Built
- **AI Agent "Layla"** — Qualifies leads in Arabic/English/Russian/Hindi via WhatsApp
- **DLD Integration** — Live Dubai Land Department price benchmarking
- **Lead Dashboard** — Agent UI to manage, score and convert leads
- **Full API** — REST endpoints for leads, analytics, auth

## Stack
- **Backend**: Node.js + TypeScript + Express + PostgreSQL + OpenAI GPT-4o
- **Frontend**: React + Vite + Tailwind CSS
- **Hosting**: Railway (backend + DB) + Vercel (dashboard)
- **WhatsApp**: 360dialog BSP

## Project Structure
```
wabroker/
├── backend/          # Node.js API + AI engine
│   ├── src/
│   │   ├── ai/       # GPT-4o conversation logic
│   │   ├── db/       # PostgreSQL schema & migrations
│   │   ├── routes/   # REST API routes
│   │   ├── services/ # WhatsApp, DLD, Lead services
│   │   └── webhooks/ # WhatsApp webhook handler
│   └── .env          # Environment variables (DO NOT COMMIT)
├── dashboard/        # React agent dashboard
└── docker-compose.yml
```

## Quick Deploy (Railway)

### Step 1: Deploy Backend
1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Connect this repo
3. Add PostgreSQL plugin
4. Set environment variables (copy from backend/.env)

### Step 2: Deploy Dashboard  
1. Go to [vercel.com](https://vercel.com) → New Project
2. Connect dashboard folder
3. Set `VITE_API_URL` to your Railway backend URL

### Step 3: Connect WhatsApp
1. Sign up at [360dialog.com](https://360dialog.com)
2. Get API key + Phone Number ID
3. Set webhook URL: `https://your-railway-url/webhook/whatsapp`
4. Add to Railway env vars

## Environment Variables Needed
| Variable | Where to Get |
|---|---|
| `OPENAI_API_KEY` | ✅ Already configured |
| `WHATSAPP_API_KEY` | 360dialog dashboard |
| `WHATSAPP_PHONE_NUMBER_ID` | 360dialog dashboard |
| `DATABASE_URL` | Auto-set by Railway |
| `JWT_SECRET` | Generate any random string |

## AI Agent — Layla
Layla is a Dubai-native AI real estate consultant that:
- Responds in the lead's language (Arabic/English/Russian/Hindi)
- Qualifies budget, timeline, property type, location preference
- Benchmarks price expectations vs. DLD transaction data
- Scores leads (hot/warm/cold) and alerts agents
- Hands off to human agents at the right moment

## Revenue Model
| Plan | Price | Users |
|---|---|---|
| Starter | AED 299/month | 1 agent, 100 leads |
| Growth | AED 899/month | 5 agents, 500 leads |
| Team | AED 2,499/month | Unlimited |

---
Built by Tasklet AI — June 2026
