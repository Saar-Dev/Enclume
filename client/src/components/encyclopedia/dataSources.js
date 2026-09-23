// dataSources.js — Whitelist des sources shared/ consommables par l'Encyclopédie.
//
// Chaque entrée mappe un nom de constante (champ `source` d'un bloc dataTable)
// vers :
//   - son import réel depuis shared/ (statique, bundlé avec le client)
//   - soit un schéma simple (cells + termsDomain)
//   - soit une fonction de transformation dédiée (transform), quand la forme
//     de la donnée shared/ ne correspond pas à la forme d'affichage voulue
//
// Chaque ligne produite porte son propre `kinds` (tableau parallèle aux cellules).
// Une cellule est une string, ou un objet { label, colspan } pour les fusions.
//
// Pas d'en-têtes de colonnes produits ici : ils viennent du JSON d'article
// (block.headers), ce sont des textes RAW.
//
// Règle d'or : aucune valeur de règle dupliquée. Ce fichier ne fait que pointer
// vers shared/ et vers terms.json.

import { MR_TABLE } from '../../../../shared/polarisTestResolution.js'
import {
  DIFFICULTE_ACTION_MODIFICATEURS,
  DIFFICULTE_NON_ALEATOIRE_SEUILS,
  DEPLACEMENT_ACTION_MALUS,
  COMBAT_MULTIPLE_ADVERSAIRES_MALUS,
  DISTANCES_DEPLACEMENT_SOL,
  DISTANCES_DEPLACEMENT_EAU,
  RD_TABLE,
  RES_NAT_TABLE,
  AN_TABLE,
  FORCE_MOD_DOMMAGES_TABLE,
} from '../../../../shared/polarisUtils.js'
import {
  PORTEE_MOD_COMP,
  TAILLE_MODS,
  RANGED_SITUATION_MODS,
} from '../../../../shared/combatSituationMods.js'
import {
  LOC_TABLE,
  LOC_TABLE_CONTACT,
  AIMED_LOCATION_MALUS,
  SLOT_TO_WOUND_LOCATION,
} from '../../../../shared/armorConstants.js'
import {
  FALL_DAMAGE_GROUND_LEVEL,
  FALL_DAMAGE_TABLE,
} from '../../../../shared/fallDamageConstants.js'
import terms from './fr/terms.json'
import {
  BLESSURE_SEUILS_TABLE,
  BLESSURE_EFFETS_TABLE,
  CHOC_DUREE_TABLE,
  DUREE_GUERISON_SOINS_TABLE,
  WOUND_PENALTIES,
  WOUND_MAX_COUNTS,
  WOUND_LOCATIONS,
  WOUND_SEVERITIES,
} from '../../../../shared/woundConstants.js'
import {
  SEQUELLES_TETE_GRAVES_TABLE,
  SEQUELLES_TETE_CRITIQUES_TABLE,
  SEQUELLES_TETE_MORTELLES_TABLE,
  SEQUELLES_CORPS_CRITIQUES_TABLE,
  SEQUELLES_CORPS_MORTELLES_TABLE,
  SEQUELLES_BRAS_CRITIQUES_TABLE,
  SEQUELLES_BRAS_MORTELLES_TABLE,
  SEQUELLES_BRAS_MEMBRE_DETRUIT_TABLE,
  SEQUELLES_JAMBES_CRITIQUES_TABLE,
  SEQUELLES_JAMBES_MORTELLES_TABLE,
  SEQUELLES_JAMBES_MEMBRE_DETRUIT_TABLE,
} from '../../../../shared/sequellesConstants.js'

