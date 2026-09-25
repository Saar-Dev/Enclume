// Script à usage unique — clôture les tickets de la guérison en chaîne VALIDÉS par Saar en réel (2026-09-25). Un ticket n'est ajouté à
// CLOSURES qu'après la validation de Saar (« fermer une règle de jeu exige une validation de Saar », AGENTS.md § Clôture).
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/resolve_tickets_20260925_guerison_chaine.js
// Écrit dans la base locale (`bug_tickets` uniquement) — à lancer par Saar. Idempotent : un ticket déjà résolu est laissé tel quel.

import db from '../db/knex.js'

const CLOSURES = [
  {
    code: 'WOUND-HEAL-CHAIN-STOPS',
    note:
      'Corrigé et validé en jeu par Saar le 2026-09-25 (commit 3839638) : woundUtils.js est le seul écrivain de character_wounds, chaque case naît avec son ' +
      'échéance de guérison (woundHealingSchedule.js), datée du jour d\'échéance de la guérison qui l\'a produite. Observé sur la base de Saar : Grave -> Moyenne ' +
      '(due 14760 = 10440 + 3 jours), Moyennes -> Légères, cycles hebdomadaires 2/3 et 4/5, 0 blessure guérissable sans échéance. La Chance et la case d\'infection ' +
      'ont aussi leur échéance (décisions de Saar). Suites : PLAN_REVUE_GUERISON.md (Lot 0 : une échéance meurt avec sa case ; Test suivant).',
  },
  {
    code: 'WOUND-ECHEANCE-GHOSTS',
    note:
      'Corrigé (Lot 0 de PLAN_REVUE_GUERISON.md) et validé en jeu par Saar le 2026-09-25 : woundUtils.js est le seul suppresseur de lignes de blessure (deleteWoundRows) ' +
      'et annule les échéances vivantes de guérison ET d\'infection de la case supprimée (statut cancelled, aucune ligne effacée) — promotion, amélioration, removeWound, /heal. ' +
      'L\'annulation d\'avance de temps les restaure ; l\'écran de revue ouvert retire la ligne (GAME_ECHEANCE_RESOLVED). Les 89 fantômes existants ont été annulés par le script ' +
      'cancel_ghost_wound_echeances_20260925.js.',
  },
  {
    code: 'WOUND-HEAL-ONESHOT-STUCK',
    note:
      'Corrigé (Lot 0 de PLAN_REVUE_GUERISON.md) et validé en jeu par Saar le 2026-09-25 : un seul calcul du Test suivant (buildFailedHealingReschedule) — un Échec ou une Catastrophe ' +
      'ne terminent plus jamais l\'échéance de guérison (échéance unique, 2e échec, dernière semaine d\'une Critique/Mortelle/Membre détruit). Nouvelle tentative : Moyenne/Grave = la durée ' +
      'de la gravité, soins constants = 1 semaine (décisions de Saar, Q2/Q2b). La case « soins continus » n\'a plus d\'effet serveur ; l\'écran la retire au Lot 2.',
  },
]

async function run() {
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  for (const { code, note } of CLOSURES) {
    const ticket = await db('bug_tickets').where({ linked_bug_code: code }).first()
    if (!ticket) { console.log(`Ticket ${code} introuvable — ignoré.`); continue }
    if (ticket.status === 'resolved') { console.log(`Ticket ${code} déjà résolu.`); continue }

    const [updated] = await db('bug_tickets')
      .where({ id: ticket.id })
      .update({
        status: 'resolved',
        reviewed_by: admin.id,
        reviewed_at: db.fn.now(),
        admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
        updated_at: db.fn.now(),
      })
      .returning(['id', 'status'])
    console.log(`Ticket ${code} (id=${updated.id}) -> ${updated.status}`)
  }
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
