# PLAN_RW_DECLARE_DERIVATION.md

> **Responsabilité** : plan temporaire (Règle 10) — finir la dérivation unique de la déclaration
> de combat côté client, reste différé de `PLAN_RW_DECLARE_DESIGN.md` (archivé `docs/Old/`,
> chantier clos 2026-08-30 : `JOURNAL8.md` §« RW déclaration : M0.4 + module 4 »).
> À l'achèvement : décisions durables → `docs/SYSTEME/COMBAT.md` + `docs/SYSTEME/REACT.md`, ce PLAN supprimé.
>
> Statut : **Étapes A + B codées et commitées (2026-09-04, 5 commits `dev/Saar`, non poussés).
> Étape C vérifiée sans objet (déjà livrée par M0.4). Reste : passe navigateur consolidée complète
> (checklist §3 Étape B) avant clôture définitive et archivage `docs/Old/`.**

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

### Étape C — Reset consolidé (M0.4-f) — **SANS OBJET (vérifié 2026-09-04, déjà livré par M0.4)**

La prémisse « ~15 setters → 3 appels » était **héritée non revérifiée** de
`PLAN_RW_DECLARE_DESIGN` §5.8 (état d'avant M0.4). Lecture du code au 2026-09-04 :

- `CombatActionWindow.jsx` : **un seul** effet de reset consolidé sur `[token_id, has_announced]`
  (commentaire « Un seul effet consolidé : avant le 2026-08-28 il y en avait deux divergents »),
  qui appelle déjà `assaultDecl.clear()` + `meleeDecl.clear()`. Résiduel = `dispatch({RESET})` (le
  reducer `decl`), `setMapSelected(new Set())`, et 5 flags UI locaux (`moveSelection`, `inMoveMode`,
  `inTargetMode`, `inMeleeTargetMode`, `selectedAmmoId`) + `combatTargetMode/AoeTargetMode.onCancel()`.
- `CombatGmDeclareWindow.jsx` : idem — effet consolidé, `clear()` ×2, résiduel = `dispatch({RESET})`,
  `setMapAction`, `setMeleePendingMode`, `setPendingMove`, `setIsSelectingOnMap`, 2 `onCancel()`.

Le résiduel n'est **pas** du sous-état Tir/CaC (déjà `clear()`) : c'est le reducer `decl`, la
sélection d'action (`mapSelected`/`mapAction`), et des flags de ciblage carte propres à la fenêtre.
Le collapser exigerait **Module 6** (`useHumanDeclare`, extraction des ~26 `useState`) — explicitement
différé (`JOURNAL8.md` : « Module 6 — différé »). Hors périmètre. **Aucun code.**

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

**A** (opportun pour `PLAN_ARMES_SPECIALES` grenades) → **B1→B5** (PO-M5-a) → ~~**C**~~ (sans objet) →
**D**. ~5 commits `dev/Saar` + doc. Une passe navigateur consolidée après B5.
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

### Étape B2 + B3 — câblage PJ + MJ — codé 2026-09-04 (non commité)

`CombatActionWindow.jsx` (PJ) et `CombatGmDeclareWindow.jsx` (MJ) : l'appel inline
`assaultCheck({ …, targetsFilled: isAoeMode ? 1 : … })` devient
`assaultCheck(assaultCheckInputs(assaultDecl.state, { started, hasWeapon, effectiveCount, … }))`.
La double copie de la neutralisation zone d'effet disparaît. `assaultDecl.isAoeMode` reste utilisé
en rendu (prop `isAoeMode` de `AssaultRangedPanel`).

- **Testé** : `node --test` 121/121 (4 modules purs) ; `vite build` **propre** ; `eslint`
  **iso-baseline** (PJ : 0 erreur ; MJ : 1 erreur pré-existante `react-hooks/set-state-in-effect`
  l.170, inchangée).
- **Non testé** : ⚠️ **navigateur** — le câblage `fenêtre → ctx` n'est pas couvert par les tests
  purs. Passe consolidée prévue après B5 (plan §3 Étape B). Iso-comportement vérifié par lecture
  (chaque champ `ctx` = l'expression exacte de l'ancien arg ; `assaultPendingTokenIds` /
  `assaultTargets` = `assaultDecl.state.targets`).

### Étape B4 — `meleeCheckInputs` — codé 2026-09-04 (non commité)

`client/src/lib/meleeDeclaration.js` : `meleeCheckInputs(state, ctx)` — autorité unique de la
dérivation Charge (`isCharge` / `chargeHasMove` / `chargeHasTarget` depuis `state.charge`, avant
recopié entre les 2 fenêtres). `ctx` = `started` (PJ ≠ MJ), `defensif`, `effectiveMeleeCount`.
`targetsFilled` = `state.targets.length` conservé tel quel (pas `.filter(Boolean)`) — iso, la chaîne
de ciblage remplit les slots dans l'ordre. Aucun câblage. `node --test` 17/17, `eslint` propre, +5 tests.

### Étape B5 — câblage mêlée PJ + MJ — codé 2026-09-04 (non commité)

`CombatActionWindow.jsx` + `CombatGmDeclareWindow.jsx` :
`meleeCheck({ …, isCharge: !!chargeSelection, … })` → `meleeCheck(meleeCheckInputs(meleeDecl.state,
{ started, defensif, effectiveMeleeCount }))`.

- **Testé** : `node --test client/src/lib/*.test.mjs` **230/230** ; `vite build` **propre** ;
  `eslint` **iso-baseline** (PJ 0 erreur / 4 warnings ; MJ 1 erreur pré-existante
  `set-state-in-effect` l.168 / 1 warning — tous antérieurs).
- **Non testé** : ⚠️ navigateur — **passe consolidée Étape B à faire** (Saar) : PJ CaC simple /
  Multi / Défensif / Retraite / Charge (move seul, puis complète) ; MJ idem ; Tir simple / Multi
  CC / RC-RL / visé / dual-wield / AOE (PJ + MJ) ; chaque `reason` de blocage (« Choisir une
  cible », « Configurer le mode de tir », « Sélectionner une arme de tir », « Définir le
  déplacement de la Charge », « Tir visé impossible : … »).
- **Tests préliminaires navigateur OK** (Saar, 2026-09-04) — passe complète encore à faire.

### Étape C — vérifiée sans objet 2026-09-04

Cf. §3 Étape C : les 2 effets de reset sont déjà consolidés et appellent déjà `clear()` (livré
par M0.4). Le résiduel relève de Module 6 (différé). Aucun code, `docs/EN_COURS.md` /
`PLAN_RW_DECLARE_DESIGN` M0.4-f : plus rien à faire ici.

### Étape D — doc + clôture — 2026-09-04

`JOURNAL8.md` (session + clôture chantier), `docs/SYSTEME/COMBAT.md` (dérivation unique = invariant
durable des fenêtres de déclaration). Passe de non-régression complète : Saar.

### Investigation hors chantier — double panneau CaC+Tir MJ — clos 2026-09-04, sans lien avec ce chantier

Signalé par Saar en cours de validation (capture : `MeleeCombatPanel` ET `AssaultRangedPanel`
affichés ensemble pour un PNJ, résidu de cible CaC sur une arme Tir). Diff `aab9f2b..HEAD` vérifié :
la zone concernée (`CombatGmDeclareWindow.jsx:902-961`, les 2 blocs `{cond && <Panel/>}`
indépendants, pas mutuellement exclusifs par construction) **n'appartient à aucun commit de ce
chantier**. Hypothèse retenue et **confirmée par Saar** : artefact Vite Fast Refresh (état React
conservé entre deux sauvegardes de fichier pendant la session dev), pas un bug applicatif.

**Point de durcissement latent noté, pas ticketé** (pas de problème confirmé en prod, juste une
fragilité structurelle observée en passant) : les 2 panneaux dépendent de la discipline `clear()`
plutôt que d'une exclusion structurelle (`if/else`) — une vraie dérive de state produirait le même
symptôme hors HMR. À proposer à Saar comme ticket `bug_tickets` si le sujet revient.
