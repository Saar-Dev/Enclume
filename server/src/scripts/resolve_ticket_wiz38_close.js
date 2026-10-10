// Script à usage unique — clôture le ticket WIZ38 « Step4 Profession : coût des compétences
// réservées (X) mal facturé à l'achat ».
// Suite de resolve_ticket_wiz38.js (exécuté 2026-08-22, status posé à in_progress — codé, scénario
// réel non re-testé). Décision de Saar (2026-10-10) : le correctif est confirmé par relecture
// (invariant 1, AGENTS.md), pas besoin d'un nouveau test ni d'une nouvelle validation en jeu pour
// clore. Vérifié en code, client/src/components/creation/CareersAllocator.jsx :
// - baseFor(skillId) (L297-301) renvoie -3 pour une compétence (X) jamais apprise par une origine
//   (au lieu du 0 fautif d'origine) -- un clic +1 part donc de -3 vers -2, pas vers la cible finale.
// - handleAllocInc/handleAllocDec (L398-405) utilisent bien baseFor(), pas baseMastery[...] ?? 0.
// - shared/careerSkills.js#computeSkillAllocation n'a jamais eu ce bug (baseMastery[skillId] ?? null).
// - Défaut connexe WIZ38-UNDOFREE1 (redescendre à -3 annulait le coût) également couvert par le
//   mécanisme floorIsPaid/isReservedUnlearned (L302-306, case 'ALLOC_SKILL' L64-75), cohérent avec
//   calcSkillCost (shared/polarisUtils.js L308-316) qui facture 1 pt pour se tenir à -3.
// Fermé sans nouveau test ni nouveau scénario réel -- décision explicite de Saar, pas un raccourci
// silencieux de ma part.
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/resolve_ticket_wiz38_close.js

import db from '../db/knex.js'

const ID = 'e6f5cfb4-5f2e-4c2a-9b80-a8facc556ed4'

async function run() {
  const ticket = await db('bug_tickets').where({ id: ID }).first()
  if (!ticket) throw new Error(`Ticket ${ID} introuvable.`)
  if (ticket.status === 'resolved') { console.log('Déjà résolu.'); return }
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-10 : clôturé, correctif déjà en place ---\n' +
    "Relecture complète de CareersAllocator.jsx confirme baseFor()/handleAllocInc/handleAllocDec " +
    "corrects (un clic = un niveau, plus de saut direct à la cible pour une compétence (X) jamais " +
    "apprise). computeSkillAllocation (shared/careerSkills.js) n'a jamais eu ce bug. Le défaut " +
    "connexe WIZ38-UNDOFREE1 est également couvert par floorIsPaid/isReservedUnlearned, cohérent " +
    "avec calcSkillCost. Décision de Saar : clôturer sans nouveau test automatisé ni nouveau " +
    "scénario réel dédié."

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

  console.log(`Ticket (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
