import { DndContext } from '@dnd-kit/core'
import CharacterSheet from './CharacterSheet'
import ArmorWoundPanel from './ArmorWoundPanel'
import WeaponPanel from './WeaponPanel'
import InventoryPanel from './InventoryPanel'
import GaugesPanel from './GaugesPanel'

// ─── CharacterPrintView — fiche complète, une seule page, lecture seule ────────────
// (docs/PLANS/PLAN_FICHE_HORSLIGNE.md, Lot D). `CharacterWindow.jsx` ne convient pas tel quel : il ne
// monte qu'un onglet à la fois (Fiche/Matériel/Bio/Paramètres, `activeTab === '...' && (...)`,
// vérifié) — une feuille de style d'impression posée dessus n'imprimerait que l'onglet ouvert au
// moment du clic, jamais la fiche complète. Ce composant compose directement `CharacterSheet`
// (onglet "Fiche") et les panneaux de l'onglet "Matériel" (`ArmorWoundPanel`/`WeaponPanel`/
// `InventoryPanel`/`GaugesPanel`) l'un sous l'autre, sans le chrome de fenêtre flottante
// (drag/resize/onglets) qui n'a aucun sens sur une page imprimée.
//
// Lecture seule via `isGm={false}`/`isOwner={false}` — pas un nouveau mode à construire : c'est déjà
// l'état exact dans lequel ces composants tournent quand un joueur consulte la fiche d'un AUTRE
// personnage en jeu (`canEdit = isGm || isOwner`, `CharacterSheet.jsx:669`), donc un chemin déjà
// exercé, pas une nouvelle combinaison d'états à valider.
//
// `DndContext` sans capteurs/gestionnaires : `ArmorWoundPanel`/`WeaponPanel`/`InventoryPanel`
// utilisent `useDraggable`/`useDroppable` (dnd-kit) en interne, qui exigent un ancêtre `DndContext` —
// même motif que `CharacterWindow.jsx`, sans le glisser-déposer réel (sans objet à imprimer).
//
// `print-white-theme` (`index.css`) : fond blanc/texte noir forcés sur toute la vue (le thème sombre
// de l'appli, conçu pour l'écran en jeu, est illisible imprimé/sur papier — retour direct de Saar
// après premier test). Les couleurs de sévérité des blessures sont explicitement restaurées par cette
// même feuille de style (`--severity-bg`, posé dans `LocationPanel.jsx`) — seule exception voulue.
//
// Disposition demandée par Saar après test : Armure (`ArmorWoundPanel`) à gauche (50%), Arme puis Sac
// (`WeaponPanel`/`InventoryPanel`) empilés à droite (50%) — plutôt que tout empilé pleine largeur.
export default function CharacterPrintView({ characterId }) {
  return (
    <div className="app-shell print-white-theme" style={S.page}>
      <CharacterSheet characterId={characterId} isGm={false} isOwner={false} onSaved={() => {}} />
      <DndContext>
        <div style={S.materielRow}>
          <div style={S.column}>
            <ArmorWoundPanel characterId={characterId} canEdit={false} dragItem={null} />
          </div>
          <div style={S.column}>
            <WeaponPanel characterId={characterId} canEdit={false} onOpenModing={() => {}} dragItem={null} />
            <InventoryPanel characterId={characterId} canEdit={false} isGm={false} hasCampaign={false} />
          </div>
        </div>
        <GaugesPanel characterId={characterId} isGm={false} />
      </DndContext>
    </div>
  )
}

const S = {
  page: { display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', maxWidth: '960px', margin: '0 auto' },
  materielRow: { display: 'flex', gap: '16px', alignItems: 'flex-start' },
  column: { display: 'flex', flexDirection: 'column', gap: '16px', width: '50%', minWidth: 0 },
}
