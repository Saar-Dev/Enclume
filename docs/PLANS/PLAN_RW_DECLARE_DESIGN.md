# PLAN_RW_DECLARE_DESIGN — Passe design des fenêtres de déclaration de combat

> **Statut : conception — aucun code.** 2026-08-28, **révisé le jour même après analyse à charge**
> (§11 : journal de la revue).
>
> **Responsabilité unique** (Règle 1, `docs/RegleDocumentaire.md`) : le **langage visuel unifié** et la
> **structure commune** des trois fenêtres de déclaration d'action en phase ANNONCE
> (`CombatActionWindow`, `CombatGmDeclareWindow`, `CombatExoActionWindow`). C'est la « passe de design
> dédiée » que `PLAN_RW_DECLARE_WINDOWS.md` (clos, archivé `docs/Old/`) a explicitement différée en
> annulant son module 5 (`CombatDeclareFrame`) et que `REACT.md` P58 note comme « chantier design
> séparé ».
>
> **Ne traite pas** : le refactoring client des orchestrateurs (fait, `PLAN_RW_DECLARE_WINDOWS`), le
> calcul métier (autorité `shared/combatIniCost.js` / `combatSections.js`, intact), le dispatch de
> résolution Tir/CaC serveur (`ROADMAP.md` §5), la phase RÉSOLUTION (fenêtres `CombatModifiersWindow`
> etc.) — **sauf la valeur i18n « Assaut » qui la traverse** (cf. lot B3).
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
| Bouton de pied | `t('actionWindow.declareActionButton')` | `DÉCLARER` (**texte FR en dur**, `CombatGmDeclareWindow.jsx:1085`) | `t('actionWindow.declareActionButton')` — valeur `"Declarer l'action"` (sans accents) |
| État inline | `useState`/`useReducer` : **27** (`CombatActionWindow`) `[VÉRIFIÉ]` | **21** (`CombatGmDeclareWindow`) `[VÉRIFIÉ]` | délégué à `useExoDeclare` |
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
| D10 | **Icônes = glyphes SVG produits par Saar** dans `client/public/assets/status/` : `stand`/`crounch`/`kneel`/`crawl` (posture), `actionNormal`/`actionDelayed`/`actionRush` (vitesse), `WeaponA`/`WeaponB`/`WeaponC` (arme rangée / main dessus / au clair), `contact` / `distance`. Chargés en `mask-image`, recolorés à l'accent. Certains exports ont une `viewBox` Inkscape mal cadrée (`stand`, `crawl`) — à recadrer à la source. |
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

## 5. Séquence — périmètre engageable vs. en attente

> **Analyse à charge round 2 (§11)** : le périmètre réellement engageable = **lot B + B5 + module 1**.
> Les modules 2-5 sont une **cible validée en attente d'un déclencheur explicite** (§5.4).

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

### 5.2 CHANTIER ISOLÉ (changement de comportement — sa propre analyse à charge)

**B5 — « Passer le tour » toujours déclarable.** `canDeclare` (humain PJ **et** MJ) n'exige plus
`stateChanged || hasAction` : un tour vide devient déclarable. Aligner exo (implicite → explicite via
le pied D12). **Changement de comportement combat** `[VÉRIFIÉ]` (`CombatActionWindow` `canDeclare`
l.642, `CombatGmDeclareWindow` l.415) — pas un nettoyage de texte, donc **sorti du lot B**. Cadrage +
analyse à charge dédiés : quels effets serveur sur un `state:{}` / `mapActions:{}` (`socketCombatAnnouncement.js`
laisse chaque `state_*` inchangé, `[VÉRIFIÉ]` via commentaire `CombatExoActionWindow.jsx:165`) ?
non-régression du flux normal ? Indépendant du reste — peut se faire avant ou après le module 1.

### 5.3 Module 1 — Réconciliation des tokens `--combat-*` (D4)

Un seul jeu canonique dans `index.css` ; `--combat-accent-*` + `data-family` ; `--combat-exo-*` ;
retrait des hex des objets `W`/`S` des `.jsx`. **Pas un quick win** (analyse à charge round 2) : passe
large et minutieuse sur ~6 fenêtres combat + `AssaultRangedPanel` / `MeleeCombatPanel` /
`DroneWeaponPanel`, chaque `W.xxx: { background: '#...' }` → `var(--combat-accent-*)`, **sans test
visuel** (INFRA-4). Un commit, `git revert` = rollback. Gain réel autonome : per-family accent visible
(drone teal, exo violet) + fin de la dette « 3 vocabulaires `--combat-*` ». À faire avec le soin d'un
module, pas d'un quick win. Risque : moyen.

