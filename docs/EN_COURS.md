# EN COURS — Travail en cours / incomplet
> Dernière mise à jour : 2026-05-01 Session 43

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

Travaux effectués en session 43 :
- Fix Tchebychev dans index.js — suppression bloc Tchebychev (déplacement débloqué) ✅
- Badge MR displacement — index.js + SessionPage.jsx + fr.json + Sidebar.jsx ✅
- Snap 8 axes contraint depuis l'entité — Canvas3D.jsx ✅
- Couleurs ghost bleu=push / orange=pull / rouge=impossible — Canvas3D.jsx ✅
- Lerp 300ms TokenMesh — Canvas3D.jsx ✅
- Lerp 300ms EntityMesh (voxel + GLB) — EntityMesh.jsx ✅
- Correction prop entityTextureMaterials — EntityEditor.jsx ✅
- Logs debug step-by-step conservés dans index.js (décision dev) ✅

---

## Prochaines tâches

### Chantier suivant — à définir
Voir ROADMAP.md pour les options.

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

### Bug A — Toggle visible character non répercuté en temps réel
Statut : correction prévue session dédiée.

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
