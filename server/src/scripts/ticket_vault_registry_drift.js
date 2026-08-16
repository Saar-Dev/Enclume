// Script à usage unique (patron importBugIdentifie.js) — un ticket, trouvé en vérifiant
// assertRegistryUpToDate (vaultService.js) contre l'information_schema réelle pendant le chantier
// Coffre (docs/EN_COURS.md, 2026-08-16). Idempotent via linked_bug_code.
//
// Lancement manuel : node --env-file=.env server/src/scripts/ticket_vault_registry_drift.js

import db from '../db/knex.js'

const CODE = 'VAULT-REGISTRY-DRIFT1'

async function run() {
  const existing = await db('bug_tickets').where({ linked_bug_code: CODE }).first('id')
  if (existing) {
    console.log(`Ticket ${CODE} déjà présent (id=${existing.id}) — rien à faire.`)
    return
  }

  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé — bootstrap requis avant création du ticket.')

  const [ticket] = await db('bug_tickets').insert({
    reporter_id: admin.id,
    origin: 'admin',
    category: 'bug',
    linked_bug_code: CODE,
    domain: 'infrastructure',
    title: 'cloneCharacterDeep : 6 tables non couvertes par le registre anti-dérive — tout transfert Coffre→campagne échoue probablement',
    description:
      'assertRegistryUpToDate (server/src/services/vaultService.js:67-89) doit lister TOUTE table ' +
      'ayant une FK réelle vers characters/char_sheet, soit dans COMPANION_REGISTRY soit dans ' +
      'EXCLUDED_TABLES — sinon il lève AppError 500 avant tout clonage (garde-fou volontaire, ' +
      'PLAN_VAULT.md "Garde-fou anti-dérive"). Vérifié contre information_schema réel (script ' +
      'server/src/scripts/check_registry_drift.js) : 6 tables ont une FK réelle mais ne sont NI ' +
      'enregistrées NI exclues — char_gauges, char_inventory_slots, chat_messages, exo_sheet, ' +
      'game_echeances, wizard_locks. Par la logique même du garde-fou, cloneCharacterDeep devrait ' +
      'donc échouer aujourd\'hui pour TOUT personnage, dans les deux sens (approveImport Coffre→' +
      'campagne, cloneToVault campagne→Coffre) — probablement jamais exercé en usage réel depuis que ' +
      'ces 6 tables ont été ajoutées par des chantiers ultérieurs (Jauges de Matériel, Slots ' +
      'inventaire, Chat, Exo-armures, Échéances de jeu, Wizard collaboratif) sans mise à jour du ' +
      'registre. Non reproduit en navigateur (pas encore tenté), mais la lecture du code ne laisse ' +
      'aucune ambiguïté sur le comportement.\n\n' +
      'Classification pour le correctif (pas fait, à trancher/coder séparément) :\n' +
      '- wizard_locks, game_echeances, chat_messages : état de session/workflow, pas le personnage ' +
      'lui-même → candidats à EXCLUDED_TABLES, même famille que tokens/trade_log/vault_transfer_requests.\n' +
      '- char_gauges : ressource de personnage persistante (PLAN_WIZARD_MATERIEL_GAUGES.md) → ' +
      'candidat CHAR_SHEET_KEYED_TABLES, clé char_sheet_id, PK composite (pas de colonne id — ' +
      'déjà géré par cloneRows).\n' +
      '- exo_sheet : type de compagnon entier absent du registre (le commentaire du fichier dit ' +
      'littéralement "futur : exo: {...}") — pas juste un oubli de table, une entrée entière à ' +
      'construire dans COMPANION_REGISTRY.\n' +
      '- char_inventory_slots : PIÈGE — deux FK réelles (char_inventory_id ET character_id), le ' +
      'helper générique cloneRows ne remappe qu\'une seule colonne FK à la fois. Ne peut PAS être ' +
      'ajoutée telle quelle à CHARACTER_KEYED_TABLES_GROUP_A sans logique de clonage dédiée ' +
      '(table de correspondance ancien char_inventory.id → nouveau, avant de remapper les deux ' +
      'colonnes de chaque ligne char_inventory_slots).',
    status: 'triaged',
    priority: 'high',
    cluster_label: 'Coffre',
    admin_notes:
      'Trouvé en vérifiant une hypothèse plus étroite (wizard_locks) avant de coder ' +
      'cloneCharacterDeep pour le chantier Coffre — l\'ampleur réelle (6 tables, pas 1) dépasse le ' +
      'périmètre de ce chantier. Bloque potentiellement tout le mécanisme de transfert Vault, ' +
      'indépendamment de mes changements en cours (isVaultOwner, retrait du gate creation_state) — ' +
      'à confirmer en navigateur et prioriser avant de considérer le chantier Coffre "transférable" ' +
      'fonctionnellement.',
  }).returning(['id'])

  console.log(`Ticket ${CODE} créé (id=${ticket.id}).`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
