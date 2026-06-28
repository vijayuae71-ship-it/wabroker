# 🚀 WABroker — Deploy in 30 Minutes

## Your API Key is Pre-Configured ✅
OpenAI GPT-4o is already set up. You just need WhatsApp + hosting.

---

## STEP 1: Deploy to Railway (15 mins, FREE to start)

1. Go to **[railway.app](https://railway.app)** → Sign up with GitHub
2. Click **New Project** → **Deploy from GitHub repo**
3. Upload this whole `wabroker` folder to a new GitHub repo
4. Railway auto-detects Docker → click **Deploy**
5. Add a **PostgreSQL** plugin inside Railway (1 click)
6. Go to **Variables** tab → add these:
   ```
   OPENAI_API_KEY=sk-proj-Quz7DcxX1n... (already in .env)
   JWT_SECRET=any-random-string-you-choose
   WHATSAPP_API_KEY=FILL_LATER
   WHATSAPP_PHONE_NUMBER_ID=FILL_LATER
   WHATSAPP_VERIFY_TOKEN=wabroker_secret_2024
   NODE_ENV=production
   ```
7. Railway gives you a URL like `https://wabroker-backend.up.railway.app` ✅

---

## STEP 2: Deploy Dashboard to Vercel (5 mins, FREE)

1. Go to **[vercel.com](https://vercel.com)** → Sign up with GitHub
2. **New Project** → import the `dashboard` folder
3. Add environment variable:
   ```
   VITE_API_URL=https://wabroker-backend.up.railway.app
   ```
4. Click Deploy → get URL like `https://wabroker.vercel.app` ✅

---

## STEP 3: Connect WhatsApp via 360dialog (10 mins, ~$5/month)

1. Go to **[360dialog.com](https://360dialog.com)** → Sign up
2. Register a WhatsApp Business number (can use any number)
3. Get your **API Key** + **Phone Number ID**
4. Set webhook URL in 360dialog:
   ```
   https://wabroker-backend.up.railway.app/webhook/whatsapp
   ```
5. Verify token: `wabroker_secret_2024`
6. Add to Railway Variables:
   ```
   WHATSAPP_API_KEY=your_360dialog_key
   WHATSAPP_PHONE_NUMBER_ID=your_phone_id
   ```

---

## STEP 4: Test It 🎉

1. Open your dashboard at `https://wabroker.vercel.app`
2. Register your agency
3. Send a WhatsApp message to your number
4. **Layla** (your AI agent) responds instantly
5. Watch the lead appear in your dashboard

---

## Monthly Running Costs

| Service | Cost |
|---|---|
| Railway (backend + DB) | $5–20/month |
| Vercel (dashboard) | FREE |
| 360dialog (WhatsApp) | $5–15/month |
| OpenAI API (GPT-4o) | ~$20–50/month |
| **Total** | **~$30–85/month** |

You charge agencies AED 299–2,999/month. First 3 customers = profitable. 🎯

---

## Support
Message Tasklet AI anytime for help, upgrades, or new features.