export const DATA_SOURCES = {
  DIFFICULTE_ACTION_MODIFICATEURS: {
    data: DIFFICULTE_ACTION_MODIFICATEURS,
    termsDomain: 'difficulteAction',
    cells: ['key', 'signed'],
  },

  DIFFICULTE_NON_ALEATOIRE_SEUILS: {
    data: DIFFICULTE_NON_ALEATOIRE_SEUILS,
    termsDomain: 'difficulteAction',
    cells: ['key', 'seuil'],
  },

  MR_TABLE: {
    data: MR_TABLE,
    transform: transformMargeTable,
  },

  DEPLACEMENT_ACTION_MALUS: {
    data: DEPLACEMENT_ACTION_MALUS,
    transform: transformMalusDeplacement,
  },

  COMBAT_MULTIPLE_ADVERSAIRES_MALUS: {
    data: COMBAT_MULTIPLE_ADVERSAIRES_MALUS,
    transform: transformCombatMultipleAdversaires,
  },

  DISTANCES_DEPLACEMENT_SOL: {
    data: DISTANCES_DEPLACEMENT_SOL,
    transform: transformDistancesSol,
  },

  DISTANCES_DEPLACEMENT_EAU: {
    data: DISTANCES_DEPLACEMENT_EAU,
    transform: transformDistancesEau,
  },

  DISTANCE_TIR_MODIFICATEURS: {
    data: PORTEE_MOD_COMP,
    transform: transformDistanceTir,
  },

  TAILLE_CIBLE_MODIFICATEURS: {
    data: TAILLE_MODS,
    transform: transformTailleCible,
  },

  MODIFICATEURS_CIRCONSTANCES_TIR: {
    data: RANGED_SITUATION_MODS,
    transform: transformModificateursCirconstancesTir,
  },

  LOCALISATION_DOMMAGES_TABLE: {
    data: { distance: LOC_TABLE, contact: LOC_TABLE_CONTACT },
    transform: transformLocalisationDommages,
  },

  AIMED_LOCATION_MALUS: {
    data: AIMED_LOCATION_MALUS,
    transform: transformAimedLocationMalus,
  },

  BLESSURE_SEUILS_TABLE: {
    data: BLESSURE_SEUILS_TABLE,
    termsDomain: 'graviteBlessure',
    cells: ['key', 'seuil'],
  },

  COMPTEUR_BLESSURES_TABLE: {
    data: WOUND_MAX_COUNTS,
    transform: transformCompteurBlessures,
  },

  BLESSURE_EFFETS_GRAVE: {
    data: BLESSURE_EFFETS_TABLE.grave,
    transform: (data) => transformBlessureEffets(data, ['jambes', 'corps', 'tete']),
  },

  BLESSURE_EFFETS_CRITIQUE: {
    data: BLESSURE_EFFETS_TABLE.critique,
    transform: (data) => transformBlessureEffets(data, ['bras', 'jambes', 'corps', 'tete']),
  },

  BLESSURE_EFFETS_MORTELLE: {
    data: BLESSURE_EFFETS_TABLE.mortelle,
    transform: (data) => transformBlessureEffets(data, ['bras', 'jambes', 'corps', 'tete']),
  },

  BLESSURE_EFFETS_MEMBRE_DETRUIT: {
    data: BLESSURE_EFFETS_TABLE.membreDetruit,
    transform: (data) => transformBlessureEffets(data, ['bras', 'jambes']),
  },

  BLESSURE_MALUS_TABLE: {
    data: WOUND_PENALTIES,
    transform: transformBlessureMalus,
  },

  CHOC_DUREE_TABLE: {
    data: CHOC_DUREE_TABLE,
    transform: transformChocDuree,
  },

  SEQUELLES_TETE_GRAVES_TABLE: {
    data: SEQUELLES_TETE_GRAVES_TABLE,
    transform: transformSequelles,
  },

  SEQUELLES_TETE_CRITIQUES_TABLE: {
    data: SEQUELLES_TETE_CRITIQUES_TABLE,
    transform: transformSequelles,
  },

  SEQUELLES_TETE_MORTELLES_TABLE: {
    data: SEQUELLES_TETE_MORTELLES_TABLE,
    transform: transformSequelles,
  },

  SEQUELLES_CORPS_CRITIQUES_TABLE: {
    data: SEQUELLES_CORPS_CRITIQUES_TABLE,
    transform: transformSequelles,
  },

  SEQUELLES_CORPS_MORTELLES_TABLE: {
    data: SEQUELLES_CORPS_MORTELLES_TABLE,
    transform: transformSequelles,
  },

  SEQUELLES_BRAS_CRITIQUES_TABLE: {
    data: SEQUELLES_BRAS_CRITIQUES_TABLE,
    transform: transformSequelles,
  },

  SEQUELLES_BRAS_MORTELLES_TABLE: {
    data: SEQUELLES_BRAS_MORTELLES_TABLE,
    transform: transformSequelles,
  },

  SEQUELLES_BRAS_MEMBRE_DETRUIT_TABLE: {
    data: SEQUELLES_BRAS_MEMBRE_DETRUIT_TABLE,
    transform: transformSequelles,
  },

  SEQUELLES_JAMBES_CRITIQUES_TABLE: {
    data: SEQUELLES_JAMBES_CRITIQUES_TABLE,
    transform: transformSequelles,
  },

  SEQUELLES_JAMBES_MORTELLES_TABLE: {
    data: SEQUELLES_JAMBES_MORTELLES_TABLE,
    transform: transformSequelles,
  },

  SEQUELLES_JAMBES_MEMBRE_DETRUIT_TABLE: {
    data: SEQUELLES_JAMBES_MEMBRE_DETRUIT_TABLE,
    transform: transformSequelles,
  },

  DUREE_GUERISON_SOINS_TABLE: {
    data: DUREE_GUERISON_SOINS_TABLE,
    transform: transformDureeGuerison,
  },

  FALL_DAMAGE_TABLE: {
    data: { ground: FALL_DAMAGE_GROUND_LEVEL, paliers: FALL_DAMAGE_TABLE },
    transform: transformFallDamage,
  },

  RESISTANCE_DOMMAGES_TABLE: {
    data: RD_TABLE,
    transform: transformResistanceDommages,
  },

  RESISTANCE_NATURELLE_TABLE: {
    data: RES_NAT_TABLE,
    transform: transformResistanceNaturelle,
  },

  APTITUDE_NATURELLE_TABLE: {
    data: AN_TABLE,
    transform: transformAptitudeNaturelle,
  },
  MODIFICATEUR_DOMMAGES_TABLE: {
    data: FORCE_MOD_DOMMAGES_TABLE,
    transform: transformModificateurDommages,
  }
}
// transformModificateurDommages — FORCE_MOD_DOMMAGES_TABLE (shared/polarisUtils.js, LdB p.113)
// aplatie en lignes « Force | Modificateur de Dommages en corps à corps ». La dernière ligne du RAW
// (« Etc. +1 tous les 2 niveaux ») est ajoutée manuellement : la constante shared/ s'arrête à 21,
// la formule de dépassement n'est pas figée en table.
function transformModificateurDommages(data) {
  const kinds = ['range', 'signed']
  const rows = data.map(row => ({
    kinds,
    cells: [`${row.min}-${row.max}`, formatSigned(row.mod)],
  }))
  rows.push({ kinds: ['range', 'key'], cells: ['Etc.', '+1 tous les 2 niveaux'] })
  return { rows }
}

