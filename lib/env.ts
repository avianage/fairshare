import { z } from "zod"

/**
 * Fail-fast environment validation. Imported by lib/prisma (server entrypoint)
 * so a misconfigured deployment throws at startup with a clear message rather
 * than failing deep in a request. Node-only — never imported by Edge middleware.
 */
const schema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid connection URL"),
  NEXTAUTH_SECRET: z
    .string()
    .min(32, "NEXTAUTH_SECRET must be at least 32 characters (openssl rand -base64 32)"),
  NEXTAUTH_URL: z.string().url().optional(),
  UPLOAD_DIR: z.string().min(1).default("./uploads"),
  // Optional — natural-language parsing is disabled gracefully when absent.
  ANTHROPIC_API_KEY: z.string().optional(),
  APP_VERSION: z.string().optional(),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  console.error(
    "❌ Invalid environment configuration:",
    JSON.stringify(parsed.error.flatten().fieldErrors)
  )
  throw new Error("Invalid environment configuration — see logs above.")
}

export const env = parsed.data
