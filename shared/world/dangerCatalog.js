// shared/world/dangerCatalog.js — La « bible RAW » des dangers environnementaux de combat
// (docs/PLANS/PLAN_ZONES_DANGER.md §2.D, §4). Patron shared/armorConstants.js / fallDamageConstants.js
// / environmentalHazardPresets.js (que ce fichier absorbera en Z1, §2.B — pas de duplication de
// chiffres entre les deux : ce fichier est la source, Z1 fait pointer l'ancien vers celui-ci).
//
// Chaque définition passe par normalizeEffectDefinition (shared/world/worldEffects.js) — même
// autorité de validation que les 5 builtins legacy et le custom MJ (invariant 2 : pas de 2ᵉ
// normaliseur). Zéro consommateur en Z0 : ce fichier ne change AUCUN comportement de jeu (§13.1).
//
// Chaque chiffre porte sa citation RAW (règle documentaire §5). Les 4 dernières entrées gaz
// (vésicant/suffocant/neurotoxique/assommant) reposent sur le tableau condensé PLAN_ZONES_DANGER.md
// §5.3 (« [VÉRIFIÉ Livre de Base, Saar] » pour le TABLEAU lui-même) ; les mappings vers le contrat de
// ligne d'effet qui ne découlent pas directement d'un chiffre du tableau sont marqués [HYPOTHÈSE] —
// à confirmer par Saar contre le Livre de Base avant de les considérer RAW-clos (AGENTS.md, termes
// interdits sans preuve).

import { normalizeEffectDefinition } from './worldEffects.js'

export const DANGER_CATEGORIES = new Set(['feu', 'acide', 'gaz', 'radiation', 'decompression'])

