SYSTEME/PERSONNAGE_WIZARD.md — Assistant de création de personnage

    Dernière mise à jour : 2026-08-23
    Source : client/src/components/creation/WizardCreation.jsx, client/src/components/creation/WizardLockSync.jsx, client/src/lib/useWizardLiveEmit.js, client/src/stores/creationStore.js, server/src/services/creationService.js, server/src/routes/creation.js, shared/events.js
    Lire pour : comprendre le flux de création, les étapes, l'architecture client-primary, et la collaboration temps réel MJ/joueur.
    Voir aussi : @PERSONNAGE_CALCULS pour la chaîne de calcul, @PERSONNAGE_API pour les routes.

1. Architecture client-primary

Les données du Wizard vivent dans client/src/stores/creationStore.js (Zustand). Le serveur ne stocke l'état qu'au moment de reconcile ou lock. Ce pattern permet au joueur de naviguer librement entre les étapes sans écritures DB intermédiaires, et de revenir en arrière sans rollback.
text

Client (Zustand)
    │
    ├── POST /api/creation/start        → crée un brouillon (character + char_sheet)
    │
    ├── GET /api/creation/:sheetId/step3/ref   → données de référence (mutations)
    ├── GET /api/creation/:sheetId/step4/ref   → données de référence (backgrounds)
    ├── GET /api/creation/:sheetId/step5/ref   → données de référence (avantages)
    │
    ├── POST /api/creation/:sheetId/reconcile  → applique l'état courant (payload partiel ou complet)
    └── POST /api/creation/:sheetId/lock       → verrouille la fiche, fin du Wizard

Le Wizard est monté dans un SocketProvider : la prévisualisation et les étapes 1 à 5 sont synchronisées en temps réel entre le joueur et un MJ observateur via la room `wizard:<sheetId>` — voir §5.
2. Flux de création (6 étapes)
Étape	Composant	Données stockées	Validation
0 — Méthode	Step0Method.jsx	Choix "point_buy"	Crée le brouillon serveur
1 — Attributs	Step1Attributes.jsx	Répartition des 8 attributs, PC dépensés, sexe	validateStep1 (@PERSONNAGE_CALCULS)
2 — Génotype	Step2Genotype.jsx	genotype_id, option déserteur	Coût PC, prérequis
3 — Mutations	Step3Mutations.jsx	Mutations sélectionnées	Option randomMutationsEnabled
4 — Expérience	Step4Experience.jsx	Backgrounds, carrières, âge	Coût PC, plafonds de compétences
5 — Avantages	Step5Advantages.jsx	Avantages et désavantages	Budget PC restant
6 — Récapitulatif	WizardReview.jsx	Lecture seule, prévisualisation fiche	—

Le bouton "Terminer" appelle reconcile avec finalize: true, puis resetCreation() et redirection vers l'accueil.
3. Navigation et contraintes

    highestStep : le joueur ne peut pas dépasser la dernière étape validée. Il peut revenir librement aux étapes précédentes.

    stepError : les erreurs de validation (serveur ou client) sont affichées dans un bandeau en haut du Wizard.

    Prévisualisation : à l'étape 6, le bouton "Ouvrir la fiche" appelle d'abord reconcile pour synchroniser le brouillon, puis GET /preview pour charger la fiche complète dans CharacterWindow en lecture seule.

4. Intégration avec le reste du système

    Store : creationStore est isolé — il ne communique pas avec characterStore ou authStore sauf pour l'étape 0 (création du brouillon).

    Calculs : les étapes 1 et 2 utilisent shared/polarisUtils.js (@PERSONNAGE_CALCULS) pour la validation et l'aperçu des attributs effectifs.

    Routes API : voir @PERSONNAGE_API §"Wizard de création" pour le détail des routes.

    Service serveur : server/src/services/creationService.js contient reconcileCreation et lockWizard.

5. Collaboration temps réel MJ/joueur

Un MJ peut ouvrir le brouillon d'un joueur pendant sa création. Toute saisie du joueur doit être visible immédiatement chez le MJ, et réciproquement — exigence tranchée avec Saar, ex-`docs/PLAN_WIZARDCOLLAB.md` (chantier clos, archivé sous `docs/Old/`, contenu durable transféré ici).

