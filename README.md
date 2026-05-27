# Tally — real Telegram Mini App

A working expense-splitter for Telegram. Bot + Mini App in one Node.js codebase. Deploy free on Vercel.

## What this is

- **`/api/webhook`** — Telegram bot. Handles `/add`, `/balance`, `/settle`, `/friend add`, `/paid`, etc.
- **`/api/me`, `/api/expenses`, `/api/friends`, `/api/settled`, `/api/subs`** — REST API the Mini App calls.
- **`/public/*`** — The Mini App itself (React, no build step).

Storage: Vercel KV (free Redis). All your data is keyed by your Telegram user ID. Anyone using the bot has their own private wallet — no cross-talk.

---

## Deploy (one-time setup, ~15 min)

You need a free GitHub account, a free Vercel account, and a Telegram bot token.

### 1. Create the GitHub repo

1. **github.com → New repository**
2. Name it `tally-app` (or anything). Make it Public. ✅ Add a README.
3. **Add file → Upload files**. Drag in every file in the `tally-app/` folder (including `api/`, `api/_lib/`, `public/`, `public/screens/`).
   - **Important**: GitHub's web uploader preserves folder structure when you drag entire folders. If it flattens them, use [github.dev](https://github.dev) or `git` from the command line.
4. Commit.

### 2. Deploy to Vercel

1. **vercel.com → Sign up with GitHub** (free Hobby plan).
2. **Add New… → Project → Import** your `tally-app` repo.
3. Framework preset: **Other**. Click **Deploy**. Wait ~30 sec.
4. You'll get a URL like `https://tally-app-yourname.vercel.app`. **Copy it.**

### 3. Set up Vercel KV (the database)

1. In your new Vercel project: **Storage** tab → **Create Database** → **KV**.
2. Name: `tally-kv`. Region: pick one near you. Click **Create**.
3. Click **Connect Project** → select `tally-app` → ✅ all environments → **Connect**.
4. This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` env vars automatically.

### 4. Add your bot token

1. **@BotFather → /token → TallyBuddyBot** to get a fresh token (revoke the old one with `/revoke` first since it was exposed in chat).
2. Vercel project → **Settings → Environment Variables**.
3. Add **`BOT_TOKEN`** = your token. Apply to all environments. Save.
4. **Deployments** tab → click the latest deploy → **Redeploy** so the env var loads.

### 5. Point Telegram at your webhook

In your Mac's Terminal (replace TOKEN and URL):

```bash
curl "https://api.telegram.org/botYOUR_TOKEN/setWebhook?url=https://YOUR-VERCEL-URL.vercel.app/api/webhook"
```

You should see `{"ok":true,"result":true,"description":"Webhook was set"}`.

This tells Telegram: stop polling, just hit my Vercel URL whenever a message arrives.

**⚠️ If you ever go back to running the local bot:** webhook and polling are mutually exclusive. Run `curl "https://api.telegram.org/botYOUR_TOKEN/deleteWebhook"` to clear it.

### 6. Wire up the Mini App menu button

In Telegram → **@BotFather → /mybots → TallyBuddyBot → Bot Settings → Menu Button → Configure menu button**.

- URL: `https://YOUR-VERCEL-URL.vercel.app/`  *(the root, not `/api/webhook`)*
- Button text: `🪙 Tally`

### 7. Try it

1. Open `https://t.me/TallyBuddyBot`
2. Tap **🪙 Tally** next to the text input.
3. The mini app loads with **your own** data — empty at first.
4. Tap **＋**, add a friend, log an expense.

Same data shows in `/balance` and `/settle` in the chat. 🎉

---

## Local development

```bash
npm install -g vercel
cd tally-app
vercel link    # connect to your project
vercel env pull # downloads BOT_TOKEN, KV_* into .env.local
vercel dev
```

Open `http://localhost:3000/?devUser=Nadine` — bypasses Telegram auth in dev. You must also set `ALLOW_DEV_USER=1` in `.env.local`.

---

## What's still missing

- **Receipt OCR** — designed but not implemented. Adding it = call Claude vision in a new `/api/receipt-parse.js` endpoint, return parsed line items. Hold ~2 hrs of work.
- **Multi-currency conversion** — currencies are tracked separately. No live FX conversion yet (would just need a call to exchangerate-api on the home screen).
- **Group concept** — currently every expense lives in one flat ledger. To split groups (Roommates / Trip / Subs) we'd add a `groupId` to each expense.

---

## Where things live

```
tally-app/
├── api/
│   ├── _lib/
│   │   ├── auth.js     # Telegram initData signature verification
│   │   ├── db.js       # KV wrapper (falls back to local JSON)
│   │   └── money.js    # parsing, formatting, debt simplification
│   ├── webhook.js      # Telegram bot
│   ├── me.js           # bootstrap call from Mini App
│   ├── expenses.js     # add / delete
│   ├── friends.js      # add / list / remove
│   ├── settled.js      # mark a payment as done
│   └── subs.js         # subscriptions CRUD
└── public/
    ├── index.html      # entry
    ├── api.js          # fetch wrappers, exposes window.TallyAPI
    ├── ui.jsx          # Avatar, Sheet, Button, Card, Row…
    ├── app.jsx         # root, routing, /api/me bootstrap
    └── screens/
        ├── home.jsx
        ├── add-expense.jsx
        ├── settle.jsx
        ├── friends.jsx
        └── subs.jsx
```
