# Flyer Generator

**One-line description:** Upload a photo of an item → AI generates a title, description, and Facebook Marketplace copy → download a PNG flyer instantly.

---

## Quick Start

```bash
# 1. Clone
git clone <your-repo-url>
cd flyer

# 2. Install dependencies
npm install

# 3. Add environment variables
cp .env.local.example .env.local
# Edit .env.local and set OPENROUTER_API_KEY=sk-or-v1-...

# 4. Run dev server
npm run dev
# Open http://localhost:3000
```

`.env.local` needs one key:
```
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

---

## Reference Docs

- **PRD.md** — Product Requirements Document (user stories, feature spec, scope)
- **TRD.md** — Technical Requirements Document (architecture, API design, data flow)

---

## Features

- **Photo upload** — drag-and-drop or click-to-browse; supports JPEG, PNG, WebP, GIF
- **AI analysis** — sends image to OpenRouter (`nvidia/nemotron-nano-12b-v2-vl:free`) and gets back a flyer title, flyer description, FB Marketplace title, suggested price, and FB description
- **Editable fields** — all AI-generated fields are editable before preview
- **Live flyer preview** — 380 px wide card rendered in-browser as the user types
- **PNG download** — html2canvas renders the flyer card to a high-res PNG (3x scale)
- **FB Marketplace copy** — mock FB listing card with one-click copy for title, price, and description
- **Settings (localStorage)** — pickup address, contact info, and optional OpenRouter API key stored locally; no account required
- **BYOK support** — friends can paste their own OpenRouter key in Settings; falls back to the owner's server-side key if blank
- **No auth** — fully public, no login/signup

---

## Project Structure

```
flyer/
├── app/
│   ├── layout.tsx            # Root layout; sets <title> and imports globals.css
│   ├── page.tsx              # Entry route — renders <FlyerApp />
│   ├── globals.css           # Tailwind base styles
│   └── api/
│       └── analyze/
│           └── route.ts      # POST /api/analyze — calls OpenRouter vision model,
│                             #   returns { flyer: {title, description},
│                             #             fb: {title, price, description} }
├── components/
│   ├── FlyerApp.tsx          # Main app shell: state management, step machine
│   │                         #   (setup → upload → details → preview), settings modal
│   ├── FlyerPreview.tsx      # Renders the 380px flyer card using INLINE STYLES only
│   │                         #   (required for html2canvas PNG export); handles download
│   └── FBMarketplaceCard.tsx # Mock FB Marketplace listing + copy-to-clipboard fields
├── next.config.js            # Next.js config
├── tailwind.config.js        # Tailwind config
├── tsconfig.json             # TypeScript config
├── package.json              # Dependencies
├── MASTER.md                 # This file
├── PRD.md                    # Product Requirements Document
└── TRD.md                    # Technical Requirements Document
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS (UI) + inline styles (flyer card) |
| AI | OpenRouter API — `nvidia/nemotron-nano-12b-v2-vl:free` (vision) |
| HTTP client | `openai` npm package pointed at OpenRouter base URL |
| PNG export | `html2canvas` |
| Persistence | `localStorage` (settings only; no database) |
| Auth | None |
| Deployment | Vercel |

---

## Deploy to Vercel

1. Push this repo to GitHub (or GitLab / Bitbucket).
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import the repo.
3. In the Vercel project settings, go to **Environment Variables** and add:
   - `OPENROUTER_API_KEY` = your OpenRouter key
4. Click **Deploy**. Vercel auto-detects Next.js and runs `next build`.

No other config needed — the app is fully static except for the `/api/analyze` route, which Vercel deploys as a serverless function automatically.

---

## How Friends Can Use It

1. Share the deployed Vercel URL (e.g. `https://flyer-abc123.vercel.app`).
2. On first visit they enter their pickup address and contact info — saved to their browser's localStorage.
3. They upload a photo, review/edit the AI-generated copy, and download the PNG flyer.
4. **No account needed.** The owner's `OPENROUTER_API_KEY` covers AI calls by default.
5. Friends who want to use their own quota can paste their own OpenRouter key in **Settings** (gear icon, top-right). Get a free key at [openrouter.ai](https://openrouter.ai) → Keys.