### 5.4 EN ATTENTE — modules 2-5 (cible validée, déclencheur explicite requis)

**Analyse à charge §11 points 1 et 4** : les modules 2-5 refont la structure du **code combat le plus
joué et le moins couvert** (INFRA-4), pour un gain UX. `PLAN_RW_DECLARE_WINDOWS` a **différé** son
module 6 pour exactement ça. Critère `feedback_aggradation_criterion` : ils **n'aggradent pas la
testabilité**. Ils sont **gatés sur le module 0**, et le module 0 est lui-même **un virage de
philosophie de test transverse au projet** (`PLAN_RW_DECLARE_WINDOWS` §2.4 : Enclume teste des
fonctions pures en `node --test`, pas de composant). **Déclencheur pour rouvrir** : (a) backlog RAW
serveur nettement plus mince **et** (b) décision assumée d'investir dans les tests composant. D'ici là,
la maquette est le nord, pas un engagement.

**Module 0 — Infra de test composant.** Ajouter `vitest` + `@testing-library/react` (ou équivalent,
recherche des pratiques pro à faire), et **des tests de caractérisation** sur `CombatActionWindow` /
`CombatGmDeclareWindow` **avant** de les toucher (payload `COMBAT_ACTION_DECLARE` généré pour chaque
combinaison arme × mode × cas limite). C'est un **module à part entière, décidé explicitement** — pas
une note en bas de page. Sans lui, on ne démarre pas les modules 2-5.

**Décision préalable au module 4 (à trancher au cadrage du module 0/2, PAS pendant le module 4)** :
le partage de la logique « liste d'action » entre PJ et MJ-PNJ passe-t-il par un
`useHumanDeclare(mode: 'pj' | 'gm-pnj')` (source équipement : inventaire par perso vs batch ;
allures : fiche vs `DEFAULT_PNJ_ALLURES` ; slot unique vs séquentiel) — la « vraie cible » que
`PLAN_RW_DECLARE_WINDOWS` module 6 a nommée puis différée ? Ou le module 4 ne partage-t-il que le
**rendu** (`CombatDeclareActionList` présentationnel) et chaque fenêtre garde son état ?

**Module 2 — `CombatDeclareFrame` (chrome partagé).** Débloqué par le module 1. Props : `family`,
`storageKey`, `defaultPos`, `title`, `hidden`, `satellite?` (slot), `footer` (slot), `children` +
gestion des **états non-déclaration** (§4). Possède `useDraggable` + le chrome + masquage + le fond
PCB (D14). Une seule famille CSS (le module 1 lève le blocage B5 de `PLAN_RW_DECLARE_WINDOWS` :
on unifie par token). Risque **élevé** (structure externe des 3 fenêtres).

**Module 3 — `CombatDeclareStatePanel` (satellite, D8).** Composant neuf composant
`CombatDeclareStateChip`. **Côté exo : nécessite le serveur** (persistance `state_position` /
`state_weapon` exo, gate de résolution) — sous-module serveur explicite (`ROADMAP.md` §1 point 4).
Risque : moyen (client), moyen-élevé (exo + serveur).

**Module 4 — `CombatDeclareActionList` (liste groupée, D5/D6/D7/D9/D13).** Le cœur. Liste d'armes
groupée, sélection = bordure accent, Déplacement en ligne distincte, col. 2 = détail (`Tir | Recharger`,
`AssaultRangedPanel` / `MeleeCombatPanel` réagencés en colonne, silhouette 2 sous-colonnes). Absorbe
§4.1. Risque **très élevé** — **ne démarre qu'après le module 0** et la décision `useHumanDeclare`.

**Module 5 — Pied unifié (D12).** `CombatDeclareFooter` : pastille + statut + `Passer le tour` (ghost)
+ `Déclarer` (primaire, raison bloquante si `!canDeclare`). Consommé par les 3 (slot `footer` du
module 2). Dépend de B5 (le « Passer le tour » toujours disponible). Risque : faible-moyen.

---

## 6. Migration / rollback

- **Lot B + B5 + module 1** : chaque item est un commit isolé, **`git revert` suffit** (JSON, CSS,
  renommages, un one-liner). Aucun feature flag.
- **Modules 2-5** (si rouverts) : chaque module branché retire l'ancien code dans le même commit —
  **`git revert` du commit du module** est le rollback. **Pas de feature flag** (analyse à charge
  round 2) : cohabiter deux `CombatActionWindow` de 1500 l. pendant une transition = enfer de merge et
  double surface de bugs — remplacement franc, revert si régression.
