// Import ponctuel — 5 retours du beta-test joueurs du 2026-09-05 (message direct de Saar, pas encore
// dans BUGIDENTIFIE.md/EN_COURS.md). Chaque bug a été diagnostiqué (lecture code + vérification base
// où pertinent) avant écriture du ticket — voir `description`/`admin_notes` pour le détail et ce qui
// reste [HYPOTHÈSE] vs [VÉRIFIÉ]. Même patron que importBugIdentifie.js : origin='admin' (transcrit par
// Claude depuis un rapport oral, pas un formulaire /report-bug joueur), linked_bug_code stable
// (BETA-35..39, suite de la plage BETA-* déjà utilisée par importBugIdentifie.js, la dernière étant
// BETA-34), idempotent par linked_bug_code.
//
// Lancement manuel : node --env-file=.env server/src/scripts/import_beta_test_20260905.js

import db from '../db/knex.js'

const ENTRIES = [
  {
    code: 'BETA-35',
    title: "Formulaire d'inscription : contraste insuffisant (tokens CSS --bg-card / --border-normal inexistants)",
    domain: 'infrastructure',
    priority: 'medium',
    status: 'triaged',
    description:
      "Retour beta-test : contraste trop faible sur le formulaire d'inscription (RegisterPage.jsx). " +
      "Vérifié dans le code (client/src/pages/RegisterPage.jsx) : contrairement à LoginPage.jsx (qui " +
      "utilise les classes CSS partagées .login-page/.login-card/.login-field, cf. client/src/index.css " +
      "L400-521), RegisterPage.jsx est écrit en 100% style={} inline (violation de la convention " +
      "react.md : \"style={} = layout uniquement, jamais une valeur visuelle\") et référence deux " +
      "custom properties CSS, --bg-card (L179) et --border-normal (L126/L180/L181), qui n'existent " +
      "NULLE PART dans le fichier de tokens (client/src/index.css :root, L31-108) ni ailleurs dans le " +
      "client (grep exhaustif sur client/src : aucune définition, RegisterPage.jsx est le seul fichier " +
      "à les référencer). Un var() sur une custom property non définie retombe sur la valeur initiale " +
      "de la propriété CSS (transparent pour background-color, currentColor pour border-color), pas sur " +
      "une couleur de la palette Wizard — d'où un rendu dégradé/incohérent selon le navigateur, cohérent " +
      "avec un contraste jugé insuffisant. [VÉRIFIÉ] : les deux tokens sont absents de la palette. " +
      "[HYPOTHÈSE] non testée navigateur : c'est précisément ce fallback qui cause le symptôme visuel " +
      "rapporté (à confirmer par capture d'écran ou DevTools avant de coder).",
    admin_notes:
      "Piste de correctif (non codée, à valider avant de coder — feedback_check_sibling_ui_before_" +
      "styling) : aligner RegisterPage.jsx sur le pattern de sa page sœur LoginPage.jsx (classes " +
      ".login-* déjà stylées et testées) plutôt que d'inventer 2 nouveaux tokens qui dupliqueraient " +
      "--bg-input/--border-subtle déjà existants. Pas trivial au sens 1 ligne (restructuration JSX + " +
      "classes), mais périmètre clair et pattern déjà établi par le fichier sœur.",
  },
  {
    code: 'BETA-36',
    title: "Compte d.lebosse@protonmail.com pas admin sur le serveur distant",
    domain: 'infrastructure',
    priority: 'high',
    status: 'triaged',
    description:
      "Retour Saar : son propre compte d.lebosse@protonmail.com n'a pas le rôle admin sur l'instance " +
      "distante (Kiwi). Mécanisme vérifié dans le code (server/src/lib/bootstrapAdmin.js, appelé une " +
      "fois au démarrage par server/src/index.js:163, après db.migrate.latest()) : la promotion admin " +
      "se fait exclusivement via la variable d'environnement ADMIN_BOOTSTRAP_EMAIL, propre à chaque " +
      "instance (jamais un email en dur dans une migration, PLAN_ADMIN.md §0.8) — bootstrapAdminFromEnv() " +
      "promeut UPDATE users SET role='admin' WHERE email = process.env.ADMIN_BOOTSTRAP_EMAIL, " +
      "idempotent, silencieux si la variable est absente. Aucune autre voie de promotion n'existe côté " +
      "serveur pour le tout premier admin d'une instance (PATCH /admin/users/:id/role exige déjà " +
      "requireAdmin — problème de l'œuf et la poule si aucun admin n'existe). Root cause la plus " +
      "probable [HYPOTHÈSE, à vérifier par Saar sur l'environnement distant] : ADMIN_BOOTSTRAP_EMAIL " +
      "absente sur l'instance Kiwi, ou définie avec une valeur différente de " +
      "\"d.lebosse@protonmail.com\" (typo, ancien email), ou le compte utilisateur distant n'a pas " +
      "exactement cet email en base (casse, variante).",
    admin_notes:
      "Action requise côté Saar (config remote, hors périmètre code local) : vérifier/poser " +
      "ADMIN_BOOTSTRAP_EMAIL=d.lebosse@protonmail.com dans l'environnement du serveur distant puis " +
      "redémarrer (le bootstrap ne s'exécute qu'au démarrage). Si déjà posée correctement, vérifier " +
      "l'email exact du compte en base distante (`select email from users where role != 'admin'`).",
  },
  {
    code: 'BETA-37',
    title: "Exo-armure joueur : \"Déplacement indisponible — Request failed with status code 404\"",
    domain: 'combat',
    priority: 'high',
    status: 'triaged',
    description:
      "Retour beta-test : bannière d'erreur \"⚠ Déplacement indisponible — Request failed with status " +
      "code 404\" dans la fenêtre de déclaration exo-armure du joueur. Message affiché depuis " +
      "client/src/components/CombatExoActionWindow.jsx:320 (clé exoActionWindow.movementUnavailable), " +
      "alimenté par alluresError (L104), lui-même posé par le catch du GET " +
      "`/char-sheet/${charId}/exo/movement` (L92-105, charId = playerChar?.id). Le seul point du " +
      "serveur pouvant renvoyer 404 sur cette route est router.param('characterId') " +
      "(server/src/routes/character/char-sheet.js:87-90) : `if (!character) return next(new " +
      "AppError(404, 'Character not found'))` — la route /exo/movement elle-même (L2308-2318) ne " +
      "renvoie que 400 (MovementBudgetError, exo mal configurée) ou 500, jamais 404 directement. " +
      "[VÉRIFIÉ] : 404 signifie donc que characterId envoyé par le client ne correspond à AUCUNE ligne " +
      "de la table `characters` au moment de l'appel — pas un problème de configuration d'exo (déjà " +
      "couvert par le cas 400 documenté au commentaire L97-104, bug distinct BETA-2026-08-26 déjà " +
      "corrigé), mais un ID de personnage invalide/périmé envoyé par le client. Cause exacte de cet ID " +
      "périmé [INCONNU] : playerChar est résolu depuis characters.find(c => c.id === " +
      "playerToken.character_id) (L55, characters = prop venant du parent SessionPage) — un état local " +
      "`characters` désynchronisé de la base au moment du fetch expliquerait le symptôme, mais aucune " +
      "condition de repro précise n'a été fournie par le beta-testeur (bug non reproductible en l'état, " +
      "AGENTS.md §méthode).",
    admin_notes:
      "Pas de correctif codé (cause exacte de l'ID périmé non confirmée). Instrumentation recommandée " +
      "avant tout correctif (pattern feedback_no_repro_harden_dont_guess) : logger côté serveur, dans " +
      "router.param('characterId'), le characterId reçu quand la ligne est introuvable (déjà un " +
      "AppError 404 mais sans log applicatif) — permettrait de savoir si l'ID est un UUID malformé, un " +
      "ID d'une session/campagne différente, ou un ID d'un personnage supprimé entre-temps. Prochaine " +
      "occurrence : demander au joueur concerné le personnage/l'exo précis et l'heure exacte.",
  },
  {
    code: 'BETA-38',
    title: "Fiche personnage — onglet Matériel long à charger pour les joueurs",
    domain: 'personnage',
    priority: 'medium',
    status: 'triaged',
    description:
      "Retour beta-test : l'onglet Matériel de la fiche personnage est long à charger pour les " +
      "joueurs. Deux causes concrètes trouvées en lisant le code (aucune n'est un payload " +
      "individuellement énorme — le symptôme vient de l'empilement de requêtes réseau, plus sensible " +
      "en latence réelle qu'en local) : " +
      "(1) client/src/character/CharacterSheet.jsx:396-494 charge la fiche en cascade SÉQUENTIELLE " +
      "(waterfall), pas en parallèle : Promise.all(genotypes, skills) → await sheet (L410) → await " +
      "advantages (L470, attend la fin de sheet) → await mutations (L477, attend la fin de advantages) " +
      "→ Promise.all(wounds, inventory) (L484-487, attend la fin de mutations) — 4 aller-retours réseau " +
      "en série minimum au lieu d'un seul Promise.all global, alors qu'aucun de ces appels ne dépend " +
      "réellement du résultat des précédents (tous ne requièrent que characterId, déjà connu avant le " +
      "premier appel). (2) client/src/character/ArmorWoundPanel.jsx:23-40 refait un GET " +
      "`/char-sheet/${characterId}/wounds` À CHAQUE MONTAGE du composant (donc à chaque fois que le " +
      "joueur ouvre l'onglet Matériel, qui est monté/démonté conditionnellement par " +
      "activeTab === 'materiel' dans CharacterWindow.jsx:448) — alors que CharacterSheet.jsx a DÉJÀ " +
      "fetché /wounds une première fois au chargement initial (L485, pour calculer woundPenalty). " +
      "useInventoryData.js (utilisé par le même onglet pour l'inventaire) suit pourtant déjà le bon " +
      "pattern : il vérifie le store (`items !== undefined`) avant de refetcher (L18-21, commentaire " +
      "\"un seul fetch initial... plus de fetch répété par panneau\") — ArmorWoundPanel ne suit pas ce " +
      "même garde-fou pour les blessures, malgré un store partagé déjà présent " +
      "(useCharacterStore woundsByCharId) qui pourrait servir la même dédup.",
    admin_notes:
      "Pas codé (plusieurs fichiers, cross-cutting — feedback_sequential_planning : un correctif = un " +
      "plan dédié, pas un bonus glissé dans un ticket de triage). Piste : (a) regrouper les 4 étapes de " +
      "CharacterSheet.jsx en un seul Promise.all (aucune dépendance réelle entre elles) ; (b) faire " +
      "suivre à ArmorWoundPanel.jsx le même pattern que useInventoryData.js (vérifier woundsByCharId " +
      "avant de refetcher, ne fetcher que si absent du store).",
  },
  {
    code: 'BETA-39',
    title: "Humanoïde + lance-flammes : ciblage sur une cible unique au lieu d'une zone",
    domain: 'combat',
    priority: 'medium',
    status: 'new',
    description:
      "Retour beta-test : un lance-flammes porté par un humanoïde propose un ciblage sur cible unique " +
      "plutôt qu'une visée de zone (attendu : cône, PLAN_ARMES_SPECIALES.md §1.4/§1.5-A). Vérifications " +
      "faites, toutes concluantes (rien d'anormal trouvé statiquement) : le catalogue " +
      "(ref_equipment \"Lance-flammes\") a bien fire_mode='RL' et aoe_profile={shape:'cone', " +
      "angleDeg:30, mechanic:'flamethrower'} en base [VÉRIFIÉ par requête directe] — il passe donc le " +
      "filtre .filter(item => item.ref_fire_mode) de CombatActionWindow.jsx:365 (pas exclu de la liste " +
      "des armes à feu, contrairement à l'hypothèse initiale d'un bug de classification CaC/Tir déjà " +
      "vu 2× sur ce projet côté exo puis drone, DRONE-CC-MELEE-MISCLASS). isAoeEligible = " +
      "isAoeWeapon(selectedWeapon?.ref_aoe_profile) est câblé de façon cohérente et symétrique dans les " +
      "3 fenêtres concernées : CombatActionWindow.jsx:446 (PJ), CombatGmDeclareWindow.jsx:342 (PNJ, " +
      "modifié le 2026-09-02 d'après son propre commentaire), CombatExoActionWindow (exo). " +
      "inventoryService.getInventory sélectionne bien ref_equipment.aoe_profile as ref_aoe_profile " +
      "(L257, commentaire explicite \"éligibilité Viser une zone côté fenêtre PJ\"). Aucune lecture " +
      "statique du code n'explique le symptôme — [INCONNU] : bug non reproduit, conditions exactes non " +
      "fournies par le beta-testeur (PJ ou PNJ ? quelle fenêtre exactement ? le bouton \"Viser une " +
      "zone\" était-il visible et non cliqué, ou absent de l'UI ?).",
    admin_notes:
      "Ticket ouvert en status=new (pas triaged) faute de repro : aucune piste de correctif à proposer " +
      "tant que les conditions exactes ne sont pas connues (AGENTS.md — bug non reproductible, " +
      "documenter avant d'analyser). Prochaine étape : redemander au beta-testeur concerné le contexte " +
      "précis (PJ/PNJ, fenêtre, capture d'écran si possible).",
  },
]

async function run() {
  const admin = await db('users').where({ role: 'admin' }).first('id', 'username')
  if (!admin) throw new Error('Aucun compte admin trouvé — bootstrap requis avant import.')

  let inserted = 0
  let skipped = 0

  for (const entry of ENTRIES) {
    const existing = await db('bug_tickets').where({ linked_bug_code: entry.code }).first('id')
    if (existing) { skipped++; continue }

    await db('bug_tickets').insert({
      reporter_id: admin.id,
      origin: 'admin',
      category: 'bug',
      domain: entry.domain,
      title: entry.title,
      description: entry.description,
      status: entry.status,
      priority: entry.priority,
      cluster_label: 'Beta-test 2026-09-05',
      linked_bug_code: entry.code,
      admin_notes: entry.admin_notes,
    })
    inserted++
  }

  console.log(`[IMPORT-BETA-20260905] ${inserted} tickets créés, ${skipped} déjà présents (linked_bug_code), par ${admin.username}.`)
  await db.destroy()
}

run().catch(err => { console.error(err); process.exit(1) })
