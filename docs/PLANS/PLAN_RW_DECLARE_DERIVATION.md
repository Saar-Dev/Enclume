# PLAN_RW_DECLARE_DERIVATION.md

> **Responsabilité** : plan temporaire (Règle 10) — finir la dérivation unique de la déclaration
> de combat côté client, reste différé de `PLAN_RW_DECLARE_DESIGN.md` (archivé `docs/Old/`,
> chantier clos 2026-08-30 : `JOURNAL8.md` §« RW déclaration : M0.4 + module 4 »).
> À l'achèvement : décisions durables → `docs/SYSTEME/COMBAT.md` + `docs/SYSTEME/REACT.md`, ce PLAN supprimé.
>
> Statut : **cadré + analyse à charge faite (2026-09-04). Périmètre resserré vs proposition initiale.
> En attente validation Saar avant code.**

---

## 1. Point de départ (vérifié dans le code, 2026-09-04)

Le chantier `PLAN_RW_DECLARE_DESIGN` a livré : reducers purs (`assaultDeclaration.js` /
`meleeDeclaration.js` + tests), hooks minces (`useAssaultDeclaration` / `useMeleeDeclaration`),
`declareChecks.js` (`assaultCheck` / `meleeCheck` / `reloadCheck` → `{valid, reason}` +
`buildBlockReason` + `hasSomethingToDeclare`), `buildDeclarePayload.js` (4 fonctions pures + golden
master, 68 tests).

**Restent 4 dérivations faites à la main, dupliquées :**

| # | Dette | Sites |
|---|---|---|
| 1 | `assaultCheck` / `meleeCheck` appelés avec ~7 args assemblés à la main ; la **neutralisation AOE** (`assaultDecl.isAoeMode ? 1 : …`) recopiée à l'identique | `CombatActionWindow.jsx:699-722`, `CombatGmDeclareWindow.jsx:446-463`, `CombatExoActionWindow.jsx:226-233` |
| 2 | **Branche AOE du payload dupliquée verbatim** (entrée `attack:[{…}]` mode zone + neutralisation dual-wield/visé) — seule vraie différence : bonus `null` (PJ) vs `0` (PNJ) | `buildDeclarePayload.js:52-66` (human) et `:161-175` (gm) |
| 3 | `useExoDeclare` / `useDroneDeclare` court-circuitent `assaultCheck` (exo : reconstruit un objet 6 champs en dur ; drone : booléen inline, **aucun `reason`**) | `useExoDeclare.js:226`, `useDroneDeclare.js:47` |
| 4 | Reset : ~15 setters au lieu de `clear()` (M0.4-f jamais fait — le journal dit « M0.4 a→g » mais ne mentionne pas `f`) | `CombatActionWindow.jsx` / `CombatGmDeclareWindow.jsx` effets de reset |

**Divergences légitimes à préserver** (en tête de `buildDeclarePayload.js`) : bonus `null`/`0` ·
`move.ini_mod` forcé 0 (PJ Charge/Retraite) vs brut (PNJ) · `weapon.inv_id` vs `assaultWeaponId` ·
`quick` spread vs 3 champs · `reload` objet vs booléen nu.

---

## 2. Analyse à charge (2026-09-04)

