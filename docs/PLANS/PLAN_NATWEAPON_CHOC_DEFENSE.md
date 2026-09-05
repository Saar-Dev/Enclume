# PLAN_NATWEAPON_CHOC_DEFENSE.md — Choc de mutation à arme naturelle perdu si le défenseur PJ se défend activement

> Rédigé 2026-09-05 (Claude/Saar). Ticket `NATWEAPON-CHOC-DEFENSE-GAP` (`bug_tickets`, `triaged`),
> trouvé par analyse à charge du chantier Choc exo/drone (`docs/Old/PLAN_CHOC_EXO_DRONE.md`) en
> traçant le champ `weaponRefId` sur le même chemin. **Autorité : Livre de Base Polaris p.243 — une
> mutation à arme naturelle avec bonus de Choc (ex. Corne, « +1D6 si tête ») applique ce bonus
> exactement comme une arme catégorie 1/2.** Cadrage strict, une seule responsabilité : faire
> circuler `naturalWeaponCharMutationId`/`attackerSheetId` jusqu'au bout du chemin CaC « défenseur
> joueur qui se défend activement », déjà correct sur les 3 autres chemins CaC. Cause et portée
> différentes du chantier Choc exo/drone (humanoïde uniquement, aucun rapport avec l'exo/le drone) et
> du chantier attribution du Test de Choc (déjà clos) — non mélangé avec l'un ou l'autre.

---

## 1. Constat [VÉRIFIÉ, corrigé après relecture du code actuel]

`getEffectiveMeleeDamage` (`damageService.js:203-260`) donne priorité au Choc de mutation à arme
naturelle (branche `naturalWeaponCharMutationId && charSheetId`) sur le Choc d'arme équipée. Ce
champ, ainsi que `attackerSheetId` (la fiche de l'attaquant, nécessaire pour vérifier que la
mutation est toujours active au moment du jet), sont bien posés dans `commonPending` par
`resolveMeleeAction` (`socketCombatHelpers.js:1842-1843`) et correctement consommés par les 3
branches défenseur à résolution **immédiate** : `resolveDefenselessTarget` (:1888,1903),
`resolveMeleeDefensePnj` (:1973,2057), `resolveMeleeDefenseDrone` (:2120,2139).

**La 4ᵉ branche défenseur — `resolveMeleeDefensePj` (:2149-2172, défenseur PJ qui a droit à une
VRAIE défense active) — passe par un chemin différent, à 2 sauts, pas 1 :**

1. `resolveMeleeDefensePj` stocke tout `ctx` (= `commonPending`, contient déjà les 2 champs) dans
   `combat_pending` — **rien à changer ici**, les champs survivent intacts.
2. `confirmMeleeDefense` (:586-730) redéstructure `pending` à la main deux fois (déstructuration
   :603-615, `ctx` reconstruit :703-710) avant d'appeler `resolveMeleeDefenseHitAttackerPj` (:736-784,
   attaquant PJ) ou `resolveMeleeDefenseHitAttackerPnj` (:792-830, attaquant PNJ/exo/drone). **Aucune
   des deux listes n'inclut les 2 champs.**
3. Ici les deux branches divergent :
   - `resolveMeleeDefenseHitAttackerPnj` résout **immédiatement** (`getEffectiveMeleeDamage` appelée
     directement en son sein) — 1 point de contact.
   - `resolveMeleeDefenseHitAttackerPj` (attaquant **joueur**) ne résout **pas** elle-même — elle
     arme un **nouveau** `combat_pending` (type `'melee'`) via `armAwaitingDamage`, consommé plus
     tard par `confirmDamage`. **Le ticket original s'arrêtait à cette fonction sans remarquer
     qu'elle délègue encore plus loin** — `confirmDamage`, branche CaC (:911-939), qui appelle elle
     aussi `getEffectiveMeleeDamage` (:931) sans les 2 champs, jamais mentionnée dans le diagnostic
     initial. **2 points de contact, pas 1, pour ce sous-chemin.**

**5 points de contact au total** (pas 4) : `confirmMeleeDefense` ×2,
`resolveMeleeDefenseHitAttackerPnj` ×1, `resolveMeleeDefenseHitAttackerPj` ×1, `confirmDamage`
(branche CaC) ×1.