- Aucun de ces modules ne touche un schéma DB **sauf** le sous-module serveur du module 3 (état exo) —
  migration rétrocompatible standard, cadrée à part.

---

## 7. Points ouverts

| # | Module | Question |
|---|---|---|
| PO1 | 1 | Iso-visuel strict au module 1, ou léger réalignement assumé des sélections (bleu `#5b8dee` → accent famille) ? `data-family` sur `CombatDeclareFrame` ou classe `.combat-fam-*` ? |
| PO2 | 4 | Col. 2 d'une arme de contact : modes de combat (Défensif / Charge / Retraite) en segments de tête ou sous-bloc ? Charge chaîne déplacement→cible — comment ? |
| PO3 | 2 / 4 | **Faisabilité non prouvée par la maquette** : (a) footprint écran satellite + col1 + col2 + sidebar + timeline sur un écran réel ; (b) `AssaultRangedPanel`/`MeleeCombatPanel` (sections 360 px, bordures internes) « réagencés » en col. 2 de 264 px = réagencement ou réécriture ? (c) satellite « suit la fenêtre » : wrapper draggable (change la prise) ou sync de position ? Col. 2 très haute pour un Tir complet → pied épinglé + corps scrollable, à confirmer et montrer. Transition entre armes = reset de la config précédente (à assumer). |
| PO4 | 0 | Quelle infra de test (vitest + RTL ? autre) ? Périmètre des tests de caractérisation avant de toucher au module 4 ? |
| PO5 | 3 | Satellite : glyphe qui **reflète la valeur** (Saar a produit les 4 glyphes de posture → plutôt oui) ou glyphe de catégorie + texte ? |
| PO6 | 4 | `useHumanDeclare(mode: 'pj' \| 'gm-pnj')` (partage état PJ + MJ) ou `CombatDeclareActionList` purement présentationnel (chaque fenêtre garde son état) ? À trancher **avant** le module 4. |
| PO7 | — | `CombatOverlay.jsx` : 4 gardes de montage ANNONCE — nettoyer en une table ou laisser ? (faible valeur) |

---

## 8. Hors-scope

- La phase RÉSOLUTION (fenêtres `CombatModifiersWindow`, `CombatCacModifiersWindow`,
  `CombatDamageWindow`, `CombatStunWindow`) — **sauf** la valeur i18n « Assaut » (B3).
- Le dispatch serveur Tir/CaC × PJ/PNJ/Drone/Exo (`ROADMAP.md` §5).
- La fusion des orchestrateurs (rejetée, REWORK-05 — on partage le châssis, pas le composant).
- Le calcul métier (`combatIniCost`, `combatSections`, allures) — intact.
- Migration TypeScript, nouvelle dépendance **hors** l'infra de test du module 0 (décidée
  explicitement).
- La barre d'action ancrée non-couvrante (style Argon Combat HUD) — très gros chantier, contraire au
  paradigme Enclume. Nommé pour mémoire, non ouvert.

---

## 9. Ce qui n'est PAS fait en V1 est aussi important

- On ne fusionne pas les orchestrateurs. Le MJ garde sa navigation séquentielle et sa preview.
- On ne réécrit pas `AssaultRangedPanel` / `MeleeCombatPanel` / `DroneWeaponPanel` — on les réagence
  (col. 2), sous réserve PO3.
- On ne touche pas au calcul d'Initiative ni au dispatch serveur.
- **Lot B (B1-B4) + module 1 + B5** est le périmètre engagé — vrais bugs, dette de tokens réelle,
  ne préjuge pas de la refonte. **Lot B codé le 2026-08-28** (§5.1).
- **Modules 2-5 sont en attente** (§5.4) — déclencheur explicite requis, pas juste le module 0.

---

## 10. Ordre recommandé

**Engagé :**
1. **Lot B** — ✅ **codé 2026-08-28** : `combat.json` (B2 + B3 + B4) + `CombatGmDeclareWindow.jsx` (B1) +
   `socketCombatAnnouncement.js` (swap « Assaut » → « Tir »). Validation navigateur en bloc à venir.
2. **Module 1** (tokens) — passe large et minutieuse, pas un quick win.
3. **B5** (chantier isolé) — quand Saar veut, avec son analyse à charge.

**En attente (§5.4) :** module 0 puis modules 2-5 — seulement sur déclencheur explicite.

La maquette reste la cible validée. On l'atteint quand le filet de sécurité existe.

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
10. **Chiffres non re-vérifiés** → `[VÉRIFIÉ]` : `CombatActionWindow` = 27 `useState`/`useReducer`,
    `CombatGmDeclareWindow` = 21 ; bouton exo = `t('actionWindow.declareActionButton')`.

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
