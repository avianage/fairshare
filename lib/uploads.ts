import path from "node:path"

/**
 * Receipt upload helpers. The directory lives OUTSIDE the web root (UPLOAD_DIR)
 * and files are only ever served through an authenticated route — never linked
 * to statically.
 */

export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024 // 5MB

// Allowed image types, keyed by the extension we persist. We sniff the actual
// bytes rather than trusting the client's Content-Type header.
type Allowed = { ext: "jpg" | "png" | "webp"; mime: string }

/**
 * Detect the image type from magic bytes. Returns null for anything that isn't
 * a JPEG, PNG, or WebP — the client's declared MIME type is ignored entirely.
 */
export function sniffImageType(buf: Uint8Array): Allowed | null {
  // JPEG: FF D8 FF
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: "jpg", mime: "image/jpeg" }
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return { ext: "png", mime: "image/png" }
  }
  // WebP: "RIFF" .... "WEBP"
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && // R
    buf[1] === 0x49 && // I
    buf[2] === 0x46 && // F
    buf[3] === 0x46 && // F
    buf[8] === 0x57 && // W
    buf[9] === 0x45 && // E
    buf[10] === 0x42 && // B
    buf[11] === 0x50 // P
  ) {
    return { ext: "webp", mime: "image/webp" }
  }
  return null
}

// A stored receipt filename is exactly a UUID + allowed extension. Used to
// reject path traversal / arbitrary names in the serve route.
export const RECEIPT_FILENAME_RE = /^[a-f0-9-]{36}\.(jpg|jpeg|png|webp)$/

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
}

export function mimeForExtension(filename: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase()
  return ext ? (EXT_TO_MIME[ext] ?? null) : null
}

/** Absolute, normalized upload directory from env (fallback ./uploads). */
export function uploadDir(): string {
  return path.resolve(process.env.UPLOAD_DIR ?? "./uploads")
}

/**
 * Resolve a filename to an absolute path that is GUARANTEED to sit directly
 * inside the upload directory. Returns null if the name escapes the directory
 * (e.g. "../../etc/passwd") — defense in depth on top of the filename regex.
 */
export function resolveUploadPath(filename: string): string | null {
  const dir = uploadDir()
  const full = path.resolve(dir, filename)
  const rel = path.relative(dir, full)
  // rel must be a plain filename: no "..", no nested dirs, no absolute path.
  if (rel === "" || rel.startsWith("..") || rel.includes(path.sep) || path.isAbsolute(rel)) {
    return null
  }
  return full
}
