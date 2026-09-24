VOCABULARY.md — Contrat sémantique officiel d'Enclume

    Version : V3.0 — 2026-09-24 : ajout « Protecteur d'interposition (drone) », « Interposition »
    et « Rayon de visée de protection (grenade) » (chantier `docs/PLANS/PLAN_DRONE_INTERCEPTION.md`, Lots 1-2 en production).
    Précédent : V2.9 — 2026-09-16 : ajout « Décal (motif procédural) vs Décoration murale placée »
    (Ambiguïtés connues) — chevauchement apparent `PLAN_RW_MATERIAUX.md` Lot 3 / `PLAN_DECALS.md`
    résolu (deux concepts complémentaires, pas un doublon). **Restauration** : les sections
    Conventions de nommage / Pièges historiques / Ambiguïtés connues, réduites à un placeholder
    `(… section inchangée …)` par la réorganisation du 2026-08-04 (contenu perdu six semaines sans
    être remarqué), retrouvées via `git show 4f3027e~1` et réintégrées — non revérifiées contre le
    code actuel au-delà de la nouvelle entrée « Décal ».
    Précédent : V2.8 — 2026-09-11 : ajout « Chance (score/réserve) » — RAW fourni par Saar, cadrage
    terminé (`docs/PLANS/PLAN_CHANCE.md` v2.0, `docs/MANUELS/MANUEL_CHANCE.md` v1.0), rien codé.
    Corrige au passage l'ambiguïté `chance` vs `chc` répétée dans plusieurs docs avant ce chantier.
    Précédent : V2.7 — 2026-09-08 : ajout du cluster « Usure & Intégrité du matériel » (Intégrité du
    matériel, Niveau Technologique (NT), Qualité, Test de panne, Panne) — concepts RAW, rien codé
    (cadrage `docs/MANUELS/MANUEL_USURE.md` ; PLAN technique à écrire ; MANUEL en cours de révision
    v1.3 sur la définition de Catastrophe et deux décisions de périmètre).
    Précédent : V2.6 — 2026-08-28 : ajout "Tir / Corps à corps · Distance / Contact (terminologie
    combat)" — décision de refonte des fenêtres de déclaration (`docs/Old/PLAN_RW_DECLARE_DESIGN.md`, clos 2026-08-30).
    Précédent : V2.5 — 2026-08-26 : ajout "Zone d'effet (AOE)" (nouveau concept, cadrage `docs/SYSTEME/
    AOE.md` v1, rien codé). Avant : V2.4, même jour (analyse à charge post-audit) : "Source
    exclusive (catalogue équipement)" corrigée (décrivait le catalogue dual ref_exo_equipment, fusionné
    depuis dans ref_equipment) ; "Type de message (chat)" corrigée (chat_messages.type = TEXT/WHISPER
    seulement, pas les types éphémères DICE/COMBAT_DAMAGE/SYSTEM_JOIN). Avant : V2.3, enrichi session
    2026-08-12 (Ticket, Cluster (ticket), autorité TICKETS.md)

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
Mort (statut)	Statut de token `dead` : le personnage est mort. Posé et retiré par le MJ seul (jamais par un joueur, quelle que soit l'option de campagne) ; le token est passé automatiquement (jamais de fenêtre d'action), sans défense, et devient un cadavre. À ne pas confondre avec « Mort subite » (6ᵉ ligne du compteur de blessures, chantier PLAN_BLESSURE_SIXIEME_LIGNE) qui le posera automatiquement.	token_statuses.status_code = 'dead', shared/tokenStatusRegistry.js (`isDeath`), docs/SYSTEME/STATUTS_TOKEN.md
Cadavre	Personnage dont un token porte le statut `dead`. Règle de table : il reste là et continue de prendre des blessures (des technologies de résurrection existent), mais ne peut ni esquiver ni dépenser de Chance, ne fait pas de test de Choc et ne reçoit pas d'état de corps vivant. Le MJ reste libre de tout lui poser à la main.	deathStateService.js (`isCharacterDead`), docs/SYSTEME/STATUTS_TOKEN.md §6
État de corps vivant	Statut qui décrit un corps qui fonctionne (bouger, garder l'équilibre, être conscient, respirer, voir, thermorégulation) : Entravé, Déséquilibré, Étourdi, Inconscient, Asphyxie, Aveuglé, Hypothermie, Évanoui. Interdit sur un cadavre et retiré à la mort ; les processus qui agissent sur un corps (feu, acide, radiation, électricité, poison, infection, décompression) et la saisie restent possibles.	registre `incompatibleWithDeath`, DEATH_INCOMPATIBLE_STATUS_CODES, statusService.js (`applyDeathConsequences`)
Exo-armure	Engin humanoïde mécanisé lourd (véhicule à part entière RAW, pas une armure de protection classique). 9 catégories de gabarit (exo-alpha à exo-oméga) et 6 milieux (sous-marine, Surface, hybride, atmosphérique, spatiale, industrielle). 3 éléments avec Intégrité propre : Structure, Exosquelette, Générateur. À ne pas confondre avec un drone (autonome) : une exo-armure dépend structurellement d'un pilote humain.	characters.type='exo', exo_sheet, ref_exo_templates. Autorité : docs/REGLES/REGLEARMURE.md, docs/PLANS/PLAN_EXOARMURE.md
Pilote (exo-armure)	Personnage (pj/pnj) aux commandes d'une exo-armure — lien dynamique et simple, pas une FSM embarquer/débarquer. Un personnage ne pilote jamais plus d'une exo-armure à la fois ; le pilote a les mêmes droits de modification que le propriétaire sur la fiche qu'il pilote.	exo_sheet.pilot_character_id (index unique partiel), exoIsGmOrOwnerOrPilot (char-sheet.js). Autorité : docs/PLANS/PLAN_EXOARMURE.md §1.3, §6.3
Exo-Force (EXF)	Équivalent Force d'une exo-armure — dérivée de base_exoforce du modèle, modulée par l'Intégrité de l'Exosquelette ET du Générateur (deux facteurs multipliés, un seul plancher combiné, pas deux arrondis successifs). Remplace entièrement la FOR du pilote pour les dégâts au contact et la capacité de port pendant qu'il pilote — mais pas les Tests d'Attribut testant directement la FOR, qui restent ceux du pilote.	computeExoStats (shared/exoStats.js), exo_sheet.base_exoforce. Autorité : docs/MANUELS/MANUEL_EXOARMURE.md §4.1/§4.8, docs/SYSTEME/EXOARMURE.md
Intégrité (composant exo-armure)	3 jauges indépendantes (Structure, Exosquelette, Générateur) sur une exo-armure, chacune max/current propre — distinct de l'Intégrité d'un ordinateur embarqué ou d'un système/arme individuel, qui ont chacun leur propre jauge. Structure dégradée réduit le Blindage effectif ; Exosquelette dégradé réduit l'EXF ; Générateur dégradé réduit l'EXF et devrait isoler des systèmes (règle écrite, pas encore codée).	exo_sheet.itg_structure/exosquelette/generator_max/current, computeExoStats. Autorité : docs/MANUELS/MANUEL_EXOARMURE.md §2.3/§4.8
Protecteur d'interposition (drone)	Drone équipé du programme `interception` lié à un ou plusieurs personnages qu'il protège (Protégés : joueur, PNJ ou exo-armure — l'exo protège déjà son pilote). Lien persistant porté par le drone, hors combat ; réaction, pas action de Tour (aucune déclaration). Ne pas confondre avec l'interception géométrique de la LOS (un token sur la ligne de tir redirige le tir sans Test) ni avec le programme `esquive`	drone_interception_targets ; shared/droneInterception.js ; docs/SYSTEME/COMBAT.md « Drone d'interception »
Interposition	Geste d'un protecteur qui réussit son Test d'Interception ET fait une marge strictement supérieure à celle de l'attaque : il encaisse le tir à la place du protégé, ou, contre une grenade, la reçoit à ses pieds et absorbe la moitié des dommages bruts de l'explosion. Le drone se déplace dès qu'il tente, jamais sur un tir raté ni au corps à corps	server/src/lib/droneInterceptionService.js
Rayon de visée de protection (grenade)	Distance maximale (1,5 m au départ, réglable) entre le point visé par une grenade et un protégé pour que la grenade compte comme le visant — règle maison, le RAW ne dit rien de la précision de visée	shared/droneInterception.js (GRENADE_PROTECTION_AIM_RADIUS_M)
Avarie	Incident cumulatif causé par des dégâts nets suffisants sur une exo-armure — équivalent RAW d'une Blessure côté humain, mécanique et code séparés (coïncidence de seuils numériques, pas un couplage). 6 paliers (légère à destruction) ; le compteur du palier atteint cascade vers le palier supérieur s'il est déjà plein, même logique de principe que resolveWoundInsertion côté humain.	exo_sheet.avaries_*, exoAvarieService.js, shared/exoConstants.js#EXO_AVARIE_TABLE. Autorité : docs/MANUELS/MANUEL_EXOARMURE.md §2.4/§4.7
Manœuvre d'armure	Compétence RAW spécialisée par milieu (sous-marine/surface/hybride/atmosphérique/spatiale) qui teste la capacité du pilote à manier son exo-armure ; plafonne aussi la Compétence de contact utilisée en Corps à Corps ("Compétence limitative").	resolveManeuverSkillId (combatantContextService.js). Autorité : docs/REGLES/REGLECOMPETENCE.md, docs/MANUELS/MANUEL_EXOARMURE.md §4.2
Source exclusive (catalogue équipement)	**Corrigé (2026-08-26)** — cette entrée décrivait un catalogue dual (`ref_exo_equipment` séparé de `ref_equipment`) qui n'existe plus : la table `ref_exo_equipment` a été fusionnée dans `ref_equipment` (`family='Exo-arme'/'Exo-systeme'`, `docs/Old/PLAN_EXOEQ_FUSION.md`). Le patron réel aujourd'hui : une ligne d'équipement exo (modèle ou instance) référence `ref_equipment_id` (catalogue général, y compris les familles exo), **ou** porte un `label_override` texte libre pour un objet inventé — plus de second catalogue à exclure mutuellement. Contrainte CHECK toujours en base (un des deux champs renseigné). Un `label_override` peut coexister avec `ref_equipment_id` comme annotation d'affichage (ex. "SACEA (secours)").	`ref_equipment_id`/`label_override` (`ref_exo_template_equipment`, `exo_systems`, `exo_weapons`). Autorité : `docs/SYSTEME/EXOARMURE.md` §1/§2bis
Zone d'effet (AOE)	Ajouté 2026-08-26, v2 le même jour (reclassement doc). Mécanisme transversal de résolution d'une attaque/d'un pouvoir touchant plusieurs cibles à la fois (cône, cercle/sphère, couloir), par opposition à une attaque cible unique. Couvre 4 patrons RAW distincts (fusil à pompe, lance-flammes, grenades/mines, tir de suppression) plus la majorité des pouvoirs Force Polaris — chacun avec sa propre table de dégression par distance, jamais une seule formule générique. Implémentation en cours (géométrie + requête spatiale + LOS codées et testées, branchement combat en pause).	`shared/world/aoeShapes.js`, `shared/world/distanceBands.js`, `worldSpatialQueryService.js#queryTokensInShape`, `worldVisibilityService.js#evaluateAoeVisibility`, migration `317_combat_action_targets` (appliquée). Autorité : `docs/PLANS/PLAN_AOE.md` §12 (avancement réel)
Tir / Corps à corps · Distance / Contact (terminologie combat)	Libellés joueur canoniques des deux actions d'attaque et des deux catégories d'arme. « Tir » = action de Combat à distance (LdB p.226) ; « Corps à corps » = action de Combat au contact (LdB p.223). « Distance » / « Contact » = les deux catégories d'arme (colonnes du tableau de localisation des dommages RAW ; `ref_category='Arme de contact'` en base). Proscrits en UI : « Assaut » (ancien libellé maison) et « Mêlée » (import hors RAW). Les identifiants de code `action_key='assault'` / `'melee'` restent inchangés — seul l'affichage suit cette terminologie.	`ACTION_LABELS` (combatSections.js), `combat.json` ; `ref_equipment.ref_category` ; `shared/combatRange.js`. Autorité : `docs/SYSTEME/COMBAT.md` (chantier clos, plan archivé `docs/Old/`)
Intégrité (ITG) du matériel	Mesure sur 25 de l'état général et de la fiabilité d'**une pièce d'équipement individuelle** (arme, outil, ordinateur…). Deux valeurs : **ITG courante** (état à l'instant) et **ITG max** (potentiel maximal, plafonné par la Qualité de fabrication). Baisse *temporaire* sur dommages ou pannes (récupérable par réparation, sans jamais dépasser l'ITG max) ou *définitive* sur changement de palier d'état, perte ≥ 5 en une seule fois, ou usure naturelle (jamais récupérable, abaisse l'ITG max). Six paliers d'état, avec effet mécanique : 21‑25 Excellent (+2 aux Tests), 16‑20 Bon (0), 11‑15 Moyen (0), 6‑10 Usagé (−3), 1‑5 Endommagé (−5), 0 Hors d'usage. Éligibilité d'un objet portée par un flag catalogue **désactivé par défaut**, activé au cas par cas par le MJ (règle RAW explicitement optionnelle). Distinct de l'**Intégrité (composant exo-armure)** ci-dessus : l'exo porte 3 jauges séparées (Structure / Exosquelette / Générateur) aux règles propres ; le matériel = une jauge par objet, chapitre Équipement du RAW.	`has_integrity` / `integrity_current` / `integrity_max` (`char_inventory`, `ref_equipment`) — **proposé, non codé**. Autorité : `docs/REGLES/REGLE_USURE&INTEGRITE.md` (RAW), `docs/MANUELS/MANUEL_USURE.md`
Niveau Technologique (NT)	Degré de maturité technologique d'un équipement ou d'un matériau, de **NT I** (technologie dépassée) à **NT VII** (technologie inconnue) ; **NT III** = niveau standard de l'univers Polaris, **NT V** = azuréen, **NT VI** = généticien connu. Détermine le coût, la rareté, et surtout le **malus aux Tests de réparation et d'entretien** : NT V → −5, NT VI → −7. Une société d'un NT donné produit à son NT ou en dessous, jamais au-dessus.	`ref_equipment.tech_level` (colonne existante, migration 48). Autorité : `docs/REGLES/REGLE_USURE&INTEGRITE.md`
Qualité (fabrication d'équipement)	Niveau de facture d'un **modèle** d'équipement : Bas coût / Bon marché / Standard / Bonne qualité / Excellente. Fixe l'**ITG max absolue** (5 / 10 / 15 / 20 / 25) et la formule d'**ITG à l'achat d'occasion** (marché légal : 1D4+1 … 3D6+5), et modifie le prix et la Disponibilité. Distinct de l'**ITG courante**, qui est l'état à un instant donné et varie ensuite avec l'usage. Un achat neuf (marché noir) démarre à l'ITG max de la Qualité.	Champ de qualité sur `ref_equipment` — **proposé, non codé**. Autorité : `docs/REGLES/REGLE_USURE&INTEGRITE.md` (2ᵉ extrait « Intégrité et qualité »), `docs/MANUELS/MANUEL_USURE.md` §3
Test de panne	Jet de **fiabilité pure** : 1D20 comparé à l'**ITG courante** de l'objet, **sans aucun modificateur** (ni compétence, ni attribut, ni bonus d'état). Réussite (`roll ≤ ITG`) → rien. Échec (`roll > ITG`) → l'objet perd 1 point d'ITG et cesse de fonctionner (**panne simple**). **Catastrophe** = échec avec Marge d'échec ≥ 15 (définition unique `shared/polarisTestResolution.js`, jamais « 1 naturel ») → −1D6 ITG + **panne critique**. Déclenché par : une Catastrophe sur un Test utilisant l'objet (**jamais** si ITG 21‑25), une attaque IEM (objets `is_electronic` portés sur soi), un échec simple quand ITG ≤ 5, ou un déclenchement manuel du MJ (usage intensif ou non conventionnel). Jet unique — ne consomme pas la mécanique de retest sur 20 des Tests ordinaires.	**proposé, non codé** — s'appuiera sur `resolveTestOutcome` (`shared/polarisTestResolution.js`). Autorité : `docs/REGLES/REGLE_USURE&INTEGRITE.md`, `docs/MANUELS/MANUEL_USURE.md` §4
Panne (état de fonctionnement)	État de service d'un objet soumis à l'Intégrité : **opérationnel**, **panne simple** (réparable par un Test avec la Compétence liée à l'usage — Armes de poing, Informatique… — ou un Test d'Intelligence à défaut) ou **panne critique** (nécessite un technicien expert *et* un atelier/laboratoire spécialisé). Distinct de l'ITG : un objet peut être en panne avec une ITG élevée, ou fonctionnel à ITG basse (en subissant le malus d'état).	`malfunction_severity` : `NULL` / `'simple'` / `'critical'` — **proposé, non codé**. Autorité : `docs/MANUELS/MANUEL_USURE.md` §4.4
Chance (score/réserve)	Attribut secondaire sur 20 représentant **à la fois** le niveau de Chance d'un personnage et sa réserve dépensable — il n'existe **pas** de pool séparé (piège déjà rencontré : plusieurs docs ont affirmé « aucune colonne Chance en base », le grep cherchait `chance` au lieu de `chc`). Dépenser de la Chance décrémente directement le score jusqu'à un plancher de 3 ; regagner l'incrémente jusqu'à un plafond de 20. Un **Test de Chance** (`1D20 ≤ chc + modificateur`) est toujours gratuit ; seule une **dépense volontaire** (forçage d'un Test, réduction de gravité d'une Blessure, Indice) coûte 1-2 points. Même primitive que les Tests de Chance combat déjà transcrits (barrage, AOE longue/extrême, `REGLESYSCOMBAT.md`).	`char_sheet.chc` — score existant (migration 22), geste de dépense/régénération **proposé, non codé**. Autorité : `docs/REGLES/REGLE_CHANCE.md`, `docs/MANUELS/MANUEL_CHANCE.md`

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
Échange (PJ↔PJ)	Déplacement d'item entre personnages de joueurs différents, double validation. Couvre aussi le transfert direct sans double validation vers un drone dont le PJ est seul propriétaire.	tradeService.js. Autorité : docs/SYSTEME/TRADE.md.
Marchand	Entité de campagne (créée par le MJ) exposant un catalogue filtré (seuils NT/niveau/génération/rareté + règles FAM/CAT/ITEM) et un modificateur de prix. Distinct du domaine « Trade » qui le contient.	table merchants, tradeService.js. Autorité : docs/SYSTEME/TRADE.md.
Revente (PJ→GM)	Proposition de vente d'objets par un PJ à un marchand ; le MJ accepte, refuse ou fait une contre-offre. Distincte de l'Échange PJ↔PJ (destinataire = MJ, pas un autre PJ).	trade_offers.type='SELL', tradeService.js. Autorité : docs/SYSTEME/TRADE.md.
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
Type de message (chat)	**Corrigé (2026-08-26)** — `chat_messages.type` (texte persisté en base) ne prend que 2 valeurs en V1 : `TEXT`/`WHISPER`. `DICE`, `COMBAT_DAMAGE`, `SYSTEM_JOIN`... ne sont **jamais** des valeurs de cette colonne — ce sont des types de messages éphémères (dés, actions entité, combat, système), jamais persistés, routés par les mécanismes historiques et distingués côté client par `MessageRendererRegistry` sur d'autres champs (`interactionType`, `system`...), pas par `chat_messages.type`. Distinct du canal.	`chat_messages.type` (persisté, TEXT/WHISPER) vs discriminants client des types éphémères. Autorité : `docs/SYSTEME/CHAT.md`.
Whisper (message privé)	Message chat de type WHISPER, visible uniquement de l'expéditeur et du destinataire (`recipient_user_id`), jamais broadcast à la room de campagne. Persisté comme les autres messages.	chat_messages.recipient_user_id, server/src/chat/socketChat.js. Autorité : docs/PLANS/PLAN_CHAT.md.
Administrateur (rôle)	Rôle global d'un compte (`users.role`, 'user'/'admin'), distinct du rôle par campagne (`campaign_members.role`, gm/player). Donne accès aux outils d'administration (page /admin, catalogue équipement, santé serveur, gestion des utilisateurs). Promu via `ADMIN_BOOTSTRAP_EMAIL` (bootstrap, une valeur par instance) ou par un autre administrateur. Pas d'historique des promotions/rétrogradations — état courant seulement, avec provenance du dernier changement (`role_granted_by`/`role_granted_at`).	users.role, server/src/middleware/requireAdmin.js, server/src/lib/bootstrapAdmin.js. Autorité : docs/SYSTEME/ADMIN.md.
Ticket	Signalement d'un bug, d'un déséquilibre de règle ou d'une suggestion, par un compte joueur/MJ/admin (`origin`, calculé serveur, jamais déclaré par le client) ou par un mécanisme automatique (`origin='log'`, non construit à ce jour). Remplace l'ancien registre manuel `docs/BUGIDENTIFIE.md` (archivé) — priorité et sévérité sont posées par l'admin au triage, jamais par le rapporteur.	bug_tickets, server/src/services/ticketService.js. Autorité : docs/SYSTEME/TICKETS.md.
Cluster (ticket)	Regroupement manuel de tickets à cause racine identique ou proche, porté par un champ texte libre (`cluster_label`), pas une table de référence. Reprend le mot et la logique de l'ancien regroupement `BUGIDENTIFIE.md` ("Cluster A"…"Cluster U"), qui reste la référence historique pour les tickets importés (`linked_bug_code`).	bug_tickets.cluster_label. Autorité : docs/SYSTEME/TICKETS.md.
Conventions de nommage

Détail complet → `.claude/rules/conventions.md` + `docs/SYSTEME/CONVENTIONS.md` (ne pas dupliquer ici).
Database : tables/colonnes en snake_case, migrations numérotées séquentiellement (server/src/db/migrations/).
Backend : routes/*.js (HTTP) → services/*Service.js (logique) → db (knex). Events WebSocket définis une seule fois dans shared/events.js.
Frontend : composants PascalCase.jsx. State inter-étapes/inter-composants → Zustand (jamais de state local dupliqué quand un store existe).
WebSocket : constantes SCREAMING_SNAKE_CASE dans shared/events.js — vérifier existence avant de créer un nouvel event.

Pièges historiques

> **Restauré 2026-09-16** — ces deux sections avaient été remplacées par un placeholder
> `(… section inchangée …)` lors de la réorganisation documentaire du 2026-08-04 (`git blame` :
> commit `4f3027e`), contenu perdu pendant six semaines sans que rien ne le signale. Contenu
> récupéré depuis `git show 4f3027e~1:docs/VOCABULARY.md` — **non revérifié contre le code actuel**,
> traiter chaque ligne comme un `[HYPOTHÈSE]` à confirmer si elle redevient pertinente, pas comme un
> `[VÉRIFIÉ]` d'aujourd'hui.

Ancien	Officiel	Pourquoi
token.owner_id	token.character_id → characters.user_id	owner_id n'a jamais été la bonne chaîne de résolution — voir P1 (CLAUDE.md).
char_advantages V1 (texte libre, pré-migration 99)	char_advantages V2 (FK catalogue ref_advantages)	Schéma strict depuis migration 99 — tout code lisant adv.label/adv.level lit des champs V1 inexistants en V2.
ref_equipment_skills	ref_equipment_skill_assoc	Tables jumelles au schéma identique, rôles différents — voir Ambiguïtés connues ci-dessous. Ne jamais les confondre lors d'une requête combat.
active_slot_idx / advanceSlot / COMBAT_SLOT_ADVANCED en Résolution	combat_timeline_entries / advanceTimeline / COMBAT_TIMELINE_UPDATED	Colonne et fonction retirées (migration 174) — la Résolution parcourt l'échelle de phases, plus une liste combat_roster triée. COMBAT_SLOT_ADVANCED reste émis, mais uniquement en phase ANNONCE.
Sous-état FSM AWAITING_REACTION_WINDOW (minuteur, Retarder son Action)	Borne de position sur SLOT_ACTIVE (triggerActNow)	Ajouté puis retiré la même session — RAW ne prévoit aucun minuteur pour Retarder ; source de bugs réels avant son retrait. Ne pas réimplémenter.

Ambiguïtés connues

Nom	Ne pas confondre avec	Explication
ref_equipment_skill_assoc	ref_equipment_skills	_assoc = compétence d'utilisation pour résoudre un Test de combat (bien vivante). ref_equipment_skills = compétences boostées/requises par un accessoire (jamais consommée en jeu).
Tir visé	Localisation précise (COM9) / Changer le mode de tir	Trois mécaniques distinctes de REGLESYSCOMBAT.md, jamais la même règle malgré la proximité des pages.
« Seuil » (UI)	« CDR » (interne)	Même valeur, deux noms selon l'audience — ne jamais afficher « CDR » à un joueur.
Vault (nom de code)	Coffre (nom produit)	Le code/DB garde vault*, tout texte utilisateur dit « Coffre ».
« Coma »	« Inconscient » (statut réel)	Synonyme informel, pas un 3ᵉ état santé — « Inconscient » est le statut `unconscious` ; le vocabulaire complet des statuts de token est le registre `shared/tokenStatusRegistry.js` (docs/SYSTEME/STATUTS_TOKEN.md).
PLAN (dossier docs/)	DOMAIN/SYSTEM (docs/SYSTEME/)	Un PLAN est temporaire (Règle 10) : une fois le chantier clos, archiver vers docs/Old/ — la doc durable vit dans docs/SYSTEME/*.md/.claude/rules/, pas dans le PLAN.
Échange (PJ↔PJ)	Transfert (Coffre→campagne)	Échange (tradeService.js) = déplacement réel entre personnages vivants, double validation, jamais de copie. Transfert (vaultService.js) = copie Coffre→campagne, jamais de déplacement, validation MJ seule.
ref_setbacks / « setback » (code)	Revers (UI/joueur)	Même mécanique, deux noms selon l'audience — comme Vault/Coffre. Le code et la base gardent l'anglais « setback », tout texte utilisateur dit « Revers ».
Carte 2D	Spotlight	Une carte (2D ou 3D) montre le lieu où le groupe se trouve ; le Spotlight montre ponctuellement quelque chose en surimpression sans changer de lieu.
Décal (motif procédural de matériau)	Décoration murale placée (WallDecoration)	**Ajouté 2026-09-16**, chantiers `PLAN_RW_MATERIAUX.md` Lot 3 vs `PLAN_DECALS.md` — même mot, deux concepts indépendants et complémentaires. Le premier est une texture (câbles/rivets/grille) source d'un motif procédural appliqué à toute une surface, ou un masque d'usure/saleté — un ingrédient du pipeline de matériaux (`proceduralMaterials.js`, `PATTERN_PRESETS`). Le second est un objet décoratif ponctuel (affiche, tronçon de câble) posé à un endroit précis d'un mur, positionné indépendamment du matériau de base. Un mur peut avoir les deux à la fois : un motif de surface ET une décoration ponctuelle par-dessus. Ne jamais désigner l'un par le nom de l'autre dans le code ou la doc — proposer un terme distinct (ex. « Décoration murale ») si le mot seul « décal » reste ambigu à l'usage.

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