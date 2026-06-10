# Fairshare — Phase-by-Phase Build Prompts + Security + Testing

---

## PHASE 0 — Scaffold + Auth Foundation

### The Prompt

```
I'm building a self-hosted expense splitter called Fairshare using:
- Next.js 14 App Router (TypeScript)
- Prisma + PostgreSQL
- NextAuth.js v5 (credentials provider only — no OAuth)
- Tailwind CSS + shadcn/ui
- bcryptjs for password hashing
- Zod for validation

Set up the complete auth foundation:

1. next.config.js — output: 'standalone', no extra config needed

2. lib/prisma.ts — singleton Prisma client (global cached instance for dev hot-reload)

3. lib/auth.ts — NextAuth v5 config:
   - credentials provider: email + password
   - on signIn: find user by email, compare password hash with bcryptjs
   - session strategy: jwt
   - session callback: add { id, name, email } to JWT token
   - pages: { signIn: '/login' }

4. app/api/auth/[...nextauth]/route.ts — export { GET, POST } from NextAuth handler

5. app/api/auth/register/route.ts — POST only:
   - Body: { name, email, password }
   - Zod schema: name min 2 chars, valid email, password min 8 chars with at least one number
   - Check if email already exists → 409
   - Hash with bcryptjs cost factor 12
   - Create user in DB
   - Return 201 { id, name, email } — never return passwordHash
   - Rate limit: max 5 registrations per IP per hour (use a simple in-memory Map for now)

6. middleware.ts:
   - Protect: /dashboard, /groups (all sub-routes), /profile, /api/groups, /api/dashboard, /api/invite (POST)
   - Public: /login, /register, /api/auth, /api/health, /invite (GET only)
   - Use NextAuth's auth() helper for session check
   - Redirect unauthenticated users to /login?callbackUrl=<original>
   - For API routes: return 401 JSON { error: 'Unauthorized' } instead of redirect

7. app/(auth)/login/page.tsx:
   - react-hook-form + zod validation
   - Show field-level errors
   - On submit: signIn('credentials', { email, password, callbackUrl })
   - Show generic error "Invalid email or password" on failure (never say which field is wrong)
   - Link to /register

8. app/(auth)/register/page.tsx:
   - Same form pattern
   - Password strength indicator (weak/ok/strong)
   - On success: auto sign-in and redirect to /dashboard

9. app/(app)/layout.tsx:
   - Server component that calls auth() and redirects to /login if no session
   - Renders sidebar + top nav shell

Security requirements baked in:
- Passwords hashed with bcrypt cost 12 (never stored plain)
- JWT secret from NEXTAUTH_SECRET env var — throw if missing
- Register rate limit per IP
- Never expose passwordHash in any response
- Generic auth error messages (no user enumeration)

Prisma schema for User model:
model User {
  id           String   @id @default(cuid())
  name         String
  email        String   @unique
  passwordHash String
  avatar       String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

---

### Security Checklist — Phase 0

- [ ] `NEXTAUTH_SECRET` is a 32+ byte random string (`openssl rand -base64 32`)
- [ ] `NEXTAUTH_SECRET` throws at startup if missing — never silently use a default
- [ ] bcrypt cost factor is **12** (not 10 or less)
- [ ] Register endpoint returns the same error for "email taken" and "validation error" (no enumeration)
- [ ] Login endpoint returns "Invalid email or password" for both wrong email AND wrong password
- [ ] `passwordHash` never appears in any API response, session, or log
- [ ] Middleware protects ALL `/api/groups/*` routes, not just the pages
- [ ] JWT tokens are httpOnly cookies (NextAuth default — verify this is not overridden)
- [ ] `NEXTAUTH_URL` matches your actual domain in production

### How to Test — Phase 0

**Manual tests:**
```bash
# Register a user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@test.com","password":"password123"}'
# Expect: 201 { id, name, email } — no passwordHash field

# Try duplicate email
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@test.com","password":"password123"}'
# Expect: 409

# Try weak password
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"b@test.com","password":"abc"}'
# Expect: 400 validation error

# Hit a protected API without a session
curl http://localhost:3000/api/groups
# Expect: 401 { error: 'Unauthorized' }

# Hit a protected page without a session
curl -I http://localhost:3000/dashboard
# Expect: 302 redirect to /login

# Verify password is hashed in DB
psql $DATABASE_URL -c "SELECT email, \"passwordHash\" FROM \"User\";"
# passwordHash must start with $2b$ (bcrypt)
```

**DB check:**
```sql
-- This must return 0 rows (no plain passwords)
SELECT * FROM "User" WHERE "passwordHash" NOT LIKE '$2b$%';
```

---

## PHASE 1 — Groups + Invite Links

### The Prompt

```
I'm building Fairshare (self-hosted expense splitter). Auth and Prisma are already set up.

Add the complete Groups feature:

1. app/api/groups/route.ts:
   - GET: return all groups where session user is a GroupMember
     - Include: member count, group emoji, name, currency, updatedAt
     - Sorted by updatedAt desc
     - NEVER return groups the user is not a member of
   - POST: create group
     - Body: { name, emoji?, description?, currency? }
     - Zod validation: name 2–50 chars, emoji optional single emoji, currency default 'INR'
     - Create Group + GroupMember (role: ADMIN) in a Prisma transaction
     - Return created group

2. app/api/groups/[groupId]/route.ts:
   - All routes: verify user is a member of groupId before doing anything — return 403 if not
   - GET: group detail with members array ({ id, name, email, avatar, role })
   - PATCH: update name/emoji/description — ADMIN only, 403 for MEMBER
   - DELETE: soft-delete (set deletedAt = now()) — ADMIN only

3. app/api/groups/[groupId]/members/[userId]/route.ts:
   - DELETE: remove member
     - ADMIN only
     - Cannot remove the last ADMIN
     - A user can always remove themselves (leave group)
     - Return 400 if trying to remove the last member entirely

4. app/api/groups/[groupId]/invite/route.ts:
   - POST: generate invite link
     - ADMIN only
     - Creates GroupInvite with unique token (cuid()), expires 7 days from now
     - Returns { inviteUrl: process.env.NEXTAUTH_URL + '/invite/' + token }
     - A group can have max 10 active (unused + non-expired) invites at once

5. app/api/invite/[token]/route.ts:
   - GET: validate token
     - Find invite where token matches, usedAt is null, expiresAt > now()
     - Return { groupName, inviterName } — nothing else
     - Return 404 for any invalid/expired/used token (no information leakage)
   - POST: accept invite
     - Session required (middleware handles this)
     - Same token validation as GET
     - Check user not already in group
     - Add user as MEMBER in a transaction + set invite.usedAt = now()
     - Return { groupId }

6. app/invite/[token]/page.tsx — invite acceptance page
7. app/(app)/groups/page.tsx — list all user's groups
8. app/(app)/groups/new/page.tsx — create group form
9. app/(app)/groups/[groupId]/page.tsx — group shell page (members sidebar + empty expense area)
10. app/(app)/groups/[groupId]/settings/page.tsx — rename, invite link generator, leave/delete group

Critical security requirement: Every single API route that touches a group MUST call this helper first:

// lib/auth-helpers.ts
export async function requireGroupMember(groupId: string, userId: string) {
  const member = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } }
  })
  if (!member) throw new Error('FORBIDDEN')
  return member
}

export async function requireGroupAdmin(groupId: string, userId: string) {
  const member = await requireGroupMember(groupId, userId)
  if (member.role !== 'ADMIN') throw new Error('FORBIDDEN')
  return member
}

Use these helpers at the top of every group API route before any DB operation.

Here is the full Prisma schema: [paste schema]
```

---

### Security Checklist — Phase 1

- [ ] **Every** group API route calls `requireGroupMember()` before touching any data
- [ ] Invite tokens use `cuid()` — unpredictable, not sequential IDs
- [ ] Expired and used invite tokens return 404 (same as invalid) — no distinction
- [ ] `GET /api/invite/[token]` returns only group name + inviter name — nothing else
- [ ] Group list only returns groups where the user is a member (no global group enumeration)
- [ ] Cannot remove the last ADMIN from a group
- [ ] Invite token URL is never logged (contains auth-equivalent token)
- [ ] Invite link generator requires ADMIN role
- [ ] Soft-deleted groups are excluded from all queries

### How to Test — Phase 1

**Manual tests:**
```bash
# Get session cookie first — login via browser and copy cookie
COOKIE="next-auth.session-token=..."

# Create a group
curl -X POST http://localhost:3000/api/groups \
  -H "Content-Type: application/json" \
  -H "Cookie: $COOKIE" \
  -d '{"name":"Goa Trip","emoji":"🏖️"}'

# Try to access another user's group (use a different user's groupId)
curl http://localhost:3000/api/groups/SOMEONE_ELSES_GROUP_ID \
  -H "Cookie: $COOKIE"
# Expect: 403

# Generate invite as non-admin (get a MEMBER cookie)
curl -X POST http://localhost:3000/api/groups/GROUP_ID/invite \
  -H "Cookie: $MEMBER_COOKIE"
# Expect: 403

# Try expired invite token
curl http://localhost:3000/api/invite/fake-token-123
# Expect: 404 (not "expired" — no information leakage)

# Try to use invite twice (use same token after it's been accepted)
curl -X POST http://localhost:3000/api/invite/USED_TOKEN \
  -H "Cookie: $COOKIE"
# Expect: 404
```

**DB checks:**
```sql
-- No groups returned for a non-member user (replace IDs)
SELECT g.* FROM "Group" g
JOIN "GroupMember" gm ON g.id = gm."groupId"
WHERE gm."userId" = 'USER_ID_A'
AND g.id = 'GROUP_OWNED_BY_USER_B';
-- Must return 0 rows

-- All invites must have expiry dates set
SELECT * FROM "GroupInvite" WHERE "expiresAt" IS NULL;
-- Must return 0 rows
```

---

## PHASE 2 — Expenses + Equal Split

### The Prompt

```
I'm building Fairshare. Groups and auth are done. Add expenses with equal splitting.

1. lib/splitEngine.ts — the core math module:

export type SplitResult = Record<string, number>  // userId → amount owed

export function calculateEqualSplit(totalAmount: number, memberIds: string[]): SplitResult {
  const result: SplitResult = {}
  const base = Math.floor((totalAmount * 100) / memberIds.length) / 100
  const remainder = Math.round((totalAmount - base * memberIds.length) * 100) / 100
  for (const id of memberIds) result[id] = base
  result[memberIds[0]] += remainder  // give remainder to first member (typically payer)
  return result
}

// (also include EXACT, PERCENTAGE, SHARES — we'll use them in Phase 4)

2. app/api/groups/[groupId]/expenses/route.ts:
   - All routes: call requireGroupMember() first
   - GET: paginated expenses
     - Query params: ?page=1&limit=20&category=FOOD
     - Exclude soft-deleted (deletedAt IS NOT NULL)
     - Include: payer { id, name, avatar }, splits [{ user { id, name }, amount }]
     - Sorted by date desc
     - Return { expenses, total, page, totalPages }
   - POST: create expense
     - Body: { description, amount, payerId, date?, category?, notes?, memberIds }
     - Validate: amount > 0, amount <= 999999.99, description max 100 chars
     - Validate payerId is a member of the group
     - Validate all memberIds are members of the group
     - Default memberIds to all group members if not provided
     - Compute equal splits via calculateEqualSplit()
     - Insert Expense + ExpenseSplit rows in a Prisma transaction
     - Return full expense with splits

3. app/api/groups/[groupId]/expenses/[expenseId]/route.ts:
   - GET: single expense detail
   - PATCH: edit description, amount, notes, category
     - Require: user is the payer OR group admin
     - If amount changes: delete old splits, recompute, insert new splits — in a transaction
   - DELETE: soft delete (set deletedAt = now())
     - Require: user is the payer OR group admin

4. components/expenses/ExpenseCard.tsx — shows description, payer, amount, date, category icon, per-person split
5. components/expenses/ExpenseForm.tsx — for equal split only (Phase 4 adds the rest):
   - Fields: description, amount, paid by (select), date, category, notes (optional)
   - Paid by defaults to current user
   - Shows "Split equally among all N members"
6. app/(app)/groups/[groupId]/page.tsx — update to show expense list + AddExpense button

Security:
- Validate payerId and ALL memberIds are actual members of the group (not just any user ID)
- amount must be Decimal, stored as Decimal(12,2) — never float arithmetic server-side
- Use Prisma Decimal type, convert to number only for JSON response
- deletedAt check must be in EVERY expense query — never show deleted expenses

Here is the Prisma schema and splitEngine.ts: [paste both]
```

---

### Security Checklist — Phase 2

- [ ] `payerId` is validated as an actual member of the group — not just any user ID
- [ ] All `memberIds` in a split are validated as group members
- [ ] Amount is stored as `Decimal(12,2)` — never `float`
- [ ] Amount is validated server-side: > 0, ≤ 999999.99
- [ ] `description` is sanitised — max 100 chars, Zod `.trim()`
- [ ] Soft-deleted expenses excluded from ALL queries via `where: { deletedAt: null }`
- [ ] Edit/delete expense checks that user is payer OR admin — not just any group member
- [ ] Split recalculation on edit is done in a transaction (no partial state)

### How to Test — Phase 2

```bash
# Create an expense
curl -X POST http://localhost:3000/api/groups/GROUP_ID/expenses \
  -H "Content-Type: application/json" \
  -H "Cookie: $COOKIE" \
  -d '{"description":"Dinner","amount":1200,"payerId":"USER_ID"}'
# Expect: 201 with splits array (4 members = 300 each)

# Verify split amounts add up exactly
node -e "
const splits = [300, 300, 300, 300]; // from response
const total = splits.reduce((a,b)=>a+b,0);
console.assert(total === 1200, 'Split sum mismatch: ' + total);
console.log('Split sum:', total);
"

# Try to add expense with a non-member as payerId
curl -X POST http://localhost:3000/api/groups/GROUP_ID/expenses \
  -H "Content-Type: application/json" \
  -H "Cookie: $COOKIE" \
  -d '{"description":"Test","amount":100,"payerId":"RANDOM_USER_ID_NOT_IN_GROUP"}'
# Expect: 400

# Try to edit someone else's expense (as non-admin member)
curl -X PATCH http://localhost:3000/api/groups/GROUP_ID/expenses/EXPENSE_ID \
  -H "Content-Type: application/json" \
  -H "Cookie: $OTHER_MEMBERS_COOKIE" \
  -d '{"amount":9999}'
# Expect: 403

# Try to access a deleted expense
# First delete it, then try to fetch
curl -X DELETE http://localhost:3000/api/groups/GROUP_ID/expenses/EXPENSE_ID \
  -H "Cookie: $COOKIE"
curl http://localhost:3000/api/groups/GROUP_ID/expenses/EXPENSE_ID \
  -H "Cookie: $COOKIE"
# Expect: 404
```

**Split math verification:**
```sql
-- For each expense, sum of splits must equal expense amount
SELECT
  e.id,
  e.amount AS expense_amount,
  SUM(es.amount) AS split_sum,
  e.amount - SUM(es.amount) AS diff
FROM "Expense" e
JOIN "ExpenseSplit" es ON es."expenseId" = e.id
WHERE e."deletedAt" IS NULL
GROUP BY e.id, e.amount
HAVING ABS(e.amount - SUM(es.amount)) > 0.01;
-- Must return 0 rows (all splits balanced)
```

---

## PHASE 3 — Balances + Settle Up

### The Prompt

```
I'm building Fairshare. Add the debt calculation and settle-up feature.

1. lib/splitEngine.ts — add to existing file:

export type RawDebt = { fromUserId: string; toUserId: string; amount: number }
export type SimplifiedDebt = { fromUserId: string; toUserId: string; amount: number }

export function buildRawDebts(
  expenses: Array<{ payerId: string; splits: Array<{ userId: string; amount: number }> }>
): RawDebt[] {
  return expenses.flatMap(expense =>
    expense.splits
      .filter(s => s.userId !== expense.payerId)
      .map(s => ({ fromUserId: s.userId, toUserId: expense.payerId, amount: Number(s.amount) }))
  )
}

export function simplifyDebts(debts: RawDebt[]): SimplifiedDebt[] {
  const net = new Map<string, number>()
  for (const { fromUserId, toUserId, amount } of debts) {
    net.set(fromUserId, (net.get(fromUserId) ?? 0) - amount)
    net.set(toUserId,   (net.get(toUserId)   ?? 0) + amount)
  }
  const creditors = [...net.entries()].filter(([,b]) => b > 0.01).map(([userId, balance]) => ({ userId, balance }))
  const debtors   = [...net.entries()].filter(([,b]) => b < -0.01).map(([userId, balance]) => ({ userId, balance: -balance }))
  creditors.sort((a,b) => b.balance - a.balance)
  debtors.sort((a,b) => b.balance - a.balance)
  const result: SimplifiedDebt[] = []
  let i = 0, j = 0
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].balance, creditors[j].balance)
    if (pay > 0.01) result.push({ fromUserId: debtors[i].userId, toUserId: creditors[j].userId, amount: Math.round(pay * 100) / 100 })
    debtors[i].balance -= pay; creditors[j].balance -= pay
    if (debtors[i].balance < 0.01) i++
    if (creditors[j].balance < 0.01) j++
  }
  return result
}

2. app/api/groups/[groupId]/balances/route.ts — GET:
   - requireGroupMember() first
   - Fetch all non-deleted expenses with splits
   - Fetch all settlements for the group
   - Build raw debts from expenses
   - Subtract settlement amounts: for each settlement, add a synthetic "reverse debt" from receiver to sender
   - Run simplifyDebts() on combined array
   - Return:
     {
       debts: [{ from: { id, name, avatar }, to: { id, name, avatar }, amount }],
       memberBalances: [{ user: { id, name }, netBalance: number }],
       isSettledUp: boolean
     }
   - isSettledUp = debts.length === 0

3. app/api/groups/[groupId]/settle/route.ts — POST:
   - requireGroupMember() first
   - Body: { senderId, receiverId, amount, note? }
   - Validate: senderId and receiverId are both members of the group
   - Validate: senderId !== receiverId
   - Validate: amount > 0
   - Validate: the sender has an actual debt to the receiver (use balances logic)
   - Insert Settlement record
   - Return settlement with sender and receiver names

4. components/balances/BalanceSummary.tsx:
   - Shows "You owe [name] ₹X" in orange for debts you owe
   - Shows "[name] owes you ₹X" in green for debts owed to you
   - "Settle up" button on each debt row
   - Shows "All settled up! 🎉" when isSettledUp = true

5. components/balances/SettleUpModal.tsx:
   - Pre-filled with suggested amount (from balance), user can edit
   - Optional note
   - Confirm button → POST /api/groups/:id/settle
   - On success: refetch balances

Security:
- Validate senderId and receiverId are members — never accept arbitrary user IDs
- The settlement amount should not exceed the actual debt (optional but good UX guard)
- Never let someone record a settlement on behalf of another person (senderId must be session user or admin)
```

---

### Security Checklist — Phase 3

- [ ] `senderId` must be the session user (or admin) — a member cannot settle on behalf of someone else
- [ ] Both `senderId` and `receiverId` are validated as group members
- [ ] `senderId !== receiverId` (no self-settlements)
- [ ] Settlement amount > 0
- [ ] Balance computation excludes soft-deleted expenses
- [ ] Settlements are additive and never delete/mutate existing expense data

### How to Test — Phase 3

```bash
# Get balances for a group
curl http://localhost:3000/api/groups/GROUP_ID/balances \
  -H "Cookie: $COOKIE"
# Expect: { debts: [...], memberBalances: [...], isSettledUp: false }

# Record a settlement
curl -X POST http://localhost:3000/api/groups/GROUP_ID/settle \
  -H "Content-Type: application/json" \
  -H "Cookie: $COOKIE" \
  -d '{"senderId":"USER_A","receiverId":"USER_B","amount":300}'
# Expect: 201 with settlement record

# Check balances again — should reflect the settlement
curl http://localhost:3000/api/groups/GROUP_ID/balances \
  -H "Cookie: $COOKIE"
# Expect: debts reduced by 300

# Try settling as someone else (senderId != session user, non-admin)
curl -X POST http://localhost:3000/api/groups/GROUP_ID/settle \
  -H "Content-Type: application/json" \
  -H "Cookie: $MEMBER_COOKIE" \
  -d '{"senderId":"DIFFERENT_USER_ID","receiverId":"USER_B","amount":300}'
# Expect: 403
```

**Math verification test (write this as a unit test):**
```typescript
// __tests__/splitEngine.test.ts
import { simplifyDebts, buildRawDebts } from '../lib/splitEngine'

test('simplifyDebts produces minimum transactions', () => {
  // A paid 300, B paid 300, C paid nothing — in a 3-person equal split of 600
  const debts = [
    { fromUserId: 'C', toUserId: 'A', amount: 100 },
    { fromUserId: 'C', toUserId: 'B', amount: 100 },
    { fromUserId: 'B', toUserId: 'A', amount: 100 },
  ]
  const result = simplifyDebts(debts)
  // C owes 200 total (100 to A, 100 to B — but simplified)
  const total = result.reduce((sum, d) => sum + d.amount, 0)
  expect(total).toBe(200)
})

test('net balances sum to zero', () => {
  const rawDebts = [
    { fromUserId: 'B', toUserId: 'A', amount: 300 },
    { fromUserId: 'C', toUserId: 'A', amount: 300 },
    { fromUserId: 'A', toUserId: 'B', amount: 200 },
  ]
  const simplified = simplifyDebts(rawDebts)
  // In any valid simplification, total owed = total received
  const totalOwed = simplified.reduce((s, d) => s + d.amount, 0)
  expect(totalOwed).toBeGreaterThanOrEqual(0)
})

test('self-splits are excluded', () => {
  const expenses = [{
    payerId: 'A',
    splits: [
      { userId: 'A', amount: 300 },  // payer's own split — should be excluded
      { userId: 'B', amount: 300 },
    ]
  }]
  const raw = buildRawDebts(expenses)
  expect(raw.every(d => d.fromUserId !== d.toUserId)).toBe(true)
  expect(raw.length).toBe(1)  // only B owes A
})
```

---

## PHASE 4 — Advanced Split Types

### The Prompt

```
I'm building Fairshare. Add support for EXACT, PERCENTAGE, and SHARES split types.

1. Complete lib/splitEngine.ts with all split types:

export type SplitType = 'EQUAL' | 'EXACT' | 'PERCENTAGE' | 'SHARES'

export type SplitInput = {
  type: SplitType
  totalAmount: number
  memberIds: string[]
  values?: Record<string, number>  // per-user: exact amount / percentage / share count
}

export function calculateSplits(input: SplitInput): SplitResult {
  const { type, totalAmount, memberIds, values = {} } = input

  if (type === 'EQUAL') return calculateEqualSplit(totalAmount, memberIds)

  if (type === 'EXACT') {
    // Validate sum == totalAmount (caller must validate, but also guard here)
    const sum = Object.values(values).reduce((a, b) => a + b, 0)
    if (Math.abs(sum - totalAmount) > 0.01) throw new Error('EXACT splits must sum to total amount')
    return Object.fromEntries(memberIds.map(id => [id, values[id] ?? 0]))
  }

  if (type === 'PERCENTAGE') {
    const sum = Object.values(values).reduce((a, b) => a + b, 0)
    if (Math.abs(sum - 100) > 0.01) throw new Error('Percentages must sum to 100')
    const result: SplitResult = {}
    for (const id of memberIds) {
      result[id] = Math.round((values[id] / 100) * totalAmount * 100) / 100
    }
    // Fix rounding remainder
    const total = Object.values(result).reduce((a, b) => a + b, 0)
    const diff = Math.round((totalAmount - total) * 100) / 100
    if (Math.abs(diff) > 0) result[memberIds[0]] = Math.round((result[memberIds[0]] + diff) * 100) / 100
    return result
  }

  if (type === 'SHARES') {
    const totalShares = Object.values(values).reduce((a, b) => a + b, 0)
    if (totalShares === 0) throw new Error('Total shares cannot be zero')
    const result: SplitResult = {}
    for (const id of memberIds) {
      result[id] = Math.round(((values[id] ?? 1) / totalShares) * totalAmount * 100) / 100
    }
    const total = Object.values(result).reduce((a, b) => a + b, 0)
    const diff = Math.round((totalAmount - total) * 100) / 100
    if (Math.abs(diff) > 0) result[memberIds[0]] = Math.round((result[memberIds[0]] + diff) * 100) / 100
    return result
  }

  throw new Error('Invalid split type')
}

2. Update the POST expense API to use calculateSplits() with the provided splitType and values
   Validation rules per split type (server-side, Zod):
   - EXACT: values must be provided for all memberIds, sum must equal amount
   - PERCENTAGE: values must be provided for all memberIds, sum must equal 100
   - SHARES: values (share counts) must be positive integers

3. components/expenses/SplitTypeSelector.tsx:
   Tab UI with 4 tabs: Equal | Exact | % | Shares

   - Equal: just shows "Split equally among N people"
   - Exact: per-member number inputs. Shows running total below. Red if total ≠ expense amount.
   - Percentage: per-member % inputs. Shows computed amount below each. Red if total ≠ 100.
   - Shares: per-member integer inputs (default 1). Shows computed amount below each live.
   
   All computed amounts update live as user types (no submit needed).
   Show a summary line: "Remaining to allocate: ₹X" for Exact, "Remaining: X%" for Percentage.

4. Update ExpenseForm.tsx to include SplitTypeSelector.
   Submit sends: { ..., splitType, values: { userId: value } }

Server-side validation must catch any manipulation of values from the client.
Never trust client-computed split amounts — always recompute server-side.
```

---

### Security Checklist — Phase 4

- [ ] Split amounts are **always recomputed server-side** — client values are ignored
- [ ] EXACT: server validates sum of values equals total amount (within 0.01)
- [ ] PERCENTAGE: server validates sum equals 100 (within 0.01)
- [ ] SHARES: values are positive integers only
- [ ] All member IDs in `values` are validated as group members
- [ ] Rounding errors are handled deterministically (always adjust first member)
- [ ] No split results in a negative amount for any member

### How to Test — Phase 4

```bash
# EQUAL split — 4 people, 1001 (non-divisible)
curl -X POST http://localhost:3000/api/groups/GROUP_ID/expenses \
  -H "Content-Type: application/json" \
  -H "Cookie: $COOKIE" \
  -d '{"description":"Odd amount","amount":1001,"payerId":"A","splitType":"EQUAL","memberIds":["A","B","C","D"]}'
# Splits should be: [250.25, 250.25, 250.25, 250.25] summing to 1001
# OR [250.25, 250.25, 250.25, 250.25] — verify sum = 1001

# PERCENTAGE — try to pass values that don't sum to 100
curl -X POST http://localhost:3000/api/groups/GROUP_ID/expenses \
  -H "Content-Type: application/json" \
  -H "Cookie: $COOKIE" \
  -d '{"description":"Bad split","amount":1000,"payerId":"A","splitType":"PERCENTAGE","values":{"A":60,"B":60}}'
# Expect: 400 validation error

# Try to inject a non-member userId into values
curl -X POST http://localhost:3000/api/groups/GROUP_ID/expenses \
  -H "Content-Type: application/json" \
  -H "Cookie: $COOKIE" \
  -d '{"description":"Injection","amount":100,"payerId":"A","splitType":"EXACT","values":{"FAKE_USER_ID":100}}'
# Expect: 400 (FAKE_USER_ID is not a group member)
```

**Unit tests:**
```typescript
test('EQUAL split with non-divisible amount sums correctly', () => {
  const result = calculateSplits({ type: 'EQUAL', totalAmount: 1001, memberIds: ['A','B','C','D'] })
  const sum = Object.values(result).reduce((a, b) => a + b, 0)
  expect(sum).toBe(1001)
})

test('PERCENTAGE splits sum to total amount', () => {
  const result = calculateSplits({
    type: 'PERCENTAGE', totalAmount: 1000, memberIds: ['A','B','C'],
    values: { A: 33.33, B: 33.33, C: 33.34 }
  })
  const sum = Object.values(result).reduce((a, b) => a + b, 0)
  expect(Math.abs(sum - 1000)).toBeLessThan(0.01)
})

test('throws if EXACT values do not sum to total', () => {
  expect(() => calculateSplits({
    type: 'EXACT', totalAmount: 100, memberIds: ['A','B'],
    values: { A: 60, B: 60 }  // sums to 120, not 100
  })).toThrow()
})
```

---

## PHASE 5 — Dashboard + Global Balances

### The Prompt

```
I'm building Fairshare. Add the global dashboard showing balances across all groups.

1. app/api/dashboard/route.ts — GET:
   - requireAuth (middleware handles, just get session)
   - For each group the user is a member of:
     - Compute user's net balance in that group
     - (net = what others owe user minus what user owes others)
   - Aggregate to a single global figure
   - Fetch last 10 expense + settlement activity across all user's groups
   - Return:
     {
       totalOwed: number,      // sum of positive balances (others owe you)
       totalOwing: number,     // sum of negative balances (you owe others, as positive number)
       netBalance: number,     // totalOwed - totalOwing
       groups: [{
         id, name, emoji, memberCount, userBalance, lastActivityAt
       }],
       recentActivity: [{
         type: 'expense' | 'settlement',
         groupName,
         description,
         amount,
         date,
         involvedUsers: [{ name }]
       }]
     }

2. app/(app)/dashboard/page.tsx — server component:
   - Fetch /api/dashboard
   - Show 3 summary cards: Total Owed To You | Total You Owe | Net Balance
   - Show group cards grid
   - Show recent activity feed

3. Security: This endpoint touches all groups for the user.
   - Only return groups the user is actually a member of
   - Net balance must be computed correctly — test against per-group balance endpoint
   - Recent activity must not include activity from groups the user is no longer a member of

4. components/dashboard/SummaryCards.tsx — three metric cards
5. components/dashboard/ActivityFeed.tsx — list of recent expense/settlement events
```

---

### Security Checklist — Phase 5

- [ ] Dashboard only returns data from groups the user is a member of
- [ ] Recent activity feed excludes groups the user has left
- [ ] Net balance is verified to match per-group balance endpoint totals
- [ ] No other user's personal balance details are leaked

### How to Test — Phase 5

```bash
# Get dashboard
curl http://localhost:3000/api/dashboard \
  -H "Cookie: $COOKIE"
# Verify: totalOwing + totalOwed reflect group balances

# Cross-check: sum of per-group balances = dashboard total
# For each group, get /api/groups/:id/balances and sum user's netBalance
# Must equal dashboard netBalance within 0.01
```

---

## PHASE 6 — Polish + Receipt Upload

### The Prompt

```
I'm building Fairshare. Add receipt uploads and general UX polish.

1. app/api/groups/[groupId]/expenses/[expenseId]/receipt/route.ts:
   - POST: upload receipt image
     - requireGroupMember() AND must be expense payer or group admin
     - Accept: image/jpeg, image/png, image/webp only — reject all other MIME types
     - Max file size: 5MB
     - Save to UPLOAD_DIR (from env) with a random filename: crypto.randomUUID() + extension
     - Never use the original filename from the client
     - Update expense.receiptUrl with the server path
     - Return { receiptUrl: '/api/uploads/' + filename }
   - DELETE: remove receipt (same auth check)

2. app/api/uploads/[filename]/route.ts:
   - GET: serve the file
   - requireAuth: only authenticated users can view receipts
   - Validate filename: alphanumeric + hyphens + dot + extension only (no path traversal)
   - Verify the file exists in UPLOAD_DIR (no directory traversal attacks)
   - Set Content-Type header from extension
   - Set Cache-Control: private, max-age=3600

3. General polish:
   - Toast notifications (sonner or react-hot-toast) on all success/error operations
   - Loading skeletons for group list, expense list, balance summary
   - Empty states with action prompts
   - Confirm dialogs for: delete expense, remove member, leave group
   - Mobile-responsive layout (tested at 375px width)
   - Currency formatting: always ₹, Indian number system (1,00,000 not 100,000)
   - Relative time display ("2 hours ago", "yesterday")

Security for uploads:
- NEVER use client-provided filename
- Validate MIME type server-side (don't trust Content-Type header — read magic bytes)
- Store files outside the web root (UPLOAD_DIR should not be publicly accessible directly)
- Validate filename in the serve route: /^[a-f0-9\-]{36}\.(jpg|jpeg|png|webp)$/ only
- Only serve files to authenticated users who are members of the expense's group
```

---

### Security Checklist — Phase 6

- [ ] File upload rejects non-image MIME types server-side (magic bytes check, not just Content-Type)
- [ ] Uploaded filename is always `randomUUID()` + extension — never client filename
- [ ] Serve route validates filename with a strict regex (prevents path traversal: `../../etc/passwd`)
- [ ] Receipt files only served to authenticated users
- [ ] `UPLOAD_DIR` is a Docker volume — not inside `/app` or a public directory
- [ ] 5MB file size limit enforced before writing to disk
- [ ] File extension is validated against allowed list: jpg, jpeg, png, webp only

### How to Test — Phase 6

```bash
# Try path traversal in filename
curl http://localhost:3000/api/uploads/../../../etc/passwd \
  -H "Cookie: $COOKIE"
# Expect: 400 (invalid filename)

# Try uploading a non-image
curl -X POST http://localhost:3000/api/groups/GROUP_ID/expenses/EXP_ID/receipt \
  -H "Cookie: $COOKIE" \
  -F "file=@malicious.html;type=text/html"
# Expect: 400 (invalid file type)

# Try uploading a file disguised as image (wrong magic bytes)
# Create a text file with .jpg extension
echo "I am not an image" > fake.jpg
curl -X POST http://localhost:3000/api/groups/GROUP_ID/expenses/EXP_ID/receipt \
  -H "Cookie: $COOKIE" \
  -F "file=@fake.jpg;type=image/jpeg"
# Expect: 400 (magic bytes don't match JPEG)

# Try accessing receipt without auth
curl http://localhost:3000/api/uploads/SOME_FILE.jpg
# Expect: 401
```

---

## PHASE 7 — Production Hardening

### The Prompt

```
I'm building Fairshare. Harden it for production deployment on Coolify.

1. app/api/health/route.ts — GET:
   - Try a simple Prisma query: prisma.$queryRaw`SELECT 1`
   - Return 200 { status: 'ok', db: 'connected', version: process.env.APP_VERSION ?? 'unknown' }
   - Return 503 { status: 'error', db: 'disconnected' } if DB query fails
   - No auth required on this endpoint

2. Rate limiting middleware (lib/rate-limit.ts):
   - In-memory sliding window, keyed by IP
   - Apply to: /api/auth/register (5/hour), /api/auth/signin (10/hour), all other API routes (100/hour)
   - Return 429 { error: 'Too many requests', retryAfter: N } when exceeded
   - Use X-Forwarded-For header (Coolify / Nginx sets this) with fallback to req.ip
   - Integrate into middleware.ts

3. Security headers (next.config.js):
   Add these headers to all responses:
   - X-Frame-Options: DENY
   - X-Content-Type-Options: nosniff
   - Referrer-Policy: strict-origin-when-cross-origin
   - Permissions-Policy: camera=(), microphone=(), geolocation=()
   - Content-Security-Policy:
       default-src 'self';
       script-src 'self' 'unsafe-inline';  (needed for Next.js)
       style-src 'self' 'unsafe-inline';
       img-src 'self' data: blob:;
       connect-src 'self';
       frame-ancestors 'none'

4. Input sanitisation audit — review all API routes:
   - All string inputs go through Zod .trim() and max length limits
   - description: max 100 chars
   - name: max 50 chars
   - notes: max 500 chars
   - emoji: max 2 chars (single emoji)
   - No raw SQL anywhere — Prisma parameterised queries only

5. Database indexes (add to schema.prisma):
   @@index([groupId]) on GroupMember
   @@index([groupId, deletedAt]) on Expense
   @@index([expenseId]) on ExpenseSplit
   @@index([groupId]) on Settlement
   @@index([token]) on GroupInvite (unique already, but confirm index exists)

6. Prisma migrations for production:
   - Dockerfile CMD: sh -c "npx prisma migrate deploy && node server.js"
   - Never run prisma migrate dev in production

7. Environment variable validation (lib/env.ts):
   - Use Zod to validate all env vars at startup
   - Required: DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, UPLOAD_DIR
   - NEXTAUTH_SECRET must be >= 32 chars
   - Throw with a clear error message if any are missing — fail fast

8. Logging:
   - Log all 4xx and 5xx responses with: method, path, status, userId (if authenticated), timestamp
   - Never log: passwords, tokens, session data, file contents
   - Use console.error for errors (Coolify captures stdout/stderr)
```

---

### Security Checklist — Phase 7

- [ ] Health endpoint returns 503 (not 500) when DB is down — load balancers need this
- [ ] Rate limiting is on auth routes (register + login) specifically
- [ ] `X-Frame-Options: DENY` prevents clickjacking
- [ ] `X-Content-Type-Options: nosniff` prevents MIME sniffing attacks
- [ ] CSP header blocks inline scripts except Next.js requirements
- [ ] All env vars validated at startup — app refuses to start with missing config
- [ ] `NEXTAUTH_SECRET` minimum 32 characters enforced at startup
- [ ] No `prisma migrate dev` in production Dockerfile
- [ ] Database indexes on all foreign keys used in WHERE clauses
- [ ] No raw SQL anywhere in the codebase (`grep -r "prisma\.\$queryRaw" --include="*.ts"` should return only the health check)

### How to Test — Phase 7

```bash
# Health check
curl http://localhost:3000/api/health
# Expect: 200 { status: 'ok', db: 'connected' }

# Verify security headers
curl -I http://localhost:3000
# Must include:
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
# Referrer-Policy: strict-origin-when-cross-origin

# Rate limit test — hit login 11 times rapidly
for i in {1..11}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST http://localhost:3000/api/auth/signin \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}'
done
# 11th request should return 429

# Test startup with missing env var
NEXTAUTH_SECRET="" node server.js
# Expect: process exits with error message about missing NEXTAUTH_SECRET

# Docker build test
docker build -t fairshare . && echo "Build OK"

# Full stack test
docker-compose up -d
sleep 5
curl http://localhost:3000/api/health
docker-compose down
```

---

## PHASE 8 — PWA (Installable on Phone)

### The Prompt

```
I'm building Fairshare. Make it a PWA so friends can install it on their phones.

1. Install next-pwa: npm install next-pwa

2. next.config.js — wrap with withPWA:
   const withPWA = require('next-pwa')({ dest: 'public', disable: process.env.NODE_ENV === 'development' })
   module.exports = withPWA({ output: 'standalone', /* existing config */ })

