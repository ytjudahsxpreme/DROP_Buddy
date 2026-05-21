# DROP Buddy

**Drop-Ready Order Portal** — a mobile-first internal web app that replaces paper student-lookup lists during school fundraiser distribution.

DROP stands for:

- **D**rop-ready
- **R**oster of
- **O**rders
- **P**resented

The whole platform exists to answer one question fast:

> *"Which items does this student get?"*

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript (strict)
- **Tailwind CSS v4**
- **Zustand** for client unlock state (persisted in localStorage)
- **Recharts** for the dashboard
- **Papaparse** for CSV export
- **Firebase Admin (Firestore)** for fundraiser config + access codes
- **Google Sheets API** (read-only via service account) for live student order data
- **Vercel** for hosting

## Architecture

```
Browser ─→ Next.js API route ─→ Firestore  (fundraiser metadata, codes, sheet config)
                              ─→ Sheets API (read student order rows)
```

- The browser **never** talks to Firestore or Sheets directly.
- Access codes are verified server-side and never leave Firestore.
- Successful unlock sets an HMAC-signed cookie (`fa_<id>`). Data API routes refuse to respond without a valid cookie.
- Order data is fetched from Sheets on each request, parsed through the existing engine, and HTTP-cached for 20s.

## First-time setup

If you're standing this up fresh, **follow [SETUP.md](SETUP.md)** — it has the exact clicks for creating a Firebase project, enabling the Sheets API, creating a service account, sharing your real sheets with it, and capturing the env vars.

Once you have credentials:

```bash
# 1. install deps
npm install

# 2. configure
cp .env.example .env.local
# fill in FIREBASE_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT_JSON (or GOOGLE_APPLICATION_CREDENTIALS),
# UNLOCK_COOKIE_SECRET, and MASTER_ACCESS_CODE

# 3. seed Firestore with the default fundraisers
npm run seed

# 4. run
npm run dev
```

Open <http://localhost:3000>.

## Without Firebase (design / demo mode)

To poke at the UI without setting up Firebase, set `NEXT_PUBLIC_USE_MOCK_DATA=1` in `.env.local`. The app will use the in-process mock data source for everything. Settings changes persist to `localStorage` only.

## App structure

```
src/
  app/
    page.tsx                  ← fundraiser picker (server-rendered, codes stripped)
    f/[id]/
      layout.tsx              ← fetches fundraiser server-side, wraps in shell
      lookup/page.tsx         ← CORE: search + filters + result cards
      dashboard/page.tsx      ← charts (items / building / grade)
      reports/page.tsx        ← grouped views + CSV export + print
      settings/page.tsx       ← access code + sheet URL + multi-worksheet config
    api/
      verify-access/route.ts  ← POST {fundraiserId, code} → cookie on success
      fundraisers/route.ts    ← GET list (codes stripped)
      fundraisers/[id]/route.ts ← GET single, PATCH update (cookie required)
      orders/[id]/route.ts    ← GET parsed orders (cookie required, 20s cache)
  components/                 ← UI primitives
  lib/
    auth/cookies.ts           ← HMAC unlock cookie helpers
    data/
      types.ts                ← StudentOrder, Fundraiser, ColumnMapping, etc.
      mockData.ts             ← seed payload (also used by mock mode)
      parser.ts               ← raw sheet rows + config → StudentOrder[]
      dataSource.ts           ← interface; picks clientDataSource / mockClientDataSource
      clientDataSource.ts     ← UI side: fetches /api/* routes
      firebaseDataSource.ts   ← server side: Firestore + Sheets
      mockClientDataSource.ts ← in-process mock (for design mode)
    firebase/admin.ts         ← Firebase Admin SDK init
    sheets/client.ts          ← Google Sheets API client (service account auth)
    state/appState.ts         ← Zustand: which fundraisers are unlocked client-side
    utils/                    ← search, classnames
scripts/
  seed.ts                     ← npm run seed → uploads MOCK_FUNDRAISERS to Firestore
  dev.cmd                     ← Windows dev launcher (used by Claude Preview)
```

## Data model highlights

A `Fundraiser` has:

- One Sheet URL.
- One or more `WorksheetSource`s — each tab in the sheet has its own column mapping and items list.
- Each `FundraiserItem` has a `name`, a `quantityColumn`, and an optional `identifierColumn` (used for things like Subway sub numbers).

When a student appears in multiple tabs, the parser merges their lines into one `StudentOrder`. Lookup cards show every item with quantity and optional identifier badges.

## Deploying to Vercel

1. Push the repo to GitHub.
2. <https://vercel.com/new> → import the repo. Framework auto-detects Next.js.
3. Add env vars in the Vercel dashboard (same as `.env.local`):
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_SERVICE_ACCOUNT_JSON` (paste the whole JSON as a single value)
   - `UNLOCK_COOKIE_SECRET`
   - `MASTER_ACCESS_CODE`
4. Deploy.

Re-runs of `npm run seed` need to point at the prod project — re-export the same env vars locally and run it, or do it once at setup.

## Operating notes

- **Edit a code or sheet config** on the Settings tab (or directly in Firestore at `/fundraisers/<id>`).
- **Adding a new fundraiser**: add a doc under `/fundraisers/<new-id>` in Firestore with the same shape as the existing ones. It appears on the home page automatically.
- **Rotating the master code**: change `MASTER_ACCESS_CODE` env var and redeploy. Active unlock cookies stay valid until they expire (12h).
- **Sheets API quota**: the free tier is 300 read req/min per service account. Far more than a single school can use. If you ever hit it, raise the cache from 20s to 60s in `src/app/api/orders/[id]/route.ts`.

## What's intentionally not built

- Ecommerce / payments
- Parent or student accounts
- Push notifications, messaging
- Offline mode

These are all explicitly out of scope per the original spec.

## Mobile UX notes

- Bottom tab nav, 64px touch targets.
- 16px form inputs to prevent iOS auto-zoom.
- `pb-24` on every main scroll region clears the bottom nav.
- `print:hidden` hides controls on the Reports page when printing pickup lists.
- Sticky search + filters band stays visible while scrolling the lookup list.
