# EN COURS — Dettes actives et prochaines étapes
> Dernière mise à jour : 2026-06-12 Session 89
> Contenu : dettes actives + roadmap + points de vigilance permanents.
> Historique complet : voir `docs/JOURNAL4.md` (Sessions 86+) et `docs/Old/JOURNAL3.md` (Sessions 64–85).

---

## État global

- Phase 0 ✅ / Phase 1 ✅ / Phase 2 en cours
- **78 migrations appliquées** (76, 76c, 76d — 76b, 77, 77b planifiées Sprint 2d+3)
- Migrations : voir `docs/ASBUILT.md` § Base de données

---

## En attente de validation fonctionnelle

- **Sprint Drones 2c** — cycle complet drone joueur validé SR ✅ — bugs Loc-Drone + Dmg-Drone identifiés (voir dettes)
- **Sprint CaC 4b** (attaque multiple melee — 2/3 cibles, −5/−7 malus) — Session 74
- **Sprint Test de Choc** (migration 69, shock_auto_stun) — Session 81

---

## Dettes actives

| Dette | Priorité | Contexte |
|---|---|---|
| `is_stunned` non enforced dans `COMBAT_ACTION_DECLARE` | Haute | PC42 — sprint `stunned_until_turn` |
| `is_stunned` sans durée (LdB p.237 : 1d6 tours) | Haute | sprint `stunned_until_turn` requis |
| Bug CL1 — Portraits PNJ non visibles dans timeline joueur | Haute | CombatTimeline.jsx — PNJ absent characterStore joueur |
| Bug CL2 — Design CombatDeclareLog mauvais + divergence GM/joueur | Moyenne | CombatDeclareLog.jsx + declareLogSection — ref = version GM |
| Bug Loc-Drone — jet localisation D20 incorrect pour cible drone | Haute | `resolveDroneAssaultAction` — §7.6 : zone unique fixe, pas de D20. Sprint dégâts drone |
| Bug Dmg-Drone — dégâts non enregistrés sur drone cible | Haute | `resolveDroneAssaultAction` — blindage direct, RD integrite×2, drone_sheet.damages JSONB. Sprint dédié |
| Bug CL3 — Ghosts déplacement d'annonce disparus | Moyenne | CombatOverlay.jsx — announcementMarker, régression Sessions 88–91 |
| "Changer le mode de tir" — non implémenté | Moyenne | sprint dédié futur |
| Sprint Annonce v2 — actions précédentes en lecture seule | Moyenne | GmDeclareWindow + ActionWindow |
| Surprise critique (roll=1) → initiative=1 | Basse | à analyser |
| WorkshopPage crash `err.response?.data?.error` | Basse | extraire `.message` |
| `useDiceAudio.js` — sons dés | Basse | — |
| `.gitattributes:3` — attribut invalide | Basse | — |
| `onTokenRotate` dead code Canvas3D/Scene | Basse | — |
| `getVoxelSurfaceTop` — pas de cas slope/wedge | Basse | default y+1.0 acceptable V1 |
| Kiwi P-SRV-5 — ports Docker non restreints à 127.0.0.1 | Infra | voir SERVEURDISTANTKIWI.md |
| Logs debug `index.js` — conservés volontairement | Infra | à retirer avant production |

---

## Roadmap

- **Sprint Drones 2** — ✅ 2a (INI 12) ✅ 2b (drone cible) ✅ 2c (cycle joueur valide) → **Sprint Dégâts Drone** (Loc-Drone + Dmg-Drone, §7.6) → 2d (auto-announcement) → 2e (resolveDroneAutoAction) — voir `docs/PLAN_DRONESYSCOMBAT.md`
- **Sprint Drones 3** — Télépilotage (drone lié à PJ pilote)
- **Sprint stunned_until_turn** — durée étourdissement + purge endTurn
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
