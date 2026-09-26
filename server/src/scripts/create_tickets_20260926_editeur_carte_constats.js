// Script à usage unique — crée les tickets des dettes trouvées en analysant le chantier « rework de l'éditeur de carte »
// (2026-09-26, docs/PLANS/PLAN_EDITEUR_CARTE.md §7). Le niveau de preuve est indiqué dans chaque description.
// Lancement manuel, local : node --env-file=.env server/src/scripts/create_tickets_20260926_editeur_carte_constats.js
// Écrit dans la base locale (bug_tickets uniquement) — idempotent : ne recrée pas un ticket dont le linked_bug_code existe déjà.

import db from '../db/knex.js'

const TICKETS = [
  {
    code: 'BATTLEMAP-DUPLICATE-INCOMPLETE',
    category: 'bug',
    domain: 'editeur',
    title: "Dupliquer une carte perd ses entités, son fond 2D, son mode de rendu et ses réglages de grille",
    description: `
Trouvé en analysant le périmètre d'une carte pour l'export (2026-09-26). [VÉRIFIÉ par lecture] \`POST /api/battlemaps/:id/duplicate\`
(server/src/routes/battlemaps.js) n'insère que : nom, dossier, scale_label, grid_size, grid_enabled, grid_opacity, voxel_data, surface_data.
Il ne copie PAS : \`render_mode\`, \`grid_offset_x/y\`, \`voxel_scale\`, \`viewport_state\`, \`image_url\` (fond d'une carte 2D), ni les entités
(table \`entities\`). [HYPOTHÈSE] une carte 2D dupliquée devient une carte 3D sans fond ; une carte 3D dupliquée perd tous ses objets posés.
[INCONNU] si c'est voulu pour les entités (le commentaire du code ne justifie que image_url et cover_image_url).

Piste : factoriser une fonction unique « clone d'une carte » partagée avec l'import d'export de carte (segment S0 du chantier), plutôt que corriger
duplicate isolément. Un plan = un problème : à traiter avec S0, pas avant.
`.trim(),
    context: { fichiers: ['server/src/routes/battlemaps.js (POST /:id/duplicate)'], plan: 'docs/PLANS/PLAN_EDITEUR_CARTE.md §7 (S0)' },
    status: 'new',
    priority: 'medium',
  },
  {
    code: 'SURFACE-TEXTURE-COLLECTORS-DIVERGE',
    category: 'bug',
    domain: 'editeur',
    title: "Deux collecteurs d'identifiants de textures divergent : le client oublie les textures de profils d'apparence de mur",
    description: `
Trouvé en analysant les décorations murales (2026-09-26). [VÉRIFIÉ par lecture] Le serveur (\`collectSurfaceTextureIds\`, shared/world/surfaceDocument.js)
compte \`rooms[].wallAppearanceProfiles[].interiorTex\` ; le client (\`surfaceTextureIds\`, client/src/lib/surfaceData.js) ne le compte pas.
Le client s'en sert pour charger les textures en mode jeu (Canvas3D.jsx, effet « Chargement des voxel_textures nécessaires »).
[HYPOTHÈSE] une texture référencée uniquement par un profil d'apparence de mur n'est pas chargée en mode jeu (mur sans sa texture) ; non reproduit.
[INCONNU] si un autre chemin la charge quand même.

Piste : une seule fonction, partagée (shared/world/), utilisée par le serveur, le client et l'export de carte. Deux copies d'une même règle = invariant 3.
`.trim(),
    context: { fichiers: ['shared/world/surfaceDocument.js (collectSurfaceTextureIds)', 'client/src/lib/surfaceData.js (surfaceTextureIds)', 'client/src/components/Canvas3D.jsx'] },
    status: 'new',
    priority: 'low',
  },
  {
    code: 'DOOR-EFFECTIVE-STATE-DUPLICATED',
    category: 'other',
    domain: 'editeur',
    title: "La formule de l'état effectif d'une porte est écrite deux fois (compilateur et panneau) — une troisième serait nécessaire au rendu",
    description: `
Trouvé en analysant le rendu 3D des portes (2026-09-26). [VÉRIFIÉ par lecture] \`runtimeState?.state || connector.state || 'closed'\` figure dans
shared/world/worldCompiler.js (ligne ~466) et client/src/components/SurfaceConnectorPanel.jsx (ligne ~126). Le rendu 3D des portes (segment S4) devrait la refaire
une troisième fois pour animer le GLB selon l'état.

Piste : un helper partagé unique (shared/world/connectorActions.js), utilisé par le compilateur, le panneau et le rendu — à traiter avec S4, pas avant.
`.trim(),
    context: { fichiers: ['shared/world/worldCompiler.js', 'client/src/components/SurfaceConnectorPanel.jsx'], plan: 'docs/PLANS/PLAN_EDITEUR_CARTE.md §7 (S4)' },
    status: 'new',
    priority: 'low',
  },
  {
    code: 'DOC-ROADMAP-DECALS-LINE-STALE',
    category: 'other',
    domain: 'autre',
    title: "ROADMAP.md : la ligne « Décorations murales » dit toujours « chevauchement non résolu » alors qu'il est résolu depuis le 2026-09-16",
    description: `
Trouvé le 2026-09-26. [VÉRIFIÉ par lecture] \`docs/ROADMAP.md\` (§2, ligne « Décorations murales (décals) ») décrit un chevauchement non résolu entre
\`PLAN_DECALS.md\` et \`PLAN_RW_MATERIAUX.md\` Lot 3 ; \`PLAN_DECALS.md\` (en-tête) et \`docs/VOCABULARY.md\` (« Ambiguïtés connues — Décal ») le disent résolu le 2026-09-16.
Le fichier ROADMAP.md avait des modifications non commitées au moment du constat : à corriger avec les lignes de renvoi vers PLAN_EDITEUR_CARTE.md
(export de carte, rework world builder, décals), en une seule passe et un staging partiel.
`.trim(),
    context: { fichiers: ['docs/ROADMAP.md'] },
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
