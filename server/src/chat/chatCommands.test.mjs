// Lancement manuel : node --env-file=../../.env --test server/src/chat/chatCommands.test.mjs
// Pas de dépendance DB : context est mocké (chatCommands.js n'accède jamais à la DB directement).
// Les réponses portent des i18nKey, jamais de texte FR figé (.claude/rules/i18n.md) — cf. PLAN_CHAT.md §16.
import test from 'node:test'
import assert from 'node:assert/strict'

import { chatCommandRegistry } from './chatCommands.js'

test('/help liste les commandes enregistrées via des i18nKey', async () => {
  const result = await chatCommandRegistry.execute('help', {}, [])
  assert.equal(result.reply.i18nKey, 'chat.commands.help.list')
  const names = result.reply.params.commands.map((c) => c.name)
  assert.deepEqual(names.sort(), ['gm', 'heal', 'help', 'w'])
  for (const cmd of result.reply.params.commands) {
    assert.match(cmd.descriptionKey, /^chat\.commands\./)
  }
})

test('/w sans destinataire renvoie la clé d\'usage', async () => {
  const result = await chatCommandRegistry.execute('w', {
    findCampaignMemberByUsername: async () => null,
  }, [])
  assert.equal(result.reply.i18nKey, 'chat.commands.whisper.usage')
})

test('/w vers un joueur introuvable renvoie la clé targetNotFound', async () => {
  const result = await chatCommandRegistry.execute('w', {
    findCampaignMemberByUsername: async () => null,
  }, ['Inconnu', 'salut'])
  assert.equal(result.reply.i18nKey, 'chat.commands.whisper.targetNotFound')
  assert.equal(result.reply.params.username, 'Inconnu')
})

test('/w vers un joueur valide renvoie une intention WHISPER', async () => {
  const result = await chatCommandRegistry.execute('w', {
    findCampaignMemberByUsername: async (username) => (username === 'Saar' ? { userId: 'u-saar' } : null),
  }, ['Saar', 'salut', 'toi'])
  assert.deepEqual(result.send, {
    channelId: 'whisper',
    type: 'WHISPER',
    recipientUserId: 'u-saar',
    payload: { text: 'salut toi', recipientUserId: 'u-saar' },
  })
})

test('/gm sans MJ trouvé renvoie la clé notFound', async () => {
  const result = await chatCommandRegistry.execute('gm', { gmUserId: null }, ['aide'])
  assert.equal(result.reply.i18nKey, 'chat.commands.gm.notFound')
})

test('/gm valide renvoie une intention WHISPER vers le MJ', async () => {
  const result = await chatCommandRegistry.execute('gm', { gmUserId: 'u-gm' }, ['besoin', 'aide'])
  assert.equal(result.send.recipientUserId, 'u-gm')
  assert.equal(result.send.payload.text, 'besoin aide')
})

test('/heal (sans argument) appelle context.healCharacters avec la portée "map"', async () => {
  let receivedScope = null
  const result = await chatCommandRegistry.execute('heal', {
    isGm: true,
    healCharacters: async (scope) => { receivedScope = scope; return { count: 3 } },
  }, [])
  assert.equal(receivedScope, 'map')
  assert.deepEqual(result.send, {
    channelId: 'general',
    type: 'SYSTEM',
    senderUserId: null,
    payload: { i18nKey: 'chat.commands.heal.done', params: { count: 3 } },
  })
})

test('/heal all appelle context.healCharacters avec la portée "campaign"', async () => {
  let receivedScope = null
  await chatCommandRegistry.execute('heal', {
    isGm: true,
    healCharacters: async (scope) => { receivedScope = scope; return { count: 0 } },
  }, ['all'])
  assert.equal(receivedScope, 'campaign')
})

test('/heal sans carte active renvoie une réponse privée noActiveMap', async () => {
  const result = await chatCommandRegistry.execute('heal', {
    isGm: true,
    healCharacters: async () => ({ count: 0, noMap: true }),
  }, [])
  assert.equal(result.reply.i18nKey, 'chat.commands.heal.noActiveMap')
})

test('/heal est refusé pour un non-MJ (permission "gm")', async () => {
  await assert.rejects(
    chatCommandRegistry.execute('heal', {
      isGm: false,
      healCharacters: async () => ({ count: 0 }),
    }, []),
    /réservée au MJ/,
  )
})

test('commande inconnue lève une erreur', async () => {
  await assert.rejects(chatCommandRegistry.execute('nope', {}, []), /Commande inconnue/)
})

test('une commande gm-only serait rejetée pour un non-MJ (aucune ne l\'est en V1, teste le mécanisme)', async () => {
  chatCommandRegistry.register({
    name: 'testgmonly',
    descriptionKey: 'chat.commands.testgmonly.description',
    permission: 'gm',
    execute: () => ({ reply: { i18nKey: 'chat.commands.testgmonly.ok' } }),
  })
  await assert.rejects(
    chatCommandRegistry.execute('testgmonly', { isGm: false }, []),
    /réservée au MJ/,
  )
  const result = await chatCommandRegistry.execute('testgmonly', { isGm: true }, [])
  assert.equal(result.reply.i18nKey, 'chat.commands.testgmonly.ok')
})
