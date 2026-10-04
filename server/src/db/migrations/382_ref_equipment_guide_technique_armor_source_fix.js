// 382_ref_equipment_guide_technique_armor_source_fix.js — ARMOR-STATS-DISPLAY-INCOMPLETE
//
// 16 armures personnelles sont en réalité du contenu du supplément Guide Technique (confirmé par
// Saar, 2026-10-04 : noms absents de la table « Armures simples & boucliers » du Livre de Base,
// p.314 — vérifié exhaustivement contre le texte du livre avant ce fichier) mais étaient encore
// taguées `source_id = ldb` depuis la mise en place du mécanisme de Source (Lot B,
// docs/PLANS/PLAN_SUPPLEMENTS.md §2.5, 2026-09-29) — ce lot n'avait rattaché que 7 lignes
// « Logiciels » déjà connues comme Guide Technique, pas ces 16 armures, jamais auditées à ce
// moment-là. Tant qu'elles restent `ldb`, elles sont utilisables dans n'importe quelle campagne,
// même sans le Guide Technique activé — contournement silencieux de l'invariant posé par
// `assertSourceActive` (sourceService.js).
//
// Sans risque pour la campagne réelle (LOCAL) : `guide_technique` y est déjà activé
// (`campaign_enabled_sources`), et parmi ces 16 noms seul « Gilet Soles » est aujourd'hui possédé
// par un personnage (au Sac, jamais équipé) — la possession déjà acquise n'est jamais remise en
// cause par une bascule de source (PLAN_SUPPLEMENTS.md §3, hors périmètre explicite).
//
// Aucune valeur de statistique (Protection, Choc, malus, localisation) n'est modifiée ici — ce
// n'est qu'une correction d'étiquette de source, jamais une invention de donnée de jeu (consigne
// Saar 2026-10-04). Matché par `name` (clé métier), jamais par `id` (rules/core.md SEED-ID-DETERM).

const GUIDE_TECHNIQUE_ARMOR_NAMES = [
  'Gilet Soles', 'Gilet Vasta II', 'Gilet de fibres vivantes', 'Gilet en kevlar',
  'Mil AZ', 'Nano-cuirasse Mark I', 'Nano-cuirasse Mark II', 'Pagan', 'Protection Spider',
  'Protector 201', 'Roga I', 'Roga II', 'Sancta', 'Sec II', 'Tenue NBC', 'Tenue sécurité Kevlar',
]

export const up = async (knex) => {
  const guideTechnique = await knex('ref_sources').where({ code: 'guide_technique' }).first('id')
  if (!guideTechnique) throw new Error('ref_sources: ligne "guide_technique" introuvable (migration 377 non appliquée ?)')

  await knex('ref_equipment')
    .whereIn('name', GUIDE_TECHNIQUE_ARMOR_NAMES)
    .update({ source_id: guideTechnique.id })
}

export const down = async (knex) => {
  const ldb = await knex('ref_sources').where({ code: 'ldb' }).first('id')
  if (!ldb) throw new Error('ref_sources: ligne "ldb" introuvable')

  await knex('ref_equipment')
    .whereIn('name', GUIDE_TECHNIQUE_ARMOR_NAMES)
    .update({ source_id: ldb.id })
}
