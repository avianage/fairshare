import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { ForbiddenError, requireGroupMember } from "@/lib/auth-helpers"
import { computeGroupBalances, type MemberInfo } from "@/lib/balances"

type Params = { params: Promise<{ groupId: string }> }

const UNKNOWN: MemberInfo = { id: "", name: "Unknown", avatar: null }

// GET /api/groups/[groupId]/ledger — simplified debts + per-member net balances.
export async function GET(_request: NextRequest, props: Params) {
  const params = await props.params;
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    await requireGroupMember(params.groupId, session.user.id)
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    throw e
  }

  const { simplified, net, members } = await computeGroupBalances(params.groupId)

  const debts = simplified.map((d) => ({
    from: members.get(d.fromUserId) ?? { ...UNKNOWN, id: d.fromUserId },
    to: members.get(d.toUserId) ?? { ...UNKNOWN, id: d.toUserId },
    amount: d.amount,
  }))

  const memberBalances = [...members.values()].map((user) => ({
    user: { id: user.id, name: user.name },
    netBalance: net[user.id] ?? 0,
  }))

  return NextResponse.json({
    debts,
    memberBalances,
    isSettledUp: debts.length === 0,
  })
}
