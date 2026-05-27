// tools/find-numbers.js — localise les 20 chiffres dans la texture du D20
// Stratégie : scan de la zone UV active, flood-fill sur pixels brillants,
//             tri par taille → 20 plus grands blobs = les 20 chiffres
// Usage: node tools/find-numbers.js <texture.png>

import { readFileSync } from 'fs'
import { inflateSync }  from 'zlib'

const pngPath = process.argv[2]
if (!pngPath) { console.error('Usage: node tools/find-numbers.js <texture.png>'); process.exit(1) }

const buf = readFileSync(pngPath)
if (buf.readUInt32BE(0) !== 0x89504E47) throw new Error('Pas un PNG valide')

// ─── Parse PNG ────────────────────────────────────────────────────────────────
let pos = 8, width, height, bpp
const idatParts = []
while (pos < buf.length - 4) {
  const len  = buf.readUInt32BE(pos)
  const type = buf.subarray(pos + 4, pos + 8).toString('ascii')
  if (type === 'IHDR') {
    width  = buf.readUInt32BE(pos + 8)
    height = buf.readUInt32BE(pos + 12)
    const colorType = buf[pos + 17]
    bpp = (colorType === 6 ? 4 : 3)
  } else if (type === 'IDAT') {
    idatParts.push(buf.subarray(pos + 8, pos + 8 + len))
  } else if (type === 'IEND') break
  pos += 12 + len
}

const raw    = inflateSync(Buffer.concat(idatParts))
const stride = width * bpp
const px     = Buffer.alloc(width * height * bpp)

for (let row = 0; row < height; row++) {
  const filter = raw[row * (stride + 1)]
  const base   = row * (stride + 1) + 1
  const dst    = row * stride
  for (let i = 0; i < stride; i++) {
    const x  = raw[base + i]
    const aI = dst + i - bpp
    const bI = (row - 1) * stride + i
    const cI = (row - 1) * stride + i - bpp
    const a  = (i >= bpp)            ? px[aI] : 0
    const bv = (row > 0)             ? px[bI] : 0
    const c  = (row > 0 && i >= bpp) ? px[cI] : 0
    let v
    if      (filter === 0) v = x
    else if (filter === 1) v = x + a
    else if (filter === 2) v = x + bv
    else if (filter === 3) v = x + Math.floor((a + bv) / 2)
    else { const p=a+bv-c; const pa=Math.abs(p-a),pb=Math.abs(p-bv),pc=Math.abs(p-c); v=x+(pa<=pb&&pa<=pc?a:pb<=pc?bv:c) }
    px[dst + i] = v & 0xFF
  }
}

const getPixel = (x, y) => {
  const off = (y * width + x) * bpp
  return { r: px[off], g: px[off+1], b: px[off+2] }
}

// ─── Trouver la zone active UV (pixels non-noirs) ────────────────────────────
// Les faces du dé ont un fond coloré — on cherche les pixels "brillants"
// Seuil : r>80 OU g>80 (tout sauf noir/très foncé)
const isBright = (x, y) => {
  const { r, g, b } = getPixel(x, y)
  return r > 80 || g > 80 || b > 80
}

// Scan rapide pour trouver la bounding box de la zone active
// On ne scanne pas tout le 4096×4096 — les centres UV tournent autour de (0.5, 0.82)
// Zone de scan : x[1500..2800], y[2700..3900]
const X0 = 1500, X1 = 2800, Y0 = 2700, Y1 = 3900
console.log(`Scan zone [${X0}..${X1}, ${Y0}..${Y1}] — texture ${width}×${height}px`)

// ─── Flood-fill / labeling de composantes connexes ──────────────────────────
const label = new Int32Array((X1 - X0) * (Y1 - Y0)).fill(-1)
const W = X1 - X0, H = Y1 - Y0
const idx = (x, y) => (y - Y0) * W + (x - X0)

let nextLabel = 0
const blobs = []   // blobs[label] = { pixels, sumX, sumY }

for (let y = Y0; y < Y1; y++) {
  for (let x = X0; x < X1; x++) {
    if (!isBright(x, y)) continue
    if (label[idx(x, y)] >= 0) continue
    // BFS
    const queue = [[x, y]]
    const blob  = { pixels: 0, sumX: 0, sumY: 0 }
    label[idx(x, y)] = nextLabel
    let qi = 0
    while (qi < queue.length) {
      const [cx, cy] = queue[qi++]
      blob.pixels++; blob.sumX += cx; blob.sumY += cy
      for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nx = cx+dx, ny = cy+dy
        if (nx < X0 || nx >= X1 || ny < Y0 || ny >= Y1) continue
        if (!isBright(nx, ny)) continue
        if (label[idx(nx, ny)] >= 0) continue
        label[idx(nx, ny)] = nextLabel
        queue.push([nx, ny])
      }
    }
    blobs.push(blob)
    nextLabel++
  }
}

console.log(`${nextLabel} composantes connexes trouvées`)

// ─── Tri par taille — les 20+ plus grands blobs sont les faces/chiffres ──────
blobs.sort((a, b) => b.pixels - a.pixels)

console.log('\n--- Top 25 blobs par taille ---')
const coords = []
for (let i = 0; i < Math.min(25, blobs.length); i++) {
  const b   = blobs[i]
  const cx  = Math.round(b.sumX / b.pixels)
  const cy  = Math.round(b.sumY / b.pixels)
  const u   = (cx / width).toFixed(3)
  const v   = (cy / height).toFixed(3)
  console.log(`  Blob ${String(i+1).padStart(2)} | ${String(b.pixels).padStart(6)} px | centroid [${String(cx).padStart(4)}, ${String(cy).padStart(4)}] | UV [${u}, ${v}]`)
  coords.push(`${cx},${cy},B${i+1}`)
}

console.log('\n--- Commande sample-texture pour identifier les chiffres ---')
console.log(`node tools/sample-texture.js "client/public/models/D20_albedo.png" \\`)
console.log('  ' + coords.slice(0, 25).join(' \\\n  '))
