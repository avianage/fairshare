// Generates simple placeholder PWA icons (solid theme-colour square with an "F")
// as valid PNGs, with no image dependencies. Replace with real artwork later.
// Run: node scripts/generate-icons.mjs
import { deflateSync } from "node:zlib"
import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"

const THEME = [15, 23, 42] // #0f172a
const FG = [255, 255, 255]

// CRC32 (PNG chunk checksum).
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii")
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32BE(data.length, 0)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf])
}

// Draw a blocky "F" glyph inside the square (very rough — placeholder only).
function pixel(x, y, size) {
  const m = Math.floor(size * 0.28) // margin
  const t = Math.floor(size * 0.12) // stroke thickness
  const inX = x >= m && x <= size - m
  const stem = x >= m && x <= m + t && y >= m && y <= size - m
  const top = y >= m && y <= m + t && inX
  const mid = y >= size / 2 - t / 2 && y <= size / 2 + t / 2 && x >= m && x <= size - m * 1.3
  return stem || top || mid ? FG : THEME
}

function makePng(size) {
  const bytesPerRow = size * 3 + 1 // filter byte + RGB
  const raw = Buffer.alloc(bytesPerRow * size)
  for (let y = 0; y < size; y++) {
    raw[y * bytesPerRow] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x, y, size)
      const off = y * bytesPerRow + 1 + x * 3
      raw[off] = r
      raw[off + 1] = g
      raw[off + 2] = b
    }
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // colour type: truecolour RGB
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

const dir = path.resolve("public/icons")
mkdirSync(dir, { recursive: true })
for (const size of [192, 512]) {
  writeFileSync(path.join(dir, `icon-${size}.png`), makePng(size))
  console.log(`wrote public/icons/icon-${size}.png`)
}
