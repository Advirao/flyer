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

Flyer Generator is a single-page web application that lets users photograph a physical item for sale and instantly receive a print-ready flyer (PNG) and a ready-to-paste Facebook Marketplace listing. The user uploads a photo, an AI model analyzes it and generates all copy, and the user downloads a flyer or copies the listing — in under a minute.

### Goals

- Zero friction: no account, no login, no file storage.
- Single AI call per image produces all output (flyer copy + FB listing copy).
- Persistent personal settings (pickup address, contact) via `localStorage` so they never need to be re-entered.
- Optional Bring-Your-Own-Key (BYOK) for users who want to bypass any shared rate limits.

### Non-Goals

- No user authentication or multi-user accounts.
- No server-side file storage; images are never persisted.
- No database.
- No server-side session or token management.

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                         │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Next.js App Router (client components)                  │  │
│  │                                                          │  │
│  │  FlyerApp.tsx  ──┬──  FlyerPreview.tsx                   │  │
│  │  (state machine) │    (html2canvas → PNG download)        │  │
│  │                  └──  FBMarketplaceCard.tsx               │  │
│  │                        (copy-to-clipboard)               │  │
│  │                                                          │  │
│  │  localStorage: { pickupAddress, contact, userApiKey }    │  │
│  └──────────────────────────────┬───────────────────────────┘  │
└─────────────────────────────────┼───────────────────────────────┘
                                  │ POST /api/analyze
                                  │ { imageBase64, mediaType, userApiKey? }
┌─────────────────────────────────▼───────────────────────────────┐
│                     Next.js API Route (Server)                  │
│                                                                 │
│  app/api/analyze/route.ts                                       │
│  ├── Reads userApiKey from body OR process.env.OPENROUTER_API_KEY│
│  └── Constructs OpenAI-compatible client → OpenRouter           │
└─────────────────────────────────┬───────────────────────────────┘
                                  │ HTTPS (OpenAI SDK)
                                  │ model: nvidia/nemotron-nano-12b-v2-vl:free
┌─────────────────────────────────▼───────────────────────────────┐
│                  OpenRouter API  (openrouter.ai/api/v1)         │
│                                                                 │
│  Vision-Language Model: nvidia/nemotron-nano-12b-v2-vl:free     │
│  Returns structured JSON: { flyer: {...}, fb: {...} }           │
└─────────────────────────────────────────────────────────────────┘
```

### Routing

| Route | Type | Description |
|---|---|---|
| `/` | Client page | Renders `<FlyerApp />` |
| `/api/analyze` | Server route (POST) | Proxies image to OpenRouter, returns generated copy |

All other routes are undefined; the app is effectively a single-page experience.

---

## 3. Component Design

### 3.1 `app/page.tsx`

Thin shell. Marks the route as `'use client'` and renders `<FlyerApp />`. No props, no logic.

```tsx
'use client'
import FlyerApp from '@/components/FlyerApp'
export default function Home() {
  return <FlyerApp />
}
```

### 3.2 `app/layout.tsx`

Minimal root layout. Sets `<html lang="en">` and injects global CSS. Exports standard Next.js `Metadata` (`title`, `description`). No auth wrappers.

### 3.3 `components/FlyerApp.tsx`

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

### 3.4 `components/FlyerPreview.tsx`

Renders the printable flyer card and, when `downloadable={true}`, a "Download Flyer (PNG)" button.

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

**Critical design constraint:** All styles are applied as inline `style={{...}}` objects rather than Tailwind classes. This is required because `html2canvas` renders CSS from computed styles; Tailwind's JIT output is reliable at runtime but not guaranteed to survive canvas rasterization. Only the outer wrapper and the download button use Tailwind.

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

### 3.5 `components/FBMarketplaceCard.tsx`

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

#### Request

```
Content-Type: application/json
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
| `400` | `imageBase64` or `mediaType` missing from request body |
| `500` | No API key available (neither `userApiKey` nor env var set) |
| `500` | OpenRouter API call failed or response JSON could not be parsed |

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

### 7.1 API key handling

