import test from 'node:test'
import assert from 'node:assert/strict'

import { computeExoStats } from './exoStats.js'

const fullIntegrity = {
  itg_structure_current: 20,
  itg_exosquelette_current: 20,
  itg_generator_current: 20,
}

const template = {
  category: 'exo-6',
  base_exoforce: 68,
  base_blindage: 34,
}

test('computeExoStats — template absent (exo non configurée) → null, jamais NaN', () => {
  assert.equal(computeExoStats(fullIntegrity, null), null)
  assert.equal(computeExoStats(fullIntegrity, undefined), null)
})

test('computeExoStats — Intégrité pleine (11+) : aucune réduction', () => {
  const stats = computeExoStats(fullIntegrity, template)
  assert.deepEqual(stats, { exf: 68, bld: 34, rd: 5 })
})

// Exemple RAW littéral (REGLEARMURE.md:568) : "EXF de base = 68, Exosquelette courant = 8 → EXF
// effective = 45 (68 × 2/3 = 45,33 arrondi à 45)."
test('computeExoStats — Exosquelette palier 6-10 : EXF x2/3 floor (exemple RAW)', () => {
  const stats = computeExoStats({ ...fullIntegrity, itg_exosquelette_current: 8 }, template)
  assert.equal(stats.exf, 45)
})

test('computeExoStats — Exosquelette palier 1-5 : EXF /2 floor', () => {
  const stats = computeExoStats({ ...fullIntegrity, itg_exosquelette_current: 3 }, template)
  assert.equal(stats.exf, 34)
})

test('computeExoStats — Exosquelette détruit (<=0) : EXF=0', () => {
  const stats = computeExoStats({ ...fullIntegrity, itg_exosquelette_current: 0 }, template)
  assert.equal(stats.exf, 0)
})

// Exemple RAW littéral (REGLEARMURE.md:618) : "Blindage de base = 34, Structure courante = 7 →
// Blindage effectif = 22 (34 × 2/3, arrondi inférieur)."
test('computeExoStats — Structure palier 6-10 : Blindage x2/3 floor (exemple RAW)', () => {
  const stats = computeExoStats({ ...fullIntegrity, itg_structure_current: 7 }, template)
  assert.equal(stats.bld, 22)
})

test('computeExoStats — Structure palier 1-5 : Blindage /2 floor', () => {
  const stats = computeExoStats({ ...fullIntegrity, itg_structure_current: 3 }, template)
  assert.equal(stats.bld, 17)
})

test('computeExoStats — Structure à 0 ou moins : Blindage=0', () => {
  const stats = computeExoStats({ ...fullIntegrity, itg_structure_current: -2 }, template)
  assert.equal(stats.bld, 0)
})

// Générateur 6-10 : aucun effet EXF au RAW (seuls Systèmes/Vitesse propulseur y sont affectés).
test('computeExoStats — Générateur palier 6-10 : aucun effet sur EXF', () => {
  const stats = computeExoStats({ ...fullIntegrity, itg_generator_current: 8 }, template)
  assert.equal(stats.exf, 68)
})

// Générateur 1-5 : "l'Exo-Force de l'armure est également divisée par deux" (REGLEARMURE.md:596).
test('computeExoStats — Générateur palier 1-5 : EXF /2 (Exosquelette par ailleurs plein)', () => {
  const stats = computeExoStats({ ...fullIntegrity, itg_generator_current: 3 }, template)
  assert.equal(stats.exf, 34)
})

test('computeExoStats — Générateur hors service (<=0) : EXF=0 (décision Saar 2026-08-13)', () => {
  const stats = computeExoStats({ ...fullIntegrity, itg_generator_current: 0 }, template)
  assert.equal(stats.exf, 0)
})

// Cumul Exosquelette + Générateur — décision Saar (2026-08-14) : exo_sheet ne garde aucun historique
// de quel composant a été touché en premier, donc les deux facteurs se combinent en UNE multiplication
// avec un seul arrondi final, jamais deux floor successifs (qui inventeraient un ordre arbitraire —
// vérifié par calcul exhaustif : floor(floor(x*a)*b) != floor(floor(x*b)*a) dans 225 cas sur la plage
// réaliste). floor(68 x 2/3 x 1/2) = floor(22.67) = 22.
test('computeExoStats — cumul Exosquelette 6-10 + Générateur 1-5 (arrondi unique, décision Saar)', () => {
  const stats = computeExoStats(
    { ...fullIntegrity, itg_exosquelette_current: 8, itg_generator_current: 3 },
    template,
  )
  assert.equal(stats.exf, 22)
})

