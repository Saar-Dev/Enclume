// PLAN_TICKETS.md Lot 2 — import ponctuel du contenu de docs/BUGIDENTIFIE.md dans bug_tickets.
// Script à usage unique (comme server/src/db/generate-catalog-migration.js), pas un service
// applicatif. Ré-exécutable sans doublon : chaque ligne source porte un `linked_bug_code` stable
// (son identifiant BUGIDENTIFIE.md, ou "BETA-<n>" pour les retours beta-testeurs non encore
// dispatchés) — le script saute toute ligne dont le code existe déjà en base.
//
// Choix délibérés (transcription manuelle du contenu, pas un parseur markdown — un regex sur ce
// fichier aurait mélangé la table BETA, les sections "Clusters actifs" et les notes d'analyse libres
// en pied de fichier, trois formats différents) :
//  - origin='admin', reporter_id=le compte admin actuel (ces entrées viennent d'audits de code, pas
//    d'un joueur qui remplit le formulaire — cf. PLAN_TICKETS.md §4.1bis).
//  - category='bug' par défaut ; 'suggestion' pour les entrées explicitement décrites comme feature
//    dans BUGIDENTIFIE.md lui-même (FEAT4, et les lignes BETA "Amélioration UX"/"Fonctionnalité
//    manquante").
//  - status='suspended' pour les entrées BUGIDENTIFIE.md marquées "suspendu" ; 'new' pour la section
//    BETA (le fichier la décrit lui-même comme "temporaire... non dispatchée") ; 'triaged' pour le
//    reste (déjà identifiées et analysées, pas encore corrigées).
//  - priority : reprise du texte de docs/EN_COURS.md quand un mot clair (Basse/Moyenne/Haute/
//    Critique/Très basse) existe pour cet ID — BUGIDENTIFIE.md lui-même ne donne une priorité
//    explicite que pour la table BETA. Laissée NULL sinon (pas de priorité devinée).
//  - cluster_label : repris tel quel des sections "Clusters actifs" de BUGIDENTIFIE.md. Deux dérives
//    trouvées entre EN_COURS.md et BUGIDENTIFIE.md pendant la transcription (signalées à Saar, pas
//    corrigées silencieusement) : EN_COURS.md attribue UI2/UI3 au "Cluster Q" alors que
//    BUGIDENTIFIE.md les met au "Cluster P" (son "Cluster Q" désigne une autre dette, retirée) ;
//    CS4/CS5 ("Cluster O") et COM20/COM21 ("Cluster N") apparaissent dans EN_COURS.md mais pas dans
//    le registre de BUGIDENTIFIE.md — absents de cet import en conséquence (hors périmètre littéral
//    de la demande : "le contenu de BUGIDENTIFIE.md").
//  - Deux entrées de la table BETA (#18, #22) sont explicitement résolues par les notes d'analyse en
//    pied de fichier ("Bug 18 déjà corrigé, vérification faite", "Bug 22 non existant, vérification
//    faite") — exclues de l'import, ce ne sont plus des tickets ouverts.
//
// Lancement manuel : node --env-file=.env server/src/scripts/importBugIdentifie.js

import db from '../db/knex.js'

