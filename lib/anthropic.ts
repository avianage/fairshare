import Anthropic from "@anthropic-ai/sdk"

/**
 * Server-only Anthropic client. ANTHROPIC_API_KEY is read from the environment
 * and must NEVER be exposed to the client. Used by /api/expenses/parse.
 */
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export const NLP_MODEL = "claude-sonnet-4-6"
