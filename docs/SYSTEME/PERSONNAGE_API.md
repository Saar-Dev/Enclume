SYSTEME/PERSONNAGE_API.md — Routes REST de la fiche personnage

    Dernière mise à jour : 2026-07-19
    Sources : server/src/routes/char-sheet.js, server/src/routes/characters.js, server/src/routes/creation.js
    Lire pour : comprendre comment le client lit et modifie la fiche, et quels événements WS sont émis.
    Voir aussi : @PERSONNAGE_CALCULS pour la chaîne de calcul, @BLESSURES pour les blessures, @SERVICES_COMBAT pour les dégâts.

1. Où sont les routes ?

Deux routeurs Express, plus un troisième pour le Wizard.
text

/api/char-sheet/:characterId/...    ← Fiche, attributs, compétences, blessures, inventaire, macros
    Fichier : server/src/routes/char-sheet.js
    Middleware : router.param('characterId') → vérifie propriétaire OU GM
    
/api/campaigns/:campaignId/characters  ← Liste, création, édition, suppression des personnages
    Fichier : server/src/routes/characters.js
    Middleware : requireAuth + requireRole('gm') pour création/suppression
    
/api/creation/...                   ← Wizard de création étape par étape
    Fichier : server/src/routes/creation.js
    Middleware : router.param('sheetId') → propriétaire OU GM

2. Qui a le droit de faire quoi ?

Le middleware router.param('characterId') dans char-sheet.js applique :

    L'utilisateur doit être membre de la campagne

    Propriétaire (character.user_id === req.user.id) OU GM (role === 'gm')

    Exception : les drones sont accessibles en lecture à tous les membres

Routes hors char-sheet.js (dans characters.js) :

    GET /campaigns/:id/characters → tout membre (joueurs : visible=true uniquement, jamais gm_notes)

    POST → GM uniquement

    PUT /api/characters/:id → GM (tous champs) ou propriétaire (name, visible, description)

    DELETE → GM uniquement

3. Flux complet : achat d'une compétence
text

Client (SkillsPanel.jsx)
    │
    ▼ POST /api/char-sheet/:characterId/skills/buy  { skill_id: "PIRATAGE" }
    │
