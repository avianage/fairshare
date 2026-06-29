# Fairshare

An open-source, centralized expense-splitting app for friends and groups — split bills in groups or
one-on-one, track who owes whom across everything, settle up, and review spending with charts and
insights. Built as a Progressive Web App so it installs to your phone's home screen and runs
full-screen like a native app.

> **Early Alpha** — actively being built. Features may change without notice.

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
| Database | **PostgreSQL** via **Prisma 5** (`Decimal(12,2)` money, migrations) |
| Auth | **NextAuth v5** (credentials provider, JWT strategy) |
| Styling | **Tailwind CSS** + **shadcn/ui** components |
| Theming | **next-themes** (light / dark / system, semantic CSS-variable tokens) |
| Forms & validation | **react-hook-form** + **Zod** |
| Charts | **Recharts** (spending summaries and insights) |
| PWA | **next-pwa** (service worker, offline shell, installable) |
| Push notifications | **web-push** (VAPID Web Push API) |
| Toasts | **sonner** |
| AI (optional) | **@anthropic-ai/sdk** — `claude-sonnet-4-6` for NLP expense parsing |
| Password hashing | **bcryptjs** (cost 12) |

---

## Feature overview

### Authentication & accounts

- **Registration** with display name, email, **unique username** (3–20 chars, letters/digits/underscore), and a live password-strength meter. Auto sign-in after registration.
- **Login** with email _or_ `@username` — both work interchangeably. Deliberately generic errors (no account enumeration).
- JWT sessions in cookies; protected routes enforced by **Edge middleware** and re-checked in the app layout (defense-in-depth).
- **Profile page** — update display name, **change username** (30-day cooldown enforced server-side), change password (verifies current, rejects reuse), **light / dark / system theme toggle**.

### Groups

- Create / rename / delete groups (emoji, description, currency). Creator becomes **ADMIN**.
- **Friendly UUID group URLs** — `/groups/715d56cf-51e8-41df-b0f4-883feb460612`.
- **Member management** — roles (ADMIN / MEMBER), remove members, leave group, last-admin / last-member guards.
- **Invite links** — the only way to add people: generate a shareable link (7-day expiry, single-use). The `invite → login/register → join` chain preserves the callback so nobody loses the invite.

### Expenses

- Add expenses with a **payer**, **date**, **category** (Food, Transport, Groceries, Travel, Accommodation, Entertainment, Shopping, Utilities, Health, Other), and **notes**.
- **Four split types**, all recomputed server-side — never trust client amounts — cents-exact via largest-remainder:
  - **EQUAL** — split evenly.
  - **EXACT** — explicit amount per person (must sum to total).
  - **PERCENTAGE** — percentages (must sum to 100).
  - **SHARES** — integer share weights (e.g. 2:1:1).
