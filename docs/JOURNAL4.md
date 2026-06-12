# JOURNAL4 — Projet Enclume
> Démarré : Session 86 (2026-06-10)
> JOURNAL1, JOURNAL2, JOURNAL3 archivés dans `docs/Old/`

---

## Session 86 — Mise à jour documentaire complète — 2026-06-10

**Objectif :** Archivage et rationalisation de la documentation accumulée depuis Session 64.

**Actions réalisées :**
- `docs/JOURNAL3.md` archivé → `docs/Old/JOURNAL3.md` (Sessions 64–85, ~3000 lignes)
- `docs/JOURNAL4.md` créé (ce fichier)
- Plans terminés archivés → `docs/Old/` :
  - `PLAN_REWORKDESIGN.md` (Sprint Rework Design — achevé Session 83)
  - `PLAN15_BIBLIOTHEQUE.md` (Sprint Bibliothèque — achevé Session 75/80)
  - `PLAN14_StatusEffects.md` (Status effects — architecture différente, superseeded par PLAN_STATUT)
  - `Character/PLAN_STATUT.md` (Token statuses — migration 68, TokenStatusPanel — achevé Session 77)
- `docs/EN_COURS.md` réduit à sa forme canonique (dettes actives + prochains chantiers uniquement)
- `docs/ASBUILT.md` mis à jour : header Session 85, migrations 74–75, annotations composants Sessions 84–85

**`docs/PLAN_DRONE.md` conservé** — Sprint 2 (intégration combat : initiative INI 12, jets programme, dommages intégrité, taille cible) non encore défini.

---

## Session 87 — Audit critique PLAN_DRONESYSCOMBAT.md — 2026-06-10

**Objectif :** Analyse exhaustive du plan drone combat (25 issues V1–V25), résolution de toutes les ambiguïtés, application de 15 corrections au plan.

### Analyse (V1–V25)

Issues identifiées et résolues sur `docs/PLAN_DRONESYSCOMBAT.md` :

| # | Nature | Résolution |
|---|---|---|
| V3 | Formule `integrite_actuelle` FAUSSE (Math.floor/5 = 3–5× trop) | `integrite -= 1` par hit, sauf `'detruit'` → 0 (LdB p.82-88) |
| V5 | Contrainte XOR absente sur Migration 76 | `ADD CONSTRAINT chk_weapon_xor CHECK (weapon_inv_id IS NULL OR drone_weapon_inv_id IS NULL)` |
| V6 | COMBAT_ACTION_DECLARE bloque les drones (type='drone' tombe dans `else` → `user_id = null` → refusé) | Étendre condition : `character.type === 'pnj' \|\| character.type === 'drone'` |
| V8+V13 | Deux bugs structurels Sprint 2b : modDegatsMode absent + rawDice indisponible pour PJ | Architecture deux branches : Cas A (PNJ→drone dans resolveAssaultAction) + Cas B (PJ→drone dans COMBAT_DAMAGE_CONFIRM après calcul commun degautsBruts) |
| V10 | `drone_sheet.token_id` inexistant | tokenId passé en paramètre → signature `resolveDroneIntegrityLoss(io, campaignId, characterId, tokenId, droneSheet, degatsNets)` |
| V11 | `combat_actions.roster_id` FK supposée | FAUX POSITIF — combat_actions utilise token_id (migration 54), pas roster_id |
| V14 | `weapon.melee` inexistant dans drone_weapons | `weapon.fire_mode === 'cc'` |
| V15 | `isRushedMod` dans formule drone (dead code) | Supprimé — drones ne se précipitent pas |
| V16 | `ammo_restant` hors schéma | Hors scope V1 → TODO B6 |
| V18 | `r.character_type` inexistant dans combat_roster | JOIN SQL combat_roster→tokens→characters |
| V19 | `computeSequence(12)` inexistant | `sequence: 3` directement |
| V20 | Guard ~3443 bloque drone_auto (weapon_inv_id=null) | Dispatch drone_auto AVANT le guard existant |
| V21 | INI télépilotage non défini | **Option C** : propriétaire déclare "Télépiloter" → `drone_weapon_inv_id` dans ses combat_actions → drone `status='done'` ce round |
| V23 | Migration state_control_mode absente | Migration 77b ajoutée dans Sprint 3 |
| V24 | `fire_mode` nullable sans default | `NOT NULL DEFAULT 'rc'` |

