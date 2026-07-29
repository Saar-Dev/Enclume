// docs/PLAN_BATTLEMAP2D.md §10 (Lot 5) — éditeur de style de token 2D (forme/cadrage/bordure).
// Modale ouverte depuis CharacterWindow.jsx, à côté de l'upload de portrait.
// Correctif (signalé par Saar en validant le premier jet) : l'aperçu utilise désormais exactement le
// même calcul que le rendu réel (`tokenCropWindow`, client/src/lib/tokenCrop.js) — positionnement
// absolu de l'image en pixels dérivé de la fenêtre UV, pas un `transform` CSS indépendant. Corrige
// deux défauts du premier jet : l'offset qui n'avait aucun effet à zoom=1, et l'absence de correction
// du ratio d'aspect (un portrait 200×260 s'affichait déformé sur un token rond/carré).
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../lib/api.js'
import { useCharacterStore } from '../stores/characterStore'
import { tokenCropWindow, tokenCropOffsetFromCenter } from '../lib/tokenCrop.js'

const DEFAULT_TOKEN_STYLE = {
  shape: 'circle',
  crop: { offsetX: 0, offsetY: 0, zoom: 1 },
  border: { color: '#4A90D9', width: 0.06 },
  overlay: null,
}

const SHAPE_CLIP_PATH = {
  circle: null, // géré via borderRadius, pas clip-path
  square: 'none',
  hex: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
}

const FRAME_SIZE = 160 // px — cadre carré de l'aperçu, même proportions que le token rendu

