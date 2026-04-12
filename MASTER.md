# Flyer Generator

**One-line description:** Sign up, upload a photo of an item → AI generates a title, description, and Facebook Marketplace copy → download a PNG flyer instantly. Fully authenticated with NextAuth, Prisma, and PostgreSQL.

---

## Quick Start

```bash
# 1. Clone
git clone <your-repo-url>
cd flyer

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.local.example .env.local
# Edit .env.local and add the required variables (see Environment Variables below)

# 4. Set up the database
npx prisma migrate dev

# 5. Run dev server
npm run dev
# Open http://localhost:3000
```

`.env.local` requires these keys:
```
# Database (PostgreSQL via Supabase or local)
DATABASE_URL=postgresql://user:password@host:port/dbname
DIRECT_URL=postgresql://user:password@host:port/dbname  # For Prisma migrations

# Authentication
NEXTAUTH_SECRET=generate-with-openssl-rand-hex-32
NEXTAUTH_URL=http://localhost:3000

# AI
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

**Generate `NEXTAUTH_SECRET`:**
```bash
openssl rand -hex 32
```

---

## Reference Docs

- **PRD.md** — Product Requirements Document (user stories, feature spec, scope)
- **TRD.md** — Technical Requirements Document (architecture, API design, data flow)

---

## Features

- **User accounts** — email + password sign-up and sign-in via NextAuth
- **Authentication** — protected app routes and API endpoints; sessions stored as JWT cookies
- **Photo upload** — drag-and-drop or click-to-browse; supports JPEG, PNG, WebP, GIF
- **AI analysis** — sends image to OpenRouter (`nvidia/nemotron-nano-12b-v2-vl:free`) and gets back a flyer title, flyer description, FB Marketplace title, suggested price, and FB description
- **Editable fields** — all AI-generated fields are editable before preview
- **Live flyer preview** — 380 px wide card rendered in-browser as the user types
- **PNG download** — html2canvas renders the flyer card to a high-res PNG (3x scale)
- **FB Marketplace copy** — mock FB listing card with one-click copy for title, price, and description
- **Settings (localStorage)** — pickup address, contact info, and optional OpenRouter API key stored locally
- **BYOK support** — users can paste their own OpenRouter key in Settings; falls back to the owner's server-side key if blank
- **Change password** — authenticated users can change their password at any time

---

## Project Structure

```
flyer/
├── app/
│   ├── layout.tsx                          # Root layout with SessionProvider + Toaster
│   ├── page.tsx                            # Public landing page with sign-in/sign-up CTAs
│   ├── globals.css                         # Tailwind base styles
│   ├── app/
│   │   └── page.tsx                        # Protected flyer app (redirects to auth if not logged in)
│   │       └── mounts <FlyerApp />
│   ├── auth/
│   │   ├── signin/page.tsx                 # Sign-in form
│   │   ├── signup/page.tsx                 # Sign-up form
│   │   ├── change-password/page.tsx        # Change password form
│   │   └── [...]auth]/route.ts             # NextAuth handler
│   ├── robots.ts                           # SEO robots.txt
│   ├── sitemap.ts                          # SEO sitemap
│   └── api/
│       └── analyze/
│           └── route.ts                    # POST /api/analyze (protected: checks session)
│                                           #   calls OpenRouter vision model,
│                                           #   returns { flyer, fb }
├── components/
│   ├── FlyerApp.tsx                        # Main app shell: state machine
│   │                                       #   (setup → upload → details → preview)
│   ├── FlyerPreview.tsx                    # 380px flyer card INLINE STYLES ONLY
│   │                                       #   (required for html2canvas PNG export)
│   ├── FBMarketplaceCard.tsx               # Mock FB Marketplace listing + copy buttons
│   ├── AuthForm.tsx                        # Shared auth form wrapper ('use client')
│   ├── providers.tsx                       # SessionProvider wrapper
│   └── Toaster.tsx                         # Sonner toast notifications
├── lib/
│   ├── auth.ts                             # NextAuth config (Credentials provider)
│   ├── auth-actions.ts                     # Server actions: signUp, changePassword
│   ├── db.ts                               # Prisma singleton
│   ├── validations.ts                      # Zod schemas for auth forms
├── prisma/
│   └── schema.prisma                       # User model (email, passwordHash)
├── middleware.ts                           # Protect /app/* and /auth/change-password routes
├── next.config.js                          # Next.js config (CSP, etc.)
├── tailwind.config.js                      # Tailwind config
├── tsconfig.json                           # TypeScript config
├── package.json                            # Dependencies
├── MASTER.md                               # This file
├── PRD.md                                  # Product Requirements Document
├── TRD.md                                  # Technical Requirements Document
└── prisma/
    └── migrations/                         # Database migration history
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 3 (UI) + inline styles (flyer card only) |
| AI | OpenRouter API — `nvidia/nemotron-nano-12b-v2-vl:free` (vision) |
| HTTP client | OpenAI SDK (`openai` npm package pointed at OpenRouter base URL) |
| PNG export | `html2canvas` 1.4.1 |
| Persistence | `localStorage` (settings) + PostgreSQL (user accounts) |
| Auth | NextAuth v4 (Credentials provider: email + password) |
| ORM | Prisma 7 |
| Database | PostgreSQL via Supabase (pgbouncer connection pooling) |
| Password hashing | bcryptjs (cost factor 12) |
| Form validation | Zod |
| Notifications | Sonner (toast library) |
| Deployment | Vercel |

