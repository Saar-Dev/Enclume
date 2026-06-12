# JOURNALTEMP — Vérification planification DRONE
> Session 86 — 2026-06-10
> Objectif : Planifier et verifier la planification des drones au systeme de combat

§Vision — tableau modes
V1 — Catégorie armement non explicite dans vision — RÉSOLU — précision à ajouter :
La logique est correcte (fire_mode === 'cc' → armement_contact, sinon armement_distance) et documentée dans le plan Sprint 2c (correction V14).
À clarifier dans la table Vision : ajouter note "catégorie déterminée par drone_weapons.fire_mode".

V2 — Déplacement drone CaC autonome — HORS SCOPE SPRINT 2 — comportement existant suffisant :
Le joueur déplace le token drone via le système de mouvement combat existant (combat_actions type='move_short'/'move_long').
Le drone ayant un roster entry et un token_id, il peut déclarer un move action comme tout participant.
Pas de mécanique spéciale requise pour V1. Le joueur contrôle le drone token comme une 2e entité.
À documenter dans le plan comme comportement hérité du système existant.

§Différences mécaniques
V3 — integrite_actuelle décrémentation — ANALYSÉ — FORMULE FAUSSE CONFIRMÉE :
LdB vérifié (REGLEDRONE.md p.82-88) : "cases de blessures équivalent à celui du Corps".
Système identique au système humanoïde : 1 hit = 1 case. Gravité déterminée par palier de 5 pts nets.
Décrémentation correcte : integrite_actuelle -= 1 par hit (indépendamment des dégâts nets).
Sauf exception : severity = 'detruit' (degatsNets ≥ 30) → integrite_actuelle = 0 direct.
Formule plan Math.floor(degatsNets / 5) : FAUSSE. Pour 15 nets → plan donne -3, correct est -1. Facteur d'erreur 3x.
Pour 25 nets → plan donne -5, correct est -1. Facteur d'erreur 5x.
Le drone serait détruit en 1-2 hits avec la formule actuelle pour des armes standard.
Correction à apporter dans Sprint 2b du plan :
  const newIntegrite = severity === 'detruit' ? 0 : Math.max(0, droneSheet.integrite_actuelle - 1)
NOTE : B4 reste valide pour les cas d'overflow (box déjà pleine → déborde-t-on sur la suivante ?). Ce point précis reste à confirmer. Mais la décrémentation de base (-1 par hit) est suffisamment documentée par le LdB.

V4 — damages JSONB et integrite_actuelle — ANALYSÉ — risque réduit après V3 :
Avec la correction V3 (integrite -= 1 par hit), synchro est naturelle : 1 case cochée ET integrite -= 1 simultanément.
Risque résiduel — cas overflow : si damages[severity].indexOf(false) === -1 (toutes cases plein pour ce niveau), la case n'est pas cochée MAIS integrite -= 1 quand même → décalage 1 pt entre JSONB et integrite.
Fix recommandé : si idx === -1, chercher le premier slot false dans le niveau suivant (overflow vers gravité supérieure).
Pour V1 scope : comportement acceptable (drone en fin de vie, overflow rare). Ajouter commentaire dans le code.

§Migration 76
V5 — Contrainte XOR absente — CONFIRMÉ — À CORRIGER DANS LE PLAN :
Le plan dit "Jamais les deux non-nuls simultanément." Invariant non enforced en DB.
Analyse : CHECK (A IS NULL OR B IS NULL) = autorise [null,null], [X,null], [null,Y] — refuse [X,Y].
Ne pas utiliser XOR strict qui bloquerait les actions sans arme (move, skip, reload).
Formulation correcte pour Migration 76 :
  ALTER TABLE combat_actions
    ADD CONSTRAINT chk_weapon_xor
      CHECK (weapon_inv_id IS NULL OR drone_weapon_inv_id IS NULL);
DÉCISION : ajouter ce CHECK dans la définition de Migration 76 du plan.

§Sprint 2a — COMBAT_START
V6 — is_pnj: false pour les drones — VÉRIFIÉ — DEUX IMPACTS RÉELS :

Impact 1 — Surprise (mineur) :
Code vérifié (index.js:1538-1549) : surprisedPlayers filtre !is_pnj → drone inclus si surpris.
Émet COMBAT_SURPRISE_ROLL vers character?.user_id = null → targetSocket = undefined → guard if(targetSocket) → pas de crash.
MAIS : is_surprised: true en DB pour un drone si le GM le met dans surprisedTokenIds. Flag incorrect, pas de conséquence mécanique visible (COMBAT_ACTION_DECLARE ne check pas is_surprised).
Fix requis dans le plan : dans rosterRows.map, forcer is_surprised = false si character.type === 'drone'.

Impact 2 — CRITIQUE — drones bloqués dans COMBAT_ACTION_DECLARE :
Code vérifié (index.js:1817-1821) :
  if (character.type === 'pnj') { if (socket.role !== 'gm') return }
  else { if (character.user_id !== socket.user.id) return }
Pour character.type === 'drone' : tombe dans else → character.user_id = null → null !== socket.user.id → TOUJOURS REFUSÉ.
Conséquence : Sprint 2c (GM déclare drone via CombatGmDeclareWindow = COMBAT_ACTION_DECLARE) est bloqué.
Sprint 2d (auto-announcement serveur = insert direct DB, bypass COMBAT_ACTION_DECLARE) est intact.
Fix requis dans COMBAT_ACTION_DECLARE : étendre la condition PNJ :
  if (character.type === 'pnj' || character.type === 'drone') { if (socket.role !== 'gm') return }

