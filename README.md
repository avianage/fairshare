# Fairshare

A self-hosted expense splitter for friends and groups.

## Tech Stack

- **Framework** — Next.js 14 (App Router, TypeScript)
- **Database** — PostgreSQL via Prisma 5
- **Auth** — NextAuth v5 (credentials, JWT strategy)
- **UI** — Tailwind CSS + shadcn/ui
- **Validation** — Zod + react-hook-form

## Features

### Authentication
- Email + password registration with real-time password strength indicator
- Secure login with generic error messages (no user enumeration)
- JWT-based sessions persisted in cookies
- Auto sign-in after registration → redirect to dashboard
- Protected routes via Edge-compatible middleware

### Security
- Passwords hashed with bcrypt (cost factor 12)
- Registration rate-limited to 5 attempts per IP per hour
- `NEXTAUTH_SECRET` required at startup — server throws if missing
- `passwordHash` never returned in any API response
- Middleware returns 401 JSON for API routes, redirect for pages

### App Shell
- Sidebar navigation + top nav
- Server-side session check on every protected layout (defense-in-depth)
- Sign out via server action

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database

### Setup

```bash
git clone https://github.com/avianage/fairshare.git
cd fairshare

npm install

cp .env.example .env
# Fill in DATABASE_URL and NEXTAUTH_SECRET
# Generate a secret: openssl rand -base64 32

npx prisma migrate dev --name init
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | JWT signing secret (required) |
| `NEXTAUTH_URL` | Public base URL (required in production) |

## Project Structure

```
app/
  (auth)/login        # Login page
  (auth)/register     # Register page
  (app)/dashboard     # Protected dashboard
  (app)/layout.tsx    # App shell (sidebar + nav)
  api/auth/           # NextAuth handler + register endpoint
components/
  auth/               # LoginForm, RegisterForm
  ui/                 # button, input, label, card
lib/
  auth.config.ts      # Edge-safe NextAuth config (middleware)
  auth.ts             # Full NextAuth config (server)
  prisma.ts           # Singleton Prisma client
prisma/
  schema.prisma       # Database schema
middleware.ts         # Route protection
```