const CLUSTER_ENTRIES = [
  { code: 'COUVERTURE_TOTALE', title: 'Couverture totale (tir) inexistante', description: '« Couverture totale » (tir) n\'existe nulle part, ni côté client ni côté serveur.', domain: 'combat', status: 'triaged', priority: 'low', cluster_label: 'Cluster A' },
  { code: 'MODING4-ATI', title: 'Analyseur Tactique Individuel : aucune interface de configuration', description: 'Aucune interface de configuration cible/mode pour l\'Analyseur Tactique Individuel (mod arme, Groupe 4 MODING).', domain: 'combat', status: 'triaged', cluster_label: 'Cluster C' },
  { code: 'MODING4-MEMOIRE', title: 'Mémoire de cibles : aucune interface d\'enregistrement', description: 'Aucune interface d\'enregistrement de cibles pour le mod "Mémoire de cibles" (Groupe 4 MODING).', domain: 'combat', status: 'triaged', cluster_label: 'Cluster C' },
  { code: 'MODING4-PROJECTEUR', title: 'Projecteur de mouvement : "cible en zigzag" absent', description: 'L\'effet "cible en zigzag" du Projecteur de mouvement n\'existe nulle part (Groupe 4 MODING).', domain: 'combat', status: 'triaged', cluster_label: 'Cluster C' },
  { code: 'MODING4-INTEGRATION', title: 'Groupe 4 (MODING) jamais appelé en résolution réelle', description: 'Le Groupe 4 de mods (MODING4-*) n\'est jamais appelé en résolution réelle de combat.', domain: 'combat', status: 'triaged', cluster_label: 'Cluster C' },
  { code: 'ASCENSEUR1', title: 'Ascenseur : fenêtre de propriétés se ferme aussitôt', description: 'World builder : la fenêtre de propriétés d\'un ascenseur s\'ouvre puis se ferme aussitôt (spécifique ascenseur, pas porte/échelle). Non reproductible au moment du signalement.', domain: 'monde', status: 'suspended', cluster_label: 'Cluster D', admin_notes: 'En attente d\'une nouvelle occurrence pour instrumenter.' },
  { code: 'COM27', title: 'CaC multi-attaque : jet de défense semble précéder le jet d\'attaque', description: 'En CaC multi-attaque, le jet de défense semble se lancer avant le jet d\'attaque.', domain: 'combat', status: 'suspended', cluster_label: 'Cluster D', admin_notes: 'En attente de décision Saar (coder le correctif ou attendre confirmation).' },
  { code: 'ANNONCE-PRECHECK-STALE1', title: '"Action non autorisée" en fin de combat', description: '"Action non autorisée dans cet état de combat (phase:ANNOUNCEMENT, sous-état:?)" observé en fin de combat — pattern déjà connu, potentiellement pas entièrement corrigé.', domain: 'combat', status: 'suspended', priority: 'low', cluster_label: 'Cluster D' },
  { code: 'CATASTROPHE-SCOPE1', title: 'Une Catastrophe semble affecter deux protagonistes', description: 'Une Catastrophe semble affecter deux protagonistes au lieu du seul lanceur de dé — hypothèse la plus probable : deux jets de Catastrophe indépendants mal présentés dans la file MJ.', domain: 'combat', status: 'suspended', priority: 'low', cluster_label: 'Cluster D' },
  { code: 'ENTITYCLICK1', title: 'Clic sur entité interactive sans effet', description: 'Clic sur une entité interactive (porte/échelle) sans effet observable.', domain: 'monde', status: 'suspended', cluster_label: 'Cluster D' },
  { code: 'EQAMMOCOMPAT1', title: 'ref_equipment_ammo_compat jamais consommée ni peuplée', description: 'La table ref_equipment_ammo_compat n\'est jamais consommée, ni peuplée.', domain: 'combat', status: 'triaged', cluster_label: 'Cluster E', admin_notes: 'Décision Saar en attente.' },
  { code: 'SCHEMADRIFT-EXOTEMPLATES1', title: 'ref_exo_templates : colonnes/contraintes absentes des migrations', description: 'Colonnes/contraintes de ref_exo_templates absentes des migrations versionnées.', domain: 'infrastructure', status: 'triaged', cluster_label: 'Cluster E', admin_notes: 'Hors périmètre Phase 1 (PLAN_MIGRATIONS_REFONTE).' },
  { code: 'SCHEMADRIFT-BATTLEMAPSVOXEL1', title: 'battlemaps.voxel_data : DROP DEFAULT non versionné', description: 'Un DROP DEFAULT sur battlemaps.voxel_data n\'est pas versionné dans les migrations.', domain: 'infrastructure', status: 'triaged', cluster_label: 'Cluster E' },
  { code: 'HORLOGE-TEST1', title: 'adjustGameTime sans aucun test automatisé', description: 'adjustGameTime (gameTimeService.js) n\'a aucun test automatisé — seule la projection pure (shared/gameTime.js) est testée.', domain: 'infrastructure', status: 'triaged', cluster_label: 'Cluster G' },
  { code: 'CHARSTORE-NULLISH1', title: '?? false mort après un === dans characterStore.js', description: 'characterStore.js:15 — `?? false` mort après un `===` (ESLint no-constant-binary-expression). Cosmétique, aucun impact fonctionnel.', domain: 'personnage', status: 'triaged', priority: 'low', cluster_label: 'Cluster I' },
  { code: 'I18N-LINT3', title: 'setState synchrone dans un useEffect (plusieurs fichiers)', description: 'Plusieurs fichiers appellent setState de façon synchrone dans un useEffect. Traité partiellement, reste des occurrences.', domain: 'infrastructure', status: 'triaged', cluster_label: 'Cluster J' },
  { code: 'I18N-LINT2', title: 'Variables/props inutilisées (ESLint) — fichiers Combat', description: 'Variables/props inutilisées (ESLint) dans plusieurs fichiers Combat. Traité partiellement.', domain: 'combat', status: 'triaged', cluster_label: 'Cluster J' },
  { code: 'VX1', title: 'getVoxelSurfaceTop : pas de cas slope/wedge', description: 'getVoxelSurfaceTop ne gère pas les cas slope/wedge. Accepté en V1.', domain: 'monde', status: 'triaged', priority: 'low', cluster_label: 'Cluster J' },
  { code: 'AU1', title: 'useDiceAudio.js : sons de dés manquants', description: 'Sons de dés manquants/non câblés (useDiceAudio.js).', domain: 'infrastructure', status: 'triaged', priority: 'low', cluster_label: 'Cluster J' },
  { code: 'DCO1', title: 'onTokenRotate : dead code Canvas3D/Scene', description: 'onTokenRotate est du code mort dans Canvas3D/Scene.', domain: 'infrastructure', status: 'triaged', priority: 'low', cluster_label: 'Cluster J' },
  { code: 'MAP1', title: 'MAP_VIEWPORT : pas de déclencheur UI côté GM', description: 'MAP_VIEWPORT n\'a pas de déclencheur UI côté GM.', domain: 'monde', status: 'triaged', cluster_label: 'Cluster J' },
  { code: 'DEPLACEMENT3', title: 'Latence ~0,5-1s au premier "Déplacement" après validation', description: 'Latence résiduelle de ~0,5-1s au premier "Déplacement" après un déplacement validé.', domain: 'monde', status: 'triaged', priority: 'low', cluster_label: 'Cluster J', admin_notes: '"Rien de gênant" (Saar).' },
  { code: 'TOURTRANSITION1', title: 'Latence + message "En attente de {{nom}}" en chaînant des actions PNJ', description: 'Latence et message "En attente de {{nom}}" persistant en chaînant plusieurs actions de PNJ.', domain: 'combat', status: 'triaged', priority: 'low', cluster_label: 'Cluster J' },
  { code: 'FEAT4', title: 'Aura de portée CaC (3m + allonge arme)', description: 'Feature : aura de portée CaC (3m + allonge arme) autour du personnage actif.', domain: 'combat', category: 'suggestion', status: 'triaged', priority: 'low', cluster_label: 'Cluster K' },
  { code: 'GRID2D1', title: 'Grille 2D non affichée malgré grid_enabled=true', description: 'La grille 2D ne s\'affiche pas malgré grid_enabled=true. Cause inconnue, suspendu.', domain: 'monde', status: 'suspended', cluster_label: 'Cluster L' },
  { code: 'DARTS-TAGDUP', title: 'TXT=DEPTH=...|DEPTH=... : clés dupliquées', description: 'Clés dupliquées dans le DSL (TXT=DEPTH=...|DEPTH=...). Latent.', domain: 'combat', status: 'triaged', cluster_label: 'Cluster M' },
  { code: 'MUT4', title: 'Griffes : bonus Escalade / malus dextérité manuelle jamais câblés', description: 'Griffes : bonus Escalade +3 et malus dextérité manuelle -3 jamais câblés.', domain: 'personnage', status: 'triaged', cluster_label: 'Cluster M' },
  { code: 'RELOAD-INHAND', title: 'Rechargement sans vérification "en main"', description: 'resolveReload (weapon_inv_id fourni) ne vérifie pas char_inventory_slots.', domain: 'combat', status: 'triaged', priority: 'low', cluster_label: 'Cluster M', admin_notes: 'Impact quasi nul, Tir exige déjà l\'en-main.' },
  { code: 'ASSAULT-CATEGORY', title: 'Tir : aucune vérification de catégorie d\'arme', description: 'Contrairement au CaC, le Tir ne vérifie aucune catégorie sur l\'arme utilisée.', domain: 'combat', status: 'triaged', priority: 'low', cluster_label: 'Cluster M', admin_notes: 'Comportement historique, décision Saar à prendre.' },
  { code: 'B-VX', title: 'Modification des faces voxel non exposée dans l\'UI', description: 'La modification des faces voxel n\'est exposée nulle part dans l\'UI.', domain: 'monde', status: 'triaged', cluster_label: 'Cluster N' },
  { code: 'UI2', title: 'Dés : alignement visuel incorrect', description: 'Alignement visuel incorrect des dés.', domain: 'autre', status: 'triaged', priority: 'low', cluster_label: 'Cluster P', admin_notes: 'EN_COURS.md attribue ce bug au "Cluster Q" — divergence trouvée avec BUGIDENTIFIE.md qui le classe en Cluster P (son propre Cluster Q désigne une autre dette, retirée vers ROADMAP). Cluster P retenu ici (source BUGIDENTIFIE.md).' },
  { code: 'UI3', title: 'Dé 100 : affichage chat incorrect', description: 'Affichage incorrect du Dé 100 dans le chat.', domain: 'autre', status: 'triaged', priority: 'low', cluster_label: 'Cluster P', admin_notes: 'Même divergence de cluster que UI2 — voir sa note.' },
  { code: 'DEP1', title: 'Allure Maximale accessible même chargé/encombré', description: 'L\'Allure Maximale reste accessible même en étant chargé/encombré.', domain: 'personnage', status: 'triaged', cluster_label: 'Cluster T' },
]