- The server-side `OPENROUTER_API_KEY` environment variable is never transmitted to the browser. It is only read inside the Next.js API route, which runs in Node.js on the server.
- When a user provides their own key via the BYOK field, it is:
  1. Stored in `localStorage` (client-side only, never sent to any server other than OpenRouter).
  2. Transmitted to `/api/analyze` in the JSON request body over HTTPS.
  3. Used in the server route and immediately discarded — it is not logged, cached, or stored server-side.
- The BYOK field uses `type="password"` with a toggle to prevent shoulder-surfing.

### 7.2 Image data

- Images are converted to base64 and sent to `/api/analyze` which forwards them to OpenRouter. No image data is written to disk or stored server-side.
- The base64 payload is held in memory only for the duration of the request.

### 7.3 No authentication

The application has no authentication layer. The API route is publicly accessible. Rate limiting is delegated entirely to OpenRouter (per-key or IP-based, depending on the key in use).

### 7.4 Input validation

- The API route validates that `imageBase64` and `mediaType` are present; missing fields return HTTP 400.
- There is no server-side validation of `mediaType` beyond presence. Malformed base64 will cause the OpenRouter call to fail, which is caught and returned as HTTP 500.
- All user-editable text fields (`title`, `description`, `price`, `pickupAddress`, `contact`) are rendered as text content, not as `innerHTML`, eliminating XSS risk.

### 7.5 Unused leftover environment variables

`.env.local` contains `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, and `AUTH_USERS` from a prior authentication prototype. These are not read anywhere in the current codebase and have no effect. They should be removed to avoid confusion but pose no security risk in isolation.

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
| `openai` | ^6.34.0 | OpenAI-compatible SDK used to call OpenRouter |
| `html2canvas` | ^1.4.1 | DOM-to-canvas rasterizer for PNG export |
| `next-auth` | ^4.24.13 | Unused (leftover dependency, safe to remove) |
| `bcryptjs` | ^3.0.3 | Unused (leftover dependency, safe to remove) |
| `@google/generative-ai` | ^0.24.1 | Unused (leftover dependency, safe to remove) |

### 9.2 Dev dependencies

| Package | Version | Purpose |
|---|---|---|
| `typescript` | ^5 | Type checking |
| `tailwindcss` | ^3.4.4 | Utility CSS (UI only; not used in flyer card) |
| `postcss` | ^8.4.38 | CSS processing pipeline for Tailwind |
| `autoprefixer` | ^10.4.19 | CSS vendor prefixes |
| `@types/node` | ^20 | Node.js type definitions |
| `@types/react` | ^18 | React type definitions |
| `@types/react-dom` | ^18 | React DOM type definitions |
| `@types/bcryptjs` | ^2.4.6 | Unused (matches unused bcryptjs) |

### 9.3 External services

| Service | Usage | Authentication |
|---|---|---|
| OpenRouter (`openrouter.ai/api/v1`) | AI model inference | API key (env var or BYOK) |

---

## 10. Environment Variables

### `.env.local` (local development)

```env
# Required: server-side API key for OpenRouter
OPENROUTER_API_KEY=sk-or-v1-...

# --- Unused leftovers from a prior auth prototype ---
# These have no effect and can be removed.
NEXTAUTH_SECRET=some-secret
NEXTAUTH_URL=http://localhost:3000
AUTH_USERS=user1:hash1,user2:hash2
```

### Variable reference

| Variable | Required | Used by | Description |
|---|---|---|---|
| `OPENROUTER_API_KEY` | Yes (unless all users provide BYOK) | `app/api/analyze/route.ts` | Default OpenRouter API key used when no `userApiKey` is supplied in the request |
| `NEXTAUTH_SECRET` | No | Nothing | Unused leftover |
| `NEXTAUTH_URL` | No | Nothing | Unused leftover |
| `AUTH_USERS` | No | Nothing | Unused leftover |

### Production (Vercel)

Set `OPENROUTER_API_KEY` in **Project Settings → Environment Variables** with scope `Production` (and optionally `Preview`). Do not commit `.env.local` to source control.

---

## 11. Deployment Guide

### 11.1 Local development

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env.local   # or create manually
# Add: OPENROUTER_API_KEY=sk-or-v1-...

# Start dev server
npm run dev
# → http://localhost:3000
```

