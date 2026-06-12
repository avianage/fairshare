import { PrismaClient } from "@prisma/client"
// Validate env at server startup (fail-fast). Side-effect import.
import "@/lib/env"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Never log raw queries — they can contain personal data, and the console is
    // visible to anyone watching the dev server / production logs. Errors only.
    log: ["error"],
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