**Faux positif :** V11 (roster_id) — pas d'action requise.
**Hors scope confirmés :** V2 (déplacement CaC), V17 (portée auto-parsée).
**Décisions design :** V12 (épave intentionnelle — pas de TOKEN_DELETED auto), V21 (Option C).

### 15 corrections appliquées à `docs/PLAN_DRONESYSCOMBAT.md`

1. Vision table — catégorie armement par fire_mode explicite
2. Différences mécaniques — "Dégâts PJ" — COMBAT_DAMAGE_PROMPT+CONFIRM
3. Migration 76 — contrainte XOR CHECK ajoutée
4. Sprint 2a — `forcedNotSurprised: true` + note is_surprised=false dans rosterRows.map
5. Sprint 2b — restructuration complète en deux branches (Cas A PNJ + Cas B PJ)
6. `resolveDroneIntegrityLoss` — signature tokenId, formule V3, épave documentée, TODO B4
7. Smoke test Sprint 2b — deux smoke tests (A et B)
8. Sprint 2c — `fire_mode === 'cc'`, suppression isRushedMod, ammo_restant → TODO B6
9. Sprint 2d — JOIN SQL, suppression state_control_mode filter, sequence=3, token_id (pas roster_id)
10. Sprint 3 — Migration 77b ajoutée, Phase ANNOUNCEMENT → Option C, séquence télépilotage
11. "Ce qui NE change PAS" — COMBAT_DAMAGE_CONFIRM → deux lignes (Sprint 2b + path humanoïde)
12. PD2 — dispatch drone_auto AVANT le guard (pas modification du guard)
13. PD8 — marqué ✅ RÉSOLU (tokenId en paramètre)
14. drone_weapons schéma — `fire_mode NOT NULL DEFAULT 'rc'`
15. TODO — B4 mis à jour (overflow seul), B6 ajouté (ammo_restant), B5 lié à B4

### État du plan après Session 87

`docs/PLAN_DRONESYSCOMBAT.md` : **prêt pour implémentation**.
- Migrations définies : 76, 76b, 77, 77b
- Sprints 2a, 2b, 2c, 2d, 3 : architecture complète, bugs résolus
- Prérequis avant Sprint 2c : C1 (migration split catégories armement_distance/armement_contact)



---

## Session 88 — Simulation Sprint Drones 2-3 + corrections plan — 2026-06-11

**Objectif :** Simulation à blanc des Sprints 2a/2b/2c/2d/3 pour identifier tout ce qui est manquant, ambigu ou nécessite rework. Résultat : 17 findings, 3 décisions design, 10 corrections appliquées au plan.

### Findings simulation (SIM-B1 à SIM-M5)

| # | Catégorie | Trouvé |
|---|---|---|
| SIM-B1 | Bloqueur | Migration 71 schéma drone_weapons incompatible Option A → Migration 76c requise |
| SIM-B2 | Bloqueur | `calcDroneRD` indexe RD_TABLE par entier clé → FAUX (RD_TABLE = [{min,max,rd}]) |
| SIM-B3 | Bloqueur | `RD_TABLE` et `lookupTable` non exportés de charStats.js → PD3 export requis |
| SIM-B4 | Bloqueur | `campaign_id` manquant dans INSERT combat_actions Sprint 2d |
| SIM-A1 | Architectural | DRONE_INTEGRITY_UPDATED absent de shared/events.js — confirmé par lecture du fichier |
| SIM-A2 | Architectural | Sémantique RD : `integrite_actuelle × 2` ou `integrite_max × 2` ? |
| SIM-A3 | Architectural | `pendingDamageActions` non documenté pour drone attaquant humanoïde PJ |
| SIM-A4 | Architectural | Auto-announcement Sprint 2d : timing exact phase ANNOUNCEMENT non défini |
| SIM-A5 | Architectural | COMBAT_ACTION_DECLARED non broadcasté pour drones auto-annoncés → timeline figée |
| SIM-A6 | Architectural | Retry INI 7/2 : mécanisme Option rows non documenté |
| SIM-A7 | Architectural | COMBAT_ACTION_DECLARE handler ne parse pas `droneWeaponInvId` |
| SIM-A8 | Architectural | `damages.detruit` jamais mis à true avant UPDATE drone_sheet |
| SIM-M1 | Mineur | `base_ini` (inexistant) au lieu de `base_initiative` dans pseudocode COMBAT_START |
| C1 | Catalogue | Catégories programmes : décisions Tir/Bombardement/Attaque/Contre-attaque/Contrôle armement |

