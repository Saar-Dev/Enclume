# PLAN — Drones : mode Autonome & Télépilotage

> Rédigé : 2026-09-16 — audit complet du code réel (lecture directe, pas de confiance dans les PLAN
> archivés). Remplace `docs/Old/PLAN_DRONE.md` et `docs/Old/PLAN_DRONESYSCOMBAT.md` comme référence de
> travail — ces deux fichiers restent archivés pour l'historique mais leur description de
> l'architecture de résolution (Session 159, échelle de phases) est **périmée**, ne pas s'y fier pour
> coder.
>
> **Sources RAW** : `docs/REGLES/REGLEDRONE.md` (LdB p.319-320 + Guide Technique) — programme de
> contrôle armement, mode autonome/télépiloté, Initiative. **Architecture actuelle, autorité** :
> `docs/SYSTEME/COMBAT.md` (§ « Découpage socketCombatHelpers.js », § « Armement drone », § « Échelle
> de phases »).
>
> **Statut** : Sprint 1 / 1bis / 2a / 2b / 2c **clos, vérifiés en code le 2026-09-16**. **Lot 0 clos et
> testé le 2026-09-17** (voir §4). Sprint 2d (mode autonome) et Sprint 3 (télépilotage) **non
> commencés** — seul reste réel du chantier.

---

## 1. Méthode de cet audit

Chaque case « fait » ci-dessous a été vérifiée par lecture directe du code et/ou requête sur la base
locale le 2026-09-16 — jamais déduite d'un PLAN archivé ou d'un souvenir de session. Les citations de
fichier:ligne datent de cet audit et peuvent dériver ; revérifier avant de s'y fier pour coder.

## 2. Ce qui est fait (vérifié)

### Sprint 1 / 1bis — Fiche drone + catalogue de programmes
Schéma actuel en base (colonnes réelles, `information_schema`) :
- `drone_sheet` : stats descriptives + intégrité/dommages + **`charge_utile`** (capacité de charge,
  ex. drone porte-charges — champ ajouté depuis, absent des deux PLAN archivés, aucune doc ne le
  couvre encore ailleurs).
- `drone_programs` : `category` déjà splitée `armement_contact` / `armement_distance` (migration
  archivée `76d_drone_programs_categories.js`), liée à `ref_equipment` ou `label_override`.
- `drone_weapons` : schéma **Option A** retenu (pas le schéma Sprint 1 d'origine) — `character_id`,
  `name`, `damage_formula`, `portee`, `fire_mode`, `notes`, `equipment_id` nullable.
- Client : `DroneWindow.jsx`, `DroneSheet.jsx`, `DroneWeaponPanel.jsx`, `DroneDeclareSection.jsx`
  existent et sont câblés.

### Sprint 2a — COMBAT_START
`socketCombatState.js:70-74` — branche `character.type === 'drone'` avant tout accès `char_sheet`,
`base_ini: 12` fixe (LdB p.320), `forcedNotSurprised: true`. Conforme au RAW et à l'ancien plan.

### Sprint 2b — Drone comme cible
`resolveDroneIntegrityLoss` (`socketCombatHelpers.js:3861`) câblé depuis Tir humanoïde/exo, CaC et
AOE (`socketCombatAoe.js:269`, `socketCombatHelpers.js:699/2010/2245/2950/3756`).
`resolveAttackHitDrone` et `resolveMeleeDefenseDrone` (`socketCombatExo.js:606`) existent pour les
deux types d'attaque. Bug historique `EXODRONE-CONFIRMDAMAGE-CRASH` (Tir exo/drone → PJ plantait
`confirmDamage`) **résolu** (statut `resolved` en base).

### Sprint 2c — Déclaration + résolution (manuelle)
Un drone se déclare **exactement comme un PJ/PNJ** : il occupe son propre tour dans l'ordre
ANNOUNCEMENT (`socketCombatAnnouncement.js:170-177`, tri par `base_ini`), doit être déclaré
explicitement par son propriétaire (`character.user_id === user.id`) ou le GM (`:149-151`) avant de
pouvoir agir. **Aucune automatisation actuellement — voir §4.**

`resolveDroneAssaultAction` (`socketCombatHelpers.js:2713`) gère Tir ET CaC drone :
- Dispatch Tir : redirect **interne** à `resolveAssaultAction` (`:3159-3160`, `character.type ===
  'drone'`) — même dette de dispatch déjà documentée `ROADMAP.md` §5, toujours vraie, pas retouchée
  ici.
- Dispatch CaC : redirect **externe** depuis `socketCombatResolution.js:538` (avant `resolveMeleeAction`).
- Type d'arme Tir/CaC dérivé de `ref_equipment.category === 'Arme de contact'`, jamais de `fire_mode`
  (fix `DRONE-CC-MELEE-MISCLASS` déjà en code, documenté `COMBAT.md` § « Armement drone »).
- Programme requis **strictement** par type (`armement_contact`/`armement_distance`, sans repli) —
  écart RAW connu, ticket ouvert `DRONE-ARMEMENT-PROGRAM-SPLIT` (ce n'est qu'UN programme « contrôle
  armement » par arme au LdB p.281).
