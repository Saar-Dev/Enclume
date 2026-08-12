import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { createTicket, listTicketsForReporter, listTickets, updateTicket } from './ticketService.js'

// Lancement manuel : node --env-file=../.env --test server/src/services/ticketService.test.mjs
const skip = !process.env.DATABASE_URL

async function createUser(role = 'user') {
  const [user] = await db('users')
    .insert({
      email: `ticket-test-${Date.now()}-${Math.random()}@test.local`,
      password_hash: 'x',
      username: `ticket-test-${Math.random().toString(36).slice(2, 8)}`,
      role,
    })
    .returning('*')
  return user
}

async function createCampaignWithGm(gmId) {
  const [campaign] = await db('campaigns')
    .insert({
      gm_id: gmId,
      name: `ticket-test-campaign-${Math.random().toString(36).slice(2, 8)}`,
      invite_code: `TCK-${Math.random().toString(36).slice(2, 8)}`,
    })
    .returning('*')
  await db('campaign_members').insert({ campaign_id: campaign.id, user_id: gmId, role: 'gm' })
  return campaign
}

async function cleanupTickets(...tickets) {
  const ids = tickets.filter(Boolean).map(t => t.id)
  if (ids.length) await db('bug_tickets').whereIn('id', ids).del()
}

async function cleanupCampaign(campaign) {
  if (campaign) await db('campaigns').where({ id: campaign.id }).del()
}

async function cleanupUsers(...users) {
  const ids = users.filter(Boolean).map(u => u.id)
  if (ids.length) await db('users').whereIn('id', ids).del()
}

test('createTicket — origin=player pour un compte sans rôle admin ni GM', { skip }, async () => {
  const user = await createUser('user')
  let ticket
  try {
    ticket = await createTicket(user.id, { category: 'bug', title: 'T', description: 'D' })
    assert.equal(ticket.origin, 'player')
    assert.equal(ticket.status, 'new')
    assert.equal(ticket.priority, null)
  } finally {
    await cleanupTickets(ticket)
    await cleanupUsers(user)
  }
})

test('createTicket — origin=admin pour un compte users.role=admin', { skip }, async () => {
  const admin = await createUser('admin')
  let ticket
  try {
    ticket = await createTicket(admin.id, { category: 'bug', title: 'T', description: 'D' })
    assert.equal(ticket.origin, 'admin')
  } finally {
    await cleanupTickets(ticket)
    await cleanupUsers(admin)
  }
})

test('createTicket — origin=gm pour un compte membre GM d\'une campagne', { skip }, async () => {
  const gm = await createUser('user')
  let campaign, ticket
  try {
    campaign = await createCampaignWithGm(gm.id)
    ticket = await createTicket(gm.id, { category: 'suggestion', title: 'T', description: 'D' })
    assert.equal(ticket.origin, 'gm')
  } finally {
    await cleanupTickets(ticket)
    await cleanupCampaign(campaign)
    await cleanupUsers(gm)
  }
})

test('createTicket — rejette une catégorie invalide', { skip }, async () => {
  const user = await createUser('user')
  try {
    await assert.rejects(
      createTicket(user.id, { category: 'feature', title: 'T', description: 'D' }),
      /category doit être/
    )
  } finally {
    await cleanupUsers(user)
  }
})

test('createTicket — rejette titre/description vides', { skip }, async () => {
  const user = await createUser('user')
  try {
    await assert.rejects(
      createTicket(user.id, { category: 'bug', title: '  ', description: 'D' }),
      /requis/
    )
  } finally {
    await cleanupUsers(user)
  }
})

test('listTicketsForReporter — ne renvoie que les tickets du rapporteur', { skip }, async () => {
  const userA = await createUser('user')
  const userB = await createUser('user')
  let ticketA, ticketB
  try {
    ticketA = await createTicket(userA.id, { category: 'bug', title: 'A', description: 'D' })
    ticketB = await createTicket(userB.id, { category: 'bug', title: 'B', description: 'D' })

    const listA = await listTicketsForReporter(userA.id)
    assert.equal(listA.length, 1)
    assert.equal(listA[0].id, ticketA.id)
  } finally {
    await cleanupTickets(ticketA, ticketB)
    await cleanupUsers(userA, userB)
  }
})

test('listTickets — filtre par origin et clusterLabel', { skip }, async () => {
  const admin = await createUser('admin')
  const user = await createUser('user')
  let t1, t2
  try {
    t1 = await createTicket(admin.id, { category: 'bug', title: 'Admin bug', description: 'D' })
    t2 = await createTicket(user.id, { category: 'bug', title: 'Player bug', description: 'D' })
    await db('bug_tickets').where({ id: t1.id }).update({ cluster_label: 'Cluster N' })

    const adminOnly = await listTickets({ origin: 'admin' })
    assert.ok(adminOnly.some(t => t.id === t1.id))
    assert.ok(!adminOnly.some(t => t.id === t2.id))

    const byCluster = await listTickets({ clusterLabel: 'cluster n' })
    assert.ok(byCluster.some(t => t.id === t1.id))
  } finally {
    await cleanupTickets(t1, t2)
    await cleanupUsers(admin, user)
  }
})

test('updateTicket — pose reviewed_by/reviewed_at et valide le statut', { skip }, async () => {
  const admin = await createUser('admin')
  const user = await createUser('user')
  let ticket
  try {
    ticket = await createTicket(user.id, { category: 'bug', title: 'T', description: 'D' })
    const updated = await updateTicket(admin.id, ticket.id, { status: 'triaged', priority: 'high' })
    assert.equal(updated.status, 'triaged')
    assert.equal(updated.priority, 'high')
    assert.equal(updated.reviewed_by, admin.id)
    assert.notEqual(updated.reviewed_at, null)
  } finally {
    await cleanupTickets(ticket)
    await cleanupUsers(admin, user)
  }
})

test('updateTicket — rejette un statut invalide', { skip }, async () => {
  const admin = await createUser('admin')
  const user = await createUser('user')
  let ticket
  try {
    ticket = await createTicket(user.id, { category: 'bug', title: 'T', description: 'D' })
    await assert.rejects(
      updateTicket(admin.id, ticket.id, { status: 'closed' }),
      /status doit être/
    )
  } finally {
    await cleanupTickets(ticket)
    await cleanupUsers(admin, user)
  }
})

test('updateTicket — 404 si le ticket n\'existe pas', { skip }, async () => {
  const admin = await createUser('admin')
  try {
    await assert.rejects(
      updateTicket(admin.id, '00000000-0000-0000-0000-000000000000', { status: 'triaged' }),
      /introuvable/
    )
  } finally {
    await cleanupUsers(admin)
  }
})

test('updateTicket — rejette un patch vide', { skip }, async () => {
  const admin = await createUser('admin')
  const user = await createUser('user')
  let ticket
  try {
    ticket = await createTicket(user.id, { category: 'bug', title: 'T', description: 'D' })
    await assert.rejects(
      updateTicket(admin.id, ticket.id, {}),
      /Aucun champ/
    )
  } finally {
    await cleanupTickets(ticket)
    await cleanupUsers(admin, user)
  }
})

test.after(async () => { await db.destroy() })
