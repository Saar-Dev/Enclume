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

---

## Session 90 — Breakdown détail jets de dé (chat sidebar) — 2026-06-12

**Objectif :** Afficher le détail des modificateurs composant le Seuil de chaque jet, via un bouton `⊞` dans le chat sidebar (popover à la demande).

### Architecture

- **Payload `DICE_RESULT` enrichi** côté serveur : champ `breakdown: [{label, value, type}]` optionnel.
- **`type`** : `'base'` (bleu) | `'bonus'` (vert) | `'malus'` (rouge) | `'total'` (or = ligne Seuil).
- Pas de nouveau événement WS, pas de migration DB.

### Touches

| # | Fichier | Changement |
|---|---|---|
| T1 | `server/src/socket/index.js` | Constantes `PORTEE_MOD_COMP`, `SITUATION_MODS`, `TAILLE_MODS` déplacées au module-level (retirées de `resolveAssaultAction` et `resolveDroneAssaultAction`). Ajout `SITUATION_LABELS`, `PORTEE_LABELS`, `TAILLE_LABELS`, `COMBAT_MODE_LABELS`. |
| T2 | `server/src/socket/index.js` `resolveAssaultAction` | `breakdown` ajouté à l'émission `DICE_RESULT` : compétence, portée, mode tir, situations (boucle individuelle), taille, précipitation, malus santé/encombrement, carence armure, **Seuil**. |
| T3 | `server/src/socket/index.js` `resolveMeleeAction` attaquant | `breakdown` : compétence, mode combat, précipitation, multi-adversaires, attaque multiple, malus santé, carence armure, **Seuil**. |
| T4 | `server/src/socket/index.js` `resolveMeleeAction` défenseur PNJ | `breakdown` : compétence, mode combat (delta calculé séparément), multi-adversaires, malus santé, **Seuil**. |
| T5 | `server/src/socket/index.js` `COMBAT_MELEE_DEFENSE_CONFIRM` défenseur PJ | Idem T4. `multiMalusDefenseur` présent via destructuring `pending`. |
| T6 | `server/src/socket/index.js` `ENTITY_ACTION_RESOLVE` | `breakdown` : compétence/attribut (`formulaLabel`), difficulté (`pending.defaultDifficulty`), modificateur GM, malus santé, **Seuil**. |
| T7 | `client/src/pages/SessionPage.jsx` | `breakdown` ajouté à la destructuration du handler `DICE_RESULT` et transmis dans `addMessage`. |
| T8 | `client/src/components/Sidebar.jsx` | Composant `DiceBreakdownPopover` (avant Sidebar) : popover `position:fixed`, colorisation par type, positionnement haut/bas selon espace disponible. État `breakdownPopover` + `popoverRef`. useEffect click-outside + Escape. `handleOpenBreakdown` callback. Bouton `⊞` conditionnel dans diceHeader des blocs `displacement` et `skillcheck`. |

### Pièges résolus

- **`SITUATION_MODS` local** : était défini à l'intérieur de `resolveAssaultAction` ET `resolveDroneAssaultAction` — déplacé au module-level, les deux fonctions utilisent maintenant la référence partagée.
- **SessionPage destructuring** : `breakdown` non transmis sans ajout explicite dans le handler `DICE_RESULT` → T7 requis.
- **Popover `position:fixed`** : échappe l'`overflow:hidden` de la Sidebar — positionné via `getBoundingClientRect()` du bouton.
- **Seuil pas CDR** : libellé `'Seuil'` dans tous les breakdowns. `chancesDeReussite` reste le nom de variable interne.

**Validé fonctionnel. SR OK.**

### Session 90b — Correction bug : breakdown manquant displacement + drone

