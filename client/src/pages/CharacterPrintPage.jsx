import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import CharacterPrintView from '../character/CharacterPrintView'

// ─── CharacterPrintPage — route dédiée à l'impression (Lot D, PLAN_FICHE_HORSLIGNE.md) ─────────────
// Aucune vérification d'autorisation ici : `CharacterPrintView` ne fait que monter `CharacterSheet`/
// `ArmorWoundPanel`/etc., dont les appels API passent déjà par `router.param('characterId', ...)`
// (`char-sheet.js`) — accès refusé côté serveur (403) si l'utilisateur n'est ni membre de la
// campagne ni propriétaire, indépendamment de la route cliente qui affiche la page. `ProtectedRoute`
// (login requis) suffit ici, comme pour toute autre page.
export default function CharacterPrintPage() {
  const { characterId } = useParams()
  const { t } = useTranslation()

  useEffect(() => { document.title = 'Enclume — Impression' }, [])

  return (
    <>
      <div className="print-only-hidden" style={S.toolbar}>
        <button className="btn" onClick={() => window.print()}>{t('character.print')}</button>
      </div>
      <CharacterPrintView characterId={characterId} />
    </>
  )
}

const S = {
  toolbar: { padding: '12px 16px', position: 'sticky', top: 0, background: 'var(--bg-panel, #1a1a2e)', zIndex: 1 },
}