---

## Deploy to Vercel

1. Push this repo to GitHub (or GitLab / Bitbucket).
2. Set up PostgreSQL (recommended: [Supabase](https://supabase.com)) and create a database named `flyer` (or custom name in `DATABASE_URL`).
3. Run migrations locally first to test:
   ```bash
   npx prisma migrate dev
   ```
4. Go to [vercel.com](https://vercel.com) → **Add New Project** → import the repo.
5. In Vercel project settings, go to **Environment Variables** and add:
   - `DATABASE_URL` = PostgreSQL connection string (with connection pooling if needed)
   - `DIRECT_URL` = Direct PostgreSQL connection (for Prisma migrations)
   - `NEXTAUTH_SECRET` = generated via `openssl rand -hex 32`
   - `NEXTAUTH_URL` = `https://your-project.vercel.app`
   - `OPENROUTER_API_KEY` = your OpenRouter API key
6. Click **Deploy**. Vercel auto-detects Next.js and runs `next build`.
   - The app automatically runs `prisma generate` as a postinstall hook.
   - API routes (`/api/analyze`, `/api/auth/[...nextauth]`) deploy as Vercel Serverless Functions.

---

## How to Share

1. Deploy to Vercel (see Deploy section above).
2. Share the deployed URL (e.g. `https://flyer-abc123.vercel.app`) with friends.
3. Friends sign up for a free account with email + password.
4. They enter their pickup address and contact info once (saved to `localStorage`).
5. They upload a photo, review/edit AI-generated copy, and download the PNG flyer.
6. The owner's `OPENROUTER_API_KEY` covers AI calls by default.
7. Friends who want to use their own quota can paste their own OpenRouter API key in **Settings** (gear icon in header). Get a free key at [openrouter.ai](https://openrouter.ai) → Keys.

## Environment Variables Reference

| Variable | Required | Used by | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | Prisma client (all routes) | PostgreSQL connection string with connection pooling |
| `DIRECT_URL` | Yes (Vercel) | `prisma migrate` CLI | Direct PostgreSQL connection (no pooling) for migrations |
| `NEXTAUTH_SECRET` | Yes | NextAuth middleware | JWT session secret; generate via `openssl rand -hex 32` |
| `NEXTAUTH_URL` | Yes (production) | NextAuth callbacks | Full public URL of the app (e.g. `https://flyer.vercel.app`) |
| `OPENROUTER_API_KEY` | Yes (unless all users provide BYOK) | `/api/analyze` | Default OpenRouter API key |

**Notes:**
- `DATABASE_URL` and `DIRECT_URL` can be the same if your PostgreSQL provider doesn't require connection pooling. Supabase requires both for serverless environments.
- `NEXTAUTH_SECRET` must be set before the app starts; it is checked at runtime in `lib/auth.ts`.
- All environment variables are loaded from `.env.local` in development and from Vercel project settings in production.
