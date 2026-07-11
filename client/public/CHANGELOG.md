## v171 — 2026-07-11 — Correctif : jets de combat au pistolet, à l'arme blanche et à l'arc

### Serveur
- [fix] La plupart des armes (armes de poing, armes de contact, arcs/arbalètes, armes de jet, armes
  lourdes, armes sous-marines...) n'avaient jamais leur compétence de tir/combat correctement liée en
  base : un assaut avec ces armes retombait systématiquement sur un total de compétence à 0,
  faisant échouer le jet quasi systématiquement. Corrigé pour l'ensemble du catalogue.

## v170 — 2026-07-11 — Le Coffre : stocker ses personnages hors campagne

### Client
- [feat] Nouveau "Coffre" personnel, accessible depuis le tableau de bord (première carte de la
  grille) : un espace indépendant de toute campagne pour y ranger ses personnages et les faire
  circuler d'une partie à l'autre sans les recréer.
- [feat] Bouton "Envoyer vers le Coffre" dans la fenêtre d'un personnage (ou d'un drone) — crée une
  copie dans votre Coffre ; le personnage original reste inchangé dans sa campagne.
- [feat] Depuis le Coffre, demande de transfert d'un personnage vers une de vos campagnes — le MJ de
  cette campagne doit approuver la demande avant que le personnage n'y apparaisse.
- [feat] Nouvel onglet "Joueurs" dans les réglages de campagne : le MJ y voit et traite les demandes
  de transfert en attente.

### Serveur
- [feat] Nouvelles routes `/api/vault/*` pour gérer le Coffre (liste, renommage, suppression,
  demandes de transfert).

## v169 — 2026-07-10 — Les mutations ont enfin un effet réel sur les attributs

### Client
- [fix] Une mutation qui modifie un attribut (ex. "Caractère félin" → +2 Coordination) l'applique
  désormais réellement sur la fiche et en jeu — jusqu'ici, l'effet était calculé mais jamais
  répercuté, quel que soit le moyen d'obtention (création de personnage ou octroi par le MJ en
  cours de partie).
- [fix] "Caractère génétique animal" propose maintenant le choix de la variante (félin/canin/
  reptilien/simiesque) quand le MJ l'octroie en jeu — ce choix manquait auparavant.
- [fix] Ajouter ou retirer une mutation en jeu met à jour la fiche immédiatement, sans qu'il soit
  nécessaire de fermer et rouvrir la fenêtre du personnage.
- [feat] Nouvelle option de campagne "Limite de poids porté" (Règles de jeu) : peut être désactivée,
  et son multiplicateur (par défaut Force ×3) est désormais réglable.

### Serveur
- [fix] Correction d'un bug de calcul où certaines valeurs remontées de la base de données étaient
  traitées comme du texte au lieu de nombres, faussant le résultat de certains attributs dans de
  rares cas.

## v168 — 2026-07-10 — Revers (option de campagne) + Avantages professionnels revus

### Client
- [feat] Nouvelle option de campagne "Revers" : au-delà de 10 ans d'expérience cumulée, le
  personnage doit tirer sur la table des Revers tous les 3 ans (règle optionnelle du livre de
  base) — nouvelle étape dédiée et visible dans le parcours de création, avec le résultat affiché
  en clair.
- [feat] Le tirage aléatoire d'Avantages professionnels (1D10) n'est plus caché dans un
  sous-onglet — il a maintenant sa propre étape dans le parcours de création, regroupée avec la
  répartition manuelle des points, par métier.
- [feat] Sur les écrans où il ne reste que des points non dépensés (Attributs, Avantages
  professionnels), le bouton "Suivant" reste actif — un message prévient que ces points seront
  perdus, un second clic permet de continuer quand même. Un vrai dépassement de budget reste
  bloqué.

### Connu
- [limitation] Les bénéfices tirés (Revers, Avantages pro aléatoires) restent narratifs — leur
  texte s'affiche mais ne modifie pas encore automatiquement les attributs/compteurs de la fiche
  (Célébrité, Alliés, Contacts…) — chantier à venir.

## v167 — 2026-07-09 — Le MJ peut octroyer une mutation en jeu

### Client
- [feat] Le MJ peut désormais ajouter une mutation à un personnage directement depuis sa fiche
  (section Avantages), même après la création — utile pour une contamination, une exposition aux
  radiations, etc. Le joueur voit la mutation apparaître sur sa fiche mais ne peut pas en ajouter
  lui-même.
- [fix] L'étape "Mutations" de cette fenêtre restait bloquée sur "chargement en cours" — corrigé.

### Connu
- [limitation] Une mutation ajoutée n'applique pas encore automatiquement ses effets chiffrés
  (bonus/malus d'attributs, résistances) — à faire dans un prochain chantier.

## v166 — 2026-07-09 — Notes libres sur la fiche personnage (Avantages)

### Client
- [feat] La fiche personnage permet à nouveau d'ajouter une note libre (titre, ennemi, implant…)
  dans la section Avantages — elle échouait systématiquement auparavant.

## v165 — 2026-07-08 — Correction du dé D4 + variation aléatoire des jets de dés

### Client
- [fix] Le dé à 4 faces (D4) affichait un résultat mal orienté pour la valeur "4", rendant le
  chiffre difficile à lire — corrigé.
- [feat] Les dés animés varient désormais légèrement d'orientation à chaque jet (même quand le
  résultat est identique à un jet précédent), pour un rendu moins figé.

## v164 — 2026-07-08 — Liste des avantages/désavantages sur la fiche personnage

### Client
- [fix] La liste des avantages et désavantages (fiche personnage, section Avantages) affichait un
  nom vide et une mauvaise étiquette pour chaque entrée — corrigé, le nom réel et l'étiquette
  "Avantage"/"Désavantage" s'affichent désormais correctement.

## v163 — 2026-07-08 — Option de campagne : Force Polaris

### Client
- [fix] Le déblocage de l'onglet "Force Polaris" (fiche personnage, section Avantages) fonctionnait
  mal depuis longtemps — il se base désormais sur le nouvel avantage "Force Polaris" au lieu d'une
  ancienne mutation qui n'était plus jamais reconnue.

### Serveur
- [feat] Trois nouveaux avantages liés à la Force Polaris ("Polaris latent", "Polaris non maîtrisé",
  "Force Polaris") disponibles à l'achat lors de la création de personnage. Les deux premiers ne
  sont proposés que si l'option de campagne correspondante est activée.

## v162 — 2026-07-08 — Correction de l'affichage 3D du dé D100 (percentile)

### Client
- [fix] L'animation 3D du jet de dé D100 (percentile) affiche désormais la bonne face sur les deux
  dés (dizaines + unités) — le résultat affiché correspond enfin au résultat annoncé dans le chat.
  Un jet de D10 seul est également corrigé (même modèle 3D partagé).
- [chore] Suppression du code de géométrie procédurale du D10, devenu obsolète depuis le passage aux
  modèles 3D texturés.

## v161 — 2026-07-08 — Option de campagne : personnages très jeunes

### Client
- [feat] Étape 4 (Profession) de l'assistant de création : les malus de Force/Présence liés à un personnage âgé de 16 à 19 ans respectent désormais l'option de campagne correspondante (réglage par défaut : désactivée, aucun malus) — un attribut déjà à son niveau minimum (7) n'est jamais pénalisé davantage

### Serveur
- [fix] La validation finale de l'assistant de création applique le même malus d'âge que l'aperçu, uniquement si l'option est activée

## v160 — 2026-07-08 — Assistant de création : formation "Autodidacte" fonctionnelle

### Client
- [feat] Étape 4 (Expérience) de l'assistant de création : la formation "Autodidacte" permet
  désormais de répartir réellement 7 points libres sur les compétences (2 points maximum par
  compétence), au lieu d'un simple texte informatif sans effet
- [fix] Sélection d'une origine géographique, sociale ou d'une formation : un second clic sur un
  choix déjà sélectionné ne réinitialise plus les données déjà saisies plus loin dans l'étape

### Serveur
- [feat] La validation finale de l'assistant de création applique et vérifie la répartition de la
  formation "Autodidacte" (bornes respectées, compétences autorisées)

## v159 — 2026-07-08 — Option de campagne : niveau maximum des compétences

### Client
- [fix] Étape 4 (Profession) de l'assistant de création : le plafond de maîtrise d'une compétence professionnelle selon les années d'expérience n'est plus appliqué systématiquement — il ne s'applique désormais que si l'option de campagne correspondante est activée (réglage par défaut : désactivée, seul le budget de points limite)

### Serveur
- [fix] La validation finale de l'assistant de création applique la même règle : le plafond par années n'est revalidé que si l'option est activée

## v158 — 2026-07-08 — Option de campagne : prérequis de compétences

### Client
- [feat] La fiche personnage respecte désormais l'option de campagne « prérequis de compétences » — si elle est activée, une compétence nécessitant un niveau minimum dans une autre (ex. Chirurgie nécessite Médecine) reste masquée tant que ce prérequis n'est pas atteint ; si désactivée (réglage par défaut), toutes les compétences restent accessibles librement

### Serveur
- [fix] L'achat d'une compétence par dépense d'XP vérifie désormais réellement les prérequis (quand l'option est activée), et plus seulement leur affichage à l'écran

## v157 — 2026-07-08 — Option de campagne : Tirage 1D10 des avantages professionnels

### Client
- [feat] Le tirage 1D10 des avantages professionnels (étape Professions) respecte désormais l'option de campagne correspondante — si elle est désactivée, seule la répartition manuelle des points est proposée

## v156 — 2026-07-08 — Tirage 1D10 des avantages professionnels (fin du redesign Étape 4) + jets de dés réels

### Client
- [feat] Chaque métier retenu à l'étape 4 (Profession) permet désormais, tous les 5 ans de carrière, de lancer un vrai 1D10 animé pour tirer un avantage professionnel aléatoire à la place de la répartition manuelle habituelle — un résultat de 10 peut être converti en points supplémentaires à répartir
- [fix] Le bouton « Lancer 1D10 » affichait par erreur l'animation d'un D6 au lieu d'un D10 — corrigé
- [feat] Le tirage aléatoire de mutations à l'étape 3 (bouton « Lancer 1D20 ») utilise maintenant un vrai jet de dé animé au lieu d'un tirage silencieux

## v155 — 2026-07-08 — Description physique à la création du personnage