V7 — state_control_mode utilisé en Sprint 2d avant création — RÉSOLU PAR CONCEPTION :
Analyse : deux options.
Option A : migration anticipée (ajouter state_control_mode dans Migration 76 ou 76b). Crée une dépendance inutile entre Sprint 2 et Sprint 3.
Option B (retenue) : Sprint 2d ne filtre PAS sur state_control_mode — tous les drones sont autonomes par définition avant Sprint 3. Le filtre est ajouté à Sprint 3 lors de l'ajout de la colonne.
Décision : supprimer le filtre r.state_control_mode === 'autonome' de Sprint 2d. Garder uniquement character.type === 'drone' comme critère d'auto-announcement. Sprint 3 ajoutera la colonne (DEFAULT 'autonome') + le filtre. Résout aussi partiellement V23.

§Sprint 2b — Drone comme cible
V8 — modDegatsMode absent — CONFIRMÉ — BUG STRUCTUREL DANS LE PLAN :
Code serveur vérifié (index.js:2263-2271) : le COMBAT_DAMAGE_CONFIRM handler calcule degautsBruts en deux branches :
  melee : rawDice + modDom + combatModeBonus
  ranged : rawDice + modDomAttaque + modDegatsMode (isShortRange ? fire_mode_bonus_dmg : 0)
Le plan Sprint 2b recompute degautsBruts = rawDice + modDomAttaque DANS le handler drone → modDegatsMode absent.
Mais ce calcul est déjà fait en amont dans le handler, AVANT la vérification du type de cible.
Fix architectural requis : restructurer Sprint 2b pour intercepter APRÈS le calcul commun degautsBruts, pas le recomputer :
  compute degautsBruts (commun, avec modDegatsMode inclus)
  if (cibleCharacter.type === 'drone') {
    // etq = blindage, rd = calcDroneRD(integrite)
    const degatsNets = Math.max(0, degautsBruts - etq - rd)
    await resolveDroneIntegrityLoss(io, campaignId, cibleCharacter.id, droneSheet, degatsNets)
    return
  }
  // ... humanoid path (existant)
Signature resolveDroneIntegrityLoss reçoit degatsNets (post-defenses drone), pas degautsBruts.

V9 — CaC humanoïde → drone — RÉSOLU PAR V8+V13 :
Code vérifié (index.js:2263-2271) : le calcul degautsBruts distingue déjà melee vs ranged AVANT la branche cible :
  melee : degautsBruts = rawDice + modDom + combatModeBonus
  ranged : degautsBruts = rawDice + modDomAttaque + modDegatsMode
Le fix architectural V8+V13 (intercepter après degautsBruts calculé) résout le cas CaC automatiquement.
La branche drone dans COMBAT_DAMAGE_CONFIRM reçoit degautsBruts déjà correct pour les deux types d'attaque.
Aucune action additionnelle requise pour V9 spécifiquement.

V10 — droneSheet.token_id n'existe pas — RÉSOLU — Option A retenue :
drone_sheet n'a pas de colonne token_id (confirmé migration 71, 72, 73).
DÉCISION : passer tokenId en paramètre supplémentaire.
Nouvelle signature : resolveDroneIntegrityLoss(io, campaignId, characterId, tokenId, droneSheet, degatsNets)
token_id est toujours disponible dans le contexte appelant (token déjà fetché pour vérifier character.type).
Aucune requête supplémentaire. À corriger dans la définition de la fonction dans le plan.

V11 — Cascade combat_actions — VÉRIFIÉ — FAUX POSITIF :
Prémisse incorrecte dans l'analyse initiale : combat_actions n'a JAMAIS eu de colonne roster_id.
Schéma réel (migration 54) : combat_actions.token_id FK → tokens.id ON DELETE CASCADE.
Comportement à la destruction drone (DELETE FROM combat_roster WHERE token_id = X) :
- La ligne roster est supprimée. Les combat_actions du drone restent (FK sur tokens.id, pas sur combat_roster).
- advanceSlot itère sur combat_roster → drone absent → ses actions ne sont pas consommées.
- endTurn fait DELETE FROM combat_actions WHERE campaign_id = ... → nettoyage garanti.
Verdict : actions orphelines pour le round courant uniquement. Pas de crash, pas d'exécution fantôme. COMPORTEMENT SÛUR.

V12 — Token drone sur battlemap après destruction — DÉCISION DE DESIGN :
TOKEN_DELETED existe dans shared/events.js (vérifié).
DÉCISION RETENUE : token reste sur la carte comme épave. Comportement intentionnel.
- DRONE_INTEGRITY_UPDATED { detruit: true } est déjà émis → UI peut marquer le token visuellement comme détruit.
- Le GM supprime le token manuellement via l'interface existante quand il le souhaite.
- Pas d'émission automatique de TOKEN_DELETED à la destruction.
À documenter explicitement dans le plan (actuellement silencieux sur ce point).

V13 — PJ attaque drone : rouler les dés ou auto-résolu ? — ANALYSÉ — BUG STRUCTUREL :
Code vérifié (index.js:~3616 ranged, ~2494 melee) : le serveur distingue bien PJ vs PNJ attaquant :
  PJ attaquant → COMBAT_DAMAGE_PROMPT → player rolls → COMBAT_DAMAGE_CONFIRM
  PNJ attaquant → auto-résolution directe dans resolveAssaultAction
