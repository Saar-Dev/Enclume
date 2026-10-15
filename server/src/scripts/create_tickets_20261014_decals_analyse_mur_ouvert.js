// Script à usage unique — crée le ticket d'une trouvaille faite en analysant PLAN_DECALS.md contre le
// code réel (2026-10-14, docs/JOURNALANALYSE.md section "2026-10-14 — reprise"). Lancement manuel,
// local : node --env-file=.env server/src/scripts/create_tickets_20261014_decals_analyse_mur_ouvert.js
// Écrit dans la base locale (bug_tickets uniquement) — idempotent : ne recrée pas un ticket dont le
// linked_bug_code existe déjà.

import db from '../db/knex.js'

const TICKETS = [
  {
    code: 'WALL-APPEARANCE-ORPHAN-ON-EXTERIOR-OPEN',
    category: 'bug',
    domain: 'editeur',
    title: "Supprimer un mur vers l'extérieur ne purge pas ses profils d'apparence/d'élévation — données fantômes qui peuvent ressusciter",
    description: `
Trouvé le 2026-10-14 en traçant, pour PLAN_DECALS.md, tous les endroits où \`wallAppearanceProfiles\`/
\`wallElevationProfiles\` sont réconciliés après un changement de forme de salle (client/src/lib/surfaceRooms.js).

[VÉRIFIÉ par lecture] Deux chemins existent déjà et purgent correctement ces deux tableaux par arête
retenue (\`prunedByRetainedEdges\`) : la fusion de deux salles (\`mergeRooms\`, lignes ~744-757) et la
peinture/effacement de cases (\`paintRoomFootprintCells\`, lignes ~974-975). \`deleteRoomBoundaryWalls\`
(ligne ~672) a DEUX branches selon le nombre de salles propriétaires de l'arête : \`ownerIds.length === 2\`
(fusion des deux salles, même fonction que ci-dessus, purge correcte) et \`ownerIds.length === 1\`
(mur ouvert vers l'extérieur, lignes 698-718) — cette seconde branche ajoute l'arête à
\`openWallEdgeKeys\` mais ne touche ni \`wallAppearanceProfiles\` ni \`wallElevationProfiles\` : leurs
entrées pour cette arête restent dans le document, orphelines.

[HYPOTHÈSE] Sans rendu de mur sur une arête \"ouverte\", l'entrée orpheline est aujourd'hui inerte (pas de
bug visible) — mais elle persiste dans \`surface_data\` et peut ressusciter si la même arête redevient un
mur plein plus tard (repeindre une case, fusionner une nouvelle salle sur le même contour) : l'apparence
ou l'élévation d'un mur disparu depuis longtemps réapparaîtrait silencieusement sur le nouveau mur, sans
qu'aucune action explicite de l'utilisateur ne l'ait reposée. Non reproduit en jeu.

Piste : appliquer le même \`prunedByRetainedEdges\` (déjà factorisé, réutilisé tel quel) dans la branche
\`ownerIds.length === 1\` de \`deleteRoomBoundaryWalls\`, au même titre que \`openWallEdgeKeys\` y est déjà
mis à jour. Pertinent pour PLAN_DECALS.md : si un futur \`wallDecorations[]\` suit le même patron
d'ancrage par arête (recommandé par docs/JOURNALANALYSE.md), il faudra écrire cette purge aux 3 endroits
dès la conception plutôt que de recopier ce trou — ne pas attendre que PLAN_DECALS révèle le même défaut
une seconde fois.
`.trim(),
    context: {
      fichiers: ['client/src/lib/surfaceRooms.js (deleteRoomBoundaryWalls, prunedByRetainedEdges)'],
      plan: 'docs/PLANS/PLAN_DECALS.md ; docs/JOURNALANALYSE.md (2026-10-14)',
    },
    status: 'new',
    priority: 'low',
  },
]

async function run() {
  for (const t of TICKETS) {
    const existing = await db('bug_tickets').where({ linked_bug_code: t.code }).first()
    if (existing) {
      console.log(`Ticket ${t.code} existe déjà (id=${existing.id}, statut=${existing.status}) — rien à faire.`)
      continue
    }

    const [row] = await db('bug_tickets')
      .insert({
        origin: 'admin',
        category: t.category,
        domain: t.domain,
        title: t.title,
        description: t.description,
        context: JSON.stringify(t.context),
        status: t.status,
        priority: t.priority,
        linked_bug_code: t.code,
      })
      .returning(['id', 'status', 'priority'])

    console.log(`Ticket ${t.code} créé : id=${row.id}, statut=${row.status}, priorité=${row.priority}.`)
  }
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