### Client
- [feat] L'étape 1 (Attributs) du Wizard de création propose désormais de renseigner la description physique du personnage (taille, poids, peau, corpulence, yeux, cheveux, signes particuliers) ainsi que sa main directrice, avec un bouton « Définir » qui tire au sort Droitier/Gaucher/Ambidextre selon la règle du Livre de Base — ces informations apparaissent ensuite pré-remplies dans la fiche personnage

## v154 — 2026-07-08 — Compétences « au choix » des métiers

### Serveur
- [fix] Correction de données : plusieurs métiers avaient des lignes de compétences « au choix » en double ou mal renseignées (Diplomate, Espion, Soldat d'élite) — nettoyé, conforme au Livre de Base
- [feat] Le serveur vérifie désormais qu'un seul choix est fait par groupe de compétences « au choix » avant d'enregistrer un personnage

### Client
- [feat] Les compétences « au choix » de chaque métier (ex. Arts martiaux, Sciences spécialisées) sont désormais sélectionnables directement dans l'onglet Métier, au lieu d'être listées sans possibilité de choix
- [fix] Suppression de l'icône décorative devant chaque métier dans la liste de gauche, colonne légèrement resserrée

## v153 — 2026-07-08 — Onglet Avantages professionnels

### Serveur
- [fix] 4 professions (Artisan/Artiste, Assassin, Barman, Contrebandier) n'avaient aucune catégorie d'avantage professionnel enregistrée — corrigé, conforme au Livre de Base
- [fix] Le serveur vérifie désormais que la répartition des points d'avantages professionnels respecte le budget disponible (5 points par année passée dans le métier) avant d'enregistrer un personnage

### Client
- [feat] L'onglet « Avantages professionnels » de l'étape Professions permet désormais de répartir réellement les points gagnés par métier (Célébrité, Relations, Matériel, etc.), au lieu du message « à venir »

## v152 — 2026-07-08 — Onglet Carrière & économies + filtre Accessibles par défaut

### Client
- [feat] L'onglet « Carrière & économies » de l'étape Professions affiche désormais la progression réelle du métier consulté (années, titres, salaires) et les économies de départ accumulées, au lieu du message « à venir »
- [fix] La liste des métiers s'ouvre désormais directement sur le filtre « Accessibles » (au lieu de « Tous ») pour éviter de sélectionner par erreur un métier non accessible au personnage

## v151 — 2026-07-07 — Nouvelle interface Professions (étape 4 de la création)

### Client
- [feat] L'écran de sélection des métiers (étape « Professions ») est entièrement repensé : liste des métiers accessibles (avec filtre), fiche détaillée par métier (compétences, salaire, rang), et un tableau unique de répartition des points de compétence commun à tous les métiers retenus
- [feat] Le filtre « Accessibles » masque désormais réellement les métiers dont les conditions (prérequis, génotype, attributs, études) ne sont pas remplies, avec la raison affichée
- Les onglets « Carrière & économies » et « Avantages professionnels » sont visibles mais pas encore actifs (arrivent dans une prochaine mise à jour)

### Serveur
- [fix] Le serveur vérifie désormais que la répartition des points de compétence respecte le budget disponible et les plafonds de maîtrise avant d'enregistrer un personnage

## v150 — 2026-07-07 — Fiche personnage consultable pendant la création du personnage

### Serveur
- [feat] Le brouillon du personnage en cours de création peut désormais être appliqué et relu à tout moment pendant l'assistant, pas seulement à la toute fin — nécessaire pour la nouvelle fenêtre de consultation côté client
- [feat] Migration 119 — nouvelle date de verrouillage sur la fiche personnage, posée uniquement quand le joueur clique sur « Terminer »

### Client
- [feat] Un bouton « Voir ma fiche » est désormais disponible dès la fin de la première étape de l'assistant de création, et à chaque étape ensuite — il ouvre la vraie fiche personnage (attributs, compétences, avantages) en lecture seule, mise à jour au fur et à mesure de la progression
- [fix] La zone « Notes MJ » de la fiche personnage n'était jamais protégée en lecture seule — corrigé (sans effet en session de jeu normale, uniquement pertinent pour la nouvelle fenêtre de consultation)

## v149 — 2026-07-06 — Correction coût mutations « Organe sensoriel manquant » + lisibilité cartes Step3

### Serveur
- [fix] Migration 118 — le nombre de Points de Création gagnés pour les mutations « Nez atrophié », « Sens du toucher atrophié », « Oreille manquante » et « Œil manquant » (Organe sensoriel manquant) était incorrect ; il correspond désormais au Livre de Base

### Client
- [fix] Étape 3 du wizard : les titres longs de mutation (ex. « Organe sensoriel supplémentaire ou amélioré ») n'étaient plus lisibles, tronqués par « … » — le titre peut désormais passer à la ligne, la variante (Odorat, Vue, etc.) s'affiche sur sa propre ligne sous le titre

## v148 — 2026-07-06 — Option de campagne « Bonus féminin » + Sexe/Fécondité

### Serveur
- [feat] Option de campagne `feminin_bonus` désormais active : le bonus mécanique (Force de base 5, +2 à répartir en Coordination/Présence) ne s'applique que si le MJ a activé l'option — le choix du Sexe reste toujours disponible pour tous les joueurs
- [feat] Le Sexe choisi à l'étape 1 est enregistré sur la fiche personnage ; une mutation acquise à l'étape 3 (Asexué, Androgyne, Autofécondation) peut désormais l'altérer automatiquement, ainsi que la Fécondité du personnage
- [feat] Le désavantage « Fécondité » (étape 5, ou ajouté plus tard depuis la fiche personnage) rend désormais le personnage fécond mécaniquement ; achat bloqué si le personnage a déjà une mutation le rendant stérile

### Client
- [feat] Étape 1 du wizard : une explication de l'option « Bonus féminin » apparaît dans les règles de répartition lorsque l'option est active

## v147 — 2026-07-05 — Wizard Step3 : mutations réelles (fin PLAN_STEP4)

### Serveur
- [feat] Migration 117 — `ref_mutation_subtypes` gagne une colonne `description` (sous-table Caractère génétique animal)
- [feat] Nouvelle route `GET /api/creation/:sheetId/step3/ref` — expose les 45 mutations réelles (+ sous-types + compétences associées) au wizard

### Client
- [feat] Étape 3 du wizard de création (Capacités spéciales) branchée sur les vraies mutations du Livre de Base au lieu des données factices (6 mutations mockées) — achat, variantes (Difformités, Organe sensoriel, Résistance naturelle), sous-choix Caractère génétique animal, et tirage aléatoire D20/D100 fonctionnent désormais sur les 45 mutations réelles
- [feat] Halo de confirmation visuel bref sur une carte de mutation cliquée — retour immédiat sans avoir à faire défiler jusqu'à la liste de sélection

## v146 — 2026-07-05 — Stacking des mutations + correction encodage ref_mutations

### Serveur
- [fix] Migration 108 — correction de la corruption d'encodage sur `ref_mutations`/`ref_mutation_subtypes`/`ref_mutation_skills` (texte inséré mal encodé depuis le seed d'origine, ex. noms et descriptions de mutations illisibles)
- [feat] Migration 109 — les mutations empilables (Peau renforcée, Purulence, Squelette renforcé, Résistance naturelle) peuvent désormais être achetées ou tirées plusieurs fois sans faire échouer la création de personnage ; leurs effets cumulés suivent la vraie formule du Livre de Base (incrément différent de la valeur de base pour ces 4 mutations)
- [fix] `finalizeCreation` — achat multiple d'une même mutation empilable dans le même lot n'insère plus de doublon en base

## v145 — 2026-07-05 — Lots 2-6 carrières (37/37) + FK ref_career_skills

### Serveur
- [feat] Migrations 108, 112-116 — seed complet des lots 2 à 6 (32 carrières), portant le total à 37/37 carrières Polaris en base, illustration incluse directement dans chaque migration
- [fix] Migration 111 — `ref_career_skills.skill_id` gagne une vraie contrainte FK vers `ref_skills.id` (toute faute de frappe future sera rejetée par la base au lieu de s'insérer silencieusement) ; suppression de `skill_group` (texte libre jamais aligné avec la vraie catégorie `ref_skills.family`, source d'une fragmentation de l'affichage)
- [fix] 2 carrières avaient un `required_genotype` invalide (`hybride_trident`, `techno_hybride`) — corrigés vers les vrais identifiants de `ref_genotypes`

### Client
- [fix] Regroupement des compétences par carrière dans le wizard Step4 — utilise désormais la vraie catégorie de compétence (`ref_skills.family`), qui ne se dédouble plus selon la carrière sélectionnée

## v144 — 2026-07-05 — Migration 106 : correction lot 1 carrières (ref_career_skills)

### Serveur
- [fix] Migration 106 — 9 corrections de `ref_career_skills` sur les 5 carrières du lot 1 (artisan_artiste, assassin, barman, chasseur_primes, contrebandier) vs le Livre de Base : `skill_id` orphelins remplacés (ex. `TIR_PRECISION` → `TIR_DE_PRECISION`), `ARTS_MARTIAUX` de l'assassin éclaté en 3 compétences définitives, ajout de `PILOTAGE__NAVIRES_LEGERS` (chasseur de primes, contrebandier)

## v143 — 2026-07-05 — Migration 37-bis : consolidation ref_skills (catalogue Compétences)

### Serveur
- [fix] Migration 105 — 3ᵉ révision consolidée de `ref_skills` (après 37/74/103/103b) : 113 markers corrigés (legacy `'S'` → vraie valeur LdB), 11 labels, 4 attributs, suppression de `MUTATION` (catégorie fantôme) et `ARMES_SATELLITES` (hors LdB), re-parentage des 8 mutations vers `CONTROLE_DES_MUTATIONS`, déplacement d'un prérequis mal attribué
- [feat] Nouvelle colonne `ref_skills.is_category` — remplace le sentinel `attr_1='CHC'` utilisé pour détecter les catégories de compétences dans l'UI

### Client
- [fix] Regroupement des catégories de compétences dans la fiche personnage — 8 catégories jusqu'ici affichées à plat (Arts martiaux, Connaissance milieu naturel, Langages spécifiques, Langue ancienne, Langue étrangère, Manœuvre d'armure, Mécanique, Tactique) se replient désormais correctement sous leur en-tête
- [fix] En-tête de colonnes des compétences — le libellé générique "Compétence" répété à chaque famille est remplacé par le nom de la famille elle-même (ex. "Aptitudes physiques"), qui reste cliquable pour replier/déplier

## v142 — 2026-07-05 — Options de campagne : settings JSONB + page paramètres