export function getDataTableRows(sourceName) {
  const source = DATA_SOURCES[sourceName]
  if (!source) return null
  if (source.transform) return source.transform(source.data)

  const domain = terms[source.termsDomain] || {}
  return {
    rows: source.data.map(row => ({
      kinds: source.cells,
      cells: source.cells.map(kind => formatCell(row, kind, domain)),
    })),
  }
}

// ─── Transformations dédiées ─────────────────────────────

// transformMargeTable — apparie les 10 lignes de réussite et les 10 lignes
// d'échec de MR_TABLE en une table unifiée à 5 colonnes :
//   Marge | Réussite | Mod | Échec | Mod
//
// Corrections appliquées :
//   - le `min: 0` de la première ligne de réussite devient 1 (RAW p.203)
//   - les plages d'échec sont présentées en valeur absolue (RAW p.204)
function transformMargeTable(data) {
  const success = data.slice(0, 10)
  const failure = data.slice(10)
  const kinds = ['range', 'key-success', 'signed-success', 'key-failure', 'signed-failure']

  return {
    rows: success.map((s, i) => {
      const f = failure[i]
      const min = Math.max(1, s.min)
      const range = s.max === null ? `${min}+` : `${min}-${s.max}`
      return {
        kinds,
        cells: [
          range,
          terms.marge[s.key] ?? s.key,
          formatSigned(s.modifier),
          terms.marge[f.key] ?? f.key,
          formatSigned(f.modifier),
        ],
      }
    }),
  }
}

