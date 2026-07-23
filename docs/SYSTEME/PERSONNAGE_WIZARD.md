SYSTEME/PERSONNAGE_WIZARD.md — Assistant de création de personnage

    Dernière mise à jour : 2026-07-21
    Source : client/src/components/creation/WizardCreation.jsx, client/src/stores/creationStore.js, server/src/services/creationService.js, server/src/routes/creation.js
    Lire pour : comprendre le flux de création, les étapes, et l'architecture client-primary.
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

Le Wizard est monté dans un SocketProvider pour permettre la synchronisation temps réel de la fiche pendant la prévisualisation, mais les étapes elles-mêmes fonctionnent sans WebSocket.
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

5. Pièges
Code	Description
P-WIZ-1	Le Wizard n'est pas protégé par router.param('characterId') mais par router.param('sheetId'). Les règles d'accès sont les mêmes (owner ou GM), mais le fichier est creation.js, pas char-sheet.js.
P-WIZ-2	Une fiche non verrouillée (wizard_locked_at IS NULL) est masquée de toutes les listes de personnages (filtre whereNotExists dans characters.js).
P-WIZ-3	visible=true peut être posé dès la fin de l'étape 5, mais la fiche reste masquée tant que wizard_locked_at est NULL. Ne pas confondre les deux mécanismes.
P-WIZ-4	reconcile est idempotent et rejouable. Le client l'appelle à chaque ouverture de la fenêtre de prévisualisation, pas seulement au "Terminer".