### Serveur
- [feat] `campaignSettingsService.js` — `SETTINGS_SCHEMA` + `getCampaignSettings()`, source unique de vérité pour les options de campagne
- [feat] Migration 104 — `campaigns.settings JSONB` remplace 6 colonnes plates (ambiance, pnj_unlimited_ammo, reload_mode, action_timer_sec, shock_auto_stun, allow_los_cancel) + 11 nouvelles options de campagne
- [feat] `PUT /campaigns/:id` — validation par clé + sauvegarde JSONB atomique (sans écraser les autres clés)

### Client
- [feat] Page Paramètres de campagne — nouvel onglet "Fiche personnage" : ambiance, bonus féminin, mutations aléatoires, Polaris latent, avantages pro aléatoires, personnages expérimentés, prérequis compétences, niveau max compétences, progression naturelle, personnages jeunes, célébrité
- [fix] Sauvegarde d'un onglet n'écrase plus les modifications non enregistrées d'un autre onglet
- [fix] Changer d'onglet puis revenir n'efface plus visuellement une modification non enregistrée

## v141 — 2026-07-02 — Wizard UX : navigation libre stepper + sous-étapes step4

### Client
- [feat] `WizardHeader.jsx` — état `reachable` (amber/or) : dots déjà visités mais après le curseur, cliquables — navigation directe dans les deux sens
- [feat] `Step4Experience.jsx` — barre sous-étapes cliquable : saut direct vers toute sous-étape déjà visitée, sans spammer Précédent
- [fix] `WizardCreation.jsx` — prop `highestStep` manquante transmise à WizardHeader

## v140 — 2026-07-02 — Wizard COUCHE 5 : architecture client-primary (navigation libre)

### Client
- [feat] `WizardCreation.jsx` — architecture client-primary : toutes les données Zustand jusqu'au Finaliser — plus d'appels serveur pendant la navigation
- [feat] `WizardReview.jsx` — nouveau composant récapitulatif pur store (step 6) — remplace CharacterSheet pré-finalize
- [feat] `creationStore.js` — `highestStep` (dots cliquables sans effacer les données), `pcNet` (PC désavantages disponibles dès step 1 en retour), merge semantics `setStep1Data`
- [feat] Step1/2/3/4/5 — hydratation `initialData` : retour en arrière pré-remplit les champs
- [fix] Backward navigation : plus de cascade null — données conservées sur tout retour arrière

### Serveur
- [refactor] `creationService.js` — `finalizeCreation` transaction unique (step1→5) — suppression validateAndPersistStep1/2/3/4 + rollbackStep4 + snapshot
- [refactor] `routes/creation.js` — POST /step1/2/3, POST/DELETE /step4, POST /step5 supprimées — `POST /finalize` accepte payload complet
- [fix] Migration 102 — DROP `char_creation_snapshot` (FSM snapshot obsolète)

## v139 — 2026-07-01 — Wizard COUCHE 4b : stepper 6 étapes + aperçu fiche + bugfixes

### Client
- [feat] `WizardHeader.jsx` — stepper 6 étapes cliquables (dots + lignes + labels), remplace "ETAPE X/5"
- [feat] `WizardCreation.jsx` — étape 6 : aperçu CharacterSheet + bouton Finaliser + navigation arrière
- [feat] `WizardCreation.jsx` — `navigateToStep()` : navigation inter-étapes avec cascade store + rollback step4
- [fix] `Step3Mutations.jsx` — "Aucune mutation" déplacée de l'écran titre vers le menu d'achat
- [fix] `Step4Summary.jsx` — suppression de la ligne "PC dépensés x/20"
- [fix] `creation.json` — `step2.conditionsTitle` manquant (label Technohybride "Conditions requises")
- [fix] `creation.json` — copies UI : "Evolution des attributs", "Compétence spéciale : HYBRIDE"
- [chg] `index.css` — classes `.wiz-stepper*` (dot, line, label — états done/active/future)

### Serveur
- [fix] Migration 101 — 8 noms `ref_backgrounds` corrompus (mojibake Latin-1/UTF-8) → encodage UTF-8 correct

## v138 — 2026-07-01 — Wizard COUCHE 4a : connexion frontend → backend (steps 0-3)

### Serveur
- [feat] `creationService.js` — `startCreation` (transaction : character + char_sheet + ledger + archetype + attributes×8), `validateAndPersistStep1/2/3`, `finalizeCreation`
- [feat] `routes/creation.js` — 5 nouvelles routes : `POST /start`, `POST /:sheetId/step1/step2/step3`, `POST /:sheetId/finalize`

### Client
- [feat] `DashboardPage.jsx` — bouton "Créer un personnage" sur chaque card campagne → `/campaigns/:id/creation`
- [feat] `creationStore.js` — `startCreation()` async (axios), `sheetId`/`campaignId`/`isStarting`/`startError`
- [feat] `WizardCreation.jsx` — `useParams` campaignId + `callStep` helper + handlers async steps 1-3
- [feat] `App.jsx` — route `/campaigns/:campaignId/creation` (campaignId obligatoire)
- [fix] `creationStore.js` / `WizardCreation.jsx` — `fetch` relatif → `api` axios (évite le 404 sur port Vite)

## v137 — 2026-07-01 — Wizard : backend création personnage (steps 4 & 5)

### Serveur
- [feat] `routes/creation.js` — 6 routes wizard montées sous `/api/creation` (step4 GET/POST/DELETE + step5 GET ref + POST batch)
- [feat] `services/creationService.js` — validation + persistance step4 (backgrounds additifs + carrières SET + effets âge + snapshot rollback)
- [feat] `services/advantageService.js` + `advantageConstraints.js` — avantages V2 (soft-delete, contraintes R1-R6, trx-or-db)
- [fix] `char-sheet.js` — routes advantages V1 remplacées par V2 (`advantageService`)
- [fix] `creationService.rollbackStep4` — purge des skills orphelins après rollback step4

## v136 — 2026-06-25 — Rechargement drone + cargo visible

### Client
- [feat] `ExchangeWindow` — transfert vers drone : filtre destinataires (drone visible uniquement par son propriétaire), flow sans sols ni timer, bouton "Transférer au drone"
- [feat] `DroneSheet` FICHE — champ "Charge utile (kg)" éditable GM
- [feat] `DroneSheet` FICHE — section "Chargement" : liste items cargo + poids total vs capacité
- [feat] `DroneSheet` FICHE — bouton "Larguer" par item → retour dans sac du propriétaire
- [feat] `DroneWindow` Armes — ammo restant/contenance + calibre affiché par arme
- [fix] `ExchangeWindow` — bouton reset "Nouvelle vente" renommé "Nouvel échange"

### Serveur
- [feat] `socketTrade.js` — handler `TRADE_DRONE_TRANSFER` : transfert immédiat PJ→drone (guard propriétaire + transaction atomique)
- [feat] `char-sheet.js` — `GET /drone/cargo` : inventaire du drone (items + poids total)
- [feat] `char-sheet.js` — `POST /drone/cargo/:invId/drop` : largage item → sac PJ propriétaire
- [fix] Migration 91 — contrainte `trade_log.type` corrigée (`player_sell` manquant depuis migration 85)

## v135 — 2026-06-25 — ExchangeWindow : fenêtre d'échange PJ↔PNJ/PJ + notification GM

### Client
- [feat] `ExchangeWindow.jsx` — fenêtre d'échange standalone (RadialMenu "Échange") : composer offre, timer, Accept/Decline, autocomplete destinataire (≥3 lettres, max 3 résultats)
- [feat] `Sidebar.jsx` — notification chat GM lors d'une offre d'échange reçue → "Voir l'offre" ouvre ExchangeWindow
- [fix] Guard auto-échange : impossible d'envoyer une offre à soi-même

### Serveur
- [fix] `socketTrade.js` `findSocketByCharId` — PNJ `user_id=null` → fallback socket GM (offre désormais livrée)
- [fix] `socketTrade.js` `TRADE_TRANSFER_ACCEPTED` — GM peut accepter une offre au nom d'un PNJ

## v134 — 2026-06-25 — VENTE PJ→GM : notification GM + contre-offre + achat ×10 munitions

### Client
- [feat] `TradeWindow.jsx` — VENTE PJ→GM : sélecteur marchand + inventaire avec prix ref/boutique, proposition, en-attente, contre-offre reçue (Accepter/Refuser)
- [feat] `TradeWindow.jsx` — REVENTES GM : récap offres avec prix boutique par item, 3 boutons (Accepter/Contre-offre/Refuser), saisie prix contre-offre
- [feat] `Sidebar.jsx` — notification chat GM à réception d'une offre de vente PJ (bouton "Voir l'offre" → TradeWindow Reventes)
- [feat] `TradeWindow.jsx` — achat ×10 munitions : bouton `+10` sur tous les items `family === 'Munitions'`
- [fix] `TradeWindow.jsx` — onglet ÉCHANGE retiré (implémentation future via RadialMenu)

### Serveur
- [feat] Migration 90 : `trade_offers.counter_sols` + `merchant_id` + status `COUNTER_OFFERED`
- [feat] `socketTrade.js` — 4 handlers : SELL_PROPOSED (enrichissement prix serveur-side) + SELL_COUNTER (GM, ACK) + SELL_COUNTER_ACCEPTED (lit counter_sols DB) + SELL_COUNTER_DECLINED
- [feat] `tradeRoutes.js` — GET `/my-sell-offer` (restauration état PJ après rechargement)
- [feat] `useEntitySocket.js` — listener TRADE_SELL_REQUEST → notification chat GM persistante
- [fix] `socketTrade.js` — `SELECT tour_duration FROM campaigns` (colonne inexistante) → `SELL_OFFER_TTL_SEC = 120`

---

## v133 — 2026-06-25 — Trade complet : échange PJ↔PJ + déclencheurs + bugfixes

### Client
- [feat] `TradeWindow.jsx` — vue Échange PJ↔PJ : proposer items/sols, timer expiration, accept/refuse/annuler, switch tab auto sur offre reçue
- [feat] `TokenRadialMenu.jsx` — slot 5 : "Échange" (joueur uniquement, pré-remplit cible)
- [fix] `Sidebar.jsx` — "Marchands" dans dropdown "Outils" (pas de bouton standalone)
- [fix] `TradeWindow.jsx` — écran noir sur INSUFFICIENT_FUNDS corrigé (parsing `err.response.data.error.message`)

