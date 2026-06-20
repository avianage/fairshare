import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
async function main() {
  const groups = await prisma.group.findMany({ select: { id: true, ownerId: true, name: true } })
  console.log(JSON.stringify(groups, null, 2))
  if (groups.some(g => !g.ownerId)) {
    console.log("Backfilling missing ownerIds...")
    for (const g of groups) {
      if (g.ownerId) continue
      const oldest = await prisma.groupMember.findFirst({
        where: { groupId: g.id, role: "ADMIN" },
        orderBy: { joinedAt: "asc" },
        select: { userId: true }
      })
      if (!oldest) { console.log("No admin for group", g.id); continue }
      await prisma.group.update({ where: { id: g.id }, data: { ownerId: oldest.userId } })
      console.log("Set ownerId =", oldest.userId, "for group", g.name)
    }
  }
}
main().catch(console.error).finally(() => prisma.$disconnect())