- **Inline edit** — tap the pencil icon to edit description, amount, category, and notes. Changing the amount **rescales splits proportionally**, preserving original ratios.
- **Expense detail page** at `/expenses/[expenseId]` — universal for both group and direct expenses.
- **Soft delete** — deleted expenses are excluded from every balance/stat query.
- **Receipts** — attach one image per expense (see [Receipts](#receipts-secure-image-uploads)).

### Direct (non-group) expenses

- Split with any person without creating a group (`groupId = null`). Same split types, edit, and soft-delete rules as group expenses.
- The **direct expense user-search** pre-populates friends as suggestions before you type.

### Friends

- **Personal invite links** — unique reusable link (`/friend-invite/xxxx-xxxx-xxxx-xxxx`, 30-day expiry). Share anywhere; one tap establishes a mutual friendship.
- **Friends page** — view/regenerate your invite link, see all friends with "friends since" dates, remove friends.
- **Friend requests** — send and accept explicit friend requests as an alternative to invite links.
- Friends appear as **instant suggestions** in the direct expense user-search (pre-populated on focus, before typing).

### Balances & settle-up

- **Per-group balances** — a debt graph simplified into the **minimal set of transfers** via a greedy debt-minimization algorithm.
- **Record a settlement** within a group — guarded so you can only record your own payment (or as admin), both parties must be members, and the amount cannot exceed the real debt.

### Global "Who Owes Whom" (Ledger)

- **Cross-everything balances page** at `/ledger`: net with each person across all groups + direct expenses, split into "they owe you" / "you owe", with a hero net figure and **confetti** for the all-settled state.
- **Per-person detail page** `/ledger/[userId]` — every shared expense (group-tagged or "Direct") between you two, plus a direct settle-up button.

### Dashboard

- Cross-group **summary cards** (total owed to you / you owe / net) that include direct expenses.
- Your **groups** with per-group balance, and a **recent activity** feed merging group + direct expenses and settlements.
- **Monthly budget progress** card with spend vs. limit at a glance.

### Budgets

- Set per-category monthly budgets at `/budgets`.
- Choose a **budget model**: `PERSONAL_SHARE` (your share of expenses) or `NET_PAYMENT` (what you actually paid out).
- Progress bars per category; total monthly budget displayed on the dashboard.

### Insights & statement

- **Insights** page (`/insights`) — personal spending charts, category breakdowns, month-over-month comparisons.
- **Statement** page (`/statement`) — exportable expense statement across all groups.

### Notifications

- **In-app notification inbox** — bell icon in the header; popover with unread count badge; mark-all-read; 15-second polling.
- **Web Push notifications** — opt-in from the profile settings page or via the dismissible prompt banner. Works on desktop and as a native-style push on installed Android PWA (uses FCM under the hood via Chrome).
- **Push prompt** — dismissible banner shown when permission is `"default"` and not previously dismissed (localStorage); toggle in profile settings to re-enable after dismissal.

### Audit log (admin)

- **Structured audit log** for all significant actions (logins, expense mutations, settlements, admin actions, invites) including actor, IP, and metadata.
- **Suspicious activity detection** — high login-failure rate, mass deletes, and repeated forbidden-access attempts are flagged automatically and admins are notified via push.
- **Admin audit log viewer** at `/admin/audit` — filterable by action type and suspicious flag, with pagination.
- **CSV export** of the full audit log with filters.

### Admin panel

- Accessible only to users with `isAdmin = true`.
- **User table** — name, username, email, group count (drilldown to group list), expense count, admin/banned status, join date. Desktop table + mobile card layout.
- **Actions per user**: Edit profile (bypasses cooldowns), Ban / Unban, Promote / Demote, Delete (cascades all related data).
- **"View Audit Log"** button with suspicious-event count badge.

### Filtering, search & spending insights

- Per-group **filters**: category pills, **date range**, and **debounced description search** (parameterized `ILIKE`), with a live filtered total.
- **Spending summary** (Recharts): bar chart of spend per category, this-month vs last-month, and top spender.

### Quick add — floating button + modal

- Persistent **floating "+" button** on every page. On a group page it pre-selects that group; elsewhere asks Group / Person / Anyone.
- **Relationship-scoped user search** — only surfaces people you share a group, past direct expense, or friendship with. Never returns email addresses.

### AI natural-language expense entry (optional)

- `POST /api/expenses/parse` turns _"paid 500 for dinner with Rahul"_ into a structured expense using **Claude (claude-sonnet-4-6)**.
- Privacy-first: input is sanitized + length-capped, raw text is never logged, contact list is built server-side, Claude output is Zod-validated, rate-limited to **10/min per user**.
- Requires `ANTHROPIC_API_KEY`; the route degrades to `503` and the app works fully without it.

### Receipts (secure image uploads)

- Upload one image per expense. **MIME validated by magic bytes** (not `Content-Type`), filenames are server-generated UUIDs (client name discarded), 5 MB cap, stored **outside the web root**, served only to members/participants via path-traversal-guarded routes.

### Progressive Web App

- Installable to your phone's home screen; runs **full-screen / standalone**.
- Web manifest with **maskable icons** (native Android adaptive icon), service worker that caches the app shell and static assets (never auth, mutations, receipts, or tokens).
- **Install prompt** with an **iOS "Add to Home Screen" hint** (iOS has no auto-prompt).
- Push notifications work natively on installed Android PWA via Chrome/FCM.
- Service worker caches are **purged on sign-out** so nothing leaks on shared devices.

---

## Security model

- **Passwords** — bcrypt, cost 12. Never returned by any endpoint (`select` always excludes `passwordHash`).
- **Authorization** — every group route calls `requireGroupMember` / `requireGroupAdmin`; expense/settlement actions verify payer/sender identity; non-participants get opaque `404`s (no existence leak). `isAdmin` flag in the JWT grants bypass only via explicit check.
- **Server-side money** — all split amounts are recomputed on the server; client-supplied split values are never trusted.
- **Rate limiting** — in-memory sliding window: register 5/h/IP, login 10/h/IP, NLP 10/min/user, other `/api` 100/h. Auth session/CSRF polling is exempt.
- **Input validation** — Zod on every mutation (trim + max length); text search uses parameterized Prisma queries (no raw SQL).
- **Security headers** (in `next.config.js`): CSP (`frame-ancestors 'none'`, scoped script/style/img/connect sources), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` (camera/mic/geolocation off).
- **Env validation** — `lib/env.ts` (Zod) fails fast at startup if `DATABASE_URL` / `NEXTAUTH_SECRET` (≥32 chars) are missing or invalid.
- **Structured audit logging** — all significant actions are logged with actor, IP, and metadata. Suspicious patterns trigger admin alerts.
- **Receipts** — magic-byte MIME validation, server-generated filenames, stored outside web root, served only to authorized members.

---

## Architecture notes

- **Two-file NextAuth split** — `lib/auth.config.ts` is Edge-safe (no Prisma) for `middleware.ts`; `lib/auth.ts` is the full Node config. Login accepts email or `@username` — `authorize()` strips the leading `@` and routes to the correct DB lookup.
- **Split engine** (`lib/splitEngine.ts`) — pure, integer-cent functions: `calculateSplits` (dispatcher), `rescaleSplit` (proportional edit), `buildRawDebts` + `simplifyDebts` (greedy debt minimization). Covered by unit tests.
- **Balance libraries** — `lib/balances.ts` (per-group), `lib/globalBalances.ts` (cross-everything bilateral netting + pairwise detail), `lib/dashboard.ts`, `lib/directExpenses.ts`.
- **Money** — stored as Prisma `Decimal(12,2)`; converted to `number` at a single serialization boundary (`lib/expense-shape.ts`). Formatted as Indian rupees (`₹`, lakh-style) via `lib/format.ts`.
- **Group IDs** — UUID v4 (`lib/ids.ts`) for clean URLs.
- **Friend invite tokens** — `xxxx-xxxx-xxxx-xxxx` hex format (8 random bytes), generated in app code.
- **Notifications** — `lib/notifications.ts` persists DB rows + fires Web Push; `lib/audit.ts` detects suspicious patterns and notifies admins via the same pipeline.

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
# Fill in DATABASE_URL and NEXTAUTH_SECRET (see Environment variables below)

npx prisma migrate deploy   # or: npx prisma db push (dev only)
npm run dev
```

Open <http://localhost:3000>.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | ✅ | JWT signing secret, ≥32 chars — `openssl rand -base64 32` |
| `NEXTAUTH_URL` | prod | Public base URL (e.g. `https://app.fairshare.in`) |
| `UPLOAD_DIR` | – | Receipt storage path (default `./uploads`; `/data/uploads` in Docker) |
| `ANTHROPIC_API_KEY` | – | Enables AI NLP parsing; omit to disable |
| `VAPID_PUBLIC_KEY` | – | Web Push VAPID public key — `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | – | Web Push VAPID private key |
| `VAPID_SUBJECT` | – | VAPID contact email, e.g. `mailto:you@example.com` |
| `APP_VERSION` | – | Surfaced by `/api/health` (e.g. a git SHA) |
| `DISABLE_PWA` | – | Set `true` to disable the service worker in dev |
| `POSTGRES_PASSWORD` | – | Used by `docker-compose.yml` for the bundled Postgres service |

---

## npm scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm run start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate the Prisma client |
| `npm run db:migrate` | `prisma migrate dev` — create + apply a migration |
| `npm run db:push` | Push schema without a migration (dev only) |
| `npm run db:studio` | Open Prisma Studio |
| `npm run gen:icons` | Regenerate PWA icons |
| `npm run test:split` | Split-engine unit tests (standalone, no server needed) |
| `npm run test:groups` | Live groups API test harness |
| `npm run test:dashboard` | Live dashboard test harness |
| `npm run test:receipts` | Live receipts test harness |
| `npm run test:ratelimit` | Rate-limit test harness |

> The live `test:*` harnesses (except `test:split`) require the dev server to be running.

---

## Testing

- **`npm run test:split`** runs the cents-exact split engine + debt simplification + `rescaleSplit` checks with no database or server required.
- The other harnesses mint a NextAuth session cookie, seed data via Prisma, and exercise the live API.

---

## Deployment (Docker)

The repo ships a multi-stage **`Dockerfile`** (node:20-slim, non-root, standalone output) and a **`docker-compose.yml`** (app + Postgres 16). Migrations run automatically on container start (`prisma migrate deploy`), and a Docker `HEALTHCHECK` hits `/api/health`.

```bash
NEXTAUTH_SECRET=$(openssl rand -base64 32) docker compose up --build
```

Put a **TLS-terminating reverse proxy** (Caddy / nginx / Traefik) in front for production and set `NEXTAUTH_URL` to the public `https://` URL. Receipts persist on the `/data` volume.

---

## Installing as a phone app (PWA)

1. Serve the app over **HTTPS** — install prompts require a secure context (`localhost` is exempt, but a phone on `http://` is not).
2. Open the URL on your phone.
   - **Android** — Chrome shows an install banner automatically.
   - **iOS** — use **Share → Add to Home Screen** (the app shows a hint).
3. Once installed, the app runs full-screen and receives push notifications natively (Android).

---

## API reference

All routes return JSON. Protected routes require a valid session (`401` otherwise). Money is in **rupee units** (2 decimals).

### Auth & accounts

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/auth/register` | Create account with username (rate-limited 5/h/IP) |
| `*` | `/api/auth/[...nextauth]` | NextAuth sign-in / out / session / CSRF |
| `GET PATCH` | `/api/profile` | Read / update display name + username |
| `POST` | `/api/profile/password` | Change password |
| `GET` | `/api/users/search?q=` | Relationship-scoped user search (no email returned) |
| `GET` | `/api/health` | Liveness + DB connectivity check |

### Groups & members

| Method | Path | Purpose |
|---|---|---|
| `GET POST` | `/api/groups` | List / create groups |
| `GET PATCH DELETE` | `/api/groups/[groupId]` | Read / rename / soft-delete group |
| `GET` | `/api/groups/[groupId]/members` | List members |
| `DELETE` | `/api/groups/[groupId]/members/[userId]` | Remove member or leave group |
| `POST` | `/api/groups/[groupId]/invite` | Generate invite link |
| `GET POST` | `/api/invite/[token]` | Preview / accept group invite |

### Expenses, balances & stats

| Method | Path | Purpose |
|---|---|---|
| `GET POST` | `/api/groups/[groupId]/expenses` | List (with filters + total) / create group expense |
| `GET PATCH DELETE` | `/api/groups/[groupId]/expenses/[expenseId]` | Read / edit / soft-delete |
| `POST DELETE` | `/api/groups/[groupId]/expenses/[expenseId]/receipt` | Attach / remove receipt |
| `GET` | `/api/uploads/[filename]` | Serve a receipt (membership-authorized) |
| `GET` | `/api/groups/[groupId]/ledger` | Per-group transaction list |
| `POST` | `/api/groups/[groupId]/settle` | Record a group settlement |
| `GET` | `/api/groups/[groupId]/stats` | Spending summary + chart data |
| `GET POST` | `/api/expenses` | List / create direct (non-group) expenses |
| `GET PATCH DELETE` | `/api/expenses/[expenseId]` | Read / edit / soft-delete direct expense |
| `POST` | `/api/expenses/parse` | AI NLP parse → structured expense (optional, 10/min/user) |
| `GET` | `/api/balances` | Global "who owes whom" (bilateral netting, cached 30s) |
| `POST` | `/api/direct-settle` | Record a direct settlement |
| `GET` | `/api/dashboard` | Cross-group + direct summary |
| `GET` | `/api/ledger` | Global ledger (all transactions) |
| `GET` | `/api/statement` | Exportable expense statement |
| `GET` | `/api/insights` | Personal spending insights data |

### Friends

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/friends` | List current user's friends |
| `DELETE` | `/api/friends/[friendId]` | Remove friendship (bidirectional) |
| `GET POST` | `/api/friends/invite` | Get / regenerate personal invite link |
| `GET POST` | `/api/friend-invite/[token]` | Public preview / accept friend invite |
| `GET POST` | `/api/friend-requests` | List pending requests / send a request |
| `PATCH DELETE` | `/api/friend-requests/[requestId]` | Accept or decline/cancel a request |

### Budgets & notifications

| Method | Path | Purpose |
|---|---|---|
| `GET POST` | `/api/budgets` | List / upsert per-category budgets |
| `POST` | `/api/budgets/total` | Calculate total monthly budget vs. actual spend |
| `GET PATCH` | `/api/notifications` | List notifications / mark as read |
| `POST DELETE` | `/api/notifications/subscribe` | Register / unregister push subscription |
| `GET` | `/api/notifications/vapid-public-key` | Return VAPID public key for push setup |

### Admin _(admin only)_

| Method | Path | Purpose |
|---|---|---|
| `GET PATCH` | `/api/admin/users` | List users (paginated/searchable) / ban, unban, promote, demote, edit, delete |
| `GET` | `/api/admin/audit` | Query audit log (filterable, paginated) |
| `GET` | `/api/admin/audit/export` | Export audit log as CSV |

---

## Data model

Key Prisma models (`prisma/schema.prisma`):

| Model | Key fields | Notes |
|---|---|---|
| `User` | `id` (UUID), `name`, `email`, `username` (unique), `usernameChangedAt`, `passwordHash`, `isAdmin`, `isOwner`, `isBanned`, `totalMonthlyBudget`, `budgetModel`, `allowPaymentRouting` | Core account |
| `Group` | `id` (cuid), `name`, `emoji`, `description`, `currency` (default INR), `ownerId`, `deletedAt` | Soft delete |
| `GroupMember` | `userId`, `groupId`, `role` (ADMIN/MEMBER) | `@@unique([userId, groupId])` |
| `GroupInvite` | `token`, `groupId`, `invitedById`, `expiresAt`, `usedAt` | Single-use, 7-day expiry |
| `Expense` | `id` (UUID), `groupId` (nullable = direct), `payerId`, `amount Decimal(12,2)`, `category`, `splitType`, `receiptUrl`, `deletedAt` | Soft delete |
| `ExpenseSplit` | `expenseId`, `userId`, `amount Decimal(12,2)` | `@@unique([expenseId, userId])` |
| `DirectParticipant` | `expenseId`, `userId` | Participants for null-groupId expenses |
| `Settlement` | `groupId` (nullable = direct), `senderId`, `receiverId`, `amount Decimal(12,2)` | |
| `Friendship` | `userId`, `friendId` | Bidirectional — stored as 2 rows |
| `FriendRequest` | `senderId`, `receiverId` | Pending request state |
| `FriendInvite` | `token` (`xxxx-xxxx-xxxx-xxxx`), `invitedById`, `expiresAt` | Reusable, 30-day, one per user |
| `PushSubscription` | `userId`, `endpoint`, `p256dh`, `auth` | VAPID Web Push data |
| `Notification` | `userId`, `type`, `title`, `body`, `url`, `read` | In-app inbox |
| `AuditLog` | `actorId`, `action`, `targetId`, `meta` (JSON), `ip`, `suspicious` | Indexed by actor, action, suspicious |
| `Budget` | `userId`, `category`, `amount Decimal(12,2)` | `@@unique([userId, category])` |

**Enums:** `Role` (ADMIN/MEMBER), `SplitType` (EQUAL/EXACT/PERCENTAGE/SHARES), `BudgetModel` (PERSONAL_SHARE/NET_PAYMENT), `ExpenseCategory` (FOOD/TRANSPORT/ACCOMMODATION/ENTERTAINMENT/SHOPPING/GROCERIES/UTILITIES/HEALTH/TRAVEL/OTHER)

All money is `Decimal(12,2)`; split math runs in integer cents.

---

## Project structure

```
app/
  page.tsx                             # Landing page
  (auth)/login, /register              # Auth pages (server) + client forms
  (legal)/terms, /privacy, /cookies, /guidelines
  (app)/
    dashboard/                         # Cross-group + direct summary
    groups/, /groups/[groupId]/        # Group list, detail, settings
    expenses/[expenseId]/              # Universal expense detail
    direct-expenses/                   # Non-group expense list + per-person view
    ledger/, /ledger/[userId]/         # Global + per-person balances
    friends/                           # Friends list + invite link
    budgets/                           # Per-category budget management
    insights/                          # Personal spending insights
    statement/                         # Exportable expense statement
    personal/                          # Personal direct expenses list
    profile/, /profile/settings/       # Account + push/payment settings
    admin/, /admin/audit/              # Admin panel + audit log viewer
    layout.tsx                         # App shell (sidebar + mobile nav + FAB)
  invite/[token]/                      # Group invite acceptance
  friend-invite/[token]/               # Friend invite (public preview + auth + join)
  api/                                 # See API reference

components/
  auth/          groups/       expenses/     balances/
  dashboard/     profile/      friends/      admin/
  fab/           nlp/          personal/     insights/
  ui/            (shared primitives: button, input, card, skeleton, etc.)

lib/
  auth.config.ts   auth.ts         prisma.ts       env.ts
  logger.ts        ids.ts          rate-limit.ts   api-error.ts
  splitEngine.ts   balances.ts     globalBalances.ts
  dashboard.ts     directExpenses.ts  expense-shape.ts
  notifications.ts push.ts         audit.ts
  budgets.ts       uploads.ts      categories.ts
  format.ts        anthropic.ts    auth-helpers.ts

prisma/
  schema.prisma    migrations/

scripts/
  test-split.ts    test-groups.mjs    test-dashboard.mjs
  test-receipts.mjs   test-ratelimit.mjs
  generate-icons.mjs

worker/
  index.js         # Custom SW additions: Web Push handler + notification-click routing

middleware.ts      # Auth guard + rate limiting + security logging
next.config.js     # next-pwa wrap + security headers
Dockerfile         docker-compose.yml
```

---

Built with Next.js · Open source · [avianage.in](https://avianage.in)
