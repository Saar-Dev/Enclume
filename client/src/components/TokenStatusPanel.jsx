import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { WS } from '../../../shared/events.js'

// ─── Statuts — ordre et métadonnées ─────────────────────────────────────────
const STATUS_LIST = [
  { code: 'grappled',      category: 'entrave' },
  { code: 'restrained',    category: 'entrave' },
  { code: 'off_balance',   category: 'entrave' },
  { code: 'burning',       category: 'dot'     },
  { code: 'acid',          category: 'dot'     },
  { code: 'asphyxia',      category: 'dot'     },
  { code: 'decompression', category: 'dot'     },
  { code: 'electrocuted',  category: 'dot'     },
  { code: 'stunned',       category: 'sens'    },
  { code: 'unconscious',   category: 'sens'    },
  { code: 'blinded',       category: 'sens'    },
  { code: 'hypothermia',   category: 'chronique' },
  { code: 'infected',      category: 'chronique' },
  { code: 'poisoned',      category: 'chronique' },
  { code: 'irradiated',    category: 'chronique' },
]

const CATEGORY_COLOR = {
  entrave:  '#d8a838',
  dot:      '#d84838',
  sens:     '#9858c8',
  chronique:'#38a8c8',
}

// ─── TokenStatusPanel ────────────────────────────────────────────────────────
// Bulle-grille 3×5 pour ajouter/retirer les statuts d'un token.
// Props :
//   x, y        — coordonnées écran (même origine que le radial menu)
//   token       — objet token live (depuis tokenStore)
//   character   — objet character ou null (pour les entités sans personnage)
//   statuses    — string[] statuts actifs sur ce token
//   isGm        — boolean
//   userId      — id de l'utilisateur courant
//   socket      — instance socket.io client
//   onClose     — callback fermeture
export default function TokenStatusPanel({
  x, y,
  token,
  character,
  statuses = [],
  isGm,
  userId,
  socket,
  onClose,
}) {
  const { t } = useTranslation()
  const panelRef = useRef(null)

  const isOwner = character?.user_id === userId
  const canToggle = isGm || isOwner

  // Fermeture click-dehors / Échap
  useEffect(() => {
    const onMouseDown = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose()
    }
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const handleToggle = (statusCode) => {
    if (!canToggle) return
    socket?.emit(WS.TOKEN_STATUS_TOGGLE, { tokenId: token.id, statusCode })
  }

  // Clamping écran
  const W = 290, H = 220
  const left = Math.max(8, Math.min(window.innerWidth  - W - 8, x - W / 2))
  const top  = Math.max(8, Math.min(window.innerHeight - H - 8, y - H / 2))

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        left, top,
        width: W,
        zIndex: 10000,
        background: 'rgba(8,13,20,0.96)',
        border: '1px solid rgba(70,198,230,0.25)',
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(70,198,230,0.08)',
        padding: '12px 14px 14px',
        pointerEvents: 'auto',
      }}
    >
      {/* En-tête */}
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '2px',
        color: 'rgba(70,198,230,0.7)',
        textTransform: 'uppercase',
        marginBottom: 10,
        userSelect: 'none',
      }}>
        {token?.label || '?'} — {t('tokenRadial.statuts')}
      </div>

      {/* Grille 5×3 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: 6,
      }}>
        {STATUS_LIST.map(({ code, category }) => {
          const active  = statuses.includes(code)
          const color   = CATEGORY_COLOR[category]
          const clickable = canToggle

          return (
            <div
              key={code}
              title={t(`status.${code}`)}
              onClick={() => clickable && handleToggle(code)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                padding: '5px 3px',
                borderRadius: 5,
                border: active
                  ? `1px solid ${color}`
                  : '1px solid rgba(255,255,255,0.06)',
                background: active
                  ? `${color}22`
                  : 'rgba(255,255,255,0.03)',
                cursor: clickable ? 'pointer' : 'default',
                opacity: !clickable && !active ? 0.35 : 1,
                boxShadow: active ? `0 0 6px ${color}55` : 'none',
                transition: 'background .12s, border-color .12s, box-shadow .12s',
              }}
            >
              <img
                src={`/assets/status/${code}.svg`}
                alt={code}
                width={20}
                height={20}
                style={{
                  filter: active
                    ? `drop-shadow(0 0 3px ${color})`
                    : 'grayscale(60%) opacity(0.55)',
                  transition: 'filter .12s',
                }}
              />
              <span style={{
                fontSize: 8,
                color: active ? color : 'rgba(255,255,255,0.3)',
                textAlign: 'center',
                lineHeight: 1.1,
                userSelect: 'none',
                letterSpacing: '0.5px',
              }}>
                {t(`status.${code}`)}
              </span>
            </div>
          )
        })}
      </div>

      {/* Légende permission */}
      {!canToggle && (
        <div style={{
          marginTop: 10,
          fontSize: 9,
          color: 'rgba(255,255,255,0.25)',
          textAlign: 'center',
          letterSpacing: '1px',
          userSelect: 'none',
        }}>
          {t('tokenRadial.detailStatuts')}
        </div>
      )}
    </div>
  )
}
