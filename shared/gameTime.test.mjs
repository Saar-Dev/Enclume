import { test } from 'node:test'
import assert from 'node:assert/strict'
import { floorDiv, floorMod, projectGameTime, splitGameDuration, DAYS_PER_YEAR, DAYS_PER_MONTH, MINUTES_PER_DAY } from './gameTime.js'

test('floorMod - reste toujours positif, y compris pour un dividende négatif', () => {
  assert.equal(floorMod(-1, 1440), 1439)
  assert.equal(floorMod(1439, 1440), 1439)
  assert.equal(floorMod(1440, 1440), 0)
  assert.equal(floorMod(0, 1440), 0)
})

test('floorDiv - arrondit vers le bas, y compris pour un dividende négatif', () => {
  assert.equal(floorDiv(-1, 1440), -1)
  assert.equal(floorDiv(1439, 1440), 0)
  assert.equal(floorDiv(1440, 1440), 1)
  assert.equal(floorDiv(-1440, 1440), -1)
  assert.equal(floorDiv(-1441, 1440), -2)
})

const START = { calendar_start_year: 1, calendar_start_month: 1, calendar_start_day: 1 }

test('projectGameTime - compteur à 0 -> date de départ exacte', () => {
  assert.deepEqual(projectGameTime(0, START), { year: 1, month: 1, day: 1, hour: 0, minute: 0 })
})

test('projectGameTime - dernière minute avant le départ (recul MJ)', () => {
  assert.deepEqual(projectGameTime(-1, START), { year: 0, month: 12, day: 31, hour: 23, minute: 59 })
})

test('projectGameTime - dernière minute du premier jour', () => {
  assert.deepEqual(projectGameTime(MINUTES_PER_DAY - 1, START), { year: 1, month: 1, day: 1, hour: 23, minute: 59 })
})

test('projectGameTime - franchissement de jour', () => {
  assert.deepEqual(projectGameTime(MINUTES_PER_DAY, START), { year: 1, month: 1, day: 2, hour: 0, minute: 0 })
})

test('projectGameTime - franchissement de mois (31 jours écoulés)', () => {
  assert.deepEqual(projectGameTime(DAYS_PER_MONTH * MINUTES_PER_DAY, START), { year: 1, month: 2, day: 1, hour: 0, minute: 0 })
})

test('projectGameTime - franchissement d\'année (372 jours écoulés)', () => {
  assert.deepEqual(projectGameTime(DAYS_PER_YEAR * MINUTES_PER_DAY, START), { year: 2, month: 1, day: 1, hour: 0, minute: 0 })
})

test('projectGameTime - point de départ non trivial (milieu de calendrier)', () => {
  const start = { calendar_start_year: 5, calendar_start_month: 6, calendar_start_day: 20 }
  assert.deepEqual(projectGameTime(0, start), { year: 5, month: 6, day: 20, hour: 0, minute: 0 })
  assert.deepEqual(projectGameTime(11 * MINUTES_PER_DAY, start), { year: 5, month: 6, day: 31, hour: 0, minute: 0 })
  assert.deepEqual(projectGameTime(12 * MINUTES_PER_DAY, start), { year: 5, month: 7, day: 1, hour: 0, minute: 0 })
})

test('splitGameDuration - une semaine exacte (l\'avance type de la revue des guérisons)', () => {
  assert.deepEqual(splitGameDuration(10080), { negative: false, weeks: 1, days: 0, hours: 0, minutes: 0 })
})

test('splitGameDuration - toutes les unités, sans mois (un mois = 31 jours, jamais une unité de revue)', () => {
  const minutes = 3 * 7 * MINUTES_PER_DAY + 2 * MINUTES_PER_DAY + 5 * 60 + 12
  assert.deepEqual(splitGameDuration(minutes), { negative: false, weeks: 3, days: 2, hours: 5, minutes: 12 })
  assert.equal(splitGameDuration(DAYS_PER_MONTH * MINUTES_PER_DAY).weeks, 4, '31 jours = 4 semaines + 3 jours')
  assert.equal(splitGameDuration(DAYS_PER_MONTH * MINUTES_PER_DAY).days, 3)
})

test('splitGameDuration - durée négative (recul) : mêmes unités, drapeau `negative`', () => {
  assert.deepEqual(splitGameDuration(-90), { negative: true, weeks: 0, days: 0, hours: 1, minutes: 30 })
  assert.deepEqual(splitGameDuration(0), { negative: false, weeks: 0, days: 0, hours: 0, minutes: 0 })
})

test('splitGameDuration - la somme des unités redonne la durée (aucune minute perdue)', () => {
  for (const total of [1, 59, 60, 1439, 1440, 10079, 10080, 10081, 123456]) {
    const d = splitGameDuration(total)
    assert.equal(d.weeks * 7 * MINUTES_PER_DAY + d.days * MINUTES_PER_DAY + d.hours * 60 + d.minutes, total)
  }
})
