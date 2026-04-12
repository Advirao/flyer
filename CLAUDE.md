# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # start dev server (localhost:3000)
npm run build      # production build (also runs prisma generate via postinstall)
npm run start      # serve production build

npx prisma migrate dev --name <name>   # create + apply a DB migration
npx prisma generate                    # regenerate Prisma client after schema changes
npx prisma studio                      # GUI to inspect the database
```

No test suite or linter is configured.

## Required environment variables

Create `.env.local` — the app will not start correctly without these:

```
DATABASE_URL=          # Supabase pooled connection string (port 6543, ?pgbouncer=true)
DIRECT_URL=            # Supabase direct connection string (port 5432, for migrations)
NEXTAUTH_SECRET=       # random 32-byte hex: openssl rand -hex 32
NEXTAUTH_URL=          # full public URL, e.g. http://localhost:3000 in dev
OPENROUTER_API_KEY=    # default AI key; users can supply their own via Settings
```

`NEXTAUTH_SECRET` is validated at module load in `lib/auth.ts` — a missing value throws on startup rather than failing silently at runtime.

## Architecture

### Route structure

| Route | Access | Purpose |
|---|---|---|
| `/` | Public | Marketing landing page |
| `/auth/signin` | Public | Email + password sign-in |
| `/auth/signup` | Public | Registration (auto-signs in after success) |
| `/auth/change-password` | Auth required | Change password |
| `/app` | Auth required | Flyer generator tool |
| `/api/analyze` | Auth required | AI image analysis via OpenRouter |
| `/api/auth/[...nextauth]` | — | NextAuth handler |

`middleware.ts` enforces auth on `/app/:path*` and `/auth/change-password` using NextAuth's edge middleware.

### Data flow

1. User signs up/in → NextAuth issues a JWT session cookie
2. On `/app`, `FlyerApp` reads `localStorage` for settings (address, contact, optional API key)
3. User uploads photo → `FlyerApp` POSTs base64 image to `/api/analyze`
4. `/api/analyze` verifies session via `getServerSession`, calls OpenRouter, returns structured JSON
5. AI-populated fields are editable; user enters price → clicks Preview
6. `FlyerPreview` renders the flyer; download triggers `html2canvas` at 3× scale → PNG

### Key architectural decisions

**All app state is local React `useState` in `FlyerApp`.** No global state manager. Settings are persisted in `localStorage` under the key `flyerSettings`.

**`FlyerPreview.tsx` must use inline styles only — no Tailwind classes on the flyer card.** `html2canvas` cannot read Tailwind's utility classes reliably; all layout and colour for the downloadable card is done with `style={{}}` props. This constraint applies to the element referenced by `flyerRef`.

**Signup uses `app/api/signup/route.ts`** (an API route, not a server action) called via XHR from `app/auth/signup/page.tsx`. Password change uses a server action in `lib/auth-actions.ts`. Sign-in uses `next-auth/react`'s `signIn()` directly (client-side credentials call).

**Prisma client is a singleton** (`lib/db.ts`) guarded by `globalThis` to survive Next.js hot reloads in development.

**`html2canvas` is dynamically imported** inside the download handler to avoid SSR issues — do not add it to static imports.

### Auth implementation

- Provider: Credentials only (email + password). No OAuth.
- Sessions: JWT strategy (stateless — no session table in DB).
- Password hashing: `bcryptjs` at cost factor 12.
- Validation: Zod schemas in `lib/validations.ts` run inside server actions before any DB access.
- Auto sign-in after signup: uses a `useRef` to capture form values at submit time, then calls `signIn()` in a `useEffect` after the server action succeeds. The ref avoids a stale-closure bug where controlled input state could diverge from what was actually submitted.
- The only database model is `User` (id, email, passwordHash, createdAt, updatedAt).
