import { randomUUID } from "crypto"

/**
 * Group primary key — a standard RFC-4122 v4 UUID (e.g.
 * "550e8400-e29b-41d4-a716-446655440000"). Used so the URL (/groups/<id>) reads
 * cleanly while keeping 122 bits of randomness (collisions are not a concern).
 */
export function generateGroupId(): string {
  return randomUUID()
}

/** True if `id` is already a UUID. */
export function isFormattedGroupId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}
