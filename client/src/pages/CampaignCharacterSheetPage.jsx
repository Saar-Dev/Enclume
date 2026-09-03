import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../stores/authStore'
import api from '../lib/api'
import CharacterWindow from '../character/CharacterWindow'
import DroneWindow from '../character/DroneWindow'
import ExoSheetWindow from '../character/ExoSheetWindow'

// ─── CampaignCharacterSheetPage ("fiche standalone" — personnage de campagne) ──────
// Point d'entrée hors session VTT pour consulter/éditer un personnage de campagne — même besoin que
// `VaultCharacterPage.jsx` (docs/PLANS/PLAN_FICHE_HORSLIGNE.md, Lot B0), mais pour un personnage réel
// de campagne, pas du Coffre : `VaultCharacterPage.jsx` ne couvre que les personnages du Coffre,
// aucune route légère n'existait pour un personnage de campagne — la seule voie d'accès à
// `CharacterWindow` passait par `SessionPage.jsx`, qui embarque toute la session VTT (carte 3D,
// WebSocket via `SocketProvider`). `CharacterWindow`/`DroneWindow`/`ExoSheetWindow` n'ont pas besoin
// de socket hors session (listeners optionnels, dégradés gracieusement) — vérifié, même propriété
// déjà exploitée par `VaultCharacterPage.jsx`.
//
// Dispatch par `character.type` : drone → `DroneWindow`, exo → `ExoSheetWindow` (fiche `exo_sheet`,
// pas de `char_sheet`), pj/pnj → `CharacterWindow`. Même logique que `SessionPage.jsx`.
//
// Différence clé avec `VaultCharacterPage.jsx` : `isGm` n'est PAS toujours `false` ici. Au Coffre,
// c'est sans risque car le serveur donne déjà les mêmes pouvoirs au propriétaire via
// `req.isVaultOwner`/`req.isOwner`, indépendamment de ce que le client déclare. Pour un personnage de
// campagne, `isGm` est une vraie propriété de l'utilisateur *dans cette campagne* (appartenance
// `campaign_members`, role==='gm') — même calcul que `characterStore.js:setMembers`
// (`members.find(m => m.id === userId)?.role === 'gm'`), réutilisé ici à l'identique plutôt que
// dupliqué. Une valeur figée à `false` masquerait à tort les contrôles MJ pour un MJ consultant sa
// fiche hors session — bug fonctionnel (pas un trou de sécurité : les routes serveur vérifient déjà
// les droits réels indépendamment de ce que le client affiche).
export default function CampaignCharacterSheetPage() {
  const { campaignId, characterId } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user } = useAuthStore()

  const [character, setCharacter] = useState(null)
  const [isGm, setIsGm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => { document.title = 'Enclume — Fiche personnage' }, [])

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [sheetRes, campaignRes] = await Promise.all([
        api.get(`/char-sheet/${characterId}`),
        api.get(`/campaigns/${campaignId}`),
      ])
      setCharacter(sheetRes.data.character)
      const members = campaignRes.data.members || []
      setIsGm(members.find((m) => m.id === user?.id)?.role === 'gm')
    } catch {
      setError(t('character.sheetLoadError'))
    } finally {
      setLoading(false)
    }
  }, [characterId, campaignId, user?.id, t])

  useEffect(() => { load() }, [load])

  const backToSession = () => navigate(`/session/${campaignId}`)

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
        <p style={S.muted}>{error || t('character.sheetLoadError')}</p>
        <button className="btn" onClick={backToSession}>{t('character.back')}</button>
      </div>
    )
  }

  const characterWithUser = { ...character, _currentUserId: user?.id }

  return (
    <div className="app-shell" style={S.container}>
      {character.type === 'drone' ? (
        <DroneWindow character={characterWithUser} isGm={isGm} onClose={backToSession} />
      ) : character.type === 'exo' ? (
        <ExoSheetWindow character={characterWithUser} isGm={isGm} onClose={backToSession} />
      ) : (
        <CharacterWindow
          character={characterWithUser}
          isGm={isGm}
          onClose={backToSession}
        />
      )}
    </div>
  )
}

const S = {
  container: { minHeight: '100vh' },
  muted: { color: 'var(--text-muted)', fontSize: '13px', padding: '24px' },
}