export default function TokenStyleEditor({ character, onClose }) {
  const { t } = useTranslation()
  const { updateCharacter } = useCharacterStore()
  const initial = character.token_style || DEFAULT_TOKEN_STYLE
  const [shape, setShape] = useState(initial.shape)
  const [crop, setCrop] = useState({ ...DEFAULT_TOKEN_STYLE.crop, ...initial.crop })
  const [border, setBorder] = useState({ ...DEFAULT_TOKEN_STYLE.border, ...initial.border })
  const [saving, setSaving] = useState(false)
  const [naturalSize, setNaturalSize] = useState(null) // { width, height } | null tant que non chargé

  const dragRef = useRef(null) // { startX, startY, startOffsetX, startOffsetY } | null

  const portraitUrl = character.portrait_url
    ? `${import.meta.env.VITE_API_URL}/api/assets/${character.portrait_url}`
    : null

  useEffect(() => {
    setNaturalSize(null)
  }, [portraitUrl])

  const handleImgLoad = useCallback((e) => {
    setNaturalSize({ width: e.target.naturalWidth, height: e.target.naturalHeight })
  }, [])

  const window_ = naturalSize
    ? tokenCropWindow({
        naturalWidth: naturalSize.width, naturalHeight: naturalSize.height,
        offsetX: crop.offsetX, offsetY: crop.offsetY, zoom: crop.zoom,
      })
    : null

  const handleFrameDown = useCallback((e) => {
    if (!naturalSize) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { startX: e.clientX, startY: e.clientY, startOffsetX: crop.offsetX, startOffsetY: crop.offsetY }
  }, [naturalSize, crop.offsetX, crop.offsetY])

  const handleFrameMove = useCallback((e) => {
    if (!dragRef.current || !naturalSize || !window_) return
    // Glisser l'image (convention "drag to pan" standard) : déplacer le curseur de dxPx affiche la
    // portion opposée de l'image, donc le centre UV visé varie en sens inverse du déplacement écran.
    const displayedWidth = FRAME_SIZE / window_.repeatX
    const displayedHeight = FRAME_SIZE / window_.repeatY
    const dxPx = e.clientX - dragRef.current.startX
    const dyPx = e.clientY - dragRef.current.startY
    const startWindow = tokenCropWindow({
      naturalWidth: naturalSize.width, naturalHeight: naturalSize.height,
      offsetX: dragRef.current.startOffsetX, offsetY: dragRef.current.startOffsetY, zoom: crop.zoom,
    })
    const centerU = startWindow.offsetU + startWindow.repeatX / 2 - dxPx / displayedWidth
    const centerV = startWindow.offsetV + startWindow.repeatY / 2 - dyPx / displayedHeight
    const { offsetX, offsetY } = tokenCropOffsetFromCenter({
      naturalWidth: naturalSize.width, naturalHeight: naturalSize.height, centerU, centerV, zoom: crop.zoom,
    })
    setCrop(c => ({ ...c, offsetX, offsetY }))
  }, [naturalSize, window_, crop.zoom])

  const handleFrameUp = useCallback((e) => {
    dragRef.current = null
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const res = await api.put(`/characters/${character.id}/token-style`, {
        token_style: { shape, crop, border, overlay: null },
      })
      updateCharacter(res.data.character)
      onClose()
    } catch (err) {
      console.error('Erreur enregistrement style de token :', err)
    } finally {
      setSaving(false)
    }
  }, [character.id, shape, crop, border, updateCharacter, onClose])

  const handleReset = useCallback(async () => {
    setSaving(true)
    try {
      const res = await api.put(`/characters/${character.id}/token-style`, { token_style: null })
      updateCharacter(res.data.character)
      onClose()
    } catch (err) {
      console.error('Erreur réinitialisation style de token :', err)
    } finally {
      setSaving(false)
    }
  }, [character.id, updateCharacter, onClose])

  // Même rayon par défaut que TokenPresentation.jsx (TokenPortrait radius=0.45) — la bordure de
  // l'aperçu est ainsi proportionnée comme la bordure réellement rendue, pas un facteur arbitraire.
  const TOKEN_RADIUS_WORLD = 0.45
  const borderPx = border.width * (FRAME_SIZE / (2 * TOKEN_RADIUS_WORLD))

  const frameStyle = {
    ...styles.frame,
    borderRadius: shape === 'circle' ? '50%' : 0,
    clipPath: SHAPE_CLIP_PATH[shape] === 'none' ? undefined : SHAPE_CLIP_PATH[shape],
    borderColor: border.color,
    borderWidth: `${Math.round(borderPx)}px`,
  }

  return (
    <div style={styles.overlay} onMouseDown={onClose}>
      <div style={styles.box} onMouseDown={e => e.stopPropagation()}>
        <p style={styles.title}>{t('character.tokenStyleTitle')}</p>

        {!portraitUrl && <p style={styles.hint}>{t('character.tokenStyleNoPortrait')}</p>}

        <div style={styles.row}>
          <div
            style={frameStyle}
            onPointerDown={portraitUrl ? handleFrameDown : undefined}
            onPointerMove={portraitUrl ? handleFrameMove : undefined}
            onPointerUp={portraitUrl ? handleFrameUp : undefined}
          >
            {portraitUrl && (
              // Image cachée le temps du chargement (naturalWidth/Height requis pour le calcul de
              // fenêtre) — visible dès que window_ est calculable, positionnée en pixels absolus
              // dérivés de tokenCropWindow (même formule que le rendu Three.js réel).
              <img
                src={portraitUrl}
                alt=""
                draggable={false}
                onLoad={handleImgLoad}
                style={window_ ? {
                  position: 'absolute',
                  width: FRAME_SIZE / window_.repeatX,
                  height: FRAME_SIZE / window_.repeatY,
                  left: -window_.offsetU * (FRAME_SIZE / window_.repeatX),
                  top: -window_.offsetV * (FRAME_SIZE / window_.repeatY),
                  maxWidth: 'none',
                } : { opacity: 0, position: 'absolute' }}
              />
            )}
            {!portraitUrl && <div style={{ ...styles.frameImg, background: '#0e0e1a' }} />}
          </div>

          <div style={styles.controls}>
            <label style={styles.fieldLabel}>{t('character.tokenStyleShape')}</label>
            <div style={styles.shapeRow}>
              {['circle', 'hex', 'square'].map(s => (
                <button
                  key={s}
                  type="button"
                  className={`btn ${shape === s ? 'btn-gold' : 'btn-ghost'}`}
                  onClick={() => setShape(s)}
                >
                  {t(`character.tokenStyleShape${s === 'circle' ? 'Circle' : s === 'hex' ? 'Hex' : 'Square'}`)}
                </button>
              ))}
            </div>

            {portraitUrl && <p style={styles.hint}>{t('character.tokenStyleCropHint')}</p>}

            <label style={styles.fieldLabel}>{t('character.tokenStyleZoom')}</label>
            <input
              type="range" min={1} max={3} step={0.05}
              value={crop.zoom}
              onChange={e => setCrop(c => ({ ...c, zoom: Number(e.target.value) }))}
              disabled={!portraitUrl}
            />

            <label style={styles.fieldLabel}>{t('character.tokenStyleBorderColor')}</label>
            <input
              type="color"
              value={border.color}
              onChange={e => setBorder(b => ({ ...b, color: e.target.value }))}
              style={styles.colorInput}
            />

            <label style={styles.fieldLabel}>{t('character.tokenStyleBorderWidth')}</label>
            <input
              type="range" min={0} max={0.15} step={0.01}
              value={border.width}
              onChange={e => setBorder(b => ({ ...b, width: Number(e.target.value) }))}
            />
          </div>
        </div>

        <div style={styles.actions}>
          {character.token_style && (
            <button className="btn btn-danger" onClick={handleReset} disabled={saving}>
              {t('character.tokenStyleReset')}
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </button>
          <button className="btn btn-gold" onClick={handleSave} disabled={saving || !portraitUrl}>
            {saving ? t('character.tokenStyleSaving') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9600,
  },
  box: {
    background: '#16162a', border: '1px solid #2a2a3e', borderRadius: 8,
    padding: 20, width: 480, maxWidth: '90vw', color: '#c0c0d0',
  },
  title: { fontSize: 16, fontWeight: 600, margin: '0 0 12px' },
  hint: { fontSize: 11, color: '#7a7a9a', margin: '4px 0' },
  row: { display: 'flex', gap: 16 },
  frame: {
    width: FRAME_SIZE, height: FRAME_SIZE, flexShrink: 0, overflow: 'hidden', position: 'relative',
    border: '2px solid #4A90D9', background: '#0e0e1a', cursor: 'grab', touchAction: 'none',
  },
  frameImg: { width: '100%', height: '100%', objectFit: 'cover', transformOrigin: 'center' },
  controls: { flex: 1, display: 'flex', flexDirection: 'column', gap: 4 },
  shapeRow: { display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  fieldLabel: { fontSize: 11, color: '#9a9ac0', marginTop: 6 },
  colorInput: { width: 48, height: 28, padding: 0, border: 'none', background: 'none' },
  actions: { display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' },
}
