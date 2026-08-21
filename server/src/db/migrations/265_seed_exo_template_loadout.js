/**
 * Migration 265 — seed du loadout des 16 armures RAW prémade (PLAN_EXOARMURE.md §13.4.4/§14)
 *
 * Transcrit les notes de la session de transcription RAW (2026-08-21, "une armure à la fois,
 * vérification systématique contre le catalogue réel") dans `ref_exo_template_equipment` +
 * `ref_exo_template_computers`. Chaque ligne ci-dessous correspond exactement à une ligne numérotée
 * du plan (§13.4.4, une sous-section par armure) — relire cette section pour la justification
 * détaillée de chaque résolution (dague/pistolet/mitrailleuse, coquilles RAW, artefacts OCR de rupture
 * de page, etc.), non répétée ici pour ne pas dupliquer la source (CLAUDE.md Priorité #4).
 *
 * Résolution par clé métier (`name`), jamais par `id` en dur (.claude/rules/core.md) — trois
 * catalogues source : `ref_exo_templates` (16 modèles), `ref_exo_equipment` (systèmes/armes propres
 * aux exo-armures, migrations 251/261/264), `ref_equipment` (catalogue général, liens `ref_equipment_id`
 * via l'exclusive arc migration 260/262).
 *
 * Conventions actées pendant la transcription (détail et justification : PLAN_EXOARMURE.md §14) :
 * - `level` sur "Système respiratoire • Réserve d'oxygène" = nombre d'unités de 24h (1→24h, 2→48h,
 *   3→72h) — décision Saar, propre à cette ligne, pas un sens général de `level`.
 * - Une quantité RAW explicite ("xN", "Deux", "2 tubes") = répétition de la ligne catalogue ; une
 *   quantité de munitions ("N charges"/"N tirs") = jamais trackée, une seule ligne.
 * - "(principal)"/"(secours)" sur une paire non qualifiée en RAW (interfaces, SACEA, ordinateurs) =
 *   inféré par déduction (l'un est explicitement secours, l'autre est donc principal), annoté comme tel.
 *
 * id laissés à gen_random_uuid() sur les deux tables de loadout (pas de clé métier propre à une ligne
 * de loadout — l'idempotence de re-run repose sur le down() scopé par template_id, pas sur le contenu).
 */

// ─── Constructeurs de ligne (family fixée par le tableau qui les contient) ────────────────────────
const sys = (name, level = null, label = null) => ({ family: 'systeme', source: 'exo', name, level, label })
const sysGen = (name, label = null) => ({ family: 'systeme', source: 'gen', name, level: null, label })
const arm = (name, label = null) => ({ family: 'arme', source: 'exo', name, level: null, label })
const armGen = (name, label = null) => ({ family: 'arme', source: 'gen', name, level: null, label })
const rep = (row, n) => Array.from({ length: n }, () => row)

const OXY_24H = () => sys('Système respiratoire • Réserve d’oxygène', 1)
const OXY_48H = () => sys('Système respiratoire • Réserve d’oxygène', 2)
const OXY_72H = () => sys('Système respiratoire • Réserve d’oxygène', 3)
const SACEA = 'Système d\'assistance et de contrôle des exo-armures (SACEA)'
const MODULE_ANNEXE = 'Dispositif d\'auto-réparation • Module annexe'

