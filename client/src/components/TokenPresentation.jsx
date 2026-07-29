import { useEffect, useMemo } from 'react'
import { Billboard, Html, Text } from '@react-three/drei'
import * as THREE from 'three'

// docs/PLAN_BATTLEMAP2D.md §8 (Lot 3) — présentation pure (aucun état combat), extraite de
// Canvas3D.jsx pour être partagée avec Canvas2D. FONT_URL reste utilisé directement par Canvas3D.jsx
// ailleurs (badges de chemin combat) — exporté, pas dupliqué.
export const FONT_URL = '/fonts/inter.woff'

const STATUS_CATEGORY_COLOR = {
  entrave:  '#d8a838',
  dot:      '#d84838',
  sens:     '#9858c8',
  chronique:'#38a8c8',
}
const STATUS_CATEGORY = {
  grappled: 'entrave', restrained: 'entrave', off_balance: 'entrave',
  burning: 'dot', acid: 'dot', asphyxia: 'dot', decompression: 'dot', electrocuted: 'dot',
  stunned: 'sens', unconscious: 'sens', blinded: 'sens',
  hypothermia: 'chronique', infected: 'chronique', poisoned: 'chronique', irradiated: 'chronique',
}

// offsetY par défaut = échelle Canvas3D (personnage GLB ~2 unités de haut, label "au-dessus de la
// tête"). Canvas2D (docs/PLAN_BATTLEMAP2D.md §8, correctif Saar) passe un offsetY réduit, proportionné
// à son disque de token (rayon 0.45) — sans ce paramètre, le label/badge apparaît à des cases de
// distance du token sur une carte plate. Défaut inchangé : zéro régression sur Canvas3D.
export function TokenLabel({ label, color, isGmLayer, offsetY = 2.5 }) {
  const H3D = 0.4
  const { texture, aspect } = useMemo(() => {
    const CH = 64
    const loaded = document.fonts.check(`600 ${Math.round(CH * 0.68)}px Inter`)
    const FONT = `600 ${Math.round(CH * 0.68)}px ${loaded ? 'Inter, ' : ''}sans-serif`
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    ctx.font = FONT
    const w = ctx.measureText(label).width
    canvas.width = Math.ceil(w) + 16
    canvas.height = CH
    ctx.font = FONT
    ctx.lineWidth = CH * 0.14
    ctx.strokeStyle = '#000'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.strokeText(label, canvas.width / 2, CH / 2)
    ctx.fillStyle = color
    ctx.fillText(label, canvas.width / 2, CH / 2)
    const tex = new THREE.CanvasTexture(canvas)
    return { texture: tex, aspect: canvas.width / CH }
  }, [label, color])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <sprite position={[0, offsetY, 0]} scale={[H3D * aspect, H3D, 1]}>
      <spriteMaterial attach="material" map={texture}
        depthWrite={false} opacity={isGmLayer ? 0.5 : 1} />
    </sprite>
  )
}

export function TokenGmBadge({ offsetY = 2.85 }) {
  return (
    <Billboard>
      <Text
        position={[0, offsetY, 0]}
        font={FONT_URL}
        fontSize={0.22}
        color="#a855f7"
        anchorX="center"
        anchorY="bottom"
      >
        {'⊘ GM'}
      </Text>
    </Billboard>
  )
}

export function TokenStatusBadges({ statuses, statusEffectsMode = 'enforced', offsetY = 2.1 }) {
  if (!(statuses?.length > 0) || statusEffectsMode === 'off') return null
  return (
    <Html position={[0, offsetY, 0]} center zIndexRange={[1, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
      <div style={{ display: 'flex', gap: 2 }}>
        {(statuses.length > 4 ? statuses.slice(0, 3) : statuses).map(code => {
          const color = STATUS_CATEGORY_COLOR[STATUS_CATEGORY[code]] ?? '#888'
          return (
            <img
              key={code}
              src={`/assets/status/${code}.svg`}
              width={14}
              height={14}
              alt={code}
              style={{
                borderRadius: 2,
                background: `${color}44`,
                outline: `1px solid ${color}99`,
                filter: `drop-shadow(0 0 2px ${color})`,
              }}
            />
          )
        })}
        {statuses.length > 4 && (
          <span style={{
            fontSize: 9,
            color: '#ccc',
            background: 'rgba(0,0,0,0.6)',
            borderRadius: 2,
            padding: '0 2px',
            lineHeight: '14px',
            outline: '1px solid rgba(255,255,255,0.2)',
          }}>
            +{statuses.length - 3}
          </span>
        )}
      </div>
    </Html>
  )
}
