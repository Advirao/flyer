# Technical Requirements Document — Flyer Generator

**Version:** 1.0  
**Date:** 2026-04-10  
**Status:** Current

---

## Table of Contents

1. [Overview](#1-overview)
2. [System Architecture](#2-system-architecture)
3. [Component Design](#3-component-design)
4. [API Specifications](#4-api-specifications)
5. [Data Flow](#5-data-flow)
6. [State Management](#6-state-management)
7. [Security Considerations](#7-security-considerations)
8. [Performance Considerations](#8-performance-considerations)
9. [Dependencies](#9-dependencies)
10. [Environment Variables](#10-environment-variables)
11. [Deployment Guide](#11-deployment-guide)
12. [Known Limitations](#12-known-limitations)

---

## 1. Overview

Flyer Generator is a web application that lets users sign up, photograph a physical item for sale, and instantly receive a print-ready flyer (PNG) and a ready-to-paste Facebook Marketplace listing. Users create a free account, upload a photo, the AI model analyzes it and generates all copy, and the user downloads a flyer or copies the listing — in under a minute.

### Goals

- **Account-based access:** Users sign up with email + password stored securely in PostgreSQL.
- **Quick setup:** Single AI call per image produces all output (flyer copy + FB listing copy).
- **Persistent settings:** Pickup address and contact stored in `localStorage` (device-level) so they're never re-entered.
- **Autonomous usage:** Optional Bring-Your-Own-Key (BYOK) for users who want to use their own OpenRouter quota.
- **Protected API:** All endpoints require authentication via NextAuth JWT sessions.

### Non-Goals

- No third-party OAuth (Google, GitHub, etc.) — email + password only in v1.0.
- No server-side file storage; images are never persisted.
- No listing history; all flyer data is ephemeral.
- No admin dashboard or multi-user management features.

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                         │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Next.js App Router (client + server components)         │  │
│  │                                                          │  │
│  │  Auth pages:          FlyerApp (protected):              │  │
│  │  ├── /auth/signin     ├── /app (middleware guarded)      │  │
│  │  ├── /auth/signup     ├── FlyerPreview                   │  │
│  │  └── /auth/chg-pwd    ├── FBMarketplaceCard              │  │
│  │                       └── localStorage: settings          │  │
│  │                                                          │  │
│  │  JWT session cookie (NextAuth): { id, email }            │  │
│  └────────────┬─────────────────────────────┬──────────────┘  │
│               │                             │                 │
└───────────────┼─────────────────────────────┼─────────────────┘
                │ POST /api/auth/[...nextauth]
                │ (login, session callback)
                │ 
┌───────────────┼──────────────────────────────────────────────┐
│               │         Next.js API Routes (Server)          │
│               │                                              │
│  /api/auth/[...nextauth]  ──┬──  checks session, issues JWT  │
│                             │                                 │
│  /api/analyze             ──┴──  requires session             │
│  (POST)                        ├─ checks getServerSession()   │
│  ├─ validates imageBase64      ├─ uses userApiKey or env key  │
│  ├─ calls OpenRouter           └─ returns { flyer, fb }       │
│  └─ error handling                                             │
└──────────┬─────────────────────────────────────────────────────┘
           │
           ├──────────────────────┬─────────────────────────────┐
           │                      │                             │
┌──────────▼───────────────┐  ┌──▼─────────────────────────┐  │
│   OpenRouter API         │  │  PostgreSQL (Supabase)     │  │
│   (openrouter.ai/v1)     │  │  ├─ User (email, hash)     │  │
│   ├─ model inference     │  │  └─ Prisma ORM             │  │
│   └─ vision analysis     │  └────────────────────────────┘  │
└──────────────────────────┘                                   │
```

### Routing

| Route | Type | Description |
|---|---|---|
| `/` | Client page (public) | Landing page with sign-in/sign-up CTAs |
| `/auth/signin` | Client page (public) | Sign-in form |
| `/auth/signup` | Client page (public) | Sign-up form |
| `/auth/change-password` | Client page (protected) | Change password form (middleware guards) |
| `/app/*` | Client page (protected) | Flyer app (middleware redirects to `/auth/signin` if not authenticated) |
| `/api/auth/[...nextauth]` | Server route (public) | NextAuth handler (sign-in, session, etc.) |
| `/api/analyze` | Server route (protected) | Proxies image to OpenRouter, returns `{ flyer, fb }`. Requires valid session. |

All authentication uses NextAuth with JWT strategy (no server sessions).

---

## 3. Component Design

### 3.1 `app/page.tsx` — Landing Page

**Public route.** Marketing page with sign-in/sign-up CTAs. Includes:
- Feature cards (Upload, AI writes copy, Download/share)
- How-it-works steps
- Schema.org JSON-LD for SEO
- Links to `/auth/signin` and `/auth/signup`

No authentication required.

### 3.2 `app/auth/signin/page.tsx` — Sign In

**Public route.** Renders `<AuthForm mode="signin" />`. On successful sign-in via NextAuth Credentials provider, redirects to `/app`.

### 3.3 `app/auth/signup/page.tsx` — Sign Up

**Public route.** Renders `<AuthForm mode="signup" />`. On successful sign-up, auto-signs in the user (stale closure fix: credentials stored in ref) and redirects to `/app`. If auto-signin fails, redirects to `/auth/signin?registered=1`.

### 3.4 `app/auth/change-password/page.tsx` — Change Password

**Protected route** (middleware guards). Authenticated users only. Renders change-password form. Validates current password via bcrypt before accepting new password.

### 3.5 `app/app/page.tsx` — Protected Flyer App

**Protected route** (middleware guards). Unauthenticated users are redirected to `/auth/signin`. Renders `<FlyerApp />` component.

### 3.6 `app/layout.tsx`

Root layout. Wraps children with:
- `<Providers>` — NextAuth `<SessionProvider>`
- `<Toaster>` — Sonner toast notifications

Exports metadata (title, description, OG tags, robots directives).

### 3.7 `components/FlyerApp.tsx`

**The central component.** Owns all application state and orchestrates the step-based user flow.

#### Step machine

```
'setup'  ──(settings saved)──▶  'upload'
                                    │
                              (image selected)
                                    │
                                    ▼
                                'details'  ──(Preview →)──▶  'preview'
                                    ▲                              │
                                    └────────(← Back to edit)──────┘
```

- The app boots in `'upload'`. On first run (no saved settings), it redirects to `'setup'`.
- `'details'` is entered immediately when an image is selected — analysis runs concurrently; skeleton loaders fill the form fields while AI responds.
- `'preview'` shows a tabbed view: `flyer` tab or `fb` tab.
- Settings can be opened at any step via a modal overlay; the step machine is not reset.

#### Key interfaces

```ts
interface Settings {
  pickupAddress: string
  contact: string
  userApiKey?: string
}

interface FlyerData {
  imageDataUrl: string   // data: URL for inline display
  title: string
  description: string
  price: string
  pickupAddress: string
  contact: string
}

interface FBData {
  title: string
  price: string
  description: string
}

type Step = 'setup' | 'upload' | 'details' | 'preview'
type PreviewTab = 'flyer' | 'fb'
```

#### Image-to-base64 pipeline

The component converts the `File` object to base64 entirely client-side before sending to the API route. No `FormData` is used.

```ts
const arrayBuffer = await file.arrayBuffer()
const bytes = new Uint8Array(arrayBuffer)
let binary = ''
for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
const base64 = btoa(binary)
```

This approach avoids any dependency on the `Buffer` API in the browser and keeps the payload as a plain JSON string.

#### `canPreview` guard

The "Preview" button is only enabled when all required fields are non-empty. This prevents the user from proceeding to the preview step with an incomplete flyer:

```ts
const canPreview =
  imageDataUrl && flyerTitle?.trim() && flyerDescription?.trim() &&
  price?.trim() && fbTitle?.trim() && fbDescription?.trim() &&
  settings.pickupAddress && settings.contact
```

#### Internal sub-components (defined at bottom of file)

| Sub-component | Purpose |
|---|---|
| `Field` | Labelled form field wrapper |
| `Skeleton` | Animated pulse placeholder (shown during AI analysis) |
| `TabBtn` | Pill-style tab button for the preview step |
| `SetupForm` | Reused for both the initial setup screen and the settings modal |

### 3.8 `components/FlyerPreview.tsx`

Renders the printable flyer card. When `downloadable={true}`, also shows a "Download Flyer (PNG)" button.

#### Layout (fixed 380px width)

```
┌─────────────────────────────┐  width: 380px
│  Title (bold, centered)     │  background: #ede8de
├─────────────────────────────┤
│  Photo (max 260px height)   │  white bg, rounded border
├─────────────────────────────┤
│  ─────── divider ────────── │
│  🗒️ Description              │
│  💲 Price                    │
│  📍 Pickup Location          │
│  ✉️  Contact                  │
└─────────────────────────────┘
```

**Critical design constraint:** All flyer styles are applied as inline `style={{...}}` objects (not Tailwind classes). This is required because `html2canvas` renders CSS from computed styles; Tailwind's JIT output is reliable at runtime but may not survive canvas rasterization. Only the outer wrapper and download button use Tailwind. **See constraint D-05 in PRD.md.**

#### Download mechanism

```ts
const html2canvas = (await import('html2canvas')).default  // dynamic import (lazy)
const canvas = await html2canvas(flyerRef.current, {
  scale: 3,           // 3× pixel density → ~1140px wide output (print quality)
  useCORS: true,
  allowTaint: true,
  backgroundColor: '#ede8de',
  logging: false,
})
const link = document.createElement('a')
link.download = `flyer-${Date.now()}.png`
link.href = canvas.toDataURL('image/png')
link.click()
```

`html2canvas` is dynamically imported to avoid including it in the initial JS bundle.

### 3.9 `components/FBMarketplaceCard.tsx`

Renders a mock Facebook Marketplace listing card and a set of copy-to-clipboard controls.

#### Full description assembly

The component appends the pickup and contact details to the AI-generated description at render time:

```ts
const fullDescription =
  `${data.description}\n\n📍 Pickup: ${settings.pickupAddress}\n✉️ ${settings.contact}`
```

This means the AI-generated description deliberately excludes location/contact; those are injected from saved settings.

#### Copy UX

- Each field (`Title`, `Price`, `Description`) has an individual "Copy" button.
- "Copy Everything" compiles all fields into a single clipboard string.
- `copied` state is a `string | null` tracking which field was most recently copied; buttons show "Copied!" for 2 seconds via `setTimeout`.

---

## 4. API Specifications

### `POST /api/analyze`

**File:** `app/api/analyze/route.ts`

**Authentication:** Requires valid NextAuth session (checked via `getServerSession(authOptions)`). Returns HTTP 401 if not authenticated.

#### Request

```
Content-Type: application/json
Authorization: Bearer <NextAuth JWT session cookie>
```

```json
{
  "imageBase64": "<base64-encoded image bytes>",
  "mediaType": "image/jpeg",
  "userApiKey": "sk-or-v1-..."
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `imageBase64` | `string` | Yes | Raw base64 of the image file (no `data:` prefix) |
| `mediaType` | `string` | Yes | MIME type: `image/jpeg`, `image/png`, `image/webp`, `image/gif` |
| `userApiKey` | `string` | No | User-supplied OpenRouter API key; overrides server env var |

#### Response (success — HTTP 200)

```json
{
  "flyer": {
    "title": "For Sale - Red Trek Mountain Bike 27.5\"",
    "description": "Lightly used Trek Marlin 5, great condition with minor handlebar scratches."
  },
  "fb": {
    "title": "Trek Marlin 5 Mountain Bike - Like New",
    "price": "350",
    "description": "Selling my Trek Marlin 5 mountain bike in great condition. 27.5\" wheels, 21 speeds, only minor cosmetic wear. Perfect for trails or commuting. Message me for more info!"
  }
}
```

#### Response (error)

```json
{ "error": "<human-readable message>" }
```

| HTTP Status | Condition |
|---|---|
| `401` | No valid NextAuth session (user not authenticated) |
| `400` | `imageBase64` or `mediaType` missing; or unsupported `mediaType` |
| `413` | Image too large (base64 > 14 MB) |
| `500` | No API key available (neither `userApiKey` nor env var set) |
| `502` | OpenRouter API call failed or response JSON could not be parsed |
| `500` | Unexpected server error |

#### AI prompt

The route sends a single vision message with the image and the following structured text prompt:

```
Analyze this image of an item for sale and return ONLY this JSON (no markdown, no extra text):

{
  "flyer": {
    "title": "For Sale - [specific item name, color/model/size] (keep it under 10 words total)",
    "description": "1-2 sentences: what the item is, its condition, and any notable features."
  },
  "fb": {
    "title": "Short Facebook Marketplace listing title (under 10 words, no 'For Sale' prefix needed, be descriptive)",
    "price": "Suggested fair resale price as a number only, no $ sign (e.g. 10)",
    "description": "2-4 sentences written for a Facebook Marketplace listing. Mention the item, its condition, key features, and end with a friendly call-to-action like 'Message me for more info!' Do NOT include pickup location or contact details."
  }
}
```

#### Response sanitization

The model may occasionally wrap its JSON output in markdown code fences. The route strips these before parsing:

```ts
const jsonStr = raw
  .replace(/^```json\s*/i, '')
  .replace(/^```\s*/i, '')
  .replace(/```\s*$/i, '')
  .trim()
const parsed = JSON.parse(jsonStr)
```

If `JSON.parse` throws, the error propagates to the catch block and is returned as HTTP 500 with the error message.

---

## 5. Data Flow

### 5.1 First-run flow

```
App loads
  └─▶ useEffect reads localStorage('flyerSettings')
        ├── [no saved settings] → setStep('setup')
        └── [settings found but incomplete] → setStep('setup')
            [settings found and complete] → setStep('upload') (default)
```

### 5.2 Image analysis flow

```
User selects / drops image file
  │
  ├─▶ FileReader.readAsDataURL(file)
  │     └─▶ setImageDataUrl(result)       [for preview img src]
  │
  ├─▶ file.arrayBuffer() → btoa(binary)   [for API body]
  │
  ├─▶ setStep('details')                  [show form with skeletons]
  ├─▶ setAnalyzing(true)
  │
  └─▶ POST /api/analyze
        └─▶ [server] OpenRouter vision API call
              └─▶ [server] parse JSON response
                    └─▶ HTTP 200 { flyer, fb }
                          ├─▶ setFlyerTitle, setFlyerDescription
                          ├─▶ setFbTitle, setFbPrice, setFbDescription
                          └─▶ setAnalyzing(false)
```

### 5.3 Preview and export flow

```
User clicks "Preview →" (canPreview === true)
  └─▶ setStep('preview'), setPreviewTab('flyer')

  [Flyer tab]
    └─▶ <FlyerPreview data={flyerData} downloadable />
          └─▶ User clicks "Download Flyer (PNG)"
                └─▶ html2canvas(flyerRef, { scale: 3 })
                      └─▶ canvas.toDataURL('image/png')
                            └─▶ <a>.click() → browser download

  [FB Marketplace tab]
    └─▶ <FBMarketplaceCard data={fbData} imageDataUrl settings />
          └─▶ User clicks individual Copy or "Copy Everything"
                └─▶ navigator.clipboard.writeText(text)
```

### 5.4 Settings persistence flow

```
User saves settings (setup screen or modal)
  └─▶ localStorage.setItem('flyerSettings', JSON.stringify(settingsDraft))
        ├─▶ setSettings(settingsDraft)
        └─▶ if step === 'setup': setStep('upload')

Next app load
  └─▶ useEffect → JSON.parse(localStorage.getItem('flyerSettings'))
        └─▶ setSettings + setSettingsDraft
```

---

## 6. State Management

All state is managed locally in `FlyerApp.tsx` using React's `useState` and `useEffect`. There is no external state library (no Redux, Zustand, Context, etc.).

### State inventory

| State variable | Type | Description |
|---|---|---|
| `step` | `Step` | Current step in the wizard (`'setup' \| 'upload' \| 'details' \| 'preview'`) |
| `settings` | `Settings` | Committed settings (from localStorage or last save) |
| `settingsDraft` | `Settings` | In-flight edits in the settings form; discarded on modal close |
| `showSettings` | `boolean` | Controls settings modal visibility |
| `imageDataUrl` | `string` | `data:` URL of the selected image (for `<img>` preview) |
| `analyzing` | `boolean` | True while the API call is in flight |
| `analyzeError` | `string` | Non-empty if the API call failed |
| `flyerTitle` | `string` | AI-generated (or user-edited) flyer title |
| `flyerDescription` | `string` | AI-generated (or user-edited) flyer description |
| `price` | `string` | User-set price (shown on flyer) |
| `fbTitle` | `string` | AI-generated FB listing title |
| `fbPrice` | `string` | AI-suggested FB price |
| `fbDescription` | `string` | AI-generated FB listing description |
| `previewTab` | `PreviewTab` | Active tab in the preview step (`'flyer' \| 'fb'`) |

### Derived state

`canPreview` and `flyerData` / `fbData` objects are computed inline on each render from the above atoms. They are not memoized (the component is not performance-critical and re-renders are cheap).

### localStorage schema

```json
{
  "pickupAddress": "26001 Budde Road, Spring, Texas",
  "contact": "DM 346-395-8885 to get the exact pickup place",
  "userApiKey": "sk-or-v1-..."
}
```

Key: `"flyerSettings"`. Written on every settings save. Read once on mount. Never encrypted.

---

## 7. Security Considerations

### 7.1 Authentication & sessions

- **NextAuth JWT strategy:** Sessions are stateless JWT tokens stored in secure, HTTP-only cookies.
- **Startup guard:** `NEXTAUTH_SECRET` is validated on server startup in `lib/auth.ts`; the app will not start without it.
- **Credentials provider:** Email + password only (no third-party OAuth in v1.0).
- **Password hashing:** bcryptjs with cost factor 12 (secure, slightly slower but acceptable for sign-in).
- **Protected routes:** Middleware in `middleware.ts` protects `/app/*` and `/auth/change-password`. Unauthenticated users are redirected to `/auth/signin`.
- **API authentication:** `/api/analyze` and `/api/auth/[...nextauth]` check `getServerSession()` before processing.

### 7.2 API key handling

- The server-side `OPENROUTER_API_KEY` environment variable is never transmitted to the browser. It is only read inside the Next.js API route (`app/api/analyze/route.ts`) on the server.
- When a user provides their own key via the BYOK field:
  1. Stored in `localStorage` (client-side only, never sent to any server other than OpenRouter).
  2. Transmitted to `/api/analyze` in the JSON request body over HTTPS.
  3. Used in the server route and immediately discarded — it is not logged, cached, or stored server-side.
- The BYOK field uses `type="password"` with a toggle to prevent shoulder-surfing.

### 7.3 Image data

- Images are converted to base64 and sent to `/api/analyze` which forwards them to OpenRouter. No image data is written to disk or stored server-side.
- The base64 payload is held in memory only for the duration of the request.
- Maximum base64 size: 14 MB (validated server-side); returns HTTP 413 if exceeded.

### 7.4 Database security

- PostgreSQL connection is via TLS (standard for cloud providers like Supabase).
- User emails are unique-indexed for efficient lookups.
- Passwords are hashed with bcryptjs before storage; plain passwords are never stored.
- Prisma ORM prevents SQL injection via parameterized queries.

### 7.5 Input validation

- Sign-up form: Zod schema validates email format, password strength (min 8 chars, 1 uppercase, 1 number).
- Change-password form: Validates current password via bcrypt before accepting new password.
- `/api/analyze`:
  - Validates `imageBase64` and `mediaType` presence.
  - Validates `mediaType` against allowlist (JPEG, PNG, WebP, GIF).
  - Validates base64 character set and length.
  - Catches JSON parse errors and returns HTTP 502 (Bad Gateway).
- All user-editable text fields (`title`, `description`, `price`, `pickupAddress`, `contact`) are rendered as text content, not as `innerHTML`, eliminating XSS risk.

### 7.6 Content Security Policy

- `next.config.js` enforces a strict CSP that blocks inline scripts and external script sources (no `unsafe-eval`).
- Prevents XSS attacks and limits the impact of compromised dependencies.

---

## 8. Performance Considerations

### 8.1 Bundle size

`html2canvas` (~800 KB unminified) is dynamically imported only when the user clicks "Download Flyer":

```ts
const html2canvas = (await import('html2canvas')).default
```

This keeps the initial page load bundle lean.

### 8.2 Image payload size

Large images increase the JSON body size of the `/api/analyze` request. At `scale: 3`, a typical smartphone photo (3–5 MB) will encode to roughly 4–7 MB of base64. There is no client-side image compression or resizing before upload. If payload size becomes an issue, the client could resize the image to e.g. 1024px wide before encoding.

### 8.3 Server-side latency

The API route is a thin proxy. Total latency is dominated by the OpenRouter model inference time, typically 3–15 seconds for the free `nemotron-nano-12b-v2-vl:free` model. The UI reflects this with skeleton loaders and a spinner overlay.

### 8.4 Flyer PNG resolution

`html2canvas` is called with `scale: 3`. At 380px base width, this produces a 1140 × ~1560px output PNG, which is sufficient for A4/Letter printing and social media sharing.

### 8.5 No server-side caching

There is no caching at the API layer. Each image upload triggers a fresh model call. This is intentional — the use case is low volume (personal use), and caching would require storage and a cache-key strategy.

---

## 9. Dependencies

### 9.1 Runtime dependencies

| Package | Version | Purpose |
|---|---|---|
| `next` | ^15.2.4 | Framework (App Router, API Routes, SSR) |
| `react` | ^18.3.1 | UI library |
| `react-dom` | ^18.3.1 | DOM renderer |
| `next-auth` | ^4.24.13 | Authentication (JWT sessions, Credentials provider) |
| `@prisma/client` | ^7.7.0 | Database ORM client (PostgreSQL) |
| `bcryptjs` | ^3.0.3 | Password hashing (cost factor 12) |
| `zod` | ^4.3.6 | Server-side form validation (auth forms) |
| `openai` | ^6.34.0 | OpenAI-compatible SDK used to call OpenRouter |
| `html2canvas` | ^1.4.1 | DOM-to-canvas rasterizer for PNG export |
| `sonner` | ^2.0.7 | Toast notifications (auth feedback) |

### 9.2 Dev dependencies

| Package | Version | Purpose |
|---|---|---|
| `typescript` | ^5 | Type checking |
| `prisma` | ^7.7.0 | Database schema management (CLI, migrations) |
| `tailwindcss` | ^3.4.4 | Utility CSS (UI only; not used in flyer card) |
| `postcss` | ^8.4.38 | CSS processing pipeline for Tailwind |
| `autoprefixer` | ^10.4.19 | CSS vendor prefixes |
| `@types/node` | ^20 | Node.js type definitions |
| `@types/react` | ^18 | React type definitions |
| `@types/react-dom` | ^18 | React DOM type definitions |
| `@types/bcryptjs` | ^2.4.6 | Type definitions for bcryptjs |

### 9.3 External services

| Service | Usage | Authentication |
|---|---|---|
| OpenRouter (`openrouter.ai/api/v1`) | AI vision model inference | API key (env var or BYOK) |
| PostgreSQL (Supabase, etc.) | User accounts, auth state | Connection string with TLS |

---

## 10. Environment Variables

### `.env.local` (local development)

```env
# Database (PostgreSQL)
DATABASE_URL=postgresql://user:password@localhost:5432/flyer
DIRECT_URL=postgresql://user:password@localhost:5432/flyer

# Authentication (NextAuth)
NEXTAUTH_SECRET=generate-with-openssl-rand-hex-32  # e.g. openssl rand -hex 32
NEXTAUTH_URL=http://localhost:3000

# AI (OpenRouter)
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

### Variable reference

| Variable | Required | Used by | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | Prisma client (all routes) | PostgreSQL connection string (can include connection pooling via pgbouncer) |
| `DIRECT_URL` | Yes (Vercel/serverless) | `prisma migrate` CLI | Direct PostgreSQL connection without pooling (required for Prisma migrations on serverless) |
| `NEXTAUTH_SECRET` | Yes | `lib/auth.ts` startup check, NextAuth middleware | JWT session secret. Validated on server startup. Generate via `openssl rand -hex 32`. Must be exactly 64 hex characters. |
| `NEXTAUTH_URL` | Yes (production) | NextAuth callbacks (OAuth redirects, etc.) | Full public URL of the app (e.g. `http://localhost:3000` locally, `https://flyer.vercel.app` in production) |
| `OPENROUTER_API_KEY` | Yes (unless all users provide BYOK) | `app/api/analyze/route.ts` | Default OpenRouter API key used when no `userApiKey` is supplied in the request |

**Notes:**
- **Local dev:** Both `DATABASE_URL` and `DIRECT_URL` can be identical if using a direct PostgreSQL connection.
- **Vercel + Supabase:** Supabase requires both: `DATABASE_URL` uses the connection pooling URL (with pgbouncer), `DIRECT_URL` uses the direct connection (for migrations).
- **NEXTAUTH_SECRET startup guard:** If not set, the app crashes at server startup with a clear error message.

### Production (Vercel)

1. In Vercel project settings, go to **Settings → Environment Variables**.
2. Add all five variables above with scope `Production` (and optionally `Preview`).
3. Do not commit `.env.local` to source control.
4. Example Supabase setup:
   - `DATABASE_URL`: Copy from Supabase project "Connection Pooling" URL.
   - `DIRECT_URL`: Copy from Supabase project "Direct connection" URL.
   - `NEXTAUTH_SECRET`: Generate locally and paste.
   - `NEXTAUTH_URL`: Your Vercel deployment URL (e.g. `https://my-flyer.vercel.app`).
   - `OPENROUTER_API_KEY`: Your OpenRouter API key.

---

## 11. Deployment Guide

### 11.1 Local development

```bash
# 1. Install dependencies
npm install

# 2. Set up environment file
cat > .env.local << 'EOF'
DATABASE_URL=postgresql://user:password@localhost:5432/flyer
DIRECT_URL=postgresql://user:password@localhost:5432/flyer
NEXTAUTH_SECRET=$(openssl rand -hex 32)
NEXTAUTH_URL=http://localhost:3000
OPENROUTER_API_KEY=sk-or-v1-your-key
EOF

# 3. Set up database (create tables from Prisma schema)
npx prisma migrate dev --name init

# 4. Start dev server
npm run dev
# → http://localhost:3000
```

The postinstall hook in `package.json` automatically runs `prisma generate` to create the Prisma client.

### 11.2 Production build (local verification)

```bash
npm run build   # Type-checks, compiles, generates Prisma client
npm run start   # Serves on http://localhost:3000
```

### 11.3 Vercel deployment (recommended)

1. **Push the repository to GitHub** (or GitLab/Bitbucket).

2. **Set up PostgreSQL** (recommended: [Supabase](https://supabase.com)):
   - Create a Supabase project and database.
   - Copy the connection pooling URL and direct connection URL.

3. **Import the project at [vercel.com/new](https://vercel.com/new):**
   - Select the GitHub repo.
   - Vercel auto-detects Next.js; no build configuration changes needed.

4. **Add environment variables** in Vercel project settings (scope: `Production` + `Preview`):
   - `DATABASE_URL`: Supabase connection pooling URL (for client connections)
   - `DIRECT_URL`: Supabase direct connection URL (for migrations)
   - `NEXTAUTH_SECRET`: Generate locally via `openssl rand -hex 32`
   - `NEXTAUTH_URL`: Your Vercel deployment URL (e.g. `https://my-flyer.vercel.app`)
   - `OPENROUTER_API_KEY`: Your OpenRouter API key

5. **Deploy:**
   - Vercel auto-detects Next.js and runs `next build`.
   - The postinstall hook runs `prisma generate`.
   - After the first deployment, manually run the Prisma migration to set up the database:
     ```bash
     # One time only:
     npx prisma migrate deploy
     ```
   - Subsequent deployments run migrations automatically if schema changes are detected.

6. **Verify:**
   - Visit your Vercel deployment URL.
   - Try signing up and running the flyer generator.
   - Check Supabase project → Tables → `User` to confirm accounts are being created.

### 11.4 Other Node.js hosts

Any host that supports Next.js 15 and Node.js 20+ will work. Ensure:
- All five environment variables are set (see section 10).
- PostgreSQL is accessible from your host (with TLS recommended).
- Request body size limits accommodate base64-encoded images (~14 MB max; adjust if needed).
- API route timeout is at least 30 seconds (for OpenRouter model inference).
- The `postinstall` hook runs to generate the Prisma client.

### 11.5 Vercel serverless function timeout

By default, Vercel Hobby plan functions time out at 10 seconds. The free OpenRouter model can take 3–15 seconds depending on load. Options:
- Upgrade to Vercel Pro ($20/month) for 60-second timeout.
- Or add `export const maxDuration = 60` to `app/api/analyze/route.ts` (requires Pro plan).
- Or use a paid OpenRouter model for faster inference.

---

## 12. Known Limitations

### 12.1 Database cold starts

On Vercel, the first database query after a deployment or idle period may experience latency due to connection pooling. This is mitigated by:
- Using Supabase's pgbouncer connection pooling (configured in `DATABASE_URL`).
- Connection reuse within the same serverless function invocation.
- Keeping `DIRECT_URL` for migrations only (avoids pooling overhead for schema changes).

### 12.2 Free OpenRouter model rate limits

`nvidia/nemotron-nano-12b-v2-vl:free` is subject to undocumented rate limits that vary with demand. Users may see HTTP 429 or timeout errors during peak hours. Mitigation options:
- The BYOK feature allows users to use their own OpenRouter key (higher quota).
- A paid model (e.g. `openai/gpt-4o-mini`) can be substituted in `app/api/analyze/route.ts` for more consistent availability.
- Monitor OpenRouter status for quota warnings.

### 12.3 JSON output reliability

The model is instructed to return only raw JSON. It occasionally wraps output in markdown code fences (handled via `replace(/```/g, '')`) or includes extra commentary outside the JSON (not handled — will cause a parse error returned as HTTP 502). If this is frequent, a more robust extraction strategy (e.g., regex `/{[\s\S]*}/` to extract the first JSON object) could improve resilience.

### 12.4 html2canvas and emoji rendering

The flyer card uses emoji characters as decorative icons (🗒️, 💲, 📍, ✉️). `html2canvas` renders these via the operating system's emoji font. On headless/server environments and some Linux deployments this may produce blank squares. This is not a concern for Vercel (client-side rendering) but is relevant if server-side screenshot generation is ever added.

### 12.5 Large image payloads

There is no client-side image compression. A 10 MB smartphone photo will be sent as ~13 MB of base64 JSON. The app enforces a maximum base64 length of 14 MB (HTTP 413 if exceeded). Vercel's default body size is 6 MB for Hobby plan. To handle larger images:
- Add client-side canvas resizing before encoding (recommended).
- Or upgrade to Vercel Pro for a higher body size limit.
- Or configure a custom Next.js route limit in `app/api/analyze/route.ts`.

### 12.6 localStorage availability

Settings persistence relies on `localStorage`. The app will fail silently if:
- The browser blocks `localStorage` (private browsing with certain settings).
- The user's storage quota is exceeded.

The `useEffect` that reads from `localStorage` has no error boundary; a `try/catch` wrapper would improve robustness.

### 12.7 No offline support

The app has no service worker or offline caching. The AI analysis step requires network access. If OpenRouter is unreachable, the user sees an error banner and must fill in fields manually. Same for database access (auth will fail if PostgreSQL is unreachable).

### 12.8 Single-image, single-listing

The app is designed for one item at a time. There is no batch mode, no history, and no way to revisit a previously analyzed item after navigating away. All listing data is ephemeral (except user account in database).

### 12.9 No email verification on sign-up

Accounts are created and active immediately without email verification. This is intentional for low friction but means users can sign up with typo'd email addresses. Adding email verification is out of scope for v1.0.

### 12.10 No account deletion

Users cannot delete their accounts or data via the UI. This is a v1.0 limitation; implement via admin tools or a future `/api/user/delete` endpoint if needed.

### 12.11 No password reset

There is no "Forgot password" flow. Users must manually set a new password via the "Change password" page (requires being logged in). A password-reset feature would require email delivery (out of scope for v1.0).
