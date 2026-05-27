// tools/sample-texture.js — lit les pixels d'un PNG et affiche ASCII art autour de coordonnées
// Usage: node tools/sample-texture.js <texture.png> x1,y1[,label] x2,y2[,label] ...
// Zéro dépendance externe — zlib built-in Node.js

import { readFileSync } from 'fs'
import { inflateSync }  from 'zlib'

const [,, pngPath, ...rawCoords] = process.argv

if (!pngPath || rawCoords.length === 0) {
  console.error('Usage: node tools/sample-texture.js <texture.png> x1,y1[,label] ...')
  process.exit(1)
}

const buf = readFileSync(pngPath)

// ─── Parse PNG ────────────────────────────────────────────────────────────────
if (buf.readUInt32BE(0) !== 0x89504E47 || buf.readUInt32BE(4) !== 0x0D0A1A0A)
  throw new Error('Pas un PNG valide')

let pos = 8
let width, height, bpp   // bytes per pixel

const idatParts = []

while (pos < buf.length - 4) {
  const len  = buf.readUInt32BE(pos)
  const type = buf.subarray(pos + 4, pos + 8).toString('ascii')

  if (type === 'IHDR') {
    width  = buf.readUInt32BE(pos + 8)
    height = buf.readUInt32BE(pos + 12)
    const bitDepth  = buf[pos + 16]      // toujours 8 pour ces textures
    const colorType = buf[pos + 17]      // 2=RGB, 6=RGBA
    bpp = (colorType === 6 ? 4 : 3) * (bitDepth >>> 3)
  } else if (type === 'IDAT') {
    idatParts.push(buf.subarray(pos + 8, pos + 8 + len))
  } else if (type === 'IEND') {
    break
  }
  pos += 12 + len
}

// Décompresser
const raw = inflateSync(Buffer.concat(idatParts))

// Reconstruire les scanlines (filtres PNG 0-4)
const pixels = Buffer.alloc(width * height * bpp)
const stride = width * bpp

function b(row, col)    { return row >= 0 && col >= 0 ? pixels[row * stride + col] : 0 }
function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

for (let row = 0; row < height; row++) {
  const filter = raw[row * (stride + 1)]
  const base   = row * (stride + 1) + 1
  const dst    = row * stride

  for (let i = 0; i < stride; i++) {
    const x = raw[base + i]
    const ch = i % bpp
    let v
    if      (filter === 0) v = x
    else if (filter === 1) v = x + b(row, dst + i - bpp - dst) // Sub — utilise pixel gauche
    else if (filter === 2) v = x + b(row - 1, dst + i)
    else if (filter === 3) v = x + Math.floor((b(row, dst + i - bpp - dst) + b(row - 1, dst + i)) / 2)
    else                   v = x + paeth(b(row, dst + i - bpp - dst), b(row - 1, dst + i),
                                         b(row - 1, dst + i - bpp))
    pixels[dst + i] = v & 0xFF
  }
}

// Correction : le "b(row, col)" ci-dessus a un bug dans le calcul de l'index gauche.
// On réécrit proprement :
const px2 = Buffer.alloc(width * height * bpp)

for (let row = 0; row < height; row++) {
  const filter = raw[row * (stride + 1)]
  const base   = row * (stride + 1) + 1
  const dst    = row * stride

  for (let i = 0; i < stride; i++) {
    const x  = raw[base + i]
    const aI = dst + i - bpp   // indice gauche (même ligne)
    const bI = (row - 1) * stride + i  // indice haut (ligne précédente)
    const cI = (row - 1) * stride + i - bpp  // indice haut-gauche

    const a = (i >= bpp)         ? px2[aI] : 0
    const bv = (row > 0)          ? px2[bI] : 0
    const c = (row > 0 && i >= bpp) ? px2[cI] : 0

    let v
    if      (filter === 0) v = x
    else if (filter === 1) v = x + a
    else if (filter === 2) v = x + bv
    else if (filter === 3) v = x + Math.floor((a + bv) / 2)
    else                   v = x + paeth(a, bv, c)

    px2[dst + i] = v & 0xFF
  }
}

function getPixel(x, y) {
  const off = (y * width + x) * bpp
  return { r: px2[off], g: px2[off+1], b: px2[off+2], a: bpp === 4 ? px2[off+3] : 255 }
}

// ─── Affichage ASCII art ───────────────────────────────────────────────────────
const HALF = parseInt(process.env.HALF ?? '12')  // demi-taille de la fenêtre — ex: HALF=50 node ...

for (const raw of rawCoords) {
  const parts = raw.split(',')
  const cx    = parseInt(parts[0])
  const cy    = parseInt(parts[1])
  const label = parts[2] ?? `(${cx},${cy})`

  console.log(`\n=== Cluster ${label} — centre pixel (${cx}, ${cy}) ===`)

  for (let y = cy - HALF; y <= cy + HALF; y++) {
    let line = ''
    for (let x = cx - HALF; x <= cx + HALF; x++) {
      if (x < 0 || x >= width || y < 0 || y >= height) { line += ' '; continue }
      const { r, g, bv: bv2 } = { r: 0, g: 0, ...getPixel(x, y) }
      const { r: rr, g: gr } = getPixel(x, y)
      // Gold/yellow: r>140 et g>100 — dark background: r<60
      const bright = rr > 140 || gr > 100
      const center = (x === cx && y === cy)
      line += center ? (bright ? '■' : '+') : (bright ? '█' : '·')
    }
    console.log(line)
  }
}

console.log(`\nImage : ${width}×${height}px, ${bpp} canaux`)
