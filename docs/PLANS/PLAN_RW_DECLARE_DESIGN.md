# PLAN_RW_DECLARE_DESIGN — Refonte des fenêtres de déclaration de combat (design + technique associée)

> **Statut : conception / planification — aucun code hors lot B / B5 / module 0.** 2026-08-28,
> **révisé** après analyse à charge (§11) puis cadrage M0.4 / PO6 (§12), module 2 (§13).
>
> **Décision de périmètre — Saar 2026-08-29 : chantier ÉLARGI, assumé.** À l'origine « passe design
> seule » (le rework technique était `PLAN_RW_DECLARE_WINDOWS`, clos). Mais **D5 « l'arme EST
> l'action » n'est pas un changement graphique** — c'est un changement du modèle d'interaction qui
> touche l'état de sélection (assaut/mêlée). Plutôt que de scinder en deux chantiers, Saar assume
> **explicitement** que ce chantier porte les deux volets :
> - **volet design** (re-skin pur, ne touche pas la logique de déclaration) : modules 2, 3, 5 ;
> - **volet technique** (touche l'état de sélection / la structure) : module 0 (fait), M0.4
>   (`useAssaultDeclaration` / `useMeleeDeclaration` — c'était déjà « la vraie cible du module 6 » de
>   `PLAN_RW_DECLARE_WINDOWS`), module 4 (D5).
>
> Ce n'est **pas** une dérive de périmètre non maîtrisée (le risque, relevé par Saar le 2026-08-29) —
> c'est une extension décidée, tracée ici. Le fil de conversation qui l'a établie reste en
> **planification seule** (aucun code).
>
> **Autres décisions Saar 2026-08-28** : validation navigateur **en bloc à la fin** (Q1/Q4) ;
> maquette non réalisable → **adapter et montrer**, pas de STOP (Q3) ; satellite exo **sans
> migration** (Q5, §12.5) ; glyphes **jamais en dur** (fichiers dans `assets/status/`, rework Saar).
>
> **Responsabilité** (Règle 1, `docs/RegleDocumentaire.md`) : le **langage visuel unifié** + la
> **structure commune** des trois fenêtres de déclaration d'action en phase ANNONCE
> (`CombatActionWindow`, `CombatGmDeclareWindow`, `CombatExoActionWindow`), **et le refactoring
> d'état que le modèle d'interaction cible (D5) impose**. Reprend la « passe de design dédiée » que
> `PLAN_RW_DECLARE_WINDOWS.md` (clos, archivé `docs/Old/`) a différée en annulant son module 5
> (`CombatDeclareFrame`) + le module 6 (`useHumanDeclare`) qu'il avait nommé sans le faire.
>
> **Ne traite pas** : la **fusion des orchestrateurs** (rejetée, REWORK-05 — M0.4 extrait des
> sous-états partagés, il ne fusionne pas les 3 composants) ; le calcul métier (autorité
> `shared/combatIniCost.js` / `combatSections.js`, intact) ; le dispatch de résolution Tir/CaC serveur
> (`ROADMAP.md` §5) ; la phase RÉSOLUTION (`CombatModifiersWindow` etc.) — **sauf la valeur i18n
> « Assaut » qui la traverse** (lot B3).
>
> **PLAN temporaire** (Règle 10) : à clôture, les invariants définitifs vont dans `docs/SYSTEME/COMBAT.md`
> (§ Fenêtres de déclaration) + `docs/SYSTEME/REACT.md` P58 ; les tokens dans `client/src/index.css` ;
> ce document est archivé.
>
> **Maquette de référence** (5 itérations avec Saar, **validée sur le fond** le 2026-08-28) :
> `https://claude.ai/code/artifact/3b8fb52d-aa6c-4905-a0d1-d6712c8c44d7` — 4 artboards : Humain/MJ-PNJ,
> Drone, Exo, « Décisions ». Elle valide le **look** ; elle **ne prouve pas** la faisabilité de la
> structure (footprint écran, réagencement des panneaux, satellite qui suit la fenêtre) — cf. §7 PO3.

---

## 1. Objectif

Trois fenêtres qui font le même geste (déclarer une action en phase ANNONCE) ont aujourd'hui trois
langages visuels, trois hiérarchies, trois logiques. Retour Saar 2026-08-28 : *« les fenêtres
DRONE/HUMAN/EXO ne se ressemblent pas, pas la même hiérarchie, pas la même logique. Zéro pointé. »*

**But** : une **seule structure visuelle** (même ossature, mêmes blocs, mêmes composants, même
disposition) déclinée par un **accent de famille** et par le **contenu des listes** — jamais par une
divergence de châssis. Débloquer au passage : le module 5 de `PLAN_RW_DECLARE_WINDOWS` (chrome
partagé), les sélecteurs d'état exo (`ROADMAP.md` §1 point 4), la réconciliation des tokens
`--combat-*`.

**Ce que « une seule structure » ne veut PAS dire** (analyse à charge, §11) : la fusion des
orchestrateurs reste rejetée (REWORK-05). Le MJ garde sa **navigation séquentielle de slots**
(`activeTokenId` avance via `COMBAT_SLOT_ADVANCED`, roster non cliquable `[VÉRIFIÉ]`) et sa **preview
temps réel** aux joueurs ; le PJ garde ses **multi-phases** (ANNONCE + RÉSOLUTION + surprise). Partagé
= le **châssis, la disposition, les blocs, le pied, les tokens**. Pas le pilotage.

Méthode : `docs/METHODO_PLAN.md` + `PLAN_LOCALISATION.md` §1 (i18n = critère de clôture). Un module à
la fois, validé navigateur avant le suivant.

---

## 2. État des lieux `[VÉRIFIÉ]` — lecture 2026-08-28

### 2.1 Les trois fenêtres

| | `CombatActionWindow` (PJ + drone PJ) | `CombatGmDeclareWindow` (MJ) | `CombatExoActionWindow` (exo) |
|---|---|---|---|
| Famille CSS | `combat-float-*` | `combat-win-*` (+ poignée basse, habillage de section différent) | `combat-float-*` |
| Largeur | 360 / 720 (panneau droit) | 440 | 340 |
| Titres de section | 1 couleur (`--combat-section`, 8 px) | **1 couleur codée en dur par section** (`#aa6a30`, `#aa8a30`, `#5a8a5a`…) | 1 couleur |
| Fond des tuiles ACTION | `rgba(255,255,255,0.02)` (≈ invisible) | `#0a1018` + bordure `#15212e` (visible) | `rgba(255,255,255,0.02)` |
| Bouton de pied | `t('actionWindow.declareActionButton')` | `DÉCLARER` en dur → **B1 corrigé** : `t('actionWindow.declareActionButton')` (`CombatGmDeclareWindow.jsx:1056`) | `t('actionWindow.declareActionButton')` — valeur B2 corrigée `"Déclarer l'action"` |
| État inline | `useState`/`useReducer` : **25** (1 `useReducer` + 24 `useState`, + 3 `useRef`) `[VÉRIFIÉ]` grep 2026-08-29 | **20** (1 `useReducer` + 19 `useState`, + 6 `useRef`) `[VÉRIFIÉ]` | délégué à `useExoDeclare` |
| Roster | oui (si > 1 token) | oui (non cliquable, `[VÉRIFIÉ]` — navigation = auto-advance) + badge arme | **absent** |
| État tactique | sections TACTIQUE + ARMEMENT dans le flux | idem | **absent** (dette) |
| « Passer le tour » | **impossible** (`canDeclare` exige `stateChanged \|\| hasAction`) `[VÉRIFIÉ]` | **impossible** (idem, `canDeclare` l.415) `[VÉRIFIÉ]` | implicite (déclarer vide) |
| Drone « Passer le tour » | tuile toggle explicite (`useDroneDeclare#hasPassed`) `[VÉRIFIÉ]` | idem | — |

### 2.2 « Assaut » dans `combat.json` `[VÉRIFIÉ]` (grep 2026-08-28)

| Clé | Valeur | Rendu par | Phase |
|---|---|---|---|
| `mapActions.attack.label` | `"Assaut (tir)"` | tuile ACTION (`MAP_ACTIONS`) | ANNONCE |
| `mapActions.melee.label` | `"Corps à corps"` (déjà OK) | tuile ACTION | ANNONCE |
| `actionLabels.assault` | `"Assaut (tir)"` | `CombatDeclareLog` (`ACTION_LABELS`) | ANNONCE (log) |
| `actionLabels.melee` | `"Assaut (CaC)"` (**incohérent**) | `CombatDeclareLog` | ANNONCE (log) |
| `combatOverlay` targeting `ranged` (l.21) | `"Assaut — Cliquez sur la cible"` | overlay de ciblage | ANNONCE |
| `…header` (l.534) | `"{{shooter}} — Assaut — {{target}}"` | panneau de résolution | **RÉSOLUTION** |

→ « Assaut » **traverse la phase RÉSOLUTION**. C'est de la **valeur JSON** partout (clés stables) —
un changement sans risque de code, mais qui doit être **complet** pour ne pas laisser un split
terminologique en plein milieu du flux de combat (analyse à charge §11 point 6).

### 2.3 Ce qui est déjà propre (à réutiliser, ne pas réécrire)

- **Briques `CombatDeclare*`** (`REACT.md` P58) : `CombatDeclareStateSelector`,
  `CombatDeclareStateChip` (API `stateKey`), `CombatDeclareIniWidget`, `CombatDeclareErrorBanner`,
  `CombatDeclareLog`. `[VÉRIFIÉ]`
- **Calcul métier** : `shared/combatIniCost.js` (autorité coût INI client+serveur), `combatSections.js`
  (`STATE_DEFS`, `nextKey`, `FIRE_MODE_VARIANTS`, `computeFireVariant`). `[VÉRIFIÉ]`
- **Panneaux détail** : `AssaultRangedPanel` (`[VÉRIFIÉ]` — sections Arme / Nombre de tirs / Cible(s) /
  Type de tir / Mode de tir CC-RC-RL + simple-visé-répétition / Viser une localisation), `MeleeCombatPanel`.
  Le contenu de la colonne 2 (§4). **Non réécrits — réagencés en colonne** (peut être moins trivial
  que « réagence » : sections à bordures internes, largeur actuelle 360 px → 264 px — cf. §7 PO3).
- **Tokens combat** : `client/src/index.css` l.136-184. `[VÉRIFIÉ]`

### 2.4 Le design system Enclume `[VÉRIFIÉ]` — bundle `temp/wizard/`

- Rétro-conçu depuis le code, source de vérité = `client/src/index.css`. Signature : eyebrow **10 px**
  all-caps tracké ; boutons **sentence case** ; nombres **Share Tech Mono** ; sélection = bordure
  accent ; spacing 4 px ; radius 4/6/12.
- **HUD combat = 3ᵉ palette volontairement distincte** (cyan `#3a8aaa`, dense, dure). À **conserver**.
- Le README DS glose « Assaut = ranged attack » — **périmé** par D15 (le DS n'est pas dans la
  hiérarchie d'autorité, `RegleDocumentaire.md` §12).
- Iconographie : cadre hexagonal HUD, accent par famille (`assets/status/*.svg`).
- Prototype `Professions.dc.html` : pied `[ghost] [statut centré] [primaire]`, `dis` + phrase = **patron
  maison déjà établi**.

### 2.5 Terminologie RAW `[VÉRIFIÉ]`

RAW : « Combat au contact » p.223 / « Combat à distance » p.226 ; tableau de localisation des dommages :
colonnes « Distance » / « Contact ». Base : `ref_category='Arme de contact'`. « Assaut » = invention
maison, absente du RAW et de `VOCABULARY.md` (corrigé : V2.6). « Mêlée » = import D&D, jamais employé.

---

## 3. Décisions actées (Saar, 2026-08-28)

| # | Décision |
|---|---|
| D1 | **Une seule structure visuelle**, PJ / MJ-PNJ / Drone / Exo. Châssis, disposition, blocs, pied, tokens = partagés. **Pilotage non partagé** : le MJ garde navigation séquentielle + preview, le PJ garde multi-phases. `[VÉRIFIÉ]` le roster MJ n'est **pas** cliquable — l'idée « clic = navigue » de la v1 du plan était une invention, retirée. |
| D2 | **Skin HUD combat cyan conservé.** Le Wizard = référence de discipline structurelle, pas de palette. |
| D3 | **Accent par famille** via `--combat-accent-*` (fg/bg/border) basculé par `data-family`. PJ vert `#50c878`, MJ-PNJ orange `#c86030`, Drone teal `#30aaaa`, **Exo violet `#9858c8`** (confirmé). Cyan `--combat-title` = chrome partagé uniquement. Retire l'accent bleu `#5b8dee` parasite des sélections. |
| D4 | **Réconciliation des tokens `--combat-*`** (module 1) : un seul jeu canonique dans `index.css` (vocabulaire réel + export DS), `--combat-accent-*`, `--combat-drone-*` (existe) + `--combat-exo-*` (neuf), suppression des hex en dur des objets `W`/`S` des `.jsx`. Dérogation assumée à D8 de `PLAN_RW_DECLARE_WINDOWS` — c'est la passe design que ce D8 réservait. |
| D5 | **L'arme EST l'action.** Liste d'armes groupée (Distance / Contact), choisir une arme = déclarer cette attaque. Plus de radio « Tir / Corps à corps » séparé, plus de bloc ARMEMENT redondant. Reprend la proposition exo de Saar, généralisée. |
| D6 | **Deux colonnes hiérarchiques** : col. 1 = armement (*quoi*), col. 2 = détail de l'arme choisie (*comment*, en-tête `→ Scorpion` à l'accent). La col. 2 n'est **jamais** d'autres actions. Absente si rien n'est sélectionné (fenêtre 1 colonne). |
| D7 | **Recharger vit dans la col. 2** — lié à une arme précise. En-tête : `Tir \| Recharger`, puis le détail correspondant. |
| D8 | **État tactique = fenêtre satellite** accrochée au bord gauche, se déplace avec la principale (mécanique à concevoir — cf. §7 PO3). Posture / Vitesse / Arme. « Statut, pas actions » (Saar). **Présent PJ / MJ / Exo, absent Drone.** Glyphes iconiques, peu de texte. Câblé sur `CombatDeclareStateChip`. Neuf pour l'exo. |
| D9 | **Pas de rond radio.** Sélection = bordure accent + fond teinté. |
| D10 | **Icônes = glyphes SVG produits par Saar** dans `client/public/assets/status/` : `stand`/`crounch`/`kneel`/`crawl` (posture), `actionNormal`/`actionDelayed`/`actionRush` (vitesse), `WeaponA`/`WeaponB`/`WeaponC` (arme rangée / main dessus / au clair), `contact` / `distance`. **Chargés en `mask-image: url(/assets/status/x.svg)`, jamais intégrés en dur** (Saar 2026-08-28 : garder les fichiers dans le répertoire, rework en cours), recolorés à l'accent. Vérif 2026-08-28 (§12.6) : `crawl.svg` cassé (tracé hors `viewBox`), à recadrer par Saar ; les 11 autres OK. |
| D11 | **Silhouette « viser une localisation »** conservée, en **deux sous-colonnes** dans la col. 2 (silhouette \| résumé). Repliée par défaut. |
| D12 | **Pied** : `[pastille INI] [message de statut] [Passer le tour] [Déclarer]`. Pastille `actuel → projeté` (ex. `INI 7 → 2`), **deux couleurs** : normale, rouge si tour perdu (INI ≤ 0) — jamais un blocage. « Passer le tour » = **second bouton ghost, plus petit, toujours disponible**. « Déclarer » = primaire, actif si l'action est valide, sinon grisé + raison au centre. |
| D13 | **Déplacement** = ligne distincte **au-dessus** de la liste ACTION (cumulable, hors du choix exclusif) — traitement visuel propre (encadré, « + définir la zone » / « 8 m · −5 »). |
| D14 | **Fond PCB discret** (patron `ChangelogPanel.jsx`) sur header / pied / satellite uniquement, opacité < Changelog. **Détail d'implémentation du module 2, pas une décision structurelle** — pas de point ouvert dédié. |
| D15 | **Terminologie** (`VOCABULARY.md` V2.6) : actions « Tir » / « Corps à corps » ; catégories « Distance » / « Contact ». « Assaut »/« Mêlée » proscrits en UI, **y compris en phase RÉSOLUTION** (§2.2). Codes internes `action_key='assault'`/`'melee'` **inchangés**. |

---

## 4. Structure cible (identique aux 4 familles)

```
┌─ SATELLITE « Statut » ─┐  ┌─ FENÊTRE PRINCIPALE ───────────────────────────┐
│ [glyphe] Posture        │  │ HEADER   hexa famille · nom · N/N déclarés      │
│ [glyphe] Vitesse        │  ├────────────────────────────────────────────────┤
│ [glyphe] Arme           │  │ + Déplacement                      8 m · −5     │  ← D13, cumulable
└─ (absent pour un drone) ┘  ├─ COL. 1 : ACTION (un choix) ──┬─ COL. 2 : détail┤
                             │ [hexa] DISTANCE               │ → Scorpion       │
                             │   Scorpion            24/24   │ [Tir | Recharger]│  ← D7
                             │ [hexa] CONTACT                │ Cible  …         │
                             │   Couteau Congre              │ Mode de tir …    │
                             │   Mains nues                  │ Tir simple/visé/ │
                             │ (armes naturelles…)           │   répétition …   │
                             │                               │ Deux armes …     │
                             │ ── ROSTER (repliable) ──      │ Localisation :   │
                             │   ▶ Baboulinet         INI 7  │  [silhouette|résumé]
                             │   ✓ Jean Val-Jean      INI 11 │                  │
                             ├───────────────────────────────┴──────────────────┤
                             │ [INI 7 → 2] Prêt  [Passer le tour] [Déclarer]     │  ← D12
                             └──────────────────────────────────────────────────┘
```

**États non-déclaration** `[VÉRIFIÉ]` — `CombatActionWindow` rend aussi : jet de surprise,
surpris-inactif, résolution (mon tour / pas mon tour), attente d'un autre déclarant, déjà déclaré.
`CombatDeclareFrame` (module 2) doit tous les héberger — ce sont des variantes simples (titre +
message), à inventorier au cadrage du module 2, pas à négliger.

**Ce qui varie par famille — rien d'autre :**

| | PJ | MJ / PNJ | Drone | Exo |
|---|---|---|---|---|
| Accent | vert | orange | teal | violet |
| Satellite | oui | oui | **non** | oui |
| Liste d'armes | inventaire du perso | équipement batch PNJ | 1 arme | armement exo (souvent 5) |
| Roster | si > 1 token | tous PNJ gérés (**non cliquable**, auto-advance) | — | — |
| Colonne 2 | complète (dual-wield, tir multi 1-3, visé, localisation) | complète | cible + mode | cible + mode (une attaque / Tour) |
| Pilotage | multi-phases | navigation séquentielle + `pjPreview` | multi-phases (dans `CombatActionWindow`) | ANNONCE seule |

### 4.1 Cas limites de « l'arme EST l'action » (D5) `[INFÉRÉ]` — à figer au module 4

- **Mains nues** : ligne permanente du groupe Contact.
- **Armes naturelles** (`char_mutations.natural_weapon_formula`) : lignes du groupe Contact.
- **Arme mixte** (contact + distance) : présente dans **les deux** groupes.
- **Dual-wield** : **option de la col. 2** (`showDualWieldSection` existe déjà, `AssaultRangedPanel` /
  `MeleeCombatPanel`).
- **Modes de combat CaC** (Charge / Retraite / Défensif) : `[INFÉRÉ]` — segments en tête de col. 2
  (`Attaque \| Défensif \| Charge \| Retraite \| Recharger`) ou sous-bloc ? Charge chaîne
  déplacement→cible. **Point ouvert PO2.**

---

## 5. Séquence

> **Historique** : round 2 (§11) limitait le périmètre engageable à lot B + B5 + module 1 et parquait
> les modules 2-5. Round 4 les a dé-parkés. **2026-08-29 : chantier élargi assumé** (en-tête) — les
> modules 2-5 + M0.4 sont **le chantier**, plus « en attente ». Ordre : §10. Rythme : cadrage →
> analyse à charge → code, séparés (checkpoint), un module validé avant le suivant.

### 5.1 À FAIRE MAINTENANT (aggrade sans condition) — lot B — **CODÉ 2026-08-28**

Client-only. **Trois passes** :

**Passe 1 — `combat.json` (valeur JSON seule, aucune clé) — FAIT** — B2 + B3, un commit :

| # | Contenu | Fait |
|---|---|---|
| B2 | 8 fautes d'accent du bloc `actionWindow.*` (`Déclarer l'action`, `Vous êtes surpris`, `Lancer le dé d'initiative`, `déterminer`, `Phase 2 — Résolution`, `Précipité (-5)`, `Phase 1 — Déclaration d'intention`, `Action déclarée`). | ✅ |
| B3 | Terminologie (`[VÉRIFIÉ]` grep exhaustif) : `targetLegend.ranged` → « Tir » ; `actionLabels.assault` → « Tir » ; `actionLabels.melee` « Assaut (CaC) » → « Corps à corps » ; `mapActions.attack.label` → « Tir » ; `droneWeaponPanel.ready` « Prêt à l'assaut » → « Prêt à tirer » ; `modifiers.header` (résolution, `CombatModifiersWindow.jsx:245`) → `{{shooter}} — Tir — {{target}}`. `fr.json` « fusil d'assaut » = RAW, intouché. | ✅ |
| B4 | Pastille INI : `iniWidget.pill` = `"INI = {{current}} -> {{projected}}"` (flèche ASCII, décision Saar) ; `CombatDeclareIniWidget.jsx` rend le format + aria mise à jour ; rouge si projeté ≤ 0 inchangé. `REACT.md` P58 disait déjà « current + delta » (pas « juste le chiffre »), pas de contradiction — précision ajoutée. | ✅ |

**Passe 2 — `CombatGmDeclareWindow.jsx` — FAIT** :

| # | Contenu | Fait |
|---|---|---|
| B1 | `DÉCLARER` en dur (l.1085) → `{t('actionWindow.declareActionButton')}`. Le MJ affiche « DÉCLARER L'ACTION » (CSS `.btn-tac-confirm` uppercase) comme joueur/exo. | ✅ |

**Passe 3 — `socketCombatAnnouncement.js` — FAIT (swap de mot)** : les ~9 messages `COMBAT_DECLARE_ERROR`
avec « Assaut » → « Tir » (« Tir drone/exo impossible », « Tir impossible », « Corps à corps et Tir
sont mutuellement exclusifs », « Tir : sélectionner une cible… »). **Ne corrige pas** la violation
i18n (serveur émet du FR en dur) — l'i18n-ification complète de `COMBAT_DECLARE_ERROR` (~70 sites,
changement de payload) est **différée** : `PLAN_LOCALISATION.md` §8 (Lot 6, décision Saar 2026-08-28).

**Testé** : `combat.json` JSON valide ; `node -c` serveur OK ; `eslint` widget (0/0) + GM (baseline
inchangée) ; `vite build` propre ×2. **Non testé** : parcours navigateur (validation en bloc,
`feedback_batch_tests`). Pas de script de résolution i18next dans le repo — vérif manuelle : clés
inchangées, `grep -i assaut combat.json` = vide.

### 5.2 B5 — « Passer le tour » déclarable pour un humain — **CODÉ 2026-08-28**

**Cadrage `[VÉRIFIÉ]`** : le serveur accepte déjà une déclaration vide — `socketCombatAnnouncement.js`
l.67 `if (!tokenId || !state) return` (un objet `{}` passe), l.78-79 valide chaque clé d'état
**seulement si présente**, puis pose `has_announced`. Le drone (`useDroneDeclare#hasPassed`) et l'exo
(déclaration vide) le font déjà. Seul le **client** bloquait : `canDeclare` exigeait
`hasAnyAction || stateChanged` (PJ, ex-l.642-644) / `stateChanged || hasAction` (MJ, ex-l.399-415).

**Question de fond (Saar)** — « autoriser une déclaration vide, ou modéliser explicitement une action
"ne rien faire" ? » → B5 = **le mécanisme** (débloquer `canDeclare`). Le **libellé explicite**
« Passer le tour » (le joueur *veut* passer, pas un mis-clic sur « Déclarer ») = **D12 / module 5**
(refonte du pied). Ajouter un swap de libellé maintenant = ré-introduire le code supprimé que le
module 5 re-supprime — churn, écarté.

**Fait** :
- `CombatActionWindow.jsx` : `hasAnyAction` + `stateChanged` supprimés (seuls usages) ;
  `canDeclare = isDrone ? droneDeclare.canDeclare : (assaultValid && reloadValid && meleeValid)`.
  Une action de combat *incomplète* reste bloquée — `assaultValid`/`reloadValid`/`meleeValid` valent
  `false` tant qu'une tuile sélectionnée n'est pas configurée.
- `CombatGmDeclareWindow.jsx` : `stateChanged` + `hasAction` supprimés ; **`meleeValid` neuf** (miroir
  d'`assaultValid` : un CaC en cours de configuration doit avoir une cible, ou être passif
  Défensif/Retraite, ou une Charge avec cible) ; `canDeclare = (isActivePnj && assaultValid &&
  meleeValid) || (isActiveDrone && droneDeclare.canDeclare)`.
- Exo : rien à faire (déjà déclarable vide).

**Coût intérimaire assumé** : le bouton « DÉCLARER L'ACTION » est actif dès l'ouverture de la fenêtre
(rien de sélectionné). Un mis-clic passe le tour. Recouvrable (combat arbitré tour par tour par le
MJ) ; le module 5 corrige le libellé.

**Testé** : `vite build` propre ; `eslint` = **baseline exacte** (6 problèmes GM pré-existants
inchangés, `CombatActionWindow` 0/0) ; résidus `hasAnyAction`/`hasAction`/`stateChanged` = 0 (hors
1 mention en commentaire).
**Non testé** : parcours navigateur (validation en bloc).

### 5.3 Module 1 — Tokens d'accent par famille (D3/D4) — **RE-CADRÉ round 4**

**Analyse à charge round 4** (inventaire ; recompté `[VÉRIFIÉ]` 2026-08-29, `#hex` seul) : ~**260
couleurs en dur** dans les 9 fichiers de fenêtres (`CombatGmDeclareWindow` 94, `CombatActionWindow`
56, `MeleeCombatPanel` 33, `AssaultRangedPanel` 25, `DroneWeaponPanel` 15, `DroneDeclareSection` 13,
`CombatExoActionWindow` 9, `CombatDeclareStateSelector` 7, `CombatDeclareStateChip` 6) — et la
plupart ne sont **pas** des accents (texte, bordures, rouges/verts de panneau). Les convertir toutes
= refonte CSS complète, churn, risque visuel
élevé. **La dette « 3 vocabulaires » n'existe pas au runtime** : l'export DS (`temp/wizard/`) n'est
**pas chargé** ; `index.css` a déjà un jeu `--combat-*` propre (pj/pnj/drone triplets, `--combat-ini-*`).

**Périmètre réel du module 1, réduit** :
- `+ --combat-exo-*` (fg/bg/border, violet `#9858c8`) dans `index.css` — 3 lignes, zéro risque.
- Introduire `--combat-accent-*` **mappé par famille**, consommé par `CombatDeclareFrame` (module 2) —
  donc **le module 1 fusionne dans le module 2** (le `data-family` n'a de sens qu'avec le chrome
  partagé). Pas de module 1 autonome.
- Le remplacement des ~25 occurrences d'accent bleu parasite (`#5b8dee` / `rgba(91,141,238,*)`) se
  fait **au fil des modules 2/4/5**, sur les fichiers qu'ils touchent déjà — pas en passe séparée.
- La conversion complète hex → tokens des panneaux = **hors périmètre** (chantier CSS distinct, non
  ouvert).

### 5.4 Modules 0-5 — la refonte, faite avec un filet (round 4 : dé-parkée)

**Round 4 (rappel des priorités par Saar, 2026-08-28)** : « qualité structurelle >>> vitesse ;
si on doit rework pour stabiliser, on le fait ; on n'est pas pressés ». → les modules 2-5 ne sont
**plus « en attente d'un backlog plus mince »**. Ils se font, **après le filet** (module 0), qui est
lui-même une aggradation légitime que ces priorités endossent explicitement.

**Module 0 — Extraire la logique de déclaration en modules purs testés (PAS « ajouter vitest »).**
`[VÉRIFIÉ]` la philo de test d'Enclume : 127 fichiers `*.test.mjs` (`node --test`, fonctions pures ;
compte 2026-08-29, en croissance) +
Playwright E2E (`tests/e2e/`, `@playwright/test` installé) ; **aucun test composant, choix assumé**.
`client/src/lib/declarationReducer.test.mjs` + `client/src/components/combatSections.test.mjs` +
`shared/combatIniCost.test.mjs` couvrent déjà le **calcul pur** de la déclaration. Ce qui n'est **pas**
testé : l'**assemblage du payload** `COMBAT_ACTION_DECLARE` (aujourd'hui inline dans `handleDeclare` de
chaque fenêtre) et les **invariants croisés** (Attaque ⊕ CaC, Tir visé ⊕ Tir Multi ⊕ dual-wield,
Charge/Retraite → force move+cible).

