import { Component, Suspense, useEffect, useMemo, useRef } from 'react'
import { Billboard, Html, Text, useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { tokenCropWindow } from '../lib/tokenCrop.js'

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

// ST1 — badges statut adaptatifs à la distance caméra (Html de drei garde une taille écran fixe par
// défaut, aucun distanceFactor n'était appliqué). Formule maison plutôt que la prop `distanceFactor`
// de drei (mise à l'échelle non bornée, top ou bottom-out impossibles à clamper depuis l'extérieur du
// composant) — REF_DISTANCE calibré sur la caméra 3e personne (Canvas3D THIRD_PERSON_MIN/MAX_DISTANCE
// = 2.2/12) pour atteindre le plafond au plus près (~50px) ; au dézoom max (12), la chute naturelle
// (REF_DISTANCE/dist ≈ 0.33) suffit déjà à rendre le badge minimal sans le couper à 0 — décision Saar
// (2026-07-29) : rester perceptible même au dézoom max plutôt que disparaître (vue tactique MJ), donc
// MIN reste un plancher de sécurité bas (extrêmes hors 3e personne, ex. dézoom MapControls illimité),
// pas une valeur qui intervient au dézoom max normal.
const BADGE_SCALE_REF_DISTANCE = 4
const BADGE_SCALE_MIN = 0.25
const BADGE_SCALE_MAX = 1.8
const tmpBadgeWorldPos = /* @__PURE__ */ new THREE.Vector3()

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

// Error boundary générique pour une texture qui échoue à charger (portrait supprimé/inaccessible) —
// déplacé depuis Canvas2D.jsx (docs/PLAN_BATTLEMAP2D.md §10, Lot 5) : servait déjà l'image de fond de
// carte, sert maintenant aussi le portrait de token, un seul composant plutôt qu'une copie locale (P4).
export class ImageErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

// docs/PLAN_BATTLEMAP2D.md §10 (Lot 5) — style de token adaptatif : forme + cadrage + bordure comme
// couches séparées, jamais une image recomposée côté serveur (recherche Discord `avatar_decoration_data`
// / Foundry Dynamic Token Ring, voir plan). `overlay` est un emplacement réservé, non peuplé en v1.
// CircleGeometry(radius, 6) produit un hexagone régulier ; CircleGeometry(radius, 32) un cercle
// quasi-lisse — les deux partagent la même projection UV radiale (centrée, [0,1]²), pas besoin d'une
// géométrie sur mesure. Le carré réutilise PlaneGeometry, mêmes UV par défaut (0..1 sur chaque axe).
export function TokenShapeMesh({ shape, radius, children, ...meshProps }) {
  return (
    <mesh {...meshProps}>
      {shape === 'square'
        ? <planeGeometry args={[radius * 2, radius * 2]} />
        : <circleGeometry args={[radius, shape === 'hex' ? 6 : 32]} />}
      {children}
    </mesh>
  )
}

// Cadrage du portrait dans la forme — délègue à tokenCropWindow (client/src/lib/tokenCrop.js), calcul
// partagé avec l'aperçu d'édition (TokenStyleEditor.jsx) pour garantir qu'ils affichent la même chose.
// Correctif (signalé par Saar en validant) : la version précédente ignorait le ratio d'aspect réel de
// l'image (déformation) et neutralisait l'offset à zoom=1 (recentrage sans effet).
function applyTokenCropTransform(texture, crop) {
  const image = texture.image
  const naturalWidth = image?.naturalWidth || image?.width || 1
  const naturalHeight = image?.naturalHeight || image?.height || 1
  // Pas d'inversion d'axe V : BattlemapImagePlane (même fichier, plan non tourné, même caméra) affiche
  // déjà une image droite sans correction — vérifié par lecture, c'est le précédent qui fait autorité
  // dans ce contexte de rendu, pas une hypothèse recopiée d'un premier jet non vérifié.
  const { repeatX, repeatY, offsetU, offsetV } = tokenCropWindow({
    naturalWidth,
    naturalHeight,
    offsetX: crop?.offsetX || 0,
    offsetY: crop?.offsetY || 0,
    zoom: crop?.zoom || 1,
  })
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping
  texture.repeat.set(repeatX, repeatY)
  texture.offset.set(offsetU, offsetV)
}

// Suspend le temps du chargement (géré par le <Suspense> appelant, même patron que
// BattlemapImagePlane) — doit être appelé uniquement quand portraitUrl est non-null.
function TokenPortraitTextured({ shape, radius, portraitUrl, crop, ...meshProps }) {
  const texture = useTexture(portraitUrl, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace
    applyTokenCropTransform(tex, crop)
  })
  // Recadrage ajusté sans rechargement réseau si crop change (édition en direct dans l'éditeur).
  useEffect(() => {
    applyTokenCropTransform(texture, crop)
  }, [texture, crop])

  return (
    <TokenShapeMesh shape={shape} radius={radius} {...meshProps}>
      <meshBasicMaterial map={texture} />
    </TokenShapeMesh>
  )
}