**Conséquence inchangée par cette correction** : un attaquant (PJ ou PNJ) porteur d'une mutation à
arme naturelle avec bonus de Choc, qui touche un défenseur PJ ayant activement tenté de se défendre
(et perdu l'opposition), perd le bonus de Choc de sa mutation. `getEffectiveMeleeDamage` retombe sur
la branche `weaponInvId` (arme équipée, si présente) ou « mains nues » — jamais la branche mutation.
Aucune erreur, résultat de jeu simplement incomplet.

**Reproduction — donnée de test disponible** : le PNJ Baboulinet porte désormais la mutation
« Corne » (`natural_weapon_formula: '1D10'`, `natural_weapon_choc_formula: '1D6'`, vérifié en base).
Scénario : Baboulinet attaque en CaC un PJ qui se défend activement et se fait quand même toucher —
le Choc 1D6 doit apparaître.

---

## 2. Architecture — réutiliser, jamais dupliquer

Aucune nouvelle fonction. Les 2 champs (`naturalWeaponCharMutationId`, `attackerSheetId`) existent
déjà, portés par `commonPending` depuis toujours — il ne leur manque que 5 relais sur un seul
chemin, exactement le même patron déjà appliqué avec succès pour `weaponRefId` pendant le chantier
Choc exo/drone (mêmes fonctions `confirmMeleeDefense`/`resolveMeleeDefenseHitAttackerPnj`, un champ
de plus à chaque déstructuration/reconstruction déjà en place).

### 2.1 Les 5 sites

| # | Fonction | Ligne | Action |
|---|---|---|---|
| 1 | `confirmMeleeDefense` | `:603-615` | Ajoute `naturalWeaponCharMutationId, attackerSheetId` à la déstructuration de `pending` |
| 2 | `confirmMeleeDefense` | `:703-710` | Ajoute les 2 mêmes champs au `ctx` reconstruit pour `resolveMeleeDefenseHitAttackerPj`/`Pnj` |
| 3 | `resolveMeleeDefenseHitAttackerPnj` | `:792-798` + appel `getEffectiveMeleeDamage` | Ajoute les 2 champs à la déstructuration de `ctx`, puis `naturalWeaponCharMutationId, charSheetId: attackerSheetId` à l'appel — même patron exact que les 3 branches saines |
| 4 | `resolveMeleeDefenseHitAttackerPj` | `:736-742` + payload `armAwaitingDamage` | Ajoute les 2 champs à la déstructuration de `ctx`, puis les relaie dans le payload (nouveau `combat_pending` type `'melee'`) |
| 5 | `confirmDamage`, branche CaC | `:911-918` + appel `getEffectiveMeleeDamage` (`:931`) | Ajoute les 2 champs à la déstructuration de `pending`, puis à l'appel — **site non identifié par le ticket initial** |

### 2.2 Aucun changement pour

- Les 3 branches déjà saines (`resolveDefenselessTarget`, `resolveMeleeDefensePnj`,
  `resolveMeleeDefenseDrone`) — déjà correctes, servent de référence pour le patron exact à
  reproduire.
- `resolveMeleeDefensePj` elle-même — stocke déjà tout `ctx`, rien à ajouter.
- `getEffectiveMeleeDamage` — la fonction sait déjà tout faire, elle attend seulement ces 2 champs.

---

## 3. Hors périmètre

- **Chantier Choc exo/drone** et **attribution du Test de Choc** — déjà clos, causes différentes.
- **Le pattern général de relais par listes de champs recopiées à la main** (constaté une 2ᵉ fois
  ici, après le chantier attribution) — toujours pas traité comme dette structurelle à part, cohérent
  avec la décision déjà prise deux fois (`ROADMAP.md` §5).

---

## 4. Plan de tests

- `node --check` sur `socketCombatHelpers.js`.
- Aucun test automatisé existant pour ces fonctions (DB-dépendantes, non exportées) — cohérent avec
  les 2 chantiers précédents du même domaine.
- **Session réelle Saar, seule validation qui compte** : Baboulinet (mutation Corne) attaque en CaC
  un PJ qui se défend activement et se fait quand même toucher — le Choc 1D6 doit apparaître (dégât
  additionnel + Test de Choc affiché sous le nom du PJ défenseur, cf. correctif d'attribution déjà
  en place). Non-régression : même attaque contre un défenseur sans défense/PNJ/drone (les 3
  branches saines) — comportement strictement inchangé.

---

## 5. État d'implémentation

| Étape | Statut |
|---|---|
| Plan | Rédigé, corrigé après relecture (5 sites, pas 4) |
| Analyse à charge | Faite — aucun risque de plantage/régression trouvé, 2 commentaires stales identifiés en plus des 5 sites |
| 5 sites | Codés (`socketCombatHelpers.js`), `node --check` + `git diff --check` OK |
| Tests + session réelle | **Bloqué** — tentative Saar (2026-09-05, Baboulinet/Corne vs PJ en défense) rejetée en amont par `getNaturalWeaponIneligibilityReasons` (`shared/naturalWeapons.js`, chantier `PLAN_MUTATION2` antérieur, sans rapport) : la mutation « Corne » exige `natural_weapon_requires_grapple` (cible préalablement saisie), mécanique non implémentée à ce jour. Seule « Corne » porte une formule de Choc parmi les armes naturelles (vérifié en base) — aucun autre mutation ne permet de tester le chemin sans Saisie. **Décision Saar : validation différée à l'implantation de la Saisie CaC**, code laissé tel quel dans le worktree (non commité) en attendant.