// transformMalusDeplacement — aplatit l'objet DEPLACEMENT_ACTION_MALUS
// en 4 lignes ordonnées selon le RAW (Précision, Équilibre, Furtivité,
// Vigilance). Le `null` de la source devient "Action impossible" (texte RAW).
function transformMalusDeplacement(data) {
  const domain = terms.typeAction || {}
  const order = ['precision', 'equilibre', 'furtivite', 'vigilance']
  const allures = ['lente', 'moyenne', 'rapide', 'max']
  const kinds = ['key', 'signed', 'signed', 'signed', 'signed']

  return {
    rows: order.map(key => {
      const row = data[key]
      return {
        kinds,
        cells: [
          domain[key] ?? key,
          ...allures.map(a => row[a] === null ? 'Action impossible' : formatSigned(row[a])),
        ],
      }
    }),
  }
}

// transformDistancesSol — aplatissement direct.
// La dernière ligne porte des formules textuelles au lieu de valeurs chiffrées.
function transformDistancesSol(data) {
  const kinds = ['key', 'range', 'range', 'range', 'range']
  return {
    rows: data.map(row => ({
      kinds,
      cells: [row.coo, toCell(row.lente), toCell(row.moyenne), toCell(row.rapide), toCell(row.max)],
    })),
  }
}

// transformDistancesEau — une seule ligne par plage COO, 13 colonnes
// (COO + 4 Allures × 3 types Hum./TH/Hyb.).
// La dernière ligne ("26 et +") porte des formules communes à tous les types :
// une cellule par Allure, fusionnée sur les 3 sous-colonnes (colspan 3).
function transformDistancesEau(data) {
  const allures = ['lente', 'moyenne', 'rapide', 'max']
  const types = ['hum', 'th', 'hyb']
  const kindsNumeric = ['key', ...allures.flatMap(() => ['range', 'range', 'range'])]
  const kindsFormula = ['key', 'range', 'range', 'range', 'range']

  return {
    rows: data.map(row => {
      if (typeof row.lente === 'string') {
        // Ligne formules : une cellule par Allure, fusionnée sur 3 colonnes
        return {
          kinds: kindsFormula,
          cells: [
            row.coo,
            ...allures.map(a => ({ label: toCell(row[a]), colspan: 3 })),
          ],
        }
      }
      // Ligne chiffrée : valeurs éclatées par type
      return {
        kinds: kindsNumeric,
        cells: [
          row.coo,
          ...allures.flatMap(a => types.map(t => toCell(row[a][t]))),
        ],
      }
    }),
  }
}

// transformCombatMultipleAdversaires — mapping direct depuis la table RAW.
// Le nombre d'adversaires est un identifiant de ligne (kind `key`, comme la
// colonne COO de transformDistancesSol) ; le malus est signé (kind `signed`).
function transformCombatMultipleAdversaires(data) {
  const kinds = ['key', 'signed']
  return {
    rows: data.map(row => ({
      kinds,
      cells: [String(row.adversaires), formatSigned(row.malus)],
    })),
  }
}

// transformDistanceTir — PORTEE_MOD_COMP (objet indexé par palier de portée)
// aplati en 5 lignes dans l'ordre RAW. Les libellés français viennent de
// terms.json (domaine portee).
function transformDistanceTir(data) {
  const domain = terms.portee || {}
  const order = ['bout_portant', 'courte', 'moyenne', 'longue', 'extreme']
  const kinds = ['key', 'signed']

  return {
    rows: order.map(key => ({
      kinds,
      cells: [domain[key] ?? key, formatSigned(data[key]?.mod)],
    })),
  }
}

// transformTailleCible — TAILLE_MODS (objet indexé par palier de taille)
// aplati en 8 lignes dans l'ordre RAW (croissant). Les libellés français
// viennent de terms.json (domaine taille) — les précisions de dimension
// ("(environ 1 m)") font partie du libellé, pas de la donnée.
function transformTailleCible(data) {
  const domain = terms.taille || {}
  const order = ['minuscule', 'tres_petite', 'petite', 'moyenne', 'grande', 'tres_grande', 'enorme', 'gigantesque']
  const kinds = ['key', 'signed']

  return {
    rows: order.map(key => ({
      kinds,
      cells: [domain[key] ?? key, formatSigned(data[key]?.mod)],
    })),
  }
}

