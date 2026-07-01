import NextAuth from "next-auth"
import type { JWT } from "next-auth/jwt"
import Credentials from "next-auth/providers/credentials"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { authConfig } from "@/lib/auth.config"
import { prisma } from "@/lib/prisma"
import { auditLog, getClientIp } from "@/lib/audit"

const credentialsSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
})

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      const t = token as JWT
      if (user) {
        t.id = user.id
        t.isAdmin = (user as { isAdmin?: boolean }).isAdmin ?? false
        t.isOwner = (user as { isOwner?: boolean }).isOwner ?? false
        t.isBanned = (user as { isBanned?: boolean }).isBanned ?? false
        t.refreshedAt = Date.now()
        return t
      }

      // Re-sync role/ban flags from the DB periodically so admin promotions,
      // demotions, and bans — all done out-of-band by someone else — take
      // effect without forcing the affected user to log out and back in.
      const REFRESH_INTERVAL_MS = 60_000
      if (t.id && Date.now() - (t.refreshedAt ?? 0) > REFRESH_INTERVAL_MS) {
        const dbUser = await prisma.user.findUnique({
          where: { id: t.id },
          select: { isAdmin: true, isOwner: true, isBanned: true },
        })
        if (dbUser) {
          t.isAdmin = dbUser.isAdmin
          t.isOwner = dbUser.isOwner
          t.isBanned = dbUser.isBanned
        }
        t.refreshedAt = Date.now()
      }
      return t
    },
  },
  providers: [
    Credentials({
      credentials: {
        identifier: { label: "Email or Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const parsed = credentialsSchema.safeParse(credentials)
        if (!parsed.success) return null

        const { identifier, password } = parsed.data

        // Strip leading @ from username if present
        const clean = identifier.startsWith("@") ? identifier.slice(1) : identifier
        const isEmail = clean.includes("@")

        const user = await prisma.user.findFirst({
          where: isEmail ? { email: clean } : { username: clean },
          select: {
            id: true,
            name: true,
            email: true,
            passwordHash: true,
            isAdmin: true,
            isOwner: true,
            isBanned: true,
          },
        })

        const ip = getClientIp(request as Request)

        if (!user || user.isBanned) {
          void auditLog({ action: "login.failure", ip, meta: { identifier: clean } })
          return null
        }

        const passwordMatch = await bcrypt.compare(password, user.passwordHash)
        if (!passwordMatch) {
          void auditLog({ actorId: user.id, action: "login.failure", ip, meta: { identifier: clean } })
          return null
        }

        void auditLog({ actorId: user.id, action: "login.success", ip })
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          isAdmin: user.isAdmin,
          isOwner: user.isOwner,
          isBanned: user.isBanned,
        }
      },
    }),
  ],
})