const BETA_ENTRIES = [
  { code: 'BETA-1', title: 'Wizard : absence totale de tooltips d\'explication', description: 'Absence totale de tooltips d\'explication dans le wizard (priorité Step 4 Profession). Aucun système existant au moment du signalement.', domain: 'wizard', category: 'suggestion', priority: 'high', admin_notes: 'Possible recoupement avec WIZ27 (StepTutorial.jsx, clos partiel 2026-08-12, Steps 0-5/7 couverts, Step 6 sans texte, navigateur non testé) — à vérifier/dédoublonner par Saar avant triage.' },
  { code: 'BETA-7', title: 'Wizard : broadcast incohérent Step1 vs Step4', description: 'Broadcast incohérent : Step 1 diffuse en temps réel, Step 4 envoie directement au récapitulatif et y reste.', domain: 'wizard', priority: 'high' },
  { code: 'BETA-10', title: 'Wizard Step4 : grille de compétences visible avant sélection de profession', description: 'Page Profession dense : la grille de répartition de compétences apparaît avant toute sélection de profession. Correctif identifié : conditionner l\'affichage à selectedCareers.length > 0.', domain: 'wizard', priority: 'high' },
  { code: 'BETA-11', title: 'Wizard : symbole d\'avertissement trop petit', description: 'Le symbole /!\\ d\'avertissement est trop petit.', domain: 'wizard', category: 'suggestion', priority: 'low' },
  { code: 'BETA-13', title: 'Wizard : points déjà investis en compétences pro mal calculés', description: 'Points déjà investis dans les compétences professionnelles mal calculés. Analyse : le calcul est délégué à computeSkillAllocation (shared/careerSkills.js) — CareersAllocator lui-même n\'est pas en cause, cause probable dans le calcul partagé ou son contexte.', domain: 'wizard', priority: 'high' },
  { code: 'BETA-14', title: 'Wizard : prérequis de métiers invisibles', description: 'Prérequis des métiers techniquement présents en base mais invisibles/incompréhensibles à l\'écran (ex. Pilote de chasseur).', domain: 'wizard', category: 'suggestion', priority: 'high' },
  { code: 'BETA-15', title: 'Wizard : compétences inabordables non grisées, soldes négatifs', description: 'Compétences inabordables non grisées, causant des soldes négatifs. Analyse contradictoire au fil du fichier source : le grisage existe déjà dans CareersAllocator.jsx (handleAllocInc) — si le symptôme est réel, il vient probablement d\'un autre écran (Autodidacte/BackgroundSelector, ou une autre étape).', domain: 'wizard', priority: 'high' },
  { code: 'BETA-17', title: 'Wizard : tirages d\'avantages optionnels consomment des PC', description: 'Les tirages d\'avantages optionnels consomment des PC à tort (REGLE_AVANTAGES.md).', domain: 'wizard', priority: 'high' },
  { code: 'BETA-20', title: 'Wizard Step6 : wishlist d\'équipement pour le joueur', description: 'Le joueur doit pouvoir proposer une wishlist en naviguant dans ref_equipment, avec descriptif affiché (Step 6, lien avec SYSTEME/TRADE.md).', domain: 'wizard', category: 'suggestion', priority: 'high' },
  { code: 'BETA-21', title: 'Wizard : afficher le type de munition et le lien arme↔munitions', description: 'Afficher le type de munition des armes et le lien arme↔munitions dans le Wizard (REGLESMUNITIONS.md).', domain: 'wizard', category: 'suggestion', priority: 'high' },
  { code: 'BETA-32', title: 'Implants : mécanique absente', description: 'Implants : aucune mécanique n\'existe. Règle RAW à identifier, mécanique à concevoir — chantier à part.', domain: 'personnage', category: 'suggestion', priority: 'low', admin_notes: 'Décrit dans BUGIDENTIFIE.md comme "hors scope (à planifier)" — chantier à part entière, pas un correctif ponctuel.' },
  { code: 'BETA-34', title: 'Module arme disparu de la fiche (régression local/distant)', description: 'Le module arme a disparu de la fiche personnage (écart local/distant, en cours au moment du signalement). Référence équipement-admin/migration.', domain: 'infrastructure', priority: 'critical', status: 'in_progress', admin_notes: 'BUGIDENTIFIE.md le marquait "Critique (en cours par Saar)" — statut réel à confirmer, contexte equipment-admin.html a changé depuis (déplacé/renommé en server/src/admin/ref-equipment-tool.html, chantier rôle admin 2026-08-12).' },
]

