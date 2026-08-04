# SYSTEME/ETATS_PERSONNAGE.md — État persistant de personnage (position, arme)
> Source : `docs/PLANS/PLAN_CHARACTER_STATES.md` (Lots 0-2b clos, Lot 2c différé — voir ce plan pour
> l'historique complet de la décision et son raisonnement).
> Lire pour : posture (accroupi/à genou/couché), état d'arme (rangée/en main/au clair), broadcast roster.

---

## Architecture générale

```
server/src/db/migrations/229_character_states.js  — schéma
server/src/lib/characterStateService.js            — point de résolution unique (lecture/écriture)
server/src/lib/combatRosterBroadcast.js             — mise en forme du roster envoyé aux clients
server/src/lib/characterStateShadowCheck.js          — garde-fou de cohérence combat_roster/character_states
```

## Schéma

```sql
-- Catalogue extensible — ajouter une valeur = une ligne, jamais une migration de schéma
ref_character_state_values (id, axis, value_code, label, UNIQUE(axis, value_code))

-- Autorité runtime — un état actif par axe et par token
character_states (
  id, token_id REFERENCES tokens(id) ON DELETE CASCADE,
  axis, value_code, updated_at,
  UNIQUE(token_id, axis),
  FOREIGN KEY (axis, value_code) REFERENCES ref_character_state_values(axis, value_code)
)
```

**Ancre `token_id`, pas `character_id`** : un GM peut poser plusieurs tokens partageant le même
`character_id` (ex. 5 gobelins identiques) — chacun a son propre état physique. `tokens` n'est pas
supprimé à `COMBAT_END` (contrairement à `combat_roster`), donc `token_id` fait aussi survivre l'état à
la fin du combat.

**Absence de ligne = valeur par défaut** (`position: 'standing'`, `weapon: 'holstered'`) — une seule
forme canonique. `setCharacterState` supprime la ligne quand la valeur cible égale le défaut, upsert
sinon (`server/src/lib/characterStateService.js`).

Valeurs seedées : `position` → `standing`/`crouching`/`kneeling`/`prone` ; `weapon` →
`holstered`/`ready`/`drawn`.

## API — characterStateService.js

```javascript
getCharacterStates(db, tokenId)              → { position, weapon }  // défauts appliqués
getCharacterStatesForTokens(db, tokenIds)     → Map<tokenId, { position, weapon }>  // batché, 1 whereIn
setCharacterState(db, tokenId, axis, valueCode) → upsert, ou DELETE si valueCode = défaut de l'axe
```

`db` (ou `trx`) reçu en paramètre explicite, jamais importé en singleton — permet d'appeler
`setCharacterState` dans la même transaction que l'écriture `combat_roster` qu'elle double-écrit
(même convention que `woundService.js`). Aucun autre fichier ne touche `character_states` directement.

## Deux autorités coexistent aujourd'hui — état intermédiaire assumé, pas une incohérence

| Consommateur | Source | Pourquoi |
|---|---|---|
| Broadcast roster (5 sites, `combatRosterBroadcast.js`) — ce que voient les clients | `character_states` | Lot 2b — la posture doit survivre à `COMBAT_END`, `combat_roster` ne le permet pas |
| `socketCombatAnnouncement.js:139` (`entry`) — coût d'Initiative + validation serveur Tir Visé | `combat_roster.state_position`/`state_weapon` | Non migré (Lot 2c, différé) — règle de jeu serveur authentique, pas un simple affichage |

`combat_roster.state_position`/`state_weapon` restent donc **écrites** (double-écriture active depuis
le Lot 1) même si elles ne sont plus **lues** pour l'affichage. `characterStateShadowCheck.js` compare
les deux sources après chaque écriture et log `[DBG-DECOUPLAGE]` sur écart (jamais bloquant) — garde-fou
actif tant que les deux sources coexistent, pas seulement un filet avant cutover.

**Ne pas supprimer les colonnes `combat_roster.state_position`/`state_weapon`** avant d'avoir migré
`entry` (`socketCombatAnnouncement.js`) vers `characterStateService` — sinon la validation Tir Visé et
le calcul du coût d'Initiative liraient une colonne plus jamais écrite. Prévu Lot 2c, différé
volontairement (Codex/Kiwi hors projet — plus d'urgence fusion — clôture alignée sur
`docs/PLANS/PLAN_RW_TOKEN.md` Phase 7, qui doit de toute façon consommer cette même table pour choisir
l'animation jouée).

## Correctif de bug — persistance de `state_position`

Avant Lot 2b, `endTurn()` réinitialisait `state_position` à `'standing'` à chaque fin de tour, dans le
même `UPDATE` bulk que les colonnes réellement per-tour (`state_cover`, `state_vitesse`). Erroné :
changer de position a un coût d'Initiative dédié (REGLESYSCOMBAT.md, « S'accroupir/Se redresser »
Init -3, « Se jeter à terre, plonger » Init -5) qui n'a de sens que si la position obtenue persiste.
Corrigé — `state_position` survit désormais entre les tours, comme `state_weapon`/`state_fire_mode`.

**Effet de jeu, pas seulement technique** : un adversaire qui reste couché encaisse maintenant les mods
de position (CaC/Tir) tour après tour au lieu d'être remis debout automatiquement — confirmé comme
comportement voulu par Saar en jeu réel avant clôture du Lot 2b.

## Pièges

| Code | Description |
|---|---|
| ETP1 | `combat_roster.state_position`/`state_weapon` restent l'autorité de `entry` (validation serveur) — ne pas les considérer mortes tant que le Lot 2c n'a pas migré ce consommateur. |
| ETP2 | `kneeling` (à genou, LdB) existe dans `ref_character_state_values`/`character_states` mais n'est pas encore atteignable via `COMBAT_ACTION_DECLARE`/`COMBAT_INIT_STATE` — `VALID_POS` (`socketCombatState.js`) et le `CHECK` de `combat_roster` restent limités aux 3 valeurs historiques (`standing`/`crouching`/`prone`) tant que le Lot 2c n'a pas basculé la validation. |
| ETP3 | `buildBroadcastRoster` est asynchrone (batch `getCharacterStatesForTokens`) — un site qui rebroadcasterait le roster sans `await` casserait silencieusement le payload (`state_position`/`state_weapon` undefined). |
| ETP4 | Un token GM peut partager `character_id` avec d'autres tokens (§ancre ci-dessus) — ne jamais réintroduire une clé sur `character_id` pour cette table, ça fusionnerait l'état de plusieurs tokens distincts. |
