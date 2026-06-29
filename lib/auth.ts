import NextAuth from "next-auth"
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
