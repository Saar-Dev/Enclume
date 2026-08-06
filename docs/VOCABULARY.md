VOCABULARY.md — Contrat sémantique officiel d'Enclume

    Version : V2.1 — enrichi session 2026-08-02 (termes world builder)

    Statut : Source de vérité (non exhaustif — à enrichir à chaque ambiguïté rencontrée)

Mission

Vocabulary définit le langage officiel d'Enclume. Ce document est la seule source de vérité concernant :

    les concepts métier Polaris ;

    les termes propres à Enclume ;

    les conventions de nommage ;

    les identifiants historiques ;

    les ambiguïtés connues.

Règles
Source de vérité

Lorsqu'un concept existe dans Vocabulary, sa définition fait autorité. Les autres documents doivent référencer Vocabulary plutôt que recopier les définitions.
Convention documentaire

Chaque concept documenté possède lorsque cela est pertinent : un nom métier, un identifiant de code, une implémentation de référence, une source d'autorité.
Concepts métier Polaris
Concept	Description	Implémentation
Stabilisation	Test de Premiers soins immédiat sur Blessure critique à risque d'hémorragie, mortelle ou membre détruit — échelle minute par minute, distincte de Guérison/Infection. Hors périmètre de l'échéancier de campagne (cadence trop rapide pour un MJ qui avance le temps par grands sauts).	is_stabilized (character_wounds), LocationPanel.jsx
Guérison (blessure)	Évolution périodique (jours/semaines) d'une blessure Moyenne+ vers une gravité inférieure. Résolue par le MJ à sa discrétion (3 issues : Amélioration / Échec / Catastrophe) — jamais un jet serveur.	wound_healing_check (shared/echeanceTypeRegistry.js), woundEvolutionService.js. Autorité : docs/PLANS/PLAN_BLESSURES_GUERISON.md §3.2
Infection (blessure)	Test de Constitution périodique (tous les 2 jours) contre l'aggravation d'une blessure non soignée (à partir de Moyenne), malus cumulatif par période sans soin. Garde un vrai jet (auto ou joueur), contrairement à la Guérison.	wound_infection_check (shared/echeanceTypeRegistry.js), woundEvolutionService.js. Autorité : docs/PLANS/PLAN_BLESSURES_GUERISON.md §3.3
Concepts Enclume