// ─── Les 16 armures (PLAN_EXOARMURE.md §13.4.4, une entrée = une sous-section du plan) ────────────
const ARMORS = [
  {
    template: 'Explora',
    computers: [{ role: 'principal', gen: 3, nt: 3 }],
    equipment: [
      sys('Interface de contrôle • Commande vocale'),
      OXY_24H(),
      sys('Sonscan actif directionnel'),
      sys('Sonscan passif'),
      sys('Analyseur • Sea-Star'),
      sys('Radar'),
      sys('Analyseur • Sea-Star'),
      sys('Communicateur pour armure • Lénid'),
      sys('Communicateur pour armure • ComLink'),
      sys('Régulateur thermique'),
      sys('Système de filtrage hygiénique', 1),
      sys('Système de navigation', 10),
      sys('Détecteur d\'acquisition'),
      sys(SACEA),
      sys('Contrôle de pression'),
      sysGen('Générateur de lumière Feu Follet'),
      sys('Affichage tactique'),
      sys('Analyseur environnemental'),
      sys('Revêtement anti-radiations', 10),
      armGen('Dague Shark', 'Dague Shark (rétractable)'),
      arm('Générateurs défensifs électrique'),
      armGen('Lance-harpon moyen'),
    ],
  },
  {
    template: 'Typhon',
    computers: [{ role: 'principal', gen: 3, nt: 3 }],
    equipment: [
      sys('Interface de contrôle • Visière optique', null, 'Interface de contrôle • Visière optique (principal)'),
      sys('Interface de contrôle • Commandes manuelles', null, 'Panneau de contrôle manuel (secours)'),
      OXY_48H(),
      sys('Régulateur thermique'),
      sys('Système de filtrage hygiénique', 2),
      sys(SACEA),
      sys('Contrôle de pression'),
      sys('Système de navigation', 10),
      sys('Sonscan actif directionnel'),
      sys('Sonscan passif'),
      sys('Analyseur • Sea-Star', 12),
      sys('Radar'),
      sys('Analyseur • Sea-Star', 12),
      sys('Communicateur pour armure • ComLink'),
      sys('Communicateur pour armure • ComDive 200'),
      sys('Communicateur pour armure • Externe', 1),
      sys('Système d\'alimentation', 2),
      sys('Antivol • Verrouillage', 7),
      sys('Dispositif de diagnostic'),
      sys('Affichage tactique'),
      sys('Dispositif d\'auto-réparation • Centrale', 12),
      ...rep(sys(MODULE_ANNEXE), 5),
      armGen('Dague Shark', 'Dague Shark (rétractable)'),
      armGen('Dague thermique Thermo IV'),
      arm('Générateurs défensifs micro-ondes'),
      armGen('Lance-harpon moyen'),
    ],
  },
  {
    template: 'Nymph 1-A',
    computers: [{ role: 'principal', gen: 5, nt: 3 }, { role: 'secours', gen: 2, nt: 2 }],
    equipment: [
      sys('Interface de contrôle • Commandes manuelles'),
      OXY_24H(),
      sys('Régulateur thermique'),
      sys(SACEA, null, 'SACEA (principal)'),
      sys(SACEA, null, 'SACEA (secours)'),
      sys('Contrôle de pression'),
      sys('Sonscan actif directionnel'),
      sys('Sonscan passif'),
      sys('Analyseur • Sea-Star', 12),
      sys('Communicateur pour armure • Lénid'),
      sys('Communicateur pour armure • ComLink'),
      sys('Antivol • Verrouillage', 5),
      sysGen('Générateur de lumière Feu Follet'),
      armGen('Dague moléc. Pulsar'),
      arm('Générateurs défensifs électrique'),
      armGen('Lance-harpon lourd'),
    ],
  },
  {
    template: 'Série A',
    computers: [{ role: 'principal', gen: 2, nt: 3 }],
    equipment: [
      sys('Interface de contrôle • Commandes manuelles'),
      OXY_24H(),
      sys('Régulateur thermique'),
      sys('Système de filtrage hygiénique', 2),
      sys(SACEA),
      sys('Contrôle de pression'),
      sys('Système de navigation', 10),
      sys('Sonscan actif directionnel'),
      sys('Sonscan passif'),
      sys('Analyseur • Sea-Star', 12),
      sys('Communicateur pour armure • ComLink'),
      armGen('Dague Shark', 'Dague Shark (rétractable)'),
      arm('Générateurs défensifs électrique'),
      armGen('Lance-harpon moyen'),
    ],
  },
  {
    template: 'Vanguard',
    computers: [{ role: 'principal', gen: 3, nt: 4 }],
    equipment: [
      sys('Interface de contrôle • Visière optique', null, 'Interface de contrôle • Visière optique (principal)'),
      sys('Interface de contrôle • Commandes manuelles', null, 'Panneau de contrôle manuel (secours)'),
      OXY_24H(),
      sys('Régulateur thermique'),
      sys('Système de filtrage hygiénique', 2),
      sys(SACEA),
      sys('Contrôle de pression'),
      sys('Système de navigation', 13),
      sys('Sonscan actif directionnel'),
      sys('Sonscan passif'),
      sys('Analyseur • Sea-Star'),
      sys('Communicateur pour armure • ComDive 200'),
      sys('Communicateur pour armure • ComLink'),
      sys('Système d\'alimentation', 2),
      sys('Antivol • Verrouillage', 7),
      sys('Dispositif de diagnostic'),
      armGen('Locard ExelP'),
      armGen('Dague Shark', 'Dague Shark (rétractable)'),
      arm('Générateurs défensifs électrique'),
      armGen('Lance-harpon lourd'),
    ],
  },
  {
    template: 'Sylph 56',
    computers: [{ role: 'principal', gen: 2, nt: 4 }],
    equipment: [
      sys('Interface de contrôle • Visière optique', null, 'Interface de contrôle • Visière optique (principal)'),
      sys('Interface de contrôle • Commandes manuelles', null, 'Panneau de contrôle manuel (secours)'),
      OXY_24H(),
      sys('Régulateur thermique'),
      sys('Système de filtrage hygiénique', 2),
      sys(SACEA),
      sys('Contrôle de pression'),
      sys('Système de navigation', 13),
      sys('Sonscan actif directionnel'),
      sys('Sonscan passif'),
      sys('Analyseur • Sea-Star'),
      sys('Communicateur pour armure • Lénid'),
      sys('Communicateur pour armure • ComLink'),
      sysGen('Générateur de lumière Feu Follet'),
      sys('Caméra'),
      armGen('Dague moléc. Pulsar'),
      arm('Générateurs défensifs électrique'),
      armGen('Lance-harpon lourd'),
    ],
  },
  {
    template: 'Vauban',
    computers: [{ role: 'principal', gen: 3, nt: 4 }],
    equipment: [
      sys('Interface de contrôle • Visière optique', null, 'Interface de contrôle • Visière optique (principal)'),
      sys('Interface de contrôle • Commandes manuelles', null, 'Panneau de contrôle manuel (secours)'),
      OXY_24H(),
      sys('Régulateur thermique'),
      sys('Système de filtrage hygiénique', 2),
      sys(SACEA),
      sys('Contrôle de pression'),
      sys('Système de navigation', 13),
      sys('Dispositif d\'isolation', null, 'Dispositif d\'isolation (amphibie)'),
      sys('Radar'),
      sys('Analyseur • Sea-Star'),
      sys('Communicateur pour armure • Externe', 3),
      sys('Communicateur pour armure • ComLink'),
      sys('Système d\'alimentation', 2),
      sys('Antivol • Verrouillage', 7),
      sys('Dispositif de diagnostic'),
      sys('Analyseur environnemental'),
      sys('Détecteur d\'acquisition'),
      sys('Revêtement anti-radiations', 15),
      armGen('Dague Shark', 'Dague Shark (rétractable)'),
      arm('Générateurs défensifs électrique'),
      armGen('Faucheur III'),
    ],
  },
  {
    template: 'Condor',
    computers: [{ role: 'principal', gen: 3, nt: 4 }, { role: 'secours', gen: 2, nt: 4 }],
    equipment: [
      sys('Interface de contrôle • Commande vocale', null, 'Interface de contrôle • Commande vocale (principal)'),
      sys('Interface de contrôle • Commandes manuelles', null, 'Panneau de contrôle manuel (secours)'),
      sys('Radar'),
      sys('Analyseur • Sea-Star'),
      sys('Détecteur de mouvements', 13),
      sys('Dispositif d\'isolation', null, 'Dispositif d\'isolation (amphibie)'),
      sys(SACEA),
      OXY_24H(),
      sys('Senseur auditif', 12, 'Senseur auditif (+2 options au choix)'),
      sys('Senseur visuel', 15, 'Senseur visuel (+2 options au choix)'),
      sys('Communicateur pour armure • Haut-parleur'),
      sys('Affichage tactique'),
      sys('Analyseur environnemental'),
      sys('Antivol • Reconnaissance neuronale'),
      sys('Dispositif de diagnostic'),
      sys('Dispositif d\'auto-réparation • Centrale', 12),
      ...rep(sys(MODULE_ANNEXE), 10),
      sys('Disp. d\'assistance médicale', 5),
      armGen('Dague neurale Brain'),
      armGen('Dague moléc. Pulsar'),
      armGen('Fusil sonique incap. sirène'),
      armGen('F67'),
      armGen('Lance-flammes'),
    ],
  },
  {
    template: 'Cougar',
    computers: [{ role: 'principal', gen: 3, nt: 2 }],
    equipment: [
      sys('Interface de contrôle • Commande vocale', null, 'Interface de contrôle • Commande vocale (principal)'),
      sys('Interface de contrôle • Commandes manuelles', null, 'Panneau de contrôle manuel (secours)'),
      OXY_24H(),
      ...rep(sys('Système respiratoire • Filtre à air'), 4),
      sys('Dispositif d\'isolation', null, 'Dispositif d\'isolation (amphibie)'),
      sys('Stabilisateur'),
      sys('Amortisseurs de saut'),
      sys('Régulateur thermique'),
      sys('Système de filtrage hygiénique', 2),
      sys('Système d\'alimentation', 4),
      sys(SACEA),
      sys('Communicateur pour armure • Externe', 5),
      sys('Communicateur pour armure • ComLink'),
      sys('Radar'),
      sys('Analyseur • Sea-Star'),
      sys('Calculateur de tir Nemrod'),
      sys('Détecteur d\'acquisition'),
      sys('Analyseur environnemental'),
      sys('Revêtement anti-radiations', 13),
      armGen('Dague thermique Thermo IV'),
      armGen('Oxi4'),
      ...rep(arm('Lance-missiles Taille 2'), 2),
    ],
  },
  {
    template: 'Mentor',
    computers: [{ role: 'principal', gen: 4, nt: 3 }],
    equipment: [
      sys('Interface de contrôle • Commande vocale', null, 'Interface de contrôle • Commande vocale (principal)'),
      sys('Interface de contrôle • Commandes manuelles', null, 'Panneau de contrôle manuel (secours)'),
      sys('Sonscan actif directionnel'),
      sys('Sonscan passif'),
      sys('Analyseur • Sea-Star'),
      OXY_24H(),
      sys('Régulateur thermique'),
      sys('Système de filtrage hygiénique', 2),
      sys('Système d\'alimentation', 2),
      sys('Communicateur pour armure • Lénid'),
      sys('Communicateur pour armure • ComLink'),
      sys(SACEA, null, 'SACEA (principal)'),
      sys(SACEA, null, 'SACEA (secours)'),
      sys('Contrôle de pression'),
      sysGen('Générateur de lumière Feu Follet'),
      sys('Balise de détresse'),
      sys('Antivol • Verrouillage', 7),
      armGen('Canon à neutron'),
      armGen('Dague moléc. Pulsar'),
      arm('Générateurs défensifs électrique'),
      armGen('Lance-harpon lourd'),
    ],
  },
  {
    template: 'Heimdall-Pyrelia',
    computers: [{ role: 'principal', gen: 2, nt: 4 }, { role: 'secours', gen: 1, nt: 2 }],
    equipment: [
      sys('Interface de contrôle • Interface neuronale de commande télépathique', null, 'Interface neuronale de contrôle • Commandes télépathiques (principal)'),
      sys('Interface de contrôle • Commande vocale', null, 'Interface de contrôle • Commande vocale (secours)'),
      sys('Interface de contrôle • Commandes manuelles', null, 'Panneau de contrôle manuel (secours)'),
      sys('Sonscan actif directionnel'),
      sys('Sonscan passif'),
      sys('Analyseur • Sea-Star'),
      OXY_24H(),
      sys('Régulateur thermique'),
      sys('Communicateur pour armure • Lénid'),
      sys('Communicateur pour armure • ComLink'),
      sys(SACEA, null, 'SACEA (principal)'),
      sys(SACEA, null, 'SACEA (secours)'),
      sys('Contrôle de pression'),
      sysGen('Générateur de lumière Feu Follet'),
      sys('Balise de détresse'),
      sys('Antivol • Verrouillage', 7),
      sysGen('Grappin magnétique Rhaz'),
      sys('Affichage tactique'),
      sys('Détecteur d\'acquisition'),
      sys('Disp. d\'assistance médicale', 4),
      sys('Atténuateur sonore', 3, 'Atténuateur sonore (Masqueur Tri-Magma)'),
      armGen('Dague moléc. Pulsar'),
      armGen('Lance-harpon lourd'),
      armGen('Lance-filet'),
    ],
  },
  {
    template: 'Ouraken',
    computers: [{ role: 'principal', gen: 4, nt: 3 }],
    equipment: [
      sys('Interface de contrôle • Filet neuronal', null, 'Interface de contrôle • Filet neuronal (principal)'),
      sys('Interface de contrôle • Commande vocale', null, 'Interface de contrôle • Commande vocale (secours)'),
      OXY_72H(),
      sys('Sonscan actif directionnel'),
      sys('Sonscan passif'),
      sys('Analyseur • Sea-Star'),
      sys('Calculateur de tir Nemrod'),
      sys('Communicateur pour armure • Lénid'),
      sys('Communicateur pour armure • ComLink'),
      sys('Régulateur thermique'),
      sys('Balise de détresse'),
      sys('Système de filtrage hygiénique', 1),
      sys('Système d\'alimentation', 2),
      sys('Système de navigation', 13),
      sys('Détecteur d\'acquisition'),
      sys(SACEA),
      sys('Contrôle de pression'),
      sysGen('Générateur de lumière Feu Follet'),
      sys('Affichage tactique'),
      sys('Champ IEM anti-torpille (champ sphère)', 3),
      sys('Autopilote', 12),
      sys('Antivol • Reconnaissance neuronale'),
      armGen('Dague thermique Thermo IV'),
      armGen('Canon à neutron'),
      armGen('Lance-harpon lourd'),
      arm('Lance-harpons AV multiple'),
      ...rep(arm('Lance-torpilles Taille 3'), 2),
    ],
  },
  {
    template: 'Odin',
    computers: [{ role: 'principal', gen: 2, nt: 4 }, { role: 'secours', gen: 1, nt: 2 }],
    equipment: [
      sys('Interface de contrôle • Visière optique', null, 'Interface de contrôle • Visière optique (principal)'),
      sys('Interface de contrôle • Commandes manuelles', null, 'Panneau de contrôle manuel (secours)'),
      sys('Sonscan actif directionnel'),
      sys('Sonscan passif'),
      sys('Analyseur • Sea-Star'),
      sys('Calculateur de tir Nemrod'),
      sys('Régulateur thermique'),
      sys('Communicateur pour armure • Lénid'),
      sys('Communicateur pour armure • ComLink'),
      OXY_72H(),
      sys(SACEA, null, 'SACEA (principal)'),
      sys(SACEA, null, 'SACEA (secours)'),
      sys('Contrôle de pression'),
      sys('Balise de détresse'),
      sys('Détecteur d\'acquisition'),
      sys('Disp. d\'assistance médicale', 4),
      sysGen('Générateur de lumière Feu Follet'),
      sys('Affichage tactique'),
      sys('Champ IEM anti-torpille (champ sphère)', 3),
      sys('Centre de commande de drones'),
      armGen('Dague moléc. Pulsar'),
      armGen('Canon à neutron'),
      arm('Générateurs défensifs micro-ondes'),
      arm('Lance-harpons AV multiple'),
    ],
  },
  {
    template: 'Vulcain',
    computers: [{ role: 'principal', gen: 3, nt: 3 }],
    equipment: [
      sys('Interface de contrôle • Visière optique', null, 'Interface de contrôle • Visière optique (principal)'),
      sys('Interface de contrôle • Commandes manuelles', null, 'Panneau de contrôle manuel (secours)'),
      sys('Sonscan actif directionnel'),
      sys('Sonscan passif'),
      sys('Analyseur • Sea-Star'),
      sys('Contrôle de pression'),
      sys('Communicateur pour armure • Lénid'),
      sys('Régulateur thermique'),
      sys('Stabilisateur'),
      sys('Communicateur pour armure • ComLink'),
      OXY_72H(),
      sys(SACEA, null, 'SACEA (principal)'),
      sys(SACEA, null, 'SACEA (secours)'),
      sysGen('Générateur de lumière Feu Follet'),
      sys('Caméra'),
      sys('Autopilote', 10),
      sys('Dispositif de diagnostic'),
      sys('Balise de détresse'),
      sys('Dispositif d\'auto-réparation • Centrale', 12),
      ...rep(sys(MODULE_ANNEXE), 10),
      sys('Système d\'alerte'),
      sys('Système de filtrage hygiénique', 1),
      sys('Système d\'alimentation', 1),
      sys('Système de navigation', 12),
      arm('Excavateur mécanique'),
      arm('Griffe mécanique'),
      arm('Torche de forage Hydra'),
    ],
  },
  {
    template: 'Moloch',
    computers: [{ role: 'principal', gen: 3, nt: 4 }, { role: 'secours', gen: 2, nt: 3 }],
    equipment: [
      sys('Interface de contrôle • Commande vocale', null, 'Interface de contrôle • Commande vocale (principal)'),
      sys('Interface de contrôle • Commandes manuelles', null, 'Panneau de contrôle manuel (secours)'),
      sys('Sonscan actif directionnel'),
      sys('Sonscan passif'),
      sys('Analyseur • Sea-Star'),
      sys('Calculateur de tir Nemrod'),
      sys('Communicateur pour armure • Lénid'),
      sys('Communicateur pour armure • ComLink'),
      sys('Détecteur d\'acquisition'),
      sys('Affichage tactique'),
      sysGen('Mémoire de cibles Mémo'),
      sys('Régulateur thermique'),
      sys('Stabilisateur'),
      sys(SACEA, null, 'SACEA (principal)'),
      sys(SACEA, null, 'SACEA (secours)'),
      sys('Contrôle de pression'),
      OXY_72H(),
      sys('Dispositif de diagnostic'),
      sys('Dispositif d\'auto-réparation • Centrale', 12),
      ...rep(sys(MODULE_ANNEXE), 10),
      sys('Disp. d\'assistance médicale', 5),
      sys('Systèmes « Dernière chance » • Injection de drogues'),
      sysGen('Générateur de lumière Feu Follet'),
      sys('Atténuateur sonore', 4),
      sys('Brouilleur sonscans Actif et passif', 3),
      sys('Centre de commande de drones'),
      sys('Balise de détresse'),
      sys('Système de filtrage hygiénique', 1),
      sys('Système d\'alimentation', 2),
      sys('Système de navigation', 13),
      armGen('Dague moléc. Pulsar'),
      armGen('Canon à neutron'),
      arm('Lance-harpons AV multiple'),
      ...rep(arm('Lance-torpilles Taille 2'), 2),
      arm('Lance-leurre Taille 3'),
    ],
  },
  {
    template: 'Orka',
    computers: [{ role: 'principal', gen: 4, nt: 4 }],
    equipment: [
      sys('Interface de contrôle • Visière optique', null, 'Interface de contrôle • Visière optique (principal)'),
      sys('Interface de contrôle • Commandes manuelles', null, 'Panneau de contrôle manuel (secours)'),
      sys('Communicateur pour armure • Lénid'),
      sys('Communicateur pour armure • ComLink'),
      sys('Sonscan actif directionnel'),
      sys('Sonscan passif'),
      sys('Analyseur • Sea-Star'),
      sys('Calculateur de tir Nemrod'),
      sys('Régulateur thermique'),
      sys('Contrôle de pression'),
      sys(SACEA, null, 'SACEA (principal)'),
      sys(SACEA, null, 'SACEA (secours)'),
      sys('Stabilisateur'),
      sysGen('Générateur de lumière Feu Follet'),
      OXY_72H(),
      sys('Dispositif de diagnostic'),
      sys('Dispositif d\'auto-réparation • Centrale', 12),
      ...rep(sys(MODULE_ANNEXE), 5),
      sys('Système de filtrage hygiénique', 1),
      sys('Système d\'alimentation', 2),
      sys('Système de navigation', 13),
      sys('Caméra'),
      sys('Affichage tactique'),
      sys('Autopilote', 12),
      armGen('Locard ExelP'),
      armGen('Dague thermique Thermo IV'),
      arm('Générateurs défensifs électrique'),
      arm('Lance-harpons AV multiple'),
    ],
  },
]