const RAW_DEFINITIONS = [
  // ── Feu — FATIGUE&DOMMAGES.md §Feu (Saar, 2026-09-10) ─────────────────────────────────────────
  // 4 intensités RAW. Localisation "exposée" (désignée MJ, via data.forcedLocation d'INSTANCE, pas
  // le forcedLocation de définition) pour petite/moyenne ; 1D3 aléatoires pour grande ; TOUTES pour
  // le brasier (RAW muet sur ce dernier point → décision Saar B3, re-confirmée 2026-09-10 : mort
  // garantie en 1 Tour). Ignifugé : RAW "réduit considérablement" sans chiffre → attenuation
  // 'arbitrate' (note MJ, aucune réduction automatique), jamais un chiffre inventé (décision B1/B2).
  {
    key: 'feu:petit', label: 'Feu — petite flamme', category: 'feu', tags: ['hazard:fire'],
    hazardCode: 'burning', durationPolicy: 'permanent', stackingPolicy: 'max',
    modifiers: { sightOpacity: 0.12 },
    effects: [
      { type: 'damage', phase: 'onTurn', formula: '1d6', locations: 1, locationMode: 'exposed',
        damageType: 'fire', armorFactor: 1, remanence: 'none' },
    ],
    attenuations: [{ by: 'protectionKey', key: 'hazard:fire', effect: 'arbitrate' }],
    source: 'FATIGUE&DOMMAGES.md §Feu — petite flamme : 1D6/Tour, Localisation exposée',
  },
  {
    key: 'feu:moyen', label: 'Feu — flamme moyenne', category: 'feu', tags: ['hazard:fire'],
    hazardCode: 'burning', durationPolicy: 'permanent', stackingPolicy: 'max',
    modifiers: { sightOpacity: 0.12 },
    effects: [
      { type: 'damage', phase: 'onTurn', formula: '1d10', locations: 1, locationMode: 'exposed',
        damageType: 'fire', armorFactor: 1, remanence: 'none' },
    ],
    attenuations: [{ by: 'protectionKey', key: 'hazard:fire', effect: 'arbitrate' }],
    source: 'FATIGUE&DOMMAGES.md §Feu — flamme moyenne : 1D10/Tour, Localisation exposée',
  },
  {
    key: 'feu:grand', label: 'Feu — grand feu', category: 'feu', tags: ['hazard:fire'],
    hazardCode: 'burning', durationPolicy: 'permanent', stackingPolicy: 'max',
    modifiers: { sightOpacity: 0.12 },
    effects: [
      { type: 'damage', phase: 'onTurn', formula: '2d10', locations: '1d3', locationMode: 'random',
        damageType: 'fire', armorFactor: 1, remanence: 'none' },
    ],
    attenuations: [{ by: 'protectionKey', key: 'hazard:fire', effect: 'arbitrate' }],
    source: 'FATIGUE&DOMMAGES.md §Feu — grand feu : 2D10/Tour, 1D3 Localisations',
  },
  {
    key: 'feu:brasier', label: 'Feu — brasier', category: 'feu', tags: ['hazard:fire'],
    hazardCode: 'burning', durationPolicy: 'permanent', stackingPolicy: 'max',
    modifiers: { sightOpacity: 0.12 },
    effects: [
      { type: 'damage', phase: 'onTurn', formula: '3d10', locations: null, locationMode: 'all',
        damageType: 'fire', armorFactor: 1, remanence: 'none' },
    ],
    attenuations: [{ by: 'protectionKey', key: 'hazard:fire', effect: 'arbitrate' }],
    source: 'FATIGUE&DOMMAGES.md §Feu : 3D10/Tour. Localisations = décision Saar B3 (RAW muet) : '
      + 'TOUTES les Localisations, mort garantie en 1 Tour — écart tracé, pas un raccourci silencieux.',
  },

  // ── Acide — FATIGUE&DOMMAGES.md §Acide (Saar, 2026-09-10) ─────────────────────────────────────
  // "Dégâts progressifs comme le feu" → même résolveur damage. Un seul ancrage catalogue (Capsule
  // acide, 1D10) ; dégât + durée (linger 1D6 Tours) sont un double champ MJ à la pose, pas une
  // 2ᵉ intensité catalogue (décision C1). Corrosion équipement (corrodes) = résolveur v2 (Usure L5).
  {
    key: 'acide:capsule', label: 'Acide — capsule', category: 'acide', tags: ['hazard:acid'],
    hazardCode: 'acid', durationPolicy: 'permanent', stackingPolicy: 'max', corrodes: ['chair', 'métal'],
    effects: [
      { type: 'damage', phase: 'onTurn', formula: '1d10', locations: 1, locationMode: 'random',
        damageType: 'acid', armorFactor: 1,
        remanence: 'fixed', remanenceParams: { turns: '1d6', earlyStop: 'neutralisant' } },
    ],
    source: 'FATIGUE&DOMMAGES.md §Acide : "comme le feu" — 1D10 (Capsule acide) ; sortie de zone : '
      + 'persistance 1D6 Tour(s) (RAW), retirable par un neutralisant (MJ).',
  },

  // ── Décompression — FATIGUE&DOMMAGES.md §Décompression ───────────────────────────────────────
  // forcedLocation au niveau DÉFINITION (RAW : "pour simplifier, nous localiserons... dans le
  // Corps") — prime sur locationMode de la ligne, qui reste à sa valeur par défaut (ignorée).
  {
    key: 'decompression', label: 'Décompression', category: 'decompression',
    hazardCode: 'decompression', forcedLocation: 'corps',
    durationPolicy: 'permanent', stackingPolicy: 'max',
    effects: [
      { type: 'damage', phase: 'onTurn', formula: '1d10', damageType: 'decompression',
        armorFactor: 1, remanence: 'none' },
    ],
    source: 'FATIGUE&DOMMAGES.md §Décompression : 1D10/Tour, Corps ("pour simplifier... dans le Corps").',
  },

  // ── Radiations — FATIGUE&DOMMAGES.md §Irradiations (texte déjà transcrit, complet) ───────────
  // Gain à l'ENTRÉE seulement (accumulateLevel, phase onEnter) — le re-tick RAW est mensuel/hebdo/
  // quotidien, "rien à l'échelle du Tour" (§5.7) : pas de ligne onTurn ici. Seuils/pertes CON+Fatigue
  // = PLAN_FATIGUE_DOMMAGES Radiations Lot 9 (non construit) — résolveur accumulateLevel = v2.
  {
    key: 'radiation:legeres', label: 'Radiations légères', category: 'radiation', tags: ['hazard:radiation'],
    durationPolicy: 'permanent', stackingPolicy: 'max',
    effects: [{ type: 'accumulateLevel', phase: 'onEnter', track: 'irradiation', formula: '1d6' }],
    source: 'FATIGUE&DOMMAGES.md §Irradiations : radiations légères, gain 1D6 à l’entrée.',
  },
  {
    key: 'radiation:importantes', label: 'Radiations importantes', category: 'radiation', tags: ['hazard:radiation'],
    durationPolicy: 'permanent', stackingPolicy: 'max',
    effects: [{ type: 'accumulateLevel', phase: 'onEnter', track: 'irradiation', formula: '2d6' }],
    source: 'FATIGUE&DOMMAGES.md §Irradiations : radiations importantes, gain 2D6 à l’entrée.',
  },
  {
    key: 'radiation:massives', label: 'Radiations massives', category: 'radiation', tags: ['hazard:radiation'],
    durationPolicy: 'permanent', stackingPolicy: 'max',
    effects: [{ type: 'accumulateLevel', phase: 'onEnter', track: 'irradiation', formula: '3d6' }],
    source: 'FATIGUE&DOMMAGES.md §Irradiations : radiations massives, gain 3D6 à l’entrée.',
  },

  // ── Gaz — Livre de Base §Gaz (p.309-310) [VÉRIFIÉ Livre de Base, Saar] ────────────────────────
  // Préambule commun aux 6 : propagation instantanée (pas m³/Tour, non modélisé ici — volume porté
  // par l'instance, §5.3) ; dissipation CONDITIONNELLE (vent/aération) → durationPolicy:'conditional'
  // pour les 6 ; rémanence universelle en sortie (aucun gaz remanence:'none', §5.3 préambule).
  // Immunité = protection étanche seulement (masque partiel/NBC total) → attenuations by:'protectionKey'
  // key:'atmosphere:gas'. "Puissance du gaz" = le facteur puissance d'instance unifié (§2.E, D1) —
  // aucun champ dédié ici. "Retenir sa respiration" = attenuation by:'behavior', cost:'souffle' (D3).
  {
    key: 'gaz:irritant', label: 'Gaz irritant', category: 'gaz',
    tags: ['atmosphere:gas', 'atmosphere:gas:irritant'],
    durationPolicy: 'conditional', durationParams: { condition: 'aération' }, stackingPolicy: 'max',
    modifiers: { sightOpacity: 0.2 },
    effects: [
      { type: 'modifier', phase: 'onTurn', target: 'actions', value: -3,
        remanence: 'decay', remanenceParams: { perTurn: 1 } },
      // v2 (no-op + log jusqu'au résolveur test) : le Test CON échoué ajoute un malus CUMULATIF dont
      // la magnitude vient de la marge d'échec (valueFromFailMargin), pas un chiffre catalogue fixe.
      { type: 'test', phase: 'onTurn', skill: 'CON', difficulty: 0,
        onFail: { type: 'modifier', target: 'actions', valueFromFailMargin: true, cumulative: true } },
    ],
    attenuations: [
      { by: 'protectionKey', key: 'atmosphere:gas', effect: 'immune' },
      { by: 'behavior', tag: 'holdBreath', effect: 'halve', cost: 'souffle' },
    ],
    source: 'Livre de Base §Gaz irritants (p.309-310) : malus −3, Test CON → malus cumulatif supplémentaire.',
  },
  {
    key: 'gaz:decomposant', label: 'Gaz décomposant', category: 'gaz',
    tags: ['atmosphere:gas', 'atmosphere:gas:decomposing'],
    durationPolicy: 'conditional', durationParams: { condition: 'aération' }, stackingPolicy: 'max',
    effects: [
      { type: 'damage', phase: 'onTurn', formula: '1d6', locations: 1, locationMode: 'random',
        damageType: 'fire', armorFactor: 1,
        escalation: { perTurn: 2, cap: null }, remanence: 'decay', remanenceParams: { perTurn: 1 } },
    ],
    attenuations: [{ by: 'protectionKey', key: 'atmosphere:gas', effect: 'immune' }],
    source: 'Livre de Base §Gaz décomposants : 1D6/Tour "blessures comme le feu" (damageType fire), '
      + 'escalade +2/Tour — 100% RAW dès v1.',
  },
  // Les 4 entrées suivantes reposent sur PLAN_ZONES_DANGER.md §5.3 (tableau condensé, RAW vérifié par
  // Saar pour les CHIFFRES qu'il porte). Tout mapping vers un champ du contrat qui ne découle pas
  // directement d'un chiffre du tableau est marqué [HYPOTHÈSE] : à confirmer contre le Livre de Base
  // avant de le considérer clos (AGENTS.md — termes interdits sans preuve).
  {
    key: 'gaz:vesicant', label: 'Gaz vésicant', category: 'gaz',
    tags: ['atmosphere:gas', 'atmosphere:gas:vesicant'],
    durationPolicy: 'conditional', durationParams: { condition: 'aération' }, stackingPolicy: 'max',
    effects: [
      { type: 'damage', phase: 'onTurn', formula: '1d6', locations: '1d3', locationMode: 'random',
        // [HYPOTHÈSE] damageType générique 'gaz' (§5.3 ne précise pas de type "comme le feu" pour le
        // vésicant, contrairement au décomposant) — à vérifier contre le Livre de Base.
        damageType: 'gaz', armorFactor: 1,
        escalation: { perTurn: 1, cap: null },
        remanence: 'conditional', remanenceParams: { label: 'solution neutralisante' } },
      // [HYPOTHÈSE] "quasi-aveugle" mappé sur le statut existant 'blinded' (shared/tokenStatusRegistry.js)
      // plutôt qu'un 2ᵉ vocabulaire — à confirmer que le RAW décrit bien un aveuglement de cette forme.
      { type: 'status', phase: 'onTurn', statusCode: 'blinded',
        remanence: 'conditional', remanenceParams: { label: 'solution neutralisante' } },
      // v2 (no-op + log) : "½ chances" — aucun résolveur chance/malus-de-Chance en v1 (§9).
      { type: 'chance', phase: 'onTurn' },
    ],
    attenuations: [{ by: 'protectionKey', key: 'atmosphere:gas', effect: 'immune' }],
    source: 'PLAN_ZONES_DANGER.md §5.3 : 1D6 sur 1D3 Loc, +1 Dommage/Tour, ½ Chances, quasi-aveugle ; '
      + 'rémanence conditionnelle (solution neutralisante).',
  },
  {
    key: 'gaz:suffocant', label: 'Gaz suffocant', category: 'gaz',
    tags: ['atmosphere:gas', 'atmosphere:gas:suffocating'],
    durationPolicy: 'conditional', durationParams: { condition: 'aération' }, stackingPolicy: 'max',
    // Aucune ligne damage/status/modifier résolue en v1 pour ce gaz (§5.3 : "test+statLoss+chance =
    // v2" — rien à côté). Les 3 lignes ci-dessous sont donc TOUTES no-op tant que leurs résolveurs
    // v2 respectifs n'existent pas ; c'est un résultat correct, pas un manque de Z0.
    effects: [
      { type: 'test', phase: 'onTurn', skill: 'CON', difficulty: 0,
        onFail: {
          type: 'statLoss', stat: 'CON', amount: 1,
          // decay −1 malus / 2 Tours (RAW, §5.3) — porté en texte : statLoss n'a pas de champ
          // remanence dans le contrat (§13.3), la courbe de récupération est un choix du résolveur v2.
          recovery: 'decay : -1 malus / 2 Tours (RAW)',
        } },
      { type: 'chance', phase: 'onTurn' },
    ],
    attenuations: [{ by: 'protectionKey', key: 'atmosphere:gas', effect: 'immune' }],
    source: 'PLAN_ZONES_DANGER.md §5.3 : Test CON → −1 CON (perte défense sauf Test de Chance) ; '
      + '½ Chances ; rémanence decay −1 malus/2 Tours.',
  },
  {
    key: 'gaz:neurotoxique', label: 'Gaz neurotoxique', category: 'gaz',
    tags: ['atmosphere:gas', 'atmosphere:gas:neurotoxic'],
    durationPolicy: 'conditional', durationParams: { condition: 'aération' }, stackingPolicy: 'max',
    effects: [
      { type: 'test', phase: 'onTurn', skill: 'CON', difficulty: 0,
        onFail: {
          type: 'statLoss', stat: 'resistance', amount: 1,
          recovery: 'mort sauf MR >= 15 ou atropine + Test de Chance (RAW) — v2',
        } },
    ],
    // [INCONNU pour v2] RAW : l'effet s'applique "même hors zone" — aucun champ du contrat de ligne
    // `test` ne porte de remanence (§13.3 : seuls damage/status/modifier en ont une). Pas de champ
    // inventé ici pour le contourner : à trancher explicitement quand le résolveur test sera cadré.
    attenuations: [
      { by: 'protectionKey', key: 'atmosphere:gas', effect: 'partial', scope: ['peau'] },
    ],
    source: 'PLAN_ZONES_DANGER.md §5.3 : Test CON → −1 Résistance (même hors zone), mort sauf MR>=15 '
      + 'ou atropine+Chance ; masque à gaz = protection partielle, insuffisante seule contre ce gaz.',
  },
  {
    key: 'gaz:assommant', label: 'Gaz assommant', category: 'gaz',
    tags: ['atmosphere:gas', 'atmosphere:gas:knockout'],
    durationPolicy: 'conditional', durationParams: { condition: 'aération' }, stackingPolicy: 'max',
    effects: [
      // [HYPOTHÈSE] skill:'choc' — nom de code non vérifié contre l'implémentation réelle du Test de
      // résistance au Choc (damageService.js expose shockResult mais pas un code de compétence dédié
      // que ce fichier ait pu confirmer) : à corriger si besoin par le résolveur v2, pas bloquant Z0.
      { type: 'test', phase: 'onTurn', skill: 'choc', difficulty: 0,
        onFail: {
          type: 'modifier', target: 'actions', valueFromFailMargin: true, cumulative: true,
          remanence: 'decay', remanenceParams: { perTurn: 1 } },
      },
    ],
    attenuations: [{ by: 'protectionKey', key: 'atmosphere:gas', effect: 'immune' }],
    source: 'PLAN_ZONES_DANGER.md §5.3 : Test de résistance au Choc, +1 malus/Tour, rémanence decay '
      + '(RAW muet sur le taux — défaut 1/Tour, comme les autres decay du catalogue).',
  },
]

const DEFINITIONS = RAW_DEFINITIONS.map(raw => {
  const definition = normalizeEffectDefinition(raw)
  if (!DANGER_CATEGORIES.has(definition.category)) {
    throw new RangeError(`Catégorie de danger inconnue : ${definition.category} (clé ${definition.key})`)
  }
  if (!definition.source) throw new RangeError(`Définition de danger sans citation RAW : ${definition.key}`)
  return definition
})

// Table plate figée — jamais un Map (Object.freeze(map) ne bloque pas .set()/.delete(), seul un objet
// plain gelé l'empêche vraiment ; même patron que BUILTIN_WORLD_EFFECTS dans worldEffects.js).
export const DANGER_CATALOG = Object.freeze(Object.fromEntries(DEFINITIONS.map(d => [d.key, d])))

export function listDangerDefinitions() {
  return Object.values(DANGER_CATALOG)
}

export function getDangerDefinition(key) {
  return DANGER_CATALOG[key]
}