### Serveur
- [fix] `tradeService.js` — `getMerchants` PJ : join tokens supprimé → recherche directe par `campaign_id + user_id`
- [fix] `socketTrade.js` — 3 handlers : join `tokens.campaign_id` inexistant → `WHERE campaign_id + id + user_id`
- [fix] `socketTrade.js` — TRANSFER_OFFER : ACK callback `{ ok, offerId, expiresAt }` pour timer et annulation côté PJ A

---

## v132 — 2026-06-25 — CL3 : ghosts déplacement + lignes attaque persistants en ANNOUNCEMENT

### Client
- [fix] `Canvas3D.jsx` — ghosts déplacement et lignes d'attaque déclarées restent tous visibles simultanément pendant la phase ANNOUNCEMENT (lecture `announcedActions[]` store au lieu du singleton `announcementMarker`)

---

## v131 — 2026-06-25 — Trade : TradeWindow vue Joueur (catalogue + panier + checkout)

### Client
- [feat] `TradeWindow.jsx` — vue Joueur : sélecteur marchand (OPEN + autorisé), catalogue navigable par famille, détail item inline (poids / NT / gén / rareté), panier + bouton Acheter (débit sols + ajout inventaire)
- [refactor] `SessionPage.jsx` — `myCharId` derivé + props `isGm` / `myCharId` transmis à TradeWindow + condition `{tradeWindowOpen &&` (préparation déclencher radial étape 11)
- [i18n] `fr.json` — +13 clés `trade.window.*` (vue joueur)

---

## v130 — 2026-06-25 — Trade : TradeWindow vue GM lite

### Client
- [feat] `TradeWindow.jsx` — fenêtre flottante draggable in-session : onglet Marchands (toggle OUVERT/FERMÉ + modificateur prix à chaud) + onglet Journal (livre de compte filtrable par type, pagination)
- [feat] `SessionPage.jsx` — bouton "Commerce" dans la barre GM (toggle)
- [i18n] `fr.json` — +13 clés `trade.window.*`

---

## v129 — 2026-06-25 — Drone : notification upload GLB + rechargement token 3D

### Client
- [fix] `DroneWindow` onglet Paramètres : indicateur visuel upload GLB — "En cours..." / vert "Modèle mis à jour ✓" / rouge "Échec de l'envoi" — reset auto 3s
- [fix] Token drone 3D se recharge automatiquement après upload GLB réussi

---

## v128 — 2026-06-25 — Système Trade : marchands + échanges PJ↔PJ

### Serveur
- [feat] Migrations 84–87 : `merchants`, `trade_log`, `trade_offers`, `ref_equipment.generation`
- [feat] REST CRUD marchands (`/api/campaigns/:id/merchants`) — OPEN/CLOSED, règles catalogue JSONB, joueurs autorisés TEXT[]
- [feat] `GET /:mid/catalog` : filtrage complet FAM→CAT→ITEM (INCLUDE/EXCLUDE/PARAM), seuils NT/niv/gen/rareté, prix avec mod_global
- [feat] `POST /:mid/buy` : achat atomique (forUpdate) — débit sols + INSERT inventaire + trade_log
- [feat] `socketTrade.js` : handlers WS PJ↔PJ — rate limit 3 offres/min — transaction forUpdate acceptTransfer
- [feat] `GET /api/campaigns/:id/trade-log` : livre de compte paginé (GM only)

### Client
- [feat] `MerchantsPage.jsx` : Dashboard GM `/campaigns/:id/merchants` — CRUD marchands + arbre catalogue tri-state (HÉRITE/INCL/EXCL avec héritage visuel) + joueurs autorisés
- [feat] `DashboardPage.jsx` : bouton "Marchands" sur carte campagne GM
- [add] `shared/events.js` : +12 constantes `TRADE_*`

---

## v127 — 2026-06-24 — WeaponPanel v2 : armes par main + description

### Client — Fiche personnage
- [feat] `WeaponPanel.jsx` : refonte complète — colonnes MAIN DIRECTRICE / MAIN SECONDAIRE selon `hand_pref` (R/L/A), section DEUX MAINS / TRÉPIED séparée, logique 2H masque les colonnes 1H
- [feat] Dropdown équipement intégré directement dans chaque colonne (CS2 — plus de menu global unique)
- [fix] Arme à deux mains ne peut plus être équipée dans les deux mains séparément (CS3 — conflict resolution auto)
- [feat] Badge −5 sur MAIN SECONDAIRE quand une arme y est équipée
- [feat] Avertissement trépied absent / info trépied disponible dans le sac
- [feat] Icône ⓘ sur chaque arme → tooltip CSS avec description (CS1)
- [add] Classe CSS `.has-tooltip` générique (`data-tooltip` attribute)

### Serveur
- [fix] GET `/char-sheet/:id/inventory` : `hand_pref` et `ref_description` ajoutés à la réponse

---

## v126 — 2026-06-24 — INI Breakdown Popover + COM19 FAUX BUG

### Client — Combat
- [feat] Clic sur le total INI dans `CombatGmDeclareWindow` et `CombatActionWindow` → popover flottant avec détail ligne par ligne des coûts (posture, arme, déplacement, CaC, couverture, actions rapides)
- [refactor] `combatSections.js` : `calcIniBreakdown` source de vérité — `calcIniDelta` refactorisée (appelle + somme breakdown)

### Bugs
- [faux-bug] COM19 — "-5 INI assaut tir" : règle inexistante dans LdB — code conforme

---

## v125 — 2026-06-24 — COM22 : correction actions combat Kiwi + sécurité serveur

### Serveur — Combat
- [fix] `socketCombatResolution.js` : suppression PRECHECK LOS assault (redondant — LOS vérifiée à la résolution) → `CombatModifiersWindow` s'ouvre toujours, `confirmedModifiers` collectés correctement

### Infrastructure
- [fix] `npm install` racine Kiwi : `fast-voxel-raycast` maintenant résolu depuis `shared/losUtils.js`
- [fix] `npm audit fix` server : 7 vulnérabilités corrigées (ws, multer, qs, fast-xml-builder…) — 0 restantes

---

## v124 — 2026-06-24 — AA-1 : blessures combat affichées sans rouvrir la fenêtre

### Client — Fiches personnages
- [fix] `ArmorWoundPanel` : blessures infligées en combat visibles immédiatement à l'ouverture de l'onglet Matériel, même si la fenêtre était fermée pendant le combat
- [fix] Flash 250ms "blessure apparaît puis disparaît" supprimé (pattern React 18 StrictMode)
- [refactor] `characterStore` : `woundsByCharId` + `setWounds` — état blessures global Zustand
- [refactor] `useCharacterSocket` : `WOUND_*` → fetch REST → store (plus de propagation via `woundVersions`)
- [refactor] `CharacterWindow` + `SessionPage` : `woundReloadKey` → `inventoryReloadKey` (sémantique)

---

## v123 — 2026-06-24 — STUN2 : correction overlay LOS + AWAITING_DAMAGE PRECHECK

### Serveur — Combat
- [fix] `socketCombatResolution.js` PRECHECK : `AWAITING_DAMAGE` → `{ awaiting: true }` sans message d'erreur (overlay "Ligne de vue bouchée" affiché à tort pendant l'attente)
- [fix] STUN2 guards PRECHECK + CONFIRM : double-check `token_statuses` + `combat_pending type='stun'` — auto-skip slot si étourdi

### Client — Combat
- [fix] `CombatOverlay.jsx` : `precheckRetryKey` + listener `COMBAT_ATTACK_RESULT` → re-fire PRECHECK après confirmation dégâts
- [fix] Callbacks assault + melee PRECHECK : gestion flag `awaiting` → `precheckOk = null` (aucun overlay pendant AWAITING_DAMAGE)
- [fix] `useCombatSocket.js` `onDeclareError` : message i18n `session.stun_blocked` si `stunned: true`

---

## v122 — 2026-06-24 — REWORK-18 : Effect Queue (socketCombatHelpers — séparation computation/émission)

### Serveur — Refactoring
- [refactor] `socketCombatHelpers.js` — `socket` supprimé des 3 signatures resolve (`resolveMeleeAction`, `resolveDroneAssaultAction`, `resolveAssaultAction`)
- [refactor] 30 émissions directes (`io.to().emit()` / `socket.emit()`) → descripteurs `{ to, event, data }` accumulés dans `const emissions = []`
- [refactor] `socketCombatResolution.js` — `flushEmissions(io, socket, campaignId, emissions, preloadedSockets?)` créé — dispatch après retour de la fonction
- [fix] A6 : récursion LOS intercepté `resolveAssaultAction` — arg `socket` parasite supprimé (non détectable `node --check`)

---

## v121 — 2026-06-23 — Ergonomie combat UI : nom actif + poignées basses + Timeline

### Client — UI
- [fix] `CombatGmDeclareWindow.jsx` — header : nom du personnage actif (or = PNJ/Drone, grisé = attente PJ)
- [ux] `CombatGmDeclareWindow`, `CombatModifiersWindow`, `CombatCacModifiersWindow` — poignée de déplacement en bas de chaque fenêtre (curseur ↕)
- [ux] `CombatTimeline` — fond 20% opaque, phase + flèche déplacées à gauche sous Tour N, bouton collapse ▲/▼, portraits centrés

---

## v120 — 2026-06-23 — REWORK-17 : socketCombat.js modularisation (State/Announcement/Resolution/Helpers)

### Serveur — Refactoring
- [refactor] `server/src/socket/socketCombatHelpers.js` créé — 13 fonctions resolve/helper + COMBAT_MODE_LABELS
- [refactor] `server/src/socket/socketCombatState.js` créé — 5 handlers ROSTER+ANNOUNCEMENT
- [refactor] `server/src/socket/socketCombatAnnouncement.js` créé — 3 handlers DECLARATION
- [refactor] `server/src/socket/socketCombatResolution.js` créé — 6 handlers RESOLUTION+PRECHECK
- [refactor] `server/src/socket/socketCombat.js` réduit à 9L (orchestrateur pur)

---

## v119 — 2026-06-23 — Fix combat : fire_mode stale closure + actions store Tour 2

### Client — Bugfix
- [fix] `CombatGmDeclareWindow.jsx` — PNJ RL-only : fire_mode ne se réinitialisait pas correctement au changement de slot (stale closure `decl.fire_mode` → `initialStates.fire_mode`)
- [fix] `useCombatSocket.js` — "Action non autorisée" au Tour 2 : store `actions` non vidé lors du passage en ANNOUNCEMENT (ajout `setActions([])` dans `onPhaseChanged`)

---

## v118 — 2026-06-22 — REWORK-12 : useCharacterSocket — blessures + inventaire extraits

