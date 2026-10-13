// Script à usage unique — note de progression TEXTUREPACKS-IMPORT-ERROR-OBJECT : correctif codé,
// scénario réel navigateur restant à valider par Saar avant clôture. Détail complet : JOURNAL8.md,
// session du 2026-10-13.
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/note_ticket_texturepacks_import_error_object.js

import db from '../db/knex.js'

const CODE = 'TEXTUREPACKS-IMPORT-ERROR-OBJECT'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-13 : correctif codé ---\n' +
    "TexturePacksPage.jsx affichait l'erreur serveur brute (err.response?.data?.error, un OBJET " +
    '{status, message, i18nKey?}) sur 6 sites — React rendait « [object Object] ». Corrigé : les 6 ' +
    'sites utilisent désormais extractErrorMessage(err, t) (client/src/lib/apiError.js, créé plus ' +
    'tôt dans cette session pour GameTimeWidget.jsx) — 3ᵉ réutilisation de ce correctif, pas une ' +
    'nouvelle copie. Les deux branches 409 déjà personnalisées (pack utilisé, fichier en cours ' +
    "d'usage) inchangées. Fix secondaire (serveur) : pack.name peut venir d'un manifest.json " +
    'importé (champ libre, non validé) — un caractère de contrôle ou hors ASCII levait une ' +
    'exception Node sur Content-Disposition à l\'export. Corrigé par un repli ASCII assaini + le ' +
    "nom réel en UTF-8 (filename*=UTF-8'', RFC 5987). Hors périmètre (signalé par le ticket comme " +
    "chantier séparé) : plafond de taille ZIP, transaction DB/MinIO à l'import. Testé : ESLint (0 " +
    'nouveau problème), build client propre, node --check serveur. Non testé : aucun test ' +
    'automatisé existant pour cette page/route — provoquer un refus (nom déjà pris) et vérifier un ' +
    'message lisible ; exporter un pack à nom spécial et vérifier que le téléchargement ne plante plus.'

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'in_progress', // codé, scénario réel navigateur non testé
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket ${CODE} (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