- Choc d'arme câblé pour un tireur drone (Tir et CaC), depuis `PLAN_CHOC_EXO_DRONE.md` (archivé).

### Corrections apportées aux docs existantes par cet audit
`ROADMAP.md` §5 listait 2 bugs drone « trouvés en test 2026-08-28 » — **les deux sont en réalité déjà
corrigés en code**, vérifié 2026-09-16 :
1. `getCharacterMovementBudget` sans branche drone → **corrigé**, `getDroneMovementBudget` existe
   (`movementBudgetService.js:177-188`), lit `drone_sheet.vitesse` comme unique Allure
   (`buildDroneAllures`).
2. Bloc CaC de l'annonce sans branche `isDrone` → **corrigé**, `isDrone` gate désormais tout
   `socketCombatAnnouncement.js` (déclaration, garde arme en main, Tir Multi, etc.).

Ticket `DR2` (« Drone : déplacement absent ») reste `triaged` en base malgré le fix code — à repasser
`resolved` (script DB à lancer par Saar, hors périmètre de ce PLAN). Deux scripts de création de
ticket existent mais n'ont jamais été exécutés (absents de `bug_tickets` malgré un fix déjà documenté
dans `COMBAT.md`) : `create_ticket_drone_cc_melee_misclass.js` et
`create_ticket_drone_armement_program_split.js` — à lancer par Saar s'il veut les régulariser, hors
scope de ce PLAN.

## 3. Confirmé absent (zéro occurrence en code, recherche exhaustive)

- `resolveDroneAutoAction`, `acquired_target_token_id`, action_key d'auto-résolution — **Sprint 2d
  inexistant**. Confirmé indépendamment par `docs/SYSTEME/COMBAT.md:678` : le mode `'drone'` de
  détonation de grenade est « réservé structurellement par l'enum, rejeté à la résolution
  (sous-système "entité autonome en combat" non construit) » — même sous-système manquant.
- `state_control_mode`, `owner_character_id`, toute lecture de `TELEPILOTAGE` — **Sprint 3
  inexistant**, ni serveur ni client.
- La compétence `TELEPILOTAGE` existe déjà au catalogue (`ref_skills.id='TELEPILOTAGE'`, ADA/INT,
  marqueur `(-3)` réservée) — seul prérequis data du Sprint 3, déjà réglé.

## 4. Reste à faire

### Lot 0 — Centraliser l'avance de la file d'ANNONCE (préalable, avant tout code drone) — CLOS ET TESTÉ 2026-09-17

**Défaut d'architecture préexistant, indépendant du chantier drone, trouvé en cadrant le Sprint 2d**
(retour Saar : « est-ce que le fait qu'on doive intercepter un calcul à plusieurs endroits n'est pas un
défaut de l'architecture ? » — oui). Le bloc « trouver le prochain slot ANNONCE non déclaré (tri
`base_ini` ASC, `token_id` ASC) puis émettre `COMBAT_SLOT_ADVANCED` » est dupliqué **au moins 4 fois**,
identique ou quasi-identique :
- `combatTurnEngine.js` (`skipPlayer`, ~L113-126) — avec le test « tout annoncé → Résolution »
- `socketCombatAnnouncement.js` (handler `COMBAT_ACTION_DECLARE`, ~L995-1009) — **même bloc**, copié mot
  pour mot