**Recherche** : le principe — stocker l'état minimal, tout dériver, zéro synchro manuelle —
est confirmé pro ([tkdodo](https://tkdodo.eu/blog/deriving-client-state-from-server-state),
[Steve Kinney](https://stevekinney.com/courses/react-performance/derived-vs-stored-state),
[Redux Style Guide](https://redux.js.org/style-guide)). Le codebase suit déjà ce patron.
Discriminant de profil sur une **fonction pure** (pas un hook) = pattern « discriminated union »
standard, et `buildDroneMapActions` / `buildExoMapActions` existent déjà comme fonctions par profil.

### Charge 1 — La proposition initiale (10 sous-commits, exo/drone inclus, `assaultPayloadSel` séparé) est sur-dimensionnée.

- La dette #1/#2 n'a **pas encore causé de bug** : le golden master + `declareChecks.js` (livrés
  2026-08-30) étaient précisément le correctif du risque « dérive silencieuse ». Le danger aigu est
  déjà couvert ; ne reste que le **latent** (le prochain qui ajoute un mode de tir / variante AOE
  doit penser à 2-4 sites).
- **Mais** `PLAN_ARMES_SPECIALES` ajoute activement des armes spéciales (lance-flammes livré,
  grenades à venir avec `intendedOrigin` — nouveau champ payload). La branche AOE de
  `buildDeclarePayload` **sera** touchée. → dé-dupliquer #2 est opportun, pas spéculatif.

### Charge 2 — COLLISION exo/drone avec `PLAN_ARMES_SPECIALES` Segment 2. `[VÉRIFIÉ]`

`PLAN_ARMES_SPECIALES.md` §1.4bis / tableau §fin :

> **Segment 2 — AOE tireur exo (après 1.5)** … + UI `CombatExoActionWindow` / `useExoDeclare`
> (bouton « Viser une zone », `aoeDirection`, `buildExoMapActions`, `ref_aoe_profile` dans le
> payload armes exo) ; + `CombatOverlay.jsx` prop `onEnterAoeTargetMode`.

Ce segment **possède déjà** la refonte de la déclaration exo (adaptateur de résolution d'arme
agnostique au type de tireur — même Strangler Fig que le contexte de Test). Il est séquencé
(après Segment 1.5, registre de mécanismes). Y toucher ici = doublonner ou pré-empter ce travail.
→ **exo/drone SORTENT de ce plan.** La réconciliation `assaultCheck` exo/drone se fera dans
`PLAN_ARMES_SPECIALES` Segment 2, où la déclaration exo est déjà ouverte.

### Charge 3 — `useDroneDeclare` : ajouter un `blockReason` = changement de comportement, pas iso-refactor.

Le footer drone n'a aujourd'hui **aucun** message de blocage. Lui en ajouter un est une évolution
UX (à valider Saar), pas de l'iso-comportement. → hors périmètre ici (rejoint exo/drone → Segment 2).

### Charge 4 — `assaultPayloadSel` séparé = couche d'indirection au bénéfice marginal.

`state → ctx → payloadSel → sel → buildPayload` ajoute un saut vs `state → sel → buildPayload`.
Le `ctx` requis (~9 champs : profil, arme résolue, `isDualWield`, `hasTwoWeapons`, `currentVariant`,
`dualWieldBonusComp`, `emptyBonus`…) est à peine plus petit que le `sel` actuel (~15 champs).
→ **Ne pas créer `assaultPayloadSel`.** À la place : `buildAttackEntries(sel, ctx)` /
`buildMeleeEntries(sel, ctx)` dans `buildDeclarePayload.js` absorbent la branche AOE **et** la
neutralisation côté payload. Les 4 wrappers les appellent. Le golden master couvre 100 %, signature
`buildHumanDeclarePayload(sel)` inchangée.

### Charge 5 — Le filet Saar (14+ scénarios) reste nécessaire pour le câblage fenêtre.

Le golden master ne couvre **pas** l'assemblage `fenêtre → sel`. Les étapes de câblage
(`CombatActionWindow` / `CombatGmDeclareWindow`) exigent une passe navigateur. Impossible à réduire,
mais on peut la concentrer en **une passe consolidée** en fin de plan plutôt qu'à chaque sous-commit.

### Verdict

Plan **sain mais à resserrer**. On garde le cœur (dé-dupliquer #1 + #2 + #4), on retire exo/drone
(#3, → `PLAN_ARMES_SPECIALES` Segment 2), on ne crée pas la couche `payloadSel` séparée.

---

## 3. Plan resserré

**Invariant** (`AGENTS.md` §3) : la dérivation « quels champs sont valides / partent au payload,
selon le mode de tir » = **une seule fonction pure**. Iso-comportement strict : toute sortie
observable préservée ; un test golden master modifié est justifié en commit, jamais ré-enregistré
à l'aveugle.

### Étape A — `buildAttackEntries` / `buildMeleeEntries` (`buildDeclarePayload.js`)

Extraire des 4 wrappers la construction des entrées `attack[]` / `melee[]` :
- branche **AOE vs normale** (une seule fois) ;
- neutralisation dual-wield / Tir visé en mode zone (une seule fois) ;
- slicing `effectiveAssaultCount` / `effectiveMeleeCount` ;
- résolution offhand / `isDualWield`.

Paramètre documenté : `ctx.emptyBonus` (`null` PJ / `0` PNJ) pour `fireModeBonusComp` /
`fireModeBonusDmg` / `bulletCount` quand `currentVariant == null`.

Les 4 wrappers (`buildHumanDeclarePayload`, `buildGmDeclarePayload`, `buildDroneMapActions`,
`buildExoMapActions`) restent des **enveloppes minces** (forme du payload complet vs fragment
`mapActions`, noms de champs). `buildDroneMapActions` / `buildExoMapActions` ne produisent pas
d'entrée AOE aujourd'hui — ils ne consomment `buildAttackEntries` que si/quand Segment 2 le leur
donne ; pour l'instant inchangés fonctionnellement (peuvent déjà appeler l'helper pour l'entrée
simple si ça ne change aucune sortie — sinon laissés tels quels).

- **Fichier** : `client/src/lib/buildDeclarePayload.js` (+ `buildDeclarePayload.test.mjs` étendu).
- **Filet** : golden master (68 tests) — **doit rester vert sans modification** (iso-comportement).
  Nouveaux tests : `buildAttackEntries` / `buildMeleeEntries` isolés (AOE, normal, dual-wield,
  visé neutralisé, `emptyBonus` null vs 0).
- **Risque** : FAIBLE (pur, entièrement golden-mastered, zéro câblage fenêtre).
- **1 commit.**

### Étape B — `assaultCheckInputs` / `meleeCheckInputs` (`assaultDeclaration.js` / `meleeDeclaration.js`)

Fonction pure `assaultCheckInputs(declState, ctx) → { started, hasWeapon, targetsFilled,
targetsNeeded, hasVariant, aimActive, aimReasons }` — l'objet passé tel quel à `assaultCheck`.
Absorbe la neutralisation AOE (`isAoeMode ? 1 : …`) **une seule fois**. Idem
`meleeCheckInputs(declState, ctx)` (Charge / défensif / multi).

`ctx` = contexte fenêtre explicite, **JSDoc `@typedef` obligatoire** (surface d'erreur silencieuse
signalée dans `PLAN_RW_DECLARE_DESIGN` §5.8) : `{ profile: 'human'|'gm', hasWeapon, currentVariant,
aimTranches, aimReasons, effectiveCount, … }`. La divergence PJ/MJ sur `started` (PJ =
`attackSelected` ; MJ = arme choisie ∨ cible posée ∨ ciblage carte) reste un fait fenêtre passé
dans `ctx`, pas dans le sélecteur.

- **Fichiers** : `assaultDeclaration.js` + `meleeDeclaration.js` (+ leurs `.test.mjs`).
- **Découpe** : B1 `assaultCheckInputs` + test (0 câblage) → B2 câblage PJ
  (`CombatActionWindow.jsx`) → B3 câblage MJ (`CombatGmDeclareWindow.jsx`) → B4 `meleeCheckInputs`
  + test → B5 câblage mêlée PJ + MJ. **Un fichier = un commit**, ancien inline retiré dans le même.
- **Filet** : `.test.mjs` des sélecteurs + golden master (inchangé) + `vite build` + eslint
  iso-baseline + **passe navigateur ciblée** (PJ Tir simple / Multi CC / RC-RL / visé / dual-wield /
  AOE ; MJ idem ; chaque `reason` de blocage).
- **Risque** : MOYEN (état interne de 2 gros composants) — le mieux fileté (golden master +
  reducers `.test.mjs`).

### Étape C — Reset consolidé (M0.4-f)

Les effets de reset `[tokenId, has_announced]` des 2 fenêtres : ~15 setters → `assaultDecl.clear()`
+ `meleeDecl.clear()` + le résiduel non couvert par les reducers (identifié au grep).

- **Fichiers** : `CombatActionWindow.jsx` + `CombatGmDeclareWindow.jsx`.
- **Filet** : eslint (le MJ a déjà 1 erreur pré-existante `react-hooks/set-state-in-effect` sur cet
  effet — ne pas régresser au-delà) + passe navigateur (nouveau tour, changement de slot actif).
- **Risque** : FAIBLE-MOYEN.
- **1 commit.**

### Étape D — Doc + non-régression

`JOURNAL8.md` (décisions + clôture), `docs/SYSTEME/COMBAT.md` § Fenêtres de déclaration
(dérivation unique = invariant durable), `docs/SYSTEME/REACT.md` si un principe s'y ajoute,
`docs/ROADMAP.md` (retrait de la ligne si présente). Session de non-régression complète (Saar).

---

## 4. Hors périmètre

- **exo / drone** : `useExoDeclare` / `useDroneDeclare` ne sont pas touchés — la réconciliation
  `assaultCheck` exo/drone + le `blockReason` drone rejoignent `PLAN_ARMES_SPECIALES` **Segment 2**
  (déclaration exo déjà ouverte là-bas). `[VÉRIFIÉ]` collision.
- Fusion des reducers exo/drone dans `assaultDeclarationReducer` (state plat conservé — les faire
  passer par le reducer complet ajoute ~8 champs morts).
- Couche `assaultPayloadSel` / `meleePayloadSel` séparée (indirection au bénéfice marginal —
  Charge 4).
- `CombatDeclareFrame` (châssis commun — `REACT.md` P58 le juge secondaire), harness E2E.
- Acquisition des données (fetch par token PJ vs batch PNJ) — reste par fenêtre.
- Branches `mechanic === …` du tronc de résolution (`PLAN_ARMES_SPECIALES` Segment 1.5).
- Toute évolution de règle de validité ou de forme de payload (iso-comportement strict).

---

## 5. Ordre recommandé

**A** (opportun pour `PLAN_ARMES_SPECIALES` grenades) → **B1→B5** (PO-M5-a) → **C** (M0.4-f) →
**D**. Total ~7 commits `dev/Saar`. Une passe navigateur consolidée après B5 et après C.
Ce plan ne dépend pas de `PLAN_ARMES_SPECIALES` et réciproquement (sauf que faire **A** avant le
Segment 3 grenades évite un double site `intendedOrigin`).

---

## 6. Journal d'exécution

### Étape A — `buildAttackEntries` / `buildMeleeEntries` — codé 2026-09-04 (non commité)

`client/src/lib/buildDeclarePayload.js` : 2 helpers exportés portent le cœur commun des entrées
`attack[]` (branche zone d'effet + branche normale + neutralisation dual-wield/Tir visé en mode
zone) et `melee[]` (mapping non-Charge). Les 4 divergences PJ/PNJ passent par le contexte
(`weaponInvId`, `offhandWeaponId`, `targets`, `emptyBonus` = `null`/`0`). `buildHumanDeclarePayload`
/ `buildGmDeclarePayload` les consomment ; l'entrée Charge reste inline (formes divergentes 5/3 clés,
testées). `buildDroneMapActions` / `buildExoMapActions` inchangés (entrées de forme différente,
hors périmètre — cf. `PLAN_ARMES_SPECIALES` Segment 2).

- **Testé** : `node --check` OK ; `node --test buildDeclarePayload.test.mjs` **68/68** — golden master
  (55 tests bout-en-bout PJ/MJ/drone/exo) **vert sans modification** (iso-comportement confirmé) +
  13 tests neufs des helpers isolés (zone d'effet, `emptyBonus` null/0, troncature, dual-wield
  neutralisé, direction 0° falsy). `eslint` propre.
- **Non testé** : rien à tester en navigateur (zéro câblage fenêtre — `handleDeclare` PJ/MJ
  inchangés, appellent les mêmes wrappers).
- **Données** : aucune.

### Étape B1 — `assaultCheckInputs` — codé 2026-09-04 (non commité)

`client/src/lib/assaultDeclaration.js` : `assaultCheckInputs(state, ctx)` — autorité unique de la
neutralisation zone d'effet côté validité (`isAoeMode ? 1 : targets.slice(0, n).filter(Boolean)`,
avant recopié entre les 2 fenêtres). `ctx` porte les divergences PJ/MJ (`started`, `hasWeapon`,
`effectiveCount`). Aucun câblage — l'export n'est pas encore consommé.

- **Testé** : `node --check` OK ; `node --test` assault reducer + declareChecks + golden master
  **109/109** ; `eslint` propre. 7 tests neufs (série tronquée, zone d'effet 1/1, direction 0°
  falsy, `aimReasons` absent).
- **Non testé** : navigateur (câblage en B2/B3).