// transformModificateursCirconstancesTir — RANGED_SITUATION_MODS (objet plat,
// 12 clés) reconstitué en 3 colonnes (Catégorie | Situation | Mod) et ordonné
// selon le RAW (p.226-227) : Cible / Tireur / Couverture / Obscurité.
//
// `cible_immobile` est volontairement exclue : cette clé moteur vient de
// l'Écran du MJ, pas du LdB. L'Encyclopédie ne présente que le RAW.
// `impossible: true` → "Tir impossible" (texte RAW). La note "* sauf tir en
// aveugle" du RAW n'est pas reproduite ici — le callout « Tir en aveugle »
// dans l'article la porte déjà.
function transformModificateursCirconstancesTir(data) {
  const domainCat = terms.situationTirCategorie || {}
  const domainSub = terms.situationTirSituation || {}
  const kinds = ['key', 'key', 'signed']

  const order = [
    ['cible_deplacement',  ['cible_allure_moyenne', 'cible_allure_rapide', 'cible_allure_maximale']],
    ['tireur_deplacement', ['tireur_allure_lente', 'tireur_allure_moyenne', 'tireur_allure_rapide', 'tireur_allure_maximale']],
    ['couverture',         ['couverture_partielle', 'couverture_importante']],
    ['obscurite',          ['obscurite_legere', 'obscurite_importante', 'obscurite_totale']],
  ]

  const rows = []
  for (const [catKey, subKeys] of order) {
    const catLabel = domainCat[catKey] ?? catKey
    for (const subKey of subKeys) {
      const entry = data[subKey]
      const mod = entry?.impossible === true ? 'Tir impossible' : formatSigned(entry?.mod)
      rows.push({
        kinds,
        cells: [catLabel, domainSub[subKey] ?? subKey, mod],
      })
    }
  }

  return { rows }
}

// transformLocalisationDommages — fusionne les deux tables RAW de localisation
// (LdB p.229) en une table à 4 colonnes, appariées ligne à ligne :
//   1D20 (distance) | Localisation | 1D20 (contact) | Localisation
// Les deux tables ont 6 paliers dans le même ordre de localisations — l'alignement
// ligne à ligne est possible sans arbitraire.
//
// Le RAW présente la variante contact comme OPTIONNEL, mais la table elle-même
// reste pleine (les deux variantes sont des données de règle) : le marqueur
// OPTIONNEL vit dans la prose de l'article, pas dans la donnée.
//
// `SLOT_TO_WOUND_LOCATION` (armorConstants.js) fait le pont slot → localisation
// (T → tete, BD → bras_droit…). Les libellés français viennent de terms.localisation.
function transformLocalisationDommages(data) {
  const domain = terms.localisation || {}
  const kinds = ['range', 'key', 'range', 'key']

  const toRange = (rows, i) => {
    const min = i === 0 ? 1 : rows[i - 1].max + 1
    return `${min}-${rows[i].max}`
  }

  const toLocation = slot => {
    const key = SLOT_TO_WOUND_LOCATION[slot]
    return domain[key] ?? key ?? slot
  }

  return {
    rows: data.distance.map((row, i) => ({
      kinds,
      cells: [
        toRange(data.distance, i),
        toLocation(row.slot),
        toRange(data.contact, i),
        toLocation(data.contact[i].slot),
      ],
    })),
  }
}

