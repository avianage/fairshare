import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      isAdmin?: boolean
      isOwner?: boolean
      isBanned?: boolean
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    isAdmin?: boolean
    isOwner?: boolean
    isBanned?: boolean
  }
}
