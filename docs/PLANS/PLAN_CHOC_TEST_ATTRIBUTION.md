# PLAN_CHOC_TEST_ATTRIBUTION.md — Test de Choc affiché sous le nom du tireur au lieu de la cible

> Rédigé 2026-09-05 (Claude/Saar). Ticket `CHOC-TEST-WRONG-ATTRIBUTION` (`bug_tickets`, `triaged`),
> trouvé par Saar en validant `docs/Old/PLAN_CHOC_EXO_DRONE.md` (lance-flammes exo en zone —
> « Armure Alpha », le tireur, affiché faisant un Test de Choc). **Autorité : Livre de Base Polaris
> p.243 — c'est la cible touchée qui résiste au Choc, jamais l'attaquant.** Cadrage strict, une
> seule responsabilité : l'étiquette d'affichage (`DICE_RESULT` du chat) du Test de Choc. Ne touche
> ni à la résolution mécanique (déjà correcte — vérifié, voir §1), ni au chantier Choc exo/drone
> (cause et portée différentes, confirmé présent aussi côté humanoïde classique).

---

## 1. Constat [VÉRIFIÉ]

`statusService.emitShockDiceResult` (`server/src/lib/statusService.js:214-231`) émet un `DICE_RESULT`
purement d'affichage — `{ userId, username, color, skillLabel: 'Test de Choc', ... }`. Le résultat
mécanique lui-même (`shockResult`, calculé par `statusService.resolveShockTest`, appelé depuis
`damageService.js#resolveTargetHit`) utilise déjà correctement `for_na_cible`/`con_na_cible`/
`vol_na_cible` — les stats de la **cible**, jamais celles du tireur. Seule l'étiquette (qui apparaît
en tête du jet dans le chat) est fausse : chacun des 7 appels à `emitShockDiceResult` lui passe le
`userId`/`username`/`color` du **tireur**, jamais de la cible.

**7 sites, tous antérieurs à ce plan, aucun spécifique à l'exo/au drone :**

| Site | Cible possible à ce point du code |
|---|---|
| `socketCombatAoe.js:289` (`resolveAoeTargetDamage`) | **PJ ou PNJ** — vérifié sur données réelles (« Joueur Test », un PJ, touché par le lance-flammes exo en zone) |
| `socketCombatHelpers.js:838` (`resolveMeleeDefenseHitAttackerPnj`) | **PJ ou PNJ** — l'attaquant est non-PJ, la cible peut être n'importe quel type |
| `socketCombatHelpers.js:1094` (`resolveDamageConfirmNormalTarget`) | **PJ ou PNJ** — tireur PJ différé, `cibleType` transporté tel quel depuis la Déclaration |
| `socketCombatHelpers.js:1931` (`resolveDefenselessTarget`) | **PJ ou PNJ** — « cible sans défense » n'implique aucun type particulier |
| `socketCombatHelpers.js:2074` (`resolveMeleeDefensePnj`) | **PNJ garanti** — dispatché uniquement pour un défenseur PNJ |
| `socketCombatHelpers.js:2773` (`resolveAttackHitPnj`) | **PNJ/décor garanti** — dispatché uniquement si `!cibleCharacter \|\| cibleCharacter.type === 'pnj'` |
| `socketCombatHelpers.js:3405` (`resolveAssaultHitPnjNormal`) | **PNJ/décor garanti** — même garde que ci-dessus, chemin Tir humanoïde |

Aucun des 7 sites n'est jamais atteint pour une cible exo/drone — `resolveTargetHit` retourne `null`
pour ces deux types avant tout calcul de `shockResult` (déjà vérifié dans `PLAN_CHOC_EXO_DRONE.md`).

---

## 2. Architecture — réutiliser, jamais dupliquer

### 2.1 Ce qui existe déjà et sera réutilisé

| Brique | Où | Réutilisation |
|---|---|---|
| Convention d'affichage PNJ (`userId: null`, nom du personnage, `#808080`) | Déjà utilisée à de nombreux endroits (ex. `resolveMeleeDefensePnj:2008`, `resolveAttackHitDrone`, `resolveAssaultAction` arme sans formule...) | Reprise à l'identique, jamais un nouveau gris ou une nouvelle convention |
| `statusService.emitShockDiceResult` | `statusService.js:214-231` | Signature inchangée — seuls les 3 arguments passés par l'appelant changent |

### 2.1bis Analyse à charge — le premier jet de §2.2 aurait recréé le problème de fond

**Trouvaille avant tout code** : le patron « fetch `users` par `character.user_id`, repli sur le nom
du personnage + gris `#808080` sinon » n'est pas isolé — il est **déjà recopié 6 fois**, mot pour
mot, pour l'identité du **tireur** :

- `socketCombatExo.js:145` et `:362`
- `socketCombatAoe.js:113`
- `socketCombatHelpers.js:1642`, `:2605`, `:3010`

