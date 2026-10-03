// Script à usage unique — crée 3 tickets signalés par Saar (2026-09-22) en point roadmap,
// vérifiés absents de bug_tickets et de ROADMAP.md avant création (requête directe + grep).
// Lancement manuel, local : node --env-file=.env server/src/scripts/create_tickets_20260922_roadmap_gaps.js
// Idempotent : ne recrée pas un ticket dont le linked_bug_code existe déjà.

import db from '../db/knex.js'

const TICKETS = [
  {
    code: 'DRONE-ORDERS-UI-ERGO',
    origin: 'gm',
    category: 'suggestion',
    domain: 'personnage',
    title: 'Drones — interface « Ordres permanents » sur la fiche personnage peu ergonomique',
    description: `
Signalé par Saar (2026-09-22), point roadmap. Le contrôle « ordres permanents » (cible + arme
surveillées, Sprint 2d) vit dans DroneWindow.jsx — bandeau toujours visible sous l'en-tête, deux
<select> (cible/arme). Choix d'implémentation posé par PLAN_DRONE.md § Sprint 2d (2026-09-17) :
DroneWindow est la seule fenêtre ouverte indépendamment du tour, donc le seul foyer cohérent pour
un contrôle « à tout moment » — mais jamais retravaillé ergonomiquement depuis, confirmé fonctionnel
en jeu réel le 2026-09-18 sans passe UX dédiée.

Pas de diagnostic détaillé ni de repro précise à ce stade — à préciser avec Saar (quel geste est
pénible : accès à la fenêtre, lisibilité des <select>, position du bandeau ?) avant de cadrer un
correctif.
`.trim(),
    context: {
      fichier: 'client/src/character/DroneWindow.jsx',
      origine: 'Sprint 2d — PLAN_DRONE.md § Mode ordres_permanents, fichiers touchés',
      lien: 'Sprint 3 (télépilotage) touche une zone UI adjacente (CombatActionWindow.jsx) — pas le même composant, vigilance de cohérence recommandée si retravaillé en même temps',
    },
    status: 'new',
    priority: 'low',
  },
  {
    code: 'ENCYCLOPEDIE-NOT-INTEGRATED',
    origin: 'gm',
    category: 'other',
    domain: 'autre',
    title: 'Encyclopédie RAW — aucun lien/intégration dans l\'application',
    description: `
Signalé par Saar (2026-09-22), point roadmap. Chantier Encyclopédie RAW en cours (composants
client/src/components/encyclopedia/, locale client/src/locales/encyclopedia.json,
docs/PLANS/PLAN_ENCYCLOPEDIA.md/ENCYCLOPEDIA_CONTEXT.md/ENCYCLOPEDIA_CONVERSION.md,
docs/ENCYCLOPEDIA_SHARED_INVENTORY.md) — non commité au moment de ce ticket. Aucune entrée de
navigation, lien ou route ne raccorde ce contenu au reste de l'application pour l'instant.

Pas un bug du chantier lui-même (cohérent avec son état d'avancement, rien n'indique qu'il devait
déjà être raccordé) — noté pour suivi, à clore ou reformuler une fois le chantier arrivé à l'étape
d'intégration.
`.trim(),
    context: {
      chantier: 'Encyclopédie RAW (non commité au 2026-09-22)',
      fichiers: [
        'client/src/components/encyclopedia/',
        'client/src/locales/encyclopedia.json',
        'docs/PLANS/PLAN_ENCYCLOPEDIA.md',
      ],
    },
    status: 'new',
    priority: 'low',
  },
  {
    code: 'FOG-NONUNIFORM-SKYDOME',
    origin: 'gm',
    category: 'bug',
    domain: 'monde',
    title: 'Playground — brouillard (fogExp2) uniforme sur toute la carte au lieu d\'être concentré en bordure',
    description: `
Signalé par Saar (2026-09-22) : l'effet de brouillard sur le playground est jugé insupportable —
attendu en bordure/limite de carte, de plus en plus épais en s'approchant du bord, mais observé
uniforme partout.

Cause identifiée par lecture directe [VÉRIFIÉ] : Skydome.jsx:18 utilise <fogExp2 attach="fog"
args={[config.fogColor, config.fogDensity]} /> — brouillard exponentiel-carré Three.js, dont la
densité dépend uniquement de la distance à la CAMÉRA, jamais de la position par rapport aux limites
de la carte/salle. C'est donc un brouillard de profondeur classique (épaissit avec l'éloignement du
regard, peu importe où sur la carte), pas un effet de bord de carte — d'où la sensation « présent
partout » plutôt que localisé aux limites.

Correctif non cadré : nécessite un brouillard radial centré sur les limites du monde/de la salle
(distance au bord plutôt qu'à la caméra) — hors du système fog standard Three.js, probablement un
shader custom ou une technique de fog par distance-to-edge. À cadrer avant de coder.
`.trim(),
    context: {
      fichier: 'client/src/components/Skydome.jsx:18',
      config: 'client/src/lib/skydomePresets.js (fogColor/fogDensity)',
      mecanisme_actuel: 'fogExp2 (distance caméra)',
      mecanisme_attendu: 'brouillard radial distance-au-bord de carte',
    },
    status: 'new',
    priority: 'medium',
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
        origin: t.origin,
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
