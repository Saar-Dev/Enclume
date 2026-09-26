// Script à usage unique — crée les tickets des défauts EXISTANTS trouvés par l'analyse à charge de la sécurité de l'import de carte
// (2026-09-26, docs/PLANS/PLAN_EXPORT_CARTE.md §11). Le niveau de preuve est indiqué dans chaque description.
// Lancement manuel, local : node --env-file=.env server/src/scripts/create_tickets_20260926_editeur_carte_securite.js
// Écrit dans la base locale (bug_tickets uniquement) — idempotent : ne recrée pas un ticket dont le linked_bug_code existe déjà.

import db from '../db/knex.js'

const TICKETS = [
  {
    code: 'ASSETS-ROUTE-NO-AUTH',
    category: 'bug',
    domain: 'infrastructure',
    title: "GET /api/assets/* est montée sans authentification alors que son commentaire dit « auth requise »",
    description: `
Trouvé en analysant la sécurité de l'import de carte (2026-09-26). [VÉRIFIÉ par lecture] server/src/routes/assets.js commente « Auth requise — les assets
ne sont pas publics », mais le routeur n'utilise aucun \`requireAuth\`, et server/src/index.js le monte sans middleware (\`app.use('/api/assets', assetsRouter)\`).
Il proxifie n'importe quelle clé du bucket MinIO (\`:folder/*filePath\`), y compris les illustrations de personnages et les textures.
[HYPOTHÈSE] tout client qui connaît (ou devine) un chemin peut lire l'objet sans compte ; non testé en conditions réelles (les chemins contiennent des UUID).
[INCONNU] si le client charge des assets via cette route avec des jetons dans l'URL (qui casseraient si l'auth devenait obligatoire) — à vérifier avant de corriger.

Piste : monter requireAuth sur la route, vérifier que le client envoie bien ses identifiants pour les GLB et images (chargeurs three.js et balises img), traiter le cas des
assets intégrés servis en statique (\`/api/assets/builtin-models\`).
`.trim(),
    context: { fichiers: ['server/src/routes/assets.js', 'server/src/index.js'] },
    status: 'new',
    priority: 'medium',
  },
  {
    code: 'CONNECTOR-MODEL-URL-ABSOLUTE',
    category: 'bug',
    domain: 'editeur',
    title: "Le rendu d'une porte charge toute URL http(s) trouvée dans connector.modelGlbUrl, sans contrôle",
    description: `
Trouvé en analysant la sécurité de l'import de carte (2026-09-26). [VÉRIFIÉ par lecture] \`connectorAssetUrl\` (client/src/components/SurfaceDungeonScene.jsx, ~l.1385)
renvoie \`modelGlbUrl\` tel quel s'il commence par http:// ou https://, sinon le préfixe par /api/assets. Le validateur serveur (surfaceDocument.js) ne contrôle pas ce champ.
Un surface_data contenant une URL externe ferait charger ce fichier par tous les clients qui ouvrent la carte (fuite d'adresse IP, contenu tiers). Un modelGlbUrl non textuel
fait lever \`rawUrl.startsWith\` au rendu (TypeError). Exploitable aujourd'hui uniquement par un MJ qui écrit son propre document ; devient un vecteur réel avec l'import de fichiers tiers.

Piste : refuser les URL absolues pour les modèles de carte côté client ; côté serveur, reconstruire modelGlbUrl depuis modelBuiltinKey (segment S0 du chantier éditeur de carte).
`.trim(),
    context: { fichiers: ['client/src/components/SurfaceDungeonScene.jsx (connectorAssetUrl)', 'shared/world/surfaceDocument.js'], plan: 'docs/PLANS/PLAN_EXPORT_CARTE.md §11' },
    status: 'new',
    priority: 'medium',
  },
  {
    code: 'SURFACE-DOC-NO-BOUNDS',
    category: 'bug',
    domain: 'editeur',
    title: "surface_data n'a aucun plafond : une salle sans cases aux bornes énormes fige le serveur (boucle synchrone)",
    description: `
Trouvé en analysant la sécurité de l'import de carte (2026-09-26). [VÉRIFIÉ par lecture] \`roomGeometryCells\` (shared/world/roomGeometry.js) énumère, pour une salle sans \`cells\`,
toutes les cases de minX..maxX × minZ..maxZ dans une double boucle ; \`validateFeature\` (shared/world/surfaceDocument.js) ne vérifie que « nombre fini » (\`Number.isFinite\`, 1e300 passe).
\`compileSurfaceWorld\` est synchrone : elle bloquerait le processus serveur pour toutes les campagnes. Aucun plafond de nombre de salles, murs, connecteurs, cases ou points d'anneau n'existe
(grep \`MAX_\` dans shared/ : aucun résultat). Le validateur accepte aussi \`null\`, \`""\`, \`true\` dans un champ numérique (\`Number(x)\` fini) et ne plafonne pas le nombre d'erreurs renvoyées.
[HYPOTHÈSE] non exécuté (l'effet réel — gel ou dépassement mémoire — reste à mesurer par un test isolé). Un MJ peut déjà envoyer un tel document par PUT /surface ; l'import de fichiers tiers en ferait une attaque passive.

Piste : plafonds structurels et validation de type stricte dans le validateur partagé (segment S0, lot cœur pur), testés par des fixtures hostiles générées en mémoire.
`.trim(),
    context: { fichiers: ['shared/world/roomGeometry.js (roomGeometryCells)', 'shared/world/surfaceDocument.js (validateFeature)', 'shared/world/worldCompiler.js'], plan: 'docs/PLANS/PLAN_EXPORT_CARTE.md §11' },
    status: 'new',
    priority: 'medium',
  },
  {
    code: 'TEXTUREPACKS-IMPORT-ERROR-OBJECT',
    category: 'bug',
    domain: 'editeur',
    title: "Import/export de pack de textures : l'erreur serveur (objet) est affichée comme texte, et le nom de fichier de l'export n'est pas assaini",
    description: `
Trouvé en analysant l'interface d'export de carte (2026-09-26). [VÉRIFIÉ par lecture] client/src/pages/TexturePacksPage.jsx (~l.178-194) fait \`setImportError(err.response?.data?.error || …)\` puis
rend la valeur ; or server/src/middleware/errorHandler.js renvoie \`error: { status, message, i18nKey? }\`, un OBJET : React ne sait pas rendre un objet (erreur ou affichage « [object Object] »).
Côté serveur, server/src/routes/texture-packs.js (~l.318) met \`pack.name\` brut dans \`Content-Disposition\` : [HYPOTHÈSE] un nom avec caractère hors latin-1 ou saut de ligne fait lever Node (500) ; non reproduit.
Le même fichier importe un ZIP sans plafond de taille décompressée et sans transaction (INSERT en série, MinIO écrit avant la base).

Piste : lire \`error.i18nKey\` avec repli sur \`error.message\` (patron WizardCreation.jsx), \`filename*=UTF-8''\` à l'export ; le reste est un durcissement à cadrer avec le segment S0 s'il réutilise ce code.
`.trim(),
    context: { fichiers: ['client/src/pages/TexturePacksPage.jsx', 'server/src/routes/texture-packs.js', 'server/src/middleware/errorHandler.js'] },
    status: 'new',
    priority: 'low',
  },
  {
    code: 'MAP-SCALE-NO-AUTHORITY',
    category: 'bug',
    domain: 'editeur',
    title: "Échelle d'une carte : la colonne scale_label n'est lue par personne et metersPerCell est effacé à chaque sauvegarde de l'éditeur",
    description: `
Trouvé en analysant la partie serveur de l'export de carte (2026-09-26). [VÉRIFIÉ par lecture] \`battlemaps.scale_label\` est écrite (création, modification, duplication) mais lue par aucun code
client, shared ou service \`world*\` (seule la liste de cartes la renvoie). Le moteur lit \`surface_data.metersPerCell\` (shared/world/surfaceDocument.js \`toWorldDocument\`, défaut 1,5 ; SessionPage.jsx l.1254),
mais \`normalizeSurfaceData\` côté client (client/src/lib/surfaceCore.js, liste fermée de clés) ne le recopie pas : chaque sauvegarde de l'éditeur le supprime. [VÉRIFIÉ en base] absent de la carte réelle.
Aujourd'hui personne n'écrit \`metersPerCell\`, donc aucun effet visible ; mais la première fonctionnalité qui l'écrira (échelle par carte) le verra disparaître, et \`scale_label\` donne l'illusion d'une échelle réglable.

Piste : choisir UNE autorité d'échelle (par carte ?) avant toute fonctionnalité qui en dépend ; corriger la liste fermée de clés (même piège que pour les décorations murales, PLAN_EDITEUR_CARTE §7).
`.trim(),
    context: { fichiers: ['client/src/lib/surfaceCore.js (normalizeSurfaceData)', 'shared/world/surfaceDocument.js (toWorldDocument)', 'server/src/routes/battlemaps.js'], plan: 'docs/PLANS/PLAN_EXPORT_CARTE.md' },
    status: 'new',
    priority: 'low',
  },
  {
    code: 'WORLD-COMPILE-SUPERLINEAR',
    category: 'bug',
    domain: 'monde',
    title: "compileSurfaceWorld est synchrone et très coûteux : une salle 50×50 met ~6,6 s, exécutée à chaque sauvegarde de l'éditeur",
    description: `
Trouvé en cadrant l'export de carte (2026-09-26). [MESURÉ par Claude, en mémoire, sans base, une salle carrée par mesure, machine de dev] : 10×10 = 66 ms ; 20×20 = 270 ms ; 30×30 = 1,1 s ;
40×40 = 3,1 s ; 50×50 = 6,6 s (la croissance dépasse celle de la surface). [VÉRIFIÉ par lecture] \`PUT /battlemaps/:id/surface\` compile dans la transaction, de façon synchrone (worldCompiler.js), et
l'éditeur envoie ce PUT à chaque modification (Editor3D.jsx, handleSurfaceDataChange). [HYPOTHÈSE] une carte contenant une grande salle bloque donc la boucle d'événements du serveur (toutes les campagnes,
Socket.IO compris) plusieurs secondes à chaque geste d'édition ; non observé en conditions réelles. La carte réelle actuelle (2 salles, 443 supports) reste rapide.

Piste : profiler la compilation (structure quadratique probable dans l'énumération des cases/murs — [INCONNU] à instrumenter), la déplacer hors du fil principal (worker_thread) ou la rendre incrémentale ;
en attendant, plafonner la taille (segment S0 : MAP_LIMITS, départ 50×50).
`.trim(),
    context: { fichiers: ['shared/world/worldCompiler.js', 'server/src/routes/battlemaps.js (PUT /:id/surface)', 'client/src/components/Editor3D.jsx'], plan: 'docs/PLANS/PLAN_EXPORT_CARTE.md §6' },
    status: 'new',
    priority: 'medium',
  },
]

async function run() {
  for (const t of TICKETS) {
    const existing = await db('bug_tickets').where({ linked_bug_code: t.code }).first()
    if (existing) {
      console.log(`Ticket ${t.code} existe déjà (id=${existing.id}, statut=${existing.status}) — rien à faire.`)
      continue
    }

    const [row] = await db('bug_tickets')
      .insert({
        origin: 'admin',
        category: t.category,
        domain: t.domain,
        title: t.title,
        description: t.description,
        context: JSON.stringify(t.context),
        status: t.status,
        priority: t.priority,
        linked_bug_code: t.code,
      })
      .returning(['id', 'status', 'priority'])

    console.log(`Ticket ${t.code} créé : id=${row.id}, statut=${row.status}, priorité=${row.priority}.`)
  }
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