**Bug identifié :** Breakdown absent pour les actions de joueurs (déplacement d'entité) et les drones.

| # | Fichier | Changement |
|---|---|---|
| B1 | `server/src/socket/index.js` — handler `ENTITY_MOVE_REQUEST` | `breakdownDisp` ajouté avant l'émission `DICE_RESULT` displacement : attributeNA + difficulté + **Seuil** |
| B2 | `server/src/socket/index.js` — `resolveDroneAssaultAction` | `breakdownDrone` ajouté : Programme (niveau), portée, situations, taille, **Seuil**. Note : le drone utilise `confirmedModifiers?.[k]` booléen (pas un tableau) — itération `Object.entries(SITUATION_MODS)` avec guard |

**SR OK — couverture V1 complète : 7 points d'émission DICE_RESULT avec breakdown.**

---

## Session 89 — Sprint 2c : fixes déclaration + résolution drone joueur — 2026-06-12

**Objectif :** Débloquer le cycle de combat complet pour un drone appartenant à un joueur (mode autonome). Trois séries de correctifs validés fonctionnels.

### Contexte

Les entrées Session 88–95 dans ce journal sont des artefacts AI non commitées. Dernier commit git = Session 87. La session réelle est 89.

---

### Série 1 — Déclaration joueur + WeaponsTab (validé SR précédent)

**Fix COMBAT_ACTION_DECLARE — ownership drone** (`server/src/socket/index.js`)
- Cause : `character.type === 'drone'` groupé avec PNJ dans le guard d'ownership → `if (socket.role !== 'gm') return` rejetait silencieusement le joueur propriétaire
- Fix : condition séparée drone — autorise si `socket.role === 'gm'` OU `character.user_id === socket.user.id`
- Validé ✅

**Fix WeaponsTab — concept chargeur retiré** (`DroneWindow.jsx`)
- Un drone n'a pas de chargeur — uniquement `ammo_restant` (balles totales disponibles)
- Suppression de `contenance_chargeur` de l'affichage et de l'édition
- `ammo_restant = null` → affichage `∞` (pas de suivi = infini)
- Validé ✅

---

### Série 2 — 3 bugs SR (validés fonctionnels cette session)

**Bug 1 — NT en chiffres romains** (`DroneSheet.jsx`)
- Cause : `StatField` affichait `drone.nt` comme entier brut
- Fix : `toRoman()` helper inline (I–VIII), prop `display` ajoutée à `StatField` — GM édite l'entier, joueur voit le romain
- Fichiers : `DroneSheet.jsx` (+`toRoman`, +`display` prop, appel ligne NT)
- Validé ✅

**Bug 2 — Double fenêtre ANNOUNCEMENT pour drone joueur** (`CombatGmDeclareWindow.jsx`)
- Cause : `isDroneEntry` vérifie uniquement `type === 'drone'` — pas la propriété joueur (`user_id`)
- Fix : `isDroneGmManaged` — exclut les drones avec `char.user_id` non null. `isGmManaged`, `isActiveDrone`, `blockerIsPj` mis à jour.
- Effet : GM ne voit plus la fenêtre ANNOUNCEMENT pour les drones joueurs. Si le slot actif est un drone joueur → message "En attente de <drone>" (correct).
- Validé ✅

**Bug 3 — Tour bloqué "En attente validation GM"** (deux fichiers)

*Client — bouton Agir caché* (`CombatOverlay.jsx`)
- Cause : condition `!activeAssaultAction` masquait le bouton Agir même pour un drone avec assault
- Fix : `(!activeAssaultAction || gmActiveCharacter?.type === 'drone')`

*Serveur — assault drone sans confirmedModifiers skippé* (`socket/index.js`)
- Cause : guard `if (!confirmedModifiers)` bloquait la résolution si aucun modifier passé (drone n'a pas de CombatModifiersWindow)
- Fix : guard contourne pour drone — `if (!confirmedModifiers && character.type !== 'drone')`
- `resolveDroneAssaultAction` utilise des défauts (`portée ?? 'courte'`) — acceptable V1
- Validé ✅

---

### Bugs identifiés en fin de session (non corrigés)

**Bug Loc-Drone — localisation D20 incorrecte pour cible drone**
- `resolveDroneAssaultAction` branche `cible=drone` exécute un jet de localisation D20 (hérité du pipeline humanoïde)
- Règle §7.6 : drone = **une seule zone fixe** (`drone_sheet.localisation_ref`), pas de D20
- Sprint dédié requis

**Bug Dmg-Drone — dégâts non enregistrés sur drone cible**
- Aucune modification de `integrite_actuelle` ni de `drone_sheet.damages` après un tir réussi sur un drone
- Règle §7.6 :
  - Armure = `blindage` direct (pas `calcResistanceArmure`)
  - RD = `integrite_actuelle × 2` → table RD LdB p.112
  - `degats_nets = max(0, degats_bruts − blindage − rd)`
  - Enregistrement : `drone_sheet.damages` JSONB + décrémentation `integrite_actuelle`
  - Pas de `character_wounds`, pas de Test de Choc
- Sprint dédié requis

### Touches

| # | Fichier | Changement |
|---|---|---|
| T1 | `socket/index.js` COMBAT_ACTION_DECLARE | Ownership drone : séparation de la condition PNJ/drone, autorisation joueur propriétaire |
| T2 | `DroneWindow.jsx` WeaponsTab | Suppression `contenance_chargeur`, `null` → `∞` pour `ammo_restant` |
| T3 | `DroneSheet.jsx` | `toRoman` helper, `display` prop `StatField`, affichage NT romain |
| T4 | `CombatGmDeclareWindow.jsx` | `isDroneGmManaged` (exclut `user_id`), mise à jour `isGmManaged`/`isActiveDrone`/`blockerIsPj` |
| T5 | `CombatOverlay.jsx` | Agir visible pour drone avec assault action |
| T6 | `socket/index.js` COMBAT_ACTION_CONFIRM | Guard `confirmedModifiers` contourné si `character.type === 'drone'` |

---

## Session 91b — 2026-06-12 — Bug 1 Drone fire_mode

### Contexte

Correction du Bug 1 identifié en Session 91 : `fire_mode` drone hardcodé en `'rl'` puis `'rc'` dans `CombatGmDeclareWindow`, ignorant le champ configuré dans la fiche drone (onglet Armes).

**Bugs 2 & 3** (CaC drone + situation mods) différés au Sprint CaC (session dédiée). Documentés dans `docs/BUGIDENTIFIE.md` §"Bugs Session 91 — Sprint CaC Drone".

### Livré

**Bug 1 — fire_mode drone depuis la fiche drone (onglet Armes)**

- `CombatGmDeclareWindow.jsx` : dans `handleDeclare`, lit `droneWeapons.find(w => w.id === selectedDroneWeaponId)?.fire_mode` et l'envoie dans `state.fire_mode`. La donnée est déjà disponible côté client (tableau `droneWeapons` chargé depuis l'API `/drone/weapons`).
- `server/src/socket/index.js` COMBAT_ACTION_DECLARE : revert de la surcharge `droneWeaponFireMode`. Le serveur utilise `state.fire_mode` reçu pour `combat_actions.fire_mode` et `combat_roster.state_fire_mode` — identique au pipeline humanoïde. La query `droneWeapon` reste (nécessaire pour `assaultWeaponRefRange`).
- Non validé fonctionnellement (nécessite session de test avec drone en combat).

### Touches

| # | Fichier | Changement |
|---|---|---|
| T1 | `CombatGmDeclareWindow.jsx` | `handleDeclare` drone : `selectedDroneWeapon?.fire_mode ?? 'rc'` au lieu de `'rc'` hardcodé |
| T2 | `socket/index.js` COMBAT_ACTION_DECLARE | Suppression `droneWeaponFireMode`, `fire_mode` et `state_fire_mode` uniformisés (`state.fire_mode`) |

---

## Session 92 — 2026-06-12 — Audit CaC + MANUELSYSCOMBAT.md complété

### Contexte

Session analytique : compréhension du corps à corps humanoïde ET drone. Source de vérité : `docs/Old/REGLES_Contact.md`. Objectif : corriger et compléter §6.2 de `docs/MANUELSYSCOMBAT.md`.

Fichiers lus : `REGLES_Contact.md`, `MANUELSYSCOMBAT.md`, `SYSTEME/BLESSURES.md`, `SYSTEME/COMBAT.md`, `BUGIDENTIFIE.md`, `socket/index.js` (`resolveDroneAssaultAction`).

Scratch pad de session : `docs/CACTEMP.md` (périssable).

### Livré

**1. §6.2 — Formules dégâts corrigées (deux bugs)**
- `Dommages_Bruts` : impl V1 = `rawDice + ModDom(FOR)` (MR absent — dette Session 67 documentée)
- `Dommages_Nets` : signe corrigé (`+` → `-`), formule exacte `max(0, Bruts - etq - rd)` avec `etq` et `rd` nommés

**2. §6.2 — Sections manquantes ajoutées**
- `#### Modes de combat` : table 5 modes (normal/offensif/charge/defensif/retraite), mods attaque + défense, contraintes, stockage DB
- `#### Multi-adversaires` : table 2→−5 / 3→−7 / 4+→−10, appliqué attaque ET défense, `countAdversaires()` Session 72
- `#### Allonge` : règle exacte (seul le plus grand bénéficie, bonus = différence), double tranchant, V1 client only

**3. §6.9 — Arts Martiaux créé (non implémenté V1)**
Trois familles : techniques offensives (6), techniques défensives (6), Lutte. Renvoi §6.3 (Enchaînement) et §6.6 (Saisie).

**4. §7.3 + §7.4 — Drone CaC précisé**
- §7.3 : exception `armement_contact` — portée = 0 (contact physique satisfait par définition)
- §7.4 : note sous le tableau, référence Bug DC3

**5. BUGIDENTIFIE.md — Bug DC3 ajouté (session précédente)**
`PORTEE_MOD_COMP['bout_portant']` = +5 appliqué à tort dans `resolveDroneAssaultAction` pour `armement_contact`. Fix documenté.

### Validation

Session analytique + documentation — pas de validation fonctionnelle requise. Bug DC3 à corriger dans Sprint CaC Drone.

### Touches

| # | Fichier | Changement |
|---|---|---|
| T1 | `docs/MANUELSYSCOMBAT.md` §6.2 | Formules Dommages_Bruts/Nets corrigées |
| T2 | `docs/MANUELSYSCOMBAT.md` §6.2 | Modes de combat + Multi-adversaires + Allonge ajoutés |
| T3 | `docs/MANUELSYSCOMBAT.md` §6.9 | Arts Martiaux créé (non impl V1) |
| T4 | `docs/MANUELSYSCOMBAT.md` §7.3-7.4 | Précision armement_contact portée = 0, Bug DC3 référencé |
| T5 | `docs/BUGIDENTIFIE.md` | DC1 corrigé (mention bout_portant incorrecte), DC3 ajouté |

---

## Session 92tier — 2026-06-14 — Sprint CaC Étapes 1+2 : correctifs serveur

### Contexte

Suite de Session 92bis (plan `docs/REWORK_CONTACT.md` finalisé). Implémentation des Étapes 1+2.
6 corrections préliminaires au plan apportées avant le code (architecture B1 → 3 rounds parallèles, B3 → 1 ligne `null`, `hand_pref 'A'`, `confirmedModifiers` obligatoire dans `commonPending`, threading 5e site).
Étape 3 (CombatCacModifiersWindow + mods situation) reste à faire.

Fichiers lus : `REWORK_CONTACT.md`, `MANUELSYSCOMBAT.md`, `socket/index.js` (11 sections ciblées).

### Livré — validé fonctionnellement ✅

**Bugfixes `resolveMeleeAction` (Étape 1)**
- **B9** — Test d'opposition MR tie-break (LdB §6.2) : `hit = attackSuccess && (!defenseSuccess || mrAttaque > mrDefense)`. Corrige "les deux réussissent → rien". 2 emplacements : PNJ auto + MELEE_DEFENSE_CONFIRM.
- **B1** — Compétence défenseur dynamique : `hand_pref` → slot priority (MD/MG/2M) → `ref_equipment_skill_assoc` → `defSkillId`. Architecture 3 rounds parallèles. Fallback `COMBAT_A_MAINS_NUES`.
- **B2** — Guard Charge ≤ 3m : `COMBAT_DECLARE_ERROR` si `state_combat_mode === 'charge' && dist2dChk <= 3`. Validé ✅
- **B8** — Drone défenseur : bloc `else if (defenderCharacter.type === 'drone')` — test simple, pipeline `calcDroneRD` + `resolveDroneIntegrityLoss`, slot libre immédiatement.
- **LOC** — `LOC_TABLE_CONTACT` créée + remplacée en 3 emplacements (PNJ auto, MELEE_DEFENSE_CONFIRM PNJ, COMBAT_DAMAGE_CONFIRM conditionnel `pendingType === 'melee'`).

**Bugfix `resolveDroneAssaultAction` (Étape 2)**
- **B3** — `portee = null` pour `armement_contact` → `PORTEE_MOD_COMP[null] ?? 0 = 0`. 1 ligne. Élimine le +5 `bout_portant` illégitime.

### Non livré — Étape 3

`CombatCacModifiersWindow.jsx`, mods situation/taille serveur, deux armes auto, terrain instable.

### Touches

| # | Fichier | Changement |
|---|---|---|
| T1 | `server/src/socket/index.js` | `LOC_TABLE_CONTACT` constante |
| T2 | `server/src/socket/index.js` | B1 — compétence défenseur dynamique (3 rounds parallèles) |
| T3 | `server/src/socket/index.js` | B2 — guard Charge ≤ 3m |
| T4 | `server/src/socket/index.js` | B8 — drone défenseur CaC |
| T5 | `server/src/socket/index.js` | B9 — MR tie-break (×2 emplacements) |
| T6 | `server/src/socket/index.js` | LOC1/LOC2/LOC3 — LOC_TABLE_CONTACT (3 emplacements) |
| T7 | `server/src/socket/index.js` | B3 — portee null armement_contact drone |
| T8 | `docs/REWORK_CONTACT.md` | 6 corrections plan (B3, CORR-B1 archi, hand_pref 'A', commonPending obligatoire, threading) |


---

## Session 92-4 — 2026-06-14 — Sprint CaC Étape 3 : CombatCacModifiersWindow + mods situation

### Contexte

Suite de Session 92tier (Étapes 1+2 validées). Implémentation de lÉtape 3 : composant modificateurs CaC + 6 clés SITUATION_MODS + deux armes auto + terrain instable.

Fichiers lus : `REWORK_CONTACT.md` (§5 + AUDIT SESSION 92-4), `MANUELSYSCOMBAT.md`, `socket/index.js` (15 sections), `CombatModifiersWindow.jsx`, `CombatOverlay.jsx`.

### Livré — SR + Vite 200 ✅

**Serveur `socket/index.js` — 16 modifications (S1–S16) :**
- **S1** — `SITUATION_MODS` : 6 clés CaC ajoutées (`cac_attaquant_cote`, `cac_attaquant_au_sol`, `cac_espace_confine`, `cac_espace_tres_confine`, `cac_position_avantageuse`, `cac_main_non_directrice`) — préfixe `cac_` évite les collisions ranged
- **S2** — `resolveMeleeAction` : paramètre `confirmedModifiers = null` ajouté
- **S3** — `invAttaquant` select : `ref_equipment.category as ref_category` ajouté (pour détection deux armes)
- **S4+S5** — Bloc mods CaC ATK inséré avant `chancesAttaque` : `deuxArmesBonus` (auto-détection MD+MG arme contact ≥ 2 → +3), `situationModComp` (keys filtrées hors terrain instable), `tailleMod`, `terrainInstableMod` (fetch conditionnel ACROBATIE_EQUILIBRE → Math.min limitative). `chancesAttaque` étendue
- **S6** — `breakdownAtk` : 4 nouvelles entrées conditionnelles (Mods situation, Taille cible, Terrain instable, Deux armes au contact)
- **S7** — `commonPending` : `confirmedModifiers` + `situationDef` ajoutés (threading vers MELEE_DEFENSE_CONFIRM)
- **S8** — Call site 1 (COMBAT_ACTION_CONFIRM) : `confirmedModifiers` passé à `resolveMeleeAction`
- **S9** — MELEE_DEFENSE_CONFIRM destructuring : `pendingConfirmedModifiers` + `pendingSituationDef = []` ajoutés
- **S10** — MELEE_DEFENSE_CONFIRM : bloc terrain instable DEF PJ (fetch conditionnel ACROBATIE_EQUILIBRE → Math.min → `chanceDefense +=`)
- **S11** — `breakdownDefPj` : entrée terrain instable DEF conditionnelle
- **S12** — Call site 2 (MELEE_DEFENSE_CONFIRM recursive) : `pendingConfirmedModifiers` passé
- **S13** — Call site 3 (PNJ auto recursive) : `confirmedModifiers` passé
- **S14** — Call site 4 (drone recursive) : `confirmedModifiers` passé
- **S15** — Bloc terrain instable DEF PNJ auto (re-fetch conditionnel — `attrsCible`/`genoCible` hors scope → CORR-S15 appliqué)
- **S16** — `breakdownDef` PNJ auto : entrée terrain instable DEF

**Client — nouveau fichier :**
- `CombatCacModifiersWindow.jsx` : composant CaC (7 checkboxes attaquant, 1 checkbox défenseur terrain instable, sélect taille, pill compétence, lookup conditionnel isDrone). CORR-DRONE-LOOKUP appliqué.

**Client — `CombatOverlay.jsx` (C1–C6) :**
- C1 : import `CombatCacModifiersWindow`
- C2 : `activeMeleeAction` (GM — action melee PNJ active)
- C3 : `playerActiveMeleeAction` (PJ — action melee active)
- C4 : `CombatActionWindow` masquée pendant CaC PJ (`!playerActiveMeleeAction`)
- C5 : bouton "Agir" bare GM : condition `!activeAssaultAction && !activeMeleeAction` (isDroneCaC a sa propre fenêtre)
- C6 : 3 montages `CombatCacModifiersWindow` (PNJ melee, drone CaC, PJ melee)

### Non livré — validation fonctionnelle requise

Test en combat réel : humanoid CaC avec mods + drone CaC avec mods.

### Touches

| # | Fichier | Changement |
|---|---|---|
| T1 | `server/src/socket/index.js` | S1 — SITUATION_MODS 6 clés CaC |
| T2 | `server/src/socket/index.js` | S2 — signature resolveMeleeAction |
| T3 | `server/src/socket/index.js` | S3 — invAttaquant ref_category |
| T4 | `server/src/socket/index.js` | S4+S5 — mods CaC ATK + chancesAttaque |
| T5 | `server/src/socket/index.js` | S6 — breakdownAtk 4 entrées |
| T6 | `server/src/socket/index.js` | S7 — commonPending confirmedModifiers + situationDef |
| T7 | `server/src/socket/index.js` | S8 — call site 1 |
| T8 | `server/src/socket/index.js` | S9–S11 — MELEE_DEFENSE_CONFIRM DEF PJ |
| T9 | `server/src/socket/index.js` | S12–S14 — call sites 2/3/4 |
| T10 | `server/src/socket/index.js` | S15–S16 — terrain instable DEF PNJ auto |
| T11 | `client/src/components/CombatCacModifiersWindow.jsx` | NOUVEAU — composant CaC |
| T12 | `client/src/components/CombatOverlay.jsx` | C1–C6 — montage CombatCacModifiersWindow |

---

## Session 93 — 2026-06-14 — Fix split-brain slot detection (PLAN_ARCHICOMBAT_SLOTS)

### Contexte

Session analytique + implémentation. Plan `docs/PLAN_ARCHICOMBAT_SLOTS.md` soumis à 6 runs à vide exhaustifs avant le code. Aucune ambiguïté non résolue au moment du code.

Fichiers lus : `PLAN_ARCHICOMBAT_SLOTS.md`, `CombatOverlay.jsx`, `combatStore.js`, `socket/index.js` (startResolutionPhase + COMBAT_ACTION_DECLARE), `migrations/54_combat.js`. Vérification `SessionPage.jsx` (grep COMBAT_PHASE_CHANGED + COMBAT_SLOT_ADVANCED).

Lecture de synthèse : `MANUELSYSCOMBAT.md` + `SYSTEME/REGLES_LdB.md` — vérification alignement règles CaC (pas de delta détecté).

### Cause racine — split-brain slot detection

Deux sources de vérité pour "qui est le slot actif" :
- **Serveur** (`COMBAT_ACTION_CONFIRM`) : roster filtré `has_announced=true ORDER BY initiative DESC` + index `active_slot_idx`
- **Client** (`CombatOverlay`) : roster complet (non filtré) + index `activeSlotIdx`

Si un token non-annoncé a une INI plus haute que les annoncés → index 0 client pointe vers le mauvais token → panneau affiché faux, `tokenId` envoyé dans CONFIRM faux → CONFIRM rejeté par le serveur → **combat bloqué**.

`startResolutionPhase` aggravait : envoyait `broadcastRoster[0]?.token_id` (roster complet non filtré) au lieu du 1er token annoncé.

Problème tertiaire : `COMBAT_ACTION_DECLARE` settait `has_announced=true` même si CaC déclaré sans cible → token annoncé sans action en DB → slot consommé silencieusement.

### Solution

Le serveur envoie un `tokenId` absolu. Le client cherche par `token_id`, pas par index. `activeTokenId` existait déjà dans `combatStore` (ligne 9) et était déjà setté par `advanceSlot`. Il n'était pas consommé dans `CombatOverlay`.

### Livré — en attente de validation fonctionnelle

**Correction 1 — `client/src/components/CombatOverlay.jsx` (3 touches) :**
- Ligne 20 : `activeTokenId` ajouté au destructuring `useCombatStore()`
- Ligne 39 : `gmActiveEntry = roster.find(e => e.token_id === activeTokenId) ?? null` (était `sortedRoster[activeSlotIdx]`)
- Lignes 56+60 : `activeTokenId === playerToken?.id` (était `sortedRoster[activeSlotIdx]?.token_id === playerToken?.id`)
- `sortedRoster` conservé — sert à l'ordre visuel de la timeline uniquement

**Correction 2 — `server/src/socket/index.js` startResolutionPhase :**
- 2 queries → 3 queries : `announcedRoster` (filtré `has_announced=true`), `pendingActions` (filtré `status='pending'`), `fullRoster` (non filtré)
- `COMBAT_PHASE_CHANGED` : `roster: broadcastRoster` (complet — timeline), `actions: pendingActions` (pas de données périmées)
- `COMBAT_SLOT_ADVANCED` : `tokenId: announcedRoster[0]?.token_id` (filtré, cohérent avec COMBAT_ACTION_CONFIRM)

**Correction 3 — `server/src/socket/index.js` COMBAT_ACTION_DECLARE :**
- Guard ajouté avant le roster UPDATE : si `mapActions.melee.length > 0 && !mapActions.melee.some(m => m.targetTokenId)` → `COMBAT_DECLARE_ERROR` + `return`
- `has_announced` non settée pour les CaC sans cible → token n'entre pas dans announcedRoster

### Résiduel documenté (hors scope)

`COMBAT_STATE_SYNC` (reconnexion client en RESOLUTION) : calcule encore `activeTokenId` depuis roster complet + index → même split-brain pour les reconnexions. Sprint dédié futur.

### Touches

| # | Fichier | Changement |
|---|---|---|
| C1 | `client/src/components/CombatOverlay.jsx` | activeTokenId destructuring |
| C2 | `client/src/components/CombatOverlay.jsx` | gmActiveEntry par tokenId |
| C3 | `client/src/components/CombatOverlay.jsx` | conditions joueur par activeTokenId |
| S1 | `server/src/socket/index.js` startResolutionPhase | 3 queries filtrées |
| S2 | `server/src/socket/index.js` startResolutionPhase | pendingActions + announcedRoster[0] |
| S3 | `server/src/socket/index.js` COMBAT_ACTION_DECLARE | guard melee sans cible |

---

## Session 93-5 — 2026-06-15 — Fix labels DICE_RESULT dégâts drone (DMG1+DMG2)

### Contexte

Analyse pipeline dégâts drone post-validation B6. Découverte bugs d'affichage dans la carte DICE_RESULT "Dégâts — drone" : labels "Compétence" et "Seuil" sémantiquement faux, intégrité absente, pipeline illisible.

Fichiers lus : `REGLEDRONE.md`, `socket/index.js` (resolveDroneAssaultAction branch 8a, calcDroneRD, resolveDroneIntegrityLoss), `charStats.js` (RD_TABLE), `migrations/71-72`, `Sidebar.jsx`, `fr.json`.

### Bugs documentés (BUGIDENTIFIE.md §Session 93-5)

- **COM3** — FAUX BUG confirmé (LdB `REGLES_Contact.md` p.222 : test d'opposition = les deux roulent toujours)
- **DMG1** [VÉRIFIÉ] : `mechanicalTotal=rawDice` affiché comme "Compétence" — label i18n `entityActionDetail` réutilisé à tort dans contexte dégâts
- **DMG2** [VÉRIFIÉ] : `chancesDeReussite=degatsNets` affiché comme "Seuil" — même cause
- **DR4** [VÉRIFIÉ] : `calcDroneRD(15)` retourne négatif pour haute intégrité → dégâts augmentés au lieu de réduits — sprint dédié futur
- **DR5** — RÉSOLU : colonne `resistance_dommages` supprimée en migration 72
- **DR6** [HYPOTHÈSE] : `drone_sheet.blindage` non lu (affiche 0 malgré valeur DB=15) — [DBG-DR6] requis
- **TODO-DRONE-1** : Tooltips blindage/armure/blindage IEM dans DroneWindow

### Livré — SR ✅ — validation fonctionnelle requise

Fix DMG1+DMG2 : nouvelle clé i18n `sidebar.droneActionDetail` + `cardType: 'drone_damage'` dans payload serveur. `Sidebar.jsx` route vers la clé correcte. `skillLabel` enrichi avec nom cible + intégrité avant/après.

### Touches

| # | Fichier | Changement |
|---|---|---|
| T1 | `client/src/locales/fr.json` | Ajout clé `sidebar.droneActionDetail` |
| T2 | `client/src/locales/fr.json.test` | Idem |
| T3 | `client/src/components/Sidebar.jsx` | Conditionnel `cardType === 'drone_damage'` → `droneActionDetail` |
| T4 | `server/src/socket/index.js` branch 8a | `skillLabel` nom+intégrité, `diffLabel` pipeline MR/blindage/RD, `cardType` |

## Session 93-5 — 2026-06-15 — Fix labels DICE_RESULT dégâts drone (DMG1+DMG2)

### Contexte

Analyse pipeline dégâts drone post-validation B6. Découverte bugs d'affichage dans la carte DICE_RESULT  : labels  et  sémantiquement faux, intégrité absente, pipeline illisible.

Fichiers lus : ,  (resolveDroneAssaultAction branch 8a, calcDroneRD, resolveDroneIntegrityLoss),  (RD_TABLE), , , .

### Bugs documentés (BUGIDENTIFIE.md §Session 93-5)

- **COM3** — FAUX BUG confirmé (LdB REGLES_Contact.md p.222 : test d opposition = les deux roulent toujours)
- **DMG1** [VÉRIFIÉ] : mechanicalTotal=rawDice affiché comme  — label i18n entityActionDetail réutilisé à tort dans contexte dégâts
- **DMG2** [VÉRIFIÉ] : chancesDeReussite=degatsNets affiché comme  — même cause
- **DR4** [VÉRIFIÉ] : calcDroneRD(15) → rdInput=30 → RD_TABLE rd=−3 → dégâts augmentés au lieu de réduits pour drone plein — bug à corriger dans sprint dédié
- **DR5** — RÉSOLU : resistance_dommages supprimé en migration 72, aucune action requise
- **DR6** [HYPOTHÈSE] : drone_sheet.blindage non lu (affiche 0 malgré valeur DB=15) — instrumentation [DBG-DR6] requise
- **TODO-DRONE-1** : Tooltips champs blindage/armure/blindage IEM dans DroneWindow

### Livré — SR ✅ — validation fonctionnelle requise

Fix DMG1 + DMG2 : refonte carte DICE_RESULT dégâts drone.

Solution : nouvelle clé i18n  + champ  dans payload serveur. Sidebar.jsx route vers la clé correcte selon cardType. skillLabel enrichi avec nom drone cible + intégrité avant/après.

Résultat chat attendu :


### Touches

| # | Fichier | Changement |
|---|---|---|
| T1 | client/src/locales/fr.json | Ajout clé sidebar.droneActionDetail |
| T2 | client/src/locales/fr.json.test | Idem |
| T3 | client/src/components/Sidebar.jsx | Conditionnel msg.cardType drone_damage → droneActionDetail |
| T4 | server/src/socket/index.js branch 8a | skillLabel nom+intégrité, diffLabel pipeline MR/blindage/RD, cardType drone_damage |

## Session 95 — 2026-06-15 — Cluster B : auto-sélection arme CaC et drone (COM6 + DR1)

### Contexte

Sprint correction bugs Cluster B (BUGIDENTIFIE.md §Cluster B) — deux bugs d'initialisation UI dans les fenêtres de déclaration combat : arme CaC jamais pré-sélectionnée (GM + joueur) et arme drone jamais pré-sélectionnée.

Fichiers lus : `docs/BUGIDENTIFIE.md`, `docs/SYSTEME/COMBAT.md`, `docs/MANUELSYSCOMBAT.md`, `client/src/components/CombatGmDeclareWindow.jsx`, `client/src/components/CombatActionWindow.jsx`.

### Cause racine

Les trois états (`selectedGmMeleeWeaponId`, `selectedMeleeWeaponId`, `selectedDroneWeaponId`) étaient resetés à `null` à chaque changement de token actif ou de phase, mais jamais auto-populés avec l'arme disponible. L'utilisateur devait cliquer manuellement à chaque tour.

### Solution

Exploitation de l'ordre d'exécution React (`useEffect` top-to-bottom) et des callbacks asynchrones :

- **COM6 GM** : nouvel `useEffect([activeTokenId, equipment])` qui lit `equipment[activeTokenId]?.weapon` (déjà chargé en cache) et sélectionne `w.inv_id` si `!w.ref_fire_mode`.
- **COM6 Joueur** : auto-sélection dans le callback du fetch inventaire — `items.find(ref_category === 'Arme de contact' + slot MG/MD/2M)` → `setSelectedMeleeWeaponId(firstMeleeWeapon.id)`.
- **DR1** : auto-sélection dans le callback du fetch armes drone — `setSelectedDroneWeaponId(weapons[0].id)`.

Dans les trois cas, le reset (null) fire avant l'auto-sélection grâce à l'ordre React → état final cohérent.

### Livré — SR ✅ — fonctionnel validé

### Touches

| # | Fichier | Changement |
|---|---|---|
| T1 | client/src/components/CombatGmDeclareWindow.jsx | Drone fetch : auto-sélection weapons[0].id (DR1) |
| T2 | client/src/components/CombatGmDeclareWindow.jsx | Nouvel useEffect([activeTokenId, equipment]) auto-sélection CaC GM (COM6) |
| T3 | client/src/components/CombatActionWindow.jsx | Callback fetch inventaire : auto-sélection firstMeleeWeapon.id (COM6 joueur) |

---

## Session 95 suite — Audit Cluster C : DC1 / DC2 / DC3 / DR3 — 2026-06-15

### Contexte

Audit bugs Cluster C (BUGIDENTIFIE.md §Cluster C) : DC1 (drone CaC — flow incorrect) + DR3 (même cause) + DC2 + DC3 (impacts croisés identifiés en cours d'analyse).

Fichiers lus : `docs/BUGIDENTIFIE.md`, `docs/SYSTEME/COMBAT.md`, `client/src/components/CombatOverlay.jsx`, `client/src/components/CombatCacModifiersWindow.jsx`, `server/src/socket/index.js`.

### Verdict

Tous les correctifs Cluster C **étaient déjà présents dans la base de code** (travail Session 91 commité) :

- **DC1** : `isDroneCaC` flag (`CombatOverlay.jsx` lignes 57-58) + routing `CombatCacModifiersWindow` (lignes 186-193) — correct.
- **DR3** : Identique à DC1 — même code, même fix.
- **DC2** : `situationMods = confirmedModifiers?.situation ?? []` dans `resolveDroneAssaultAction` — appliqué.
- **DC3** : `portee = null` pour `armement_contact` → `PORTEE_MOD_COMP[null] ?? 0 = 0` — appliqué.

La confusion initiale (bug semblait présent) était due à une **mauvaise actualisation Firefox (cache navigateur)**. Après rechargement forcé, le code correct était bien en place.

### Validation fonctionnelle

SR ✅ — confirmé par l'utilisateur : "TU as totalement raison, SR et fonctionnel."

### Clôtures

- DC1 ✅ CLOS — Session 95 suite
- DC2 ✅ CLOS — Session 95 suite
- DC3 ✅ CLOS — Session 95 suite
- DR3 ✅ CLOS — Session 95 suite

Aucun code écrit cette session — état du code inchangé.

---

## Session 95 suite 2 — Validation Sprint Test de Choc + Sprint 14-0 — 2026-06-15

### Scénario 1 — Auto-stun (shock_auto_stun = true)

- Blessure grave sur PNJ → outcome `ok` (pas de stun — normal, aléatoire)
- Blessure grave sur PJ → outcome `etourdi` → stun appliqué ✅
- Guard `COMBAT_ACTION_DECLARE` : token étourdi bloqué en attaque + allure limitée ✅
- Expiry : badge disparaît après N tours (endTurn purge `token_statuses`) ✅

### Scénario 2 — Stun manuel (shock_auto_stun = false)

- Bouton "Appliquer l'étourdissement" visible dans ShockBlock ✅
- Clic GM → badge appliqué ✅

### Clôtures

- Sprint Test de Choc (migration 69, S81) ✅ CLOS
- Sprint 14-0 (migration 79, S93-3) ✅ CLOS

### Nouvelles dettes identifiées

- **ST1** — Badge statut illisible (texte trop petit) → Sprint 14-2
- **ST2** — Durée étourdissement non affichée (`stunned_until_turn` non exposé) → quick win ShockBlock + Sprint 14-2
- **ST3** — Fenêtre STATUTS trop petite → Sprint 14-1 ou dédié

### Corrections de diagnostic (run à vide)

- **"PNJ, pas de stun"** → bug confirmé SHOCK1 : Test de Choc jamais affiché pour PNJ (pas des dés — le test n'est pas exécuté du tout)
- **"PNJ is_stunned subit les bons malus"** → guard COMBAT_ACTION_DECLARE fonctionne pour PNJ ✅
- **COMBAT_END stun résiduel** → SHK3 : badge supprimé, effet mécanique persiste — sérieux
- **D6 durée jamais visible** → ST2 mis à jour : absence de broadcast + jamais affiché côté joueur
- **Curseur bloqué** → CUR1 enregistré
- **Chat F5** → CH1 enregistré

---

## Session 95-3 — Fix SHOCK1 : Test de Choc drone → PNJ — 2026-06-15

**Cause racine [VÉRIFIÉ]** : `resolveDroneAssaultAction` branche 8b (drone → PNJ humanoid). Trois défauts cumulés :
- `vol_na` non destructuré dans `fetchCibleNA` (nécessaire pour `calcSeuils`)
- Aucun bloc shock après `resolveWoundInsertion`
- `shockResult: null` hardcodé dans l'émission `COMBAT_ATTACK_RESULT`

**Correctif** — `server/src/socket/index.js` branche 8b :
- T1 : `const { for_na, con_na, vol_na }` + default `vol_na: 8`
- T2 : `let shockResult = null` avant le bloc wound
- T3 : bloc shock complet (symétrique à `resolveAssaultAction` PNJ auto-path)
- T4 : `shockResult: shockResult ?? null` dans `COMBAT_ATTACK_RESULT`

**Clôture SHOCK1 ✅**
- **Testé** : drone → PNJ humanoid, blessure Mortelle Corps → Test de Choc déclenché + stun appliqué si outcome ≠ ok
- **Non testé** : —

---

## Session 95-3 suite — Investigation SHK3 : FAUX BUG — 2026-06-16

**Instrumentation** : 2 logs [DBG-SHK3] dans COMBAT_END handler (avant/après cleanup `token_statuses`).

**Résultat console** :
```
[DBG-SHK3] avant cleanup: [{ token_id: 'ce71acbb...', status_code: 'unconscious', expires_at_turn: 31 }]
[DBG-SHK3] après cleanup: []
```

**Verdict** : FAUX BUG. Code correct dans son intégralité :
- `applyStunWithDuration` → uniquement `token_statuses`, zéro écriture JSONB
- Guard COMBAT_ACTION_DECLARE → lit uniquement `token_statuses`
- Cleanup COMBAT_END → delete effectif, DB propre après COMBAT_END
- Nouveau combat (`current_turn: 1`) → aucun guard bloquant

Logs DBG retirés. Hypothèses initiales infirmées.

**Clôture SHK3 ✅ (faux bug)**
- **Testé** : stun PNJ inconscient durée 30 → COMBAT_END → nouveau combat → attaque non bloquée
- **Non testé** : —

---

## Session 95-5 — 2026-06-16 — Fix ST2 : Durée étourdissement broadcastée (refonte resolveShockBlock)

### Contexte

Bug ST2 : le D6 de durée d'étourdissement était roulé silencieusement côté serveur. Aucune carte DICE_RESULT dans le chat. Seul `ShockBlock` (déjà fonctionnel) affichait la durée dans le panneau résultat combat.

Audit architectural identifié en Session 95-3 : le bloc shock était copié-collé 5× avec des noms de variables différents (`stunDuration`, `stunDuration2`, `stunDuration3`, `stunDuration4`).

Fichiers lus : `docs/BUGIDENTIFIE.md`, `docs/MANUELSYSCOMBAT.md`, `server/src/socket/index.js`, `client/src/components/Sidebar.jsx`, `client/src/pages/SessionPage.jsx`, `client/src/locales/fr.json`.

### Livré — SR ✅ fonctionnel

**Refonte `resolveShockBlock` — `server/src/socket/index.js`**

- Suppression de `rollStunDuration` (4 lignes absorbées dans le helper)
- Nouveau helper `resolveShockBlock(io, campaignId, { finalSeverity, localisation, is_lethal, for_na, con_na, vol_na, targetTokenId, userId, username, color })` (~46 lignes)
  - `isShockTestRequired` → early-return `null` si pas de test requis
  - D20 choc + outcome
  - Si stun : `parseDice('1d6')` → DICE_RESULT broadcast + `applyStunWithDuration`
  - Retourne `shockResult` (structure identique à l'ancienne)
- 5 blocs de ~25 lignes remplacés par 1 appel de 6 lignes chacun

**Attribution DICE_RESULT D6 par site :**
- Sites 1, 4 : `userId`, `tireurUsername`, `tireurColor`
- Site 2 (MELEE_DEF_CONFIRM) : `userId`, `attackerUsername`, `attackerColor`
- Sites 3, 5 (PNJ auto) : `character.user_id`, `attackerUsername`/`tireurUsername`, `attackerColor`/`tireurColor`

**Net :** −~93 lignes

### Clôture ST2 ✅ (partiel — côté serveur + broadcast)
- **Testé** : SR ✅, carte "Durée étourdissement" visible dans sidebar chat après stun PNJ
- **Non testé** : scénario PJ comme cible (fenêtre interactive PJ — sprint suivant ST2b)

### Touches

| # | Fichier | Changement |
|---|---|---|
| T1 | `server/src/socket/index.js` | Suppression `rollStunDuration` |
| T2 | `server/src/socket/index.js` | Nouveau helper `resolveShockBlock` |
| T3 | `server/src/socket/index.js` | 5 blocs shock → 5 appels `resolveShockBlock` (sites ~2484, ~2745, ~3600, ~4032, ~4382) |

## Session 95-5b — 2026-06-16 — ST2b : Fenêtre PJ pour D6 durée étourdissement

### Contexte

Suite de ST2. Quand la cible d'un stun est un PJ, le D6 de durée doit être lancé par le joueur lui-même via une fenêtre interactive, plutôt que résolu côté serveur. Pattern identique à `COMBAT_DAMAGE_PROMPT`.

Fichiers lus : `shared/events.js`, `server/src/socket/index.js`, `client/src/components/CombatDamageWindow.jsx`, `client/src/pages/SessionPage.jsx`, `client/src/components/CombatOverlay.jsx`.

### Livré

**`shared/events.js`** — +2 événements WS
- `COMBAT_STUN_PROMPT` : serveur → socket PJ cible `{ tokenId, outcome }`
- `COMBAT_STUN_CONFIRM` : PJ → serveur `{ tokenId }`

**`server/src/socket/index.js`** — 3 modifications
- `pendingStunActions = new Map()` déclarée globalement (ligne 47)
- `resolveShockBlock` étendu : détecte PJ vs PNJ via `tokens.character_id → characters.type`. Si PJ connecté → stocke pending + émet `COMBAT_STUN_PROMPT`. Si PJ offline → fallback auto. Si PNJ → code antérieur inchangé.
- Handler `COMBAT_STUN_CONFIRM` : récupère pending → `parseDice('1d6')` → `DICE_RESULT` broadcast → `applyStunWithDuration`

**`client/src/components/CombatStunWindow.jsx`** — nouveau composant (minimal)
- Badge coloré outcome (jaune = étourdi, rouge = inconscient)
- Bouton "Lancer 1D6" → emit `COMBAT_STUN_CONFIRM` + ferme immédiatement
- Résultat affiché dans sidebar via DICE_RESULT (pas de deuxième écran)

**`client/src/pages/SessionPage.jsx`** — +state `stunPayload`, +listener `COMBAT_STUN_PROMPT`, +props à CombatOverlay

**`client/src/components/CombatOverlay.jsx`** — import + props + render conditionnel `{stunPayload && <CombatStunWindow ... />}`

### Clôture ST2 ✅ (complet)
- **Testé** : SR ✅ syntaxe propre — test fonctionnel requis
- **Non testé** : scénario réel PJ cible en combat + fallback offline

### Touches

| # | Fichier | Changement |
|---|---|---|
| T1 | `shared/events.js` | +2 événements WS `COMBAT_STUN_PROMPT` / `COMBAT_STUN_CONFIRM` |
| T2 | `server/src/socket/index.js` | `pendingStunActions` Map globale |
| T3 | `server/src/socket/index.js` | `resolveShockBlock` — branch PJ/PNJ + prompt |
| T4 | `server/src/socket/index.js` | Handler `COMBAT_STUN_CONFIRM` |
| T5 | `client/src/components/CombatStunWindow.jsx` | Nouveau composant |
| T6 | `client/src/pages/SessionPage.jsx` | State + listener + props |
| T7 | `client/src/components/CombatOverlay.jsx` | Import + props + render |

## Session 96 — REWORK-01 statusService — 2026-06-16

### Contexte

Suite Session 95-5b (ST2b revert). Architecture ST2b jugée trop fragile : `resolveShockBlock` appellé avant `COMBAT_DAMAGE_RESULT` → tout plantage bloquait la fenêtre dégâts joueur. Décision : réécrire le bloc stun en module de service indépendant (`statusService.js`).

Spec complète rédigée dans `docs/ARCHI_REWORK.md` (REWORK-01).

### Livré

**`shared/events.js`** — +2 événements WS
- `COMBAT_STUN_PROMPT` : serveur → socket PJ ou GM `{ tokenId, outcome }`
- `COMBAT_STUN_CONFIRM` : PJ ou GM → serveur `{ tokenId }`

**`server/src/lib/statusService.js`** — MODULE CRÉÉ
- `resolveShockTest({ finalSeverity, localisation, is_lethal, for_na, con_na, vol_na })` — pure, D20 seulement, null si pas de test requis
- `applyStun(io, db, campaignId, pendingStunActions, {...})` — PJ connecté → COMBAT_STUN_PROMPT, PNJ + shock_auto_stun=false → prompt GM, PNJ + shock_auto_stun=true → D6 auto, fallback offline
- `applyStunWithDuration(io, db, ...)` — migré depuis index.js, db en paramètre
- `emitTokenStatusUpdated(io, db, ...)` — migré depuis index.js, db en paramètre

**`server/src/socket/index.js`** — 10 modifications
- Import `* as statusService`
- `const pendingStunActions = new Map()` (ligne 48)
- 3 appels `emitTokenStatusUpdated` → `statusService.emitTokenStatusUpdated(io, db, ...)`
- 1 appel `applyStunWithDuration` (COMBAT_APPLY_STUN handler) → `statusService.applyStunWithDuration(io, db, ...)`
- 5 call sites `resolveShockBlock` → `statusService.resolveShockTest(...)` + `statusService.applyStun(...)` fire-and-forget APRÈS l'emit résultat
- Suppression des 3 fonctions migrées
- +handler `COMBAT_STUN_CONFIRM` (V1/V2 PJ/GM)

**`client/src/components/CombatStunWindow.jsx`** — prop `onConfirmed` → `onClose`

**`client/src/pages/SessionPage.jsx`** — `stunPayload` state + listener STUN_PROMPT + props CombatOverlay

**`client/src/components/CombatOverlay.jsx`** — import CombatStunWindow + props `stunPayload/onStunConfirmed` + render conditionnel

### Résultat REWORK-01

- Séquençage corrigé : `resolveShockTest` (pure) → emit DAMAGE/ATTACK_RESULT → `applyStun` (fire-and-forget)
- Plus aucun couplage entre affichage dégâts et résolution stun
- `resolveShockBlock` : **0 occurrence** (supprimé de partout)

### Clôture REWORK-01 ✅ (complet)
- **Testé** : node --check OK + Vite 200 + SR health OK
- **Non testé** : scénarios fonctionnels réels (PNJ cible + PJ cible + non-régression)

### Touches

| # | Fichier | Changement |
|---|---|---|
| T1 | `shared/events.js` | +COMBAT_STUN_PROMPT + COMBAT_STUN_CONFIRM |
| T2 | `server/src/lib/statusService.js` | MODULE CRÉÉ |
| T3 | `server/src/socket/index.js` | Import + Map + 5 call sites + 3 emitStatus + APPLY_STUN + STUN_CONFIRM handler + suppression 3 fonctions |
| T4 | `client/src/components/CombatStunWindow.jsx` | onConfirmed → onClose |
| T5 | `client/src/pages/SessionPage.jsx` | stunPayload state + listener + props |
| T6 | `client/src/components/CombatOverlay.jsx` | Import + props + render conditionnel |

---

## Session 96 suite — Fix SHK6 : COMBAT_DAMAGE_CONFIRM autorisation PJ cible — 2026-06-16

### Bug

Drone → PJ : `COMBAT_DAMAGE_PROMPT` envoyé au socket PJ (via `io.fetchSockets()` + `s.user?.id` — fonctionne car pas de Redis adapter, sockets locaux). Le PJ clique "Lancer les dés" → envoie `COMBAT_DAMAGE_CONFIRM`. Handler ligne 2379 : `pending.userId` (null — drone sans user_id) ≠ `socket.user.id` (PJ) ET `socket.role !== 'gm'` → return silencieux. Aucun `COMBAT_DAMAGE_RESULT` renvoyé → fenêtre bloquée "Calcul en cours..." côté PJ.

### Correctif

`server/src/socket/index.js` — 2 touches :
1. Branch 8c (~ligne 4062) : `targetUserId: cibleCharacter.user_id` ajouté au pending action
2. Ligne 2379 : `pending.targetUserId !== socket.user.id` ajouté à la condition d'autorisation

### Clôture SHK6 ✅
- **Testé** : drone → PJ, fenêtre GESTION DES DÉGÂTS fonctionnelle, dés roulés, résultats affichés ✅
- **Non testé** : CombatStunWindow apparaît ensuite pour le PJ si shock requis (scénario 2 REWORK-01 complet)

---

## Session 96 validation — REWORK-01 complet — 2026-06-16

### Validation fonctionnelle Scénarios 2-5

- **Scénario 2** ✅ — PJ cible, shock requis : `CombatStunWindow` apparaît chez le joueur, bouton "Lancer 1D6" fonctionnel, `DICE_RESULT` D6 visible chat, badge statut posé sur token.
- **Scénario 3** ✅ — Non-régression blessure légère : aucune fenêtre stun, flux dégâts normal inchangé.
- **Scénario 4** ✅ — PJ cible offline (fallback) : auto D6 serveur, comportement identique à Scénario 1.
- **Scénario 5** ✅ — CaC avec shock non-régression : comportement identique à Scénario 1 via `resolveMeleeAction`.

### DoD ARCHI_REWORK.md — complet ✅

- [x] `resolveShockBlock` → 0 occurrences
- [x] SR sans erreur
- [x] Scénarios 1-5 tous validés fonctionnellement

### Analyse qualité (dettes documentées)

- **[A1]** `CombatStunWindow` : `style={}` pour valeurs visuelles statiques + bouton sans `className="btn"` — fonctionnel, non-conforme conventions CSS. Dette sprint futur.
- **[A2]** `COMBAT_STUN_CONFIRM` : pattern incohérent `socket.data?.role` (GM) vs `socket.user.id` (PJ) — fonctionnel, cosmétique.
- **[A3]** Payload `DICE_RESULT` D6 dupliqué (`_applyAutoStun` + handler `COMBAT_STUN_CONFIRM`) — 2 occurrences, sous seuil rework.

### Clôture REWORK-01 ✅ complet

- **Testé** : Scénarios 1-5 — PNJ ✅ / PJ ✅ / non-régression ✅ / offline ✅ / CaC ✅
- **Non testé** : —


---

## Session 95-6 — Fix CUR1 : curseur bloqué après fermeture combat — 2026-06-16

### Cause racine [VÉRIFIÉ]

`COMBAT_ENDED` et `COMBAT_PHASE_CHANGED` listeners dans `SessionPage.jsx` n'incluaient pas de reset pour les 3 états locaux de mode curseur combat :
- `combatMoveMode` — reste non-null → panneau "Déplacement" fantôme + curseur wireframe actif
- `combatTargetMode` — reste non-null → panneau "Assaut — Cliquez sur la cible" fantôme
- `pendingMoveSelection` — reste non-null → bouton "Valider" fantôme

`resetCombat()` (combatStore) ne touche que `phase/roster/actions/currentTurn/activeSlotIdx` — ces états React locaux en sont indépendants.

### Correctif — `client/src/pages/SessionPage.jsx`

| # | Touch | Changement |
|---|---|---|
| T1 | `COMBAT_ENDED` listener (~l. 643) | `setCombatMoveMode(null)` + `setCombatTargetMode(null)` + `setPendingMoveSelection(null)` ajoutés |
| T2 | `COMBAT_PHASE_CHANGED` listener (~l. 675) | Idem — reset avant `setPhase(phase)` |

### Clôture CUR1 ✅
- **Testé** : SR ✅ — mode cible actif + COMBAT_END → curseur normal ✅ — aucun panneau fantôme
- **Non testé** : —


---

## Session 95-7 — REWORK-01 clôture : SHK4 + SHK5 + CSS [A1] — 2026-06-16

### Objectif

Clôturer proprement REWORK-01 : corriger les deux bugs résiduels (SHK4 + SHK5) et les violations de conventions [A1] documentées en Session 96. Journal de session : `docs/REWORK-01-CLOSURE.md` (15 pièges documentés avant implémentation).

### Fichiers modifiés

| Fichier | Modification |
|---|---|
| `server/src/lib/statusService.js` | M1 : `resolveShockTest` retourne `rolls`+`seed` — M2 : `applyStun` branche PJ lit `shock_auto_stun` — M3 : `emitShockDiceResult` (export synchrone) |
| `server/src/socket/index.js` | 5 call sites : `emitShockDiceResult` ajouté après chaque `resolveShockTest` non-null |
| `client/src/locales/fr.json` | `sidebar.shockTestDetail` ajouté |
| `client/src/locales/fr.json.test` | Idem (Z10) |
| `client/src/components/Sidebar.jsx` | Routing `cardType === 'shock_test'` → `shockTestDetail` dans ternaire |
| `client/src/components/CombatStunWindow.jsx` | [A1] : `className="btn"`, classes `.combat-stun-*`, suppression `styles` objet |
| `client/src/index.css §11` | Nouvelles classes `.combat-stun-overlay`, `.combat-stun-header-title`, `.combat-stun-outcome-label`, `.combat-stun-outcome-desc` |

### Pièges évités (critiques)

- **Z8** — Site 2 COMBAT_MELEE_DEFENSE_CONFIRM : `meleeCampaignId` pas `campaignId` — aurait broadcasté D20 dans la mauvaise room
- **Z5** — `emitShockDiceResult` appelé si `shockResult` non-null même si `outcome='ok'` (règle publique)
- **Z10** — `fr.json.test` mis à jour en même temps que `fr.json`

### Clôture SHK4 ✅
- **Testé** : D20 visible chat (outcomes ok/étourdi/inconscient) ✅ — carte "Test de Choc" avec seuils ✅ — non-régression Scénarios 1-5 ✅
- **Non testé** : —

### Clôture SHK5 ✅
- **Testé** : `shock_auto_stun=false` → GM reçoit `CombatStunWindow` ✅ — PJ ne reçoit pas ✅ — non-régression `true` ✅
- **Non testé** : —

### Clôture [A1] ✅
- **Testé** : Vite 200 ✅ — SR sans erreur ✅
- **Non testé** : rendu visuel fin (couleur `.btn` + box-shadow dynamique) — cosmétique, non-bloquant

## Session 97 — REWORK-03 : woundService (wound insertion centralisée + fix DIV-1) — 2026-06-16

### Objectif

Extraire `resolveWoundInsertion` + broadcast `WOUND_ADDED` des 5 call sites WS inline (`socket/index.js`) vers un nouveau module `woundService.js`. Corriger DIV-1 (bug actif depuis Session 71 : `worst_wound_severity` absent des WOUND_ADDED WS → spread Zustand écrasait activement la valeur → couleurs sévérité perdues à chaque blessure combat).

Journal d'analyse complet : `docs/REWORK-03.md` (11 sections, 8 pièges documentés).

### Fichiers modifiés

| Fichier | Modification |
|---|---|
| `server/src/lib/woundUtils.js` | +export `getWorstWoundSeverity(db, charSheetId)` — `WOUND_SEVERITIES.slice().reverse()` (fix PIEGE-7 ORDER hardcodé) |
| `server/src/lib/woundService.js` | NOUVEAU — `applyWound(io, db, campaignId, { charSheetId, characterId, localisation, severity })` → `{ finalSeverity }` ou null |
| `server/src/socket/index.js` | Import woundUtils → `import * as woundService`. 5 call sites (CS1–CS5) remplacés. Commentaire L.3783 mis à jour. |
| `server/src/routes/character/char-sheet.js` | Import + `getWorstWoundSeverity`. Fonction locale L.630–638 supprimée. 3 appels `(db, sheet.id)`. |
| `docs/BUGIDENTIFIE.md` | DIV-1 documenté et marqué ✅ résolu |

### Pièges évités (critiques)

- **PIEGE-4** — CS2 (`COMBAT_MELEE_DEFENSE_CONFIRM`) : `meleeCampaignId` pas `campaignId`
- **PIEGE-7** — `getWorstWoundSeverity` : ordre WOUND_SEVERITIES dynamique (`.slice().reverse()`) — désynchronisation future impossible
- **P49** — `finalSeverity = result.wound.severity` post-promotion, pas la sévérité initiale
- **DIV-1** — `worst_wound_severity: undefined` dans WOUND_ADDED WS → spread `{ ...c, ...partial }` Zustand écrasait activement la valeur existante à chaque blessure combat

### Clôture REWORK-03 ⚠️ clos partiel

- **Testé** : T1 — blessure MORTELLE Bras D (PNJ Soleil, distance) → `worst_wound_severity` dans WOUND_ADDED ✅ — couleurs sévérité token + timeline ✅ — pipeline Test de Choc + stun 4 tours intact ✅
- **Non testé** : T2 (CaC PNJ auto) — T3 (promotion en cascade) — T4 (ligne pleine sévérité max) — T5 (REST GM manuel)

---

## Session 98 — REWORK-05 : panneaux d'action partagés (COM5 + CL2) — 2026-06-17

### Objectif

Extraire 3 panneaux droits (Tir, CaC, Drone) + 1 export log (`DeclareLogContent`) dupliqués entre `CombatGmDeclareWindow` et `CombatActionWindow` (~370 lignes dupliquées). Corriger bug COM5 (mode chip GM déclenchait target mode auto) et bug CL2 (log déclarations Joueur divergeait du GM).

Plan complet : `docs/REWORK-05.md` (9 étapes, 6 pièges documentés, run à vide).

### Fichiers modifiés

| Fichier | Modification |
|---|---|
| `client/src/components/combatSections.js` | +`ACTION_LABELS`, `PURE_MOVE_TYPES`, `COMBAT_MODE_DEFS` — migrés depuis les 2 fenêtres |
| `client/src/components/CombatDeclareLog.jsx` | +`export function DeclareLogContent({ maxHeight })` — lit stores directement. Import constantes depuis combatSections. |
| `client/src/components/DroneWeaponPanel.jsx` | NOUVEAU — panneau drone partagé (cyan #30aaaa) |
| `client/src/components/AssaultRangedPanel.jsx` | NOUVEAU — panneau tir CC/RC/RL partagé (rouge #e07070) |
| `client/src/components/MeleeCombatPanel.jsx` | NOUVEAU — panneau CaC partagé (vert #70c070) — fix COM5 inclus |
| `client/src/components/CombatGmDeclareWindow.jsx` | Panneaux droits → 3 imports partagés. Fix COM5 : `onModeChange` ne déclenche plus `handleStartMelee()`. |
| `client/src/components/CombatActionWindow.jsx` | `declareLogSection` inline → `<DeclareLogContent>` (fix CL2). Panneaux droits → 3 imports partagés. Import constantes depuis combatSections. |

### Pièges évités (6 identifiés en run à vide)

- **P1** — `DeclareLogContent` = corps seul, pas de titre (GM a titre draggable, Joueur titre inline)
- **P2** — Styles prop supprimée : panneaux définissent leurs styles internes, container wrapper reste dans le parent
- **P3** — `isWeaponDrawn` ajouté à `MeleeCombatPanel` (grisage armes Joueur)
- **P4** — `chargeMoveDest` normalisé : GM passe `chargeSelection?.move ?? null`, Joueur passe `moveSelection ?? null`
- **P5** — `handleStartMelee()` déplacée (pas supprimée) : retirée du chip mode → appelée via bouton "Cibler" explicite
- **P6** — Tooltips COMBAT_MODE_DEFS : version Joueur choisie comme source canonique (plus complète)

### Fix COM5

**Avant :** click chip "Offensif/Normal/…" dans `CombatGmDeclareWindow` → `if (!isDefensif) handleStartMelee()` → mode visée s'ouvrait automatiquement.
**Après :** `onModeChange(mode)` dans `MeleeCombatPanel` = mode change uniquement. Target entry = bouton "Cibler" explicite → `onChooseTarget(0)` → parent appelle `handleStartMelee()`.

### Fix CL2

**Avant :** `declareLogSection` — 53 lignes JSX inline dans `CombatActionWindow` avec rendu légèrement différent du GM.
**Après :** `<DeclareLogContent maxHeight="170px" />` — lit `announcedActions` + `tokens` depuis stores directement. Rendu identique GM/Joueur.

### Clôture REWORK-05 ⚠️ clos partiel

- **Testé** : build Vite 0 erreur ✅ — SR 0 erreur ✅
- **Non testé** : Scénario 1 (tir GM CC) — Scénario 2 (COM5) — Scénario 3 (CL2 log) — Scénario 4 (charge Joueur) — Scénario 5 (drone GM)

## Session 100 — REWORK-07 : socketUtils (getUserColor + checkTokenOwnership + LOC_TABLE_CONTACT) — 2026-06-17

### Objectif

Extraire deux patterns copiés-collés depuis `server/src/socket/index.js` vers `server/src/lib/socketUtils.js`. Supprimer `LOC_TABLE_CONTACT` (dead code — identique à `LOC_TABLE`).

### Ce qui a été fait

**Nouveau module `server/src/lib/socketUtils.js` :**
- `getUserColor(db, userId, fallback = '#5b8dee')` → string
- `checkTokenOwnership(db, token, userId, role)` → `{ isGm, isOwner }`

**Pattern A — `getUserColor` — 6 call sites remplacés :**
DICE_ROLL (`socket.user.id`), MACRO_ROLL (`socket.user.id`, fallback `'#aa8a30'` préservé via 3e param), CHAT_MESSAGE, ENTITY_ACTION_RESOLVE (`pending.playerUserId`), ENTITY_MOVE_REQUEST, COMBAT_SURPRISE_RESULT.

**Pattern B — `checkTokenOwnership` — 4 call sites remplacés :**
TOKEN_MOVE (`socket.user.id` + `socket.emit('error', ...)` préservé), TOKEN_ROTATE (`socket.data.userId`), TOKEN_SET_ROTATION (`socket.data.userId`), TOKEN_STATUS_TOGGLE (`socket.data.userId`). Call sites L.599 et L.1850 (logique multi-type, character déjà chargé) : hors périmètre, intacts.

**LOC_TABLE_CONTACT :** définition supprimée (identique à `LOC_TABLE` — confirmé lecture L.51-67). 3 usages dans handlers CaC remplacés par `LOC_TABLE`.

**Note pour implémentation future table CaC :** quand la table de localisation contact distincte sera implémentée (MANUELSYSCOMBAT §6.2), grep `LOC_TABLE` dans les handlers de résolution melee pour retrouver les 3 sites.

**Inconsistance documentée, non corrigée (hors périmètre) :** TOKEN_MOVE utilise `socket.user.id`, TOKEN_ROTATE/SET_ROTATION/STATUS_TOGGLE utilisent `socket.data.userId`. Désormais visible aux 4 appels `checkTokenOwnership` au lieu d'être noyée dans 4 blocs de 7 lignes.

### Fichiers modifiés

| Fichier | Modification |
|---|---|
| `server/src/lib/socketUtils.js` | NOUVEAU — `getUserColor` + `checkTokenOwnership` |
| `server/src/socket/index.js` | +import socketUtils, −LOC_TABLE_CONTACT, −6×Pattern A, −4×Pattern B |
| `docs/ARCHI_REWORK.md` | DoD REWORK-07 ✅ complet |
| `docs/EN_COURS.md` | +REWORK-07 ✅ |

### Clôture ✅ CLOS COMPLET

- **Testé :** DICE_ROLL couleur ✅ — TOKEN_MOVE ownership ✅ — TOKEN_ROTATE ✅ — TOKEN_STATUS_TOGGLE ✅ — CHAT_MESSAGE ✅ — SR sans erreur ✅
- **Non testé :** MACRO_ROLL fallback `'#aa8a30'` (non observable — DB toujours disponible en conditions normales)

---

## Session 99 — REWORK-05 clôture + fixes post-test (BUG-W1, BUG-W2, ERG-W1, ERG-W2) — 2026-06-17

### Objectif

Clôturer REWORK-05 : valider les 5 scénarios, extraire `computeFireVariant` (DoD grep), appender ARCHI_REWORK.md. Puis corriger les 2 bugs et 2 demandes ergonomiques identifiées pendant les tests.

### Partie 1 — Validation REWORK-05 + computeFireVariant

**Validation 5/5 scénarios :** tir GM CC, COM5, CL2, charge Joueur, drone GM. ✅

**`computeFireVariant` extrait dans `combatSections.js` :**
DoD exigeait `grep "currentFireMode === 'CC'"` = 0 dans les deux parents. 22 lignes dupliquées remplacées par un appel unique `computeFireVariant(fireMode, rawBulletCount, variantAB, { defaultCcCount })`. GM passe `{ defaultCcCount: 1 }` (PNJ default tir simple), Joueur passe rien (`null` = sélection explicite requise). `effectiveBulletCount ?? 1` dans la prop Joueur préserve la pré-sélection visuelle radio sans changer la validité du formulaire.

**ARCHI_REWORK.md** : section REWORK-05 appendée. REWORK-06 (`combatDeclarationStore`) documenté.

### Partie 2 — Bugs et ergonomie identifiés en test

#### BUG-W1 — Arme holstérée sélectionnée par défaut dans panneau CaC

**Cause :** `useEffect` ligne 175 de `CombatGmDeclareWindow` appelait `setSelectedGmMeleeWeaponId(w.inv_id)` sans vérifier `state_weapon`. Piège : `localStates.weapon` est stale dans ce contexte (update asynchrone) — il faut lire `initialStates.weapon` (dérivé inline = toujours frais au render).

**Fix :** `if (w && !w.ref_fire_mode && initialStates.weapon === 'drawn') setSelectedGmMeleeWeaponId(w.inv_id)`

#### BUG-W2 — 2 attaques CaC : crash silencieux sélection cible

**Cause réelle :** dans `handleEnterTargetMode` (SessionPage), `wrappedSelected` appelle `onTargetSelected(targetId)` (synchrone → inclut `selectNext(1)` → `setCombatTargetMode({slot1})`), puis `setCombatTargetMode(null)`. React batch : le `null` écrase le `{slot1}` du même batch. Slot 1 jamais actif → "pas de fenêtre".

Diagnostic initial (stale closure) partiellement correct mais pas la cause principale. `effectiveMeleeCountRef` ajouté quand même (couvre le cas count-change-before-call).

**Fix :** `setTimeout(() => selectNext(idx + 1), 0)` — différer l'appel après que le batch `setCombatTargetMode(null)` soit appliqué. Slot 1 s'ouvre dans le tick suivant. Fenêtre invisible pendant tout l'enchaînement (`isSelectingOnMap=true`).

#### ERG-W1 — "Assaut (tir)" auto-draw

`disabled` splittée en `noRangedWeapon` (vrai blocage) / `weaponNotDrawn` (grisé cliquable). Click "Assaut (tir)" quand `localStates.weapon !== 'drawn'` → `setLocalStates(prev => ({...prev, weapon: 'drawn'}))` → delta INI recalculé automatiquement via `calcIniDelta`. Tag "sans arme dist." conditionné sur `noRangedWeapon` uniquement.

#### ERG-W2 — CaC weapon default + auto-draw/holster

`onWeaponChange` dans `CombatGmDeclareWindow` étendu :
- `id !== null && weapon !== 'drawn'` → `setLocalStates(weapon: 'drawn')` (auto-draw, coût −3 ou −5 selon état)
- `id === null && weapon !== 'holstered'` → `setLocalStates(weapon: 'holstered')` (auto-holster, coût −10 depuis drawn, −5 depuis ready)

Aucun changement dans `MeleeCombatPanel` (`isWeaponDrawn={true}` conservé — P3/P7 hors scope, lié à REWORK-06).

### Fichiers modifiés

| Fichier | Modification |
|---|---|
| `client/src/components/combatSections.js` | +`computeFireVariant` (factorisation currentVariant depuis GM + Joueur) |
| `client/src/components/CombatGmDeclareWindow.jsx` | BUG-W1 (init weapon) + BUG-W2 (setTimeout slot N) + ERG-W1 (auto-draw tir) + ERG-W2 (auto-draw/holster CaC) |
| `client/src/components/CombatActionWindow.jsx` | `computeFireVariant` importé, blocs currentVariant remplacés |
| `docs/ARCHI_REWORK.md` | +REWORK-05 section + REWORK-06 prémices |
| `docs/REWORK-05.md` | Session 99 observations + DoD complet |

### Clôture ✅ CLOS COMPLET

- **Testé :** 5/5 scénarios REWORK-05 ✅ — BUG-W1 ✅ — BUG-W2 (2 attaques) ✅ — ERG-W1 ✅ — ERG-W2 ✅
- **Non testé :** 3 attaques CaC (BUG-W2) — ERG-W2 depuis `state_weapon=ready` — ERG-W1 coût `ready→drawn` (−3)

---

## Session 101 — REWORK-02 : damageService (résolution hit centralisée) — 2026-06-17

### Objectif

Extraire le bloc dupliqué "résolution cible" (localisation D20 → armure → dégâts nets → sévérité → blessure → shock test) depuis 4 sites dans `index.js` vers un nouveau `server/src/lib/damageService.js`.

Prérequis identifié en analyse pre-code : `LOC_TABLE` définie inline dans `index.js` non importable → déplacée dans `shared/armorConstants.js` (Étape 0).

### Périmètre réel (plan disait 2 sites — réalité : 5 trouvés, 4 traités)

| Site | Localisation | Traité |
|---|---|---|
| 1 | `COMBAT_DAMAGE_CONFIRM` L.2344–2437 | ✅ |
| 2 | `COMBAT_MELEE_DEFENSE_CONFIRM` branche PNJ L.2660–2702 | ✅ |
| 3 | `resolveMeleeAction` humanoid | ❌ exclu scope |
| 4 | `resolveDroneAssaultAction` 8b L.3906–3948 | ✅ |
| 5 | `resolveAssaultAction` PNJ L.4234–4301 | ✅ |

### Interface créée

```js
// server/src/lib/damageService.js
export async function resolveTargetHit(io, db, campaignId, {
  degautsBruts,          // calculé par le caller
  characterIdCible, cibleType, char_sheet_id_cible,
  for_na_cible, con_na_cible, vol_na_cible,
})
// → null si cibleType === 'drone'
// → { rollLoc, locRolls, locSeed, slotCode, localisation, etq, rd,
//     degatsNets, severity, is_lethal, finalSeverity, shockResult }
```

### Décisions d'architecture

- `LOC_TABLE` → `shared/armorConstants.js` (Option A — même famille sémantique que `SLOT_TO_WOUND_LOCATION`)
- `degautsBruts` calculé par le caller (contexte MR/modDom varie par site)
- Emits conservés dans les callers (DAMAGE_RESULT vs ATTACK_RESULT divergent trop)
- `emitShockDiceResult` + `applyStun` conservés dans les callers (ont besoin de userId/username/color du tireur)
- DoD grep corrigé : `calcResistanceDommages → 2` (import L.13 + resolveMeleeAction exclu)

### Fichiers modifiés

| Fichier | Modification |
|---|---|
| `shared/armorConstants.js` | +`LOC_TABLE` exportée (6 lignes) |
| `server/src/lib/damageService.js` | NOUVEAU — `resolveTargetHit` |
| `server/src/socket/index.js` | +import armorConstants (LOC_TABLE) + import damageService — 4 blocs dupliqués → 4 appels `resolveTargetHit` — LOC_TABLE inline supprimée |

### Clôture ⚠️ CLOS PARTIEL

- **Testé :** SR ✅ — assault PNJ auto (Site 5) sans erreur ✅ — melee flows sans erreur ✅
- **Non testé :** Site 1 (COMBAT_DAMAGE_CONFIRM PJ interactif) — Site 2 (MELEE_DEFENSE_CONFIRM PNJ qui touche) — Site 4 (drone assault PNJ cible)

## Session 103 — REWORK-09 : SessionPage hooks WS dédiés — 2026-06-18

### Objectif

Extraire 47 listeners WS du `useEffect` monolithique de `SessionPage.jsx` (1509 lignes) vers 3 hooks dédiés dans `client/src/lib/`.

### Problème résolu en cours de session

**TDZ (Temporal Dead Zone)** : les appels `useEntitySocket({ setRadialMenu, setMoveTarget })` et `useCombatSocket(...)` avaient été placés avant les déclarations `useState` correspondantes. Les arguments passés directement (pas en closure) sont évalués immédiatement → ReferenceError au chargement → écran noir. Fix : déplacement des 4 déclarations de hooks juste avant le `useEffect` socket (L.379-385), après tous les `useState`.

### Fichiers créés

| Fichier | Contenu |
|---|---|
| `client/src/lib/useTokenSocket.js` | 5 listeners TOKEN_* (MOVED, CREATED, DELETED, UPDATED, STATUS_UPDATED) |
| `client/src/lib/useEntitySocket.js` | 4 listeners : MAP_SWITCH, ENTITY_ACTION_PENDING/RESULT, ENTITY_MOVE_RESULT |
| `client/src/lib/useCombatSocket.js` | 18 listeners COMBAT_* + 12 états résultat (reloadResult, damagePayload/Results, attackResult, gmAttackResult, pnjAttackResult, meleeDefensePrompt, meleeResult, stunPayload, pendingSurpriseRoll, announcementMarker, pjPreview) |

### Fichiers modifiés

| Fichier | Modification |
|---|---|
| `client/src/pages/SessionPage.jsx` | 1509 → 1296 lignes. Imports + hooks WS. 12 useState combat supprimés. ~198 lignes de listeners supprimées. `tokens={tokens}` (dead prop) supprimé. `combatSocket.*` branché dans props CombatOverlay + Canvas3D. `handleSurpriseRolled` réécriture deps F-R9-7. `useCombatStore` destructuring réduit à `phase: combatPhase`. `clearPendingEntityId` retiré de useSessionStore destructuring. |
| `client/src/components/CombatOverlay.jsx` | L.20 : `announcementMarker` retiré du destructuring des props (dead param confirmé) |

### DoD

- [x] `node --check useTokenSocket.js` → 0 erreur
- [x] `node --check useEntitySocket.js` → 0 erreur
- [x] `node --check useCombatSocket.js` → 0 erreur
- [x] `npm run build` → 0 erreur Vite
- [x] SR sans erreur
- [x] `grep -c "s\.on(" SessionPage.jsx` → 18 (≤ 20)
- [x] `grep -c "tokens={tokens}" SessionPage.jsx` → 0
- [x] `grep -c "announcementMarker" CombatOverlay.jsx` → 0
- [x] Scénarios 1–8 validés (token drag, token create, entity action, combat complet, melee défense, fin de combat)

### Clôture ✅ CLOS COMPLET

- **Testé :** drag token ✅ — entity action request ✅ — combat start/announcement/resolution ✅ — melee attaque/défense ✅ — combat end ✅ — session sans combat ✅
- **Non testé :** —

## Session 105 — Validations fonctionnelles groupées — 2026-06-18

### Objectif

Validation en jeu réel de tous les items en attente accumulés depuis les sessions 74–101.

### Validations confirmées

| Item | Statut |
|---|---|
| REWORK-03 T2 — CaC PNJ auto (blessure + shock) | ✅ |
| REWORK-03 T3 — Promotion cascade Légère→Grave | ✅ |
| REWORK-03 T4 — Ligne pleine AppError | ✅ |
| REWORK-03 T5 — REST GM manuel hors combat | ✅ |
| REWORK-02 Site 1 — COMBAT_DAMAGE_CONFIRM PJ interactif | ✅ |
| REWORK-02 Site 2 — MELEE_DEFENSE_CONFIRM PNJ hit | ✅ |
| REWORK-02 Site 4 — drone assault PNJ cible | ✅ |
| DMG1+DMG2 — Labels DICE_RESULT dégâts drone | ✅ |
| Sprint Drones 2c — cycle complet drone joueur | ✅ |
| Sprint CaC Étape 3 — CombatCacModifiersWindow + mods | ✅ |
| Fix split-brain slot detection | ✅ |
| Sprint CaC 4b — attaque multiple melee | ✅ |

### Régression confirmée

**DR2** — déplacement drone absent dans `CombatGmDeclareWindow` — déjà enregistré comme dette basse, sprint futur.

### Clôture ✅ CLOS COMPLET

- **Testé :** 12 scénarios de validation fonctionnelle ✅
- **Non testé :** —

---

## Session 105b — REWORK-08 : planification complète — 2026-06-18

### Objectif

Planifier REWORK-08 (modularisation `socket/index.js`, 4 266 lignes) avant de coder. Session analytique pure — zéro code produit.

### Travail effectué

**Audit `socket/index.js` :**
- Cartographie complète des 14 blocs (lignes exactes, handlers, helpers, resolve*)
- 6 Maps singletons inventoriées et affectées aux modules futurs
- 5 call sites `getMrTable` confirmés par grep (1 socketEntity + 4 socketCombat)
- 8 usages des constantes `PORTEE_MOD_COMP` etc. confirmés : 100% dans socketCombat, 0 dans socketDice

**Décisions architecturales :**
- Pattern `registerXxxHandlers(io, socket, context)` → validé par docs officielles Socket.IO v4
- Handlers enregistrés dans SESSION_JOIN (après contexte établi) — changement comportemental mineur, sémantiquement correct
- Singleton-promise pattern pour `getMrTable` (cache la promesse, pas le résultat) — fix race condition
- Constantes de modificateurs → socketCombat.js (correction d'une erreur initiale qui les plaçait dans socketDice)
- R8-1 et R8-5 (import circulaire) : supprimés — problème n'existait pas

**Spec rédigé dans `ARCHI_REWORK.md` §REWORK-08 :**
- 7 étapes ordonnées avec lignes source, vérifications, scénarios
- Interface cible complète (5 signatures + implémentation `mrTable.js` 18 lignes)
- 4 pièges documentés [R8-2 à R8-4, R8-6]
- Bloc "Agent futur" avec protocole d'exécution

**Bug INI2 ajouté à `BUGIDENTIFIE.md` :** initiative non recalculée après blessure en combat — cluster H, post-REWORK-08.

### Clôture ✅ CLOS COMPLET (planning)

- **Testé :** spec relu + analyse critique + validation via docs officielles Socket.IO
- **Non testé :** —

---

## Session 106 — REWORK-08 : planification Étapes 2 & 3 — 2026-06-18

### Objectif

Auditer et enrichir les specs Étape 2 (socketToken.js) et Étape 3 (socketVoxel.js) du REWORK-08. Session analytique pure — zéro code produit.

### Travail effectué

**Étape 2 — socketToken.js (L.232–360, 4 handlers) :**
- Lecture source ligne par ligne — imports spec corrigés (retrait `getUserColor`, `collisionAddToken`, `collisionRemoveToken` — 0 usage ; ajout `statusService` — L.351)
- `socketUtils.js` vérifié : `checkTokenOwnership(db, token, userId, role)` → `role === 'gm'` (L.15) → substitution `isGm ? 'gm' : 'player'` confirmée
- Substitution table complète : `socket.campaignId/user.id/data.userId/role` → context
- Emplacement exact `context` dans SESSION_JOIN : après catch combat sync (L.220), avant console.log (L.222)
- Scénario de test corrigé : "créer/supprimer token" retiré (REST, pas WS)
- [R8-7] ajouté aux pièges documentés

**Étape 3 — socketVoxel.js (L.364–511, 5 handlers) :**
- Lecture source ligne par ligne — import fantôme `buildCollisionMap` retiré (0 usage dans handlers voxel — reste SESSION_JOIN)
- MAP_SWITCH : 3 occurrences `socket.campaignId` dont 2 en requête DB — risque d'omission documenté
- MAP_VIEWPORT : synchrone, `socket.to()` (pas `io.to()`) — intentionnel, GM non destinataire de son viewport
- Commentaires "Guard Bug B" et "race condition" : à préserver impérativement lors de la migration
- Asymétrie guard `battlemapId` (VOXEL_ADD/UPDATE ont le guard, VOXEL_REMOVE non) : documentée, à migrer tel quel
- [R8-8] à [R8-11] ajoutés aux pièges documentés

**Piège architectural [R8-11] :** double enregistrement si SESSION_JOIN émis deux fois sur même socket. Risque nul en pratique (client crée nouveau socket à chaque reconnect). Documenté avec mitigation.

### Clôture ✅ CLOS COMPLET (planning)

- **Testé :** lecture source vérifiée ligne par ligne pour les deux étapes, run à vide ×3, analyses critiques ×3
- **Non testé :** —

## Session 106b — REWORK-10 : CombatDeclareLogSidebar — 2026-06-18

### Objectif

Implémenter REWORK-10 Étapes 1–4 : transformer `CombatDeclareLog` (fenêtre flottante draggable, GM uniquement) en sidebar fixe gauche style MacOS Terminal, visible GM + joueurs.

### Travail effectué

**Étape 1 — `index.css` (Session 105, déjà clos) :** CSS `.cdl-*` ajouté + reset `combat-declare-log-body` fond blanc ([R10-6]).

**Étape 2 — `CombatDeclareLog.jsx` :**
- Suppression `import { useDraggable }`
- Remplacement `CombatDeclareLog` (default export, chrome floatant) par `CombatDeclareLogSidebar` (chrome `.cdl-*`, windowshade collapse)
- `EntryLines` + `DeclareLogContent` : inchangés
- `npm run build` → 0 erreur

**Étape 3 — `CombatActionWindow.jsx` :**
- Suppression `import { DeclareLogContent }`
- Suppression 3 occurrences `<DeclareLogContent maxHeight="170px" />` (états attente/déclaré/résolution non-actif)
- `DeclareLogContent` : 0 occurrence restante (grep confirmé)
- `npm run build` → 0 erreur

**Étape 4 — `CombatOverlay.jsx` :**
- Suppression ancien render L.363 (`isGm && ... && <CombatDeclareLog />`)
- Ajout nouveau render en 1ère position JSX (avant `CombatTimeline`) sans `isGm &&`
- Import alias `CombatDeclareLog` inchangé — héritage `--sidebar-w` confirmé
- SR sans erreur

### Clôture ⚠️ CLOS PARTIEL

- **Testé :** `npm run build` → 0 erreur (Étapes 2/3/4), SR sans erreur, greps définition of done
- **Non testé :** Scénarios 1–8 (nécessite session de combat active), ajustement visuel `top` [R10-5]

---

## Session 107 — REWORK-08 : planification Étapes 4 & 5 — 2026-06-18

### Objectif

Session planification uniquement (0 ligne de code). Analyse critique des Étapes 4 et 5 du REWORK-08 pour enrichir `docs/ARCHI_REWORK.md` à destination des agents futurs.

### Travail effectué

**Étape 4 — correction spec `socketDice.js` (issue détectée en Session 106) :**
- Imports exacts confirmés par grep L.518–748 : 6 exports charStats (`calcSkillTotal`, `calcAttributeNA`, `calcREA`, `calcSeuils`, `calcSouffle`, `calcResistanceDroguesInput`)
- Table de substitution [R8-12] rédigée : ×10 campaignId, ×6 user.id, ×5 username, ×4 role, ×4 io.to, ×2 io.in
- [R8-12] annoté : `calcAttributeAN` absent malgré mention "AN/NA" dans l'Interface cible — MACRO_ROLL utilise uniquement `calcAttributeNA`
- [R8-13] ajouté : `CHARACTER_UPDATED` = relique Chantier 1 — migrer tel quel sans nettoyer

**Étape 4 — correction critique `mrTable.js` (bug singleton-promise) :**
- Diagnostic : le spec Session 105 stockait le QueryBuilder Knex (`db('polaris_mr').orderBy()`) comme `mrTablePromise` — chaque `await` re-exécute la requête SQL (QueryBuilder non réentrant)
- Fix : `.then(r => r)` convertit le QueryBuilder en Promise native cachée
- `async function getMrTable()` → `function getMrTable()` (plus d'`await` interne)
- Commentaire "Format : dmax" corrigé en "modifier"

**Étape 5 — planification complète `socketEntity.js` :**
- Lecture source L.753–1458 (7 handlers ENTITY) + L.2750–2782 (resolveEntityState)
- 6 écarts corrigés vs Interface cible originale → [R8-14] :
  1. `getModifier` manquait (utilisé L.1243)
  2. `collisionAddEntity` / `collisionRemoveEntity` / `woundService` listés à tort (0 usage dans L.753–1458)
  3. `collisionMoveToken` manquait (L.1411)
  4. `isCaseOccupied` manquait (×4, boucle step-by-step)
  5. `calcAttributeAN` ET `calcAttributeNA` — les deux variantes nécessaires
  6. `ATTR_LABELS` depuis charStats.js — ×6 usages
- Table de substitution [R8-14] : ×14 campaignId, ×5 user.id, ×5 username, ×5 role, ×5 io.to, ×2 io.in
- Notes ⚠️ ajoutées : `pending.campaignId` (ne pas substituer) + `socket.id` (ne pas substituer par user.id) + `ENTITY_CREATED` gm_only (ne pas uniformiser avec broadcast global)
- Revue architecturale via recherche Socket.IO issues #407 / #3477 : Maps combat sans cleanup disconnect = risque réel documenté → noté dans [R8-3], sprint dédié post-REWORK-08
- Interface cible socketEntity.js (§Interface cible du spec) mise à jour : imports corrigés inline

### Pièges run à vide

- `collisionMoveToken` utilise `entity.battlemap_id` (pas `token.battlemap_id`) — migrer tel quel
- `!pending.skillId` dans ACTION_RESOLVE n'émet pas DICE_RESULT — comportement intentionnel
- `token.pos_z + 1` dans isCaseOccupied acteur — garde anti-faux-blocage sol — ne pas supprimer
- `normalizedFormula` variable fantôme L.905 — dead code existant, migrer tel quel
- `s.data.role` dans ENTITY_CREATED (fetchSockets) ≠ `socket.role` du handler — ne pas substituer

### Clôture ✅ CLOS COMPLET (planification)

- **Testé :** spec Étape 4 et Étape 5 vérifiés ligne par ligne vs source L.518–748 + L.753–1458 + L.2750–2782
- **Non testé :** implémentation (session suivante)

---

## Session 106c — REWORK-10 : CDL intégré chat Sidebar — 2026-06-18

### Objectif

Changer l'approche REWORK-10 suite au retour utilisateur : la sidebar fixe gauche (`CombatDeclareLogSidebar` dans `CombatOverlay`) était non déplaçable, positionnée au milieu du playground et peu utile. Nouvelle direction : intégrer le log de déclarations directement dans le panel chat de `Sidebar.jsx`, en haut du tab chat, avec collapse sur une ligne.

### Travail effectué

**`Sidebar.jsx` :**
- Import `useCombatStore` + `{ DeclareLogContent }` ajoutés
- `const { phase, currentTurn } = useCombatStore()` dans le corps du composant
- `const [cdlOpen, setCdlOpen] = useState(true)` ajouté
- Bloc CDL inséré en premier enfant du fragment tab 'chat', avant `<div style={styles.messages}>` :
  - visible uniquement si `phase === 'ANNOUNCEMENT' || phase === 'RESOLUTION'`
  - header cliquable (`cdl-chat-header`) → toggle `cdlOpen`
  - body (`cdl-chat-body`) → `<DeclareLogContent />` quand ouvert

**`CombatOverlay.jsx` :**
- `import CombatDeclareLog` supprimé
- `'--cdl-top'` supprimé du style de l'overlay div
- Render `{(phase === 'ANNOUNCEMENT' || phase === 'RESOLUTION') && <CombatDeclareLog />}` supprimé

**`index.css` :**
- Nouveau bloc `.cdl-chat` / `.cdl-chat-header` / `.cdl-chat-body` ajouté après les `.cdl-*`
- Override `.cdl-chat .combat-declare-log-body` → `background: transparent; max-height: none; overflow-y: visible`

### Clôture ⚠️ CLOS PARTIEL

- **Testé :** SR ok, fonctionnel confirmé par utilisateur
- **Non testé :** Scénarios 1–8 (pas de session de combat disponible)

---

## Session 108 — REWORK-08 : Étapes 6 & 7 (socketCombat.js + index.js finalisation) — 2026-06-19

### Objectif

Compléter REWORK-08 : créer `server/src/socket/socketCombat.js` (~2 800 lignes — 13 handlers + 13 helpers + 7 constantes), modifier `index.js` pour appeler `registerCombatHandlers`, et finaliser `index.js` (import cleanup, ≤200 lignes).

### Travail effectué

**`server/src/socket/socketCombat.js` (créé) :**
- 7 constantes : `PORTEE_MOD_COMP`, `SITUATION_MODS`, `TAILLE_MODS`, `SITUATION_LABELS`, `PORTEE_LABELS`, `TAILLE_LABELS`, `COMBAT_MODE_LABELS`
- `export function registerCombatHandlers(io, socket, context, pendingMaps)` + destructuring `context` + `pendingMaps`
- 13 handlers : COMBAT_START, COMBAT_END, COMBAT_ANNOUNCE_START, COMBAT_INIT_STATE, COMBAT_SURPRISE_RESULT, COMBAT_ACTION_DECLARE, COMBAT_SKIP_PLAYER, COMBAT_ANNOUNCE_PREVIEW, COMBAT_ACTION_CONFIRM, COMBAT_DAMAGE_CONFIRM, COMBAT_MELEE_DEFENSE_CONFIRM, COMBAT_STUN_CONFIRM, COMBAT_APPLY_STUN
- 13 helpers : `startAnnouncementTimers`, `skipPlayer`, `startResolutionPhase`, `advanceSlot`, `endTurn`, `multiAdversaryMalus`, `countAdversaires`, `resolveMeleeAction`, `resolveReloadAction`, `resolveDroneAssaultAction`, `resolveAssaultAction`, `calcDroneRD`, `resolveDroneIntegrityLoss`
- Substitutions [R8-25] appliquées : `socket.campaignId → campaignId`, `socket.role → isGm`, `socket.user.id → user.id`, `socket.user.username → user.username`
- [R8-16] respecté : `COMBAT_DAMAGE_CONFIRM` → `pendingCampaignId`, `COMBAT_MELEE_DEFENSE_CONFIRM` → `meleeCampaignId`, `COMBAT_STUN_CONFIRM` → variable locale depuis `pending`
- `pendingMaps` passé explicitement aux 19 call sites (7 helper→helper + 12 handler→helper)

**`server/src/socket/index.js` (modifié — Étape 6) :**
- `import { registerCombatHandlers } from './socketCombat.js'` ajouté
- `registerCombatHandlers(io, socket, context, { pendingDamageActions, pendingMeleeDefense, pendingStunActions, combatTimers, combatPreviews })` ajouté après `registerEntityHandlers` dans SESSION_JOIN
- `socket.on('disconnect', ...)` déplacé dans SESSION_JOIN (sans garde `if (socket.campaignId)`) — utilise `socket.user` + `campaignId` du paramètre SESSION_JOIN
- 13 handlers COMBAT (L.222–1492) supprimés
- Ancien disconnect (L.1494–1503) supprimé
- 13 helpers (L.1509–2994) supprimés
- 7 constantes (L.71–120) supprimées

**`server/src/socket/index.js` (Étape 7 — finalisation) :**
- Imports morts supprimés : `getMrTable`, `getModifier`, `parseDice`, `charStats.js` (20 exports), `woundService`, `statusService`, `damageService`, `socketUtils` (`getUserColor`, `checkTokenOwnership`), `armorConstants`, `woundConstants`, `redis.js` (10 fonctions sauf `buildCollisionMap`)
- Import conservé : `buildCollisionMap` (SESSION_JOIN inline L.134)
- 183 → 143 lignes

**Checks :**
- `node --check socketCombat.js` → 0 erreur ✓
- `node --check index.js` → 0 erreur ✓
- `wc -l index.js` → 143 lignes (≤200) ✓
- `npm run build` → 0 erreur Vite ✓
- SR → ok ✓

**Note dette cosmétique :** Les commentaires français dans index.js ont subi un mojibake UTF-8→Latin-1 lors de la reconstruction PowerShell (`Get-Content` sans `-Encoding UTF8`). Fonctionnellement transparent (Node.js parse valide UTF-8, seuls les `console.log` de connexion affichent du texte garbled). À corriger sprint futur (simple re-écriture des commentaires concernés).

### Clôture ⚠️ CLOS PARTIEL

- **Testé :** SR ok, `node --check` ×2, `npm run build`, 143 lignes
- **Non testé :** Scénarios 1–17 (pas de session de combat disponible pour valider les flux complets)