3. public/manifest.json:
   {
     "name": "Fairshare",
     "short_name": "Fairshare",
     "description": "Expense splitting for friends",
     "start_url": "/dashboard",
     "display": "standalone",
     "background_color": "#ffffff",
     "theme_color": "#0f172a",
     "icons": [
       { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
       { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
     ]
   }

4. app/layout.tsx — add to <head>:
   <link rel="manifest" href="/manifest.json" />
   <meta name="theme-color" content="#0f172a" />
   <meta name="mobile-web-app-capable" content="yes" />
   <meta name="apple-mobile-web-app-capable" content="yes" />
   <meta name="apple-mobile-web-app-status-bar-style" content="default" />

5. Service worker caches:
   - App shell: /, /dashboard, /login, /_next/static/**
   - API responses: /api/dashboard (stale-while-revalidate, 5 min)
   - Do NOT cache: /api/groups/*/expenses (POST), /api/*/settle (POST) — mutations must go through

6. components/InstallPrompt.tsx:
   - Listen for beforeinstallprompt event
   - Only show after user has visited twice (store count in localStorage)
   - "Add Fairshare to your home screen" banner at the bottom
   - "Install" button → prompt.prompt()
   - "Not now" dismisses for 7 days

Security for PWA:
- Service worker scope must be limited to the app's origin
- Cache must not store authentication tokens or sensitive user data
- Only cache GET requests — never cache POST/PATCH/DELETE
- Clear cache on logout (call caches.delete() in signOut handler)
```

---

### How to Test — Phase 8

```bash
# Run Lighthouse PWA audit
npx lighthouse http://localhost:3000 --only-categories=pwa --output=json | \
  node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin')); console.log('PWA score:', d.categories.pwa.score * 100)"
# Aim for >= 90

# Check manifest is valid
curl http://localhost:3000/manifest.json | python3 -m json.tool

# Check service worker is registered
# In Chrome DevTools → Application → Service Workers
# Should show fairshare's SW registered and active

# Test offline: disable network in DevTools → visit /dashboard
# Should show cached version (or offline fallback), not blank page
```

---

## CROSS-CUTTING SECURITY — Things to Do Before Going Live

### Code audit checklist

```bash
# 1. Find any console.log that might leak sensitive data
grep -r "console.log" app/ lib/ --include="*.ts" --include="*.tsx" | grep -i "password\|token\|secret\|hash"
# Must return 0 results

# 2. Find any raw SQL (should only be the health check)
grep -rn "\$queryRaw\|\$executeRaw" app/ lib/ --include="*.ts"
# Should only show health check

# 3. Find any TODO/FIXME security items
grep -rn "TODO\|FIXME\|HACK\|XXX" app/ lib/ --include="*.ts" | grep -i "auth\|security\|fix"

# 4. Check no .env file is committed
git log --all --full-history -- "*.env" "**/.env"
# Must return 0 results (add .env to .gitignore)

# 5. Check for hardcoded secrets
grep -rn "secret\|password\|key" app/ lib/ --include="*.ts" | grep -v "NEXTAUTH_SECRET\|passwordHash\|requireGroupAdmin"
# Review any results manually
```

### Nginx config (in front of Coolify)

```nginx
server {
    listen 443 ssl http2;
    server_name fairshare.yourdomain.com;

    # SSL (managed by Cert Manager / NPM)
    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    # Size limits (also enforced in Next.js)
    client_max_body_size 6M;

    # Don't leak server version
    server_tokens off;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name fairshare.yourdomain.com;
    return 301 https://$host$request_uri;
}
```

### PostgreSQL hardening

```sql
-- Create a restricted DB user for the app (don't use postgres superuser)
CREATE USER fairshare_app WITH PASSWORD 'strong-random-password';
GRANT CONNECT ON DATABASE fairshare TO fairshare_app;
GRANT USAGE ON SCHEMA public TO fairshare_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO fairshare_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO fairshare_app;
-- Revoke ability to drop tables
REVOKE CREATE ON SCHEMA public FROM fairshare_app;
```

---

## RUNNING ALL TESTS

```bash
# Install test deps (if not already)
npm install --save-dev jest @types/jest ts-jest

# Run unit tests
npx jest

# Run type checking
npx tsc --noEmit

# Run linting
npx eslint app/ lib/ --ext .ts,.tsx

# Full pre-deploy check
npm run build && echo "Build OK" || echo "Build FAILED"
```