// transformAimedLocationMalus — mapping direct depuis AIMED_LOCATION_MALUS (objet
// indexé par localisation). L'ordre suit celui des tables de localisation
// (tête → corps → bras → jambes) pour rester lisible côte à côte.
//
// Première cellule `kind: 'silhouette'` : la clé de localisation brute (pas un libellé), lue par
// DataTableBlock pour surligner la zone sur BodySilhouetteSvg — même tracé que le picker interactif
// AimedLocationPicker.jsx (autorité unique du dessin anatomique, pas de silhouette dupliquée).
//
// Note : le RAW porte une 4ᵉ ligne « endroit spécifique du corps : -7 à -10 »
// laissée à l'appréciation du MJ. Elle n'a pas de contrepartie dans la table
// moteur (qui fige 6 zones) — non reproduite ici, dette signalée.
function transformAimedLocationMalus(data) {
  const domain = terms.localisation || {}
  const order = ['tete', 'corps', 'bras_droit', 'bras_gauche', 'jambe_droite', 'jambe_gauche']
  const kinds = ['silhouette', 'key', 'signed']

  return {
    rows: order.map(key => ({
      kinds,
      cells: [key, domain[key] ?? key, formatSigned(data[key])],
    })),
  }
}
// transformCompteurBlessures — WOUND_MAX_COUNTS (objet localisation → { gravité: max })
// reconstitué en table inversée : 1 ligne par gravité, 1 colonne par localisation.
// C'est l'orientation RAW de la fiche de personnage.
//
// Chaque cellule porte autant de « ☐ » que de cases à cocher disponibles pour ce
// couple (localisation × gravité) — pas le nombre brut : on documente la fiche
// telle que le joueur la voit, pas la donnée moteur.
//
// Le libellé de chaque ligne porte le seuil, joint depuis BLESSURE_SEUILS_TABLE
// (même autorité que le premier dataTable de l'article) — ex. « Légère (5) ».
//
// `WOUND_SEVERITIES` et `WOUND_LOCATIONS` (woundConstants.js) fixent l'ordre.
function transformCompteurBlessures(data) {
  const sevDomain = terms.graviteBlessure || {}
  const kinds = ['key', ...WOUND_LOCATIONS.map(() => 'checkbox')]

  const toCheckboxes = (n) => {
    const count = Number(n) || 0
    return count > 0 ? Array(count).fill('☐').join(' ') : ''
  }

  return {
    rows: WOUND_SEVERITIES.map(sev => {
      const label = sevDomain[sev] ?? sev
      const seuil = BLESSURE_SEUILS_TABLE.find(r => r.key === sev)?.seuil
      return {
        kinds,
        cells: [
          seuil != null ? `${label} (${seuil})` : label,
          ...WOUND_LOCATIONS.map(loc => toCheckboxes(data[loc]?.[sev])),
        ],
      }
    }),
  }
}

// transformBlessureEffets — un palier de BLESSURE_EFFETS_TABLE (déjà découpé par gravité côté
// DATA_SOURCES) aplati en lignes Localisation | Allure max | Malus Test de Choc, dans l'ordre RAW
// donné par `order` (variable selon la gravité — le RAW ne liste pas les mêmes Localisations à
// chaque palier, voir le commentaire de BLESSURE_EFFETS_TABLE).
//
// `malusChoc === null` → aucun Test de Choc mentionné par le RAW à cette Localisation (case vide,
// pas un zéro) ; sinon Test requis, malus signé (0 = « aucun malus », valeur RAW explicite).
function transformBlessureEffets(data, order) {
  const domain = terms.localisationGenerique || {}
  const kinds = ['key', 'key', 'signed']

  const allureLabel = (a) => a === 'impossible' ? 'Déplacement impossible' : `Allure ${a} maximum`

  return {
    rows: order.map(loc => {
      const row = data[loc]
      return {
        kinds,
        cells: [
          domain[loc] ?? loc,
          allureLabel(row.allure),
          row.malusChoc === null ? '—' : formatSigned(row.malusChoc),
        ],
      }
    }),
  }
}

// transformBlessureMalus — WOUND_PENALTIES (objet {legere,moyenne,grave,critique,mortelle} -> malus)
// aplati en 5 lignes, ordre WOUND_SEVERITIES.
//
// `mortelle` vaut `0` dans WOUND_PENALTIES par défense en profondeur côté moteur (voir le
// commentaire de la constante), mais le RAW est explicite : « non applicable, le blessé ne peut
// entreprendre aucune action demandant un Test » — ce n'est pas un malus nul, c'est l'absence de
// Test. Affiché tel quel ici plutôt que « +0 », pour rester fidèle au texte plutôt qu'à la valeur
// technique du moteur.
function transformBlessureMalus(data) {
  const domain = terms.graviteBlessure || {}
  const kinds = ['key', 'signed']

  return {
    rows: WOUND_SEVERITIES.map(sev => ({
      kinds,
      cells: [
        domain[sev] ?? sev,
        sev === 'mortelle' ? 'Non applicable' : formatSigned(data[sev]),
      ],
    })),
  }
}

