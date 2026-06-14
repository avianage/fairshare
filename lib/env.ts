import { z } from "zod"

const schema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid connection URL"),
  NEXTAUTH_SECRET: z
    .string()
    .min(32, "NEXTAUTH_SECRET must be at least 32 characters (openssl rand -base64 32)"),
  NEXTAUTH_URL: z.string().url().optional(),
  UPLOAD_DIR: z.string().min(1).default("./uploads"),
  ANTHROPIC_API_KEY: z.string().optional(),
  APP_VERSION: z.string().optional(),
})

let _env: z.infer<typeof schema> | null = null

function getEnv(): z.infer<typeof schema> {
  if (!_env) {
    const parsed = schema.safeParse(process.env)
    if (!parsed.success) {
      console.error(
        "❌ Invalid environment configuration:",
        JSON.stringify(parsed.error.flatten().fieldErrors)
      )
      throw new Error("Invalid environment configuration — see logs above.")
    }
    _env = parsed.data
  }
  return _env
}

export const env = new Proxy({} as z.infer<typeof schema>, {
  get(_, prop) {
    return getEnv()[prop as keyof z.infer<typeof schema>]
  },
})
