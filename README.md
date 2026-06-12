# Fairshare

A self-hosted, installable expense-splitter for friends and groups — split bills in groups or
one-on-one, track who owes whom across everything, settle up, and review spending with charts.
Built as a Progressive Web App, so it installs to your phone's home screen and runs full-screen
like a native app.

---

## Table of contents

- [Tech stack](#tech-stack)
- [Feature overview](#feature-overview)
- [Security model](#security-model)
- [Architecture notes](#architecture-notes)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [npm scripts](#npm-scripts)
- [Testing](#testing)
- [Deployment (Docker)](#deployment-docker)
- [Installing as a phone app (PWA)](#installing-as-a-phone-app-pwa)
- [API reference](#api-reference)
- [Data model](#data-model)
- [Project structure](#project-structure)

---

## Tech stack

| Area | Choice |
|---|---|
| Framework | **Next.js 14** (App Router, React Server Components, TypeScript, `output: standalone`) |
| Database | **PostgreSQL** via **Prisma 5** (migrations, `Decimal(12,2)` money) |
| Auth | **NextAuth v5** (credentials provider, JWT strategy) |
| Styling | **Tailwind CSS** + **shadcn/ui** components |
| Theming | **next-themes** (light / dark / system, semantic CSS-variable tokens) |
| Forms & validation | **react-hook-form** + **Zod** |
| Charts | **Recharts** (spending summary) |
| PWA | **next-pwa** (service worker, offline shell, installable) |
| Notifications | **sonner** (toasts) |
| AI (optional) | **@anthropic-ai/sdk** (natural-language expense parsing) |
| Password hashing | **bcryptjs** (cost 12) |

---

## Feature overview

### Authentication & accounts
- Email + password **registration** with a live password-strength meter, **auto sign-in** afterwards.
- **Login** with deliberately generic errors (no account enumeration).
- JWT sessions in cookies; protected routes enforced by **Edge middleware** _and_ re-checked in the
  app layout (defense-in-depth).
- **Profile page** — update display name, **change password** (verifies current password, re-hashes
  at cost 12, rejects reusing the same password). Email is shown read-only.

### Groups
- Create / rename / delete groups (emoji, description, currency). Creator becomes **ADMIN**.
- **Friendly UUID group URLs** — `/groups/715d56cf-51e8-41df-b0f4-883feb460612`.
- **Member management** — roles (ADMIN / MEMBER), remove members, leave group, last-admin /
  last-member guards.
- **Two ways to add people:**
  - **Add by email** — instantly add an existing Fairshare user (admin only).
  - **Invite links** — generate a shareable link (7-day expiry, single-use); the invitee logs in or
    signs up and is auto-joined. The whole `invite → login/register → join` chain preserves the
    callback so nobody loses the invite.

### Expenses
- Add expenses with a **payer**, **date**, **category** (Food, Transport, Groceries, Travel,
  Accommodation, Entertainment, Shopping, Utilities, Health, Other), and **notes**.
- **Four split types**, all recomputed **server-side** (never trust client amounts), cents-exact via
  a largest-remainder algorithm:
  - **EQUAL** — split evenly.
  - **EXACT** — explicit amount per person (must sum to total).
  - **PERCENTAGE** — percentages (must sum to 100).
  - **SHARES** — integer share weights (e.g. 2:1:1).
- **Edit** (payer or admin) — changing the amount **rescales splits proportionally**, preserving the
  original ratios (an EXACT 70/30 stays 70/30; equal stays equal).
- **Soft delete** — deleted expenses are excluded from every balance/stat query.
- **Receipts** — attach an image per expense; see [Receipts](#receipts-secure-image-uploads).

### Direct (non-group) expenses
- Split with **one person** or **anyone** without creating a group (`groupId = null`, participants
  tracked separately). Same split types, edit, and soft-delete rules as group expenses.

### Balances & settle-up
- **Per-group balances** — a debt graph is simplified into the **minimal set of transfers** that
  settles everyone; settlements are modelled as reverse debts so they cancel cleanly.
- **Record a settlement** within a group — guarded so you can only record your own payment (or as an
  admin), both parties must be members, and the amount can't exceed the real debt.

### Global "Who Owes Whom"
- A cross-everything **balances page**: your net with each person across **all groups + direct
  expenses**, split into "they owe you" / "you owe", with a hero net figure and a **confetti**
  all-settled state.
- Uses **bilateral netting** per counterparty (consistent with each person's detail page, so every
  row maps to a real shared expense).
- **Per-person detail page** — every shared expense (group-tagged or "Direct") between you two, plus
  a **direct settle-up** button (only settles the direct portion; group debts settle in-group).

### Dashboard
- Cross-group **summary cards** (total owed to you / you owe / net) that **include direct expenses**.
- Your **groups** with per-group balance, and a **recent activity** feed merging group + direct
  expenses and settlements.

### Filtering, search & spending insights
- Per-group **filters**: category pills, **date range**, and **debounced description search**
  (parameterized ILIKE), with a live **filtered total**.
- **Spending summary** (Recharts): bar chart of spend per category, **this-month vs last-month**, and
  the **top spender**.

### Quick add — floating button + modal
- A persistent **floating "Add expense" button** on every page. On a group page it pre-selects that
  group; elsewhere it asks **Group / Person / Anyone**, then shows the right form.
- **Relationship-scoped user search** (`/api/users/search`) — only surfaces people you share a group
  or a past direct expense with, and **never returns emails**.

### AI natural-language expense entry (optional)
- `POST /api/expenses/parse` turns _"paid 500 for dinner with Rahul"_ into a structured expense using
  **Claude (claude-sonnet-4-6)**.
- Privacy-first: input is sanitized + length-capped, raw text is **never logged**, the contact list
  is built **server-side** (no client ID injection), Claude's output is **Zod-validated**, and it's
  rate-limited to **10/min per user**.
- **Currently hidden in the UI** (kept for a future iteration). Requires `ANTHROPIC_API_KEY`; the
  route degrades to `503` and the app works fully without it.

### Receipts (secure image uploads)
- Upload one image per expense. **MIME is validated by magic bytes** (not the `Content-Type`),
  filenames are server-generated UUIDs (the client name is discarded), 5 MB cap, stored **outside the
  web root**, and served only to members/participants of that expense via path-traversal-guarded
  routes.

### Progressive Web App
- Installable to your phone's home screen; runs **full-screen / standalone**.
- Web manifest with **maskable icons** (native Android adaptive icon), service worker that caches the
  app shell and static assets (never auth, mutations, receipts, or tokens), and an **install prompt**
  (with an **iOS "Add to Home Screen" hint**, since iOS has no auto-prompt).
- Service worker caches are **purged on sign-out** so nothing leaks on a shared device.

### Theming & UX polish
- App-wide **light / dark / system** theme via semantic tokens; theme toggle in the header; toasts
  follow the theme.
- Responsive layout (desktop sidebar + mobile bottom nav), skeleton loaders, confirm dialogs,
  Indian-rupee (`₹`, 1,00,000) formatting, and relative timestamps.

---

## Security model

- **Passwords** — bcrypt, cost 12. Never returned by any endpoint (`select` always excludes
  `passwordHash`).
- **Authorization** — every group route calls `requireGroupMember` / `requireGroupAdmin` first;
  expense/settlement actions verify payer/sender identity; non-participants get opaque `404`s (no
  existence leak).
- **Server-side money** — all split amounts are recomputed on the server; client-supplied split
  values are never trusted.
- **Rate limiting** — in-memory sliding window in middleware: register 5/h, login 10/h, NLP 10/min,
  other `/api` 100/h (auth session/csrf polling exempt). NLP also enforces 10/min **per user**.
- **Input validation** — Zod on every mutation (trim + max length); text search uses parameterized
  Prisma queries (no raw SQL).
- **Security headers** (set in `next.config.js`): CSP (`frame-ancestors 'none'`, scoped
  script/style/img/connect sources), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy`, `Permissions-Policy` (camera/mic/geolocation off).
- **Env validation** — `lib/env.ts` (Zod) fails fast at startup if `DATABASE_URL` /
  `NEXTAUTH_SECRET` (≥32 chars) are missing/invalid.
- **Structured logging** — `lib/logger.ts` emits JSON lines for 401/429 (method/path/status, never
  secrets). Prisma query logging is **off** (queries can contain personal data).
- **Receipts** — magic-byte MIME validation, server-generated filenames, stored outside web root,
  served only to authorized members.

---

## Architecture notes

- **Two-file NextAuth split** — `lib/auth.config.ts` is Edge-safe (no Prisma) for `middleware.ts`;
  `lib/auth.ts` is the full Node config (Credentials provider, bcrypt).
- **Split engine** (`lib/splitEngine.ts`) — pure, integer-cent functions: `calculateSplits`
  (dispatcher), `rescaleSplit` (proportional edit), `buildRawDebts` + `simplifyDebts` (greedy debt
  minimization). Covered by unit tests.
- **Balance libraries** — `lib/balances.ts` (per-group), `lib/globalBalances.ts` (cross-everything
  bilateral netting + pairwise detail), `lib/dashboard.ts`, `lib/directExpenses.ts`.
- **Money** — stored as Prisma `Decimal(12,2)`; converted to `number` at a single serialization
  boundary (`lib/expense-shape.ts`).
- **Group IDs** — UUID v4 (`lib/ids.ts`) for clean URLs.

---

## Getting started

### Prerequisites
- **Node.js 18+**
- A **PostgreSQL** database

### Setup

```bash
git clone https://github.com/avianage/fairshare.git
cd fairshare

npm install

cp .env.example .env
# Fill in DATABASE_URL and NEXTAUTH_SECRET (openssl rand -base64 32)

npx prisma migrate deploy   # apply migrations (or `npm run db:migrate` in dev)
npm run dev
```

Open <http://localhost:3000>.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | ✅ | JWT signing secret, ≥32 chars (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | prod | Public base URL (used for invite links and auth callbacks) |
| `UPLOAD_DIR` | – | Where receipts are stored (default `./uploads`; `/data/uploads` in Docker) |
| `ANTHROPIC_API_KEY` | – | Enables AI natural-language parsing; omit to disable that feature |
| `APP_VERSION` | – | Surfaced by the `/api/health` check |
| `DISABLE_PWA` | – | Set `true` to turn the service worker off during `next dev` |
| `POSTGRES_PASSWORD` | – | Used by `docker-compose.yml` for the bundled Postgres |

---

## npm scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm run start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate the Prisma client |
| `npm run db:migrate` | `prisma migrate dev` (create + apply a migration) |
| `npm run db:push` | Push schema without a migration (dev only) |
| `npm run db:studio` | Open Prisma Studio |
| `npm run gen:icons` | Regenerate PWA icons |
| `npm run test:split` | Split-engine unit tests (standalone, no server) |
| `npm run test:groups` | Live groups API test harness |
| `npm run test:dashboard` | Live dashboard test harness |
| `npm run test:receipts` | Live receipts test harness |
| `npm run test:ratelimit` | Rate-limit test harness |

> The live `test:*` harnesses (except `test:split`) need the dev server running.

---

## Testing

- **`npm run test:split`** runs the cents-exact split-engine + debt-simplification + `rescaleSplit`
  checks with no database or server required.
- The other harnesses mint a NextAuth session cookie, seed data via Prisma, and exercise the live API
  (groups, dashboard, receipts, rate limiting).

---

## Deployment (Docker)

The repo ships a multi-stage **`Dockerfile`** (node:20-slim, non-root, standalone output) and a
**`docker-compose.yml`** (app + Postgres 16). Migrations run automatically on container start
(`prisma migrate deploy`), and a Docker `HEALTHCHECK` hits `/api/health`.

```bash
# Provide a secret, then build + run app + db:
NEXTAUTH_SECRET=$(openssl rand -base64 32) docker compose up --build
```

Put a **TLS-terminating reverse proxy** (Caddy / nginx / Traefik) in front for production and set
`NEXTAUTH_URL` to the public `https://` URL. Receipts persist on the `/data` volume.

---

## Installing as a phone app (PWA)

PWA is **on in production** (and now in dev too, unless `DISABLE_PWA=true`). To install:

1. Serve the app over **HTTPS** (install prompts require a secure context — `localhost` is exempt,
   but a phone hitting `http://192.168.x` is **not**).
2. For a quick test, tunnel your local prod server:
   ```bash
   npm run build && npm run start
   npx cloudflared tunnel --url http://localhost:3000   # gives an https URL
   ```
3. Open the `https://…` URL on your phone → **Add to Home Screen / Install app**.
   - **Android** shows an install prompt automatically.
   - **iOS** has no auto-prompt — use **Share → Add to Home Screen** (the app shows a hint).

---

## API reference

All routes are JSON; protected routes require a session (`401` otherwise). Money is in **rupee units**
(2 decimals).

**Auth & profile**
| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/auth/register` | Create account (rate-limited) |
| `*` | `/api/auth/[...nextauth]` | NextAuth sign-in/out/session |
| `PATCH` | `/api/profile` | Update display name |
| `POST` | `/api/profile/password` | Change password |
| `GET` | `/api/users/search?q=` | Relationship-scoped user search (no emails) |
| `GET` | `/api/health` | Liveness + DB check |

**Groups & members**
| Method | Path | Purpose |
|---|---|---|
| `GET` `POST` | `/api/groups` | List / create groups |
| `GET` `PATCH` `DELETE` | `/api/groups/[groupId]` | Read / rename / soft-delete group |
| `GET` `POST` | `/api/groups/[groupId]/members` | List / add-by-email members |
| `DELETE` | `/api/groups/[groupId]/members/[userId]` | Remove member / leave |
| `POST` | `/api/groups/[groupId]/invite` | Generate invite link |
| `GET` `POST` | `/api/invite/[token]` | Preview / accept invite |

**Expenses, balances, stats**
| Method | Path | Purpose |
|---|---|---|
| `GET` `POST` | `/api/groups/[groupId]/expenses` | List (filters + total) / create |
| `GET` `PATCH` `DELETE` | `/api/groups/[groupId]/expenses/[expenseId]` | Read / edit / soft-delete |
| `POST` `DELETE` | `/api/groups/[groupId]/expenses/[expenseId]/receipt` | Attach / remove receipt |
| `GET` | `/api/uploads/[filename]` | Serve a receipt (authorized only) |
| `GET` | `/api/groups/[groupId]/balances` | Simplified group debts |
| `POST` | `/api/groups/[groupId]/settle` | Record a group settlement |
| `GET` | `/api/groups/[groupId]/stats` | Spending summary |
| `GET` `POST` | `/api/expenses` | Direct (non-group) expenses |
| `GET` `PATCH` `DELETE` | `/api/expenses/[expenseId]` | Direct expense detail |
| `POST` | `/api/expenses/parse` | AI natural-language parse (optional) |
| `GET` | `/api/balances` | Global "who owes whom" (cached 30s) |
| `POST` | `/api/direct-settle` | Record a direct settlement |
| `GET` | `/api/dashboard` | Cross-group + direct summary |

---

## Data model

Key Prisma models (`prisma/schema.prisma`):

- **User** — credentials account; relations to memberships, expenses paid, splits, settlements,
  direct participations.
- **Group** / **GroupMember** (role) / **GroupInvite** (token, expiry, single-use).
- **Expense** — `groupId` **nullable** (null = direct), `amount Decimal(12,2)`, `category`,
  `splitType`, `receiptUrl`, soft-delete `deletedAt`.
- **ExpenseSplit** — per-user share of an expense.
- **DirectParticipant** — participants of a direct (non-group) expense.
- **Settlement** — `groupId` **nullable** (null = direct settlement), sender → receiver, amount.

Money is `Decimal(12,2)`; all split math runs in integer cents.

---

## Project structure

```
app/
  (auth)/login, /register          # auth pages (server) + client forms
  (app)/dashboard                  # cross-group + direct summary
  (app)/groups, /groups/[groupId]  # group list, detail, settings
  (app)/balances, /balances/[userId]  # global + per-person balances
  (app)/profile                    # account settings
  (app)/layout.tsx                 # app shell (sidebar/mobile nav, FAB, theme)
  invite/[token]                   # invite acceptance
  api/                             # see API reference above
components/
  auth/ groups/ expenses/ balances/ dashboard/ profile/ fab/ nlp/ ui/
lib/
  auth.config.ts auth.ts prisma.ts env.ts logger.ts ids.ts rate-limit.ts
  splitEngine.ts balances.ts globalBalances.ts dashboard.ts directExpenses.ts
  expense-shape.ts uploads.ts categories.ts format.ts anthropic.ts
prisma/
  schema.prisma  migrations/
scripts/                           # test harnesses, icon + rekey utilities
middleware.ts                      # auth + rate limiting + security logging
next.config.js                     # PWA wrap + security headers
Dockerfile  docker-compose.yml     # containerized deploy
```

---

Built with Next.js. Self-hosted, your data stays yours.
