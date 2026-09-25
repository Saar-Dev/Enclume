import test from 'node:test'
import assert from 'node:assert/strict'

import { foldAccents, foldForSearch, createSearchMatcher, matchesSearch } from './textSearch.js'

test('foldAccents — minuscules sans accents, ponctuation inchangée', () => {
  assert.equal(foldAccents('Épée-Longue'), 'epee-longue')
  assert.equal(foldAccents('ÀÂÄÉÈÊËÎÏÔÖÙÛÜŸÇ'), 'aaaeeeeiioouuuyc')
})

test('foldAccents — valeurs nulles ou non textuelles', () => {
  assert.equal(foldAccents(null), '')
  assert.equal(foldAccents(undefined), '')
  assert.equal(foldAccents(42), '42')
})

test('foldForSearch — accents dans les deux sens', () => {
  assert.equal(foldForSearch('Épée'), foldForSearch('epee'))
  assert.equal(foldForSearch('Vêtement'), foldForSearch('vetement'))
  assert.equal(foldForSearch('Ôtage ïle'), 'otage ile')
})

test('foldForSearch — ligatures œ et æ (majuscules comprises)', () => {
  assert.equal(foldForSearch('Cœur'), 'coeur')
  assert.equal(foldForSearch('ŒIL'), 'oeil')
  assert.equal(foldForSearch('Cæsar'), 'caesar')
})

test('foldForSearch — apostrophes typographiques ramenées à la droite', () => {
  assert.equal(foldForSearch('Fusil d’assaut'), foldForSearch("fusil d'assaut"))
  assert.equal(foldForSearch('l‘arme'), "l'arme")
})

test('foldForSearch — tirets et espaces multiples', () => {
  assert.equal(foldForSearch('  Arts-martiaux   lourds '), 'arts martiaux lourds')
  assert.equal(foldForSearch('a–b—c'), 'a b c')
  assert.equal(foldForSearch('a b'), 'a b')
})

test('createSearchMatcher — requête vide ou blanche : tout passe', () => {
  assert.equal(createSearchMatcher('')('n’importe quoi'), true)
  assert.equal(createSearchMatcher('   ')(), true)
  assert.equal(createSearchMatcher(null)('x'), true)
})

test('matchesSearch — « epee » trouve « Épée », « épée » trouve « Epee »', () => {
  assert.equal(matchesSearch('epee', 'Épée longue'), true)
  assert.equal(matchesSearch('épée', 'Epee longue'), true)
})

test('matchesSearch — mots dans n’importe quel ordre, tous requis', () => {
  assert.equal(matchesSearch('pompe fusil', 'Fusil à pompe'), true)
  assert.equal(matchesSearch('fusil laser', 'Fusil à pompe'), false)
})

test('matchesSearch — plusieurs champs : les mots peuvent se répartir', () => {
  assert.equal(matchesSearch('epee arme', 'Épée', 'Arme de contact', 'Armes'), true)
  assert.equal(matchesSearch('epee pistolet', 'Épée', 'Arme de contact'), false)
})

test('matchesSearch — un mot ne chevauche pas deux champs', () => {
  assert.equal(matchesSearch('ab', 'xa', 'bx'), false)
})

test('matchesSearch — champs nuls ignorés sans erreur', () => {
  assert.equal(matchesSearch('epee', null, undefined, 'Épée'), true)
  assert.equal(matchesSearch('epee', null, undefined), false)
})

test('matchesSearch — ligature tapée en deux lettres', () => {
  assert.equal(matchesSearch('coeur', 'Cœur artificiel'), true)
  assert.equal(matchesSearch('cœur', 'Coeur artificiel'), true)
})

test('createSearchMatcher — réutilisable sur une liste', () => {
  const match = createSearchMatcher('vetement')
  const items = ['Vêtement de travail', 'Fusil', 'Sous-vêtements']
  assert.deepEqual(items.filter(i => match(i)), ['Vêtement de travail', 'Sous-vêtements'])
})
