import pg from 'pg'
import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync('../.env', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()] })
)

const pool = new pg.Pool({ connectionString: env.DATABASE_URL })
const BATTLEMAP_ID = '01b54209-441e-4d17-b555-eee6d5add890'

const r = await pool.query(`SELECT voxel_data FROM battlemaps WHERE id = $1`, [BATTLEMAP_ID])
const voxels = r.rows[0]?.voxel_data ?? {}
const keys   = Object.keys(voxels)
console.log(`\nvoxelCount total: ${keys.length}`)

// Distribution par Y_three (altitude)
const yDist = {}
for (const k of keys) {
  const y = k.split(':')[1]
  yDist[y] = (yDist[y] ?? 0) + 1
}
console.log('distribution par Y_three:', JSON.stringify(yDist))

// ── Chemin fd35948a(pos_x=7,pos_y=3,pos_z=0) → 6c84fd12(pos_x=7,pos_y=-7,pos_z=0) ──
// Eye src = (7.5, 2.5, 3.5)  Eye tgt = (7.5, 2.5, -6.5)
// Raycast DDA → voxels (7, 2, z) pour z ∈ [-7..3]
// Voxel key = "X:Y_three:Z_three" = "7:2:<z>"
console.log('\n── Chemin fd35948a → 6c84fd12 (ray X=7, Y_three=2, Z=-7..3) ──')
const rayPath = []
for (let z = -7; z <= 3; z++) rayPath.push(`7:2:${z}`)
const found = rayPath.filter(k => voxels[k])
console.log(`Voxels sur le chemin (${rayPath.length} cases) : ${found.length} trouvé(s)`)
if (found.length) found.forEach(k => console.log('  ', k, JSON.stringify(voxels[k])))
else console.log('  → AUCUN voxel bloquant à hauteur d\'œil (Y_three=2) sur ce chemin')

// Tous les voxels à X=7
console.log('\n── Tous les voxels X=7 (toutes hauteurs) ──')
const x7 = keys.filter(k => k.startsWith('7:')).sort((a,b) => {
  const [,ya,za] = a.split(':').map(Number)
  const [,yb,zb] = b.split(':').map(Number)
  return ya - yb || za - zb
})
console.log(`Count: ${x7.length}`)
x7.forEach(k => {
  const [x,y,z] = k.split(':').map(Number)
  console.log(`  key=${k}  Three.js(${x},${y},${z})  DB pos_x=${x} pos_z=${y}(alt) pos_y=${z}(prof)`)
})

// ── Chemin ce71acbb(pos_x=5,pos_y=2,pos_z=0) → 6c84fd12(pos_x=7,pos_y=-7,pos_z=0) ──
// Eye src = (5.5, 2.5, 2.5)  Eye tgt = (7.5, 2.5, -6.5)
// Ce chemin EST bloqué (clear:false confirmé). Quels voxels bloquent ?
console.log('\n── Chemin ce71acbb → 6c84fd12 (bounding box X=[5..7] Y_three=2 Z=[-7..2]) ──')
const ray2Found = keys.filter(k => {
  const [x,y,z] = k.split(':').map(Number)
  return x >= 5 && x <= 7 && y === 2 && z >= -7 && z <= 2
})
console.log(`Voxels dans la bbox Y_three=2 : ${ray2Found.length}`)
ray2Found.sort().forEach(k => {
  const [x,y,z] = k.split(':').map(Number)
  console.log(`  key=${k}  Three.js(${x},${y},${z})`)
})

await pool.end()
