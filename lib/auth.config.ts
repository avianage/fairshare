/**
 * Edge-safe NextAuth config — no Node.js-only imports (no Prisma, no bcrypt).
 * Used by middleware.ts for JWT verification without a database roundtrip.
 * The full config with the Credentials provider lives in lib/auth.ts.
 */
import type { NextAuthConfig } from "next-auth"

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  trustHost: true,
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.isAdmin = (user as { isAdmin?: boolean }).isAdmin ?? false
        token.isOwner = (user as { isOwner?: boolean }).isOwner ?? false
        token.isBanned = (user as { isBanned?: boolean }).isBanned ?? false
      }
      return token
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string
        session.user.isAdmin = token.isAdmin === true
        session.user.isOwner = token.isOwner === true
        session.user.isBanned = token.isBanned === true
      }
      return session
    },
  },
  // Providers are added in lib/auth.ts; middleware only needs JWT verification.
  providers: [],
}
