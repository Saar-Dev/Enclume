# EN COURS — Dettes actives et prochaines étapes
> Dernière mise à jour : 2026-06-17 Session 101
> Contenu : dettes actives + roadmap + points de vigilance permanents.
> Historique complet : voir `docs/JOURNAL4.md` (Sessions 86+) et `docs/Old/JOURNAL3.md` (Sessions 64–85).

---

## ⚡ PROCHAINE ÉTAPE EXACTE

> Lire ce bloc en PREMIER. Il indique quoi faire maintenant, dans quel ordre, et vers quel fichier aller.

**1. ~~Valider Sprint 14-0~~** ✅ CLOS — Session 95 suite 2

**2. ~~REWORK-01 — statusService~~** ✅ CLOS Session 96 — Scénarios 1-5 validés

**3. ~~REWORK-03 — woundService~~** ✅ Session 97 — T1 validé ⚠️ clos partiel (T2–T5 non testés)
   → T2 : CaC PNJ auto (blessure + shock) / T3 : promotion cascade (Légère→Grave) / T4 : ligne pleine (AppError) / T5 : REST GM manuel (blessure hors combat)

**4. ~~REWORK-05 — panneaux partagés (COM5 + CL2)~~** ✅ CLOS COMPLET Session 99 — 5/5 scénarios ✅ + BUG-W1 ✅ + BUG-W2 ✅ + ERG-W1 ✅ + ERG-W2 ✅

**5. ~~REWORK-07 — socketUtils (getUserColor + checkTokenOwnership + LOC_TABLE_CONTACT)~~** ✅ CLOS COMPLET Session 100

**6. ~~REWORK-02 — damageService (resolveTargetHit)~~** ⚠️ Session 101 — clos partiel
   → Non testé : Site 1 (COMBAT_DAMAGE_CONFIRM PJ interactif) — Site 2 (MELEE_DEFENSE_CONFIRM PNJ hit) — Site 4 (drone assault PNJ cible)

**7. Sprint Bugs prioritaires** *(voir BUGIDENTIFIE.md)*
   → **Cluster I** — dégâts drone (DR6 + DR4 + DMG1 + DMG2) — **Haute**
   → **Cluster D** — fenêtres combat UI (UI1 + COM8) — **Haute** *(COM5 + CL2 fixés REWORK-05)*
   → **Cluster E** — arme et statuts (COM1 + COM2 + COM4 + COM7) — Moyenne

---

## État global

- Phase 0 ✅ / Phase 1 ✅ / Phase 2 en cours
- **79 migrations appliquées** (79 = expires_at_turn token_statuses — Session 93-3)
- Migrations : voir `docs/ASBUILT.md` § Base de données

---

## En attente de validation fonctionnelle

- **Fix DMG1+DMG2** — labels DICE_RESULT dégâts drone (Compétence/Seuil → Dés/Nets + intégrité) — SR ✅ — Session 93-5
- **Sprint Drones 2c** — cycle complet drone joueur — SR ✅ — bugs Loc-Drone + Dmg-Drone identifiés (voir dettes)
- **Sprint CaC Étape 3** — SR + Vite 200 ✅ — test fonctionnel requis (humanoid CaC + drone CaC avec mods)
- **Fix split-brain slot detection** — Session 93 — test requis : 6 tokens (1 non-annoncé INI haute), 4 déclarations, vérifier slot actif correct + CaC sans cible → COMBAT_DECLARE_ERROR + cycle complet sans fantôme
- **Sprint CaC 4b** (attaque multiple melee — 2/3 cibles, −5/−7 malus) — Session 74

---

## Dettes actives

> Détail technique de chaque bug → [`docs/BUGIDENTIFIE.md`](BUGIDENTIFIE.md)