### Décisions design (3 questions posées, validées Session 88)

1. **SIM-A2 — Sémantique RD :** `integrite_actuelle` confirmé correct. Comportement drone endommagé = noyau durci = acceptable LdB p.88. Validé.
2. **SIM-A6 — Retry INI 7/2 :** Option rows retenue — insertion dynamique de rows `combat_actions` supplémentaires pendant la résolution du slot.
3. **C1 — Catégories programmes :** Tir → `armement_distance`, Bombardement → `armement_distance`, Attaque → `armement_contact`, Contre-attaque → inchangé (`contre_attaque`), Contrôle armement → DELETE.

### 10 corrections appliquées à `docs/PLAN_DRONESYSCOMBAT.md`

1. SIM-M1 : `base_ini` → `base_initiative` dans pseudocode COMBAT_START
2. SIM-B2 : `calcDroneRD` réécrit — `lookupTable(RD_TABLE, rdInput, 'rd')` (range lookup, pas index entier)
3. SIM-B3 : PD3 note mise à jour — export `RD_TABLE` ET `lookupTable` requis (deux symboles)
4. SIM-A8 : `if (detruit) damages.detruit = true` ajouté avant UPDATE + note severity=null acceptable V1
5. SIM-A1 : events.js comment → "Confirmé absent (Session 88) — à ajouter avant Sprint 2b"
6. SIM-B4 : `campaign_id: campaignId` ajouté à INSERT combat_actions Sprint 2d
7. SIM-A5 : note broadcast COMBAT_ACTION_DECLARED ajoutée Sprint 2d
8. SIM-A7 : note parsing `droneWeaponInvId` dans COMBAT_ACTION_DECLARE handler (~ligne 1815)
9. SIM-A6 : mécanisme Option rows documenté — pseudo-code `insertRetrySlot`, logique sequence 12/7/2
10. SIM-B1 : Migration 76c ajoutée — ALTER TABLE drone_weapons (reconciliation schéma migration 71)
11. C1 : TODO mis à jour — tableau décisions + SQL migration 76d

### État du plan après Session 88

`docs/PLAN_DRONESYSCOMBAT.md` : **complet et prêt pour implémentation**.
- Migrations définies : 76, 76b, 76c, 76d, 77, 77b
- Tous les blockers SIM-B1→B4 résolus dans le plan
- RD_TABLE : export charStats.js requis avant tout coding (PD3)
- Prochaine étape : Sprint Drones 2a (COMBAT_START + base_initiative)

---

## Session 89 — Correctifs UI combat + campagne — 2026-06-11

**Objectif :** Correction de 7 bugs identifiés (+ 4 signalés en cours de session).

### Bugs corrigés

