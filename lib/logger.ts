/**
 * Minimal structured logger. Emits one JSON line per event to stdout/stderr.
 * Edge-safe (console only). NEVER pass secrets, tokens, passwords, request
 * bodies, or file contents — only method/path/status/userId/timestamp metadata.
 */
type HttpLog = {
  method: string
  path: string
  status: number
  userId?: string | null
  msg?: string
}

export function logHttp(fields: HttpLog): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level: fields.status >= 500 ? "error" : "warn",
    ...fields,
  })
  if (fields.status >= 500) console.error(line)
  else console.warn(line)
}