| ID | Description | Priorité |
|---|---|---|
| DMG1+DMG2 | Labels DICE_RESULT dégâts drone (Compétence/Seuil faux) | SR ✅ — validation fonctionnelle requise |
| DR4 | `calcDroneRD` : RD négatif → drone plein subit dégâts suppl. | Moyenne — sprint dédié |
| DR6 | Blindage drone non lu (0 affiché malgré DB=15) | Haute — instrumentation [DBG-DR6] requise |
| ST1 | Badge statut illisible sur token canvas (texte trop petit) | Haute — Sprint 14-2 |
| ST3 | Fenêtre THUG STATUTS trop petite — overflow des icônes statuts | Moyenne |
| CH1 | Historique chat perdu au F5 (rechargement page) | Haute |
| UI1 | Fenêtre déclaration design blanc | **Haute** |
| COM1 | Recharger ne fait rien | **Haute** |
| CL1 | Portraits PNJ non visibles timeline joueur | **Haute** |
| COM8 | Fenêtre annonce visible pendant sélection cible | Moyenne |
| COM2 | Vérif statut arme absente côté GM | Moyenne |
| COM4 | CaC exige arme au clair (mains nues impossible) | Moyenne |
| COM5 | ~~Mode combat sélectionne aussi la cible (GM)~~ | ✅ REWORK-05 Session 99 |
| COM7 | Multi-attaque CaC : duplicata / bouton grisé | Moyenne |
| CL2 | ~~Design CombatDeclareLog + divergence GM/joueur~~ | ✅ REWORK-05 Session 99 |
| CL3 | Ghosts déplacement d'annonce disparus | Moyenne |
| D1 | Menu radial "fiche" drone ne s'ouvre pas | Moyenne |
| COM9 | Viser une localisation précise — non implémenté | Moyenne — sprint dédié |
| — | "Changer le mode de tir" — non implémenté | Moyenne — sprint futur |
| — | Sprint Annonce v2 — actions en lecture seule | Moyenne — sprint futur |
| D2 | Token drone : changement GLB non fonctionnel | Basse |
| DR2 | Drone : déplacement absent | Basse — sprint futur |
| INI1 | Surprise critique (roll=1) → initiative=1 | Basse |
| WS1 | WorkshopPage crash `err.response?.data?.error` | Basse |
| AU1 | `useDiceAudio.js` — sons dés | Basse |
| TC1 | `.gitattributes:3` — attribut invalide | Très basse |
| DCO1 | `onTokenRotate` dead code Canvas3D/Scene | Très basse |
| VX1 | `getVoxelSurfaceTop` — pas de cas slope/wedge | Très basse |
| — | Kiwi P-SRV-5 — ports Docker non restreints | Infra |
| — | Logs debug `index.js` — conservés volontairement | Infra |

---

## Roadmap

- ~~**Sprint Dégâts Drone**~~ ✅ → B6 (Loc) + B7 (Dmg) — Clos Sessions 94
- **Sprint Drones 2d** — auto-announcement drone → voir `docs/PLAN_DRONESYSCOMBAT.md`
- **Sprint Drones 2e** — resolveDroneAutoAction
- **Sprint Drones 3** — Télépilotage (drone lié à PJ pilote)
- **Sprint PLAN 14-1** — Menu contextuel token (right-click → ajouter/retirer statuts)
- **Sprint PLAN 14-2** — Affichage badges (SVGs `docs/Character/Statuts/`, Canvas3D)
- **Sprint PLAN 14-3** — FIX-D + mécaniques enforced (bypass défense stunned/surprised)
- ~~**Sprint stunted_until_turn**~~ ✅ — supplanté par Sprint 14-0 — voir PLAN 14
- **Sprint CaC 4b** — validation fonctionnelle requise avant
- **Sprint Annonce v2** — actions précédentes en lecture seule (GmDeclareWindow + ActionWindow)
- **Sprint Tooltips Compétences** — SkillsPanel bouton ⓘ (déjà codé Session 73)
- **Sprint Waypoints** — déplacement points intermédiaires (déclaration serveur, alt+clic)
- **Sprint Page Santé Serveur** — `/api/health/detailed` (mémoire, uptime, températures)
- **D2 Jets Favoris** — drag-to-reorder macros (sort_order UI)
- **i18n combat+équipement** — 18 composants hors scope (sprint dédié futur)

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
- DiceMesh useMemo — deps [geoDef.type, color, dieType] — dieType obligatoire pour D10 (PE32)
- D10 Html overlay — position=[0,0,0] — ne pas déplacer (PE33)
- P49 — promotion blessures : always GET /wounds si promoted === true (ne pas ajouter wound localement)
- PI11 — polarisRound : source unique `shared/polarisUtils.js` — jamais redéfini localement
- PC41 — Express 5 : routes sans `/` initial → 404 silencieux — toujours `'/:id/foo'`
- PC42 — `WHERE NOT col = 'val'` exclut les NULL en PostgreSQL → toujours `(col IS NULL OR col != 'val')`
- PC43 — `orderByRaw('CASE WHEN ? IS NOT NULL ...')` : PostgreSQL ne peut pas inférer le type UUID sans cast → éviter pour les UUID, préférer le JS post-fetch
- PC44 — `io.fetchSockets()` nécessaire quand le GM clique Agir pour un slot joueur (socket ≠ joueur)
- PL-Q1 — `getSemanticHTML()` Quill 2.0 retourne vide — utiliser `querySelector('.ql-editor').innerHTML`
- PL-Q2 — Quill insère la toolbar comme `previousElementSibling`, pas à l'intérieur du container — guard `classList.contains('ql-container')`
- PL-Q3 — `containerRef.current` peut être null dans le cleanup React 19 — toujours capturer en variable locale en début d'effect
- PL-Q4 — `editor.destroy()` n'existe pas en Quill 2.0 public API
