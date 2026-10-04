// Script à usage unique — note sur les 3 tickets combat critiques traités le 2026-10-03/04
// (session de correction de bugs) : correctifs déjà codés et commités (32414bb2, 0624e89c,
// f478b341) mais jamais notés en base ni passés en 'in_progress' — oubli administratif comblé ici.
// Idempotent (skip si déjà noté). Lancement manuel, local :
//   node --env-file=.env server/src/scripts/note_tickets_20261004_combat_queue_hardened.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-04 : note de rattrapage (correctifs deja codes) ---'

const NOTES = {
  'COMBAT-DAMAGE-WINDOW-WRONG-TARGET': `

${MARKER}
Cause racine trouvée : le serveur (armAwaitingDamage) émet le prompt de dégâts suivant AVANT que
le client ait calculé/affiché le résultat courant — sans file, le state plat `+'`damagePayload`'+`
du client était écrasé par la cible suivante avant que la précédente soit traitée. Corrigé
(client/src/lib/combatDamageQueue.js, commit 32414bb2) : file pure modelée sur
CatastropheChoiceQueue.jsx (un seul élément affiché, on avance à la fermeture). Testé par
node --test (8/8 purs, reproduisant exactement ce scénario). Non testé : combat réel multi-cibles —
scénario détaillé dans docs/BETATEST.md, nécessite plusieurs clients simultanés que Saar ne peut
pas réunir seul.`,

  'COMBAT-WINDOW-CLOSES-BEFORE-DONE': `

${MARKER}
Pas de mécanisme unique identifié avec certitude pour ce symptôme précis — mais un défaut confirmé
de même nature que COMBAT-DAMAGE-WINDOW-WRONG-TARGET a été trouvé et corrigé par précaution :
`+'`attackResult`'+` écrasait silencieusement un résultat de tir par un autre lors d'attaques
multiples (même défaut de state plat sans file). Durci (combatDamageQueue.js : pushAttackResult/
dismissAttackQueueHead/currentAttackResult, commit 0624e89c). **Ce correctif durcit un défaut réel,
il ne ferme pas ce ticket avec certitude** — scénario de validation détaillé dans docs/BETATEST.md.`,

  'COMBAT-MULTI-ATTACK-ROUND-BROKEN': `

${MARKER}
Exploration complète de l'enchaînement d'attaques multiples (sélection côté PJ, découpage en
entrées d'échelle séparées par declaration_group_id, malus recalculé dynamiquement, résolution
entrée par entrée) — architecture cohérente vérifiée en lisant le code actuel, aucun défaut concret
trouvé en dehors de ceux déjà corrigés sous COMBAT-DAMAGE-WINDOW-WRONG-TARGET et
COMBAT-WINDOW-CLOSES-BEFORE-DONE. Correction annexe : mes propres commentaires (et
docs/SYSTEME/COMBAT_FLUX.md) citaient encore remainingMeleeActions/resolveMeleeAction, mécanisme
supprimé lors d'un refactor antérieur (docs/Old/PLAN_COMBAT_TIMELINE.md) — corrigés (commit
f478b341), doc à jour ticketée séparément (COMBAT-FLUX-DOC-STALE-TIMELINE). Le signalement initial
reste possiblement couvert par les deux correctifs ci-dessus, ou par un défaut non encore identifié
faute de repro précise — scénario de validation détaillé dans docs/BETATEST.md.`,
}

async function run() {
  for (const [code, note] of Object.entries(NOTES)) {
    const ticket = await db('bug_tickets').where({ linked_bug_code: code }).first()
    if (!ticket) { console.log(`[SKIP] ${code} — ticket introuvable`); continue }
    if ((ticket.admin_notes || '').includes(MARKER)) { console.log(`[SKIP] ${code} — déjà noté`); continue }
    await db('bug_tickets').where({ id: ticket.id }).update({
      status: 'in_progress',
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    console.log(`[OK] ${code} — note ajoutée, statut -> in_progress`)
  }
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