La matrice du plan (ligne "PJ attaque drone") est CORRECTE : PJ → COMBAT_DAMAGE_PROMPT → CONFIRM → resolveDroneIntegrityLoss.
MAIS : Sprint 2b place le handler drone dans resolveAssaultAction AVANT la branche PJ/PNJ.
Pour PJ attaquant un drone : rawDice n'est pas encore disponible à ce point → rawDice = undefined → degautsBruts = NaN → CRASH.
Fix architectural : Sprint 2b doit avoir DEUX branches séparées :
  A) resolveAssaultAction — PNJ attaquant drone : guarded if (attackerCharacter.type !== 'pj') → auto-resolve direct
  B) COMBAT_DAMAGE_CONFIRM — PJ attaquant drone : check cibleCharacter.type === 'drone' → appliquer defenses drone sur degautsBruts déjà calculé → resolveDroneIntegrityLoss
La branche B est absente du plan actuel. À ajouter dans Sprint 2b.
Décision confirmée : PJ roule ses propres dés de dégâts contre un drone (cohérence UX).

§Sprint 2c — resolveDroneAssaultAction
V14 — weapon.melee n'existe pas dans drone_weapons — CONFIRMÉ — BUG CONCEPTION :
Schema drone_weapons (Option A) : champs id, character_id, equipment_id, name, damage_formula, portee, fire_mode, notes.
Pas de champ melee. Le champ existant est fire_mode CHECK ('cc','rc','rl').
Correction directe :
  FAUX : AND category = weapon.melee ? 'armement_contact' : 'armement_distance'
  CORRECT : AND category = (weapon.fire_mode === 'cc') ? 'armement_contact' : 'armement_distance'
Une ligne à corriger dans Sprint 2c du plan.

V15 — isRushedMod dans la formule drone — ANALYSÉ — DEAD CODE, pas de crash :
state_vitesse existe bien sur combat_roster (migration 58, DEFAULT 'normal'). Drones = toujours 'normal'.
isRushedMod = 0 systématiquement pour les drones → pas de bug fonctionnel.
Mais sémantiquement faux (drones ne peuvent pas se précipiter). À retirer de la formule drone dans Sprint 2c pour propreté du code.
Correction simple : supprimer isRushedMod du calcul chancesDeReussite dans resolveDroneAssaultAction.

V16 — drone_weapons.ammo_restant absent du schéma — DÉCISION — HORS SCOPE V1 :
LdB : les armes drone ont des munitions (ex: lance dard 70 munitions). Fonctionnalité valide.
DÉCISION V1 : pas de suivi munitions. Retirer le commentaire "décrémenter ammo_restant" du plan Sprint 2c.
Ajouter en TODO du plan : "B6 — ammo_restant sur drone_weapons : colonne ammo_remaining INTEGER nullable + décrémentation dans resolveDroneAssaultAction".

V17 — Portée drone non parsée — ANALYSÉ — ACCEPTABLE V1, pas de gap fonctionnel :
Sprint 2c utilise confirmedModifiers identiques humanoïdes → GM sélectionne palier portée manuellement dans CombatModifiersWindow.
Même workflow que les armes humanoïdes (aucune auto-détection portée dans le flow actuel non plus).
La portée free-text de drone_weapons est informationnelle uniquement pour V1.
À documenter comme future amélioration : "TODO UX — parser portee TEXT de drone_weapons pour pré-sélectionner le palier dans CombatModifiersWindow."

§Sprint 2d — Auto-announcement
V18 — r.character_type n'existe pas dans combat_roster — CONFIRMÉ — FIX IDENTIFIÉ :
Migrations vérifiées (54, 56, 57, 58, 64) : combat_roster n'a pas de character_type.
Le serveur n'utilise jamais de JOIN combat_roster→characters — accès séparé via token_id.
Fix pour Sprint 2d : remplacer le filtre JS par un JOIN SQL :
  const droneRosterEntries = await db('combat_roster as r')
    .join('tokens as t', 't.id', 'r.token_id')
    .join('characters as c', 'c.id', 't.character_id')
    .where({ 'r.campaign_id': campaignId, 'r.has_announced': false, 'r.status': 'active' })
    .where('c.type', 'drone')
    .select('r.*', 'c.id as character_id')
Ce pattern est aussi cohérent avec COMBAT_START qui fetchait tokens puis characters séparément.

