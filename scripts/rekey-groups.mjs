// One-off: rekey existing Group ids to the friendly xxxx-xxxx-xxxx-xxxx format.
// A primary-key change with FK references can't be a simple UPDATE, so per group
// we create the new row, repoint every child table, then delete the old row —
// all in a single transaction. Idempotent: groups already in the format are skipped.
//
//   node --env-file=.env scripts/rekey-groups.mjs
import { PrismaClient } from "@prisma/client"
import { randomUUID } from "crypto"

const prisma = new PrismaClient()
const genId = () => randomUUID()
const isFormatted = (id) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

const groups = await prisma.group.findMany()
let changed = 0

for (const g of groups) {
  if (isFormatted(g.id)) {
    console.log(`skip  "${g.name}" (already formatted: ${g.id})`)
    continue
  }
  const newId = genId()
  await prisma.$transaction(async (tx) => {
    await tx.group.create({
      data: {
        id: newId,
        name: g.name,
        emoji: g.emoji,
        description: g.description,
        currency: g.currency,
        createdAt: g.createdAt,
        deletedAt: g.deletedAt,
      },
    })
    await tx.groupMember.updateMany({ where: { groupId: g.id }, data: { groupId: newId } })
    await tx.groupInvite.updateMany({ where: { groupId: g.id }, data: { groupId: newId } })
    await tx.expense.updateMany({ where: { groupId: g.id }, data: { groupId: newId } })
    await tx.settlement.updateMany({ where: { groupId: g.id }, data: { groupId: newId } })
    await tx.group.delete({ where: { id: g.id } })
  })
  changed++
  console.log(`rekey "${g.name}": ${g.id}  ->  ${newId}`)
}

console.log(`\nDone. ${changed} group(s) rekeyed, ${groups.length - changed} already formatted.`)
await prisma.$disconnect()