**Bug 7 — Actions CaC jamais résolues** (`CombatActionWindow.jsx`)
- Cause : branche `myMeleeAction ?` dans le footer de résolution cachait le bouton "Agir" → `COMBAT_ACTION_CONFIRM` jamais émis
- Fix : suppression de la branche `myMeleeAction` dans le footer (assault et reload conservent leurs messages d'attente)
- Validé ✅

**Bug 4 — Icônes statut au-dessus de tout** (`Canvas3D.jsx`)
- Cause : Drei `<Html>` utilise `zIndexRange=[16777271, 0]` par défaut, au-dessus de toute l'UI
- Fix : ajout `zIndexRange={[1, 0]}` sur le composant `<Html>` des icônes statut (ligne 276)
- Validé ✅

**Bug 5 — Options de jet critique non mémorisées** (`CampaignSettingsPage.jsx`)
- Cause : au chargement, `dice_config` existant restaurait uniquement `expertRows` via `initExpertRows` — `successOn`, `failOn`, `successActive`, `failActive`, `expertMode` jamais restaurés
- Fix : ajout de `detectSimpleConfig(cfg)` qui lit l'entrée d20 pour dériver les 4 états simples ; au chargement : mode simple → 4 états + `expertMode=false` ; mode expert → `expertMode=true`
- Validé ✅

**Terminologie CDR → Seuil** (`server/src/socket/index.js`, `CombatModifiersWindow.jsx`, `SessionPage.jsx`)
- Cause : champ `cdr` (non-Polaris) utilisé dans les payloads WS COMBAT_ATTACK_PLAYER_RESULT — terme ambigu et absent du LdB
- Fix : renommage `cdr` → `seuil` dans les 2 émissions COMBAT_ATTACK_PLAYER_RESULT + console.log + commentaires + UI label
- Validé ✅

**Chat assault — DICE_RESULT structuré pour 4 jets combat** (`server/src/socket/index.js`)
- Cause : jets de combat émettaient DICE_RESULT minimal (sans `skillLabel`, `mechanicalTotal`, `diffLabel`, `chancesDeReussite`, `isSuccess`, `mr`) → Sidebar affichait un jet générique anonyme
- Fix : ajout des 6 champs structurés dans les 4 émissions (assaut tir, CaC attaque, CaC défense PJ, CaC défense PNJ) avec labels "Jet pour toucher (distance/contact)" et "Jet pour défendre (contact)"
- Validé ✅

**Dé toujours grand et aligné à droite** (`Sidebar.jsx`)
- Cause : `diceTotal` base à 15px (vs 20px dans les overrides skillcheck/déplacement) + pas de `marginLeft: 'auto'` → alignement variable selon le type de message
- Fix : `diceTotal` → `fontSize: '20px'` + `marginLeft: 'auto'` ; suppression des overrides inline redondants (déplacement l.998, skillcheck l.1034)
- Validé ✅

### Bugs restants (en cours de session)

- Bug 1 : Token 3D changement sans effet (regression) — deferred (cause racine = Bug D1 drones)
- Bug 2 : Joueurs — modifier leur propre token 3D — ✅ Session 90
- Bug 6 : Messages chat absents pendant le combat — mauvais diagnostic, fermé
- Bug supplémentaire : Munitions non vérifiées en phase ANNOUNCEMENT

**Bug CaC arme auto — sélection automatique arme de mêlée** (`CombatActionWindow.jsx`)
- Cause : `selectedMeleeWeaponId` initialisé à `null` (mains nues), aucune auto-sélection à la déclaration CaC
- Fix : après `setMapSelected` dans `handleMapToggle` — si `k === 'melee'` et `meleeWeapons.length > 0` → `setSelectedMeleeWeaponId(meleeWeapons[0].id)`
- Fallback mains nues conservé si aucune arme de contact équipée
- Validé ✅

**Bug 3 — Bloquer Assaut/CaC si arme non au clair + suppression QB** (`CombatActionWindow.jsx`)
- Cause QB : bloc `willAttackOrMelee` forçait `weapon: 'drawn'` automatiquement à la sélection attack/melee — contournait la règle LdB (dégainer = action, coûte −3/−5 INI)
- Fix : suppression du bloc QB complet + `prevWeaponRef` + `wasAttackOrMelee`
- Blocage : guard dans le render MAP_ACTIONS — attack/melee grisés si `states.weapon !== 'drawn'`
- Surbrillance : prop `highlightKey` ajoutée à `StateSelector` — bordure bleue sur option 'Au clair' tant que l'arme n'est pas au clair
- Validé ✅

**Bug Flash blanc — rechargement silencieux panels onglet Matériel** (`ArmorWoundPanel.jsx`, `WeaponPanel.jsx`, `InventoryPanel.jsx`)
- Cause : `setLoading(true)` appelé à chaque bump de `reloadKey` (déclenché par WS WOUND_ADDED etc.), provoquant un flash "Chargement…" à chaque mise à jour
- Fix : ajout de `hasLoadedRef` dans les 3 composants — `setLoading(true)` uniquement au premier chargement, rechargements WS suivants silencieux
- Validé ✅

---

## Session 90 — Bug 2 : upload GLB token par le joueur propriétaire — 2026-06-11

**Objectif :** Permettre au joueur propriétaire d'un personnage de modifier son token 3D GLB.

**Cause :**
- `CharacterWindow.jsx` : condition `{isGm && (...)}` englobait le bouton GLB upload ET le bouton Supprimer — le joueur propriétaire ne voyait pas le bouton
- `server/src/routes/characters.js` : guard `member.role !== 'gm'` rejetait toute requête joueur, même propriétaire

**Fix :**
- `CharacterWindow.jsx` : séparation du bloc en deux conditions indépendantes — GLB upload → `(isGm || isOwner)`, bouton Supprimer → `isGm` (inchangé)
- `characters.js` route `POST /:id/glb` : guard étendu → `member.role !== 'gm' && character.user_id !== req.user.id`
- `isOwner` déjà calculé correctement ligne 69 via `character._currentUserId` injecté par SessionPage

**Ce qui ne change pas :** route portrait (déjà owner-accessible), MinIO path, broadcast `CHARACTER_UPDATED`.

**Note :** hors scope drones (Bug D2 — deferred, cause racine non résolue).

- Validé ✅

---

## Session 90 — Bug Munitions : vérification en phase ANNOUNCEMENT — 2026-06-11

**Objectif :** Bloquer la déclaration d'assaut si les munitions sont insuffisantes (MANUELSYSCOMBAT §4).

**Cause :**
- `server/src/socket/index.js` handler `COMBAT_ACTION_DECLARE` : `char_inventory.ammo_remaining` non sélectionné → aucune vérification de stock en ANNOUNCEMENT
- La vérification n'avait lieu que lors de la résolution

**Fix :**
- Ajout de `'char_inventory.ammo_remaining'` dans le SELECT de l'arme (bloc `if (mapActions?.attack)`)
- Guard ajouté après le check `TIR_AUTOMATIQUE` : si `ammo_remaining !== null && ammo_remaining < bulletCount` → émet `COMBAT_DECLARE_ERROR` avec message "Munitions insuffisantes — rechargez d'abord"
- Exception PNJ : si `campaign.pnj_unlimited_ammo = true` → bypass du guard
- `ammo_remaining = null` → tracking désactivé → pas de vérification

**Ce qui ne change pas :** consommation des munitions (RESOLUTION uniquement), logique TIR_AUTOMATIQUE, autres guards ANNOUNCEMENT.

- Validé ✅

---

## Session 91 — CombatDeclareLog : panneau cumulatif des déclarations — 2026-06-11

**Objectif :** Remplacer le flash "vient d'annoncer" (per-acteur, éphémère) par un panneau cumulatif persistant visible GM + joueurs pendant toute la phase ANNOUNCEMENT et RESOLUTION.

**Problèmes résolus :**
- PNJ declarations non broadcastées visuellement côté joueurs
- Fenêtre per-acteur écrasée à chaque nouvelle déclaration
- Aucune visibilité sur les actions déclarées en lecture seule (joueur déjà déclaré, en attente de slot)

**Architecture :**
- `announcedActions[]` dans `combatStore` — cumul du tour, reset sur `COMBAT_PHASE_CHANGED { phase: 'ANNOUNCEMENT' }` et `COMBAT_ENDED`
- `SessionPage.jsx` : destructure `actionType` dans handler `COMBAT_ACTION_DECLARED` + appel `addAnnouncedAction`
- `CombatOverlay.jsx` : `announcePanel` block désactivé (commenté), `<CombatDeclareLog />` monté pour GM + joueurs pendant ANNOUNCEMENT/RESOLUTION
- `CombatActionWindow.jsx` : `declarationsLog` remplace `rosterSection` dans les 3 branches read-only uniquement
- Nouveau `CombatDeclareLog.jsx` : composant standalone draggable, fond texturé lecture seule (dot-grid CSS), toggle ▲/▼

**Fichiers modifiés :** `combatStore.js`, `SessionPage.jsx`, `CombatOverlay.jsx`, `CombatActionWindow.jsx`, `index.css`
**Fichier créé :** `CombatDeclareLog.jsx`

### Correctifs architecture CombatDeclareLog (consolidation Session 87)

L'état décrit ci-dessus reflétait une version intermédiaire avec des bugs. Corrections finales appliquées :

**Double fenêtre côté joueur**
- Cause : `CombatDeclareLog` monté sans guard pour tous les utilisateurs → joueurs voyaient le standalone ET le `declareLogSection` dans CombatActionWindow
- Fix `CombatOverlay.jsx` : `{isGm && (phase === 'ANNOUNCEMENT' || phase === 'RESOLUTION') && <CombatDeclareLog />}`
- Fix `CombatActionWindow.jsx` : `ACTION_LABELS` + `PURE_MOVE_TYPES` restaurés en module-level ; `declareLogSection` remplace `rosterSection` dans les 3 branches read-only
- Architecture finale : GM = standalone flottant ; Joueur = section intégrée lecture seule

**Style HUD sombre → lecteur clair**
- Fix `index.css` : `.combat-declare-log-*` → fond `#f4f7f8`, texte `#1a2a3a`
- Classes partagées GM/joueur — source unique

**Dettes ouvertes documentées dans `docs/BUGIDENTIFIE.md` :**
- **Bug CL1** — Portraits PNJ non visibles dans la timeline joueur (PNJ absent du characterStore joueur)
- **Bug CL2** — Design CombatDeclareLog + divergence GM/joueur (référence : version GM)
- **Bug CL3** — Ghosts déplacement d'annonce disparus (régression `announcementMarker`)

---

## Session 89 — Sprint Drones 2a : drone INI 12 dans la timeline — 2026-06-11

**Objectif :** Drone apparaît dans la CombatTimeline à initiative 12 fixe. Fondation minimale du Sprint Drones 2.

**Fichier modifié :** `server/src/socket/index.js` (4 touches)

| Touch | Ligne | Changement |
|---|---|---|
| 1 | ~1478 | `character` fetché en premier dans COMBAT_START — branche `type==='drone'` : `base_ini: 12, forcedNotSurprised: true, continue` (PD1) |
| 2 | ~1513 | `rosterRows.map` : destructure `forcedNotSurprised` → `is_surprised = !forcedNotSurprised && ...` |
| 3 | ~1825 | COMBAT_ACTION_DECLARE guard étendu : `character.type === 'pnj' \|\| character.type === 'drone'` → GM obligatoire (V6) |
| 4 | ~1930 | `isDrone` + `if (!isDrone)` wrappant tout le bloc `iniDelta` — pas de coûts de transition pour les drones |

**Ce qui ne change pas :** path humanoïde PJ/PNJ intact ligne à ligne. Aucune migration.

**Contrainte opérationnelle Sprint 2a :** drone reste `has_announced = false` en ANNOUNCEMENT → GM doit COMBAT_SKIP_PLAYER jusqu'à Sprint 2d (auto-announcement).

**Validé ✅** — SR sans erreur. Drone visible dans CombatTimeline à INI 12.


---

## Session 92 - Sprint Drones 2b : drone comme cible - 2026-06-11

**Objectif :** Un humanoide (PJ ou PNJ) attaque un drone - integrite decrementee, DroneWindow mise a jour en temps reel.

### Regles LdB appliquees (§7.6 MANUELSYSCOMBAT.md)

- Localisation unique fixe (`drone_sheet.localisation_ref`) - pas de jet D20
- Armure = `drone_sheet.blindage` (valeur directe, pas `calcResistanceArmure`)
- `rd = integrite_actuelle x 2 -> table RD LdB p.112` - semantic inverse : drone sain = plus vulnerable, drone endommage = noyau durci
- `degats_nets = max(0, degats_bruts - blindage - rd)`
- Pas de `character_wounds`. Pas de Test de Choc.
- Destruction (`integrite_actuelle <= 0`) -> retrait immediat du roster

### Architecture

**Deux chemins d'attaque :**
- **Cas A (PNJ->drone)** : resolution auto dans `resolveAssaultAction` - branche `cibleCharacter?.type === 'drone'`
- **Cas B (PJ->drone)** : `COMBAT_DAMAGE_PROMPT` -> joueur lance les des -> `COMBAT_DAMAGE_CONFIRM` - branche `cibleType === 'drone'`

**`cibleType` propagation :** ajoute dans `pendingDamageActions` (melee `commonPending` + ranged `pendingDamageActions.set`) pour que `COMBAT_DAMAGE_CONFIRM` detecte le drone sans acces a `cibleCharacter`.

### Touches

| Touch | Fichier | Changement |
|---|---|---|
| T0 | `server/src/db/migrations/76_combat_actions_drone.js` (NEW) | `drone_weapon_inv_id UUID REFERENCES drone_weapons(id) + XOR constraint` - fondation Sprint 2c |
| T1 | `shared/events.js` | `DRONE_INTEGRITY_UPDATED: 'drone:integrity_updated'` |
| T2 | `server/src/lib/charStats.js` | `export const RD_TABLE` + `export function lookupTable` |
| T3 | `server/src/socket/index.js` | Import RD_TABLE/lookupTable + `calcDroneRD(integrite)` + `resolveDroneIntegrityLoss(...)` |
| T4 | `server/src/socket/index.js` | `cibleType: defenderCharacter.type` dans `commonPending` (CaC path) |
| T5 | `server/src/socket/index.js` | `cibleType: cibleCharacter?.type ?? null` dans `pendingDamageActions.set` (ranged path) |
| T6 | `server/src/socket/index.js` | Branche drone dans `COMBAT_DAMAGE_CONFIRM` (PJ->drone) |
| T7 | `server/src/socket/index.js` | Branche drone dans `resolveAssaultAction` PNJ (Cas A) |
| T8 | `client/src/character/DroneWindow.jsx` | `socket` prop + useEffect souscription `DRONE_INTEGRITY_UPDATED` |
| T9 | `client/src/pages/SessionPage.jsx` | `socket={socket}` passe a DroneWindow |

### Pieges resolus

- **PD3** : `RD_TABLE` et `lookupTable` etaient non exportes - export ajoute
- **PD4** : `const damages = { ...droneSheet.damages }` - copie avant mutation JSONB
- **PD5** : `DroneWindow.jsx` abonnement `DRONE_INTEGRITY_UPDATED` - temps reel
- **PD8** : `drone_sheet` n'a pas de `token_id` - passe en parametre a `resolveDroneIntegrityLoss`
- **Z1** : `COMBAT_ATTACK_RESULT` ajoute dans les deux branches drone (timeline combat)
- **Z2** : `COMBAT_DAMAGE_RESULT` ajoute dans la branche PJ->drone (ferme `CombatDamageWindow`)
- **Z3** : `cibleType = null` default dans destructuring `COMBAT_DAMAGE_CONFIRM` - retrocompatibilite

**Valide OK** - SR sans erreur. Migration 76 appliquee automatiquement au demarrage.

---

## Session 93 - Fix CombatActionWindow : drone comme declarant - 2026-06-11

**Symptome :** Impossible de declarer l'action d'un drone controle par un PJ - bouton "Declarer" toujours grise, aucun message d'erreur.

**Cause racine :** `canDeclare = (hasAnyAction || stateChanged) && assaultValid && ...`
- Pour un drone : aucun etat modifiable visible, `states.weapon !== 'drawn'` bloque attack + melee, `isAmmoEmpty = true` (aucune arme en `char_inventory`) -> `hasAnyAction = false`, `stateChanged = false` -> `canDeclare = false` silencieux.

**Fix - `client/src/components/CombatActionWindow.jsx` uniquement, 6 touches :**

| Modif | Detail |
|---|---|
| `const isDrone = playerChar?.type === 'drone'` | Detection drone apres isStunned |
| POSTURE + VITESSE -> `{!isDrone && ...}` | Masques pour drones uniquement |
| Section ARMEMENT (weapon + fire_mode) -> `{!isDrone && (...)}` | Masquee pour drones |
| `if ((a.k === 'melee' OR a.k === 'reload') && isDrone) return null` | CaC + Recharger masques pour drones |
| weapon guard -> `&& !isDrone` | Condition "arme au clair" desactivee pour drones |
| Section ACTIONS RAPIDES -> `{!isDrone && (...)}` | Observer/Reperer/Phrase masques pour drones |
| `canDeclare = isDrone ? (assaultValid && meleeValid) : (existant)` | Drone peut toujours declarer (passer) |

**Ce qui reste visible pour les drones :** COUVERTURE, ACTION (Assaut grise "arme vide" -> Sprint 2c), Deplacement.
**Ce qui NE change PAS :** humanoides PJ/PNJ - zero regression. Payload WS identique. Aucune touche serveur.
**Sprint 2c :** branchement `drone_weapons` dans le panneau Assaut (tir) pour permettre la declaration d'attaque drone.

**Valide OK** - SR sans erreur. Drone peut declarer "passer" ou "se deplacer" en Phase 1.

---

## Session 94 — Sprint Drones 2c : attaque drone déclarée par le GM — 2026-06-12

**Objectif :** Le GM déclare manuellement l'attaque d'un drone en phase ANNOUNCEMENT. Résolution automatique côté serveur via `resolveDroneAssaultAction` en phase RESOLUTION.

### Règles LdB appliquées (§7.3 MANUELSYSCOMBAT.md)

- Programme armement = compétence directe (D20 ≤ niveau = succès, pas d'attributs)
- Modificateurs situationnels identiques aux humanoïdes : portée, taille, obscurité, couverture
- Catégorie programme : `armement_distance` (RC/RL) ou `armement_contact` (CC) selon `drone_weapons.fire_mode`
- Résolution dommages : pipeline complet (formule, MR, localisation, armures, blessures)

### Migrations

| Migration | Objet |
|---|---|
| `76c_drone_weapons_schema.js` | ALTER TABLE drone_weapons : +name, +damage_formula, +portee, +fire_mode NOT NULL DEFAULT 'rc', +notes. `equipment_id` passe nullable (armes custom). Contrainte CHECK fire_mode IN ('cc','rc','rl'). |
| `76d_drone_programs_categories.js` | Renomme category='armement' → 'armement_distance' dans ref_equipment + drone_programs. Prérequis résolveur resolveDroneAssaultAction (lookup par category exacte). |

Les deux migrations appliquées au démarrage.

### Touches

| # | Fichier | Changement |
|---|---|---|
| T1 | `char-sheet.js` GET `/drone/weapons` | INNER JOIN → LEFT JOIN + colonnes name/damage_formula/portee/fire_mode/notes + COALESCE display_name |
| T2 | `char-sheet.js` POST `/drone/weapons` | Accepte `equipment_id` OU `name+damage_formula` (armes custom) — guard allégé |
| T3 | `socket/index.js` COMBAT_ACTION_DECLARE | `isDrone` branch avant PC22 — valide `droneWeaponInvId` dans drone_weapons. INSERT row ajoute `drone_weapon_inv_id` (drone) ou `weapon_inv_id` (humanoïde), mutuellement exclusifs (XOR migration 76). |
| T4 | `socket/index.js` resolveAssaultAction | Branchement `character.type === 'drone'` AVANT le guard `!weapon_inv_id` → appelle `resolveDroneAssaultAction` |
| T5 | `socket/index.js` resolveDroneAssaultAction (NEW) | Résolution complète : programme armement (LEFT JOIN), totalModComp, roll D20, DICE_RESULT broadcast. Trois branches cible : drone (calcDroneRD + resolveDroneIntegrityLoss), PNJ (auto-résolution wounds), PJ (pendingDamageActions + COMBAT_DAMAGE_PROMPT). |
| T6 | `CombatGmDeclareWindow.jsx` | Drones dans le roster GM (`allGmManaged`). Section ARMEMENT DRONE : sélecteur arme via GET /drone/weapons + sélecteur CIBLE + bouton DÉCLARER conditionnel. Guard `canDeclareDrone`. `handleDeclare` branche drone. |
| T7 | `CombatModifiersWindow.jsx` | Import `getTailleCible` (shared/droneConstants.js). useEffect : si cible=drone → GET /drone → `setTaille(getTailleCible(tailleCm))`. Silencieux si cible non-drone (.catch). |

### Architecture resolveDroneAssaultAction

```
Fetch drone_weapon (LEFT JOIN ref_equipment, COALESCE effective_formula/display_name)
Fetch programme armement (WHERE category IN ('armement_distance' | 'armement_contact'))
totalModComp ← confirmedModifiers (portée, taille, situation — identiques §7.3)
chancesDeReussite ← programme.level + totalModComp
Roll D20 → mr = chancesDeReussite - roll
Broadcast DICE_RESULT (programme roll)
  SI raté → COMBAT_ATTACK_RESULT(isSuccess:false), return
Fetch cible (token → character)
fetchCibleNA(charId) → calcAttributeNA FOR/CON/VOL (pattern §3247-3249)
  SI cible=drone  → calcDroneRD + resolveDroneIntegrityLoss + broadcast auto
  SI cible=PNJ    → rollLoc + armures + parseDice + resolveWoundInsertion + WOUND_ADDED
  SI cible=PJ     → pendingDamageActions.set(...) + COMBAT_DAMAGE_PROMPT
advanceSlot appelé par l'appelant (needsDefenseWait=false — pattern ranged)
```

### Pièges résolus

- **PC22-D** : guard droneWeaponInvId en ANNOUNCEMENT (lookup drone_weapons, pas char_inventory)
- **Position isDrone** : const isDrone déplacé avant le bloc attack validation (était après)
- **XOR weapon** : `weapon_inv_id: isDrone ? null : weaponInvId` — contrainte migration 76 respectée
- **Catégorie programme** : `fire_mode === 'cc'` → `armement_contact`, sinon `armement_distance`
- **getTailleCible** : `drone_sheet.taille` INTEGER en cm → clé TAILLES (déjà implémenté shared/droneConstants.js)

**En attente de validation fonctionnelle** — SR non exécuté cette session.
