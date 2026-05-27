// tools/procrustes-d20.js — rotation optimale D20 par Procrustes
// Usage: node tools/procrustes-d20.js
// Principe : icosaèdre régulier théorique → rotation fitted sur 9 paires confirmées
//            → 20 normales exactes (face centres garantis, pas d'arête/sommet)

const φ = (1 + Math.sqrt(5)) / 2
const R = Math.sqrt(1 + φ * φ)

// ─── Icosaèdre régulier — 12 sommets normalisés ───────────────────────────────
const V = [
  [0,1,φ],[0,-1,φ],[0,1,-φ],[0,-1,-φ],
  [1,φ,0],[-1,φ,0],[1,-φ,0],[-1,-φ,0],
  [φ,0,1],[-φ,0,1],[φ,0,-1],[-φ,0,-1],
].map(([x,y,z]) => [x/R, y/R, z/R])

const EDGE_SQ = 4 / (R * R)
const distSq  = (a, b) => (a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2

// Adjacence (arêtes uniquement)
const adj = Array.from({length:12}, ()=>[])
for (let i = 0; i < 12; i++)
  for (let j = i+1; j < 12; j++)
    if (Math.abs(distSq(V[i],V[j]) - EDGE_SQ) < 1e-9) { adj[i].push(j); adj[j].push(i) }

// 20 faces — tous les triangles dont les 3 paires sont des arêtes
const FACES = []
for (let i = 0; i < 12; i++)
  for (const j of adj[i]) if (j > i)
    for (const k of adj[j]) if (k > j && adj[i].includes(k))
      FACES.push([i, j, k])

if (FACES.length !== 20) throw new Error(`Erreur : ${FACES.length} faces au lieu de 20`)

// ─── Utilitaires vectoriels ───────────────────────────────────────────────────
const cross = ([ax,ay,az],[bx,by,bz]) => [ay*bz-az*by, az*bx-ax*bz, ax*by-ay*bx]
const dot   = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2]
const norm  = v => { const l=Math.sqrt(dot(v,v)); return [v[0]/l,v[1]/l,v[2]/l] }

// ─── 20 normales théoriques (orientées vers l'extérieur) ─────────────────────
const THEORY = FACES.map(([i,j,k]) => {
  const e1 = [V[j][0]-V[i][0], V[j][1]-V[i][1], V[j][2]-V[i][2]]
  const e2 = [V[k][0]-V[i][0], V[k][1]-V[i][1], V[k][2]-V[i][2]]
  let n = norm(cross(e1,e2))
  const c = [(V[i][0]+V[j][0]+V[k][0])/3,(V[i][1]+V[j][1]+V[k][1])/3,(V[i][2]+V[j][2]+V[k][2])/3]
  return dot(n,c) < 0 ? [-n[0],-n[1],-n[2]] : n
})

// ─── 9 normales mesurées confirmées (K-means, faces qui s'affichent correctement) ──
const MEASURED = [
  [-0.9425, -0.0303, -0.3330],  // key 1
  [-0.0682, -0.8271,  0.5579],  // key 2
  [-0.3349,  0.2035, -0.9200],  // key 3
  [ 0.3251, -0.2192, -0.9199],  // key 4
  [-0.5531, -0.8328,  0.0250],  // key 5
  [-0.8393, -0.1723,  0.5156],  // key 8
  [-0.3617,  0.5752,  0.7337],  // key 13
  [-0.2074, -0.1353,  0.9689],  // key 15
  [ 0.1737,  0.8825,  0.4370],  // key 16
]

// Matcher chaque mesuré au théorique le plus proche
const pairs = MEASURED.map((m,idx) => {
  let best=0, bestDot=-Infinity
  for (let i=0; i<THEORY.length; i++) { const d=dot(m,THEORY[i]); if(d>bestDot){bestDot=d;best=i} }
  return { theory: THEORY[best], measured: m, matchDot: bestDot, keyIdx: idx }
})

// ─── Quaternion de rotation (theory → measured) ───────────────────────────────
function rotQuat(from, to) {
  const d = Math.min(1, Math.max(-1, dot(from, to)))
  if (d > 1-1e-10) return [0,0,0,1]
  const axis = norm(cross(from, to))
  const s = Math.sqrt((1-d)/2)
  const c = Math.sqrt((1+d)/2)
  return [axis[0]*s, axis[1]*s, axis[2]*s, c]
}

const qdot4 = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3]

// Moyenne des quaternions (même hémisphère que le premier)
const quats = pairs.map(p => rotQuat(p.theory, p.measured))
const ref   = quats[0]
const aligned = quats.map(q => qdot4(q,ref) >= 0 ? q : [-q[0],-q[1],-q[2],-q[3]])

let avg = [0,0,0,0]
for (const q of aligned) { avg[0]+=q[0]; avg[1]+=q[1]; avg[2]+=q[2]; avg[3]+=q[3] }
const qLen = Math.sqrt(avg[0]**2+avg[1]**2+avg[2]**2+avg[3]**2)
const Q = avg.map(v => v/qLen)

// ─── Matrice de rotation depuis quaternion ────────────────────────────────────
const [qx,qy,qz,qw] = Q
const ROT = [
  [1-2*(qy*qy+qz*qz),   2*(qx*qy-qz*qw),   2*(qx*qz+qy*qw)],
  [  2*(qx*qy+qz*qw), 1-2*(qx*qx+qz*qz),   2*(qy*qz-qx*qw)],
  [  2*(qx*qz-qy*qw),   2*(qy*qz+qx*qw), 1-2*(qx*qx+qy*qy)],
]
const rotate = v => [
  ROT[0][0]*v[0]+ROT[0][1]*v[1]+ROT[0][2]*v[2],
  ROT[1][0]*v[0]+ROT[1][1]*v[1]+ROT[1][2]*v[2],
  ROT[2][0]*v[0]+ROT[2][1]*v[1]+ROT[2][2]*v[2],
]

// ─── 20 normales corrigées ────────────────────────────────────────────────────
const CORRECTED = THEORY.map(n => rotate(n))

// ─── Output ──────────────────────────────────────────────────────────────────
const f = v => v.toFixed(4).padStart(8)
console.log('const D20_GLB_NORMALS = {')
for (let i = 0; i < 20; i++) {
  const n = CORRECTED[i]
  console.log(`  ${String(i+1).padStart(2)}: [${f(n[0])}, ${f(n[1])}, ${f(n[2])}],`)
}
console.log('}')

console.log('\n// Validation — angle entre normale corrigée et normale mesurée :')
pairs.forEach((p,i) => {
  const c = rotate(p.theory)
  const d = Math.min(1, Math.max(-1, dot(c, p.measured)))
  const deg = (Math.acos(d)*180/Math.PI).toFixed(2)
  console.log(`//  paire ${i+1} (key ${[1,2,3,4,5,8,13,15,16][i]}): ${deg}°  (match théorique dot=${p.matchDot.toFixed(4)})`)
})