// Composant principal — remplace le disque de couleur quand `tokenStyle` est fourni (character.
// token_style non-null). `tokenStyle === null/undefined` reste géré par l'appelant (disque de
// couleur inchangé, zéro régression, docs/PLAN_BATTLEMAP2D.md §10).
export function TokenPortrait({ tokenStyle, portraitUrl, fallbackColor, radius = 0.45 }) {
  const shape = tokenStyle.shape
  const border = tokenStyle.border
  const fallback = (
    <TokenShapeMesh shape={shape} radius={radius}>
      <meshBasicMaterial color={fallbackColor} />
    </TokenShapeMesh>
  )
  return (
    <group>
      {border && (
        <TokenShapeMesh shape={shape} radius={radius + border.width} position={[0, 0, -0.001]}>
          <meshBasicMaterial color={border.color} />
        </TokenShapeMesh>
      )}
      {portraitUrl ? (
        <ImageErrorBoundary fallback={fallback}>
          <Suspense fallback={fallback}>
            <TokenPortraitTextured shape={shape} radius={radius} portraitUrl={portraitUrl} crop={tokenStyle.crop} />
          </Suspense>
        </ImageErrorBoundary>
      ) : fallback}
    </group>
  )
}

export function TokenStatusBadges({ statuses, statusEffectsMode = 'enforced', offsetY = 2.1 }) {
  const anchorRef = useRef(null)
  const scaleRef = useRef(null)

  // Mutation directe du style, jamais via state (P40 — même patron que le lerp de TokenMesh) : une
  // valeur par frame ne doit pas déclencher de re-render React.
  useFrame(({ camera }) => {
    if (!anchorRef.current || !scaleRef.current) return
    anchorRef.current.updateWorldMatrix(true, false)
    anchorRef.current.getWorldPosition(tmpBadgeWorldPos)
    const dist = camera.position.distanceTo(tmpBadgeWorldPos)
    const scale = Math.min(BADGE_SCALE_MAX, Math.max(BADGE_SCALE_MIN, BADGE_SCALE_REF_DISTANCE / dist))
    scaleRef.current.style.transform = `scale(${scale})`
  })

  if (!(statuses?.length > 0) || statusEffectsMode === 'off') return null
  return (
    <group ref={anchorRef} position={[0, offsetY, 0]}>
      <Html center zIndexRange={[1, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div ref={scaleRef} style={{ display: 'flex', gap: 2 }}>
          {(statuses.length > 4 ? statuses.slice(0, 3) : statuses).map(code => {
            const color = STATUS_CATEGORY_COLOR[STATUS_CATEGORY[code]] ?? '#888'
            return (
              <img
                key={code}
                src={`/assets/status/${code}.svg`}
                width={28}
                height={28}
                alt={code}
                style={{
                  borderRadius: 3,
                  background: `${color}44`,
                  outline: `1px solid ${color}99`,
                  filter: `drop-shadow(0 0 2px ${color})`,
                }}
              />
            )
          })}
          {statuses.length > 4 && (
            <span style={{
              fontSize: 14,
              color: '#ccc',
              background: 'rgba(0,0,0,0.6)',
              borderRadius: 3,
              padding: '0 4px',
              lineHeight: '28px',
              outline: '1px solid rgba(255,255,255,0.2)',
            }}>
              +{statuses.length - 3}
            </span>
          )}
        </div>
      </Html>
    </group>
  )
}