Le premier jet de ce plan proposait une fonction `resolveShockTestDisplayIdentity`, utile seulement
pour la cible du Test de Choc — une **7ᵉ copie** du même calcul, juste appliquée à un autre
personnage. Exactement le défaut que l'audit à l'origine de tout ce chantier dénonçait (pas
d'autorité unique, la même logique réécrite à chaque appelant). Corrigé avant tout code : voir §2.2.

### 2.2 Nouvelle fonction — `resolveCombatantDisplayIdentity` (générale, pas spécifique au Choc)

Un seul nouveau point d'autorité, dans `server/src/lib/combatantContextService.js` — fichier qui
porte déjà `resolveCombatantIdentity(db, character)` (identité *mécanique* : sheetId/userId/
effectiveType, pour savoir qui a le droit d'agir). La nouvelle fonction est sa sœur *d'affichage*
(quel nom/quelle couleur montrer dans le chat), sans logique de substitution pilote (aucun des 7
sites Choc n'atteint jamais un exo/drone — et les 6 sites tireur existants ne le font pas non plus
aujourd'hui, comportement reproduit à l'identique, pas changé) :

```js
// resolveCombatantDisplayIdentity(db, character, fallbackName) → { userId, username, color }
// PJ avec compte (character.user_id) : vraie identité (table users). Personnage sans compte
// (PNJ/décor) ou character null : userId null, nom du personnage (ou fallbackName), gris standard
// #808080 — même convention déjà utilisée partout pour un jet "au nom d'un PNJ".
export async function resolveCombatantDisplayIdentity(db, character, fallbackName = 'Cible') {
  if (!character?.user_id) return { userId: null, username: character?.name ?? fallbackName, color: '#808080' }
  const userRow = await db('users').where({ id: character.user_id }).select('color', 'username').first()
  return { userId: character.user_id, username: userRow?.username ?? character.name ?? fallbackName, color: userRow?.color ?? '#808080' }
}
```

Prend un `character` (la ligne, pas un id) — même convention que `resolveCombatantIdentity` juste
au-dessus dans le même fichier. Un appelant qui n'a que `characterIdCible` fait un `db('characters')
.where({id: characterIdCible}).first()` avant d'appeler, comme il le ferait pour n'importe quel
autre besoin de la ligne complète — pas une responsabilité de la fonction elle-même.

**Note pour plus tard (pas fait ici)** : les 6 sites tireur existants pourraient adopter cette même
fonction (refactor pur, comportement identique) — pas fait dans ce ticket pour ne pas mélanger un
correctif de bug avec un nettoyage de code déjà qui fonctionne (même principe que la dette de
dispatch `ROADMAP.md` §5, laissée de côté pendant tout le chantier Choc exo/drone). À reprendre
séparément si Saar le souhaite.

### 2.3 Application aux 7 sites — 2 groupes

**Groupe A — cible PJ ou PNJ, appel complet de `resolveCombatantDisplayIdentity`** (4 sites) :
- `resolveAoeTargetDamage` — passe `cibleCharacter` (déjà chargé, ligne ~230), aucune requête de plus.
- `resolveMeleeDefenseHitAttackerPnj`, `resolveDamageConfirmNormalTarget`, `resolveDefenselessTarget`
  — n'ont que `characterIdCible` en portée : chacun fait `const cibleCharacter = await
  db('characters').where({ id: characterIdCible }).first()` puis appelle la fonction.

Chacun remplace son appel `emitShockDiceResult(..., userId, tireurXxx/attackerXxx)` par : calculer
l'identité de la cible, puis `emitShockDiceResult(io, campaignId, shockResult, cibleIdentity.userId,
cibleIdentity.username, cibleIdentity.color)`.

**Groupe B — cible PNJ/décor garantie, pas besoin de la fonction** (3 sites) :
`resolveMeleeDefensePnj` (réutilise `defenderCharacterName`, déjà présent), `resolveAttackHitPnj`,
`resolveAssaultHitPnjNormal` (réutilisent `cibleCharacter.name`, déjà présent dans les deux). Remplace
directement `userId/tireurXxx/attackerXxx` par `null, <nom> ?? 'PNJ', '#808080'` — ces 3 sites savent
déjà structurellement que la cible n'a jamais de compte, appeler la fonction serait une question
posée dont la réponse est déjà connue.

---

## 3. Hors périmètre

- **Résolution mécanique du Test de Choc** — déjà correcte (stats de la cible), rien à changer.
- **Chantier Choc exo/drone** (`docs/Old/PLAN_CHOC_EXO_DRONE.md`) — cause et portée différentes,
  déjà clos.
- **Tout autre `DICE_RESULT` mal attribué** (hors Test de Choc) — pas cherché, pas dans le périmètre
  de ce ticket.

---

## 4. Plan de tests

- Aucun test automatisé existant pour ces fonctions (DB-dépendantes, non exportées pour la plupart) —
  cohérent avec les chantiers précédents du même domaine.
- `node --check` sur chaque fichier touché.
- **Session réelle Saar** : Test de Choc déclenché sur un PNJ (doit afficher son nom, gris) et sur un
  PJ (doit afficher son vrai nom/sa vraie couleur) — au moins un scénario Tir humain classique, un
  scénario CaC, et le lance-flammes exo en zone (déjà le cas qui a révélé le bug).

---

## 5. État d'implémentation

| Étape | Statut |
|---|---|
| Plan | Rédigé |
| Analyse à charge | **Faite (2026-09-05)** — a corrigé le plan : fonction généralisée (`resolveCombatantDisplayIdentity`, `combatantContextService.js`) plutôt qu'une 7ᵉ copie spécifique au Choc |
| Fonction `resolveCombatantDisplayIdentity` | **Codée et vérifiée (2026-09-05)** — testée manuellement sur 3 cas réels (PJ avec compte, PNJ, personnage null) |
| 7 sites (Groupes A/B) | **Codés et vérifiés** — `node --check` + `socketCombatAoe.test.mjs` (20/20) + `combatantContextService.test.mjs` (39/39), diff relu en entier |
| Tests + session réelle | **VALIDÉ en session réelle par Saar** — lance-flammes exo en zone (PJ tireur) et CaC (PNJ attaquant) contre le même PNJ cible (« Baboulinet ») : le Test de Choc s'affiche bien sous le nom de la cible dans les deux cas, jamais celui du tireur. Chantier fonctionnellement clos. |
