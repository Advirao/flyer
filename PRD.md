# Product Requirements Document: Flyer Generator

**Version:** 1.1  
**Date:** 2026-04-11  
**Status:** Current

---

## Table of Contents

1. [Overview](#1-overview)
2. [Goals](#2-goals)
3. [Non-Goals](#3-non-goals)
4. [User Personas](#4-user-personas)
5. [User Stories](#5-user-stories)
6. [Features](#6-features)
7. [UX Flow](#7-ux-flow)
8. [Technical Architecture](#8-technical-architecture)
9. [Success Metrics](#9-success-metrics)
10. [Constraints](#10-constraints)

---

## 1. Overview

Flyer Generator is a mobile-friendly Next.js 15 web app that turns a single photo into two sale-ready marketing assets: a downloadable PNG flyer and copy-ready Facebook Marketplace text. Users create a free account and sign in to access the generator. The entire experience from sign-in to finished flyer takes under 60 seconds.

The core value proposition is **AI-powered zero-effort copywriting**. Users photograph an item, and the app automatically produces a title, a flyer description, and a fully formatted Facebook Marketplace listing. The user's only required manual input after uploading is the price. Pickup address and contact information are stored once in `localStorage` and reused silently for every subsequent listing.

### Technology Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 3 |
| AI Backend | OpenRouter API (model: `nvidia/nemotron-nano-12b-v2-vl:free`) |
| AI Client | OpenAI SDK (`openai` npm package, pointed at OpenRouter base URL) |
| Image Export | html2canvas 1.4.1 (scale: 3x for high-res PNG) |
| Persistence | Browser `localStorage` (settings) + PostgreSQL (user accounts) |
| Auth | NextAuth v4 (Credentials provider — email + password) |
| ORM | Prisma |
| Database | PostgreSQL via Supabase (connection pooling with pgbouncer) |
| Password Hashing | bcryptjs (cost factor 12) |

---

## 2. Goals

### Primary Goals

- **G1 — Speed:** Reduce the time to create a for-sale listing from 10+ minutes (manual photo editing, copywriting, formatting) to under 60 seconds.
- **G2 — Ease:** Require zero marketing or design skill from the user. AI handles all copy; the app handles all layout.
- **G3 — Account-based access:** Users sign up with an email and password. The app owner's OpenRouter API key is the default after sign-in. Friends can use the app for free after creating an account.
- **G4 — One-time configuration:** Users enter their pickup address and contact information once. It persists in `localStorage` and is never asked for again unless the user chooses to update it.
- **G5 — Dual output:** Every listing session produces both a print/share-ready PNG flyer and text optimized for Facebook Marketplace, covering the two most common channels for local selling.

### Secondary Goals

- **G6 — User autonomy:** Power users can supply their own OpenRouter API key to avoid consuming the shared quota.
- **G7 — Accessibility on mobile:** All interactive elements must be reachable and usable on iOS and Android without a keyboard, zoom issues, or misaligned tap targets.

---

## 3. Non-Goals

The following are explicitly out of scope for version 1.0:

- **No third-party OAuth providers.** Auth is email + password only; no Google, GitHub, or social login.
- **No multi-user or multi-tenant management.** There is no admin interface, usage dashboard, or per-user quota enforcement beyond the optional bring-your-own-key feature.
- **No image editing or cropping.** The uploaded image is used as-is. No filters, rotation, or resize controls are provided.
- **No direct social media integration.** The app produces copy for Facebook Marketplace but does not post to it. There is no OAuth connection to any social platform.
- **No payments or subscriptions.** The app is free to use by design; there is no billing layer.
- **No multi-photo listings.** Each session is for a single item with a single photo.
- **No offline support / PWA.** An active internet connection is required for AI analysis.
- **No listing history persistence.** User accounts are stored but listing data (images, generated copy) is never persisted server-side.
- **No email or SMS delivery.** Flyers are downloaded by the user; there is no send-to-email or share-by-link feature.
- **No custom flyer templates or branding.** The beige-background layout is fixed and non-configurable.

---

## 4. User Personas

### Persona A — The App Owner ("Primary Seller")

**Name:** Alex  
**Context:** Sells items from home 2–4 times per month — garage cleanouts, outgrown kids' gear, appliances, furniture.  
**Technical comfort:** Moderate. Comfortable with web apps; built this tool for personal use.  
**Pain points:**
- Writing listing copy feels tedious and repetitive.
- Making a visually decent flyer used to require Canva or similar tools.
- Remembers to include address and contact every time but it's annoying to re-type.

**What they need from the app:** To go from "photo taken" to "flyer ready to share" in one minute, without thinking about copywriting.

---

### Persona B — The Friend ("Casual Seller")

**Name:** Jordan  
**Context:** Sells items occasionally — maybe once a month. Alex shared the link.  
**Technical comfort:** Basic. Uses apps on phone, not particularly technical.  
**Pain points:**
- Does not want to sign up for accounts, pay for anything, or configure API keys.
- Wants the simplest possible experience: upload photo, get flyer.

**What they need from the app:** For the shared key to "just work" without any setup beyond entering their own address/contact once.

---

### Persona C — The Power User ("Heavy Seller")

**Name:** Morgan  
**Context:** Runs a side business reselling goods frequently. Concerned about consuming Alex's shared API quota.  
**Technical comfort:** High. Comfortable with API keys, developer tools.  
**Pain points:**
- Does not want to depend on someone else's API budget.
- Wants full control over their own usage.

**What they need from the app:** The ability to plug in their own OpenRouter key in Settings so they are self-sufficient.

---

## 5. User Stories

### Onboarding

| ID | Story | Acceptance Criteria |
|---|---|---|
| US-01 | As a new user, I want to enter my pickup address and contact info once so I never have to type them again. | First launch shows the Setup screen. After saving, settings persist in `localStorage`. Subsequent launches skip Setup if both fields are populated. |
| US-02 | As a user, I want to update my address or contact at any time. | Settings gear icon in the header opens a modal with pre-filled current values. Changes save immediately on button press. |
| US-03 | As a power user, I want to enter my own OpenRouter API key so I can use my own AI quota. | Settings form includes an optional "OpenRouter API Key" field with show/hide toggle. If provided, the key is sent to the API route and used instead of the server key. |

### Image Upload

| ID | Story | Acceptance Criteria |
|---|---|---|
| US-04 | As a user, I want to upload a photo by tapping/clicking a zone so I can select an image from my device. | Tapping the upload zone triggers the native file picker. Accepts `image/*`. |
| US-05 | As a user, I want to drag and drop an image onto the upload zone from my desktop. | Drop events are handled; non-image files are silently ignored. |
| US-06 | As a user, I want to see the uploaded image immediately in the upload zone so I can confirm I picked the right photo. | Image renders as a preview inside the upload zone as soon as the file is selected. |
| US-07 | As a user, I want to be able to swap the photo by clicking the upload zone again. | Clicking the zone (when not analyzing) re-opens the file picker. Selecting a new file replaces the previous image and re-runs AI analysis. |

### AI Analysis

| ID | Story | Acceptance Criteria |
|---|---|---|
| US-08 | As a user, I want AI to automatically generate a title and description for my flyer so I don't have to write them. | On image selection, the app sends the image to `/api/analyze` and populates flyer title, flyer description, FB title, FB price suggestion, and FB description fields from the response. |
| US-09 | As a user, I want to see a spinner while AI is working so I know the app isn't frozen. | An animated spinner overlay covers the upload zone with the text "Analyzing image…" and subtext "AI is generating title, description & FB content" during the API call. The Preview button is disabled. |
| US-10 | As a user, I want skeleton placeholders in the form while AI is loading so the layout doesn't jump. | All five AI-generated text fields show animated gray skeleton rectangles of appropriate height while `analyzing` is true. |
| US-11 | As a user, if AI analysis fails, I want to be notified and still be able to fill the fields manually. | On API error, a red warning banner shows the error message with the text "please fill fields manually." All input fields are enabled and editable. |

### Listing Details

| ID | Story | Acceptance Criteria |
|---|---|---|
| US-12 | As a user, I want to review and edit the AI-generated title and description before generating the flyer. | All five AI-populated fields (flyer title, flyer description, FB title, FB price, FB description) are editable text inputs/textareas. |
| US-13 | As a user, I want to enter the price myself since I know what I want to charge. | The price field is always blank after upload and requires manual entry. It is not populated by AI. |
| US-14 | As a user, I want to see a live flyer preview on desktop so I can watch it update as I type. | On desktop (md breakpoint and above), the right column shows a live FlyerPreview component that updates in real time as any field changes. It is only visible once the flyer has enough data to render (image + title + description + price + settings populated). |
| US-15 | As a user on mobile, I want to see a scaled flyer preview below the form before committing to the Preview step. | On small screens, when all required fields are filled, a scaled-down (80%) flyer preview appears below the form inline in the page flow. |
| US-16 | As a user, I want the Preview button to be disabled until all required fields are filled so I can't generate an empty flyer. | The "Preview →" button is disabled when any of the following are empty: image, flyer title, flyer description, price, FB title, FB description, pickup address, contact. |

### Preview & Output

| ID | Story | Acceptance Criteria |
|---|---|---|
| US-17 | As a user, I want to see the full flyer in the Preview step with a "Download Flyer (PNG)" button. | The Preview step with the "Flyer" tab shows FlyerPreview in downloadable mode with a green download button. |
| US-18 | As a user, I want to download the flyer as a high-quality PNG file. | Clicking Download Flyer triggers html2canvas at 3x scale with the beige background. The file is saved as `flyer-{timestamp}.png`. |
| US-19 | As a user, I want to see a loading state on the download button while the PNG is generating. | The button shows a spinning hourglass and "Generating…" text while html2canvas runs. |
| US-20 | As a user, I want to see a mock Facebook Marketplace listing preview so I can visualize how my listing will look. | The FB Marketplace tab shows a card that mimics the FB listing UI: image at top, price, title, location chip, and description. |
| US-21 | As a user, I want to copy the listing title, price, and description individually for Facebook Marketplace. | Each field has its own "Copy" button that copies just that field to the clipboard and shows a "Copied!" confirmation for 2 seconds. |
| US-22 | As a user, I want to copy all Facebook Marketplace fields at once with a single button. | A "Copy Everything" button at the bottom copies the formatted full listing (`Title: ... / Price: ... / {description with pickup and contact appended}`) to the clipboard. |
| US-23 | As a user, I want the FB description to automatically include my pickup address and contact info. | The `fullDescription` string passed to FB copy is `{AI description}\n\n📍 Pickup: {address}\n✉️ {contact}`. This is applied automatically; the user does not need to manually append these. |
| US-24 | As a user, I want to go back to editing from the Preview step without losing my data. | The "← Back to edit" link on the Preview step returns to the details step with all field values preserved. |

---

## 6. Features

Features are prioritized using MoSCoW: **Must Have**, **Should Have**, **Could Have**, **Won't Have (this version)**.

### Must Have (P0)

| Feature | Description | Implemented |
|---|---|---|
| F-01: Image Upload | Click-to-browse and drag-and-drop image upload. Accepts all common image MIME types (`image/*`). | Yes |
| F-02: AI Analysis via OpenRouter | POST to `/api/analyze` with base64-encoded image. Returns structured JSON with flyer and FB fields. Uses `nvidia/nemotron-nano-12b-v2-vl:free` model. | Yes |
| F-03: AI-Populated Form Fields | Flyer title, flyer description, FB title, FB price suggestion, and FB description are pre-filled from AI response. All are editable. | Yes |
| F-04: Manual Price Entry | User manually enters the sale price. Dollar sign prefix shown in UI. | Yes |
| F-05: PNG Flyer Download | html2canvas renders the 380px-wide beige flyer at 3x resolution and saves as PNG. | Yes |
| F-06: Facebook Marketplace Copy | Individual copy buttons for title, price, and description. "Copy Everything" button for the full formatted block. Clipboard feedback (2s "Copied!" state). | Yes |
| F-07: Persistent Settings | Pickup address, contact info, and optional API key saved to `localStorage`. Restored on every page load. | Yes |
| F-08: First-Run Setup Screen | If `localStorage` is empty or missing required fields, shows a full-page setup form before the main UI. | Yes |
| F-09: Analyzing Spinner + Skeletons | Spinner overlay on upload zone + skeleton placeholders in all AI-populated fields during analysis. | Yes |
| F-10: Error Handling | Red banner shown if AI analysis fails, with error message and instruction to fill manually. | Yes |

### Should Have (P1)

| Feature | Description | Implemented |
|---|---|---|
| F-11: Live Desktop Preview | Right column on desktop shows FlyerPreview updating in real time as the user edits fields. | Yes |
| F-12: Mobile Inline Preview | Scaled-down flyer preview below the form on mobile when all fields are filled. | Yes |
| F-13: Settings Modal | Gear icon in sticky header opens an overlay modal to update settings at any time. | Yes |
| F-14: Shared API Key (Default) | Server-side `OPENROUTER_API_KEY` env variable is the default. Users who don't provide their own key use it silently. | Yes |
| F-15: Bring-Your-Own API Key | Optional field in Settings for user to provide their own OpenRouter key, passed to the API route on each request. | Yes |
| F-16: FB Marketplace Mock Preview | Visual mock-up of a Facebook listing card (image, price, title, location chip, description) in the FB tab. | Yes |

### Could Have (P2)

| Feature | Description | Implemented |
|---|---|---|
| F-17: Sticky Header | App header with title and settings button sticks to top of viewport during scroll. | Yes |
| F-18: Responsive Grid Layout | Two-column (2/5 + 3/5) grid on desktop, single-column stacked on mobile. | Yes |
| F-19: Show/Hide API Key Toggle | Password field for API key with a toggle button to reveal the value. | Yes |
| F-20: Image Re-upload Without Losing Settings | Re-selecting a photo clears only image/AI fields; address, contact, and price behavior resets for the new item. | Yes |

### Must Have — Auth (P0)

| Feature | Description | Implemented |
|---|---|---|
| F-A1: Sign-up | Email + password registration. Validates format, min 8 chars, 1 uppercase, 1 number. bcryptjs hash stored in DB. | Yes |
| F-A2: Sign-in | Email + password sign-in via NextAuth Credentials provider. Issues JWT session cookie. | Yes |
| F-A3: Change password | Authenticated users can change their password (current + new + confirm). | Yes |
| F-A4: Protected app route | `/app/*` is protected by middleware; unauthenticated users are redirected to sign-in. | Yes |
| F-A5: Protected API route | `/api/analyze` checks session server-side and returns 401 if no valid session. | Yes |

### Won't Have (this version)

| Feature | Reason |
|---|---|
| F-W1: Third-party OAuth | Email/password only in v1.0. Google/GitHub login not planned. |
| F-W2: Listing history | Listing data is ephemeral — only user accounts are stored. |
| F-W3: Custom flyer templates | Fixed beige layout is the intentional design. |
| F-W4: Direct social posting | No OAuth integrations planned. |
| F-W5: Multi-photo listings | One photo per listing by design. |
| F-W6: Offline/PWA support | Requires internet for AI. |
| F-W7: Account deletion | Not implemented in v1.0. |
| F-W8: Email verification | Accounts are trusted by email at signup; no verification email sent. |

---

## 7. UX Flow

### Step 0: First Launch (New User)

```
App loads → localStorage has no settings
  → Full-page Setup screen displayed
    Fields: Pickup / Address (required), Contact (required),
            OpenRouter API Key (optional)
  → User fills required fields → clicks "Get Started"
    → Settings saved to localStorage
    → Transition to Upload screen (Step 1)
```

### Step 1: Upload

```
Upload screen displayed
  Upload zone: centered, dashed border, 📷 icon, "Drop your photo here / or click to browse"
  Right column (desktop): empty placeholder with 🏷️ icon and hint text

User action: tap/click upload zone OR drag-and-drop image file
  → File picker opens (or drop accepted)
  → User selects an image
    → Image renders as preview inside upload zone
    → App transitions internally to "details" step
    → Simultaneously fires POST /api/analyze with base64 image + optional userApiKey
    → Spinner overlay appears on upload zone
    → All five AI fields show skeleton loading state
    → "Preview →" button shows "Analyzing image…" and is disabled
```

### Step 2: Details (AI Populating / Editable)

```
AI response received:
  → flyerTitle, flyerDescription, fbTitle, fbPrice, fbDescription populated
  → Skeletons replaced with editable inputs
  → Spinner removed from upload zone
  → "Preview →" button remains disabled until price is entered

User reviews AI-generated content:
  → Edits any field as needed (all fields are free-text editable)
  → Enters price in the price field (required; AI does not fill this)

Optional: user can click upload zone again to swap photo
  → Clears all AI fields, re-runs analysis

As fields fill in (desktop):
  → FlyerPreview in right column renders live and updates on each keystroke

When ALL required fields are filled (image + flyerTitle + flyerDescription + price + fbTitle + fbDescription):
  → "Preview →" button becomes active (blue)
  → Mobile inline scaled preview appears below form

User clicks "Preview →"
  → Transitions to Preview step (Step 3)
```

### Step 3: Preview

```
Preview step displayed
  Header: "← Back to edit" link (returns to Step 2 with all data preserved)
  Tab bar: "🏷️ Flyer" | "👥 FB Marketplace"
  Default tab: Flyer

--- Flyer Tab ---
  Full FlyerPreview rendered (380px wide, beige background)
  Layout (top to bottom):
    - Title (22px bold, centered)
    - Photo (white box, border, object-fit: contain, max 260px height)
    - Horizontal divider
    - 🗒️ Description (label + text)
    - 💲 Price (label + "$" + price)
    - 📍 Pickup Location (label + address)
    - ✉️ Contact (label + contact string)
  Below flyer: "⬇️ Download Flyer (PNG)" green button
    → On click: html2canvas renders at 3x scale
    → Button shows "⏳ Generating…" while processing
    → File saved as flyer-{Date.now()}.png

--- FB Marketplace Tab ---
  Mock FB listing card:
    - Item photo (full width, max 320px height, object-contain)
    - Price (large, bold)
    - Title
    - 📍 location chip (pickup address)
    - Full description (AI description + "\n\n📍 Pickup: {address}\n✉️ {contact}")

  Copy panel below card:
    - "Title" row: value displayed + "📋 Copy" button → copies title
    - "Price" row: value displayed + "📋 Copy" button → copies price (with $ prefix)
    - "Description" row: multiline value displayed + "📋 Copy" button → copies full description block
    - "📋 Copy Everything" blue full-width button → copies formatted block:
        "Title: {title}\nPrice: ${price}\n\n{fullDescription}"
    All copy buttons show "✅ Copied!" for 2 seconds after click
```

### Settings Update (Any Time)

```
User taps gear icon in header
  → Settings modal overlays current screen (backdrop: black/40)
  → Form pre-filled with current values
  → User edits fields → clicks "Save"
    → localStorage updated
    → Modal closes
    → If on setup step, transitions to upload step
  → OR user clicks × → modal closes, no changes saved
```

### Error Recovery (AI Failure)

```
POST /api/analyze fails or returns error
  → Spinner removed
  → Red warning banner shown: "⚠️ {error message} — please fill fields manually."
  → All AI fields are empty but enabled for manual entry
  → User fills fields manually → flow continues normally
```

---

## 8. Technical Architecture

### Component Tree

```
app/layout.tsx                            [root layout, SessionProvider]
  ├── app/page.tsx                        [landing page with sign-in/sign-up CTAs]
  ├── app/auth/signin/page.tsx            [sign-in form]
  ├── app/auth/signup/page.tsx            [sign-up form]
  ├── app/auth/change-password/page.tsx   [change password form]
  └── app/app/                            [protected by middleware + layout auth check]
        └── app/app/page.tsx              [mounts FlyerApp component]
              └── FlyerApp (components/FlyerApp.tsx)
                    ├── SetupForm (inline)      [first-run + settings modal]
                    ├── FlyerPreview (components/FlyerPreview.tsx)
                    │     └── html2canvas (dynamic import, download only)
                    └── FBMarketplaceCard (components/FBMarketplaceCard.tsx)
```

### State Management

All state is local React `useState` in `FlyerApp`. There is no global state manager (no Redux, no Zustand, no Context).

| State Variable | Type | Purpose |
|---|---|---|
| `step` | `'setup' \| 'upload' \| 'details' \| 'preview'` | Controls which screen is shown |
| `settings` | `Settings` | Active saved settings (from localStorage) |
| `settingsDraft` | `Settings` | Working copy for settings modal edits |
| `showSettings` | `boolean` | Controls settings modal visibility |
| `imageDataUrl` | `string` | Data URL of selected image for preview and flyer |
| `analyzing` | `boolean` | True while API call is in flight |
| `analyzeError` | `string` | Error message from failed analysis |
| `flyerTitle` | `string` | AI-generated + user-editable flyer title |
| `flyerDescription` | `string` | AI-generated + user-editable flyer description |
| `price` | `string` | User-entered price |
| `fbTitle` | `string` | AI-generated + user-editable FB listing title |
| `fbPrice` | `string` | AI-suggested price (separate from user price) |
| `fbDescription` | `string` | AI-generated + user-editable FB description |
| `previewTab` | `'flyer' \| 'fb'` | Active tab on preview step |

### API Route: `/api/analyze`

- **Method:** POST
- **Authentication:** Requires valid NextAuth session (via `getServerSession`)
- **Request body:** `{ imageBase64: string, mediaType: string, userApiKey?: string }`
- **Logic:** Uses `userApiKey` if provided; falls back to `process.env.OPENROUTER_API_KEY`
- **Model:** `nvidia/nemotron-nano-12b-v2-vl:free` via OpenRouter
- **Prompt:** Returns strict JSON with `flyer.title`, `flyer.description`, `fb.title`, `fb.price`, `fb.description`
- **Response:** `{ flyer: { title, description }, fb: { title, price, description } }`
- **Error response:** `{ error: string }` with appropriate HTTP status (401 for unauthorized, 400 for validation errors, 502 for AI failures, 500 for server errors)

### Flyer Rendering

- Fixed width: 380px
- Background: `#ede8de` (beige)
- Font: Inter / system-ui
- Border radius: 4px
- Download: html2canvas at `scale: 3` (effective output: 1140px wide), `useCORS: true`, `backgroundColor: '#ede8de'`
- File naming: `flyer-{Date.now()}.png`
- **Important:** FlyerPreview.tsx uses inline styles only (not Tailwind classes) to ensure html2canvas PNG export compatibility.

### Settings Persistence

- Key: `flyerSettings` in `window.localStorage`
- Schema: `{ pickupAddress: string, contact: string, userApiKey?: string }`
- Written on: Save button press in SetupForm
- Read on: Component mount (`useEffect`)
- Cleared on: Never (by design — settings persist until user manually changes them)

### Mobile Responsiveness

- Tailwind breakpoint `md` (768px) separates single-column mobile from two-column desktop layout
- All interactive elements: minimum height/touch target of 44px
- Font size on inputs: `text-base` (16px) to prevent iOS auto-zoom on focus
- Upload zone: `min-h-[160px]` to ensure comfortable tap area
- Flyer preview on mobile: CSS `transform: scale(0.8)` with `transformOrigin: 'top center'` and negative bottom margin to compensate for the transform
- Preview step flyer: wrapped in `overflow-x-auto` scroll container so 380px card is fully visible on narrow screens

---

## 9. Success Metrics

Since there is no analytics instrumentation in v1.0, these metrics are defined for manual or future automated measurement:

### Core Engagement

| Metric | Target | How to Measure |
|---|---|---|
| Time-to-first-flyer (new user) | < 90 seconds from landing to PNG download | Manual test timing |
| Time-to-flyer (returning user) | < 45 seconds from landing to PNG download | Manual test timing |
| AI analysis success rate | > 90% of uploads produce valid JSON from AI | Server-side error logging on `/api/analyze` |
| AI field accuracy (no edits needed) | > 70% of sessions where user does not edit AI-generated title/description | Post-launch user feedback |

### Usability

| Metric | Target |
|---|---|
| Setup completion rate (first run) | 100% of users who reach setup should complete it (low barrier — only 2 required fields) |
| Error recovery rate | Users who see the AI error banner should still complete a flyer by filling manually |
| Mobile usability | Zero iOS zoom events on input focus (guaranteed by `text-base` = 16px inputs) |
| Touch target compliance | All buttons and interactive elements >= 44px in height |

### Quality

| Metric | Target |
|---|---|
| Downloaded PNG resolution | 1140px wide (380 * 3x scale) at 96+ DPI equivalent |
| FB copy completeness | 100% of "Copy Everything" outputs include address and contact appended to description |

---

## 10. Constraints

### Technical Constraints

- **T-01: Limited server-side persistence.** User accounts are stored in PostgreSQL. All listing data and app settings live in `localStorage` (device-specific, not synced).
- **T-02: API key exposure risk.** The shared `OPENROUTER_API_KEY` is a server-side environment variable and never sent to the client. However, the user's own key (if provided) is stored in `localStorage` and sent in request bodies — users should be made aware this key is stored client-side.
- **T-03: Image size limits.** Images are base64-encoded and sent as part of a JSON request body. Very large images (>10MB original) may hit Next.js request body size limits or OpenRouter payload limits. No client-side compression is implemented in v1.0.
- **T-04: AI model dependency.** The app uses `nvidia/nemotron-nano-12b-v2-vl:free` exclusively. If this model is removed from OpenRouter's free tier or its output format changes, the JSON parsing will fail.
- **T-05: html2canvas limitations.** html2canvas cannot render cross-origin images reliably. Image data must be a `data:` URL (base64) — which it is, as the uploaded image is converted to a data URL on selection. Custom fonts loaded via Google Fonts CDN may not render correctly in the downloaded PNG.
- **T-06: No SSR for the main app.** The FlyerApp component uses `'use client'` and relies on `localStorage` and browser APIs. It cannot be server-rendered.

### Business / Operational Constraints

- **B-01: Shared API quota.** The app owner's OpenRouter API key has a finite free-tier quota. Excessive use by friends (or misuse) will exhaust the quota and break the app for all users who haven't configured their own key. No rate limiting is implemented in v1.0.
- **B-02: No content moderation.** There is no filtering of uploaded images or generated text. Users are trusted as known friends of the app owner.
- **B-03: Single deployment.** The app is expected to run as a single Next.js instance (e.g., Vercel). There is no horizontal scaling requirement.

### Design Constraints

- **D-01: Fixed flyer dimensions.** The flyer is always 380px wide. This is intentional to ensure consistent output regardless of screen size.
- **D-02: Fixed flyer theme.** The beige background (`#ede8de`) and icon-row layout are fixed. Per-listing customization of colors, fonts, or layout is not supported.
- **D-03: Mobile-first minimum touch targets.** All buttons and interactive controls must maintain >= 44px height to comply with Apple and Google mobile accessibility guidelines.
- **D-04: Minimal auth friction.** Auth is email + password with auto sign-in on registration. No email verification, no CAPTCHA, no MFA in v1.0.
- **D-05: Inline styles for flyer export.** FlyerPreview.tsx must use inline styles only (not Tailwind classes) to ensure html2canvas can correctly render the PNG export.

### Dependency Versions (as of v1.0)

| Package | Version | Notes |
|---|---|---|
| `next` | ^15.2.4 | App Router required |
| `react` / `react-dom` | ^18.3.1 | |
| `next-auth` | ^4.24.13 | Authentication (Credentials provider) |
| `bcryptjs` | ^3.0.3 | Password hashing |
| `@prisma/client` | ^7.7.0 | Database ORM client |
| `prisma` | ^7.7.0 | Database schema management (CLI) |
| `zod` | ^4.3.6 | Auth form validation (server-side) |
| `sonner` | ^2.0.7 | Toast notifications |
| `openai` | ^6.34.0 | Used as OpenRouter-compatible client |
| `html2canvas` | ^1.4.1 | PNG export of flyer (dynamic import to avoid SSR issues) |
| `tailwindcss` | ^3.4.4 | Styling framework (CSS utilities only; FlyerPreview uses inline styles) |
| `typescript` | ^5 | Type checking |

---

*End of PRD*