### Client — Refactoring
- [refactor] `client/src/lib/useCharacterSocket.js` créé — 6 handlers WS (`WOUND_ADDED/UPDATED/REMOVED`, `INVENTORY_ADDED/UPDATED/REMOVED`) extraits de `SessionContent`
- [refactor] `SessionPage.jsx` — `woundVersions` useState + `updateCharacter` destructuring + `useEffect([socket])` WOUND/INVENTORY supprimés

---

## v117 — 2026-06-22 — REWORK-11 : useSessionSocket — handlers session extraits

### Client — Refactoring
- [refactor] `client/src/lib/useSessionSocket.js` créé — 12 handlers WS (SESSION_*, CHAT_MESSAGE, DICE_RESULT, MACRO_ROLL_RESULT, CHARACTER_UPDATED, DOC_*) extraits de `SessionContent`
- [refactor] `SessionPage.jsx` — destructurings `useSessionStore`/`useCharacterStore`/`useLibraryStore` nettoyés, `useEffect([socket])` réduit aux 6 handlers WOUND_*/INVENTORY_*

---

## v116 — 2026-06-21 — REWORK-15 : SocketProvider — lifecycle socket centralisé

### Client — Refactoring
- [refactor] `client/src/lib/SocketContext.jsx` créé — `SocketProvider` Context + `useSocket()` hook
- [refactor] `useTokenSocket`, `useEntitySocket`, `useCombatSocket` — `listen(s)` supprimé → `useSocket()` direct
- [refactor] `SessionPage.jsx` — split `SessionPage` (wrapper) + `SessionContent` — grand useEffect → 2 useEffects nommés

---

## v115 — 2026-06-21 — REWORK-06 : declarationReducer + fixes combat

### Client — Refactoring
- [refactor] `client/src/lib/declarationReducer.js` créé — reducer pur partagé (`SET_FIELD`, `SET_COMBAT_MODE`, `SET_QUICK`, `SELECT_ATTACK`, `RESET`, `RESET_NEW_TURN`)
- [refactor] `CombatGmDeclareWindow.jsx` + `CombatActionWindow.jsx` — 3 useState chacun → 1 `useReducer(declarationReducer, DECLARATION_INITIAL)`
- [fix] Assaut (tir) grisé non cliquable quand arme holstered → onClick + cursor pointer
- [fix] GM : curseur interdit sur bouton Assaut arme non au clair → opacity seule, curseur pointer
- [fix] Mains nues CaC par défaut (suppression auto-sélection première arme de contact)

### Serveur — Correctif
- [fix] PC23 Tir Automatique (RC/RL) — typo `TIR_AUTOMATIQUE` → `TIR_AUTOMATIQUES` dans `socketCombat.js`

---

## v114 — 2026-06-20 — FEAT2-C : Caméra LOS v2 épaule droite

### Client — Nouvelle fonctionnalité
- [feat] `client/src/lib/useCameraLOS.js` — service LOS complet (feature-as-service) : `{ losLine, onTokenClick, onPointerUp, clearLine }`
- [feat] Caméra "épaule droite" — vue subjective src→tgt après check LOS (CAM_BACK=3, RIGHT=1.5, UP=2)
- [refactor] `Canvas3D.jsx` — zéro logique LOS dans le composant (1 appel hook + 4 callables)
- [fix] P-LOS13 : ligne LOS ne disparaît plus après ¼ sec (guard `justHandledTargetRef` dans le service)
- [fix] TDZ `voxelsRef` : appel `useCameraLOS` déplacé après déclaration `voxelsRef`

---

## v113 — 2026-06-20 — FEAT2-A : LOS outil menu radial

### Client — Nouvelle fonctionnalité
- [feat] Menu radial token : secteur "Vue" (ex-"Viser") — outil ligne de vue
- [feat] `client/src/lib/losUtils.js` — `checkLOS()` pure function, `fast-voxel-raycast`, PE14
- [feat] Ray 3D vert/rouge entre tokens (`<line>` natif bufferGeometry) — persiste jusqu'au prochain check
- [feat] Overlay DOM résultat (cliquable pour fermer) + bannière mode sélection cible

---

## v112 — 2026-06-20 — REWORK-04 : FSM Combat + persistence DB

### Serveur — Architecture
- [refactor] `server/src/lib/combatFSM.js` — FSM combat (6 états, fonctions pures : `canTransition`, `nextState`, `setFSMSubPhase`, `allowedEvents`)
- [refactor] Migration 80 : table `combat_pending` — remplace 3 Maps in-memory (`pendingMeleeDefense`, `pendingDamageActions`, `pendingStunActions`)
- [refactor] Migration 81 : `combat_state.sub_phase` — sous-état FSM persisté (`SLOT_ACTIVE` / `AWAITING_DEFENSE` / `AWAITING_DAMAGE`)
- [refactor] `socketCombat.js` — guards `canTransition` sur 10 handlers + Maps → DB
- [refactor] `statusService.applyStun` — `pendingStunActions` Map → `combat_pending` DB
- [fix] Reconnexion pendant RESOLUTION — prompts (`MELEE_DEFENSE`, `DAMAGE`, `STUN`) restaurés sur reconnexion joueur

### Client — Architecture
- [refactor] `combatStore.js` — `subPhase` + `setCombatSubPhase`
- [refactor] `useCombatSocket.js` — `subPhase` propagé depuis `COMBAT_STATE_SYNC`

---

## v111 — 2026-06-19 — WorkshopPage : messages d'erreur plus précis

### Client — Correctifs
- [fix] Atelier GM : messages d'erreur affinés — fallback `.message` + `err.message` avant le générique i18n (5 handlers : création, import, suppression pack, upload PNG, suppression fichier)

---

## v110 — 2026-06-19 — Session 109 : triage docs

### Documentation — Aucun impact utilisateur
- [refactor] ARCHI_REWORK.md allégé (969 → ~100 lignes), specs archivées dans ARCHI_REWORK_DONE.md
- [refactor] JOURNAL4.md archivé — JOURNAL5.md créé pour Sessions 109+
- [refactor] BUGIDENTIFIE.md : +FEAT1 (Map2D) + FEAT2 (LOS raycast cible)

---

## v109 — 2026-06-19 — REWORK-08 Étapes 6 & 7 : socketCombat.js

### Serveur — Architecture
- [refactor] `server/src/socket/socketCombat.js` créé — 13 handlers + 13 helpers + 7 constantes combat extraits de `socket/index.js`
- [refactor] `socket/index.js` : 2994 → 143 lignes — registre de modules uniquement
- [refactor] Disconnect PJ déplacé dans SESSION_JOIN (cleanup systématique)

---

## v108 — 2026-06-19 — REWORK-08 Étape 5 + correctifs entités

### Serveur — Architecture
- [refactor] `server/src/socket/socketEntity.js` créé — 7 handlers entités extraits de `socket/index.js`

### Client — Correctifs entités
- [fix] Entité marquée "Visible GM uniquement" désormais masquée pour les joueurs en temps réel
- [fix] Suppression d'entité possible depuis le panneau de configuration (bouton avec confirmation)
- [fix] Sablier d'interaction entité disparaît après le jet de dés, que le jet réussisse ou échoue

---

## v107 — 2026-06-18 — REWORK-10 : log déclarations intégré dans le chat

### Client — UI Combat
- [feature] Log déclarations combat (REWORK-10) déplacé depuis l'overlay vers le panel chat Sidebar
- [feature] Visible en haut du tab chat pour GM + joueurs pendant ANNOUNCEMENT et RESOLUTION
- [feature] Collapsible sur une ligne (header cliquable, état toggle persistant)
- [refactor] Suppression du render CombatDeclareLogSidebar dans CombatOverlay

---

## v106 — 2026-06-18 — REWORK-09 : SessionPage hooks WS dédiés

### Client — Architecture
- [refactor] `SessionPage.jsx` 1509 → 1296 lignes — 47 listeners WS extraits vers 3 hooks dédiés
- [refactor] `useTokenSocket.js` — 5 listeners TOKEN_* (moved, created, deleted, updated, status)
- [refactor] `useEntitySocket.js` — 4 listeners MAP_SWITCH + ENTITY_ACTION_PENDING/RESULT + ENTITY_MOVE_RESULT
- [refactor] `useCombatSocket.js` — 18 listeners COMBAT_* + 12 états résultat combat
- [fix] Dead props `tokens` et `announcementMarker` supprimées de CombatOverlay

---

## v105 — 2026-06-17 — REWORK-02 : damageService (résolution hit centralisée)

### Serveur — Architecture
- [refactor] Extraction du bloc "résolution cible" (localisation D20 → armure → RD → sévérité → blessure → shock) depuis 4 sites dupliqués vers `damageService.resolveTargetHit`
- [refactor] `LOC_TABLE` déplacée vers `shared/armorConstants.js` (import partagé)

---

## v104 — 2026-06-17 — REWORK-05 clôture : BUG-W1 + BUG-W2 + ERG-W1 + ERG-W2