// transformChocDuree — CHOC_DUREE_TABLE (objet imbriqué gravité -> localisation) aplati en une
// table plate Gravité | Localisation | Étourdissement | Inconscience | Catastrophe, dans l'ordre RAW.
// La Gravité est répétée sur chaque ligne du groupe (pas de fusion verticale — DataTableBlock ne
// supporte que le colspan, pas le rowspan en corps de table, comme les autres tableaux du corpus).
//
// « Membre détruit » n'est pas une gravité de WOUND_SEVERITIES : libellé posé en dur, même traitement
// que « Mort subite » dans l'article Blessures (hors énumération moteur).
function transformChocDuree(data) {
  const sevDomain = terms.graviteBlessure || {}
  const locDomain = terms.localisationGenerique || {}
  const kinds = ['key', 'key', 'key', 'key', 'key']

  const groups = [
    { severity: 'grave',         locations: ['tete', 'corps'] },
    { severity: 'critique',      locations: ['tete', 'corps', 'brasJambes'] },
    { severity: 'mortelle',      locations: ['tete', 'corps', 'brasJambes'] },
    { severity: 'membreDetruit', locations: ['brasJambes'] },
  ]

  const rows = []
  for (const { severity, locations } of groups) {
    const sevLabel = severity === 'membreDetruit' ? 'Membre détruit' : (sevDomain[severity] ?? severity)
    for (const loc of locations) {
      const cell = data[severity][loc]
      rows.push({
        kinds,
        cells: [sevLabel, locDomain[loc] ?? loc, cell.etourdissement, cell.inconscience, cell.catastrophe],
      })
    }
  }

  return { rows }
}

// transformSequelles — forme commune aux 11 tables SEQUELLES_* (min/max/effet) : aplatie en lignes
// 1D10 | Effet. Réutilisée telle quelle pour chaque table (Tête/Corps/Bras/Jambes × gravité) — même
// fonction, `data` seul change selon la source.
function transformSequelles(data) {
  const kinds = ['range', 'key']
  return {
    rows: data.map(row => ({
      kinds,
      cells: [row.min === row.max ? String(row.min) : `${row.min}-${row.max}`, row.effet],
    })),
  }
}

// transformDureeGuerison — DUREE_GUERISON_SOINS_TABLE (objet gravité -> ligne) aplati en 6 lignes,
// ordre RAW (Légères → Membre détruit). `difficulte` : `null` -> « — » (pas de Test), nombre ->
// signé, objet (mortelle seulement) -> 3 sous-valeurs jointes avec les libellés de localisation.
function transformDureeGuerison(data) {
  const sevDomain = terms.graviteBlessure || {}
  const locDomain = terms.localisationGenerique || {}
  const kinds = ['key', 'key', 'key', 'key', 'key', 'key']
  const order = ['legere', 'moyenne', 'grave', 'critique', 'mortelle', 'membreDetruit']

  const formatDifficulte = (d) => {
    if (d === null) return '—'
    if (typeof d === 'object') {
      return [
        `${locDomain.brasJambes} ${formatSigned(d.brasJambe)}`,
        `Corps ${formatSigned(d.corps)}`,
        `Tête ${formatSigned(d.tete)}`,
      ].join(', ')
    }
    return formatSigned(d)
  }

  return {
    rows: order.map(sev => {
      const row = data[sev]
      const sevLabel = sev === 'membreDetruit' ? 'Membre détruit' : (sevDomain[sev] ?? sev)
      return {
        kinds,
        cells: [
          sevLabel,
          row.duree,
          row.guerisonNaturelle ? 'Oui' : 'Non',
          row.soinsNecessaires,
          formatDifficulte(row.difficulte),
          row.soinsConstants ? 'Oui' : 'Non',
        ],
      }
    }),
  }
}

