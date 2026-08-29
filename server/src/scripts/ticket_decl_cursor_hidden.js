// Script à usage unique — crée le ticket DECL-CURSOR-HIDDEN (curseur invisible après un clic sur une
// action de déclaration de combat). Diagnostic établi, pas de correctif codé (priorité élevée mais
// hors du chantier RW_DECLARE_DESIGN en cours). Lancement manuel, local uniquement :
//   node --env-file=.env server/src/scripts/ticket_decl_cursor_hidden.js
//
// Idempotent : ne recrée pas le ticket s'il existe déjà (clé = linked_bug_code).

import db from '../db/knex.js'

const CODE = 'DECL-CURSOR-HIDDEN'

const DESCRIPTION = `
Contexte : signalé par Saar (MJ) en testant le rework des fenêtres de déclaration de combat
(PLAN_RW_DECLARE_DESIGN). « Le curseur disparaît au clic sur une action, gênant pour sélectionner
une cible ou une destination. » Repro : ouvrir une fenêtre de déclaration, cliquer une action qui
entre en mode ciblage / déplacement (Tir → choisir une cible, Déplacement → choisir la zone) — le
pointeur souris devient invisible tant qu'on ne bouge pas la souris.

Diagnostic [VÉRIFIÉ par lecture] — client/src/components/SceneCursorOverlay.jsx :
- Au changement de mode (combatTargetMode / combatMoveMode), le 1er useEffect (dépendances
  [canvasEl, mode, inCombat]) pose immédiatement canvasEl.style.cursor = resolveCursorStyle(mode)
  = 'none' (le curseur natif est masqué : un overlay DOM <img> CURSEUR_CASE/CIBLE.svg doit le
  remplacer).
- Mais l'overlay <img> ne se monte que quand `pos` est non-null, et `pos` n'est renseigné que par
  le handler `pointermove` sur canvasEl (2e useEffect). Tant que la souris ne bouge pas après le
  changement de mode, `pos` reste null → l'overlay retourne null (ligne 88 : \`if (!pos) return null\`).
- Résultat : entre le changement de mode et le 1er pointermove, curseur natif = 'none' ET overlay
  absent = aucun curseur visible. Aggravé quand la fenêtre de déclaration se met en opacity:0 /
  pointer-events:none au même instant (le clic qui déclenche le mode part de la fenêtre, pas du
  canvas — donc pas de pointermove canvas immédiat).

Piste de correctif (NON codée, à valider) : au changement de mode, initialiser `pos` depuis la
dernière position pointeur connue (mémoriser le dernier clientX/clientY dans une ref alimentée
globalement, ou sur le dernier pointermove document), OU ne poser cursor:'none' qu'une fois `pos`
non-null. Le 2e useEffect gère déjà pointerleave → 'auto'.

Impact : purement client, aucun risque données. Gêne réelle en combat (ciblage/déplacement).
Hors périmètre du chantier RW_DECLARE_DESIGN (touche l'overlay curseur, pas les fenêtres).
`.trim()

async function run() {
  const existing = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (existing) {
    console.log(`Ticket ${CODE} existe déjà (id=${existing.id}, statut=${existing.status}) — rien à faire.`)
    return
  }

  const [row] = await db('bug_tickets')
    .insert({
      origin: 'gm',
      category: 'bug',
      domain: 'combat',
      title: 'Curseur invisible après un clic sur une action de déclaration (ciblage / déplacement)',
      description: DESCRIPTION,
      context: JSON.stringify({
        component: 'client/src/components/SceneCursorOverlay.jsx',
        reported_during: 'PLAN_RW_DECLARE_DESIGN — validation navigateur module 4',
        repro: 'ouvrir une fenêtre de déclaration, cliquer une action entrant en mode ciblage/déplacement',
      }),
      status: 'new',
      priority: 'high',
      linked_bug_code: CODE,
    })
    .returning(['id', 'status', 'priority'])

  console.log(`Ticket ${CODE} créé : id=${row.id}, statut=${row.status}, priorité=${row.priority}.`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