async function run() {
  const admin = await db('users').where({ role: 'admin' }).first('id', 'username')
  if (!admin) throw new Error('Aucun compte admin trouvé — bootstrap requis avant import.')

  const entries = [
    ...CLUSTER_ENTRIES.map(e => ({ ...e, category: e.category || 'bug', status: e.status || 'triaged' })),
    ...BETA_ENTRIES.map(e => ({ ...e, category: e.category || 'bug', status: e.status || 'new' })),
  ]

  let inserted = 0
  let skipped = 0

  for (const entry of entries) {
    const existing = await db('bug_tickets').where({ linked_bug_code: entry.code }).first('id')
    if (existing) { skipped++; continue }

    await db('bug_tickets').insert({
      reporter_id: admin.id,
      origin: 'admin',
      category: entry.category,
      domain: entry.domain || null,
      title: entry.title,
      description: entry.description,
      status: entry.status,
      priority: entry.priority || null,
      cluster_label: entry.cluster_label || null,
      linked_bug_code: entry.code,
      admin_notes: entry.admin_notes || null,
    })
    inserted++
  }

  console.log(`[IMPORT-BUGIDENTIFIE] ${inserted} tickets créés, ${skipped} déjà présents (linked_bug_code), par ${admin.username}.`)
  await db.destroy()
}

run().catch(err => { console.error(err); process.exit(1) })