// transformFallDamage — FALL_DAMAGE_GROUND_LEVEL + FALL_DAMAGE_TABLE (shared/fallDamageConstants.js,
// déjà consommées par le moteur) aplatis en table Hauteur | Dégâts | Localisation(s) touchée(s).
// La ligne « Au-delà » reste un texte formule (RAW : « +1D10/mètre »), pas une valeur chiffrée figée
// pour une hauteur précise — `fallDamageBeyondFourMeters()` est une fonction paramétrée par la
// hauteur, pas une donnée de table ; même traitement que la dernière ligne de DISTANCES_DEPLACEMENT_
// SOL/EAU (formule textuelle plutôt que valeur numérique isolée).
function transformFallDamage(data) {
  const kinds = ['key', 'range', 'range']
  const fmt = (f) => f.toUpperCase()

  const rows = [
    { kinds, cells: ['Niveau du sol*', fmt(data.ground.formula), String(data.ground.locations)] },
  ]
  for (const h of [1, 2, 3, 4]) {
    const row = data.paliers[h]
    rows.push({ kinds, cells: [`${h} m`, fmt(row.formula), String(row.locations).toUpperCase()] })
  }
  rows.push({ kinds, cells: ['Au-delà', '+1D10 / mètre', '1D3+3'] })

  return { rows }
}

// transformResistanceDommages — RD_TABLE (shared/polarisUtils.js, LdB p.114) aplatie en lignes
// « FOR+CON | Résistance aux Dommages ». La dernière ligne du RAW (« Etc. -1 tous les 4 niveaux »)
// est ajoutée manuellement : la constante shared/ s'arrête à 41, la formule de dépassement vit
// dans calcResistanceDommages() — le texte RAW est reproduit tel quel.
function transformResistanceDommages(data) {
  const kinds = ['range', 'signed']
  const rows = data.map(row => ({
    kinds,
    cells: [`${row.min}-${row.max}`, formatSigned(row.rd)],
  }))
  rows.push({ kinds: ['range', 'key'], cells: ['Etc.', '-1 tous les 4 niveaux'] })
  return { rows }
}

// transformResistanceNaturelle — RES_NAT_TABLE (shared/polarisUtils.js, LdB p.114) aplatie en
// lignes « Résultat | Résistance naturelle ». Dernière ligne « Etc. » ajoutée manuellement, même
// raison que ci-dessus — la formule de dépassement vit dans calcResistanceNaturelle().
function transformResistanceNaturelle(data) {
  const kinds = ['range', 'signed']
  const rows = data.map(row => ({
    kinds,
    cells: [`${row.min}-${row.max}`, formatSigned(row.res)],
  }))
  rows.push({ kinds: ['range', 'key'], cells: ['Etc.', '-1 tous les 2 niveaux'] })
  return { rows }
}

// transformAptitudeNaturelle — AN_TABLE (shared/polarisUtils.js, LdB p.114) aplatie en lignes
// « Attribut | Aptitude naturelle ». Toutes les plages sont dans la constante ; pas de ligne
// manuelle. Le dernier palier (min: 25, max: Infinity) est rendu « 25 » comme le RAW.
function transformAptitudeNaturelle(data) {
  const kinds = ['range', 'signed']
  return {
    rows: data.map(row => ({
      kinds,
      cells: [
        row.max === Infinity ? String(row.min) : (row.min === row.max ? String(row.min) : `${row.min}-${row.max}`),
        formatSigned(row.an),
      ],
    })),
  }
}

// ─── Formatage des cellules ──────────────────────────────

function formatCell(row, kind, domain) {
  switch (kind) {
    case 'key':    return domain[row.key] ?? row.key
    case 'signed': return formatSigned(row.modifier)
    case 'seuil':  return row.seuil === null ? 'Impossible' : String(row.seuil)
    default:       return ''
  }
}

function formatSigned(v) {
  if (v === null || v === undefined) return ''
  return v >= 0 ? `+${v}` : String(v)
}

function toCell(v) {
  if (v === null || v === undefined) return ''
  return String(v)
}