V19 — computeSequence(12) : fonction inexistante — CONFIRMÉ — fix trivial :
Migrations vérifiées (56_combat_v2) : sequence est SMALLINT, valeurs 1=mouvement, 2=micro, 3=assaut.
C'est l'ordre intra-slot (pas l'INI). computeSequence n'existe nulle part dans le codebase.
Pour une action drone_auto (assaut autonome sans déplacement préalable) : sequence = 3 directement.
Correction : remplacer computeSequence(12) par la valeur littérale 3.

V20 — Guard PD2 bloque drone_auto sans cible — CONFIRMÉ — guard vérifié ligne 3443 :
Code actuel : if (!action.weapon_inv_id || !action.target_token_id) return
Pour drone_auto sans cible : weapon_inv_id = null (a drone_weapon_inv_id) ET target_token_id = null → double vrai → return silencieux.
La correction PD2 du plan (étendre à drone_weapon_inv_id) ne résout pas le cas target_token_id null.
Fix correct : dériver le drone_auto avant ce guard :
  if (action.action_key === 'drone_auto') {
    await resolveDroneAutoAction(io, campaignId, action)
    return
  }
  if (!action.weapon_inv_id || !action.target_token_id) return
La logique drone_auto a sa propre gestion du cas sans cible (Détection). À ajouter au plan.

§Sprint 3 — Télépilotage
V21 — INI du drone en mode télépiloté : mécanisme non défini — EN COURS D'ANALYSE :
LdB p.319 : le character agit à son INI normale. Le drone n'a pas de slot indépendant en mode télépiloté.
Trois options architecturales :
Option A : double slot (drone INI 12 + propriétaire INI X). Drone ignoré. Timeline confuse.
Option B : mise à jour base_ini du drone en DB au moment du toggle. Viole l'invariante base_ini figé.
DÉCISION RETENUE — Option C :
  - Le propriétaire déclare "Télépiloter" en ANNOUNCEMENT.
  - Son action dans combat_actions référence drone_weapon_inv_id (pas weapon_inv_id).
  - Le drone dans combat_roster : has_announced = true + status = 'done' immédiatement (il n'a pas de slot propre ce round).
  - La timeline montre le propriétaire qui agit pour le drone. INI = INI du propriétaire.
  - La résolution lit drone_weapon_inv_id → skillTotal = min(programme.level, TELEPILOTAGE_proprio).
Implications à ajouter au plan Sprint 3 :
  1. "Télépiloter" = action spéciale dans COMBAT_ACTION_DECLARE du propriétaire → insère drone_weapon_inv_id dans ses combat_actions + marque drone roster has_announced=true, status='done'.
  2. La résolution (advanceSlot) pour le slot du propriétaire : si action a drone_weapon_inv_id → path télépilotage.
  3. Le drone n'apparaît pas dans la timeline de résolution ce round (status='done' → filtré).

V22 — "Le character consomme son tour" : non-enforcement — RÉSOLU PAR OPTION C (V21) :
Option C : le propriétaire déclare "Télépiloter" → COMBAT_ACTION_DECLARE normal → has_announced = true → slot avancé.
Enforcement structurel : une fois has_announced = true, le guard COMBAT_ACTION_DECLARE (ligne 1826) bloque toute nouvelle déclaration pour ce token.
Le drone est simultanément marqué has_announced = true + status = 'done' → ne peut plus agir de son côté.
Aucun mécanisme supplémentaire requis.

V23 — Migration state_control_mode manquante — RÉSOLU PAR V7 + DÉCISION SPRINT 3 :
V7 a retiré state_control_mode de Sprint 2d. Cette colonne n'est requise qu'en Sprint 3.
Migration à écrire dans Sprint 3 (ex : Migration 77b ou intégrée à Migration 77) :
  ALTER TABLE combat_roster
    ADD COLUMN state_control_mode TEXT NOT NULL DEFAULT 'autonome',
    ADD CONSTRAINT chk_state_control_mode CHECK (state_control_mode IN ('autonome','telepilote'));
Migration 77 (drone_sheet.owner_character_id) et cette migration sont dans des tables différentes — deux ALTER TABLE dans la même migration ou deux migrations distinctes. Décision à prendre en Sprint 3.
À ajouter dans la description de Sprint 3 du plan.

§drone_weapons schéma
V24 — fire_mode nullable sans default — DÉCISION — NOT NULL DEFAULT 'rc' :
fire_mode NULL → catégorie armement_distance silencieusement (fire_mode === 'cc' = false pour null).
Comportement ambigu. Décision : NOT NULL DEFAULT 'rc' (semi-automatique = cas le plus courant pour un drone de combat).
Raison : un drone sans fire_mode spécifié est probablement une arme à distance standard.
Correction dans le schéma drone_weapons du plan : fire_mode TEXT NOT NULL DEFAULT 'rc' CHECK (fire_mode IN ('cc','rc','rl')).

§TODO — B4 et incohérence du plan
V25 — B4 non signalé dans le code Sprint 2b — RÉSOLU par V3 :
V3 a établi la formule correcte (integrite -= 1 par hit, sauf detruit → 0) via lecture LdB.
La formule Math.floor(degatsNets / 5) est remplacée par la correction V3.
B4 reste pertinent uniquement pour le cas overflow (comportement lors des boxes déjà pleines).
Code Sprint 2b à annoter : // TODO B4 — overflow: si damages[severity] plein, déborder sur gravité suivante.

Synthèse
#	Sévérité	Nature
V5	Haute	Contrainte XOR DB manquante — CONFIRMÉ — correction à appliquer dans Migration 76
V6	Haute	Bug surprise mecanique pour drone — VÉRIFIÉ — 2 impacts : is_surprised flag incorrect (mineur) + COMBAT_ACTION_DECLARE bloque Sprint 2c (CRITIQUE — fix: étendre condition PNJ à drone)
V7	Haute	state_control_mode utilisé avant d'être créé — RÉSOLU — Sprint 2d ne filtre pas sur cette colonne, tous les drones sont autonomes par défaut
V8	Haute	modDegatsMode absent dans dégâts humanoïde → drone — CONFIRMÉ — fix architectural : intercepter après calcul commun degautsBruts, ne pas recomputer
V11	~~Haute~~	~~Cascade combat_actions non vérifiée~~ FAUX POSITIF — roster_id inexistant, comportement sûr
V13	Haute	PJ → drone : rouler ou auto — ANALYSÉ — Bug structurel : rawDice indisponible pour PJ, Sprint 2b manque la branche COMBAT_DAMAGE_CONFIRM pour PJ→drone
V14	Haute	weapon.melee n'existe pas — CONFIRMÉ — 1 ligne : remplacer weapon.melee par weapon.fire_mode === 'cc'
V18	Haute	r.character_type inexistant en DB — CONFIRMÉ — fix : JOIN combat_roster→tokens→characters WHERE c.type='drone'
V19	Haute	computeSequence(12) — CONFIRMÉ — fix : sequence = 3 directement
V20	Haute	Guard PD2 bloque les drone_auto sans cible — CONFIRMÉ — fix : intercepter drone_auto AVANT le guard existant, dispatch vers resolveDroneAutoAction
V21	Haute	INI télépilotage — mécanisme non défini — RÉSOLU — Option C : slot propriétaire porte l'action drone, drone status='done' ce round
V3	Moyenne→Haute	Formule intégrité provisoire — ANALYSÉ — formule FAUSSE (facteur 3-5x), correction : integrite -= 1 par hit, sauf 'detruit' → 0
V9	Moyenne	CaC humanoïde → drone — RÉSOLU par fix V8+V13 — aucune action additionnelle
V10	Moyenne	token_id solution non choisie — RÉSOLU — Option A : tokenId en paramètre de resolveDroneIntegrityLoss
V12	Moyenne	Token map non retiré à destruction — DÉCISION — épave intentionnelle, TOKEN_DELETED non émis, DRONE_INTEGRITY_UPDATED { detruit: true } suffit
V15	Moyenne	isRushedMod non exclu pour drone — dead code, à supprimer de la formule Sprint 2c
V16	Moyenne	ammo_restant — DÉCISION — hors scope V1, retirer commentaire Sprint 2c, ajouter TODO B6
V17	Moyenne	Portée drone non parsée — ACCEPTABLE V1 — GM sélectionne manuellement comme pour humanoïdes
V22	Moyenne	"consomme son tour" — RÉSOLU par Option C V21 — enforcement structurel via has_announced
V23	Moyenne	Migration state_control_mode absente — RÉSOLU — appartient à Sprint 3, SQL défini
V1	Faible	Catégorie armement non explicite dans vision
V2	Faible	Déplacement drone CaC autonome non documenté
V4	Faible	Désynchronisation JSONB / integrite — ANALYSÉ — risque résiduel overflow uniquement, acceptable V1
V24	Faible	fire_mode nullable — DÉCISION : NOT NULL DEFAULT 'rc'
V25	Faible	TODO B4 dans code — résolu par V3, overflow seul reste à annoter

---

## Simulation d'écriture — Sprint Drones 2 + 3
> Session 88 — 2026-06-11
> Méthode : parcours séquentiel sans écrire de code — identification de tout ce qui est flou, manquant ou à retravailler.

### Fichiers lus pour ancrer la simulation
- `shared/events.js` — état réel des événements WS
- `shared/droneConstants.js` — structure JSONB `damages`, seuils, `initDamages`
- `server/src/lib/charStats.js` — structure `RD_TABLE`, exports
- `server/src/db/migrations/71_drone_sheet.js` — schéma réel `drone_weapons`

---

### BLOCKERS — bloquent l'implémentation sans résolution préalable

**SIM-B1 — Migration `drone_weapons` manquante (CRITIQUE)**

Schema migration 71 (existant en DB) :
```
equipment_id UUID NOT NULL FK ref_equipment
contenance_chargeur INTEGER NOT NULL DEFAULT 0
ammo_restant INTEGER
sort_order SMALLINT DEFAULT 0
label_override TEXT
```
Schema Option A du plan (Sprint 2c) :
```
equipment_id UUID NULLABLE FK ref_equipment ON DELETE SET NULL
name TEXT NOT NULL
damage_formula TEXT NOT NULL
portee TEXT
fire_mode TEXT NOT NULL DEFAULT 'rc' CHECK (cc/rc/rl)
notes TEXT
```
Deltas : 5 colonnes ajoutées, 4 supprimées, `equipment_id` NOT NULL → NULLABLE.
Aucune migration planifiée ne touche `drone_weapons` (76, 76b, 77, 77b concernent d'autres tables).
→ Bloquer Sprint 2c. Migration à numéroter (proposition : `76c`). DROP/recreate si pas de données, sinon ALTER TABLE complet.

**SIM-B2 — `RD_TABLE` non exportée + plan utilise un indexage inexistant (CRITIQUE)**

`charStats.js` : `const RD_TABLE = [{ min, max, rd }, ...]` — non exportée. `lookupTable()` — non exportée.
Plan `calcDroneRD` : `RD_TABLE[Math.min(rdInput, RD_TABLE_MAX_KEY)]` → index entier sur tableau d'objets de range → retourne TOUJOURS `undefined`.
Correction : exporter `RD_TABLE` + `lookupTable` depuis `charStats.js` ET remplacer l'indexage par un `lookupTable(RD_TABLE, rdInput, 'rd')`. Sans ça, `calcDroneRD` retourne toujours `0` → dégâts aux drones = bruts − blindage (sans RD), système sous-résistant.
→ Bloquer Sprint 2b.

**SIM-B3 — C1 : migration split catégories `armement` non planifiée (CRITIQUE pour Sprint 2c)**

Migration 73 a seedé 34 programmes avec `category='armement'`.
Sprint 2c : `WHERE category = 'armement_distance'` → 0 résultat → `program = null` → `skillTotal = 0` → toutes attaques drones ratées systématiquement.
Aucune migration numérotée pour C1. Aucune décision par programme (lequel va en `armement_distance`, lequel en `armement_contact` ?).
→ Bloquer Sprint 2c. Sprint C1 (classification + migration) doit précéder Sprint 2c.

**SIM-B4 — `campaign_id` absent de l'INSERT `combat_actions` (Sprint 2d)**

`endTurn` utilise `DELETE FROM combat_actions WHERE campaign_id = ...` → colonne existe et est requise.
L'INSERT auto-announcement du plan ne l'inclut pas → violation NOT NULL → erreur DB silencieuse.
Fix : `campaign_id: campaignId` à ajouter à l'INSERT.
→ Vérifier migration 54 pour confirmer le NOT NULL.

---

### GAPS ARCHITECTURAUX — à résoudre avant "Je code ?"

**SIM-A1 — `DRONE_INTEGRITY_UPDATED` absent de `shared/events.js`**

Confirmé : absent. Le plan note "vérifier d'abord que cet event n'existe pas" — il n'existe pas.
Fix trivial : 1 ligne dans `events.js`. À faire avant Sprint 2b.

**SIM-A2 — Sémantique `rd` pour les drones : contre-intuitif, à valider**

`RD_TABLE` : drone sain (integrite=15) → rdInput=30 → rd=-3. Drone presque détruit (integrite=5) → rdInput=10 → rd=+2.
Dans la formule `degatsNets = degautsBruts - blindage - rd` :
- Drone sain : rd=-3 → `-(-3)` = soustrait 3 de moins → PLUS de dégâts
- Drone endommagé : rd=+2 → soustrait 2 de plus → MOINS de dégâts
Résultat : drone plus résistant quand il est endommagé, plus vulnérable quand intact. Sémantiquement inversé.
→ À valider dans LdB p.319. Peut nécessiter une adaptation de la formule pour les drones (ex: formula inversée, ou table différente).

**SIM-A3 — `pendingDamageActions` : contexte drone-attaquant non spécifié**

Matrice : "Drone attaque PJ humanoïde → COMBAT_DAMAGE_PROMPT PJ normalement".
`pendingDamageActions` stocke le contexte attaquant pour COMBAT_DAMAGE_CONFIRM. Pour un drone attaquant, les champs diffèrent (`drone_weapon` vs `char_inventory`, pas de `calcResistanceArmure` attaquant, etc.).
`resolveDroneAssaultAction` doit savoir exactement quels champs stocker dans `pendingDamageActions` pour que COMBAT_DAMAGE_CONFIRM fonctionne. Ces champs ne sont pas listés dans le plan.
→ Lire le handler `COMBAT_DAMAGE_CONFIRM` pour identifier les champs requis, puis adapter la structure stored pour le cas drone-attaquant.

**SIM-A4 — Sprint 2d : timing et point d'injection de l'auto-announcement**

"En fin de phase ANNOUNCEMENT" = non précisé dans le code. La transition ANNOUNCEMENT→RESOLUTION est déclenchée par le screening SQL de complétion dans le flow actuel. Le code auto-announcement doit s'exécuter AVANT ce screening, et APRÈS que tous les joueurs humains aient eu leur chance de déclarer.
→ Lire le handler ANNOUNCEMENT→RESOLUTION pour identifier le point exact d'injection.

**SIM-A5 — Sprint 2d : broadcast pour drones auto-annoncés**

Quand le serveur auto-valide les drones, `COMBAT_ACTION_DECLARED` doit-il être émis pour chaque drone ?
Sans ça : la timeline client ne se met pas à jour, les joueurs ne voient pas les drones "prêts". Le plan est silencieux sur ce point.

**SIM-A6 — Sprint 2d : retry INI 7 → INI 2 — mécanisme non architecturé**

Deux approches possibles :
- Option inline : `resolveDroneAutoAction` résout tout en séquence synchrone dans le slot INI 12 (simple)
- Option rows : insertion de nouvelles `combat_actions` à sequence INI 7 et INI 2 (fidèle à l'architecture)
Le plan ne tranche pas. L'option inline est plus simple mais fait des jets "cachés" dans le slot 12. L'option rows est plus cohérente mais nécessite un mécanisme de "sous-slot".
→ Décision requise avant implémentation.

**SIM-A7 — Sprint 2c : parsing `droneWeaponInvId` côté serveur non montré**

Le plan montre le payload client (`mapActions.droneWeaponInvId`). Mais le handler `COMBAT_ACTION_DECLARE` (~ligne 1815) doit extraire ce champ et l'écrire dans `combat_actions.drone_weapon_inv_id`. Cette modification n'est pas documentée dans le plan.

**SIM-A8 — `damages.detruit` JSONB non mis à jour à la destruction**

`initDamages` produit `{ ..., detruit: false }`. `resolveDroneIntegrityLoss` met `integrite_actuelle = 0` mais n'écrit pas `damages.detruit = true` dans le JSONB. DroneWindow affiche `detruit: false` malgré la destruction.
Fix : `if (detruit) damages.detruit = true` avant l'UPDATE.

---

### GAPS UI

**SIM-U1 — `CombatGmDeclareWindow.jsx` : changements UI non spécifiés**

Le plan dit "bifurcation sur `character.type === 'drone'`" mais ne décrit pas : quelle section remplace la sélection d'arme humanoïde, comment le GM sélectionne drone_weapon vs char_inventory, mise en page.
→ Inventaire exhaustif requis avant "Je code ?" (règle composant UI).

**SIM-U2 — `CombatModifiersWindow.jsx` : pre-sélection taille cible drone**

Fetch `drone_sheet.taille → getTailleCible(taille)` non situé : dans le composant lui-même, dans le parent, ou via un prop ? État mis à jour comment (prop override ou state interne) ?

**SIM-U3 — `DroneWindow.jsx` : subscription `DRONE_INTEGRITY_UPDATED` non implémentée**

PD5 liste le besoin sans montrer : useEffect + dépendances, quels champs du state local sont mis à jour (`integrite_actuelle` + `damages`), comment merger le JSONB damages partiellement mis à jour.

**SIM-U4 — Sprint 3 : UI "Télépiloter" dans `CombatActionWindow.jsx` non décrite**

Aucun détail sur l'ajout de cette option pour le joueur propriétaire. Comment identifier quel drone est ciblé par l'action (dropdown ? auto si 1 seul drone du joueur dans le roster ?).

---

### GAPS MINEURS

**SIM-M1 — `base_ini` vs `base_initiative`**
Plan pseudocode : `base_ini: 12`. Colonne DB (migration 56) : `base_initiative`. Risque de typo.

**SIM-M2 — `severity === null` (degatsNets < 5)**
Integrity décrémentée mais aucune case JSONB cochée → divergence visible dans DroneWindow. Comportement V1 acceptable (cf. B4) mais non documenté dans le plan. Ajouter note de comportement dans le code.

**SIM-M3 — `chk_action_type` CHECK et `'drone_auto'`**
Migrations 61 + 63 modifient un CHECK sur `combat_actions`. À vérifier : ce CHECK couvre-t-il `action_key` (ou seulement un champ `type` séparé) ? Si oui, `'drone_auto'` doit être ajouté dans une migration.

**SIM-M4 — `damage_formula` parsing**
`drone_weapons.damage_formula` = TEXT libre ("2d6+3"). Vérifier que `diceParser.js` accepte ce format. Non confirmé.

**SIM-M5 — Sprint 3 : `TELEPILOTAGE` skill — nom de colonne non vérifié**
`ref_skills WHERE skill_key = 'TELEPILOTAGE'` : vérifier que `skill_key` est bien le nom de colonne et que le skill existe en DB après migration 74.

---

### Synthèse — ordre de résolution recommandé

**Avant toute migration :**
- SIM-A1 : +`DRONE_INTEGRITY_UPDATED` dans `events.js` (1 ligne)
- SIM-B2 : export `RD_TABLE` + `lookupTable` dans `charStats.js` (2 lignes)
- SIM-M3 : vérifier `chk_action_type` → migration si nécessaire
- SIM-A2 : valider sémantique rd pour drones (LdB p.319)

**Migrations dans l'ordre :**
1. SIM-B1 : `76c_drone_weapons_schema` (ALTER TABLE)
2. Migration 76 : `combat_actions.drone_weapon_inv_id` + XOR CHECK
3. Migration 76b : `combat_roster.acquired_target_token_id`
4. C1 : split catégories armement (avant Sprint 2c)
5. Migration 77 + 77b : télépilotage (Sprint 3)

**Sprints dans l'ordre (après migrations) :**
1. Sprint 2a (micro — COMBAT_START INI 12) — le plus safe
2. Sprint 2b — résoudre SIM-A2 + SIM-A3 + SIM-A8 avant
3. Sprint 2d — résoudre SIM-A4 + SIM-A5 + SIM-A6 + SIM-B4 avant
4. Sprint 2c — bloqué par SIM-B1 + SIM-B3 (C1)
5. Sprint 3 — résoudre SIM-U4 + SIM-M5 avant
---

## Session 88 — Consolidation corrections plan — 2026-06-11

**Statut corrections (10 edits appliqués à PLAN_DRONESYSCOMBAT.md) :**
- ✅ SIM-M1 : `base_ini` → `base_initiative`
- ✅ SIM-B2 : `calcDroneRD` → `lookupTable(RD_TABLE, rdInput, 'rd')`
- ✅ SIM-B3 : PD3 note — deux exports requis (`RD_TABLE` + `lookupTable`)
- ✅ SIM-A8 : `damages.detruit = true` avant UPDATE
- ✅ SIM-A1 : events.js comment mis à jour
- ✅ SIM-B4 : `campaign_id: campaignId` dans INSERT Sprint 2d
- ✅ SIM-A5 : broadcast COMBAT_ACTION_DECLARED noté Sprint 2d
- ✅ SIM-A7 : parsing `droneWeaponInvId` noté COMBAT_ACTION_DECLARE handler
- ✅ SIM-A6 : Option rows retry INI 7/2 — pseudo-code complet
- ✅ SIM-B1 : Migration 76c documentée — ALTER TABLE drone_weapons
- ✅ C1 : TODO mis à jour — tableau décisions + SQL migration 76d

**Reste ouvert pour l'implémentation :**
- SIM-A2 : sémantique RD validée → à appliquer dans le code (export charStats.js)
- SIM-A3 : `pendingDamageActions` drone attaquant PJ — non résolu dans le plan (hors scope V1 ?), à vérifier pendant Sprint 2c
- SIM-M3 : vérifier contrainte `chk_action_type` avant migration 76
- SIM-U* : items UI (DroneWindow, CombatTimeline) — à traiter pendant les sprints correspondants

**Plan PLAN_DRONESYSCOMBAT.md : COMPLET — prêt pour implémentation Sprint 2a.**

---

## Session 94 — Sprint Drones 2c — Analyse pré-implémentation — 2026-06-12

### État post-Sessions 89-93 (acquis confirmés par lectures)

- Sprint 2a ✅ — drone à INI 12 dans la timeline
- Sprint 2b ✅ — drone comme cible (RD_TABLE exportée, DRONE_INTEGRITY_UPDATED dans events.js, migration 76 appliquée, resolveDroneIntegrityLoss live)
- Fix CombatActionWindow ✅ — isDrone detection, guards, sections masquées pour drones, canDeclare drone

### Findings Session 94 — Lectures effectuées

**F1 — GET /drone/weapons (char-sheet.js:1766) fait INNER JOIN sur ref_equipment**
Après migration 76c (equipment_id nullable), les armes custom (equipment_id=NULL) n'apparaîtront pas.
De plus, les nouvelles colonnes (name, damage_formula, fire_mode, portee) ne sont pas retournées.
Fix requis : LEFT JOIN + SELECT nouvelles colonnes + COALESCE(drone_weapons.name, ref_equipment.name) as name

**F2 — POST /drone/weapons (char-sheet.js:1795) guard equipment_id obligatoire**
Guard actuel : `if (!equipment_id) throw 400`. Incompatible Option A (arme sans ref_equipment).
Fix requis : retirer ce guard après migration 76c.

**F3 — CombatGmDeclareWindow.jsx : allPnjs filtre type='pnj' seulement**
`allPnjs = roster.filter(...).filter(isPnj)` + `if (allPnjs.length === 0) return null`
Si seuls des drones dans le roster → fenêtre absente → GM ne peut pas déclarer pour drone.
Fix requis : inclure les drones dans la liste GM-managée.

**F4 — Migration 76d — SQL besoin JOIN sur ref_equipment**
drone_programs n'a pas de colonne `name` directe. Le plan SQL simplifié ne fonctionnera pas tel quel.
Fix : sous-requête ou JOIN pour filtrer par ref_equipment.name.
```sql
UPDATE drone_programs SET category = 'armement_distance'
WHERE equipment_id IN (SELECT id FROM ref_equipment WHERE name IN ('Tir', 'Bombardement'));
```

**F5 — SIM-M3 : chk_action_type CHECK — pas de problème pour Sprint 2c**
CHECK est sur colonne `type` (pas `action_key`). Sprint 2c utilise `type='assault'` (existant). OK.
Sprint 2d utilise `action_key='drone_auto'` (sans CHECK sur action_key). OK.

**F6 — SIM-A3 confirmé hors scope : pendingDamageActions pour drone attaquant PJ**
resolveDroneAssaultAction doit peupler pendingDamageActions avec formula + modDomAttaque pour COMBAT_DAMAGE_PROMPT vers PJ.
Format identique au path humanoïde — seule différence : formula vient de drone_weapons, pas char_inventory.

### Plan Sprint 2c — 7 fichiers + 2 nouveaux

Voir section PLAN ci-dessous.

### Findings Session 94 — Vérification architecture finale (handlers lus)

**F7 — COMBAT_DAMAGE_CONFIRM : champs pendingDamageActions CONFIRMÉS**
Handler lu (socket/index.js:2276-2282). Destructuring complet :
```
campaignId, targetTokenId, characterIdCible, cibleType, char_sheet_id_cible,
mr, portee, fire_mode_bonus_dmg, formula,
for_na_cible, con_na_cible, vol_na_cible,
tireurUsername, tireurColor, userId, targetName,
type (pendingType), modDom, combatModeBonus
```
Pour drone attaquant PJ : fire_mode_bonus_dmg=0, type='assault', modDom=null, combatModeBonus=null.
Branche cibleType==='drone' présente (Sprint 2b). Branche humanoid fonctionne avec for/con/vol fetchés depuis cible.

**F8 — COMBAT_ACTION_DECLARE : droneWeaponInvId absent + PC22 bloque drone (CRITIQUE)**
Handler lu (socket/index.js:1869-1920). `mapActions.attack` destructure weaponInvId mais PAS droneWeaponInvId.
Guard ligne 1871 : `if (!weaponInvId)` → error "Arme requise (PC22)" → drone bloqué à la déclaration.
Fix : branchement isDrone dans le bloc attack → validation droneWeaponInvId séparée + ajout au INSERT.
Note : isDrone déjà calculé ligne 1932 pour INI delta — peut être remonté avant le bloc attack.

**F9 — resolveAssaultAction ligne 3584 : guard confirmé, branchement drone AVANT**
Signature lue : `async function resolveAssaultAction(io, socket, campaignId, action, confirmedModifiers, character)`
Ligne 3584 : `if (!action.weapon_inv_id || !action.target_token_id) return` → bloque drone.
Fix : ajouter au tout début de la fonction, avant ce guard :
  `if (character.type === 'drone') return resolveDroneAssaultAction(...)`
char_sheet fetch ligne 3613 : `?.` → null pour drone → sheetTireur=null → bloc skillTotal sauté. Safe si branchement évite d'y arriver.

**F10 — advanceSlot comportement : appel inconditionnel après assault (non-bloquant)**
COMBAT_ACTION_CONFIRM : needsDefenseWait=false pour toute assault (resolveAssaultAction ne retourne pas un bool).
advanceSlot appelé ligne 2259 systématiquement après assault. Comportement voulu : slot avance même si COMBAT_DAMAGE_PROMPT en attente. PJ confirme ses dégâts de façon asynchrone. Pattern identique humanoïdes ranged. ✅ Pour drone: slot avance toujours après résolution.

**F11 — drone_sheet.taille confirmé (migration 71 ligne 14)**
Colonnes drone_sheet : taille INTEGER, vitesse INTEGER, blindage INTEGER DEFAULT 0, blindage_iem INTEGER DEFAULT 0, integrite_actuelle, localisation_ref TEXT DEFAULT 'corps'.

**Verdict final — 100% prêt pour Sprint 2c**
Architecture complète, tous les handlers vérifiés, aucune zone d'ombre résiduelle.

---