Serveur (char-sheet.js) :
    1. Vérifie ownership (param('characterId'))
    2. Fetch ref_skills → vérifie si compétence (X) à débloquer
    3. Si skill_prerequisites activé → vérifie prérequis SKILL_MIN
    4. Vérifie prérequis MUTATION/ADVANTAGE/GENOTYPE (indépendant de l'option)
    5. Calcule coût : getCoutAugmentation(mastery) ou getCoutDeblocageX()
    6. Vérifie xp_available >= coût
    7. Transaction : UPSERT char_skills + UPDATE char_sheet.xp_available
    8. Retourne { skill_id, mastery, is_learned, xp_available, cout }
    │
    ▼ Réponse au client
Aucun événement WS n'est émis (le client recharge la fiche si nécessaire)

4. Routes par domaine
4.1 Fiche standard
Route	Accès	WS émis	Description
GET /:characterId	Owner/GM	—	Fiche complète (sheet + identity + archetype + attributes + skills + mutationEffects)
POST /:characterId	Owner/GM	—	Crée la fiche vide si absente (idempotent)
PUT /:characterId/identity	Owner/GM	—	Identité (nom, taille, poids...)
PUT /:characterId/archetype	Owner/GM	—	Archétype (génotype, âge, sexe...)
PUT /:characterId/attributes	GM only	—	Upsert en masse des attributs
POST /:characterId/attributes/buy	Owner only	—	Dépense 5 XP → +1 pc_modifier
PUT /:characterId/skills	GM only	—	Upsert en masse des compétences
PUT /:characterId/skills/toggle-learned	Owner/GM	—	Toggle is_learned (pouvoirs Polaris uniquement)
POST /:characterId/skills/buy	Owner only	—	Achat compétence (voir flux §3)
PUT /:characterId/chc	Owner/GM	—	Chance (1-20)
PUT /:characterId/xp	GM only	—	xp_total, xp_available
4.2 Blessures et inventaire
Route	Accès	WS émis	Description
GET /:characterId/wounds	Owner/GM	—	Liste + wound_penalty + wound_test_blocked
POST /:characterId/wounds	Owner/GM	WOUND_ADDED	Ajoute une blessure (+ promotion auto)
PUT /:characterId/wounds/:wid/stabilize	Owner/GM	WOUND_UPDATED	Stabilise
DELETE /:characterId/wounds/:wid	Owner/GM	WOUND_REMOVED	Guérison
GET /:characterId/inventory	Owner/GM	—	Items, poids, sols, threshold
POST /:characterId/inventory	Owner/GM	INVENTORY_ADDED	Ajoute un item
PUT /:characterId/inventory/:itemId	Owner/GM	INVENTORY_UPDATED	Modifie slot/conteneur
DELETE /:characterId/inventory/:itemId	Owner/GM	INVENTORY_REMOVED ou INVENTORY_UPDATED	Supprime (ou décrémente stack)
POST /:characterId/inventory/:itemId/reload	Owner/GM	INVENTORY_UPDATED + INVENTORY_REMOVED	Recharge une arme
PUT /:characterId/sols	Owner (décrémenter) / GM (tout)	SOLS_UPDATED	Solde

Détail dans @BLESSURES.
4.3 Macros
Route	Accès	WS émis	Description
GET /:characterId/macros	Owner/GM	—	Liste (max 10)
POST /:characterId/macros	Owner/GM	—	Crée une macro
PUT /:characterId/macros/:mid	Owner/GM	—	Modifie label, sources, modifier, template
DELETE /:characterId/macros/:mid	Owner/GM	—	Supprime
GET /:characterId/macro-options	Owner/GM	—	Attributs, skills, secondaires disponibles
POST /:characterId/macro-preview	Owner/GM	—	Calcule le seuil live { sources, modifier }
4.4 Avantages et mutations
Route	Accès	WS émis	Description
GET /:characterId/advantages	Owner/GM	—	Avantages actifs
POST /:characterId/advantages	GM only	—	Octroie un avantage (narratif)
DELETE /:characterId/advantages/:id	Owner/GM	—	Supprime (soft delete)
GET /:characterId/mutations	Owner/GM	—	Mutations actives
POST /:characterId/mutations	GM only	—	Ajoute une mutation
DELETE /:characterId/mutations/:id	GM only	—	Supprime
GET /:characterId/mutation-effects	Owner/GM	—	Agrégat uniquement (rafraîchit les NA sans recharger toute la fiche)
4.5 Moding et équipement rapide
Route	Accès	WS émis	Description
GET /:characterId/moding/state	Owner/GM	—	Armes avec mods + mods installables
POST /:characterId/moding/install	Owner/GM	INVENTORY_REMOVED/UPDATED + MOD_INSTALLED	Installe un mod
POST /:characterId/quick-equip	GM only	INVENTORY_ADDED	Équipement d'urgence (bypass container)
4.6 Armes
Route	Accès	WS émis	Description
GET /:characterId/weapon-skill/:weaponInvId	Owner/GM	—	Compétence associée { skillId, skillLabel, skillTotal }
4.7 Gestion des personnages (hors fiche)
Route	Accès	WS émis	Description
GET /api/campaigns/:cid/characters	Membres	—	Liste filtrée (joueurs : visible, jamais wizard_locked_at)
POST /api/campaigns/:cid/characters	GM only	—	Crée personnage + fiche en transaction
PUT /api/characters/:id	GM/Owner	CHARACTER_UPDATED	Modifie (gm_notes retiré du broadcast)
DELETE /api/characters/:id	GM only	—	Supprime tokens associés puis personnage
POST /api/characters/:id/portrait	GM/Owner	CHARACTER_UPDATED	Upload illustration MinIO
POST /api/characters/:id/glb	GM/Owner	CHARACTER_UPDATED	Upload modèle 3D MinIO
5. Wizard de création

Fichier : server/src/routes/creation.js

Architecture client-primary : les données restent dans Zustand côté client. POST /:sheetId/reconcile applique l'état partiel ou complet. POST /:sheetId/lock verrouille définitivement.
Route	Description
POST /api/creation/start	Démarre un brouillon
GET /:sheetId/step3/ref	Mutations disponibles
GET /:sheetId/step4/ref	Backgrounds et carrières
GET /:sheetId/step4	État courant étape 4
GET /:sheetId/step5/ref	Avantages disponibles
GET /:sheetId/preview	Lecture brouillon
POST /:sheetId/reconcile	Applique l'état (payload 1 à 5 étapes)
POST /:sheetId/lock	Verrouille la fiche

Une fiche non verrouillée (wizard_locked_at IS NULL) est masquée des listes.
6. Routes drone

Sous /api/char-sheet/:characterId/drone. Lecture ouverte à tous les membres. Écriture : GM ou propriétaire.
Route	Description
GET /drone	Fiche + programmes
PUT /drone	Stats descriptives
GET /drone/cargo	Items dans le drone
POST /drone/cargo/:invId/drop	Retourne un item vers le propriétaire
PUT /drone/integrity	Intégrité + cases dommages
POST /drone/programs	Ajoute un programme
PUT /drone/programs/:pid	Modifie level/sort_order
DELETE /drone/programs/:pid	Supprime
GET /drone/weapons	Liste des armes
POST /drone/weapons	Ajoute (catalogue ou custom)
PUT /drone/weapons/:wid	Modifie
DELETE /drone/weapons/:wid	Supprime
7. Pièges
Code	Description
P-VISIBLE	Personnages non verrouillés (wizard_locked_at IS NULL) masqués pour tous. visible=false masqué pour joueurs uniquement.
P-GM-NOTES	gm_notes jamais envoyé aux joueurs. Filtré avant broadcast CHARACTER_UPDATED.
P-TYPE	Type (pj/pnj/drone) dérivé du rôle du owner, sauf type:'drone' explicite.
P-ATTR-GM	PUT /attributes → GM only. POST /attributes/buy → owner only.
P-SKILL-BUY	POST /skills/buy vérifie prérequis côté serveur même si l'UI les masque.
P-SOLS	Joueur : décrémenter seulement. GM : augmenter ou décrémenter.
P-IDEMPOTENT	POST /:characterId est idempotent (code 23505 géré).
P-DRONE-READ	Drones lisibles par tous les membres. Routes d'écriture protégées par droneIsGmOrOwner.
P-XP-BUY	xp_available vérifié avant chaque achat. Jamais descendre sous 0.