### 11.2 Production build (local verification)

```bash
npm run build   # Type-checks + compiles
npm run start   # Serves on http://localhost:3000
```

### 11.3 Vercel deployment (recommended)

1. Push the repository to GitHub (or GitLab/Bitbucket).
2. Import the project at [vercel.com/new](https://vercel.com/new).
3. Vercel auto-detects Next.js; no build configuration changes needed.
4. Add environment variable:
   - Name: `OPENROUTER_API_KEY`
   - Value: your OpenRouter key
   - Environments: Production, Preview
5. Deploy. The API route runs as a Vercel Serverless Function.

### 11.4 Other Node.js hosts

Any host that supports Next.js 15 and Node.js 20+ will work. Ensure:
- The `OPENROUTER_API_KEY` environment variable is injected at build/runtime.
- The host does not impose a request body size limit smaller than the base64-encoded images you expect (default is typically 4–8 MB; adjust if needed).
- The API route timeout is at least 30 seconds to accommodate slow model inference.

### 11.5 Vercel serverless function timeout

By default, Vercel Hobby plan functions time out at 10 seconds. The free OpenRouter model can take up to 15+ seconds. Consider:
- Upgrading to Vercel Pro (60-second timeout).
- Or adding `export const maxDuration = 60` to `app/api/analyze/route.ts` (requires Pro plan).

---

## 12. Known Limitations

### 12.1 Free model rate limits

`nvidia/nemotron-nano-12b-v2-vl:free` on OpenRouter is subject to undocumented rate limits that vary with demand. Users may see HTTP 429 or timeout errors during peak hours. Mitigation options:
- The BYOK feature allows users to use their own OpenRouter key.
- A paid model (e.g. `openai/gpt-4o-mini`) can be substituted in `app/api/analyze/route.ts` for more consistent availability.

### 12.2 JSON output reliability

The model is instructed to return only raw JSON. It occasionally wraps output in markdown code fences (handled) or includes extra commentary outside the JSON (not handled — will cause a parse error returned as HTTP 500). If this is frequent, a more robust extraction strategy (e.g., regex `/{[\s\S]*}/` to extract the first JSON object) could improve resilience.

### 12.3 html2canvas and emoji rendering

The flyer card uses emoji characters as decorative icons (🗒️, 💲, 📍, ✉️). `html2canvas` renders these via the operating system's emoji font. On headless/server environments and some Linux deployments this may produce blank squares. This is not a concern for Vercel (client-side rendering) but is relevant if server-side screenshot generation is ever added.

### 12.4 Large image payloads

There is no client-side image compression. A 10 MB smartphone photo will be sent as ~13 MB of base64 JSON. This can hit Vercel's 4.5 MB default body size limit for API routes. To resolve:
- Add client-side canvas resizing before encoding (recommended).
- Or increase the body size limit via Next.js route config: `export const config = { api: { bodyParser: { sizeLimit: '15mb' } } }`.

### 12.5 localStorage availability

Settings persistence relies on `localStorage`. The app will fail silently if:
- The browser blocks `localStorage` (private browsing with certain settings).
- The user's storage quota is exceeded.

The `useEffect` that reads from `localStorage` has no error boundary; a `try/catch` wrapper would improve robustness.

### 12.6 No offline support

The app has no service worker or offline caching. The AI analysis step requires network access. If OpenRouter is unreachable, the user sees an error banner and must fill in fields manually.

### 12.7 Single-image, single-listing

The app is designed for one item at a time. There is no batch mode, no history, and no way to revisit a previously analyzed item after navigating away. All state is ephemeral (except settings).

### 12.8 Unused dependencies

`next-auth`, `bcryptjs`, `@google/generative-ai`, and `@types/bcryptjs` are installed but unused. They increase bundle size and introduce transitive dependency maintenance burden. Removing them is recommended:

```bash
npm uninstall next-auth bcryptjs @google/generative-ai @types/bcryptjs
```