Concepts n'existant pas dans Polaris mais créés par le projet.
Concept	Description	Implémentation
Coffre (compte)	Espace de stockage hors campagne, transfert = copie jamais déplacement. Jamais "Vault" UI	vaultService.js
Coffre (conteneur inventaire)	Ambiguïté de nom avec "Coffre (compte)" ci-dessus — concept distinct sans rapport : valeur de `char_inventory.container` pour un objet du même personnage rangé hors du Sac/de la Ceinture portés (stockage distant mais toujours dans cette fiche). Transfert = déplacement (mutation du champ `container`), jamais une copie.	char_inventory.container, InventoryPanel.jsx, docs/Old/PLAN_INVENTORY_UX.md
reconcileCreation	Endpoint unique et idempotent du Wizard	creationService.js
wizard_locked_at	Bascule fiche assistant → fiche runtime	char_sheet.wizard_locked_at
Verrou (Wizard collaboratif)	Gel d'une option par le MJ pendant la création	wizard_locks
Pool de personnages	Écran MJ listant les personnages en création	docs/PLAN_WIZARDCOLLAB.md
Actions Exclusives (registre)	Pattern pour une action interdisant toute autre action le même tour	shared/combatExclusiveActions.js
DSL effets munitions	Syntaxe TYPE=ACTION(VALEUR) pour les effets de munitions	ref_equipment.ammo_effects
Échange (PJ↔PJ)	Déplacement d'item entre personnages de joueurs différents, double validation	tradeService.js
Charge électrique	Munition générique pour armes à batterie sans calibre réel	docs/PLAN_CAC_BATTERIE.md
Vocabulaire d'effets (effects[])	Taxonomie JSONB commune pour les conséquences mécaniques	shared/careerAdvantages.js, shared/setbackEffects.js
Provenance des octrois	Colonne distinguant l'origine d'un octroi (creation_step5, campaign, revers…)	char_advantages.acquired_during, char_mutations.source
Transaction optionnelle (trxOpt)	Patron de fonction pouvant s'insérer dans une transaction existante	mutationService.addMutation
Carte 2D	Battlemap rendue à plat (caméra orthographique)	battlemaps.render_mode
token_style	Apparence du token 2D (forme, cadrage, bordure)	characters.token_style
Horloge de campagne	Compteur de temps de jeu en minutes, ajusté par le MJ	gameTimeService.js
Fatigue (Compteur de Fatigue)	État gradué avec malus aux Tests	fatigueService.js
Froid (tranche/exposition)	Danger environnemental avec cadence de Tests	coldExposureService.js
Surface data	Document surface_data v12 décrivant les salles, murs, sols, plafonds, escaliers et connecteurs. Source de vérité de l'éditeur de surface.	shared/world/surfaceDocument.js (validation serveur), client/src/lib/surfaceData.js (manipulation client). Autorité : docs/SYSTEME/SURFACES_SALLES.md.
Connecteur	Élément structurel lié à une salle : porte, échelle, ascenseur. Stocké dans surface_data.connectors. À ne pas confondre avec une entité libre.	surface_data.connectors, client/src/lib/surfaceData.js (création), docs/SYSTEME/SURFACES_SALLES.md.
Blueprint (entité)	Modèle 3D définissant l'apparence et les propriétés d'une entité libre (géométrie, textures, GLB, interactions). Les blueprints sont créés dans l'Atelier GM ou proviennent des modèles intégrés.	entity_blueprints table, entityStore.blueprints. Autorité : docs/SYSTEME/ENTITES.md.
worldId	UUID stable attribué à chaque feature de surface_data (salle, sol, mur, connecteur). Persiste à travers les sauvegardes et les renommages. Indispensable pour lier un état runtime (porte ouverte, ascenseur) à sa définition.	Backfill au premier PUT surface. Autorité : docs/SYSTEME/MOTEUR_MONDE.md.
displayLevel	Niveau d'étage actuellement affiché dans l'éditeur. Contrôle la visibilité des éléments : seuls les niveaux ≤ displayLevel sont rendus, sauf le volume multi-hauteur de la salle active.	yToLevel(), levelToY() dans surfaceData.js. Autorité : docs/SYSTEME/SURFACES_SALLES.md.
runtime_revision	Compteur incrémenté à chaque modification de l'état runtime (déplacement de token, ouverture de porte, création d'entité). Invalide le cache du snapshot physique.	battlemaps.runtime_revision. Autorité : docs/SYSTEME/MOTEUR_MONDE.md §2.8.
entityStore	Store Zustand gérant les instances d'entités (entities[]) et les blueprints (blueprints{}). Les blueprints sont accumulés et jamais vidés entre les cartes.	useEntityStore. Autorité : docs/SYSTEME/CORE.md.
surfaceDocument (serveur)	Module de validation et normalisation du document surface_data côté serveur. Rejette les champs obsolètes, normalise la version, injecte les worldId manquants.	shared/world/surfaceDocument.js. Autorité : docs/SYSTEME/SURFACES_SALLES.md.
Éditeur de monde (world builder)	Ensemble des outils permettant au MJ de construire des cartes 3D : édition de surfaces (salles, murs, connecteurs), pose d'entités libres, édition voxel legacy.	Orchestré par Editor3D.jsx. Documents de référence : SURFACES_SALLES.md, ENTITES.md, EDITEUR.md.
Canal (chat)	Sous-espace de discussion persistant à l'intérieur d'une campagne. V1 : `general` (broadcast room) et `whisper` (privé, filtré par destinataire) ; pas encore choisi par l'utilisateur en UI, pas de canaux additionnels.	chat_messages.channel_id. Autorité : docs/PLANS/PLAN_CHAT.md.
Type de message (chat)	Discriminant du contenu d'un message persisté (TEXT, DICE, WHISPER, COMBAT_DAMAGE, SYSTEM_JOIN…) — distinct du canal, sert au rendu client (MessageRendererRegistry).	chat_messages.type. Autorité : docs/PLANS/PLAN_CHAT.md.
Whisper (message privé)	Message chat de type WHISPER, visible uniquement de l'expéditeur et du destinataire (`recipient_user_id`), jamais broadcast à la room de campagne. Persisté comme les autres messages.	chat_messages.recipient_user_id, server/src/chat/socketChat.js. Autorité : docs/PLANS/PLAN_CHAT.md.
Conventions de nommage

(… section inchangée …)
Pièges historiques

(… section inchangée …)
Ambiguïtés connues

(… section inchangée …)
Acronymes
Acronyme	Signification
LdB	Livre de Base Polaris
PJ / PNJ	Personnage Joueur / Non-Joueur
MJ / GM	Meneur de Jeu / Game Master
CaC / CC	Corps à corps / Coup par coup
NA / AN	Niveau Actuel / Niveau de Base (attribut)
PC	Points de Compétence / Points de Carrière
SR	Serveur Redémarré (sans erreur)
FEAT / COM / OPT / ADV / EQSKILLS / WIZ / DOC	Préfixes d'identifiants de dette/feature
PE14	Convention de coordonnées interne : pos_x = X Three.js, pos_y = Z Three.js (profondeur), pos_z = Y Three.js (altitude). Utilisée dans tous les événements WS, les routes API et la base de données.