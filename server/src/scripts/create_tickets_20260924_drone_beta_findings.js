// Script à usage unique — crée 5 tickets issus des tests en jeu du chantier Drone d'interception (2026-09-24),
// tous HORS du périmètre de ce chantier (constats notés dans docs/PLANS/PLAN_DRONE_INTERCEPTION.md).
// Le constat « un token mort reste cible d'une zone » n'est PAS ici : la session « Gestion MORT » le traite.
// Lancement manuel, local : node --env-file=.env server/src/scripts/create_tickets_20260924_drone_beta_findings.js
// Idempotent : ne recrée pas un ticket dont le linked_bug_code existe déjà.

import db from '../db/knex.js'

const TICKETS = [
  {
    code: 'CHANCE-PNJ-WINDOW-UNCLEAR',
    origin: 'gm',
    category: 'bug',
    domain: 'combat',
    title: 'Fenêtre Chance PNJ « Catastrophe — … / Éviter la zone d\'effet » peu claire',
    description: `
Signalé par Saar (2026-09-24), test d'une grenade à fragmentation : la fenêtre affichée au MJ portait le titre
« Catastrophe — Jean Val-Jean » puis « Grenade à fragmentation — Éviter la zone d'effet (Jean Val-Jean) » ; Saar :
« c'était pas clair », il a cliqué « Test de Chance ».

Faits [VÉRIFIÉ] : le titre de la file MJ est « Catastrophe — Chance (PNJ) » (client/src/locales/combat.json, gmQueue.title),
réutilisé pour un simple CHOIX de Chance qui n'a rien d'une Catastrophe (site 'aoe_avoidance', openChanceChoice, boucle
« Éviter la zone d'effet » de resolveAoeAssaultAction). Le lanceur figure lui-même parmi les cibles : le RAW n'exclut
jamais le lanceur du souffle (rayon 15 m de la grenade à fragmentation), donc le MJ voit une fenêtre au nom du PNJ qui vient
de lancer la grenade.

Correctif non cadré [HYPOTHÈSE] : titre distinct selon le site du choix (Chance d'évitement ≠ Catastrophe) et texte disant
qui est menacé, par quoi, et ce que fait chaque bouton.
`.trim(),
    context: {
      fichiers: ['client/src/locales/combat.json (gmQueue.title)', 'server/src/socket/socketCombatAoe.js (aoe_avoidance)', 'server/src/lib/chanceCatastropheChoiceService.js'],
      origine: 'chantier Drone d\'interception, test grenade 2026-09-24',
    },
    status: 'new',
    priority: 'low',
  },
  {
    code: 'COMBAT-STALE-CONFIRM-MESSAGE-I18N',
    origin: 'gm',
    category: 'bug',
    domain: 'combat',
    title: 'Message « L\'ordre a changé entre-temps… » figé en français côté serveur et peu compréhensible',
    description: `
Signalé par Saar (2026-09-24) : le chat/la fenêtre affiche « L'ordre a changé entre-temps — c'est maintenant au tour de
Jean Val-Jean. Cette fenêtre n'est plus d'actualité, fermez-la. » ; Saar : « incompréhension ».

Faits [VÉRIFIÉ] : texte codé en dur dans server/src/socket/socketCombatResolution.js:304 (COMBAT_DECLARE_ERROR), ce qui
enfreint .claude/rules/i18n.md (le serveur n'émet jamais de texte figé destiné à l'utilisateur ; i18nKey + params). Déclenché
par COMBAT_ACTION_CONFIRM reçu pour un token qui n'est plus le pas courant de l'échelle (pickNextTimelineStep) — commentaire
« race légitime §6ter point 3 ».

À faire : clé i18n + formulation qui dise ce que l'utilisateur doit faire ; comprendre pourquoi une fenêtre de modificateurs
reste ouverte pour un token qui n'est plus courant (fermeture côté client ?) [INCONNU].
`.trim(),
    context: {
      fichier: 'server/src/socket/socketCombatResolution.js:304',
      regle: '.claude/rules/i18n.md',
    },
    status: 'new',
    priority: 'low',
  },
  {
    code: 'STUN-DURATION-CARD-SUCCESS-BADGE',
    origin: 'gm',
    category: 'bug',
    domain: 'combat',
    title: 'Carte « Durée d\'étourdissement » affichée avec un badge « succès » sans objet',
    description: `
Signalé par Saar (2026-09-24), après un Test de Choc raté (Jean Val-Jean, échec 12) : la carte de chat « Durée
d'étourdissement 1 » porte le badge « succès », ce qui n'a pas de sens pour un jet de durée.

Non investigué [INCONNU] : l'émetteur exact de la carte (statusService — applyStunWithDuration / emitShockDiceResult ?) et
le champ isSuccess qu'il pose ; le rendu de la carte est dans client/src/components/MessageRendererRegistry.jsx (badge
selon msg.isSuccess). Piste : ne pas poser isSuccess (ou un cardType dédié sans badge) pour un jet de durée.
`.trim(),
    context: {
      fichiers: ['server/src/lib/statusService.js', 'client/src/components/MessageRendererRegistry.jsx'],
      origine: 'chantier Drone d\'interception, test grenade 2026-09-24',
    },
    status: 'new',
    priority: 'low',
  },
  {
    code: 'PLAYER-CLIENT-403-PNJ-WOUNDS',
    origin: 'gm',
    category: 'bug',
    domain: 'combat',
    title: 'Le client d\'un joueur demande les blessures d\'un PNJ en combat : 403 répétés au journal serveur',
    description: `
Constaté au journal serveur pendant les tests du 2026-09-24 : « [403] GET /api/char-sheet/<personnage PNJ>/wounds
[user:Joueur Test] — You do not have permission to access this sheet », 3 fois d'affilée avant chaque tir de Jean Val-Jean
(9f6d406a…), et pour Baboulinet (e652c09d…). Les deux sont des PNJ (user_id NULL).

Le refus est correct (données protégées) ; c'est la REQUÊTE qui ne devrait pas partir. Appelants candidats [INCONNU, non
tracés] : client/src/character/ArmorWoundPanel.jsx:19, client/src/character/CharacterSheet.jsx:482, ou un hook de fenêtre
de combat qui charge les blessures du tireur/de la cible. À tracer avec le journal client.
`.trim(),
    context: {
      route: 'GET /api/char-sheet/:id/wounds',
      appelants_candidats: ['client/src/character/ArmorWoundPanel.jsx:19', 'client/src/character/CharacterSheet.jsx:482'],
    },
    status: 'new',
    priority: 'low',
  },
  {
    code: 'DRONE-INTEGRITY-LOSS-PER-HIT-RAW',
    origin: 'gm',
    category: 'other',
    domain: 'combat',
    title: 'Drone touché : -1 d\'intégrité à CHAQUE touche, même sous 5 de dégâts nets — à confronter au RAW',
    description: `
Observation du chantier Drone d'interception (2026-09-24), non corrigée volontairement.

Fait [VÉRIFIÉ] : resolveDroneIntegrityLoss (server/src/socket/socketCombatHelpers.js) fait newIntegrite = max(0,
integrite - 1) inconditionnellement — même quand les dégâts nets sont < 5 (aucune gravité, aucune case cochée). Le message de
chat « aucune blessure — intégrité 5 → 4 » le rend désormais visible. Le commentaire du code cite « LdB p.82-88 : 1 hit = 1 case
= integrite -= 1 ».

À trancher avec Saar [INCONNU] : le RAW (docs/REGLES/REGLEDRONE.md) dit-il que toute touche coûte un point d'intégrité, ou
seulement une touche qui inflige une gravité ? Si seulement une gravité, corriger aux appels de resolveDroneIntegrityLoss.
`.trim(),
    context: {
      fichier: 'server/src/socket/socketCombatHelpers.js (resolveDroneIntegrityLoss)',
      regle: 'docs/REGLES/REGLEDRONE.md',
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
