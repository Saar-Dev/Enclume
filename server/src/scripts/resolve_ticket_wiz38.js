// Script à usage unique — clôture WIZ38 : base=0 au lieu de -3 pour une compétence (X) jamais
// entraînée par une origine, dans CareersAllocator.jsx (handleAllocInc/Dec + affichage board).
// Lancement manuel : node --env-file=.env server/src/scripts/resolve_ticket_wiz38.js

import db from '../db/knex.js'

const ID = 'e6f5cfb4-5f2e-4c2a-9b80-a8facc556ed4'

async function run() {
  const ticket = await db('bug_tickets').where({ id: ID }).first()
  if (!ticket) throw new Error(`Ticket ${ID} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    "Corrige 2026-08-22 : ajout de baseFor(skillId) dans CareersAllocator.jsx - retourne " +
    "baseMastery[skillId] si present (origine), sinon -3 pour un marker (X) (docs/SYSTEME/CHARACTER.md " +
    "PC11), 0 sinon. Remplace les 5 usages de baseMastery[...] ?? 0 (boardGroups.current, " +
    "handleAllocInc, handleAllocDec x2, disabled du bouton moins). Ne touche pas " +
    "shared/careerSkills.js#computeSkillAllocation : ce moteur utilisait deja correctement current = " +
    "baseMastery[skillId] ?? null et calcSkillCost gere lui-meme le deblocage -3 en interne (bug " +
    "confirme confine a l'UI de pas-a-pas, jamais au calcul de cout final). Verifie : un clic +1 sur " +
    "une competence (X) neuve part maintenant de -3 (nextTarget=-2), plus de saut direct a la cible. " +
    "eslint + build client propres. Note secondaire, hors scope, ticketee separement : revenir a " +
    "exactement -3 supprime l'allocation (cout 0) plutot que de facturer le point de deblocage."

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'in_progress', // codé, scénario réel (achat compétence (X) au wizard) non testé
      priority: 'high',
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