- `combatTurnEngine.js` (`endTurn`, ~L711-718) — variante sans le test « tout annoncé »
- `socketCombatState.js` (`COMBAT_ANNOUNCE_START`, ~L389-396) — même variante
- + un 5ᵉ usage en lecture seule (`socketCombatAnnouncement.js:170-177`, garde « c'est ton tour »)
  interroge la même requête pour une question différente (peut réutiliser le même helper de lecture).

Ce n'est pas 4 besoins qui se ressemblent par coïncidence — c'est une seule opération conceptuelle
(« faire avancer la file d'ANNONCE ») jamais nommée. Le projet a déjà un précédent de bug né de ce
patron exact (`AWAITING_DAMAGE` écrasé, corrigé en réalignant 4 sites divergents — `COMBAT.md` §
dédiée). Centraliser maintenant sert la robustesse générale de l'ANNONCE **et** devient le point
d'extension nécessaire au Sprint 2d (voir plus bas) — pas un détour, la cause racine du besoin
technique du Sprint 2d passe par ce même point.

**Fix** : deux fonctions dans `combatTurnEngine.js` (déjà le foyer naturel — 2 des 4 sites y sont, les
2 autres importent déjà `startAnnouncementTimers`/`startResolutionPhase` depuis ce fichier) :
- `findNextAnnounceSlot(campaignId)` — la requête partagée, retourne l'entrée ou `null`.
- `advanceAnnouncementQueue(io, campaignId, pendingMaps)` — compte les non-annoncés ; `0` →
  `startResolutionPhase` ; sinon → `findNextAnnounceSlot` + émission `COMBAT_SLOT_ADVANCED`.

Remplacer les 4 sites dupliqués par des appels à ces deux fonctions ; le garde en lecture seule
(`socketCombatAnnouncement.js:170-177`) peut aussi appeler `findNextAnnounceSlot` au lieu de sa propre
requête. **Validation dédiée, avant tout branchement drone** : non-régression complète de l'ANNONCE
PJ/PNJ (déclaration normale, Passer MJ, timer auto-skip, fin de Tour) — commit séparé du reste du
Sprint 2d.

**Codé et vérifié 2026-09-17.** Un **6ᵉ site** a été trouvé en implémentant (pas dans le décompte
ci-dessus, découvert en relisant `socketCombatState.js` en entier avant de toucher au fichier) :
`COMBAT_SURPRISE_RESULT`, branche échec de Réaction (~L509-523) — posait `has_announced=true` (auto-skip
du personnage surpris) puis ne testait QUE le cas « plus personne à annoncer » (`count===0` →
Résolution), sans jamais émettre `COMBAT_SLOT_ADVANCED` pour le slot suivant dans le cas contraire. Bug
réel et silencieux (le slot affiché à la table restait bloqué sur le personnage déjà auto-passé côté
serveur jusqu'à ce qu'un autre événement rafraîchisse la file par coïncidence) — corrigé au même geste
en remplaçant par `advanceAnnouncementQueue`, même invariant que les 5 autres sites, même commit.

`findNextAnnounceSlot`/`advanceAnnouncementQueue` ajoutées dans `combatTurnEngine.js` ; les 6 sites
(`skipPlayer`, `endTurn`, `COMBAT_ACTION_DECLARE` déclaration + garde lecture seule dans
`socketCombatAnnouncement.js`, `COMBAT_ANNOUNCE_START` + `COMBAT_SURPRISE_RESULT` dans
`socketCombatState.js`) délèguent désormais à ces deux fonctions. `endTurn` et `COMBAT_ANNOUNCE_START`
appellent `advanceAnnouncementQueue` (pas juste `findNextAnnounceSlot`) — renforcement mineur assumé :
les deux basculent maintenant directement en RÉSOLUTION si le Tour entier est déjà pré-annoncé au
moment de l'appel (impossible aujourd'hui sans drone, mais exactement le point d'extension requis par
le cas « combat tout-drone en `ordres_permanents` » du Sprint 2d — voir plus bas). Tests non-régression
+ couverture des deux nouvelles fonctions ajoutés à `combatTurnEngine.test.mjs` (20/20 verts,
`node --env-file=.env --test server/src/socket/combatTurnEngine.test.mjs`) ; `node --check` propre sur
les 3 fichiers serveur touchés. Non commité — en attente de confirmation fonctionnelle de Saar (jeu réel)
avant `git add`/commit, comme toute clôture d'un comportement de combat.

### Sprint 2d — Mode autonome (LdB p.320, Guide Technique) — CADRAGE TERMINÉ 2026-09-16, prêt à coder sur validation Saar

RAW : « les drones autonomes n'ont pas d'Initiative, mais réagissent immédiatement » — séquence
Détection → [Ami/Ennemi] → Armement sans intervention MJ/joueur, retry -5 rangs d'Initiative sur échec
de Détection (12→7→2). **Actuellement aucun drone n'est autonome** : tous exigent la même déclaration
manuelle qu'un PNJ (§2 Sprint 2c).

**Divergence avec l'ancien plan archivé (`PLAN_DRONESYSCOMBAT.md` Sprint 2d) : l'architecture qu'il
suppose n'existe plus** (`combat_actions.sequence`, `advanceSlot`) — remplacée depuis (Session 159) par
`combat_timeline_entries`. Design ci-dessous entièrement redéfini contre l'architecture réelle.

#### Décision de fond — pourquoi un drone n'a jamais de « Passer » (révisé 2026-09-17, retour Saar)
Un PJ/PNJ « Passe » parce qu'il choisit de ne rien faire — c'est une vraie décision d'un agent
conscient, et le bouton `COMBAT_SKIP_PLAYER` (MJ uniquement, `if (!isGm) return`,
`socketCombatAnnouncement.js:1023`) n'est même pas offert à un joueur pour son propre PJ (personne n'a
de bouton « Passer mon tour » — on déclare toujours quelque chose, même vide). **Un programme
informatique n'a pas ce choix : il exécute sa programmation, point.** Accrocher l'autonome au mécanisme
« Passer » (design initial de ce cadrage, corrigé ci-dessous) était donc conceptuellement faux, en plus
de l'être en pratique pour un drone possédé par un joueur (qui n'a jamais accès à ce bouton).

#### Décision de fond — deux modes de tour, en option de campagne, figée à `COMBAT_START`
Nouvelle option de campagne **`drone_turn_model`** (`'classique'` | `'ordres_permanents'`), lue depuis
les réglages de campagne à `COMBAT_START` et **figée sur `combat_state`** pour toute la durée du
combat — même famille que les autres réglages gelés à l'ouverture d'un combat (`action_timer_sec` :
`socketCombatState.js`, lu une fois via `getCampaignSettings` puis réutilisé pour tout l'encombrement ;
mécanisme exact de persistance à reconfirmer au moment de coder). Modifiable entre deux combats,
jamais en cours de combat (retour Saar) — pas de bascule à chaud à gérer.