Room dédiée par fiche : `wizard:<sheetId>` (pas la room de campagne — cloisonnement voulu, un joueur connecté ne doit rien voir du brouillon d'un autre). Rejointe via l'événement WIZARD_JOIN, câblée par le composant sans rendu WizardLockSync.jsx (doit être monté sous SocketProvider).

Trois canaux, trois autorités distinctes (shared/events.js) :
Canal	Émetteur → récepteur	Persisté ?	Rôle
WIZARD_LOCK_UPDATE → WIZARD_LOCKS_SYNC	MJ → serveur → room	Oui (wizard_locks)	Le MJ verrouille une option (étapes 1-5) pour empêcher le joueur d'y toucher
WIZARD_LIVE_UPDATE	joueur/MJ → serveur → room sauf émetteur (socket.to)	Non, éphémère	Brouillon en cours de frappe, jamais validé ni écrit en base — débounce 250 ms côté client (useWizardLiveEmit.js)
WIZARD_STATE_SYNC	serveur → room (après reconcile, steps réellement soumis relus en base)	Oui — c'est la relecture qui est diffusée	Source de vérité durable : un MJ déjà ouvert sur la fiche voit les étapes validées sans recharger la page
WIZARD_ERROR	serveur → socket émetteur seul	—	Erreur métier (accès refusé, etc.), jamais diffusée à la room

Distinction côté client (WizardCreation.jsx) entre l'auteur des données et un observateur :

    isOwner = ownerUserId === user.id            // joueur sur sa fiche, ou MJ créant SON PERSONNAGE
    isObservingOther = ownerUserId && !isOwner    // MJ ouvrant le brouillon d'un AUTRE joueur

liveOr(live, committed) ne préfère la donnée live/distante que pour isObservingOther — l'auteur voit toujours sa propre saisie locale, jamais un écho serveur qui pourrait l'interrompre. gmSyncKey (dérivé de stateSyncVersion, incrémenté à chaque WIZARD_STATE_SYNC reçu) force un remontage des composants d'étape, mais uniquement côté observateur — nécessaire car leur useState(initialData) interne ne se resynchronise jamais seul après montage (comportement React standard, pas un oubli).

6. Pièges
Code	Description
P-WIZ-1	Le Wizard n'est pas protégé par router.param('characterId') mais par router.param('sheetId'). Les règles d'accès sont les mêmes (owner ou GM), mais le fichier est creation.js, pas char-sheet.js.
P-WIZ-2	Une fiche non verrouillée (wizard_locked_at IS NULL) est masquée de toutes les listes de personnages (filtre whereNotExists dans characters.js).
P-WIZ-3	visible=true peut être posé dès la fin de l'étape 5, mais la fiche reste masquée tant que wizard_locked_at est NULL. Ne pas confondre les deux mécanismes.
P-WIZ-4	reconcile est idempotent et rejouable. Le client l'appelle à chaque ouverture de la fenêtre de prévisualisation, pas seulement au "Terminer".
P-WIZ-5	onLiveChange passé à un composant d'étape doit être un callback stable (useCallback, jamais une fléchée inline) : recréé à chaque rendu, il redéclenche en boucle l'effet du composant d'étape qui le liste en dépendance (Maximum update depth exceeded, vécu en test réel).
P-WIZ-6	WIZARD_JOIN doit attendre useSocketReady(), pas seulement !!socket — useSocket() rend un objet non-null dès le montage du SocketProvider, avant que la connexion réseau existe ; émettre trop tôt court-circuite SESSION_JOIN et rend les verrous MJ inertes en silence.
P-WIZ-7	reconcileCreation : chaque bloc STEPn ne doit wipe/réinsérer que les lignes dont il est propriétaire, jamais une table entière. char_mutations est partagée par STEP3 (source chosen/random) et STEP4 (source revers) — un `.del()` sans `.whereIn('source', ...)` côté STEP3 efface silencieusement les mutations Revers de STEP4 (WIZ46, corrigé 2026-08-23). Piège symétrique à surveiller sur toute table partagée entre deux étapes (char_advantages STEP4/STEP5 déjà filtré correctement).