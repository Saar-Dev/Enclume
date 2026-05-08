# EN COURS — Travail en cours / incomplet
> Dernière mise à jour : 2026-05-08 Session 54

---

## Phase 0 — ✅ Complète
## Phase 1 — ✅ Complète
## Phase 2 — En cours

### Chantier 9A — Refonte voxel ✅
### Chantier 9B — Interface CRUD texture packs ✅
### Chantier 9C — Système entités interactables ✅
### Chantier 9D — Atelier du GM ✅
### Chantier 9E — Entités en session ✅ (session 36)
### Chantier 9F-0 — Calcul serveur Polaris ✅ (session 36)
### Chantier 9F-A — Fondations mouvement ✅ (session 39)
### Chantier 9F-B1 — Déplacement entités serveur + atelier ✅ (session 40)
### Chantier 9F-B2 — Mode visée client ✅ (session 41)
### Chantier 9F-C — Diagonal 45° + animation Lerp ✅ (session 43)
### Chantier Dice Rework ✅ (session 44)
### Chantier 10 sprint 1 — ref_equipment ✅ (sessions 46-47)

Travaux effectués en sessions 46-47 :
- Schéma `ref_equipment` défini champ par champ avec Saar ✅
- Migration 48 : `ref_equipment` + 3 junction tables + 6 CHECK constraints ✅
- Route API `/api/equipment` (CRUD complet + transaction) ✅
- Page admin standalone `localhost:3001/equipment-admin.html` ✅
  - Saisie rapide YAML (33 alias courts, js-yaml CDN)
  - Presets catégories (Arme / Protection / Munition / Conteneur / Divers)
  - Multi-select compétences groupées par famille

Travaux effectués en session 48 :
- Seed `2_seed_equipment.js` — 636 items injectés (KO-par-défaut, garde name idempotent) ✅
- `diff_equip.mjs` — outil diff BDD vs STEP1, réutilisable ✅
- Vérification post-seed : 23 divergences acceptées (corrections intentionnelles vs livre de règles) ✅
- Junction tables skills : enrichissement manuel en cours

### Chantier 11 sprint 1 — Module Blessures ✅ (session 49)
### PC22 — Fix 403 toggle is_learned MUTATION/POLARIS ✅ (session 50)

Travaux effectués en session 49 :
- `shared/woundConstants.js` — source de vérité partagée (LOCATIONS, SEVERITIES, MAX_COUNTS, PENALTIES) ✅
- Migration 49 : `character_wounds` (UUID PK, FK char_sheet CASCADE, CHECK constraints SQL) ✅
- `char-sheet.js` — refactorisé avec `router.param` + 4 routes blessures + broadcasts WS ✅
- `charStats.js` — `calcWoundPenalty()` ajoutée ✅
- `WoundManager.jsx` — composant autonome (grille fixe, clic POST/PUT/DELETE, promotion transparente) ✅
- Onglet "Matériel" dans CharacterWindow ✅

---

## Prochaines tâches

### Chantier 10 sprint 2 — char_inventory ✅ (session 51)

Travaux effectués en session 51 :
- Migration 50 : `char_inventory` + `char_sheet.sols` ✅
- `calcEncumbrancePenalty()` dans `charStats.js` ✅
- 5 routes inventaire + route sols dans `char-sheet.js` ✅
- `InventoryPanel.jsx` — affichage + edit GM (ajout depuis catalogue, équipement, suppression) ✅
- Montage dans `CharacterWindow.jsx` onglet Matériel sous WoundManager ✅

### Chantier 11 suite — Intégration malus blessures dans calculs Polaris ✅ (session 52)

Travaux effectués en session 52 :
- `GET /wounds` enrichi avec `wound_penalty` calculé côté serveur ✅
- `CharacterSheet.jsx` — Initiative effective avec tooltip `position:fixed` ✅
- `socket/index.js` — `effectiveMalus` dans `chancesDeReussite` (jets réels) ✅
- Règle documentée : malus santé non-cumulatif (pire seul) + encombrement cumulatif (règle maison)

### Chantier 10 sprint 3 — Armures multi-couches + codes slots indépendants ✅ (session 54)

Travaux effectués en session 54 :
- Problème : `LOCATION_TO_SLOT` mappait bras_gauche + bras_droit → 'B', jambe_gauche + jambe_droite → 'J' → équiper à l'un affichait partout
- Solution : codes distincts BG/BD/JG/JD (localisation indépendante)
- `shared/armorConstants.js` — LOCATION_TO_SLOT + nouveau SLOT_TO_REF_LOCATION (mapping compat ref_equipment) ✅
- `LocationPanel.jsx` — `refCode` pour lookup ref_location, equip/unequip indépendant par slotCode ✅
- `char-sheet.js` — VALID_SLOTS + BASE_ARMOR + POST/PUT LIKE queries (multi-slot) ✅
- Migration 51 — nullifie slots B/J stales via regex `(^|/)(B|J)(/|$)` ✅
- ref_equipment.location intouché — mapping client gère la compat
- Test : Pagan équipée indépendamment à Tête+Bras+Jambes ✅

---

## Chantier reporté — Paramètre campagne GM entity move mode

Décision session 41 : reporté en chantier dédié.
3 options prévues :
- Option réaliste : tous les tokens GM font des jets
- Option à la carte : case à cocher par token non attribué à un joueur
- Option divine : GM ne fait jamais de jet

Implique : nouvelle colonne `campaigns.gm_entity_move_mode`, option par token `tokens.bypass_entity_move_roll`, interface paramètres campagne.

---

## Bugs connus toujours ouverts

### Bug WebGL — Context Lost au switch play/edit
Cause : Three.js r160+ + drivers GPU Windows. Non bloquant. Statut : documenté, abandonné.

### Bug B — Modification faces voxel existant non exposée dans l'UI
Statut : correction prévue si besoin.

---

## Points de vigilance permanents

- "La Forêt Maudite" — pas de default_battlemap_id → ne jamais utiliser pour les tests
- token.owner_id — mort → toujours character_id → characters.user_id
- socket dans dependency arrays — tout useCallback qui émet doit inclure socket (P3)
- ordre déclaration React — callback A qui appelle B doit être déclaré APRÈS B (P4)
- coordonnées voxel — données brutes en base, +0.5 uniquement dans le rendu visuel
- reconnectTrigger — ne jamais appeler socket.disconnect/connect depuis Sidebar
- PE14 pos_y/pos_z — pos_y base = Z Three.js, pos_z base = Y Three.js
- charStats.js — fonctions pures, jamais d'accès DB dans ce fichier
- redis.js — maintenance Redis dans REST (POST/DELETE), pas dans handlers WS reliques (PE25)
- resolveEntityState — returning doit inclure battlemap_id (PE26)
- collisionMoveToken — hdel systématique ancienne case, hset conditionnel layer (PE24)
- PE27 moveType — calculé client (feedback) ET recalculé serveur (validation). Si discordance → refus silencieux
- Token GM sans char_sheet → ENTITY_MOVE_REQUEST ignoré silencieusement — comportement documenté V1
- Lerp EntityMesh — useFrame dans sous-composants (pas EntityMesh parent) — règle des hooks
- Logs debug index.js — conservés volontairement, à retirer avant production
- DiceMesh useMemo — deps [geoDef.type, color, dieType] — dieType obligatoire pour D10 (PE32)
- D10 Html overlay — position=[0,0,0] — ne pas déplacer (PE33)
- P49 — promotion blessures : always GET /wounds si promoted === true (ne pas ajouter wound localement)