Méthode (golden master / characterization, pratique pro documentée — sources §11 round 4) :

| Sous-lot | Contenu | État |
|---|---|---|
| **M0.0** | Script `npm test` (`node --test` glob `shared/` + `client/src/` + `server/src/`) — ~126 `*.test.mjs` sans commande pour les lancer en bloc. `package.json`. | ✅ **codé 2026-08-28** — 1001 → 1022 tests, 0 fail |
| **M0.1** | `client/src/lib/buildDeclarePayload.js` (`buildHumanDeclarePayload`, pur) — extraction **verbatim** de `CombatActionWindow.jsx#handleDeclare` branche non-drone ; `handleDeclare` rassemble un bag plat et appelle la fonction. `+ buildDeclarePayload.test.mjs` : **21 tests de caractérisation** (tour vide, Tir simple/Multi/visé/dual-wield/sans variant, CaC/naturelle/défensif/dual-wield, rechargement, déplacement normal/Charge/Retraite/sans Z, actions rapides, état tactique). | ✅ **codé 2026-08-28** — 21/21, build propre, eslint baseline inchangée |
| **M0.2** | `buildGmDeclarePayload` — extraction **verbatim** de `CombatGmDeclareWindow.jsx#handleDeclare` branche PNJ. Différences légitimes vs PJ préservées et testées (`fireModeBonus*` par défaut `0` vs `null` ; `move` brut sans forçage `ini_mod` ; `weapon.inv_id`). `+ 16 tests`. | ✅ **codé 2026-08-28** — 37/37 total, npm test 1038/0 fail, eslint GM 2→2 (baseline) |
| **M0.3** | `buildDroneMapActions` + `buildExoMapActions` — cœurs purs extraits verbatim de `useDroneDeclare` / `useExoDeclare` `#buildMapActions` (les hooks deviennent des wrappers `useCallback`). `+ 14 tests` (logique fire_mode drone, CaC vs Tir par `ref_category` exo, déplacement, quirks figés). | ✅ **codé 2026-08-28** — 51/51 total, npm test 1052/0 fail |
| **M0.4** | Le payload est verrouillé (**51 tests de caractérisation, 4 familles**) → extraction du sous-état de déclaration PJ ↔ MJ-PNJ en petits pas, tests verts après chaque pas. **Cadrage fait (§12)** : pas un hook `useHumanDeclare(mode)` (option rejetée) mais deux hooks de domaine sans `mode` — `useAssaultDeclaration` + `useMeleeDeclaration` + reset commun. | cadré (§12) — **décision Saar en attente** sur l'option retenue ; à placer juste avant le module 4 |