async function loadNameMaps(knex) {
  const [templates, exoEquip, genEquip] = await Promise.all([
    knex('ref_exo_templates').select('id', 'name'),
    knex('ref_exo_equipment').select('id', 'name'),
    knex('ref_equipment').select('id', 'name'),
  ])
  return {
    templateByName: new Map(templates.map((t) => [t.name, t.id])),
    exoByName: new Map(exoEquip.map((e) => [e.name, e.id])),
    genByName: new Map(genEquip.map((e) => [e.name, e.id])),
  }
}

export const up = async (knex) => {
  const { templateByName, exoByName, genByName } = await loadNameMaps(knex)

  for (const armor of ARMORS) {
    const templateId = templateByName.get(armor.template)
    if (!templateId) throw new Error(`Migration 265 : ref_exo_templates introuvable pour "${armor.template}"`)

    if (armor.computers.length) {
      await knex('ref_exo_template_computers').insert(
        armor.computers.map((c, i) => ({
          template_id: templateId,
          role: c.role,
          gen: c.gen,
          nt: c.nt,
          sort_order: i + 1,
        }))
      )
    }

    const equipmentRows = armor.equipment.map((e, i) => {
      const map = e.source === 'exo' ? exoByName : genByName
      const catalogId = map.get(e.name)
      if (!catalogId) {
        throw new Error(`Migration 265 : ref_${e.source === 'exo' ? 'exo_' : ''}equipment introuvable pour "${e.name}" (armure ${armor.template})`)
      }
      return {
        template_id: templateId,
        family: e.family,
        equipment_id: e.source === 'exo' ? catalogId : null,
        ref_equipment_id: e.source === 'gen' ? catalogId : null,
        label_override: e.label,
        level: e.level,
        sort_order: i + 1,
      }
    })
    await knex('ref_exo_template_equipment').insert(equipmentRows)
  }
}

export const down = async (knex) => {
  const templateIds = await knex('ref_exo_templates')
    .whereIn('name', ARMORS.map((a) => a.template))
    .pluck('id')
  await knex('ref_exo_template_equipment').whereIn('template_id', templateIds).delete()
  await knex('ref_exo_template_computers').whereIn('template_id', templateIds).delete()
}
