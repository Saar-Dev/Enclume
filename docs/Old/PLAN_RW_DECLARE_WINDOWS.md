# PLAN_RW_DECLARE_WINDOWS — Rework des fenêtres de déclaration de combat

> **CLOS 2026-08-28 — archivé.** Livré : **1 + §5bis + 2 + 3 + 7**, tous validés navigateur.
> Modules **5 annulé** (B5 — familles CSS `combat-float-*` / `combat-win-*` réellement différentes,
> attend une passe design), **6 différé** (pas d'infra de test composant — `useHumanDeclare` sans
> tests de caractérisation = bug de combat garanti), **4 non fait** (`usePersistedToggle` :
> 2 consommateurs, gain de robustesse théorique pour ce déploiement — n'aggrade pas assez).
>
> **Définitif dans** : `docs/SYSTEME/REACT.md` **P58** (briques `CombatDeclare*`) +
> `docs/SYSTEME/COMBAT_FLUX.md` § « Calcul delta initiative » (`shared/combatIniCost.js`) +
> `docs/SYSTEME/COMBAT.md` § « Fenêtres de déclaration ». Index : `CONVENTIONS.md` §19 P58.
>
> Ce document reste comme **journal de conception** du chantier (l'alternance plan → analyse à
> charge → code → validation, module par module) ; il ne fait plus autorité.
>
> ---
>
> **Version** : v2 — 2026-08-27, révisée 2026-08-28. Conception refaite depuis zéro après abandon de
> la v1 (lecture incomplète). Suit `docs/METHODO_PLAN.md`.
>
> **Responsabilité unique** (Règle 1) : stratégie de refactoring **client** des fenêtres de
> déclaration d'action en phase ANNONCE. Le périmètre « robuste » du module 2 a **dérogé** à ce point
> (extraction `shared/combatIniCost.js` + swap serveur `socketCombatAnnouncement.js`, iso-comportement,
> zéro changement de payload/règle — décision D9).

---

## 1. Objectif

Trois fenêtres de déclaration — `CombatActionWindow` (joueur + drone joueur), `CombatGmDeclareWindow`
(MJ : PNJ + drone MJ), `CombatExoActionWindow` (exo, joueur + MJ) — **réimplémentent chacune** le même
châssis : chrome de fenêtre flottante, header draggable, footer, roster, widget Initiative, écoute
`COMBAT_DECLARE_ERROR`, masquage pendant la sélection sur carte. Chaque divergence de ce châssis a
produit un bug réel (override `flex-direction` exo, verrou d'envoi bloquant sur refus exo, Initiative
absente côté exo, roster absent côté exo, régression `combatTargetMode`).

**But** : sortir les morceaux dupliqués en **briques partagées** (comme l'a fait REWORK-05 pour les
panneaux d'assaut/CaC), **une brique à la fois**, chacune finie et validée en navigateur avant la
suivante. À la fin : les 3 fenêtres consomment les mêmes briques, l'exo cesse d'être en retard, et une
future variante (tourelle fixe, combattant « possédé »…) ou section (Intégrité/Avaries exo) ne
réclame plus de toucher un monolithe.

**Méthode de travail actée avec Saar (2026-08-27)** : un module à la fois, qualité structurelle avant
vitesse, on va jusqu'aux modules risqués s'ils améliorent l'architecture — on prend le temps. Pas de
big-bang, pas de plan de 7 lots imbriqués figé d'avance : ce document est une **liste de modules**,
chacun conçu en détail au moment où on l'attaque.

---

## 2. État des lieux `[VÉRIFIÉ]` — lecture intégrale 2026-08-27

Fichiers lus en entier cette session : `CombatActionWindow.jsx` (1755 l.), `CombatGmDeclareWindow.jsx`
(1286 l.), `CombatExoActionWindow.jsx` (435 l.), `DroneDeclareSection.jsx`, `useDroneDeclare.js`,
`useExoDeclare.js`, `useCombatUIState.js`, `useDraggable.js`, `useAutoMoveMode.js`,
`useCombatClickAttack.js`, `combatSections.js`, `declarationReducer.js`, `CombatOverlay.jsx` (dispatch
de montage). Docs : `COMBAT.md` (§ flux client), `COMBAT_FLUX.md`, `SERVICES_COMBAT.md`, `REACT.md`,
`ARCHI_REWORK_DONE.md` REWORK-05, `AUDIT.md` INFRA-4, `PLAN_EXOARMURE.md` §8.

### 2.1 Les couches réelles

| Couche | Contenu | État |
|---|---|---|
| **1. Modèle pur** | `combatSections.js` (`STATE_DEFS`, `MAP_ACTIONS`, `QUICK_ACTIONS`, `MOVE_ZONE_DEFS`, `FIRE_MODE_VARIANTS`, `calcIniBreakdown`/`calcIniDelta`, `computeFireVariant`, `stateTransitionCost`), `declarationReducer.js`, `shared/fireModes.js`, `shared/combatExclusiveActions.js`, `shared/combatRange.js`, `shared/weaponSlots.js`, `shared/ammoRules.js` | ✅ partagé, propre |
| **2. Hooks carte ambiants** | `useAutoMoveMode` (survol déplacement), `useCombatClickAttack` (clic direct sur cible), `useDraggable` (position fenêtre) | ✅ partagés, type-agnostiques, consommés par les 3 |
| **3. Hooks de déclaration par variante** | `useDroneDeclare`, `useExoDeclare` (état local `useState`, composent la couche 2) | ✅ drone/exo ; ❌ **rien pour l'humanoïde** — état inline dans `CombatActionWindow` : `useReducer` + **26 `useState`** + 9 `useEffect` |
| **4. Panneaux présentationnels** | `AssaultRangedPanel`, `MeleeCombatPanel`, `DroneWeaponPanel`, `DroneDeclareSection`, `CombatDeclareLog` (REWORK-05) | 🟡 extraits ; **`StateSelector` piégé dans `CombatActionWindow.jsx`**, importé de là par le MJ (`import { StateSelector } from './CombatActionWindow.jsx'`) ; `InlineChip` local au MJ |
| **5. Orchestrateurs (3, chacun réimplémente la coquille)** | `CombatActionWindow` (multi-phases : ANNONCE + RÉSOLUTION + surprise + attente), `CombatGmDeclareWindow` (ANNONCE seule, **navigation séquentielle multi-PNJ**, preview `pjPreview`), `CombatExoActionWindow` (ANNONCE seule) | ❌ duplication du châssis |
| **6. Dispatch de montage** (`CombatOverlay`) | 4 branches ANNONCE mutuellement exclusives + branches RÉSOLUTION | 🟡 gardes interdépendantes maintenues à la main |

### 2.2 Le châssis dupliqué dans la couche 5

| Morceau | Joueur | MJ | Exo |
|---|---|---|---|
| Classes CSS chrome | `combat-float-win/-header/-footer` + `combat-win-body` | **`combat-win/-header/-section/-footer`** + `bottomHandle` | `combat-float-*` |
| `useDraggable` | clé `combat-action-pos`, 720 px | clé `combat-gm-declare-pos`, 440 px | clé `combat-exo-action-pos`, 340 px |
| Écoute `COMBAT_DECLARE_ERROR` + bannière 4 s | oui | oui | oui (+ reset `isDeclaring`, corrigé 2026-08-27) |
| Roster repliable + INI/token | oui (`pj-roster-open`, mes tokens, si > 1) | oui (`gm-roster-open`, tous PNJ gérés, + badge arme, + `→ initiative+delta` sur l'actif) | **absent** |
| Widget `INI : ±delta` + popover `ini-popover` | footer, si `delta ≠ 0` | footer, si `delta ≠ 0 && isActivePnj` | **absent** |
| Masquage pendant sélection carte (`opacity`/`pointerEvents`) | `inMoveMode \|\| isTargeting \|\| droneDeclare.isSelectingOnMap \|\| hasPendingOwnMove` | `isSelectingOnMap \|\| droneDeclare.isSelectingOnMap \|\| hasPendingPlainMove \|\| isTargetingViaClick` | `isSelectingOnMap` |
| Bouton DÉCLARER | `btn-tac` (i18n) | `btn-tac-confirm` (**texte FR en dur**) | `btn-tac` (i18n) |

### 2.3 Divergences légitimes (pilotées par le modèle d'entité, à préserver)

- **Allures** : joueur = calcul local depuis la fiche (`calcAllures`) ; MJ = `DEFAULT_PNJ_ALLURES` ;
  exo = fetch serveur `/exo/movement`. Trois sources, justifiées.
- **Panneau droit 720 px** (détail assaut/CaC : `AssaultRangedPanel`/`MeleeCombatPanel`) : joueur +
  MJ uniquement. L'exo n'en a jamais besoin (pas de dual-wield, pas de Tir visé, pas de Tir Multi).
- **Multi-phases** : seul `CombatActionWindow` rend aussi la phase RÉSOLUTION (bouton « Agir »,
  écrans d'attente) et la surprise. Le MJ et l'exo sont ANNONCE seule.
- **Navigation de slots** : le MJ cycle séquentiellement sur ses PNJ (`allGmManaged`,
  `unannouncedCnt`) ; joueur/exo ont un seul slot actif à la fois.
- `combat-float-*` vs `combat-win-*` : divergence CSS **déjà existante** entre joueur et MJ.

### 2.4 Contraintes

- **Aucune infra de test composant** `[VÉRIFIÉ]` : pas de vitest ni `@testing-library`. Seuls
  `client/src/lib/*.test.mjs` (modules purs, `node --test`) existent. → toute brique
  **présentationnelle** partagée est validée **en navigateur** ; la *logique* extraite va dans des
  fonctions pures node-testables.
- **REWORK-05 (validé, Session 99) a explicitement rejeté la fusion GM + Joueur** — motif : « nav de
  slots, multi-phases, preview temps réel ». → **on garde 3 orchestrateurs**, on n'extrait que des
  briques partagées.
- `CombatActionWindow` / `CombatGmDeclareWindow` = fichiers client les plus joués et les moins
  couverts (`AUDIT.md` INFRA-4) — validation navigateur **par module**, jamais en bloc.

---

## 3. Analyse critique `[VÉRIFIÉ]` / `[INFÉRÉ]`

1. `[VÉRIFIÉ]` La v1 de ce plan proposait une « coquille unique pour les 3 » + suppression de
   `CombatGmDeclareWindow` — **contredit REWORK-05**. La bonne cible est « finir REWORK-05 » : plus de
   briques partagées, orchestrateurs séparés.
2. `[VÉRIFIÉ]` Une brique de chrome partagée doit être **neutre vis-à-vis de la phase** (le joueur
   rend aussi la RÉSOLUTION dans le même composant) et gérer **1 ou 2 colonnes** (l'exo n'a pas de
   panneau droit).
3. `[VÉRIFIÉ]` Le widget Initiative existe déjà côté joueur et MJ (calcul partagé `calcIniDelta`),
   absent côté exo. L'item 2 de la dette exo (`ROADMAP.md` §1 : « initiative projetée près de
   DÉCLARER, généralisée ») = **un des modules ci-dessous**, pas un chantier à part.
4. `[INFÉRÉ]` L'extraction de `useHumanDeclare` (26 `useState` du cœur de combat) est la pièce la plus
   risquée et n'est exigée par aucune fonctionnalité. À traiter en **dernier**, décision confirmée au
   moment venu (Saar 2026-08-27 : « seulement si on juge que ça en vaut la peine à ce moment-là »).
5. `[VÉRIFIÉ]` Le dispatch de montage (`CombatOverlay`, 4 branches ANNONCE) reste tel quel avec 3
   orchestrateurs — un simple nettoyage de lisibilité possible, pas un module structurel.

---

## 4. Décisions actées (Saar, 2026-08-27 / 28)

| # | Décision |
|---|---|
| D1 | **Un module à la fois**, fini + validé navigateur avant le suivant. Ce document = liste de modules. |
| D2 | Périmètre **ambitieux assumé** : on ira jusqu'au chrome partagé (module 5) et éventuellement `useHumanDeclare` (module 6) — le risque est acceptable si l'architecture s'améliore. |
| D3 | On garde **3 orchestrateurs séparés** (REWORK-05). On extrait des **briques**, jamais une méga-coquille conditionnelle. |
| D4 | **Emplacement à plat** dans `client/src/components/` (comme les panneaux REWORK-05 : `AssaultRangedPanel`, `DroneWeaponPanel`, `CombatDeclareLog` — tous à plat) — **pas** de nouveau dossier `combat/declare/`. Hooks dans `client/src/lib/` (comme `useDroneDeclare`). L'organisation en sous-dossiers reste une décision séparée, plus tard, si le nombre de briques la justifie. |
| D5 | `useHumanDeclare` = module 6, **différé**, re-décidé plus tard. |
| D6 `[INFÉRÉ]` | Item 2 (module 2) : format `INI : {actuel} → {projeté}` dans le footer des 3 fenêtres. À confirmer au démarrage du module 2. |
| D7 | **Nommage** (arrêté au module 1) : préfixe de famille `CombatDeclare*` ; **fichier = export par défaut = nom d'usage** (comme les panneaux frères `AssaultRangedPanel`/`DroneWeaponPanel`/`MeleeCombatPanel`/`DroneDeclareSection` : `export default function <Nom>`). Le découpage fichier≠export de `CombatDeclareLog.jsx` (→ `DeclareLogContent`) est une verrue pré-existante, **non propagée**. `CombatDeclareStateSelector`, `CombatDeclareIniWidget`, `CombatDeclareErrorBanner` (+ hook `useCombatDeclareError`), `CombatDeclareRoster`, `CombatDeclareFrame`. Jamais un préfixe par variante (`Exo…`/`Drone…`) pour une brique partagée. |
| D8 | **Aucune couche CSS ajoutée, style réutilisé à l'identique.** Le style des fenêtres est déjà défini (fenêtres joueur/MJ + `index.css` + jetons `--combat-*`). L'extraction transporte les objets de style **verbatim** (y compris valeurs visuelles inline). Pas de refactor `style={}`→classe, pas de nouvelle classe. L'harmonisation visuelle éventuelle = passe de design dédiée, séparée, plus tard. (Saar 2026-08-28.) **Assouplie au module 2** : une règle CSS scopée est admise pour corriger un **défaut** (rognage de tooltip), jamais pour du polish. |
| D9 | **Module 2 = périmètre « robuste »** : au-delà du widget, on extrait l'autorité unique du coût d'Initiative (`shared/combatIniCost.js`), on déduplique client/serveur — dérogation assumée au « on ne touche pas au serveur » (§8). Iso-comportement, zéro changement de payload/règle. (Saar 2026-08-28.) |
| D10 | **`willBeLost = projected <= 0`** (INI = 0 ⇒ tour perdu, confirmé Saar). La pastille projetée est **rouge** dans ce cas — indicateur visuel, **jamais un blocage** du bouton. |
| D11 | Pastille = **juste le chiffre projeté** ; détail au **survol** (`.has-tooltip`), pas de clic-popover. Toujours visible à côté de DÉCLARER. |
| D12 | MJ : `→ {initiative}` du roster **retiré** (redondant avec le pied) ; INI **toujours** affichée au pied (avant : cachée si delta 0). |

---

## 5. Liste des modules

> **Ordre d'exécution + scope acté (Saar 2026-08-28, révisé après analyse à charge post-module 2)** :
> 1 ✅ → **fix Tir visé** ✅ (§5bis) → **2 ✅** (autorité partagée du coût INI + pastille projetée,
> périmètre élargi « robuste » : a aussi extrait `shared/combatIniCost.js`, dédupliqué
> `combatSections`/`socketCombatAnnouncement`, et branché la pastille dans les 3 pieds de fenêtre) →
> **3 ✅** (bannière de refus de déclaration centralisée P57 + finitions module 2) → **POINT FORMEL**
> → **7 ✅** (`InlineChip` → `CombatDeclareStateChip` + API `CombatDeclareState*` unifiée) → **CLOS**.
>
> **Décisions de scope (Saar 2026-08-28)** — critère unique : est-ce que ça aggrade le projet ?
> - **Module 5** (`CombatDeclareFrame`) : **annulé** — les deux familles CSS (`combat-float-*` /
>   `combat-win-*`) diffèrent réellement (B5) ; attend une passe design qui les unifie.
> - **Module 6** (`useHumanDeclare`) : **différé** — rouvert seulement quand une infra de test
>   composant sur les fenêtres existe ; sans elle, l'extraction = bug de combat subtil garanti.
> - **Module 7** : **fait** — aggrade (famille cohérente, `nextKey` sous test, brique prête pour les
>   sélecteurs d'état exo à venir ; faire l'extraction maintenant, isolée, plutôt que plus tard dans
>   la feature exo).
> - **Module 4** : **non fait**. Après recherche : le pattern « toggle persisté » n'est recopié qu'à
>   **2 endroits** (`pj-roster-open` / `gm-roster-open`), pas ~6 — les autres usages `localStorage`
>   (accordéon `CharacterSheet` = map JSON, `changelog_last_seen` = marqueur string, `dice-presets` =
>   tableau) sont d'autres formes. Un `usePersistedToggle` à 2 consommateurs + un gain de robustesse
>   (garde `try/catch`) théorique pour ce déploiement (VTT de table, personne ne joue en navigation
>   privée) — n'aggrade sur aucun des axes qui justifiaient le 7 (pas de famille, pas de test possible,
>   pas de feature planifiée qui en a besoin). `<CombatDeclareRoster>` unique = piège B4 (rosters
>   MJ/joueur réellement différents, l'exo ne contrôle qu'un token).
>
> Raison du changement d'ordre initial : le cadrage du module 6 (voir sa section) a
> montré que (a) le bug Tir visé se corrige sans extraire, (b) INFRA-4 déconseille le découpage
> proactif, (c) « rend 2-4 plus propres » ne tient pas, (d) module 6 sans tests de caractérisation =
> bug de combat subtil garanti. La numérotation des sections reste 1-7 (historique).
> Chaque module : conçu en détail à son démarrage **+ analyse à charge du cadrage avant tout code**,
> un commit isolé sur `dev/Saar`, validation navigateur Saar avant le suivant, ancien code retiré
> dans le même commit une fois la brique branchée.

### Module 1 — `StateSelector` → `CombatDeclareStateSelector.jsx` — **FAIT (2026-08-28)**

**Problème** : `StateSelector` (segmented control « Debout/Accroupi/Couché », « CC/RC/RL »… avec coût
de transition INI affiché) était défini et exporté depuis `CombatActionWindow.jsx` + son objet de
styles `ss`. `CombatGmDeclareWindow.jsx:26` allait le chercher **dans le fichier de l'écran joueur** —
couplage à l'envers.

**Fait** :
- `client/src/components/CombatDeclareStateSelector.jsx` — nouveau. `export default function
  CombatDeclareStateSelector` (fichier = export = nom d'usage, comme les panneaux frères
  `AssaultRangedPanel`/`DroneWeaponPanel`/`MeleeCombatPanel`/`DroneDeclareSection` — **pas** le
  découpage `CombatDeclareLog.jsx`→`DeclareLogContent`, verrue pré-existante non propagée). Styles :
  objet renommé `ss` → `S` (convention `W`/`S` du reste du projet ; renommer une variable ≠ toucher
  au style, D8 OK) ; **valeurs CSS verbatim** (2 couleurs inline `#3aaa6a`/`#c86030` conservées —
  harmonisation = passe de design séparée, D8). En-tête court (quoi/comment, pas d'archéologie).
- `CombatActionWindow.jsx` — fonction + bloc styles retirés, `stateTransitionCost` retiré de l'import,
  `import CombatDeclareStateSelector from './CombatDeclareStateSelector.jsx'`, 4 sites JSX renommés.
- `CombatGmDeclareWindow.jsx` — import (l. 26) + 1 site JSX + 1 commentaire renommés.

**Vérifié `[VÉRIFIÉ]`** : seul `CombatGmDeclareWindow` importait `StateSelector` (le match dans
`CombatModifiersWindow.jsx:20` est un commentaire mort, laissé tel quel — hors périmètre) ; `ss`/
`stateTransitionCost` utilisés uniquement par le composant ; aucun import inverse.

**Testé** : `vite build` (clean, `rm -rf dist`) → exit 0, aucun « Could not resolve » ; `eslint`
3 fichiers → **9 problèmes identiques à l'état pré-module** (1 error + 8 warnings tous pré-existants
sur des `useEffect` non touchés), le nouveau fichier est **propre (0/0)** ; composant présent dans le
bundle.
**Non testé** : coup d'œil navigateur (segmented controls fenêtre joueur + fenêtre MJ) — à faire par
Saar. **⚠️ clos partiel.**

**Statut réel assumé** : échauffement + suppression d'un import croisé. Valeur utilisateur nulle,
gain architectural cosmétique (le châssis dupliqué 3× n'est pas touché). Fixe la convention de
nommage pour les modules suivants (D7).

---

### Module 2 — Autorité partagée du coût d'Initiative + pastille « Initiative projetée » — **FAIT (2026-08-28)**

> **CORRECTIF POST-CLÔTURE (2026-08-29, analyse à charge)** — deux points, aucun sur le runtime
> (le swap serveur a été revérifié ligne à ligne : **iso-comportement confirmé**) :
> 1. **Ce module n'a PAS « un commit isolé »** (contrairement à D1 / §5 et à la ligne « un commit
>    isolé sur `dev/Saar` » plus bas). Son cœur — `shared/combatIniCost.js` + `.test.mjs` +
>    `CombatDeclareIniWidget.jsx` + le swap `socketCombatAnnouncement.js` — a été committé dans
>    **`430fa0c`, intitulé « Drone : budget de déplacement »**, entremêlé sur instruction de Saar
>    (« commit l'ensemble tel quel ») avec un chantier drone parallèle. Le reste est réparti sur
>    `fc0c25e` (lot B — pastille) et `79475dd` (finitions). Le module 2 n'est ni auditable ni
>    revertable en isolation.
> 2. Le « test d'invariant `computeIniDelta === somme(iniDeltaBreakdown)` » (ci-dessous) est
>    **tautologique** — `computeIniDelta` EST défini comme cette somme. Remplacé par des cas de
>    valeur de référence. La vraie garantie de non-divergence vient du design à chemin unique
>    (le client ne recalcule jamais les valeurs), pas de ce test.

**Périmètre élargi (acté Saar 2026-08-28 : « robuste par principe »)** : le module ne se contente pas
d'ajouter un widget — il crée l'**autorité unique** du coût d'Initiative d'une déclaration, partagée
client (aperçu) et serveur (calcul réel appliqué à `combat_roster.initiative`). Les matrices de coût
de transition étaient dupliquées `combatSections.js` (`STATE_DEFS[].cost`) / `socketCombatAnnouncement.js`
(`STATE_COSTS`, commentées « miroir de STATE_DEFS ») — c'était la dernière maths de combat non
partagée du repo (`combatRange`/`combatMovement`/`ammoRules`/`combatExclusiveActions`/
`combatStatePositionCost` le sont déjà).

**Fait** :
- `shared/combatIniCost.js` (neuf, +`.test.mjs` 15 cas) : `STATE_TRANSITION_COST` (weapon/fire_mode/
  cover/vitesse ; position déléguée à `combatStatePositionCost.js`, aim à `combatExclusiveActions.js`)
  ; `iniDeltaBreakdown(params)` = **primitif** (détail poste par poste, postes nuls omis) ;
  `computeIniDelta(params)` = **somme du breakdown** ; `projectedInitiative(current, delta)` →
  `{ projected, willBeLost }` (`willBeLost = projected <= 0`). Test d'invariant : `computeIniDelta ===
  somme(iniDeltaBreakdown)` → widget et popover ne peuvent pas diverger.
- `socketCombatAnnouncement.js` : `STATE_COSTS` + boucle `iniDelta` (l.455-535) → un appel
  `computeIniDelta(...)`. Bloc d'éligibilité Tir visé remonté avant (sans effet de bord). **Iso-comportement**
  vérifié contre les gardes du handler (`state` toujours objet non-nul l.67, valeurs d'énum validées
  l.78-80).
- `combatSections.js` : `STATE_DEFS[].cost` → références `STATE_TRANSITION_COST` (plus aucune matrice
  recopiée) ; `calcIniDelta`/`calcIniBreakdown` délèguent à `iniDeltaBreakdown`/`computeIniDelta`, seul
  le mapping `kind → libellé i18n` reste client (`iniBreakdownLabel`). `cover_shot` (code mort) retiré.
  `calcIniDelta` perd le param `t` inutile.
- `CombatDeclareIniWidget.jsx` (neuf) : props `currentInitiative`, `delta`, `breakdown`. Pastille
  `.badge` (rouge `.badge-fail` si `willBeLost`), **tooltip CSS `.has-tooltip` au survol** (pas de
  clic-popover) listant les postes + le total. Brique présentationnelle pure, zéro règle métier.
- Les 3 fenêtres : pastille à gauche du bouton DÉCLARER (`flex:1` sur le bouton), **toujours visible**.
  `iniPopoverOpen` + `setIniPopoverOpen` supprimés ; styles morts retirés (`W.totalMod`,
  `S.iniRow/iniLabel/iniValue/rosterDelta`). MJ : `→ {initiative}` du roster retiré (redondant).
  Exo : `calcIniDelta({}, {}, { move }, null)` — extensible sans retoucher le widget quand les
  sélecteurs d'état exo arriveront (ROADMAP §4).
- `combat.json` : `iniWidget.aria/tooltipTotal/tooltipNoChange`.
- `index.css` : **1 règle scopée ajoutée** (dérogation D8 assumée — correctif d'un bug, pas un
  refactor design) : `.combat-ini-widget.has-tooltip::after { left: 0; transform: none }` — la pastille
  est au bord gauche du pied et `.combat-win`/`.combat-float-win` ont `overflow:hidden`, un tooltip
  centré était rogné.

**Décisions D9-D12 (Saar, 2026-08-28)** :
| # | Décision |
|---|---|
| D9 | Périmètre **robuste** : autorité de calcul partagée client+serveur, pas juste un widget. |
| D10 | `willBeLost` = `projected <= 0` (INI = 0 ⇒ tour perdu, confirmé Saar). Indicateur visuel (rouge), **jamais un blocage**. |
| D11 | Tooltip **au survol** (`.has-tooltip`), pas de clic-popover. Pastille = juste le chiffre projeté. |
| D12 | MJ : `→ {initiative}` du roster retiré ; INI **toujours** affichée au pied (avant : cachée si delta 0). |

**Résolutions des analyses critiques du cadrage** :
- **B1 périmé** : `COMBAT_FLUX.md` §6.7 disait que `endTurn` ne remet pas `initiative = base_ini` —
  **faux**, le code le fait (`socketCombatHelpers.js:1285`, correctif INI4). Doc corrigée en parallèle
  (commit `08d8bd5`). Le projeté sur un tour frais est donc cohérent. Le widget reste un aperçu
  (le serveur recalcule le coût de déplacement depuis le chemin réel) — jamais un blocage (D10).
- **B2** : « se relever » exo compte volontairement la transition prone→* (-10) — vérifié non-bug,
  documenté en parallèle (commit `0925989`). Le widget exo ne couvre que le déplacement (le bouton
  « se relever » est séparé de DÉCLARER).
- **Correction de bug au passage** : l'aperçu INI d'une Charge/Retraite PNJ (MJ) neutralise maintenant
  le coût de déplacement (passait le `move` brut avant → aperçu trop pessimiste).

**Testé** : `node --test shared/*.test.mjs` (335/335) ; `vite build` clean ; `eslint` 3 fenêtres +
widget + `combatSections` → aucun problème neuf (widget + `combatSections` = 0/0), 8 pré-existants
inchangés. Run combat réel Saar (2 tours) : `iniDelta` serveur sains, pastille OK dans les 3 fenêtres,
rouge à ≤ 0, tooltip corrigé.
**Non testé automatiquement** : transport du payload `COMBAT_ACTION_DECLARE` (INFRA-4, pas d'infra) —
Tir visé ×N et Charge+déplacement à exercer en combat réel.

**Reste ouvert (hors périmètre, candidats nettoyage)** : `.ini-popover`/`.ini-bd-*` (index.css, ~35 l.)
et `gmDeclareWindow.iniTotalLabel` (combat.json) sont maintenant orphelins.

---

### Module 3 — bannière de refus de déclaration centralisée (P57) — **FAIT (code, 2026-08-28) — validation navigateur Saar en attente**

**Problème** : `COMBAT_DECLARE_ERROR` avait **4 listeners** — les 3 fenêtres (`socket.on` local +
`useEffect` + état `declareError` + `setTimeout` 4 s **sans cleanup**, l'exo ajoutait
`setIsDeclaring(false)`) **et** `useCombatSocket.js` `onDeclareError` (→ message de chat). Les 3
`socket.on` en composant feuille violent `REACT.md` P57.

**Solution — patron `sessionStore.criticalEffect` copié à la lettre** (recherche : c'est le patron
« toast/notification transitoire » standard des libs pros ; Enclume l'implémente déjà pour le popup
Réussite critique / Catastrophe — `sessionStore.criticalEffect` + `useSessionSocket` + `CriticalEffectOverlay.jsx`) :
- **`sessionStore.js`** : `+ declareError: { message, id } | null` + `setDeclareError(message)` +
  `clearDeclareError()`, ajouté à `resetSession`. Jumeau exact de `criticalEffect`.
- **`useCombatSocket.js`** : `onDeclareError` appelle aussi `setDeclareError(text)` (à côté du
  `addMessage` chat déjà là — même événement, deux sorties) ; `+ useEffect([declareError])` d'auto-clear
  4 s **avec cleanup** (centralisé dans le hook toujours-monté, pas dans la bannière montée par
  intermittence) ; `clearDeclareError()` dans `onCombatEnded` / `onPhaseChanged` / `onStateSync` /
  `onSlotAdvanced` (bannière fantôme).
- **`CombatDeclareErrorBanner.jsx`** (neuf, D7) : dumb, lit `sessionStore.declareError`, rend
  `<div key={id} className="combat-declare-error-banner" role="alert">`. Aucun `socket.on`, aucun
  timer. Rendu par les 3 fenêtres dans leur pied.
- **`index.css`** : `+ .combat-declare-error-banner` (valeurs joueur/exo — remplace 3 copies
  inline-style identiques, violation react.md « valeur visuelle en style={} »). 3ᵉ petite dérogation D8.
- **3 fenêtres** : retrait du `useState('declareError')` + du `useEffect` d'écoute local ; rendent
  `<CombatDeclareErrorBanner />`. Exo : garde un `useEffect([declareError])` local qui fait
  `setIsDeclaring(false)` (verrou d'envoi propre à l'exo, hors flux central — décision cadrage).

**Écarts vs cadrage (analyse à charge de mon plan)** :
- **B1** : `declareError` va dans **`sessionStore`** (pas `combatStore` : le combat store porte l'état
  serveur-autoritaire, pas une notification transitoire — `criticalEffect`/`pendingEntityId` y sont
  déjà). Pas de prop-drilling, pas de hook wrapper `useCombatDeclareError` (un `useSessionStore(s =>
  s.declareError)` d'1 ligne suffit — le wrapper était de la cérémonie).
- **B2** : timer 4 s dans `useCombatSocket` (hook toujours monté) et non dans la bannière (montée par
  intermittence → minuteur orphelin au démontage).
- Bannière MJ **converge** sur le style joueur/exo : perd le monospace, `font-size` 9→10,
  `border-radius` 2→3. Transitoire 4 s, cohérence des 3 fenêtres = but du chantier. À valider à l'œil.
- **`set-state-in-effect` +1** sur l'effet exo `if (declareError) setIsDeclaring(false)` — **identique
  en nature à l'erreur pré-existante l.101** (même fichier, `setIsDeclaring(false)` dans un effet). La
  variante dérivée (`sendLocked = isDeclaring && !declareError`) a un bug : re-verrouillage à
  l'expiration des 4 s quand `declareError` repasse à `null`. Effet conservé, cohérent avec le fichier.

**Finitions module 2** (commit A séparé `79475dd`, avant) : CSS mort `.ini-popover*`, clé
`iniTotalLabel`, garde `delta={isDrone ? 0 : iniDelta}` / `breakdown={isDrone ? []}`.

**Fichiers** : `sessionStore.js`, `useCombatSocket.js`, `CombatDeclareErrorBanner.jsx` (neuf),
`index.css`, les 3 fenêtres. **Zéro serveur, zéro maths de combat, zéro dépendance.**

**Testé** : `vite build` clean ; `node --test shared/*` 335/335 ; `eslint` = baseline +1
(`set-state-in-effect` exo, ci-dessus), nouveaux fichiers 0/0.
**Validation navigateur Saar (à faire)** : refus serveur (portée / PC23 / munitions) dans chaque
fenêtre → bannière 4 s, disparaît, fenêtre réutilisable ; exo : re-déclaration OK après refus
(non-régression 2026-08-27) ; le message de chat `declare_error` apparaît toujours (pas de double) ;
bannière disparaît immédiatement au changement de slot / phase / fin de combat.

**Adaptatif** : si un jour plusieurs notifications combat transitoires coexistent → promouvoir vers
le patron `EnvironmentalResultQueue.jsx` (déjà dans le code), ne pas réécrire. Aujourd'hui l'annonce
est séquentielle → un seul slot est correct.

---

### Module 4 — `CombatDeclareRoster.jsx` — **NON FAIT (Saar 2026-08-28)** — n'aggrade pas assez (cf. §5 : analyse à charge, 2 consommateurs, gain de robustesse théorique). Section conservée pour le raisonnement.

**Problème** : liste repliable des tokens contrôlés + Initiative/token — dupliquée joueur
(`CombatActionWindow.jsx:836-876`) / MJ (`CombatGmDeclareWindow.jsx:~940-997`), **absente de l'exo**.
Différences : joueur = mes tokens seulement ; MJ = tous les PNJ gérés + badge arme (RC/CC/···) +
`→ projeté` sur l'actif. Clé localStorage différente.

**Verdict au point formel** : le seul morceau **sainement** partageable était le toggle repliable
persisté (`usePersistedToggle`) — 2 consommateurs, code trivial, gain de robustesse (garde
`try/catch` sur `localStorage`) sans impact réel pour un VTT de table. Le rendu des rosters reste
légitimement différent (B4). Bilan : n'aggrade sur aucun axe qui justifiait le module 7. **Écarté.**

**Cible** : `client/src/components/CombatDeclareRoster.jsx` :
- Props : `entries` (pré-filtrées par l'appelant), `tokens`, `activeTokenId`, `storageKey`,
  `titleKey`, `activeDelta?` (flèche `→ projeté` sur la ligne active — réutilise `projectedInitiative`
  du module 2).
- Possède l'état repliable + persistance localStorage. Styles verbatim (D8).

**Fichiers touchés** : composant neuf ; les 3 fenêtres.

**Validation navigateur** : joueur avec ≥ 2 tokens, MJ avec plusieurs PNJ, exo — liste correcte,
repli persistant, marqueur actif, badge MJ, flèche projetée.

**Risque** : faible-moyen (visuel).

**Analyse critique — B4 (2026-08-28)** : une prop `renderBadge` (fonction de rendu « du contenu en
plus par ligne ») est une **odeur** — échappatoire qui accumule des appelants qui passent n'importe
quoi. Le seul vrai écart est le badge d'arme du MJ (RC/CC/···). Deux issues acceptables, à trancher
au cadrage : (a) le roster prend des **données structurées** — un champ `badge?: {text, className}`
optionnel dans chaque `entry`, calculé par l'appelant — pas une fonction ; (b) accepter que le roster
MJ est assez différent (badge + `→ projeté` sur l'actif + source « tous PNJ gérés ») pour **ne pas
être le même composant** — extraire seulement le roster joueur/exo et laisser le MJ. L'hypothèse
« un composant pour les 3 » doit être **mise à l'épreuve**, pas supposée.

**Hors périmètre, mais lié** : le badge de **type** d'entité (PJ / PNJ / DR / EXO) n'apparaît **pas**
dans le roster des fenêtres de déclaration — il est dans `CombatRosterWindow.jsx` (fenêtre de phase
ROSTER, montée par le MJ avant le combat), l. 224-226 : la logique `isDrone ? 'drone' : isPnj ?
'pnj' : 'pj'` fait tomber une exo-armure (`charType === 'exo'`) dans le défaut `'pj'` — badge « PJ »
au lieu de « EXO » (bug signalé par Saar 2026-08-28, même patron que `feedback_exo_pilot_routing_bug`).
Fix trivial et sûr mais **dans un autre fichier**, hors de ce chantier → traité en correctif isolé (voir
`ROADMAP.md` §5).

---

### Module 5 — Chrome de fenêtre partagé `CombatDeclareFrame.jsx` — **ANNULÉ (Saar 2026-08-28)** : les deux familles CSS diffèrent réellement (B5) ; à reprendre seulement après une passe design qui les unifie

**Problème** : chrome flottant (`useDraggable`, header, footer, `opacity`/`pointerEvents` de masquage)
réimplémenté 3×, **avec deux familles de classes CSS** (`combat-float-*` joueur/exo vs `combat-win-*`
MJ) — divergence déjà existante.

**Cible `[INFÉRÉ]` — à concevoir précisément au module 5** : `client/src/components/CombatDeclareFrame.jsx` :
- Props : `storageKey`, `defaultPos`, `width`, `title`, `hidden` (booléen calculé par la fenêtre à
  partir de ses drapeaux locaux — le concept « masquer pendant sélection carte » est unique, seuls
  les drapeaux d'entrée diffèrent), `footer` (slot), `children` (corps).
- Possède `useDraggable` + le chrome + `opacity`/`pointerEvents`.
- **D8** : réutilise **une** des deux familles de classes existantes telle quelle, sans en créer de
  nouvelle. Question ouverte PO4 : laquelle, et faut-il aligner le 3ᵉ dessus (léger décalage visuel à
  valider) ou garder une prop `variant` qui sélectionne la famille. **Aucune nouvelle CSS.**

**Risque** : moyen-élevé — le seul module qui touche la structure externe des 3 fenêtres. **Re-évaluer
après les modules 1-4** : si les 4 briques ont déjà retiré l'essentiel de la duplication, ce module
peut être réduit (prop `variant` qui choisit la famille de classes) ou reporté.

**Analyse critique — B5 (2026-08-28)** : **D8 (« aucune CSS neuve ») rend probablement ce module
infaisable proprement.** Les deux familles diffèrent réellement (le MJ a une poignée basse
`bottomHandle`, un habillage de section, un layout de header différents). Un `CombatDeclareFrame`
partagé « qui réutilise une famille telle quelle » force soit une **régression visuelle** sur l'autre
fenêtre, soit une prop `variant` qui **réintroduit exactement le branchement** qu'on veut supprimer.
**Issue honnête la plus probable : le module 5 est annulé** — le chrome reste 3× jusqu'à une passe de
design qui unifie les familles CSS (chantier séparé). À acter explicitement après les modules 1-4,
pas à forcer.

---

### Module 6 — `useHumanDeclare` — **DIFFÉRÉ (Saar 2026-08-28)** : rouvert seulement quand une infra de test composant existe (sans elle, l'extraction = bug de combat subtil garanti — cf. cadrage ci-dessous, conservé)

**Pourquoi maintenant** : c'est le vrai problème d'architecture (`CombatActionWindow` = 26 `useState`
+ `useReducer` + 9 `useEffect` dans 1651 l.), il produit des bugs réels (Tir visé, voir plus bas),
et son extraction rendrait les modules 2-4 plus propres (état dans un hook, pas éparpillé). Risque
élevé assumé (cœur du combat joué, zéro test composant).

#### État des lieux — inventaire de l'état de `CombatActionWindow` `[VÉRIFIÉ 2026-08-28]`

| Groupe | Contenu | Destination |
|---|---|---|
| **A — Tactique** | `[decl, dispatch] = useReducer(declarationReducer)` (position/weapon/fire_mode/cover/vitesse/combatMode/quick) + refs `prevHasAnnouncedRef`, `initialStates` | module 6 (cœur) |
| **B — UI transverse, PAS de l'état de déclaration** | `declareError` → module 3 ; `iniPopoverOpen` → module 2 ; `rosterOpen` → module 4 | **hors module 6** |
| **C — Données de référence fetchées** (réactives au token) | `allures` (fetch `/char-sheet/:id`→`calcAllures`), `assaultWeapons`+`allInventoryItems` (inventaire), `naturalWeapons` (mutations), `mortallyWounded` (blessures) — 4 `useEffect` de fetch | module 6, ou sous-hook `useCharacterCombatLoadout(charId)` |
| **D — Mode carte éphémère** | `inMoveMode`, `inTargetMode`, `inMeleeTargetMode`, `moveSelection`, `mapSelected` (Set des tuiles ACTION) | module 6 |
| **E — Détail assaut** | `selectedAmmoId`, `assaultPendingTokenIds`, `assaultCount`, `assaultBulletCount`, `assaultVariantAB`, `isDualWield`, `aimTranches`, `aimedLocation` | module 6 ou sous-hook |
| **F — Détail CaC** | `meleePendingTokenIds`, `meleeCount`, `selectedMeleeWeaponId`, `selectedMeleeNaturalWeaponId`, `isDualWieldMelee` | module 6 ou sous-hook |
| **Dérivés + payload** | `selectedWeapon`/`meleeWeapons`/`currentVariant`/`iniDelta`/`assaultValid`/`meleeValid`/`canDeclare`/`mapActionsObj` + `handleDeclare` (assemblage du payload `COMBAT_ACTION_DECLARE`) | module 6 |

**Invariants croisés** (aujourd'hui smearés dans `handleMapToggle`, `clearAttackState`,
`clearMeleeState`, les callbacks click-attack, plusieurs `useEffect`) : Attaque ⊕ CaC ; Tir visé ⊕
Tir Multi ⊕ dual-wield ⊕ localisation visée (D10) ; Charge/Retraite → force move + flux cible ;
`weaponLocked` quand attaque/CaC sélectionné ; auto-reset `fire_mode` si l'arme ne le supporte pas ;
`RESET_NEW_TURN` (partiel) vs `RESET` (complet).

#### Trois stratégies d'extraction (PO5)

- **S1 — un `useHumanDeclare` gras** (miroir direct `useDroneDeclare`/`useExoDeclare`, mais ~5× plus
  gros : ~400 l., ~24 `useState`). Cohérent avec drone/exo, `CombatActionWindow` devient un rendu
  mince. **Contre** : un hook de 400 l. est un monolithe déplacé, dur à tester, la « couche hook »
  n'apporte pas grand-chose si c'est juste « tout l'état ailleurs ».
- **S2 — panneaux intelligents + hook coordinateur mince** : `AssaultRangedPanel` possède le groupe E,
  `MeleeCombatPanel` le groupe F ; `useHumanDeclare` ne garde que A + C + D + l'assemblage final.
  **Contre** : **inverse la décision REWORK-05** (panneaux présentationnels purs) ; les panneaux
  doivent remonter leur état au moment de déclarer ; le flux Charge/Retraite chaîne move→cible à
  travers la frontière du panneau ; le calcul `iniDelta` doit atteindre l'état des panneaux.
- **S3 — sous-hooks composés** : `useHumanDeclare` compose `useDeclareTactical()` (A + refs + sync
  nouveau tour), `useAssaultDeclare()` (E + fetches assaut), `useMeleeDeclare()` (F), `useDeclareMapMode()`
  (D). Chaque sous-hook ~60-100 l., unité compréhensible. **Contre** : le plus de travail ; les
  sous-hooks ont un vrai couplage (invariants croisés D10) → risque de sur-ingénierie.

#### Trois questions ouvertes — à trancher avec Saar AVANT le code

1. **S1 / S2 / S3 ?**
2. **Périmètre** : module 6 = extraction à comportement identique **seulement**, OU inclut le fix du
   bug Tir visé (la cause racine EST dans le groupe A — `RESET_NEW_TURN` doit re-seeder l'état
   tactique depuis le roster frais, ou l'effet `RESET` doit dépendre de `[token_id, has_announced]`) ?
   Le fix est un **changement de comportement** — le faire pendant l'extraction rend la validation
   plus dure (deux choses à prouver), mais le faire après = re-toucher le hook tout de suite.
3. **`CombatGmDeclareWindow` aussi ?** `[VÉRIFIÉ]` le MJ utilise **le même `declarationReducer`** +
   un état assaut/CaC quasi identique (avec `equipment` batch au lieu de l'inventaire par perso,
   `DEFAULT_PNJ_ALLURES`, navigation séquentielle de slots, `pjPreview`). **Si le module 6 n'extrait
   que `CombatActionWindow`**, le MJ (1286 l., mêmes problèmes) reste un 2ᵉ monolithe et
   `useHumanDeclare` n'est pas réutilisable → **ce n'est pas une victoire d'architecture, c'est
   déplacer les tripes d'un monolithe dans un hook.** L'answer architecturalement juste :
   `useHumanDeclare(mode: 'pj' | 'gm-pnj')` qui absorbe les différences (source équipement, source
   allures, slot unique vs séquentiel), consommé par **les deux** fenêtres. Beaucoup plus gros et
   risqué — mais c'est la vraie cible.

#### Cas concret motivant — bug Tir visé (Saar, 2026-08-28, ticketé)

> **CORRECTIF 2026-08-29** — deux imprécisions ci-dessous (cf. note détaillée §5bis) : `endTurn` ne
> réinitialise **pas** `state_position` (seulement `state_cover` / `state_vitesse` /
> `state_combat_mode`) ; et le symptôme « changement de couverture » venait aussi d'un défaut serveur
> distinct (`state.cover` jamais envoyé par les `handleDeclare` humanoïdes), corrigé par `d6fbd48`.

Le Tir visé humain est bloqué à tort après un tour où le joueur a changé de posture/couverture/
vitesse. Cause racine : `endTurn` (serveur) remet `combat_roster.state_position/cover/vitesse` aux
défauts, mais côté client `RESET_NEW_TURN` (`declarationReducer.js:47`) ne re-synchronise **que**
`combatMode` + `quick` — le reste de l'état tactique dans `decl` + `initialStates.current` garde la
valeur du tour précédent (re-sync uniquement sur changement de `token_id`). D'où : transition d'état
fantôme côté serveur (coût INI parasite → « INI = 0 ») + `getAimIneligibilityReasons` détecte
« changement de posture » → Tir visé rejeté ; le client affiche un coût INI différent (delta 0).
Sous-bug trivial indépendant : `socketCombatAnnouncement.js:513` émet une chaîne fourre-tout au lieu
de `getAimIneligibilityReasons().join(', ')` (contraire aux gates voisins l.445/554).

---

### Module 7 — `InlineChip` → `CombatDeclareStateChip.jsx` + API `CombatDeclareState*` unifiée — **FAIT (code, 2026-08-28) — validation navigateur Saar en attente**

**Problème** `[VÉRIFIÉ]` : `CombatGmDeclareWindow.jsx` avait un composant **local** `InlineChip` (puce
compacte click-to-cycle : choisir un état + montrer le coût de transition) — même concept que
`CombatDeclareStateSelector` (module 1), présentation compacte. Le MJ l'utilisait pour Posture/Arme/
Mode-de-tir, et `CombatDeclareStateSelector` pour Vitesse seule (Session 158 : montrer les 3 délais
d'un coup). Deux composants pour un concept, dont un caché dans une fenêtre. **En plus** :
`CombatDeclareStateSelector` recevait `stateKey` **mort** (passé par les 5 appelants, jamais lu) +
`def={STATE_DEFS.X}` — chaque site passait la paire redondante.

**Décision (Option 2, Saar 2026-08-28)** — extraction complète, pas un `variant` : les deux
présentations (segmented / chip) sont légitimement différentes (choix UX par champ, Session 158) ;
un composant à prop-switch avec deux corps de rendu serait pire (odeur B4).

**Fait** :
- `combatSections.js` : `+ export function nextKey(stateKey, currentKey, availableKeys)` — déplacée
  **verbatim** depuis la fenêtre MJ (elle prend déjà `stateKey`, `STATE_DEFS[stateKey].states`).
  `+ combatSections.test.mjs` neuf (5 cas — **premier test de ce fichier modèle**) : cycle qui boucle,
  `currentKey` inconnu → 1ʳᵉ option, restriction `availableKeys`, **`currentKey` hors de l'ensemble
  filtré → 1ʳᵉ option valide** (cas arme CC → arme RC-only), ensemble vide → inchangé.
- `CombatDeclareStateChip.jsx` neuf (ex-`InlineChip`) : API `stateKey` (inchangée) ; coût via
  `stateTransitionCost(def, initial, current)` (helper partagé) au lieu du calcul inline ; `nextKey`
  importé de `combatSections.js` ; styles `S.chip*` transportés **verbatim** (D8).
- `CombatDeclareStateSelector.jsx` : signature `{ def, … }` → `{ stateKey, … }` ; `+ import STATE_DEFS`
  ; `const def = STATE_DEFS[stateKey]` en interne. La famille a **une seule API** :
  `stateKey / current / initial / onChange` (+ extras de présentation).
- `CombatGmDeclareWindow.jsx` : retrait `InlineChip` + `nextKey` + styles `S.chip*` + **import
  `STATE_DEFS`** (devenu inutile) ; `+ import CombatDeclareStateChip` ; 3 sites puce → nouveau
  composant ; 1 site selector (vitesse) → `def={…}` retiré. `S.chips` (conteneur flex) conservé.
- `CombatActionWindow.jsx` : 4 sites selector → `def={STATE_DEFS.X}` retirés ; **import `STATE_DEFS`**
  retiré (devenu inutile).

**Framing honnête (analyse à charge)** : le gain est un **nettoyage** (une prop morte + un pass-through
`STATE_DEFS` retirés des 2 fenêtres, cost-formula inline tuée, famille cohérente), **pas** un
découplage profond — les fenêtres connaissent toujours les clés d'état (`'position'`… en dur dans le
JSX et les `dispatch`). **Zéro gain de sûreté typo** (`def` comme `stateKey` plantent sur une mauvaise
valeur). L'unification d'API est la moitié risquée : elle touche `CombatActionWindow` (INFRA-4) ×4 —
mais **soustractif** (les 5 sites passaient déjà `stateKey`, une édition partielle ne casse rien) et
`nextKey` est sous test.

**Équivalence `[VÉRIFIÉ]`** : coût chip `current === initial ? 0 : def.cost?.[initial]?.[current] ?? 0`
**≡** `stateTransitionCost(def, initial, current)` ; `nextKey` déplacée sans modification ; `def`
passait de `STATE_DEFS[stateKey]` à chaque appel → fait en interne, identique.

**Testé** : `combatSections.test.mjs` 5/5 ; `node --test shared/*` 335/335 ; `vite build` clean ;
`eslint` (5 fichiers) = **baseline exact** (6 problèmes, tous pré-existants ; nouveaux fichiers 0/0).
**Validation navigateur Saar (à faire)** : joueur — segmented posture/vitesse/arme/mode-de-tir (coûts,
sélection, `weapon` grisé si `weaponLocked`, `drawn` highlighté, `fire_mode` limité aux modes de
l'arme) — **le point à éplucher, 4 sites INFRA-4** ; MJ/PNJ — puces posture/arme/mode-de-tir (cycle,
coût, `fire_mode` limité), Vitesse (segmented) intacte.

---

## 5bis. Correctif ciblé — bug Tir visé / re-sync état de déclaration au nouveau tour

> **Pas un module de refacto** — un correctif de bug autonome, fait AVANT le module 2. Issu de
> l'analyse à charge du cadrage module 6 : la cause racine se corrige sans rien extraire.

> **CORRECTIF POST-CLÔTURE (2026-08-29, analyse à charge du présent doc)** — trois erreurs de cette
> section, sans effet sur le code livré (`snapFromRosterEntry` lit le roster tel quel, il suit le
> serveur quoi qu'il reset) :
> 1. **`endTurn` ne réinitialise PAS `state_position`.** Le reset serveur
>    (`socketCombatHelpers.js`) porte sur `state_cover` / `state_vitesse` / `state_combat_mode`
>    (+ `initiative`, `is_surprised`) — **jamais la posture** (se relever a un coût d'Initiative
>    dédié ; `COMBAT_FLUX.md` § endTurn, `PLAN_CHARACTER_STATES §0.2`). Un personnage couché au
>    tour N reste couché au tour N+1.
> 2. **Critère de validation (2) faux** : au tour N+1 la posture n'est PAS « remise à debout » —
>    elle suit le roster. Seules couverture/vitesse reviennent aux défauts.
> 3. **Moitié serveur du bug omise** : le symptôme « changement de couverture » venait d'un
>    second défaut, corrigé séparément le même jour (`d6fbd48`, 2 min avant `de350fc`) —
>    les `handleDeclare` humanoïdes n'envoient jamais `state.cover`, `getAimIneligibilityReasons`
>    normalise désormais « champ absent = inchangé » (`?? entry.state_*`). Le « sous-bug ligne 513 »
>    ci-dessous y a été replié.
>
> Test de régression étendu en conséquence (`declarationReducer.test.mjs` : cas « roster `prone`
> → `decl.position` reste `prone` »).

**Bug** : Tir visé humain rejeté à tort au tour N+1 après un tour N où le joueur/MJ a changé de
posture/couverture/vitesse (détail complet en fin de section « Module 6 »).

**Cause racine `[VÉRIFIÉ]`** : `endTurn` (serveur) remet `combat_roster.state_position/cover/vitesse/
combat_mode` aux défauts ; côté client, sur un nouveau tour (même token, `has_announced` true→false),
ni `decl` (reducer) ni `initialStates` ne sont re-synchronisés depuis le roster frais — seul un
changement de `token_id` déclenche ce re-sync.

- `CombatActionWindow.jsx` : deux effets de reset divergents et incomplets — l'un sur `[token_id]`
  (l. 238-261, re-seed `initialStates.current` + `RESET` + reset local), l'autre sur `[has_announced]`
  (l. ~322-341, `RESET_NEW_TURN` = seulement `combatMode`+`quick`, **ne touche pas** `initialStates`).
- `CombatGmDeclareWindow.jsx` : un seul effet de reset sur `[activeTokenId]` (l. 149-168) — ne
  re-fire pas au nouveau tour si le 1er PNJ non-déclaré est le même token. `initialStates` y est
  recalculé à chaque rendu (frais), donc seul `decl` reste périmé.
- `declarationReducer.js` : `RESET` (`{...DECLARATION_INITIAL, ...payload}`) vs `RESET_NEW_TURN`
  (`{...state, combatMode:'normal', quick:{}}`) — la distinction « garder la posture entre tours » de
  `RESET_NEW_TURN` **est le bug** : le serveur ne la garde pas.

**Fix `[INFÉRÉ]` — à concevoir précisément au démarrage** :
- Consolider : un seul effet de reset par fenêtre, déclenché sur `[token_id, has_announced]`, avec
  garde `prevHasAnnouncedRef` + `prevTokenRef` → reset complet (re-seed `snap` depuis `rosterEntry.
  state_*` + `initialStates` + `dispatch RESET` + reset local) **si** `token_id` a changé **ou**
  `has_announced` true→false. Extraire un helper `snapFromRosterEntry(entry)` (aujourd'hui dupliqué).
- `RESET_NEW_TURN` disparaît du reducer (ou devient un alias de `RESET`) — `weapon`/`fire_mode`
  restent portés par `payload` (le serveur ne les reset pas non plus, donc `rosterEntry.state_weapon/
  fire_mode` = valeur persistée = correct).
- Sous-bug serveur **optionnel, à bundler ou pas** : `socketCombatAnnouncement.js:513` →
  `getAimIneligibilityReasons(...).join(', ')` au lieu de la chaîne fourre-tout (aligne sur les gates
  voisins l. 445/554).

**Fichiers** : `client/src/lib/declarationReducer.js`, `CombatActionWindow.jsx`,
`CombatGmDeclareWindow.jsx` (+ éventuellement `socketCombatAnnouncement.js` pour le sous-bug).

**Risque** : moyen — cœur du combat joué, zéro test. Change le comportement de reset entre tours.

**Validation navigateur (Saar)** : (1) tour N changer de posture, tour N+1 déclarer Tir visé → doit
passer ; (2) tour N déclaration normale, tour N+1 → l'état tactique est bien remis aux défauts serveur
(posture debout, couverture exposé, vitesse normale) et l'arme/mode de tir persistent ; (3) même chose
côté MJ pour un PNJ ; (4) non-régression : déclaration multi-tuiles, Charge, annuler en cours.

---

## 6. Hors-scope V1

- Les fenêtres de phase RÉSOLUTION (`CombatModifiersWindow`, `CombatCacModifiersWindow`,
  `CombatDamageWindow`, `CombatStunWindow`, tour retardé) — ce chantier ne concerne que la
  déclaration (ANNONCE).
- Le rework du dispatch serveur Tir/CaC × PJ/PNJ/Drone/Exo (`ROADMAP.md` §5 — distinct, différé).
- La fusion des 3 orchestrateurs (rejetée, REWORK-05).
- L'ajout d'une infra de test composant (vitest/RTL) — sauf si un module la rend indispensable, et
  alors c'est un module à part, décidé explicitement.
- Migration TypeScript.
- Les statuts d'état supplémentaires exo (accroupi/genou, arme rangée/au clair) — se branchent sur
  `CombatDeclareStateSelector` (module 1) une fois disponible, mais cadrés séparément.
- **Harmonisation CSS / valeurs de style inline** (D8) : le style existe déjà et est réutilisé à
  l'identique ; aucune couche CSS ajoutée, aucun refactor `style={}`. Une passe de design/CSS dédiée
  éventuelle est un chantier séparé, plus tard.
- **Badge de type exo « PJ » au lieu de « EXO »** dans `CombatRosterWindow.jsx` (l. 224-226) —
  bug réel, fichier hors de ce chantier, traité en correctif isolé (`ROADMAP.md` §5) : ajouter
  `isExo = charType === 'exo'`, la classe `combat-badge-exo` (`index.css`), la clé
  `rosterWindow.typeBadge.exo` (`combat.json:148`), + grep du même patron `? 'pj'` ailleurs.

---

## 7. Points ouverts (à trancher au module concerné, non bloquants)

| # | Module | Question |
|---|---|---|
| PO1 | 2 | Format `X → Y` confirmé ? Le drapeau `willBeLost` (rouge) vaut-il la peine vu qu'il repose sur une estimation client (B1) ? Delta du chemin `exo_stand_up` (B2) ? Retirer le `→ projeté` du roster MJ une fois le footer unifié ? |
| PO2 | 3 | Router `COMBAT_DECLARE_ERROR` via `useCombatSocket` (P57, B3) plutôt que garder le `socket.on` local — **décision, pas discussion**. Extraire aussi `<CombatDeclareErrorBanner>` ou bannière rendue par chaque fenêtre ? |
| PO3 | 4 | Données structurées `entry.badge` vs prop `renderBadge` (B4) — ou le roster MJ n'est pas le même composant ? Mettre l'hypothèse « 1 composant pour 3 » à l'épreuve. |
| PO4 | 5 | Quelle famille de classes CSS existante réutiliser (`combat-float-*` ou `combat-win-*`), aligner le 3ᵉ dessus (décalage visuel à valider) ou garder une prop `variant` ? Réduire ou reporter le module selon l'état après 1-4. **Aucune CSS neuve dans tous les cas (D8).** |
| PO5 | 6 | `useHumanDeclare` : on le fait ? périmètre (tout l'état, ou `AssaultRangedPanel` garde le sien) ? **Le remonter avant les modules 3-4 (C2) ?** |
| PO6 | 7 | `InlineChip` (MJ) : mode `variant` de `CombatDeclareStateSelector` (a) ou composant frère séparé `CombatDeclareStateChip` (b) ? Faire juste après le module 1 (même sujet) ou plus tard ? |
| PO7 | — | `CombatOverlay` : nettoyer les 4 gardes de montage ANNONCE en une petite table, ou laisser tel quel ? (faible valeur) |
| PO8 | — | Ordre global des modules : garder « sûr d'abord » ou passer à « architecture d'abord » (C2) ? |

---

## 8. Ce qui n'est PAS fait en V1 est aussi important

- On ne fusionne rien : 3 fenêtres restent, chacune orchestratrice de sa variante.
- On ne réécrit pas `AssaultRangedPanel`/`MeleeCombatPanel`/`DroneWeaponPanel` (REWORK-05, OK).
- On n'ajoute pas de dépendance (pas de lib de slots, pas de vitest sans décision explicite).
- **Module 2 a touché le serveur** (`socketCombatAnnouncement.js`) et un module partagé neuf
  (`shared/combatIniCost.js`) — dérogation assumée au « on ne touche pas au serveur » ci-dessus :
  périmètre « robuste » acté par Saar pour dédupliquer la dernière maths de combat client/serveur.
  Iso-comportement, pas de changement de payload ni de règle. Le reste du chantier (3, 4, 7) reste
  client-only.
- Modules 5 **annulé** (B5), 6 **différé** (infra de test) — cf. §5. Livrer « 1 + §5bis + 2 + 3 »
  est déjà un état stable et une vraie amélioration (exo au niveau des deux autres, item 2 clos,
  dernière maths de combat dédupliquée, P57 respecté sur `COMBAT_DECLARE_ERROR`).
- Module 1 fait le 2026-08-28 : gain réel mais cosmétique (import croisé supprimé, famille
  `CombatDeclare*` amorcée, convention de nommage fixée) — le châssis dupliqué 3× n'est pas touché.