**Jalon M0.1-M0.3 (2026-08-28)** : le payload `COMBAT_ACTION_DECLARE` des 4 familles (PJ / PNJ / drone /
exo) est extrait en `client/src/lib/buildDeclarePayload.js` et couvert par **51 tests de
caractérisation** figés sur le comportement actuel. Les modules 2-3 (chrome, satellite) ne touchent
que du layout → le golden master casse si le payload bouge. Modules 2-5 (refonte visuelle) ne touchent
alors **que du JSX/layout** — le golden master attrape
   toute régression de payload.

Aggradation **permanente** : le chemin de déclaration de combat devient testable pour de bon, pas
juste pour cette refonte. Aligné sur la philo `.mjs` du projet — **pas de nouveau paradigme**.
Playwright E2E reste possible en complément (scénario combat réel) mais n'est pas le filet principal.

**Modules 2 → 5** : après le module 0. Un module = un commit, validé (tests `.mjs` verts + navigateur
Saar) avant le suivant. Ancien code retiré dans le même commit.

**Module 2 — `CombatDeclareFrame` (chrome partagé) + `--combat-accent-*` par famille (ex-module 1).**
**Cadré en détail §13** (API, châssis actuels `[VÉRIFIÉ]`, 6 états non-déclaration, tokens, PCB,
gardes de montage, risque, 5 points ouverts PO-M2-a..e). En bref : `CombatDeclareFrame` possède
`useDraggable` + châssis (palette `--combat-*` dédiée) + masquage + slots `satellite`/`footer` +
`data-family` → `--combat-accent-*` ; `+ --combat-exo-*` (#9858c8) dans `index.css`. Risque **élevé**
(structure externe des 3 fenêtres) — mais **JSX/CSS only, payload inchangé** → golden master du
module 0 en filet ; un commit par fenêtre migrée.

**Module 3 — `CombatDeclareStatePanel` (satellite, D8).** **Cadré §14** (corrigé round 6). Sortir
les sélecteurs d'état du corps vers un **panneau frère** du frame, positionné depuis `pos`,
présentation glyphe (`assets/status/`, `--combat-accent-fg`). **PJ + MJ** : posture (4) + vitesse (3)
+ arme (3) ; `fire_mode` reste au corps jusqu'au module 4 (§14.7). **Exo** : posture (4) + arme (3),
**pas** de mode de tir (fixe) ; le cas `prone → Test` (`isExoStandUpAttempt`, déjà serveur) à
recâbler proprement = le point délicat (PO-M3-a). **PAS de migration serveur** (§12.5). Risque
moyen ; payload PJ/MJ inchangé (golden master) ; exo : `+ buildExoDeclareState` pur + test (§14.6).
Un commit par fenêtre + checklist manuelle. Points ouverts PO-M3-a..f.

**Module 4 — `CombatDeclareActionList` (liste groupée, D5/D6/D7/D9/D13).** Le cœur visuel. Liste
d'armes groupée, sélection = bordure accent, Déplacement en ligne distincte, col. 2 = détail
(`Tir | Recharger`, `AssaultRangedPanel` / `MeleeCombatPanel` réagencés en colonne, silhouette 2
sous-colonnes). Absorbe §4.1. Risque **élevé** — mais avec le module 0 fait, la logique de payload est
extraite et testée : le module 4 **consomme `useHumanDeclare` et ne fait que du rendu**. Le golden
master casse au moindre changement de payload. PO2/PO3 (mode « Défensif », faisabilité col. 2 264 px,
satellite qui suit) éprouvés au cadrage du module 4, **avant** le code.

**Module 5 — Pied unifié (D12).** `CombatDeclareFooter` : pastille + statut + `Passer le tour` (ghost)
+ `Déclarer` (primaire, raison bloquante si `!canDeclare`). Consommé par les 3 (slot `footer` du
module 2). Dépend de B5 (le « Passer le tour » toujours disponible). Risque : faible-moyen.

---

## 6. Migration / rollback

- **Lot B + B5** : chaque item est un commit isolé, **`git revert` suffit** (JSON, un one-liner).
  Aucun feature flag.
- **Module 0** : extraction mécanique + tests `.mjs` neufs — additif, `git revert` trivial ; le
  `vite build` + les tests verts couvrent l'extraction.
- **Modules 2-5** (si rouverts) : chaque module branché retire l'ancien code dans le même commit —
  **`git revert` du commit du module** est le rollback. **Pas de feature flag** (analyse à charge
  round 2) : cohabiter deux `CombatActionWindow` de 1500 l. pendant une transition = enfer de merge et
  double surface de bugs — remplacement franc, revert si régression.
- **Aucun de ces modules ne touche un schéma DB.** (Correction 2026-08-29, §11 round 5 : la version
  précédente affirmait « sauf le sous-module serveur du module 3 (état exo) — migration standard » —
  faux, `[VÉRIFIÉ]` §12.5, la persistance `state.*` exo est déjà générique et sans migration.)

---

## 7. Points ouverts

| # | Module | Question |
|---|---|---|
| PO1 | 2 | **Tranché §13.5** : `data-family` en **attribut** (pas classe `.combat-fam-*`). Le `#5b8dee` parasite → `--combat-accent-*` **sur les fichiers que les modules 2/4/5 touchent déjà**, pas en passe séparée. |
| PO2 | 4 | Col. 2 d'une arme de contact : modes de combat (Défensif / Charge / Retraite) en segments de tête ou sous-bloc ? Charge chaîne déplacement→cible — comment ? |
| PO3 | 2 / 4 | **Faisabilité non prouvée par la maquette** : (a) footprint écran satellite + col1 + col2 + sidebar + timeline sur un écran réel ; (b) `AssaultRangedPanel`/`MeleeCombatPanel` (sections 360 px, bordures internes) « réagencés » en col. 2 de 264 px = réagencement ou réécriture ? (c) satellite « suit la fenêtre » : wrapper draggable (change la prise) ou sync de position ? Col. 2 très haute pour un Tir complet → pied épinglé + corps scrollable, à confirmer et montrer. Transition entre armes = reset de la config précédente (à assumer). Saar 2026-08-28 : quand la maquette ne passe pas, **adapter et montrer**, pas de STOP à chaque fois. |
| PO4 | 0 | ~~Quelle infra de test~~ **Tranché round 4** : `node --test` + fonctions pures `.mjs` (philo projet), pas de vitest/RTL. Périmètre M0.1-M0.3 fait (51 tests). |
| PO5 | 3 | Satellite : glyphe qui **reflète la valeur** (Saar a produit les 4 glyphes de posture → plutôt oui) ou glyphe de catégorie + texte ? |
| PO6 | 4 | **Cadré §12.** Options : hook `useHumanDeclare(mode)` (rejeté, cf. §12.3-A) / présentationnel pur (ne fait pas le travail, §12.3-B) / **deux hooks de domaine sans `mode`** (reco, §12.3-C). Décision Saar en attente. À trancher **avant** le module 4. |
| PO7 | — | `CombatOverlay.jsx` : 4 gardes de montage ANNONCE — nettoyer en une table ou laisser ? (faible valeur) |

---

## 8. Hors-scope

- La phase RÉSOLUTION (fenêtres `CombatModifiersWindow`, `CombatCacModifiersWindow`,
  `CombatDamageWindow`, `CombatStunWindow`) — **sauf** la valeur i18n « Assaut » (B3).
- Le dispatch serveur Tir/CaC × PJ/PNJ/Drone/Exo (`ROADMAP.md` §5).
- La fusion des orchestrateurs (rejetée, REWORK-05 — on partage le châssis, pas le composant).
- Le calcul métier (`combatIniCost`, `combatSections`, allures) — intact.
- Migration TypeScript. **Aucune nouvelle dépendance** : le module 0 reste sur `node --test` +
  fonctions pures `.mjs` (philo du projet), pas de vitest/RTL.
- Conversion complète hex → tokens des panneaux combat (~260 occurrences) — chantier CSS distinct,
  non ouvert (round 4).
- La barre d'action ancrée non-couvrante (style Argon Combat HUD) — très gros chantier, contraire au
  paradigme Enclume. Nommé pour mémoire, non ouvert.

---

## 9. Ce qui n'est PAS fait en V1 est aussi important

- On ne fusionne pas les orchestrateurs. Le MJ garde sa navigation séquentielle et sa preview.
- On ne réécrit pas `AssaultRangedPanel` / `MeleeCombatPanel` / `DroneWeaponPanel` — on les réagence
  (col. 2), sous réserve PO3.
- On ne touche pas au calcul d'Initiative ni au dispatch serveur.
- **Lot B (B1-B4)** est codé (§5.1). **B5** = chantier isolé, cadrage + analyse à charge d'abord.
- **La refonte (modules 0-5) se fait** (round 4) — module 0 (filet de test pur) d'abord, puis 2→5,
  un module validé avant le suivant. Le module 1 a fusionné dans le module 2.

---

## 10. Ordre recommandé

1. **Lot B** — ✅ **codé 2026-08-28** : `combat.json` (B2 + B3 + B4) + `CombatGmDeclareWindow.jsx` (B1) +
   `socketCombatAnnouncement.js` (swap « Assaut » → « Tir »). Validation navigateur en bloc à venir.
2. **B5** — ✅ **codé 2026-08-28** : `canDeclare` débloqué (PJ + MJ), `meleeValid` neuf côté MJ.
   Libellé explicite « Passer le tour » = module 5.
3. **Module 0** — `buildDeclarePayload` M0.1-M0.3 ✅ (golden master, 51 tests). M0.4 (sous-état Tir/CaC)
   cadré §12, **décision Saar en attente**, placé avant le module 4.
4. **Module 2** (chrome partagé + accent par famille + `--combat-exo-*`) → **3** (satellite) →
   **M0.4** (extraction sous-état, §12.4) → **4** (liste d'action) → **5** (pied). Un module validé
   (tests verts ; navigateur Saar **en bloc à la fin**, Q1/Q4) avant le suivant.

La maquette est la cible. Le module 0 est le filet qui rend le reste sûr.

---

## 11. Journal de l'analyse à charge (2026-08-28)

Revue demandée par Saar juste après la première rédaction. Conclusions intégrées ci-dessus :

1. **Plan à ~8 problèmes** → assumé comme roadmap (précédent `PLAN_RW_DECLARE_WINDOWS`), framing
   « faire maintenant / isolé / gaté » ajouté (§5, §10). **B5 sorti du lot B** (comportement ≠ texte).
2. **D1 « MJ = forme joueur » sous-analysé** → `[VÉRIFIÉ]` le roster MJ n'est pas cliquable, navigation
   = auto-advance. L'idée « clic = navigue » de la v1 était une invention, retirée. Le partage
   PJ↔MJ-PNJ de la logique d'action = PO6, à trancher **avant** le module 4.
3. **Maquette valide le look, pas la structure** → §7 PO3 (footprint, réagencement des panneaux,
   satellite qui suit).
4. **Module 4 très risqué, pas de dé-risquage** → **Module 0 (infra de test) promu en prérequis
   ferme**, §5.3. Critère d'aggradation appliqué : modules 2-5 n'aggradent pas la testabilité → gatés.
5. **Périmètre terminologie plus large que 3 fichiers** → grep fait (§2.2), B3 reformulé « valeur JSON
   partout, y compris résolution », zéro `.jsx`.
6. **Split terminologique/visuel au milieu du flux combat** → B3 s'étend à la valeur i18n de la
   résolution ; le split **visuel** reste (résolution hors-scope) et est assumé comme transitoire,
   noté §8.
7. **Fond PCB sur-décidé** → D14 rétrogradé en détail d'implémentation du module 2, PO6 dédié retiré.
8. **États non-déclaration manquants** → ajoutés au périmètre du module 2 (§4).
9. **Pas de migration/rollback** → §6.
10. **Chiffres non re-vérifiés** → recomptés `[VÉRIFIÉ]` (2026-08-29, cf. round 5) : `CombatActionWindow`
    = **25** `useState`/`useReducer` (+3 `useRef`), `CombatGmDeclareWindow` = **20** (+6 `useRef`) —
    les « 27 / 21 » annoncés ici le 28 étaient faux ; bouton exo = `t('actionWindow.declareActionButton')`.

### Round 2 (même jour, après réponse « Go implanter ? »)

1. **Module 0 = virage de philosophie de test transverse, pas un module** → modules 2-5 passés de
   « gatés » à **« en attente, déclencheur explicite »** (§5.4). Périmètre engagé assumé =
   **lot B + B5 + module 1**.
2. **D5/D6/D8 = paris porteurs non résolus** (mode « Défensif » ≠ arme ; col. 2 à 264 px ; satellite
   qui suit) → restent en PO2/PO3, explicitement « si un pari lâche, la structure lâche » — à
   éprouver avant module 4, pas pendant.
3. **B4 inverse une décision validée + sous-cadre** (docs + overflow pied étroit) → **retiré du lot B**,
   décision Saar requise (§5.1).
4. **Grep « assaut » incomplet 2× + serveur** → re-grep exhaustif : `combat.json` l.21/204/205/263/473/534
   (dont l.473 « Prêt à l'assaut » et l.534 = `CombatModifiersWindow` résolution) ; **serveur
   `socketCombatAnnouncement.js` : 8 messages FR en dur** (dette voisine, option (a) swap au passage) ;
   `fr.json` « fusil d'assaut » = RAW, **intouché**.
5. **B1/B2/B3 ordre + fragmentation** → B2+B3 = un commit `combat.json`, puis B1. `fr.json` exclu.
6. **Feature flag module 4** → retiré du §6 : cohabitation de deux `CombatActionWindow` de 1500 l. =
   pire que remplacement franc + `git revert`.

### Round 3 (même jour — lot B codé)

1. **B4 tranché par Saar** : « on a déjà tranché » — format `INI = 7 -> 2` (flèche ASCII), deux
   couleurs. Réintégré au lot B, codé. `REACT.md` P58 disait « current + delta » (pas « juste le
   chiffre ») → pas de contradiction de doc à corriger. Overflow du pied : non pertinent tant que le
   2ᵉ bouton (« Passer le tour », module 5) n'existe pas — à surveiller au test navigateur du lot B5/5.
2. **i18n serveur `COMBAT_DECLARE_ERROR`** : Saar a demandé la norme i18n « maintenant, sauf
   difficulté ». `[VÉRIFIÉ]` ~70 sites d'émission + changement de payload + messages dynamiques +
   chaîne client → **difficulté réelle**, différé → `PLAN_LOCALISATION.md` §8 (Lot 6). Swap de mot
   « Assaut » → « Tir » fait au passage (9 messages, cohérence terminologique).
3. Commentaire stale `CombatExoActionWindow.jsx:288` (« libellé générique "Assaut (tir)" ») laissé —
   commentaire, pas du texte visible ; à nettoyer si le fichier est rouvert.

### Round 4 (même jour — Saar rappelle les priorités : qualité structurelle >>> vitesse, rework pour stabiliser si besoin, pas pressés, se documenter)

1. **Module 1 (tokens) `[VÉRIFIÉ]` : ~260 couleurs en dur, la plupart pas des accents ; l'export DS
   n'est pas chargé (pas de vraie dette « 3 vocabulaires » runtime).** → module 1 réduit à `+ --combat-exo-*`
   + `--combat-accent-*` par famille, et **fusionné dans le module 2** (le `data-family` n'a de sens
   qu'avec le chrome partagé). La conversion complète hex → tokens = chantier CSS distinct, non ouvert.
2. **Modules 2-5 dé-parkés.** Les priorités rappelées par Saar endossent explicitement « rework pour
   stabiliser ». Le blocage n'est plus « attendre un backlog plus mince » — c'est « faire le filet
   d'abord ».
3. **Module 0 re-cadré (recherche : golden master / characterization tests, sources ci-dessous).**
   `[VÉRIFIÉ]` Enclume = ~127 fichiers `*.test.mjs` (`node --test`, fonctions pures) + Playwright E2E ;
   aucun test composant, choix assumé. `declarationReducer.test.mjs` / `combatSections.test.mjs` /
   `combatIniCost.test.mjs` couvrent déjà le **calcul pur**. Non testé = **l'assemblage du payload**
   `COMBAT_ACTION_DECLARE` (inline dans `handleDeclare`) + les invariants croisés. → module 0 =
   **extraire `buildDeclarePayload` / `useHumanDeclare` en `.mjs` purs + tests de caractérisation**,
   PAS ajouter vitest. Aligné sur la philo du projet, aggradation permanente. Modules 2-5 ne touchent
   ensuite que du JSX, le golden master casse au moindre changement de payload.

**Sources recherche round 4** :
- Golden Master / Characterization test — [Fabrizio Duroni](https://www.fabrizioduroni.it/blog/post/2018/03/20/golden-master-test-characterization-test-legacy-code),
  [Codurance](https://www.codurance.com/publications/2012/11/11/testing-legacy-code-with-golden-master),
  [Wikipedia](https://en.wikipedia.org/wiki/Characterization_test).
- Refactoring React avec characterization tests (behaviour, pas state interne ; petits pas ; state
  untangling) — [Koder.ai](https://koder.ai/blog/refactoring-react-components-claude-code),
  [Cloudamite](https://cloudamite.com/characterization-testing/).
- (Vitest + RTL considéré puis écarté — nouveau paradigme contraire à la philo `.mjs` d'Enclume :
  [Incubyte](https://blog.incubyte.co/blog/vitest-react-testing-library-guide/),
  [Makers Den](https://makersden.io/blog/guide-to-react-testing-library-vitest).)

### Round 5 (2026-08-29 — analyse à charge demandée par Saar : la fausse contrainte « satellite exo = migration serveur »)

**Fait.** Le plan a affirmé, de sa rédaction jusqu'au 2026-08-28, que le satellite d'état exo
(module 3) « nécessite le serveur (persistance `state_position` / `state_weapon` exo, gate de
résolution) », avec un « sous-module serveur explicite », un risque « moyen-élevé (exo + serveur) »
(§5.4) et une ligne dédiée en §6 (« sauf le sous-module serveur du module 3 — migration
rétrocompatible standard »). **C'était faux** : `socketCombatAnnouncement.js:810-829` persiste
`state.*` génériquement pour tout type y compris exo ; `setCharacterState` est agnostique au type ;
les colonnes existent. Aucune migration. Vérifié en ~15 min, mais seulement après « ENORMES DOUTES »
de Saar — pas par une relecture, pas par les rounds 1-4.

**Chaîne de défaillance.**
1. `ROADMAP.md` §1 point 4 (session exo antérieure) : « reste à câbler dans `CombatExoActionWindow` +
   le serveur » — sans marqueur, sans source.
2. Rédaction du présent plan : j'ai **importé et amplifié** cette phrase — « + le serveur » vague est
   devenu « persistance `state_position`/`state_weapon` exo », « gate de résolution », « migration
   rétrocompatible standard », « risque moyen-élevé ». Détail concret ajouté, jamais dans la source,
   jamais vérifié.
3. Rounds d'analyse à charge 1-4 : ont critiqué la **structure** du plan (périmètre, découpage,
   ordre, risque du module 4) — **jamais rouvert `socketCombatAnnouncement.js`** pour vérifier la
   branche `isExo`.
4. Révélé par Saar, pas par moi.

**Règles violées.** CLAUDE.md §1.1 (code observé > mémoire/conversation — ROADMAP est de la
conversation figée, pas du code) ; §6 (« termes interdits sans preuve » — une affirmation posée là où
il fallait `[INCONNU]`) ; §13 détecteur de dérive (« diagnostic sans lecture ni instrumentation » —
c'est ce qu'était une analyse à charge qui ne rouvre pas les fichiers) ; `METHODO_PLAN.md` (marqueurs
`[VÉRIFIÉ]`/`[INFÉRÉ]` obligatoires — la ligne module 3 exo n'avait **aucun** marqueur, donc se lisait
comme un fait). Mémoire `feedback_ticket_content_not_authoritative` (« revérifier le code avant
d'agir ») : la leçon existait, appliquée aux tickets, **pas** appliquée à ROADMAP.

**Le vrai problème (pas l'instance).** Copier une contrainte d'un doc de planification vers un autre
**blanchit l'inférence en fait**. Amplifier une affirmation héritée (ajouter « migration », « gate »,
un niveau de risque) est une erreur composée, pire que la répéter.

**Coût si non corrigé.** Module 3 séquencé avec un « sous-module serveur + migration » fantôme : soit
une migration inutile écrite (dette de schéma pure, règles §5 lourdes), soit un cadrage jeté à
mi-parcours. Et tout l'arbitrage de risque/ordre en aval était calibré sur un faux « exo + serveur ».

**Ce qui change.**
1. **Avant de committer ce plan** : passe de vérification sur *chaque* affirmation technique non
   marquée `[VÉRIFIÉ]` — rouvrir le fichier, marquer `[VÉRIFIÉ]` ou rétrograder en `[INCONNU]`.
2. **Règle permanente** : une contrainte reprise d'un autre doc / de la mémoire / d'un ticket / d'un
   plan antérieur n'entre dans un plan **qu'avec sa propre vérification code**, jamais par copie.
3. Les prochaines analyses à charge de ce chantier **rouvrent les fichiers cités**, pas seulement la
   structure du plan.
4. `[INCONNU]` explicite posé sur le seul point non vérifié restant (§12.5 : la résolution lit-elle
   `state_position` exo).

**Passe de vérification du plan (2026-08-29, avant commit) — corrections appliquées :**

| Affirmation | Annoncé | `[VÉRIFIÉ]` 2026-08-29 | Action |
|---|---|---|---|
| État inline PJ / GM | 27 / 21 `useState` | **25 / 20** (+3 / +6 `useRef`) | corrigé §2.1, §11-r4-10, §12 |
| Migration serveur module 3 | « oui, exo » (§6) | **aucune** (persistance générique) | §6 réécrit |
| Couleurs en dur (9 fichiers) | ~290 (GM 108…) | **~260** (GM 94, PJ 56, Melee 33, Assault 25…) | corrigé §5.3, §8, §11-r4-1 |
| Fichiers `*.test.mjs` | 126 / « ~98 » | **127** (en croissance) | harmonisé §5.4, §5.4-M0.0 |
| Bouton de pied MJ « DÉCLARER » en dur | dette ouverte | **B1 corrigé** (`:1056`, `t(…)`) | §2.1 mis à jour |
| Bouton exo « Declarer » sans accents | dette | **B2 corrigé** (`"Déclarer l'action"`) | §2.1 mis à jour |
| `grep -i assaut combat.json` | — | **vide** | B3 confirmé complet (combat.json) |
| Tokens `index.css` : `--combat-{pj,pnj,drone}-*` triplets, pas de `--combat-exo-*`/`--combat-accent-*` | affirmé | **confirmé** (l.157-165) | inchangé |
| Export DS `temp/wizard/` non chargé par l'app | affirmé | **confirmé** (0 import ; `temp/` gitignoré) | inchangé |
| Briques `CombatDeclare*` (5 fichiers) | listées | **confirmé** (ErrorBanner, IniWidget, Log, StateChip, StateSelector) | inchangé |
| Sections `AssaultRangedPanel` (Arme / Nb tirs / Cible(s) / Type de tir / Mode CC-RC-RL / Localisation) | affirmé | **confirmé** (376 l.) ; `MeleeCombatPanel` 400 l. | inchangé |
| Roster MJ non cliquable | `[VÉRIFIÉ]` | **confirmé** (`S.rosterRow`, aucun `onClick`) | inchangé |
| Serveur accepte déclaration vide (`{}` passe, clés validées si présentes) | `[VÉRIFIÉ]` | **confirmé** (`socketCombatAnnouncement.js:63-79`) | inchangé |
| Golden master 4 familles | 51 tests | **51/51 vert** ce jour | inchangé |

### Round 6 (2026-08-29 — Saar corrige le cadrage du module 3 : les axes d'état exo)

**Fait.** §14.3 affirmait « `[VÉRIFIÉ]` `EXOARMURE.md` : posture exo = {standing, prone} seulement,
pas de crouch/kneel, `weapon` ne s'applique pas → l'exo n'a probablement pas de satellite ». **Faux.**
Saar : *« l'exo-armure a un satellite : position DEBOUT/COUCHÉ/ACCROUPI/GENOU, arme AU CLAIR/MAIN
SUR L'ARME/RANGÉE… à moins que tu me trouves le texte RAW qui dit l'inverse »*. Vérifié :
- `POSITION_TRANSITION_COST` (RAW `REGLESYSCOMBAT.md:929-941`) = les 4 postures, et `PLAN_EXOARMURE.md`
  §9 dit qu'elle s'applique **telle quelle** à l'exo.
- `ROADMAP.md` §1 point 4 **listait déjà explicitement** « arme rangée/au clair, position
  accroupi/genou » pour l'exo.
- `REGLEARMURE.md` p.323-329 relu ligne à ligne : **aucune** restriction de posture ni d'état d'arme
  (seules restrictions exo : 1 Attaque/Tour, milieu inadapté → allure lente, Intégrité 0 → détruite).

**Mécanisme de la faute — identique au round 5.** Inférence tirée du *silence* d'un doc `SYSTEME`
(`EXOARMURE.md` ne parle de posture exo que pour « se relever ») → conclusion « ça n'existe pas »,
marquée `[VÉRIFIÉ]`. Et `ROADMAP.md` §1.4, qui contredisait frontalement, **pas relu** au moment
d'écrire §14.3. Deux tours après avoir écrit la règle « ne pas blanchir une inférence », re-fait.

**Ce qui change (au-delà de §14.3 corrigé).** La règle
[[feedback_no_laundering_inherited_claims]] est renforcée : **« un doc qui ne mentionne pas X » n'est
jamais une preuve que « X n'existe pas »** — pour une question de règle, vérifier l'extrait RAW
(`REGLE*.md`) **et** `ROADMAP`/`VOCABULARY`, pas seulement le doc `SYSTEME` du domaine. Marqueur
`[VÉRIFIÉ]` interdit sur une conclusion négative tirée d'une absence de mention.

---

## 12. Cadrage M0.4 / PO6 — mutualiser l'état de déclaration PJ ↔ MJ-PNJ

> Demandé par Saar (2026-08-28) : « je n'ai pas le niveau technique pour estimer les répercussions,
> documente ce point pour un choix éclairé ». Lecture faite ce jour, intégrale : `CombatActionWindow.jsx`
> (1580 l., 25 états), `CombatGmDeclareWindow.jsx` (1192 l., 20 états), `CombatExoActionWindow.jsx`
> (442 l.), `declarationReducer.js`, `useDroneDeclare`/`useExoDeclare`, `socketCombatAnnouncement.js`,
> `characterStateService.js`.

### 12.1 En clair

Les fenêtres joueur et MJ font le même geste (déclarer Tir / Corps à corps / Déplacement) mais
**chacune reconstruit sa propre machinerie de sélection** — ~200 lignes quasi identiques copiées dans
les deux fichiers. Preuves que la copie coûte : le combat à deux armes (COM24) implémenté deux fois ;
le bug de réinitialisation entre tours corrigé deux fois le même jour (2026-08-28) ; l'éligibilité du
Tir visé câblée deux fois.

Question : au module 4, on **fusionne cette machinerie dans un module commun**, ou on **laisse chaque
fenêtre avec la sienne** et on ne partage que l'apparence ?

### 12.2 Ce qui est vraiment commun / vraiment différent  `[VÉRIFIÉ]`

| | Commun (même forme, même sens) | Différent — à préserver |
|---|---|---|
| État tactique | `decl` + `declarationReducer` — **déjà** partagé | — |
| Sous-état Tir | `assault*`, `isDualWield`, `aim*`, `aimedLocation` — jeu identique, mêmes calculs (`computeFireVariant`, `getAim*`) | — |
| Sous-état CaC | `melee*Count`, `selected*MeleeWeaponId`, `*NaturalWeaponId`, `isDualWieldMelee` — jeu identique | — |
| Assemblage payload | **déjà** extrait (`buildHumanDeclarePayload` / `buildGmDeclarePayload`, module 0) | `move` brut vs `ini_mod:0` forcé ; bonus `0` vs `null` (figés + testés) |
| Réinitialisation tour/slot | logique quasi identique (`prevHasAnnouncedRef` + reset ~15 états) — **dupliquée** | — |
| Acquisition des données | — | PJ : fetch par token actif (`/inventory`, `/mutations`, allures locales). MJ : **batch** `/combat-equipment` tous PNJ, indexé tokenId. Formes ≠ (`allInventoryItems[]` vs `equipment[tid].weaponMg`) |
| Modèle de sélection | — | PJ : `Set` multi-tuiles. MJ : booléens dérivés + `mapAction` (reload seul) |
| Flux de ciblage | — | PJ : `inTargetMode`/`inMeleeTargetMode` + `handleChooseTarget(i)`. MJ : `isSelectingOnMap` (conflate) + chaîne récursive `selectNext` + refs `isMountedRef`/`*CountRef` (StrictMode) |
| Charge | — | PJ : `moveSelection` + cible dans `meleePendingTokenIds`. MJ : objet composite `chargeSelection:{move,targetTokenId}` |
| Pilotage | — | PJ : multi-phases (surprise, résolution mon tour / pas mon tour, attente, déjà déclaré). MJ : navigation de slots + preview live `pjPreview` + bouton « Passer » |

**Lecture** : le partageable = **sous-état Tir** + **sous-état CaC** (+ réinitialisation). Le reste
diverge pour de bonnes raisons et doit le rester.

### 12.3 Options

- **A — hook `useHumanDeclare(mode: 'pj' | 'gm-pnj')`** (option d'origine du plan). Tout l'état de
  déclaration dans un hook, `mode` bascule la source de données et quelques comportements.
  *Contre* : la doc React officielle le déconseille — « beaucoup d'arguments = à refactorer », « Hook
  difficile à nommer = trop couplé pour être extrait » (react.dev, *Reusing Logic with Custom Hooks*).
  Ici PJ et MJ divergent sur l'acquisition de données, le pilotage, le flux de ciblage, la forme de
  la Charge : le hook porterait tout ça derrière des `if (mode === …)`. ~400 lignes, testable
  seulement via React, « le fichier que personne ne veut toucher ».
- **B — `CombatDeclareActionList` purement présentationnel** (autre option du plan). Liste = props,
  aucun état ; chaque fenêtre garde le sien.
  *Contre* : la copie de ~200 lignes (Tir + CaC + reset) **reste dans les deux fenêtres** —
  exactement la douleur actuelle. Réorganise l'affichage, n'aggrade pas la structure.
- **C — deux hooks de domaine, sans `mode`** : `useAssaultDeclaration({ weapons, … })` +
  `useMeleeDeclaration({ weapons, … })`. Chacun tient **une** tranche cohérente que les deux fenêtres
  dupliquent ; on leur passe les données en paramètre (l'appelant décide batch ou par token). Cœur
  de décision (validité, comptes effectifs, exclusivités) en fonctions pures `.mjs` — patron
  `buildDeclarePayload`. Les fenêtres gardent `decl`, fetch, pilotage, flags de ciblage. Aucun `mode`.
  *Pour* : direction déjà prise par le code (`useDroneDeclare`/`useExoDeclare` = hooks par domaine,
  pas `useDeclare(mode)` ; `useAutoMoveMode`/`useCombatClickAttack` = partagés sans mode). Tue la
  vraie duplication. Chaque hook nommable + responsabilité unique (le test react.dev de « prêt à
  extraire »). Golden master du module 0 garde déjà la sortie.
  *Contre* : 2 hooks au lieu d'1 ; la frontière sous-état / flux-de-ciblage doit être propre — à
  prouver au cadrage du module 4 (la chaîne récursive `selectNext` du MJ = le point délicat).

Sources : [react.dev — Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)
(« si un Hook prend beaucoup d'arguments… le refactorer » ; « difficile de nommer = pas prêt à
extraire ») ; [patterns headless / logique découplée de l'UI, ITNEXT](https://itnext.io/decoupling-ui-and-logic-in-react-a-clean-code-approach-with-headless-components-82e46b5820c) ;
[anti-patterns Hooks, dev.to](https://dev.to/justboris/popular-patterns-and-anti-patterns-with-react-hooks-4da2).

### 12.4 Recommandation

**Option C**, logique de décision non triviale sortie en fonctions pures testées `.mjs`. **Rejeter A**
(sur la foi de la doc React). B ne fait pas le travail.

Séquence proposée : **module 2 (châssis) → module 3 (satellite) → M0.4 = extraction
`useAssaultDeclaration` + `useMeleeDeclaration` + reset commun (tests verts) → module 4 (liste — ne
fait que consommer + rendre) → module 5 (pied)**. M0.4 juste avant son consommateur, pas avant les
modules purement visuels (rien ne change à l'écran, validation navigateur en aveugle).

### 12.5 Correctif au plan — le satellite exo ne demande PAS de migration  `[VÉRIFIÉ]`

`socketCombatAnnouncement.js:810-829` persiste `state.position/weapon/fire_mode/cover/vitesse/
combat_mode` **génériquement, pour tout type de personnage, exo compris** ; `setCharacterState`
(`characterStateService.js`) est agnostique au type ; `combat_roster.state_*` et `character_states`
existent déjà. Aujourd'hui `CombatExoActionWindow` envoie `state: {}` → rien n'est persisté, mais **le
chemin d'écriture est déjà là**. Le satellite exo (module 3) est donc :
(a) **client** : câbler `CombatDeclareStateChip`, envoyer un `state` peuplé ;
(b) **cadrage règles** (pas migration) : quels axes une exo a vraiment (RAW — « arme rangée / au
clair » n'a probablement aucun sens pour une exo ; accroupi/genou : ça modifie quelque chose à la
résolution ?).
La mention « + le serveur » de `ROADMAP.md` §1 point 4 est surévaluée. **Reste `[INCONNU]`** (non
vérifié) : est-ce que la phase RÉSOLUTION *lit* `state_position` exo pour un malus de posture, et le
RAW le veut-il ? Portée bornée — « lecture + éventuellement quelques lignes », **catégoriquement pas
une migration**. Genèse de la fausse contrainte : §11 round 5.

### 12.6 Glyphes (Q6, vérif demandée)  `[VÉRIFIÉ]`

12 glyphes examinés (`stand/crounch/kneel/crawl`, `contact/distance`, `WeaponA/B/C`,
`actionNormal/Delayed/Rush`). `crawl.svg` avait le tracé hors `viewBox` (démarrage `x = -25.76`) —
**Saar a ajouté un `<clipPath>` (2026-08-29)** : l'overflow ne peint plus hors du cadre ; reste à
juger visuellement si la figure est bien centrée dans le `0 0 48 48` (jugement Saar, il a le rendu).
Les 11 autres tiennent dans `0 0 48 48`. Deux styles de fichier coexistent (Inkscape multi-lignes vs
compact mono-ligne) — sans impact en `mask-image` (seul l'alpha compte). Rien à intégrer en dur :
`mask-image: url(/assets/status/x.svg)` recoloré à l'accent (D10), fichiers laissés dans le répertoire.

---

## 13. Cadrage Module 2 — `CombatDeclareFrame` (châssis partagé)

> Cadrage 2026-08-29. Lecture faite : `useDraggable.js`, `index.css` l.1533-1658 (`.combat-win*`) +
> l.1846-1912 (`.combat-float-*`), `ChangelogPanel.jsx` (motif PCB), `CombatOverlay.jsx` l.153-260
> (montage des 3 fenêtres), les 3 fenêtres (déjà en §12). **Aucun code — cadrage seul.**
> Analyse à charge dédiée = tour suivant (checkpoint : plan / analyse à charge / code séparés).

### 13.1 Responsabilité du module 2

Extraire **le châssis externe commun** aux 3 fenêtres de déclaration en un seul composant
`CombatDeclareFrame` : conteneur + classe CSS unique + `useDraggable` + largeur/opacité/position +
header (titre + poignée de drag) + emplacement satellite + emplacement pied + bannières. **Ne touche
pas** : le contenu du corps (liste d'action = module 4), le satellite lui-même (module 3), le pied
lui-même (module 5), aucun état de déclaration, aucun payload. JSX/CSS uniquement → golden master du
module 0 en filet.

### 13.2 État des lieux `[VÉRIFIÉ]` — les 3 châssis actuels

| | `CombatActionWindow` (PJ/drone) | `CombatGmDeclareWindow` (MJ) | `CombatExoActionWindow` (exo) |
|---|---|---|---|
| Classe racine | `.combat-float-win` | `.combat-win` | `.combat-float-win` |
| Tokens CSS | `--bg-session-raised` / `--border-session-2` (génériques session) | **`--combat-body/header/border/title/section`** (palette combat dédiée) | `--bg-session-raised` / `--border-session-2` |
| Position | inline `position: fixed`, `left/top` de `useDraggable` | inline `left/top` de `useDraggable` (pas de `position` — `.combat-win` = `absolute`) | inline `position: fixed` |
| Largeur | inline `360` → `720` (panneau droit) | inline `440` → `720` | inline `340` |
| `max-height` | inline `calc(100vh - 80px)` | CSS `.combat-win` `calc(100vh - 100px)` | inline `calc(100vh - 80px)` |
| Header | `.combat-float-header` (bg `--bg-session-raised`) | `.combat-win-header` (bg `--combat-header`) + **poignée basse** `S.bottomHandle` (2ᵉ zone de drag) | `.combat-float-header` |
| Titre | enfant texte direct | `.combat-win-title` (cyan `--combat-title`) + `S.headerActiveToken` (nom PNJ) + `S.headerProgress` (`n/n`) | enfant texte `t('exoActionWindow.title', {name})` |
| Corps | `.combat-win-body` (flex row) | `<div style={{display:flex,flex:1,minHeight:0}}>` | `.combat-win-body` + panneau interne `S.panel` |
| Pied | `.combat-float-footer` | `.combat-win-footer` (bg `--combat-header`) | `.combat-float-footer` |
| Masquage (ciblage) | inline `opacity` + `pointerEvents` | idem | idem |
| `useDraggable` clé | `combat-action-pos` | `combat-gm-declare-pos` | `combat-exo-action-pos` |

**Divergences réelles à absorber :** 2 familles CSS (session vs combat), la poignée basse MJ, le
bloc titre MJ enrichi (nom + progression), `.combat-win` en `absolute` vs `fixed`. ~~Choix proposé :
adopter la palette combat dédiée `--combat-*`.~~ **→ révisé par l'analyse à charge §13.11 point 5 :
réutiliser `.combat-float-win` existant (2 fenêtres sur 3 déjà dessus), MJ bascule dessus — 1 fenêtre
change de famille, pas 3.**

### 13.3 API cible `CombatDeclareFrame`

> Visuel de base = `.combat-float-win` réutilisé (§13.11 pt 5), pas une classe neuve.

```
<CombatDeclareFrame
  family="pj" | "gm-pnj" | "drone" | "exo"   // → data-family → --combat-accent-*
  storageKey="combat-declare-pj"              // useDraggable (clés existantes conservées)
  defaultPos={{ left, top }}
  width={360}                                 // largeur courante (le call site calcule 360/440/720)
  title={<>…</>}                              // ReactNode : texte simple OU bloc enrichi MJ
  hidden={isHidden}                           // opacity 0 + pointer-events none
  banner={mortalWoundBanner || null}          // au-dessus du corps, sous le header
  satellite={<CombatDeclareStatePanel …/> || null}   // module 3 ; RENDU COMME FRÈRE positionné à
                                                     // partir de `pos` (pas enfant — overflow:hidden), §14.5
  footer={<CombatDeclareFooter …/> || null}   // module 5
>
  {corps}                                     // module 4 (ou <p>message</p> pour les états simples)
</CombatDeclareFrame>
```

- Le frame **possède** `useDraggable` (plus dans chaque fenêtre) et rend la poignée de drag sur le
  header. Poignée basse MJ : à conserver comme option `bottomHandle?` ou à abandonner — **PO-M2-a**.
- `satellite={null}` → pas de boîte satellite rendue (drone, et tous les états non-déclaration).
- `footer={null}` → pas de barre de pied rendue (états non-déclaration sans action).
- `hidden` remplace les 3 recopies inline de `opacity/pointerEvents`.
- Le frame ne connaît **aucun** état métier — il ne sait pas ce qu'est la surprise ou la résolution.

### 13.4 États non-déclaration à héberger  `[VÉRIFIÉ]`

`CombatGmDeclareWindow` et `CombatExoActionWindow` **retournent `null`** hors de leur tour → rien à
héberger côté MJ/exo (le corps a juste 2-3 variantes internes : PNJ / drone / attente-PJ pour le MJ,
prone / normal pour l'exo — contenu du corps, pas du châssis).

`CombatActionWindow` reste montée en permanence et rend **6 états « message »** distincts, chacun =
`<CombatDeclareFrame family="pj" title=… footer={…|null} satellite={null}><p>…</p></…>` :

| # | Condition | Titre (clé i18n) | Contenu |
|---|---|---|---|
| 1 | `pendingSurpriseRoll` pour un de mes tokens | `actionWindow.surpriseTitle` | texte + **bouton** « lancer le dé » (→ `footer` ou corps) |
| 2 | `is_surprised && has_announced && initiative === 0` | `actionWindow.surpriseTitle` | `surprisedCannotAct` |
| 3 | `isMyTurnInResolution` | `actionWindow.resolutionPhaseShort` | liste d'actions + pied variable (attente MJ / recharger / bouton Agir) |
| 4 | ANNONCE, pas mon tour, pas encore déclaré | `actionWindow.declarationPhaseTitle` | `awaitingPlayer` |
| 5 | RÉSOLUTION, pas mon slot | `actionWindow.resolutionPhaseTitle` | `tokenActing` / `resolutionInProgress` |
| 6 | `has_announced` (ANNONCE) | `actionWindow.declarationPhaseTitleAlt` | `actionDeclaredWaiting` |

→ le frame doit rendre **proprement** avec `footer={null}` **et** avec un `footer` non trivial (cas 1
et 3). Aucun nouveau composant pour ces 6 états — juste le frame + un enfant. Le roster PJ
(`rosterSection`, présent « dans tous les états » selon le code) : à décider s'il passe dans le frame
ou reste un enfant du corps — **PO-M2-b**.

### 13.5 Tokens d'accent (D3/D4) — `--combat-accent-*` + `--combat-exo-*`  `[VÉRIFIÉ]`

`index.css` a déjà (l.157-165) : `--combat-pj-{fg,bg,border}` (#50c878 vert), `--combat-pnj-*`
(#c86030 orange), `--combat-drone-*` (#30aaaa teal). **Absent** : `--combat-exo-*`, `--combat-accent-*`.

Module 2 ajoute (le sélecteur = `.combat-float-win[data-family]`, pas de classe neuve — §13.11 pt 5) :
```
:root {
  --combat-exo-fg: #9858c8; --combat-exo-bg: #140a1e; --combat-exo-border: #9858c8;
  /* --combat-exo-bg : [INFÉRÉ], à valider à l'œil par Saar (§13.11 pt 5) */
}
.combat-float-win[data-family="pj"]     { --combat-accent-fg: var(--combat-pj-fg);   … }
.combat-float-win[data-family="gm-pnj"] { --combat-accent-fg: var(--combat-pnj-fg);  … }
.combat-float-win[data-family="drone"]  { --combat-accent-fg: var(--combat-drone-fg);… }
.combat-float-win[data-family="exo"]    { --combat-accent-fg: var(--combat-exo-fg);  … }
```
**Module 2 se limite à *définir* ces tokens** (+ les consommer sur le châssis : bordure de fenêtre,
accent du header). La conversion des `#5b8dee` / `rgba(91,141,238,*)` (« bleue parasite », D3) →
`var(--combat-accent-*)` vit dans le **corps** des fenêtres → sous-objectif des modules **3/4/5**,
pas 2 (§13.11 pt 3). La conversion hex→token complète (~260 occ.) reste hors périmètre (§8).
`data-family` en **attribut** (PO1 tranché : pas de classe `.combat-fam-*`).

### 13.6 Motif PCB (D14)  `[VÉRIFIÉ]` `ChangelogPanel.jsx`

Changelog : `<svg style={{position:absolute,inset:0,opacity:0.22}} preserveAspectRatio="slice">` avec
`<pattern>` de pastilles + 4 `<path>` de pistes + pastilles + 2 rectangles, couleur `ACCENT`.
Décisions D9/D14 : **discret** (opacité < 0.22, viser ~0.10), **header + pied + satellite
uniquement** (pas le corps). → petit composant `<CombatPcbBackdrop />` (svg absolu, `pointer-events:
none`, `currentColor` piloté par `--combat-accent-fg` ou `--combat-dim`), monté dans ces 3 zones.
Détail d'implémentation, pas un point ouvert (D14).

### 13.7 PO7 — les 4 gardes de montage `CombatOverlay.jsx`  `[VÉRIFIÉ]`

Phase ANNONCE, 4 conditions (l.198/215/234/254) : GM+exo → `CombatExoActionWindow` ; GM+non-exo →
`CombatGmDeclareWindow` ; joueur+exo actif → `CombatExoActionWindow` ; joueur sinon (+ RÉSOLUTION) →
`CombatActionWindow`. Se lisent en escalier avec des négations croisées (`!(isActiveExoForPlayer &&
ANNOUNCEMENT)`). **Décision : laisser tel quel pour le module 2** — le frame ne change pas *quelle*
fenêtre monte, seulement leur châssis interne. Nettoyage en table = valeur faible, hors périmètre
(peut se faire au module 5 si un fichier le rend trivial).

### 13.8 Risque + rollback

**Risque élevé** — structure externe des 3 fenêtres réécrite (leur `return (…)` de premier niveau).
Atténuations : (1) JSX/CSS seul, payload et `handleDeclare` intacts → `npm test` (golden master 51
tests) casse à toute régression de sortie ; (2) `vite build` + comparaison eslint baseline
`git stash` avant/après (patron modules 0) ; (3) un commit par fenêtre migrée (`CombatDeclareFrame`
neuf + `CombatActionWindow` d'abord, puis MJ, puis exo) — `git revert` du commit = rollback. Pas de
feature flag (§6).

### 13.9 Hors périmètre module 2

- Le satellite (module 3), la liste d'action (module 4), le pied (module 5) — le frame n'expose que
  des *slots* vides pour eux.
- La conversion hex→token complète des panneaux (§8).
- Le nettoyage des 4 gardes `CombatOverlay` (§13.7).
- Toute fusion d'orchestrateurs (REWORK-05).
- `.combat-win` (MJ) : le MJ bascule sur `.combat-float-win`, mais **les autres consommateurs de
  `.combat-win`** (RÉSOLUTION : `CombatModifiersWindow`, `CombatDamageWindow`…) **ne sont pas
  touchés** — `.combat-win` reste défini pour eux. Le frame réutilise `.combat-float-win` (+ éventuels
  ajouts ciblés `[data-family]`), pas de classe neuve à recaler (§13.11 pt 5).

### 13.10 Points ouverts du module 2

| # | Question |
|---|---|
| PO-M2-a | Poignée de drag basse du MJ (`S.bottomHandle`) : la garder comme `bottomHandle?` du frame (pour tous ?) ou l'abandonner (header seul, comme PJ/exo) ? |
| PO-M2-b | Roster PJ (`rosterSection`, « présent dans tous les états ») : slot dédié du frame, ou enfant du corps géré par la fenêtre ? |
| PO-M2-c | ~~`fixed` ou `absolute` ?~~ **Tranché `[VÉRIFIÉ]`** : `CombatOverlay` `styles.overlay` = `position: fixed; inset: 0; zIndex: 1000`. Donc `absolute` (contre l'overlay) et `fixed` (contre le viewport) rendent à l'identique. Le frame prend **`position: absolute` porté par la classe** (comme `.combat-win`), plus de `position` inline. |
| PO-M2-d | `max-height` : `calc(100vh - 80px)` (PJ/exo) ou `- 100px` (MJ) ? Unifier à une valeur. |
| PO-M2-e | Largeur dynamique 360/440/340 → 720 : le call site passe `width`, ou le frame prend `baseWidth` + `expanded` bool et connaît la valeur 720 ? (le 720 « panneau droit » disparaît au module 4 avec la col. 2 — anticiper ou pas ?) |

### 13.11 Analyse à charge du module 2 (2026-08-29)

Revue critique du cadrage §13.1-13.10, faite comme étape distincte (checkpoint).

**1. `CombatDeclareFrame` possède `useDraggable` — risque des retours anticipés `[VÉRIFIÉ]`.**
`CombatActionWindow` a **6 `return` avant son rendu principal** (§13.4). Si chacun retourne
`<CombatDeclareFrame>`, `useDraggable` (dans le frame) tourne à chaque état. React réconcilie sur le
type au même emplacement racine → instance préservée entre surprise → déclaration → résolution, la
position tient. **Mais** : le frame **doit être l'élément le plus externe de *chaque* chemin de
retour**, sans wrapper conditionnel autour. À écrire comme contrainte explicite dans le module.
Filet : `useDraggable` retombe sur `localStorage` même à un remount — dégradation gracieuse.

**2. Aucun test n'attrape une régression de module 2. `[VÉRIFIÉ]`** `tests/e2e/` = `smoke.spec.mjs`
seul, **zéro parcours de déclaration de combat**. Le golden master (module 0) teste le **payload**,
pas le châssis. Donc `useDraggable`, le prop `hidden` (masquage pendant ciblage), le header, les
slots : **rien ne les couvre** jusqu'à la validation navigateur « en bloc » de Saar — qui ne peut pas
bisecter un lot. → **un commit par fenêtre** (§13.8) devient non négociable, et le module doit
livrer un **checklist de vérification manuelle** (drag, masquage au ciblage, chaque état
non-déclaration, redimensionnement 360↔720) que Saar déroule à la fin, fenêtre par fenêtre.

**3. Le cadrage sur-vend le nettoyage `#5b8dee` du module 2.** §13.5 : « tout ce qui est `#5b8dee`
dans les fichiers que ce module touche déjà → `--combat-accent-*` ». Or module 2 ne touche que le
**châssis externe** — les `#5b8dee` sont dans le **corps** (`W.itemSelected`, `S.quickRowActive`,
roster actif, `AssaultRangedPanel`…), périmètre des modules 3/4/5. **Module 2 *définit*
`--combat-accent-*` et n'en convertit quasiment aucun.** Corrigé : le nettoyage `#5b8dee` est un
sous-objectif des modules **3/4/5**, pas 2.

**4. Ordre : module 2 est le plus risqué ET le moins visible.** Il réécrit la structure externe des
3 fenêtres (risque élevé, §13.8) pour un gain que Saar **ne verra presque pas** (unification de
châssis). Modules 3 (satellite) et 5 (pied) sont plus visibles et moins risqués. **Mais** 3 et 5
consomment les slots `satellite`/`footer` du frame → dépendance réelle. **Compromis retenu** :
module 2 d'abord, mais **réduit au strict minimum** (cf. point 5) ; 3 et 5 apportent le visible juste
après.

**5. Le cadrage crée une classe CSS neuve (`.combat-declare-frame`) et une nouvelle valeur
`--combat-exo-bg` inventée — sur-ingénierie pour un module « châssis ».** Reformulation :
- Le frame **réutilise le visuel `.combat-float-win`** existant (2 des 3 fenêtres l'utilisent déjà),
  pas une classe neuve. Le MJ **bascule dessus** (perd `.combat-win` / `--combat-header`). Une seule
  famille, celle qui existe déjà et couvre la majorité — moins de surface de régression qu'une
  classe neuve à recaler pixel par pixel. *(Contredit §13.2 « adopter la palette combat dédiée » —
  arbitrage : la palette `--combat-*` est « plus juste » mais bascule les 3 fenêtres au lieu d'1, ×3
  le risque visuel non testé. Le strict re-parentage `.combat-float-win` bascule 1 fenêtre.)*
- `--combat-exo-fg/border` = `#9858c8` (D3, validé). `--combat-exo-bg` : **`[INFÉRÉ]` `#140a1e`**
  (teinte violette très sombre, cohérente avec `pj-bg #0a1a0a` / `pnj-bg #1a0a08` / `drone-bg
  #081414`) — **à valider à l'œil par Saar**, pas à figer ici.
- `<CombatPcbBackdrop>` : garder l'idée, mais **module 2 le pose seulement sur le header** (une zone,
  un test). Pied et satellite le reçoivent à leurs modules respectifs (5 et 3).

**6. Poignée basse MJ (PO-M2-a) — `[VÉRIFIÉ]` genèse.** Ajoutée Session 118 (commit `02aee6f`,
« poignées basses », pass d'ergonomie COM15) — délibérée, pas un accident. La retirer = régression
UX mineure assumée. **Reco : la garder** comme `bottomHandle` optionnel du frame, activé pour les
3 (gratuit une fois le frame en place, cohérent).

**7. REACT.md P58 — pas de conflit `[VÉRIFIÉ]`.** P58 : « les 3 fenêtres restent des orchestrateurs
séparés — la fusion GM + Joueur est rejetée ». Le frame est du **châssis**, pas du pilotage ; P58
liste déjà les briques `CombatDeclare*` et nomme le frame comme « chantier design séparé ».
`CombatDeclareFrame` s'ajoute à la table des briques de P58 à la clôture.

**Conclusion — le module 2 se fait, révisé :**
- Frame = **wrapper structurel minimal** réutilisant `.combat-float-win` ; MJ bascule dessus (1
  fenêtre change de famille, pas 3).
- `--combat-accent-*` + `--combat-exo-*` **définis** ; conversion `#5b8dee` **repoussée aux modules
  3/4/5**.
- PCB sur le header seulement.
- `bottomHandle` conservé (option du frame).
- Contrainte Rules-of-Hooks : frame = élément le plus externe de chaque `return`.
- Livrable = code **+ checklist de vérif manuelle par fenêtre** (aucun filet automatisé, point 2).
- PO-M2-b / d / e restent à trancher au moment du code (décisions mineures, pas bloquantes).

---

## 14. Cadrage Module 3 — `CombatDeclareStatePanel` (satellite d'état, D8)

> Cadrage 2026-08-29. Lecture faite : `combatSections.js` (`STATE_DEFS`, `stateTransitionCost`,
> `nextKey`), `CombatDeclareStateSelector.jsx` + `CombatDeclareStateChip.jsx`, sections TACTIQUE /
> ARMEMENT des 3 fenêtres, `combat.json` `states.*`, `docs/SYSTEME/EXOARMURE.md` (posture exo).
> **Aucun code — cadrage seul.** Analyse à charge = tour suivant.

### 14.1 Responsabilité

Sortir les **sélecteurs d'état tactique** (posture, vitesse, arme) du corps des fenêtres vers un
**panneau satellite accroché au bord gauche** de la fenêtre principale, qui **suit sa position**
(D8 : « statut, pas actions — on ne les modifie pas souvent »). Présentation **glyphe** (D8/D10),
peu de texte. Neuf pour l'exo (aujourd'hui `state: {}`).
**Ne touche pas** : `fire_mode` (part en col. 2 au module 4, §14.7), la liste d'armes (module 4), le
pied (module 5), le calcul de coût INI (`STATE_TRANSITION_COST`, autorité serveur, intact).

### 14.2 État des lieux `[VÉRIFIÉ]` — les axes d'état

`STATE_DEFS` (`combatSections.js`) définit **5 axes** ; coûts de transition dans
`shared/combatIniCost.js` (`STATE_TRANSITION_COST`, partagé serveur) :

| Axe | Valeurs | i18n (`states.*`) | UI actuelle |
|---|---|---|---|
| `position` | standing / crouching / kneeling / prone | Debout / Accroupi / À genou / Couché | PJ : `StateSelector` (TACTIQUE) ; MJ : `StateChip` |
| `vitesse` | delayed / normal / rushed | Retardée / Normale / Précipitée | PJ + MJ : `StateSelector` (segmented — MJ délibérément, Session 158) |
| `weapon` | holstered / ready / drawn | Rangée / Prête / Au clair | PJ : `StateSelector` (ARMEMENT) ; MJ : `StateChip` |
| `fire_mode` | cc / rc / rl | — | PJ + MJ : `StateSelector`/`StateChip` (ARMEMENT) → **part au module 4** |
| `cover` | exposed / partial / important | Exposé / Partiel / Important | **aucun sélecteur nulle part** `[VÉRIFIÉ]` — non éditable joueur, hors satellite |

Les 2 briques (`StateSelector` segmented / `StateChip` click-to-cycle) partagent l'API
`{stateKey, current, initial, onChange, availableKeys}` et affichent le coût vs `initial`
(= `snapFromRosterEntry`, état en début de tour). Reversées au satellite : `initial` =
`initialStates.current[axe]` inchangé.

### 14.3 Contenu du satellite par famille

> **Erreur corrigée (Saar, 2026-08-29 — §11 round 6).** La version précédente affirmait
> « `[VÉRIFIÉ]` exo = {standing, prone} seulement, pas de crouch/kneel, pas de weapon ». **Faux** —
> inférence tirée du *silence* de `EXOARMURE.md` (qui ne parle de posture exo que dans le contexte
> « se relever »), alors que `ROADMAP.md` §1 point 4 **liste explicitement** « arme rangée/au clair,
> position accroupi/genou » pour l'exo, et que rien dans le RAW ne restreint. Même faute que le
> round 5. Modèle correct ci-dessous.

| Famille | Satellite |
|---|---|
| PJ | Posture (4) + Vitesse (3) + Arme (3) |
| MJ-PNJ | idem (le MJ garde Vitesse en segmented, Session 158 — à respecter dans la présentation glyphe) |
| Drone | **aucun** (D8 ; le drone envoie un `state` fixe) |
| Exo | **Posture (4) + Arme (3)** ; **pas de mode de tir** (fixe, `[VÉRIFIÉ]` `EXOARMURE.md:300` « dérivé de `exo_weapon.ref_fire_mode` ») ; Vitesse `[À CONFIRMER]` (Saar ne l'a pas listée — probable, mécanique INI générique) |

**Exo — `[VÉRIFIÉ]` :**
- **Posture** : les 4 (`debout / couché / accroupi / genou`). `POSITION_TRANSITION_COST`
  (`shared/combatStatePositionCost.js`, source RAW `REGLESYSCOMBAT.md:929-941`) s'applique **telle
  quelle** à l'exo — `PLAN_EXOARMURE.md` §9 : « continue de s'appliquer telle quelle à la
  Déclaration ». Toutes les transitions = perte d'Initiative standard, **sans Test**, **sauf**
  `prone → autre position` : coût standard (`-10`) **+ Test de Manœuvre d'armure du pilote**, avec
  écriture de `state_position` **différée à la Résolution** (déjà codé : `isExoStandUpAttempt`
  `socketCombatAnnouncement.js`, `resolveExoStandUpAction`, `handleStandUp` dans le corps de
  `CombatExoActionWindow`). Micro-écart à confirmer (§11 round 6) : le code fire le Test sur
  `prone → n'importe quelle position` ; le message Saar disait « couché vers debout » — son propre
  plan §9.2 dit « prone → autre position », donc = n'importe laquelle.
- **Arme** : les 3 (`arme au clair / main sur l'arme / arme rangée`). Aucune restriction RAW trouvée
  (`REGLEARMURE.md` p.323-329 relu : les seules restrictions exo sont « une seule Attaque/Tour »,
  milieu inadapté → allure lente, Intégrité 0 → détruite — rien sur la posture ni l'état d'arme).
- **Mode de tir** : fixe, dérivé de l'arme. **Jamais dans le satellite.**

→ **PO-M3-a** (reformulé) : quand l'exo est `prone`, la puce Posture du satellite **remplace-t-elle**
le bouton « Tenter de se relever » du corps (`handleStandUp`), ou coexistent-ils ? Et : passer par la
puce → `decl` → DÉCLARER (au lieu de l'`emit` immédiat de `handleStandUp`) préserve-t-il la propriété
« action exclusive / immédiate » du se-relever (§9 : rejet serveur si combiné à une attaque/un
déplacement — donc OK de passer par DÉCLARER tant que l'exclusivité tient) ?

### 14.4 Présentation glyphe (D8/D10)

D8 : « glyphes iconiques, peu de texte ». Les briques actuelles restent text-heavy (label + valeur +
coût). Le satellite veut : **glyphe** (`mask-image` d'un `assets/status/*.svg`, recoloré
`--combat-accent-fg`) + valeur courte + coût INI si ≠ 0.

Glyphes disponibles (D10, `[VÉRIFIÉ]` présents) : `stand`/`crounch`/`kneel`/`crawl` (posture),
`actionNormal`/`actionDelayed`/`actionRush` (vitesse), `WeaponA`/`WeaponB`/`WeaponC` (arme
rangée / main dessus / au clair). Mapping valeur→glyphe direct (PO5 : glyphe **reflète la valeur**,
Saar a produit les 4 postures → oui).

**Brique** : `[À TRANCHER]` **PO-M3-b** — nouveau composant `CombatDeclareStateGlyph`
(présentation dédiée) OU extension de `CombatDeclareStateChip` avec un mode `glyph`. Interaction :
clic = cycle (`nextKey`, comportement chip actuel) ? ou clic = déplie les options (4 postures =
cycle pénible) ? → **PO-M3-c**.

### 14.5 Mécanisme « le satellite suit la fenêtre » (PO3c)  `[VÉRIFIÉ]` aucun précédent

Grep : **aucune fenêtre de combat n'est accrochée à une autre** — chacune a son `useDraggable`
indépendant. Mécanisme neuf. Le frame (`CombatDeclareFrame`, module 2) **possède `pos`**
(`useDraggable`, décision module 2) → il rend le satellite comme **élément frère positionné**, pas
comme enfant (le frame a `overflow: hidden`, un enfant « à gauche » serait clippé) :

```
// dans CombatDeclareFrame :
{satellite && (
  <div style={{ position:'absolute', left: pos.left - SAT_W - GAP, top: pos.top }}>
    {satellite}
  </div>
)}
<div className="combat-float-win" data-family={family} style={{ left: pos.left, top: pos.top, … }}>
  … header / body / footer …
</div>
```

→ **raffine l'API module 2** : le prop `satellite` n'est pas un slot *dans* le châssis, c'est un
frère que le frame positionne à partir de son `pos`. Le `hidden` du frame masque les deux. Drag :
gratuit (le satellite lit `pos` à chaque rendu). Clamp bord d'écran gauche : si `pos.left - SAT_W < 8`,
le satellite passe à droite (`left: pos.left + windowWidth + GAP`) — **PO-M3-d**.

### 14.6 Exo — payload `state` + test de caractérisation

`CombatExoActionWindow.handleDeclare` envoie aujourd'hui `state: {}`. Avec le satellite il passe à
`state: { position, weapon, (vitesse?) }`. L'exo n'a pas de `declarationReducer` → **réutiliser
`declarationReducer` + `snapFromRosterEntry`** (déjà partagés, pas un mini-reducer maison — Règle 2).
`buildExoMapActions` ne couvre **que `mapActions`**, pas `state` → **ajouter `buildExoDeclareState(sel)`
pur + test de caractérisation** (patron module 0) figeant ce fragment neuf, **y compris le cas
`prone → autre` = `isExoStandUpAttempt`** (le client envoie `state.position`, le serveur diffère
l'écriture — le payload client, lui, est le même qu'une transition normale). Golden master PJ/MJ
non concerné (mêmes `decl.*`, mêmes `buildXDeclarePayload`).

### 14.7 Seam `fire_mode` (PJ/MJ : reste au corps jusqu'au module 4)

Module 3 retire **position + vitesse + weapon** du corps → satellite, **pour PJ et MJ**.
`fire_mode` **reste** dans la section ARMEMENT du corps (réduite à : liste d'armes équipées +
sélecteur `fire_mode`) jusqu'à ce que le module 4 le déplace en col. 2 (`AssaultRangedPanel` a déjà
« Section mode de tir »). Interim assumé. `decl.fire_mode` reste un champ du reducer tout du long
(le payload le lit). **Exo** : pas de `fire_mode` du tout (fixe), donc pas de seam — son corps
perd juste les sélecteurs qu'il n'avait pas (rien) et gagne le satellite.

### 14.8 Risque + rollback

**Risque moyen (client), + point exo.** PJ + MJ : déplace 3 sélecteurs du corps → panneau frère,
**pas de changement de forme de payload** (mêmes `decl.*` → mêmes `buildXDeclarePayload` → golden
master 51 tests en filet). **Exo** : satellite neuf (posture 4 + arme 3) + nouveau fragment `state`
au payload (14.6) + le fil `prone → Test` à recâbler proprement (PO-M3-a) — c'est le morceau le plus
délicat du module. Risque **visuel** partout : positionnement du satellite frère, pas de test → **un
commit par fenêtre + checklist manuelle** (comme module 2). Rollback : `git revert` par commit.

### 14.9 Hors périmètre module 3

- `fire_mode` (module 4, §14.7), la liste d'armes (module 4), le pied (module 5).
- `cover` : pas de sélecteur aujourd'hui, on n'en ajoute pas.
- Le recadrage des glyphes mal cadrés (Saar, hors code).
- La conversion hex→token générale (§8).
- Le calcul de coût INI (`STATE_TRANSITION_COST`, serveur).

### 14.10 Points ouverts module 3

| # | Question |
|---|---|
| PO-M3-a | **Exo `prone` : la puce Posture du satellite remplace-t-elle le bouton « Tenter de se relever » du corps** (`handleStandUp`), ou coexistent-ils ? Passer par `decl` → DÉCLARER (au lieu de l'`emit` immédiat) : OK tant que l'exclusivité serveur du se-relever tient (§14.3). |
| PO-M3-a2 | Vitesse pour l'exo : incluse au satellite ou non ? (Saar ne l'a pas listée — `[À CONFIRMER]`.) |
| PO-M3-b | Brique glyphe : `CombatDeclareStateGlyph` neuf, ou mode `glyph` sur `CombatDeclareStateChip` ? |
| PO-M3-c | Interaction : clic = cycle (`nextKey`) ou clic = déplie les options ? (4 postures = cycle long) |
| PO-M3-d | Clamp : satellite passe à droite si pas la place à gauche du bord d'écran ? |
| PO-M3-e | MJ Vitesse « segmented, 3 choix visibles » (Session 158) : comment le rendre en présentation glyphe sans reperdre les 3 choix d'un coup ? |
| PO-M3-f | Le satellite est-il draggable indépendamment (détachable) ou strictement collé ? D8 dit « accroché … se déplace avec » → strictement collé, `pos` du frame seul. |