// Régression du bug d'ordre trouvé en analyse à charge (2026-08-14) : avec un double floor séquentiel,
// "Exosquelette d'abord" donnait 7 et "Générateur d'abord" donnait 6 pour ce même cas — la formule à
// arrondi unique élimine la divergence : floor(21 x 2/3 x 1/2) = floor(7) = 7, quel que soit l'ordre
// dans lequel on lit le calcul.
test('computeExoStats — cumul EXF 21, Exosquelette palier 6-10, Générateur palier 1-5 (cas de divergence corrigé)', () => {
  const stats = computeExoStats(
    { ...fullIntegrity, itg_exosquelette_current: 7, itg_generator_current: 3 },
    { ...template, base_exoforce: 21 },
  )
  assert.equal(stats.exf, 7)
})

test('computeExoStats — Exosquelette détruit prime même si Générateur plein', () => {
  const stats = computeExoStats(
    { ...fullIntegrity, itg_exosquelette_current: 0, itg_generator_current: 20 },
    template,
  )
  assert.equal(stats.exf, 0)
})

// Bornes exactes — les bugs off-by-one se cachent aux limites de palier, pas au milieu.
test('computeExoStats — bornes exactes Exosquelette/Structure (11 vs 10, 6 vs 5, 1 vs 0)', () => {
  assert.equal(computeExoStats({ ...fullIntegrity, itg_exosquelette_current: 11 }, template).exf, 68)
  assert.equal(computeExoStats({ ...fullIntegrity, itg_exosquelette_current: 10 }, template).exf, 45)
  assert.equal(computeExoStats({ ...fullIntegrity, itg_exosquelette_current: 6 }, template).exf, 45)
  assert.equal(computeExoStats({ ...fullIntegrity, itg_exosquelette_current: 5 }, template).exf, 34)
  assert.equal(computeExoStats({ ...fullIntegrity, itg_exosquelette_current: 1 }, template).exf, 34)
  assert.equal(computeExoStats({ ...fullIntegrity, itg_exosquelette_current: 0 }, template).exf, 0)

  assert.equal(computeExoStats({ ...fullIntegrity, itg_structure_current: 11 }, template).bld, 34)
  assert.equal(computeExoStats({ ...fullIntegrity, itg_structure_current: 10 }, template).bld, 22)
  assert.equal(computeExoStats({ ...fullIntegrity, itg_structure_current: 6 }, template).bld, 22)
  assert.equal(computeExoStats({ ...fullIntegrity, itg_structure_current: 5 }, template).bld, 17)
  assert.equal(computeExoStats({ ...fullIntegrity, itg_structure_current: 1 }, template).bld, 17)
  assert.equal(computeExoStats({ ...fullIntegrity, itg_structure_current: 0 }, template).bld, 0)
})

test('computeExoStats — bornes exactes Générateur (6 vs 5, 1 vs 0)', () => {
  assert.equal(computeExoStats({ ...fullIntegrity, itg_generator_current: 6 }, template).exf, 68)
  assert.equal(computeExoStats({ ...fullIntegrity, itg_generator_current: 5 }, template).exf, 34)
  assert.equal(computeExoStats({ ...fullIntegrity, itg_generator_current: 1 }, template).exf, 34)
  assert.equal(computeExoStats({ ...fullIntegrity, itg_generator_current: 0 }, template).exf, 0)
})

test('computeExoStats — RD reprise telle quelle de EXO_RD_TABLE selon la catégorie', () => {
  assert.equal(computeExoStats(fullIntegrity, { ...template, category: 'exo-alpha' }).rd, 0)
  assert.equal(computeExoStats(fullIntegrity, { ...template, category: 'exo-5' }).rd, 6)
  assert.equal(computeExoStats(fullIntegrity, { ...template, category: 'exo-omega' }).rd, 4)
})

// Catégorie absente de la table (faute de frappe, ou catégorie ajoutée au CHECK sans mise à jour de
// la table) — doit lever, jamais retomber silencieusement sur 0 (indiscernable d'exo-alpha, qui vaut
// vraiment 0).
test('computeExoStats — catégorie inconnue de EXO_RD_TABLE : lève une erreur explicite', () => {
  assert.throws(
    () => computeExoStats(fullIntegrity, { ...template, category: 'exo-inconnue' }),
    /catégorie exo inconnue/,
  )
})