### Combat — Fenêtre GM (CombatGmDeclareWindow)
- [fix] BUG-W1 : arme CaC holstérée ne se sélectionne plus par défaut — "Mains nues" si arme rangée, arme équipée si "Au clair"
- [fix] BUG-W2 : 2 attaques CaC — la sélection de cible s'enchaîne correctement (slot 1 → slot 2) — race condition `setCombatTargetMode` résolue via `setTimeout(0)`
- [erg] ERG-W1 : "Assaut (tir)" grisé mais cliquable si arme rangée — clic déclenche auto-dégainage ("Au clair") avec coût INI automatique
- [erg] ERG-W2 : panneau CaC — clic arme équipée → auto-dégainage / clic Mains nues → auto-rangement (coût INI selon matrice d'état)

---

## v103 — 2026-06-17 — REWORK-05 : panneaux combat partagés + fix COM5 + fix CL2

### Combat — Architecture UI
- [rework] REWORK-05 : panneaux droits dupliqués (`~370 lignes`) extraits en 3 composants partagés — `DroneWeaponPanel`, `AssaultRangedPanel`, `MeleeCombatPanel`
- [rework] `ACTION_LABELS`, `PURE_MOVE_TYPES`, `COMBAT_MODE_DEFS` migrés dans `combatSections.js` — source unique
- [fix] COM5 : chips mode de combat GM (`CombatGmDeclareWindow`) ne déclenchent plus le mode visée automatiquement — target entry via bouton "Cibler" explicite uniquement
- [fix] CL2 : `DeclareLogContent` exporté depuis `CombatDeclareLog.jsx` — log déclarations Joueur (`CombatActionWindow`) utilise le même composant que le GM — rendu identique garanti

---

## v102 — 2026-06-16 — REWORK-03 : woundService + fix DIV-1 couleurs sévérité combat

### Serveur — Architecture
- [rework] REWORK-03 : `resolveWoundInsertion` × 5 call sites WS → `woundService.applyWound` (module indépendant)
- [fix] DIV-1 : `worst_wound_severity` maintenant inclus dans tous les `WOUND_ADDED` WS — couleurs sévérité (token + timeline) conservées pendant tout le combat

---

## v101 — 2026-06-16 — REWORK-01 clôture : SHK4 + SHK5 + CSS [A1]

### Combat — Test de Choc
- [fix] SHK4 : D20 Test de Choc maintenant visible dans le chat (carte `shock_test` dédiée avec seuils Étourd./Inconsc.) — 5 call sites + `emitShockDiceResult` export synchrone
- [fix] SHK5 : `shock_auto_stun=false` — `CombatStunWindow` correctement routée vers le GM pour les PJ cibles (lecture `shock_auto_stun` dans branche PJ de `applyStun`)
- [fix] [A1] `CombatStunWindow` conventions CSS — `className="btn"`, classes `.combat-stun-*` dans `index.css §11`

---

## v100 — 2026-06-16 — Fix CUR1 : curseur bloqué après fermeture combat

### Combat — UX
- [fix] CUR1 : curseur / panneaux de sélection (cible, déplacement) fantômes après fermeture du combat — `combatMoveMode`, `combatTargetMode`, `pendingMoveSelection` remis à `null` dans `COMBAT_ENDED` et `COMBAT_PHASE_CHANGED`

---

## v99 — 2026-06-16 — Fix SHK6 + REWORK-01 validé complet

### Combat — Drone → PJ
- [fix] SHK6 : `COMBAT_DAMAGE_CONFIRM` rejetait silencieusement le PJ cible d'un drone (drone sans `user_id` → `pending.userId = null` → auth échouait) — fenêtre dégâts débloquée
- [fix] `targetUserId` ajouté au pending action branch 8c (`resolveDroneAssaultAction`) pour autorisation correcte

### REWORK-01 — Validation complète
- Scénarios 1-5 ARCHI_REWORK.md tous validés : PNJ cible, PJ cible (`CombatStunWindow`), non-régression, PJ offline fallback, CaC non-régression

---

## v98 — 2026-06-16 — REWORK-01 : statusService (module étourdissement)

### Combat — Architecture stun
- [rework] `resolveShockBlock` (bloc monolithique copié ×5) → `statusService.js` (module indépendant)
- [feat] `resolveShockTest` : pure, D20 uniquement, zéro DB/WS — découplé de l'émission résultat
- [feat] `applyStun` : PJ connecté → fenêtre interactive "Lancer 1D6" (`CombatStunWindow`), PNJ → D6 auto serveur
- [feat] `CombatStunWindow` : badge coloré outcome (jaune/rouge) + bouton "Lancer 1D6" — PJ choisit quand lancer
- [fix] Séquençage : `COMBAT_DAMAGE_RESULT` émis **avant** le stun → la fenêtre dégâts ne se bloque plus jamais si la résolution stun échoue
- [feat] `shock_auto_stun = false` : GM reçoit le prompt D6 pour ses PNJs (V1 partiel — PJ→fenêtre joueur, correction future)

---

## v97 — 2026-06-14 — Fix split-brain slot detection

### Combat — Architecture slots
- [fix] Split-brain slot actif : `CombatOverlay` utilise désormais `activeTokenId` (absolu) au lieu de `sortedRoster[activeSlotIdx]` (index roster complet) — élimine le cas où un token non-annoncé à INI haute bloquait le combat
- [fix] `startResolutionPhase` : premier slot envoyé depuis le roster annoncé filtré (pas le roster complet) — cohérence avec `COMBAT_ACTION_CONFIRM`
- [fix] Actions transmises au client filtrées `status='pending'` — pas de données périmées de tours précédents
- [fix] Guard CaC sans cible : `COMBAT_ACTION_DECLARE` refuse avec `COMBAT_DECLARE_ERROR` si aucune cible sélectionnée — `has_announced` non settée

---

## v96 — 2026-06-14 — Sprint CaC Étape 3 : CombatCacModifiersWindow + mods situation

### Combat — Corps à corps
- [feat] Nouvelle fenêtre modificateurs CaC (`CombatCacModifiersWindow`) — 7 mods attaquant + terrain instable défenseur + taille cible
- [feat] Deux armes au contact : détection automatique serveur (MD + MG arme contact → +3)
- [feat] Terrain instable : compétence limitative ACROBATIE_EQUILIBRE appliquée attaquant ET défenseur
- [feat] 6 clés de situation CaC dans `SITUATION_MODS` (côté, au sol, espace confiné/très confiné, position avantageuse, main non directrice)
- [feat] `confirmedModifiers` propagé sur les 4 call sites de `resolveMeleeAction` (multi-attaque inclus)
- [feat] `breakdownAtk` / `breakdownDef` : nouvelles entrées conditionnelles visibles dans le chat

---

## v95 — 2026-06-14 — Sprint CaC : correctifs mécaniques (Étapes 1+2)

### Combat — Corps à corps
- [fix] B9 — Test d'opposition §6.2 complet : les deux réussissent → meilleure MR l'emporte, égalité = rien
- [fix] B1 — Compétence défenseur selon arme équipée en main (priorité `hand_pref`), fallback Mains nues
- [fix] B2 — Charge impossible si déjà à ≤ 3m du défenseur (LdB §6.4)
- [fix] B8 — Drone défenseur CaC : test simple, dégâts via `calcDroneRD` + intégrité
- [fix] LOC — Table de localisation CaC séparée (`LOC_TABLE_CONTACT`) — 3 emplacements

### Combat — Drones
- [fix] B3 — Drone CaC `armement_contact` : modificateur portée = 0 (contact physique, pas de +5 `bout_portant`)

## v89b — 2026-06-12 — Sprint 2c : cycle combat drone joueur complet

### Drones — Combat
- [fix] Joueur peut déclarer l'attaque de son drone via `COMBAT_ACTION_DECLARE` — guard ownership corrigé (drone joueur n'était pas autorisé)
- [fix] Bouton "Agir" GM visible en RESOLUTION quand un drone a une action d'assaut déclarée
- [fix] Résolution drone sans `confirmedModifiers` — portée défaut 'courte' si absent (modifiers non requis pour drone V1)
- [fix] Fenêtre ANNOUNCEMENT GM ne s'affiche plus pour les drones appartenant à un joueur
- [fix] Champs NT dans la fiche drone — affichage en chiffres romains (I–VIII), édition GM en entier
- [fix] WeaponsTab drone — suppression du concept "Chargeur" (non applicable) ; `ammo_restant = null` → `∞`

## v90 — 2026-06-12 — Breakdown détail jets de dé

### Chat sidebar
- [add] Bouton `⊞` sur chaque jet structuré (combat tir, CaC, action entité) — ouvre un popover avec le détail ligne par ligne des modificateurs composant le Seuil
- [add] Colorisation par type : compétence (bleu), bonus (vert), malus (rouge), Seuil (or)
- [add] Fermeture click-outside ou Escape
- [add] Payload `DICE_RESULT` enrichi côté serveur : champ `breakdown` optionnel sur 5 points d'émission (tir distance, CaC attaquant, CaC défenseur PNJ, CaC défenseur PJ, action entité)

## v94 — 2026-06-12 — Sprint Drones 2c : attaque drone (GM)

### Drones — Combat
- [add] GM peut déclarer l'attaque d'un drone en phase ANNOUNCEMENT — sélecteur arme drone + cible dans CombatGmDeclareWindow
- [add] Résolution automatique de l'attaque drone en RESOLUTION — programme armement, modificateurs situationnels (§7.3), dommages
- [add] Trois branches cible : drone (intégrité), PNJ (blessures auto), PJ (lancer des dégâts)
- [add] Pré-sélection automatique de la taille cible dans CombatModifiersWindow si la cible est un drone
- [add] Armes drone custom (sans ref_equipment) — nom + formule de dommages directs dans drone_weapons
- [add] Migration 76c — schéma drone_weapons étendu (name, damage_formula, portee, fire_mode, notes)
- [add] Migration 76d — catégories programmes `armement_distance` / `armement_contact` (remplace `armement` générique)

## v87 — 2026-06-11 — Correctifs combat + CombatDeclareLog

### Combat — Déclarations
- [add] CombatDeclareLog — panneau cumulatif des déclarations du tour, persistant pendant ANNOUNCEMENT et RESOLUTION
- [fix] Double fenêtre CombatDeclareLog côté joueur — standalone réservé au GM, déclarations intégrées dans CombatActionWindow (lecture seule) pour les joueurs
- [fix] Style lecteur clair (fond `#f4f7f8`, texte `#1a2a3a`) — même CSS partagé GM/joueur

### Combat — Correctifs
- [fix] Actions Corps à corps jamais résolues — bouton "Agir" masqué par la branche `myMeleeAction` dans le footer
- [fix] Assaut/CaC bloqué si arme non "Au clair" — guard visuel + surbrillance état arme dans StateSelector
- [fix] Dégainer automatique (QB) supprimé — dégainer coûte des INI comme le prescrit le LdB Polaris
- [fix] CaC — sélection auto arme supprimée, défaut = Mains nues (fallback si aucune arme de contact équipée)
- [fix] EXCLUSIVE_ACTIONS supprimé — Recharger ne désélectionne plus les autres actions
- [fix] Munitions vérifiées en ANNOUNCEMENT — `COMBAT_DECLARE_ERROR` si insuffisantes pour le mode de tir choisi
- [fix] Flash blanc onglet Matériel — rechargements WS silencieux via `hasLoadedRef` (ArmorWoundPanel, WeaponPanel, InventoryPanel)
- [fix] Icônes de statut s'affichant au-dessus de toute l'UI — `zIndexRange={[1, 0]}` sur le `<Html>` Drei
- [fix] Options de jet critique non mémorisées au rechargement — `detectSimpleConfig` restaure les 4 états depuis `dice_config`
- [fix] Chat combat — DICE_RESULT structuré pour les 4 jets (assaut tir, CaC attaque, CaC défense PJ, CaC défense PNJ)
- [fix] Terminologie `cdr` → `seuil` dans les payloads COMBAT_ATTACK_PLAYER_RESULT
- [fix] Dé résultat — taille fixe 20px + aligné à droite dans le chat (Sidebar)
- [fix] Joueur propriétaire peut modifier le GLB de son propre token (route `characters.js` + `CharacterWindow`)