- **Mode `classique`** = **Sprint 2c tel qu'il existe déjà aujourd'hui, sans aucun changement, pour
  tout le monde (MJ et joueur propriétaire)**. Le drone occupe son slot ANNOUNCEMENT et attend une
  vraie déclaration (`DroneDeclareSection.jsx`, déjà câblé dans `CombatGmDeclareWindow.jsx` **et**
  `CombatActionWindow.jsx` — vérifié, un joueur a déjà accès à cette UI aujourd'hui). Si personne ne
  déclare, il ne se passe rien de spécial pour lui, exactement comme pour un PJ qu'on laisserait filer
  (timer auto-skip, ou MJ qui skip). **Zéro code nouveau au-delà du Lot 0.**
- **Mode `ordres_permanents`** = le drone ne bloque jamais la file d'ANNONCE et n'a jamais de « tour »
  à proprement parler — ci-dessous.

#### Mode `ordres_permanents` — donner des ordres à tout moment, exécution automatique au Tour
**Donner des ordres** (fixer/changer la cible surveillée) devient une action **libre, hors file
d'ANNONCE, à tout moment du combat** — nouvel événement léger `COMBAT_DRONE_SET_ORDERS { tokenId,
targetTokenId, droneWeaponInvId }`, gardé par la même autorisation que Sprint 2c
(`isGm || isOwner`), utilisable par le MJ **et** le joueur propriétaire de façon symétrique (pas de
distinction de rôle dans le mécanisme lui-même — seule l'autorisation existante s'applique). Met à
jour `combat_roster.acquired_target_token_id` (+ arme), sans consommer de déclaration ni de Tour.

**Exécuter les ordres** : grâce au Lot 0, un seul point d'accroche suffit — **le début de la phase
ANNOUNCEMENT**. À ce moment précis, pour chaque ligne `combat_roster` de type `drone` dans un combat où
`combat_state.drone_turn_model === 'ordres_permanents'` : poser immédiatement `has_announced = true`
et insérer l'action (`type: 'assault'`, `action_key: 'drone_auto'`) en utilisant les ordres en cours
(`target_token_id`/`drone_weapon_inv_id` résolus dynamiquement à la Résolution, comme avant). **Le
drone n'apparaît jamais dans la file des non-annoncés** — pas d'interception par slot nécessaire
(correction du design du 2026-09-16, plus simple que prévu), personne n'attend jamais sur lui, aucune
notion de « Passer » ne le concerne. S'il n'a aucune cible mémorisée, l'action posée ne produira
simplement aucun tir à la Résolution (RAW cohérent : sans consigne, le drone reste inerte).

**Séquencement exact des deux points d'accroche** (précisé 2026-09-17 — le point flou de la version
précédente) :
- **`COMBAT_ANNOUNCE_START`** : (1) pré-remplir tous les drones `ordres_permanents` (comme ci-dessus)
  → (2) appeler `advanceAnnouncementQueue` (Lot 0, pas juste « émettre le premier slot ») pour trouver
  le premier vrai participant restant, ou basculer directement en Résolution si personne ne reste
  (cas limite réel : un combat où tous les combattants sont des drones `ordres_permanents` doit passer
  d'ANNONCE à RÉSOLUTION sans qu'aucun humain ne déclare jamais rien — scénario de non-régression à
  tester explicitement).
- **`endTurn`** : l'ordre compte. (1) reset `has_announced=false` pour tout le monde (comportement déjà
  existant, inchangé) → (2) **re**-pré-remplir les drones `ordres_permanents` pour le **nouveau**
  `turn_number` (sinon ils resteraient à tort dans la file après le reset) → (3) `advanceAnnouncementQueue`.
  Faire (2) avant (3), jamais l'inverse — sinon le pré-remplissage écraserait le résultat d'un
  `advanceAnnouncementQueue` déjà émis pour ce nouveau Tour.

**Interaction avec le Sprint 3 (télépilotage)** : si le pilote télépilote ce Tour, l'action `drone_auto`
déjà pré-posée pour ce Tour doit être annulée au profit de la déclaration télépilotée — détail dans la
section Sprint 3 ci-dessous. Les ordres permanents eux-mêmes (`acquired_target_token_id`) ne sont
**jamais effacés** par une télépilotage ponctuelle — seule l'action de CE Tour est remplacée (« les
instructions sont juste oubliées/non applicables », retour Saar) ; le Tour suivant sans télépilotage,
le drone reprend ses ordres permanents normalement.

**`drone_targeting_mode` (`'assigne'` | `'spatial'`) ne s'applique QUE dans ce mode** — en `classique`,
c'est toujours un humain qui choisit la cible à la déclaration, la question ne se pose pas. Ce
sous-réglage garde son sens complet du cadrage du 2026-09-16 (ci-dessous, « Mode spatial ») — options
permanentes de campagne, même patron que `dice_config`/`status_effects_mode`.

**À expliquer clairement au MJ et au joueur propriétaire** (demande Saar) : en mode `assigne`, un
drone autonome ne choisit jamais sa cible tout seul, il continue de tirer sur la dernière cible
désignée tant qu'il la voit/l'a à portée ; en mode `spatial`, il choisit lui-même parmi les menaces
détectées.

#### Persistance de la cible — `acquired_target_token_id`
Nouvelle colonne `combat_roster.acquired_target_token_id UUID REFERENCES tokens(id) ON DELETE SET
NULL`, **persistante entre les tours d'un même combat, jamais entre deux combats** (confirmé Saar
2026-09-17 — décision intentionnelle, pas un oubli : `combat_roster` est recréé à chaque
`COMBAT_START`, donc les ordres repartent à zéro à chaque nouvelle rencontre, cohérent avec une
situation tactique qui change d'un combat à l'autre). Réinitialisée dans `endTurn` uniquement au sens
où elle est **relue** (jamais effacée) à chaque nouveau Tour pour le pré-remplissage — pas dans la même
famille que `state_position`/`state_weapon` sur ce point précis (ceux-là persistent aussi entre
combats via une autre table ; `acquired_target_token_id` non). Posée par `COMBAT_DRONE_SET_ORDERS`.

**Affichage requis, pas juste la commande pour la fixer** : le MJ et le joueur propriétaire doivent
voir la cible actuellement surveillée avant que le drone n'agisse, pas seulement pouvoir la changer à
l'aveugle. `DroneWindow.jsx`/`DroneDeclareSection.jsx` affichent le nom de la cible mémorisée (ou
« aucune ») en lecture, à côté du contrôle qui la modifie.

**Simplifications V1, avec leur V2 définie ci-dessous (§ « V2 différée ») — jamais un renoncement
silencieux** : un drone à plusieurs armes en autonome n'en utilise qu'une.

#### Résolution — `resolveDroneAutoAction` (nouvelle fonction, `socketCombatHelpers.js`)
Dispatchée depuis `socketCombatResolution.js` sur `action.action_key === 'drone_auto'` (nouvelle
branche, avant le dispatch `assault` générique). Boucle **en mémoire**, jusqu'à 3 tentatives (INI
12 → 7 → 2, option « a » de l'ancien plan — aucune ligne `combat_timeline_entries` supplémentaire) :
1. Résoudre `acquired_target_token_id` → token/character cible ; si le token n'existe plus (mort/
   retiré, `ON DELETE SET NULL` déjà passé) → fin immédiate, aucun tir (RAW : cible perdue).
2. Vérifier portée + LOS réelles — **correction post-cadrage (2026-09-16) : ne pas réinventer cette
   vérification**, `resolveDroneAssaultAction` (`socketCombatHelpers.js:2769-2791`) la fait déjà pour
   toute résolution de Tir drone (`resolveRangedDistance` + `resolveAttackLOS`, mêmes helpers que
   l'humanoïde/l'exo). Réutiliser ces mêmes fonctions pour le check de zone de contrôle avant de
   lancer le Test de Détection, jamais un nouvel appel à `evaluateWorldVisibility`. Hors zone →
   tentative suivante (INI -5), ou fin après la 3e.
3. Si en zone : Test du programme `detection` (`drone_programs` du personnage) — échec → tentative
   suivante ; pas de programme `detection` du tout → fin immédiate (drone non équipé pour l'autonome,
   RAW implicite), logué `[DBG]` seulement (pas de bruit chat pour un non-événement).
4. Si Détection réussie ET le drone possède un programme `category='ami_ennemi'` → Test Ami/Ennemi
   (RAW « conditionnel » — cf. le drone de combat standard LdB p.320 n'en a pas) ; échec → tentative
   suivante. Sinon (pas de programme ami/ennemi) → passer direct à l'Armement.
5. Armement : **délègue à `resolveDroneAssaultAction` existant** (même arme/programme/Choc/dégâts que
   la déclaration manuelle, Sprint 2c — zéro duplication) avec le `target_token_id` et
   `drone_weapon_inv_id` (première arme par `sort_order`) résolus dynamiquement ici.
Chaque Test (Détection, Ami/Ennemi, Armement) diffuse un `DICE_RESULT` comme un jet normal — visibilité
chat identique à une attaque manuelle, pas une résolution silencieuse côté serveur (même demande Saar
« expliquer » : la séquence doit être lisible dans le chat, tentative par tentative).

`DRONE-ARMEMENT-PROGRAM-SPLIT` (programme strict sans repli) n'est **pas retranché** ici — un drone
autonome dont l'arme ne correspond à aucun programme échoue à l'étape 5 avec le même message qu'en
déclaration manuelle aujourd'hui ; le ticket reste ouvert, orthogonal à ce Sprint.

#### Fichiers touchés (récapitulatif)
- Migration : `combat_roster.acquired_target_token_id` (nullable, `ON DELETE SET NULL`, persistant) ;
  `combat_state.drone_turn_model` (`'classique'|'ordres_permanents'`, figé à `COMBAT_START`) ;
  nouvelle option de campagne `drone_targeting_mode` (`'assigne'|'spatial'`, défaut `'assigne'`, même
  patron que `status_effects_mode`, ne s'applique qu'en `ordres_permanents`) — les champs existent dès
  ce Sprint même si seul `'assigne'` a une implémentation ; `'spatial'` sélectionné doit soit
  fonctionner (Mode spatial livré), soit refuser proprement (pas de comportement silencieusement
  dégradé) tant qu'il n'est pas codé.
- Nouvel événement socket `COMBAT_DRONE_SET_ORDERS { tokenId, targetTokenId, droneWeaponInvId }` —
  guard `isGm || isOwner`, utilisable à tout moment (pas de garde de phase/tour) ; `targetTokenId:
  null` désassigne la cible surveillée (pas d'événement séparé nécessaire — couvre ce qui aurait été
  une « V2-a » distincte).
- `combatTurnEngine.js` : Lot 0 (`findNextAnnounceSlot`/`advanceAnnouncementQueue`) + hook au début de
  phase ANNOUNCEMENT (`COMBAT_ANNOUNCE_START`, `endTurn`) — pré-remplir `has_announced=true` +
  `drone_auto` pour chaque drone en `ordres_permanents`, avant même que la file ne soit construite.
- `socketCombatHelpers.js` : nouvelle fonction `resolveDroneAutoAction`.
- `socketCombatResolution.js` : dispatch `action_key==='drone_auto'`.
- Client : `DroneWindow.jsx`/`DroneDeclareSection.jsx` gagnent un contrôle « ordres permanents »
  (cible + arme, visible seulement si `drone_turn_model==='ordres_permanents'`), plus de bouton
  « Passer » spécifique à concevoir (le drone n'apparaît jamais dans la file d'attente).

#### V2 différée — définie maintenant, codée plus tard (jamais un renoncement silencieux, retour Saar 2026-09-16)

**V2-b — Plusieurs cibles simultanées : une par combo programme d'armement + arme compatible, plafonné
par l'ordinateur de bord** (révisé 2026-09-16, retour Saar — granularité correcte : par **combo
programme+arme**, pas juste « par arme »). RAW (LdB p.320) décrit une « arme automatisée » comme le
système complet ordinateur+détecteur+arme — un drone à plusieurs armes/programmes distincts a en toute
rigueur plusieurs systèmes d'acquisition indépendants, chacun suivant sa propre cible, **mais dans la
limite de ce que l'ordinateur de bord peut gérer**.
**Vérification RAW faite (2026-09-16, lecture complète `REGLEDRONE.md`)** : [VÉRIFIÉ] la formule
« Gestion systèmes = 10 + (Gén. × NT), un appareil compte comme un système » existe (§ Informatique,
LdB p.281) mais son texte couvre explicitement un ordinateur qui gère des **appareils externes** (ex.
un Centre de commande gérant plusieurs drones), pas littéralement « le nombre de programmes d'armement
qu'un drone peut faire tourner sur lui-même en même temps ». [VÉRIFIÉ] Un précédent RAW plus proche
existe : les drones Neptune/Artémis (Guide Technique) — « le CRD peut gérer plusieurs interceptions
simultanément [...] mais pour chaque interception supplémentaire, son Test subit une pénalité de 1 »,
plafonné (« ne peut contrer plus de 4 attaques simultanément »). [HYPOTHÈSE, cohérente avec le RAW
mais non explicitement énoncée pour ce cas précis] : appliquer le même patron au drone autonome —
`ordinateur_gen`/`ordinateur_nt` (`Gestion systèmes` déjà stocké/dérivable sur `drone_sheet`) plafonne
le nombre de combos programme+arme actives simultanément, et/ou chaque cible au-delà de la première
subit un malus cumulatif au Test de Détection (mirroir Neptune/Artémis, valeur exacte à trancher avec
Saar). **Écart RAW à documenter dans `docs/JOURNAL8.md` si retenu** (Invariant 5, `AGENTS.md`) —
extension assumée, pas un texte RAW littéral pour ce cas précis.
Design V2 : remplacer la colonne unique `combat_roster.acquired_target_token_id` par une table
`drone_weapon_targets (drone_weapon_id PK/FK, acquired_target_token_id, ON DELETE CASCADE sur l'arme,
ON DELETE SET NULL sur la cible)` — une ligne par combo arme+programme. `resolveDroneAutoAction`
boucle sur CHAQUE combo ayant une cible mémorisée, jusqu'au plafond `Gestion systèmes`, chacun avec sa
propre séquence Détection→[Ami/Ennemi]→Armement et son propre triplet INI 12/7/2 (malus cumulatif
optionnel au-delà du premier, si retenu). Migration : `acquired_target_token_id` de `combat_roster`
devient une donnée de transition à répartir vers la table par arme au basculement V1→V2.

#### Mode spatial (2ᵉ mode de l'option de campagne, design posé — construction séquencée après le mode `assigne`)
Recherche automatique parmi les tokens à portée/LOS, sans désignation humaine — le RAW complet
(« dès que quelque chose entre dans sa zone de contrôle ») implique un drone qui acquiert seul.
Interroger le WorldSnapshot (`worldSpatialQueryService.queryTokensInShape` ou équivalent, portée =
zone de contrôle du drone) pour lister les tokens à portée+LOS ; filtrer par un modèle ami/ennemi —
**préalable obligatoire non optionnel** : corriger d'abord `EXOARM-MULTIADV1`/le modèle binaire
`atkEnemyType` (`character.type==='pj' ? 'pnj' : 'pj'`, déjà connu bancal pour exo/drone) avant de le
réutiliser ici, sans quoi ce mode hériterait du bug au lieu de le corriger ; choisir une cible (la
plus proche, à trancher avec Saar) si plusieurs candidats. Sous-chantier à part entière — séquencé
après que le mode `assigne` ait prouvé le reste de la mécanique (retries, Détection, Ami/Ennemi
conditionnel, délégation à `resolveDroneAssaultAction`) en jeu réel, mais **le point d'extension
existe dès la V1** (l'option de campagne, posée dès le premier codage) — pas une case vague ajoutée
après coup.

### Sprint 3 — Télépilotage (LdB p.319) — CADRAGE TERMINÉ 2026-09-16, prêt à coder sur validation Saar

RAW : « le personnage doit utiliser sa Compétence Télépilotage, considérée comme une Compétence
limitative agissant éventuellement sur le niveau des programmes habituels du drone » ; « quand
télépiloté, l'initiative = celle du pilote (son action ce tour = l'action du drone) ». Rien de codé,
ni serveur ni client (recherche exhaustive, §3) ; `TELEPILOTAGE` existe déjà au catalogue.

#### Écart assumé vs l'ancien plan archivé — pas de mode persistant
L'ancien plan (`PLAN_DRONESYSCOMBAT.md` Sprint 3) proposait `combat_roster.state_control_mode`
(`'autonome'|'telepilote'`, persistant tour après tour, togglé par une action dédiée). **Retenu à la
place : un choix fait à chaque Tour, au moment de la déclaration, par le pilote — pas d'état à
synchroniser dans la durée.** Plus simple, aucun risque de désynchronisation (drone/pilote
déconnecté, changement de pilote en cours de combat), pas de nouvelle colonne enum. Un Tour non
télépiloté retombe simplement sur le comportement déjà existant du drone selon `drone_turn_model`
(déclaration manuelle classique, ou exécution des ordres permanents — Sprint 2d).

#### Lien pilote ↔ drone
Nouvelle colonne `drone_sheet.owner_character_id UUID REFERENCES characters(id) ON DELETE SET NULL`
— **distincte** de `character.user_id` du drone lui-même (déjà existant, autorisation de compte pour
Sprint 2c/2d, inchangé). `owner_character_id` désigne quel **personnage** (PJ) est le pilote RAW
(dont la Compétence Télépilotage compte), pas quel compte peut éditer/déclarer pour le drone.
Assignable par le MJ — UI à ajouter dans `DroneSheet.jsx` (onglet Paramètres, sélecteur de personnage
de la campagne).

#### Déclaration — sur le tour du PILOTE, pas celui du drone
`CombatActionWindow.jsx` (fenêtre PJ) gagne une option « Télépiloter <nom du drone> » quand
`character.id === owner_character_id` d'au moins un drone actif dans le combat en cours. Choix arme
drone + cible : réutiliser directement `DroneDeclareSection.jsx` (déjà utilisé côté MJ pour la
déclaration manuelle), pas une réécriture.

**Garde, différente selon `drone_turn_model`** (interaction avec le Sprint 2d, retour Saar 2026-09-17) :
- `classique` : refuser si `combat_roster.has_announced === true` côté drone (« ce drone a déjà agi ce
  Tour ») — inchangé, le drone n'a pas encore de slot pris tant que personne ne l'a déclaré.
- `ordres_permanents` : le drone a **déjà** `has_announced=true` dès le début de Tour (pré-rempli par
  le Sprint 2d, cf. plus haut). Distinguer deux cas via `combat_timeline_entries.status` de son action
  `drone_auto` de ce Tour : si encore `scheduled`/`delayed_waiting` (pas encore résolue) → **annuler
  cette entrée** (marquer `skipped`, ou suppression + suppression de la ligne `combat_actions`
  correspondante — détail à trancher au codage) et poursuivre avec la télépilotage normalement ; si
  déjà `resolved` → refuser (« ce drone a déjà agi ce Tour »), même message que le mode classique.
  **Les ordres permanents (`acquired_target_token_id`) ne sont jamais effacés par ce remplacement** —
  seule l'action de ce Tour change de forme ; le Tour suivant sans télépilotage, l'exécution
  automatique reprend normalement sur les mêmes ordres.

Payload : `combat_actions` inséré avec `token_id` = celui du **pilote** (pas du drone),
`action_key: 'drone_telepilot'`, `drone_weapon_inv_id` posé (identifie l'arme ET le drone via
`drone_weapons.character_id` — aucune colonne supplémentaire nécessaire pour retrouver quel drone).
**Même transaction** : `combat_roster` du drone → `has_announced=true, status='done'` pour ce Tour
(déjà vrai en `ordres_permanents`, posé ici pour la première fois en `classique` — pas de slot séparé
résolu pour lui, RAW « son action ce tour = l'action du drone »).

#### Timeline — aucun changement à `combatTurnEngine.js`
`token_id` de l'action = celui du pilote → `buildTimelineEntries` calcule la position depuis
l'initiative du **pilote** normalement (RAW « agissent à leur Initiative normale ») — comportement
déjà natif, zéro modification du moteur de phases.

#### Résolution — `resolveDroneAssaultAction` réutilisé avec un plafond de compétence, Tir ET CaC
`socketCombatResolution.js` : nouvelle branche `action_key === 'drone_telepilot'` (posée pour
`action.type === 'assault'` OU `'melee'` — **Tir et CaC pris en charge symétriquement dès ce Sprint**,
correction post-relecture : `resolveDroneAssaultAction` gère déjà les deux en interne via
`isCaCWeapon`, y compris le check de portée de contact `checkMeleeReach` — router le CaC télépiloté
séparément n'aurait été qu'une coupure de périmètre artificielle, pas une vraie limite technique).
Résout le character DRONE (via `drone_weapons.character_id`, pas le pilote) et son propre token sur la
carte (portée/LOS/allonge calculées depuis la position du **drone**, jamais celle du pilote — c'est
l'appareil qui agit depuis son emplacement) → appelle `resolveDroneAssaultAction`.

**Plafond de compétence — vérifié RAW, pas une extension assumée** (recherche faite 2026-09-17,
répond aux deux points laissés ouverts par la critique précédente) :
- `docs/REGLES/ATTRIBUTS.md:209-211` définit la Compétence limitative : « le niveau d'une telle
  Compétence limite celui de la Compétence à laquelle elle est associée ». Ce mécanisme est déjà codé
  et documenté comme réutilisable tel quel dans ce projet : `charStats.js#calcLimitedSkillTotal(skillTotal,
  limitingSkillTotal) = Math.min(...)` — commentaire du code : « à réutiliser tel quel pour tout futur
  cas de Compétence limitative, jamais réinventé » (1ʳᵉ instance : Manœuvre d'armure/Exo,
  `PLAN_EXOARMURE.md` Lot 2). **Réutiliser cette fonction nommée, pas un `Math.min` ad hoc.**
- Chez l'appelant existant (`combatantContextService.js:87-98`), la maîtrise (`mastery`) est calculée
  **avant** le plafond, depuis la compétence originale — seul le Seuil passe dans
  `calcLimitedSkillTotal`. **La maîtrise n'est donc jamais plafonnée** — appliqué ici :
  `getCriticalSuccessBonus({ masteryLevel: programme.level })` (`socketCombatHelpers.js:2836`) garde
  la valeur `programme.level` **non plafonnée**, seul `chancesDeReussite` utilise la valeur plafonnée.
- Implémentation : `const telepilotageTotal = calcSkillTotal(pilotAttrs, pilotCharSkill, telepilotageRefSkill,
  pilotGeno, pilotMutationEffects)` (Seuil complet du pilote sur TELEPILOTAGE — Attribut + niveau +
  maîtrise + malus `(-3)` « compétence difficile », même calcul que n'importe quel Test de compétence
  humaine) ; puis `const programLevelCapped = calcLimitedSkillTotal(programme.level, telepilotageTotal)`
  ; `chancesDeReussite = programLevelCapped + totalModComp + coverageModifier`.
- **Aucun garde bloquant si le pilote n'a jamais investi en Télépilotage** — vérifié : le marqueur de
  la compétence en base est `(-3)` (« Compétence difficile », `charStats.js:180-182`, malus de base
  absorbé par les premiers points de maîtrise), **pas** `(X)` (« Compétence réservée », qui elle
  bloquerait tant qu'elle n'est pas « ouverte », comme `TIR_AUTOMATIQUE`/PC23). N'importe quel pilote
  peut télépiloter ; `calcSkillTotal` dégrade proprement vers un Seuil bas (jamais un crash) si
  `char_skills` n'a pas de ligne pour ce personnage/cette compétence (`charSkillRow?.mastery ?? 0`).
  C'est le comportement RAW correct, pas un trou à combler.

#### Déplacement — inclus dès ce Sprint, pas différé
RAW : le pilote peut déplacer le drone le tour où il le télépilote (« son action ce tour = l'action du
drone »). La déclaration « Télépiloter » réutilise le même payload qu'une déclaration normale
(`mapActions.move` + `mapActions.attack`/`melee` combinés, déjà supporté pour un PJ) — `planCombatWorldMovement`
appelé avec le character/token du **drone** (pas du pilote), budget via `getDroneMovementBudget` (déjà
livré, correctif `DR2`). Aucune nouvelle mécanique de déplacement à écrire, seulement câbler la bonne
entité mouvante.

#### Interception désactivée en télépiloté
RAW explicite : le programme réactif `interception` n'est actif qu'en mode autonome. Simple garde côté
serveur (aucun Test d'interception déclenché quand l'action vient de `action_key==='drone_telepilot'`)
— pas de nouvelle mécanique, à ne pas oublier au codage.

#### Affichage chat (à trancher au moment de coder)
Montrer les deux identités (pilote + drone) dans le jet plutôt qu'une seule — ex. « Jean (télépilotage)
— Drone AX tire » — pour que ce soit lisible à la table (le pilote doit voir que c'est bien lui qui a
agi, le drone reste le sujet mécanique du jet).

### Dépendance entre 2d et 3
Aucune dépendance dure — deux façons indépendantes de remplir le tour d'un même drone (son propre
slot, autonome ou manuel ; ou celui de son pilote, télépiloté). Cadrables/codables dans l'ordre choisi
par Saar ; les deux réutilisent `resolveDroneAssaultAction` sans le dupliquer.
