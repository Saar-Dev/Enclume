import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { SEVERITY } from './combatResultLabels.js'
import { WOUND_SEVERITIES, SEVERITY_COLORS } from '../../../shared/woundConstants.js'

// Garde « aucune table en retard » : chaque gravité de shared/woundConstants.js (6 lignes, dont `mort_subite`) doit avoir
// sa couleur, son libellé de résultat de combat, son abréviation de fiche et son terme d'Encyclopédie. Une gravité
// ajoutée sans l'une de ces entrées afficherait une clé i18n brute ou une couleur `undefined`.
const readJson = (relative) => JSON.parse(readFileSync(new URL(relative, import.meta.url), 'utf8'))

test('SEVERITY (résultats de combat) : dérivée de WOUND_SEVERITIES, couleurs de SEVERITY_COLORS', () => {
  assert.deepEqual(Object.keys(SEVERITY), WOUND_SEVERITIES)
  for (const severity of WOUND_SEVERITIES) {
    assert.equal(SEVERITY[severity].col, SEVERITY_COLORS[severity], severity)
    assert.equal(SEVERITY[severity].label, `resultPanels.severity.${severity}`, severity)
  }
})

test('i18n : chaque gravité a son libellé de résultat (combat), son abréviation de fiche (charSheet) et son terme (Encyclopédie)', () => {
  const combat = readJson('../locales/combat.json')
  const charSheet = readJson('../locales/charSheet.json')
  const terms = readJson('../components/encyclopedia/fr/terms.json')
  for (const severity of WOUND_SEVERITIES) {
    assert.ok(combat.resultPanels.severity[severity], `combat.json resultPanels.severity.${severity}`)
    assert.ok(charSheet.locationPanel.severityShort[severity], `charSheet.json locationPanel.severityShort.${severity}`)
    assert.ok(terms.graviteBlessure[severity], `terms.json graviteBlessure.${severity}`)
  }
})

test('i18n : les deux mots de la 6ᵉ ligne (Mort / Membre détruit) existent', () => {
  const charSheet = readJson('../locales/charSheet.json')
  assert.equal(charSheet.locationPanel.deathWord.mort, 'Mort')
  assert.equal(charSheet.locationPanel.deathWord.membreDetruit, 'Membre détruit')
})