### Documentation — Plan drones combat
- Audit exhaustif `docs/PLAN_DRONESYSCOMBAT.md` — 25 issues V1–V25 identifiées et résolues
- Architecture Sprint 2b : deux branches (PNJ→drone resolveAssaultAction, PJ→drone COMBAT_DAMAGE_CONFIRM)
- Décision V21 télépilotage Option C : propriétaire consomme son slot, drone status='done' ce round
- Simulation à blanc Sprints 2a–3 : 14 findings, 3 décisions design, 10 corrections supplémentaires au plan
- Migrations planifiées : 76, 76b, 76c, 76d, 77, 77b

## v85 — 2026-06-09 — Tour de combat complet + Corrections UI fenêtres

### Combat — Corrections critiques
- [fix] "Assaut (tir)" PNJ déclenchait le panneau Corps à corps au lieu du mode visée (isMeleeSetup)
- [fix] Fenêtre déclaration joueur (Phase 1) bloquée en haut à gauche sous la Timeline — position:fixed
- [fix] Fenêtre résolution GM bloquée en haut à gauche + largeur plein écran — position:fixed
- [fix] Drag & drop token silencieusement annulé pendant un combat pour les joueurs (intégrité)

### Combat — UX harmonisée GM/Joueur
- [add] Fenêtre validation assaut se positionne près du token cible cliqué (GM et joueur)
- [add] Fenêtre validation déplacement se positionne près de la case sélectionnée
- [add] Case de destination mise en surbrillance bleue dans la vue 3D après sélection

## v83 — 2026-06-06 — Fiche Drone + Design System CSS + Migration catalogue compétences

### Fiche Drone — Programmes
- [add] Catalogue de 34 programmes logiciels (LdB p.281) : Détection, Ami/Ennemi, Armement, Esquive, Pilotage, Analyse, Médical, Communication, Spécialisés
- [add] Section "Duel d'ordinateurs" regroupant les programmes Sécurité, Offensif, Contre-attaque et Rempart
- [add] Tooltip description au survol du nom de programme (texte LdB complet)
- [add] Mode "Catalogue" : sélection depuis le catalogue organisé par catégorie
- [add] Mode "Personnalisé" : saisie libre avec catégorie assignable (pour programmes custom hors LdB)
- [add] Validation contrainte ordinateur : niveau max (gen + 2×NT) et potentiel total (10 + gen×NT×2)
- [add] Intégrité actuelle éditable directement par le GM

### Interface Combat — Design System
- [chg] 9 composants combat migrés de styles JS inline vers classes CSS centralisées dans index.css
- [add] 27 tokens CSS --combat-* dans :root
- [add] Section 11 COMBAT WINDOW SYSTEM (~320 lignes) : .combat-win, .combat-float-win, .btn-tac-confirm, .combat-timeline-bar, badges, chips, selects

### Catalogue compétences (migration 74)
- [fix] 10 groupes structurels manquants insérés (Mutation, Pouvoirs Polaris, Armes Spéciales, Arts martiaux, Commerce/Trafic, Pilotage, Génie technique…)
- [fix] Compétence Arts martiaux restaurée avec le bon attribut (COO/ADA) et le malus (-3) sur ses sous-compétences
- [fix] MUTATION_* et POUVOIRS_POLARIS_* : marqueur (X) appliqué — ces compétences se masquent correctement si non acquises
- [fix] Prérequis CHIRURGIE, FALSIFICATION et 3 compétences Polaris/Mutation ajoutés
- [fix] Typo identifiant ACCROBATIE_EQUILIBRE → ACROBATIE_EQUILIBRE

---

## v81 — 2026-06-05 — Sprint Annonce v2 + corrections combat + roster personnages

### Combat — Phase Annonce
- [chg] Déclaration séquentielle stricte : une fenêtre à la fois dans l'ordre d'initiative, le GM ne peut plus grouper des PNJs en batch
- [add] Ghost de déplacement (cube bleu semi-transparent) visible pour tous après chaque déclaration
- [add] Ligne ambre reliant l'assaillant à sa cible annoncée, visible pour tous les spectateurs
- [add] Mini-panneau "vient d'annoncer" en bas-gauche (nom, INI, destination, cible)
- [chg] Timeline phase Annonce : le déclarant actif est affiché en grand, les déclarés sont atténués
- [add] Bouton "Passer" dans la fenêtre GM quand un joueur bloque le flux d'annonce

### Combat — Monitoring GM en temps réel
- [add] Le GM voit en direct ce que le joueur actif est en train de déclarer : actions choisies, cible visée, destination de déplacement, mode de combat — mis à jour en temps réel (150ms) sans attendre la confirmation
- [add] Reconnexion du GM en cours de déclaration : le preview courant est resynchronisé automatiquement

### Combat — Fenêtre de déclaration
- [add] Roster PNJs collapsible (GM) avec mémorisation de l'état ouvert/fermé
- [add] Roster de personnages collapsible (joueurs) : liste tous les persos du joueur en combat, visible dans tous les états (attente, déclaré, formulaire). Utile pour hackers avec drones ou PNJ alliés assignés
- [add] Ligne de déplacement bleue de l'origine à la destination + nom du token au-dessus — les spectateurs voient clairement qui se déplace et où

### Combat — Test de Choc
- [add] Option campagne "Appliquer l'étourdissement automatiquement" (activée par défaut) — désactivez pour arbitrer manuellement
- [add] Bouton "Appliquer l'étourdissement" dans le panneau résultat GM quand l'option est désactivée
- [fix] L'échec d'un Test de Choc applique désormais le badge Étourdi ou Inconscient sur le token
- [fix] La fin du combat retire automatiquement les badges Étourdi/Inconscient des participants
- [fix] Le MJ voit le panneau résultat dégâts quand un PJ attaque un PNJ

