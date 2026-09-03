import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../stores/authStore'
import api from '../lib/api'
import CharacterWindow from '../character/CharacterWindow'
import DroneWindow from '../character/DroneWindow'
import ExoSheetWindow from '../character/ExoSheetWindow'

// ─── VaultCharacterPage ("Coffre" — fiche standalone) ──────────────────────────────
// Point d'entrée hors session pour éditer un personnage du Coffre. Dispatch par character.type,
// même logique que SessionPage.jsx:openSheet — drone → DroneWindow, exo → ExoSheetWindow (fiche
// exo_sheet, pas de char_sheet), pj/pnj → CharacterWindow. Aucune de ces fenêtres n'a besoin de
// SocketProvider hors session (listeners optionnels, dégradés gracieusement sans socket).
// isGm toujours false : côté serveur, le propriétaire d'un personnage du Coffre a déjà les mêmes
// pouvoirs via req.isVaultOwner (char-sheet.js router.param, exo inclus) et req.isOwner
// (routes/characters.js) — docs/EN_COURS.md 2026-08-16.
export default function VaultCharacterPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user } = useAuthStore()

  const [character, setCharacter] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => { document.title = 'Enclume — Coffre' }, [])

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await api.get(`/vault/characters/${id}`)
      setCharacter(res.data.character)
    } catch {
      setError(t('vault.errorLoad'))
    } finally {
      setLoading(false)
    }
  }, [id, t])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="app-shell" style={S.container}>
        <p style={S.muted}>{t('common.loading')}</p>
      </div>
    )
  }

  if (error || !character) {
    return (
      <div className="app-shell" style={S.container}>
        <p style={S.muted}>{error || t('vault.errorLoad')}</p>
        <button className="btn" onClick={() => navigate('/vault')}>{t('vault.back')}</button>
      </div>
    )
  }

  const characterWithUser = { ...character, _currentUserId: user?.id }

  return (
    <div className="app-shell" style={S.container}>
      {character.type === 'drone' ? (
        <DroneWindow character={characterWithUser} isGm={false} onClose={() => navigate('/vault')} />
      ) : character.type === 'exo' ? (
        <ExoSheetWindow character={characterWithUser} isGm={false} onClose={() => navigate('/vault')} />
      ) : (
        <CharacterWindow
          character={characterWithUser}
          isGm={false}
          hasCampaign={false}
          onClose={() => navigate('/vault')}
        />
      )}
    </div>
  )
}

const S = {
  container: { minHeight: '100vh' },
  muted: { color: 'var(--text-muted)', fontSize: '13px', padding: '24px' },
}