### Combat — Bugs corrigés
- [fix] Écran noir joueur au passage en mode combat (erreur JavaScript interne)
- [fix] Bouton "Assaut (tir)" grisé à tort pour les armes n'ayant jamais été rechargées via l'interface (migration 70 : initialisation automatique du chargeur à l'équipement)

---

## v80 — 2026-06-04 — Bibliothèque : images uploadées dans le cloud

### Bibliothèque
- [fix] Images insérées dans un document sont maintenant hébergées sur le serveur (était : stockées en base64 dans le contenu, alourdissait les documents)
- [chg] Le bouton image dans l'éditeur upload le fichier et insère un lien — comportement identique côté MJ

---

## v79 — 2026-06-04 — Fix placement tokens

### Playground — Tokens
- [fix] Tokens posés sur des demi-dalles (`slab_bottom`) ne flottent plus dans les airs
- [fix] Drop du token se fait maintenant à l'endroit exact où le ghost était affiché, pas là où pointe le curseur
- [fix] Ghost ne saute plus sur la case voisine en bord de voxel pendant le drag
- [fix] Crash écran noir au démarrage de session (TDZ `statusPanel`)

---

## v77 — 2026-06-04 — Optimisation Voxels Phase B

### Playground — Voxels
- [fix] Cubes avec textures multi-faces (east≠south≠top…) affichent désormais la bonne texture sur chaque face lors d'une rotation (r=1/2/3). Invisible avec les textures actuelles (toutes `all`) — correction active pour les futurs packs multi-faces.

---

## v76 — 2026-06-04 — Menu radial Token + Design System + Optimisation Playground

### Playground — Tokens
- [add] Menu radial SVG sur les tokens (clic simple) : 8 secteurs, style hard-SF HUD
- [add] "Fiche" : ouvre la fiche personnage directement depuis le token
- [add] "Retirer" : retire le token du plateau
- [add] Boussole directionnelle dans le cœur du menu : orienter le token en 8 directions
- [add] Cœur coloré selon la pire blessure active (jaune → rouge foncé)
- [add] Animation bloom + pulse danger si critique/mortelle
- [chg] Clic simple sur token = menu radial (était : rotation 45°)

### Playground — Performances voxels
- [perf] Rendu voxels : faces cachées entre cubes adjacents éliminées (face culling)
- [perf] Draw calls réduits de N voxels → nb_textures × 6 maximum
- [perf] Carte complexe : lag quasi supprimé (confirmé session)

### Design System — Interface
- [add] Police Venus Rising active sur les titres (Login, Dashboard)
- [add] 36 tokens CSS : surfaces session, couleurs blessures, accents statuts, familles de polices
- [add] 15 icônes HUD hexagonales de statuts (étourdi, hypothermie, en feu…)
- [add] Boutons harmonisés : style chamfré hard-SF unifié sur Dashboard, Sidebar, CombatOverlay, CombatActionWindow, SessionPage, LibraryPanel
- [add] Badges MJ/Joueur/Résultat chamfrés sur toutes les vues
- [add] Bouton "Quitter la session" dans l'onglet Profil (→ tableau de bord)
- [fix] Timeline mode combat : ne chevauche plus la sidebar (s'arrête au bord gauche de la sidebar)
- [chg] Bouton ⚔ Combat : rouge en mode combat actif, bleu sinon

---

## v75 — 2026-06-03 — Bibliothèque de campagne

### Bibliothèque
- [add] Onglet "Bibliothèque" dans la Sidebar : liste des documents de campagne accessibles
- [add] Éditeur de texte riche (Quill 2.0) : gras, italique, titres, listes, alignement, liens, couleurs, images inline
- [add] Notes du MJ : second éditeur visible uniquement par le MJ
- [add] Permissions par document : "Personne / Tous les joueurs / sélection individuelle" (dropdown multi-select)
- [add] Indicateurs de partage : œil masqué (non partagé), œil ouvert (tous), punaise colorée (joueur(s) spécifique(s))
- [add] Propagation temps réel : document créé/modifié/supprimé visible instantanément par les joueurs autorisés

### Interface
- [chg] Fusion onglets "Joueurs" et "Config" → onglet "Profil" (réglages en haut, liste connectés en bas)

---

## v74 — 2026-06-02 — CaC : Attaque multiple

### Combat — Corps à corps
- [add] Attaque multiple melee : déclarer 2 attaques (malus −5) ou 3 attaques (malus −7) en un tour (LdB p.218)
- [add] Sélection séquentielle des cibles dans le panel CaC (PJ) : N boutons "Choisir l'adversaire"
- [add] GM : chips "1 / 2 (−5) / 3 (−7)" dans le panneau CaC + queue étendue (N cibles par PNJ)
- [add] Résolution séquentielle dans le même slot : attaque 1 → résultat → attaque 2 → etc.

---

## v73 — 2026-06-01 — Correctifs UX & Playground

### Dashboard
- [fix] Boutons Créer/Rejoindre asymétriques → deux cartes identiques avec formulaire inline (filigrane + et →)
- [add] Carte "Rejoindre une campagne" avec champ pré-rempli #code-invitation toujours visible

### Playground — Tokens
- [fix] Étiquettes de nom des tokens ne faisaient pas face à la caméra (Billboard drei)
- [fix] Couleur des étiquettes ne correspondait pas à la couleur du joueur (user_color via JOIN)
- [fix] Drag & Drop imprécis sur terrain plat : token snappe désormais au centre de la case
- [fix] Drag & Drop décalé sur terrain en altitude : raycast voxel remplace plan y=0

### Fiche personnage
- [add] Panel description compétence : bouton ⓘ sur chaque compétence → panel fixe avec texte complet du LdB (scrollable, fermeture clic extérieur)

### Chat
- [fix] Messages partagés entre toutes les campagnes → chaque campagne conserve son propre historique

## v72 — 2026-06-01 — Multi-adversaires Corps à Corps

### Combat — Corps à corps
- [add] Malus encerclement CaC (LdB p.224) : −5 pour 2 adversaires, −7 pour 3, −10 pour 4+
- [add] Critère positionnel : tout ennemi à portée (3m + allonge de son arme) au moment de la résolution
- [add] Alerte ⚠ dans le popup défense PJ : "Encerclé — malus −X à votre défense" si applicable
- [add] Alerte ⚠ dans le panneau résultat melee : indique qui est encerclé et de combien

## v71 — 2026-06-01 — Timeline combat BG3-style

### Combat — Timeline initiative
- [add] Portraits illustrés plein format (illustration fiche personnage)
- [add] Bordure de carte = couleur de la pire blessure active (légère jaune → mortelle rouge foncé)
- [add] Carte active agrandie (64px vs 44px) avec halo doré
- [add] Phase Annonce : cartes triées INI croissante (lents à gauche), curseur flèche ←
- [add] Phase Résolution : cartes depuis les actions déclarées, curseur flèche →
- [add] Timer de tour (si configuré dans les options campagne) — vert/orange/rouge
- [add] Maximum 12 cartes affichées, badge +N pour le surplus
- [add] Animations fluides : entrée/sortie et réordonnancement si INI change (Motion FLIP)
- [fix] Portrait URL cassée (image jamais affichée depuis session 57)
- [fix] Blessures temps réel : bordure se met à jour sans rechargement

## v70 — 2026-06-01 — Token par défaut campagne + stabilité serveur

### Tokens 3D
- [fix] Crash écran noir quand un token sans modèle 3D est placé sur une carte
- [add] Token par défaut de campagne : le GM peut uploader un GLB dans les options campagne
- [add] Bouton "Réinitialiser" pour retirer le token par défaut de campagne
- [add] Hiérarchie fallback : modèle personnage → token campagne → défaut bundle → silhouette

### Serveur
- [fix] Migrations automatiques au démarrage du serveur (plus de migration manuelle)
- [fix] "Erreur lors de l'enregistrement" sur la page Options campagne (colonne inconnue)

## v69 — 2026-06-01 — Serveur Alpha Kiwi + correctifs UI

### Serveur distant Alpha "Kiwi"
- [add] Déploiement sur serveur Linux maison (accessible via internet)
- [add] Services systemd — démarrage automatique au boot, redémarrage en cas de crash
- [fix] api.js : baseURL hardcodée `localhost:3001` → `VITE_API_URL` (fix critique distant)
- [fix] Titres onglets navigateur : toutes les pages s'appelaient "client" → titres explicites par page
- [fix] SessionPage : titre dynamique `Enclume — <nom de la campagne>`

### Atelier du GM
- [fix] Bouton "Supprimer ce pack" maintenant visible sur les packs sans propriétaire (packs migrés)
- [fix] Séparation des droits : Export (propriétaire uniquement) vs Supprimer (propriétaire ou pack orphelin)

## v68 — 2026-05-31 — Modes de combat Corps à Corps + correctifs Dashboard

### Modes CaC (Sprint CaC 3)
- [add] Mode Défensif : aucune attaque, +3 défense si attaqué (LdB p.223)
- [add] Mode Retraite : aucune attaque, +5 défense si attaqué, recul optionnel gratuit (zone lente)
- [add] Recul Retraite : sélection destination en zone lente (identique Charge), ini_mod=0 forcé serveur
- [fix] Chips modes CaC : même couleur verte pour les 5 modes (Défensif/Retraite n'étaient pas verts)
- [fix] Mode Défensif/Retraite : arme QB non modifiée au clic — état arme inchangé (règle LdB)

### Modes CaC (Sprint CaC 2)
- [add] Mode Offensif : +3 attaque, −5 défense si attaqué — déclarable Phase 1
- [add] Mode Charge : +3 attaque, +3 dégâts, −7 défense / requiert ≥3m + déplacement court gratuit
- [add] Sélecteur de mode (chips) dans le panneau CaC côté joueur et côté GM
- [add] Charge PJ : flux séquentiel automatique (déplacement → cible, zone lente uniquement)
- [add] Charge PNJ (GM) : queue combinée move_short + cible, panneau droit étendu (720px)
- [add] Validation distance déplacée en Phase 2 (post-déplacement réel) — Phase 1 = intention libre
- [chg] GM : fenêtre Corps à corps étendue à 720px avec panneau droit dédié
- [chg] GM : batch PNJs libre (DST+CTC ensemble) — filtre type arme appliqué uniquement au démarrage assault
- [fix] Double sélection Assaut+CaC lors du clic CaC (GM) — corrigé
- [fix] Boutons "Passer" fantômes quand deux queues actives simultanément (GM) — corrigé

### Dashboard
- [fix] Formulaire "Rejoindre avec un code" restauré (champ absent depuis la refonte UI)
- [fix] Card "Créer une campagne" : label centré, "+" flottant supprimé

## v67 — 2026-05-31 — Corps à Corps, Rechargement en combat

### Corps à Corps (Sprint CaC 1)
- [add] Action "Corps à corps" déclarable en Phase 1 : sélection cible + arme de contact (ou mains nues)
- [add] Allonge des armes de contact respectée (lance +3m, bâton +2m, etc.)
- [add] Résolution en opposition : jet attaquant vs jet défenseur (Polaris LdB)
- [add] Défenseur PJ lance son dé interactivement — le slot reste bloqué jusqu'à confirmation
- [add] Dégâts melee : formule arme + Mod.Dom. (FOR_na) — identique au corps à corps Polaris
- [add] GM : sélection cible PNJ séquentielle (même queue que l'assaut)
- [add] Résultat opposition affiché (jets attaque/défense, touche ou esquive)
- [fix] Auto-ciblage impossible (on ne peut pas se cibler soi-même)
- [fix] Message d'erreur explicite si cible hors portée (distance affichée)
- [fix] Sélections décochées automatiquement au nouveau tour

### Rechargement en combat
- [add] Action "Rechargement" en Phase 1 : sélection munitions dans panneau droit
- [add] Phase 2 : résultat rechargement (succès / aucune munition) affiché au joueur
- [add] Option campagne : mode de rechargement Chargeur complet (défaut) ou Complément
- [chg] Le joueur ne clique plus "Agir" pour le rechargement — le MJ est maître du timing
- [fix] Exclusion mutuelle des actions de combat (Assaut, CàC, Rechargement, etc.)
- [fix] "Assaut (tir)" grisé automatiquement si chargeur vide

## v66 — 2026-05-30 — Décompte munitions, Jets Favoris, Test de Choc, i18n
- [add] Localisation i18n : 17 composants wired (fiche perso, builder, sidebar, sessions, auth…)
- [add] Fiche personnage : labels Polaris FR (attrs, stats, bio, tooltips allures LdB)
- [add] Système i18n prêt pour EN futur (structure Option C documentée)
- [chg] RegisterPage : traduite en français (était en anglais)
- [add] Décompte munitions en combat (ammo_remaining, skip si chargeur vide)
- [add] Option campagne : munitions illimitées pour les PNJs
- [add] Rechargement avec picker de variante de munition
- [add] Jets Favoris : macros en un clic depuis le DicePanel
- [add] Formulaire création macro avec aperçu du seuil en direct
- [add] Fenêtres combat déplaçables (drag + localStorage)
- [add] Changelog Dashboard (ce panneau)
- [add] Code d'invitation beta (accès sécurisé)
- [add] Test de Choc : résultat affiché (Résistance / Étourdi / Inconscient) + is_stunned appliqué
- [fix] Sévérité promue correctement diffusée dans résultats PNJ (bug P49)

## v65 — 2026-05-28 — Combat avancé, Pathfinding, DicePanel v3
- [add] Sélecteurs d'état dynamiques (couverture, vitesse, mode de tir)
- [add] Déclaration assaut avec sélection de cible sur le canvas
- [add] Déplacement PNJ séquentiel avec queue
- [add] Assaut PNJ (mode minimal) avec picker cible
- [add] Pathfinding A* Chebyshev en temps réel pour le déplacement combat
- [add] Raycast précis sur terrain élevé (fast-voxel-raycast)
- [add] Roue radiale D20 avec favoris persistants et jets secrets au MJ
- [chg] Refonte complète DicePanel v3

## v64 — 2026-05-24 — Jets d'attaque, Dégâts, Blessures combat
- [add] Phase Résolution : jets d'attaque, dégâts, blessures localisées
- [add] Fenêtre dégâts joueur (animation + résultats colorés par sévérité)
- [add] Jet de toucher interactif côté joueur (CombatModifiersWindow)
- [add] Déclaration assaut : cadence CC/RC/RL, dual-wield, sélection cible
- [fix] Calcul compétence arme via chaîne weapon_inv_id → ref_equipment_skill_assoc

## v62 — 2026-05-18 — Phase Résolution combat
- [add] Phase Résolution complète : slots, avancement, fin de tour
- [add] Déplacement combat avec zones A* et anneaux concentriques
- [chg] Payload déclaration v2 — états + mapActions + quick

## v57 — 2026-05-10 — Fondations combat Polaris
- [add] Timeline initiative, phases Surprise, Annonce & Résolution
- [add] Roster de combat avec vérification équipement pré-combat
- [add] Fenêtre déclaration PJ (21 actions, multi-select, INI delta)
- [fix] Distinction PJ / PNJ / Entité de décor (PC27)

