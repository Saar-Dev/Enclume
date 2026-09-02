# PLAN_LOCALISATION — Résorption du texte en dur (i18n)

> 2026-07-23 · Plan temporaire (Règle 10, `docs/RegleDocumentaire.md`) — sera archivé et fusionné dans
> `docs/ASBUILT.md` une fois clos.
> Norme durable : `docs/SYSTEME/LOCALISATION.md` + `.claude/rules/i18n.md`.
> Statut (2026-07-25) : 🟢 **Lot 1 (Combat, 17 fichiers) entièrement clos** — `combatSections.js`
> migré (Segments 1-7, §3bis) + texte propre à chacun des 17 fichiers (§3ter). Zéro texte en dur
> restant, confirmé par ré-audit.
> 🟡 **Lot 2 (Équipement/fiche personnage, 7 fichiers) codé et commité (`d6a21f4`), parcours navigateur
> non testé** — détail §3quater.
> 🟡 **Lot 3 (Builder/Surface, 6 fichiers) codé et commité (`211a523`), parcours navigateur non testé**
> — détail §3quinquies.
> 🟡 **Lot 4 (Outils dés, 1 fichier — `DiceCalibrationPage.jsx` exclu, décision Saar 2026-07-25) codé,
> parcours navigateur non testé** — détail §3sexies. **Les 4 lots sont maintenant codés** ; archivage
> de ce plan dans `docs/ASBUILT.md` différé jusqu'à validation navigateur complète.
> 🔴 **Lot 5 (contenu de catalogue `ref_*` en base, ~1630 lignes / 10 tables) découvert le 2026-08-11,
> hors du périmètre couvert par ce plan jusqu'ici — corrigé, voir §7. Architecture = colonnes JSONB
> `<champ>_i18n` (`docs/SYSTEME/LOCALISATION.md` §6 ; pratiques pro §7.12 ; adaptativité §7.13). Plan
> d'exécution + analyse à charge rédigés le 2026-09-02 (§7). Exécution non commencée — prochain geste :
> sous-lot 5.0 (migration unique + résolveur `refI18n.js` + swap des ~15 `select('*')` sur `ref_*`,
> commit isolé préalable au retrofit fin 5a→5g).**

---

## 0. Contexte

Demande Saar : la règle "pas de texte en dur" (`.claude/rules/react.md`) existe depuis un moment mais
n'a jamais été appliquée de façon systématique — dette déjà notée dans `docs/EN_COURS.md`
("i18n combat+équipement — 18 composants hors scope"). Objectif : inventaire réel, découpage en lots
vérifiables, un domaine à la fois (CLAUDE.md §6.8).

Anglais explicitement hors scope (décision Saar 2026-07-23, voir `docs/SYSTEME/LOCALISATION.md` §1) —
ce chantier ne touche que le FR.

---

## 1. Méthode d'audit

Deux passes, reproductibles :

```bash
# 1. Composants sans useTranslation
comm -23 <(find client/src -name "*.jsx" | sort) \
         <(grep -rl "useTranslation" client/src --include="*.jsx" | sort)

# 2. Parmi eux, ceux qui contiennent réellement du texte visible
grep -oE '>[A-Za-zÀ-ÿ][^<>{}]{2,}<|(placeholder|title|aria-label|alt)="[A-Za-zÀ-ÿ][^"]{2,}' fichier.jsx
```

État au 2026-07-23 : 105 fichiers `.jsx` dans `client/src`, 50 utilisent déjà `useTranslation`, 55 ne
l'utilisent pas. Sur ces 55, 32 contiennent au moins une occurrence de texte visible détectée par la
passe 2 (dette réelle) ; les 23 autres sont des composants de rendu 3D/géométrie/infra sans texte
utilisateur (vérifié, pas supposé — cf. §4).

---

## 2. Lots (dette réelle, 32 fichiers)

### Lot 1 — Combat (17 fichiers) → namespace `combat.json` (nouveau)

`CombatActionWindow`, `CombatRosterWindow`, `AssaultRangedPanel`, `CombatOverlay`,
`CombatModifiersWindow`, `CombatGmDeclareWindow`, `MeleeCombatPanel`, `CombatResultPanels`,
`CombatPnjPanel`, `CombatInitStateWindow`, `CombatDamageWindow`, `CombatCacModifiersWindow`,
`CombatTimeline`, `CombatStunWindow`, `CombatDeclareLog`, `DroneWeaponPanel`, `DroneDeclareSection`.

Le plus gros lot (le rôle combat concentre la majorité des fenêtres de déclaration/résolution). À
traiter avec `docs/SYSTEME/COMBAT.md` ouvert — certains libellés reprennent une terminologie Polaris
précise (`docs/VOCABULARY.md` à vérifier avant de nommer une clé).

### Lot 2 — Équipement / fiche personnage (7 fichiers) → namespace `charSheet.json`

`WeaponPanel`, `InventoryPanel`, `LocationPanel`, `ContainerPanel`, `ArmorWoundPanel`, `ModingWindow`,
`AimedLocationPicker`.

Zone signalée comme "legacy antérieure au rollout i18n" (`docs/EN_COURS.md`, Session 156, Lot C
Bouclier) — confirme que c'est la même dette, pas une nouvelle.

### Lot 3 — Builder / Surface (6 fichiers) → namespace `builder.json`

`SurfaceRoomPanel`, `SurfaceConnectorPanel`, `SurfaceWallPanel`, `SurfaceMaterialEditor`,
`MaterialGeneratorTab`, `Object3DPreview`.

### Lot 4 — Outils dés (1 fichier, décision Saar 2026-07-25) → `dice.*` dans `fr.json` (déjà une section)

`DicePanel`. `DiceCalibrationPage` (outil dev, jamais vu par un joueur/MJ en jeu) tranché **hors
scope** par Saar à l'ouverture du lot — reste en dur, décision définitive, pas une dette.

---

## 3. Migration des namespaces existants (préalable aux lots 1-3)

Avant le Lot 1, découper `fr.json` selon `docs/SYSTEME/LOCALISATION.md` §2.1 :

1. Créer `common.json`, `charSheet.json`, `builder.json` par déplacement des sections existantes
   (aucune clé renommée, juste redistribuée — pas de rupture pour les composants déjà traduits).
   Créer `combat.json` vide.
2. Mettre à jour `i18n.js` (`resources`) pour déclarer les 5 namespaces.
3. Pour chaque composant déjà migré vers un namespace non-défaut, ajouter
   `useTranslation('charSheet')` (ou `'builder'`) — recherche/remplace ciblé, pas de changement de
   comportement.
4. Vérifier build Vite propre + un scénario réel par écran touché (fiche perso, builder) avant de
   passer au Lot 1.

Ce préalable est un commit isolé, testable indépendamment des lots de retrofit.

**Écart réel vs plan initial** : la redistribution complète de `fr.json` (points 1/3 ci-dessus,
`common`/`charSheet`/`builder`) n'a **pas** été faite — jugée trop risquée en un seul geste (touche les
~50 composants déjà traduits, sans rapport avec Combat). À la place : `combat.json` créé comme
namespace neuf isolé (rien à redistribuer, aucun composant existant affecté), `i18n.js` mis à jour pour
le déclarer. La redistribution `common`/`charSheet`/`builder` est différée au moment où Lot 2/Lot 3
créeront réellement ces namespaces — décision prise en session, pas dans ce document au moment de sa
rédaction initiale.

---

## 3bis. Lot 1 — `combatSections.js`, migré par segments (2026-07-24)

Consigne Saar en cours de chantier : **un fichier (ou un morceau isolable) à la fois, pause entre
chaque** — même à l'intérieur d'un lot déjà approuvé. `combatSections.js` est un module de config
partagé par 7 des 17 fichiers du Lot 1 ; le migrer entièrement d'un coup aurait cassé l'affichage des
6 fichiers pas encore retouchés (clé brute au lieu du texte). Segmenté par export, du plus isolé au
plus partagé :

| Segment | Export migré | Consommateur(s) touché(s) | Statut |
|---|---|---|---|
| 1 | `MOVE_ZONE_DEFS` | `CombatOverlay.jsx` | ✅ |
| 2 | `COMBAT_MODE_DEFS` | `MeleeCombatPanel.jsx` | ✅ |
| 3 | `ACTION_LABELS` | `CombatDeclareLog.jsx` | ✅ |
| 4 | `RL_BUTTONS` (`CC_REPS_STEPS` : purement numérique, rien à traduire) | `AssaultRangedPanel.jsx` | ✅ |
| 5 | `STATE_DEFS` | `StateSelector` (`CombatActionWindow.jsx`, réutilisé par `CombatGmDeclareWindow.jsx`), `CombatInitStateWindow.jsx` | ✅ |
| 6 | `MAP_ACTIONS`, `QUICK_ACTIONS` | `CombatActionWindow.jsx`, `CombatGmDeclareWindow.jsx` | ✅ |
| 7 | `calcIniBreakdown`/`calcIniDelta` (fonctions pures — `t` injecté en paramètre, pattern documenté `docs/SYSTEME/LOCALISATION.md` §3.1) | `CombatActionWindow.jsx`, `CombatGmDeclareWindow.jsx` | ✅ |

`combatSections.js` est **entièrement** migré (plus aucune chaîne FR en dur dans ce fichier). Chaque
segment n'a touché, dans ses consommateurs, que les points de rendu directement issus de
`combatSections.js` — le texte en dur propre à chacun des 17 fichiers a été traité séparément (§3ter).

**Régression trouvée et corrigée en cours de route** : les premières clés (Segment 1) étaient
préfixées par erreur du nom du namespace (`combat.moveZones.lente` au lieu de `moveZones.lente`) —
`useTranslation('combat')` sélectionne déjà le namespace, un préfixe en trop aurait affiché la clé
brute au lieu du texte. Repéré en vérifiant contre la convention réelle de `creation.json` (déjà en
prod), corrigé avant tout test navigateur. Depuis, chaque segment/fichier est validé par un script
Node qui simule la résolution de clé i18next, en plus d'ESLint/build.

**Second bug trouvé et corrigé (Segment "CombatGmDeclareWindow.jsx")** : `InlineChip`, un composant
local à ce fichier distinct de `StateSelector`, consommait aussi `STATE_DEFS` (posture PNJ, panneau
TACTIQUE) mais n'avait jamais reçu son `t()` lors du Segment 5 — régression active (clé brute affichée)
depuis ce segment, non détectée par ESLint/build (une clé de traduction manquante n'est pas une erreur
de compilation). Repérée par une recherche ciblée de tout `.label}`/`.l}` non enveloppé de `t()` dans
`client/src`, corrigée avant tout test navigateur — aucun autre cas trouvé par ce balayage.

Dettes hors scope trouvées pendant Lot 1, routées vers `docs/BUGIDENTIFIE.md` (pas dupliquées ici) :
`I18N-LINT1` (hook conditionnel `CombatGmDeclareWindow.jsx`), `I18N-LINT2` (variables inutilisées),
`I18N-LINT3` (`setState` synchrone dans un effect, 3 fichiers), `I18N-DEADCODE1` (doublon mort
`WizardCreationPage.jsx`).

---

## 3ter. Lot 1 — texte propre à chaque fichier (hors `combatSections.js`)

Une fois `combatSections.js` réglé (§3bis), chaque fichier restant a été traité individuellement,
un par un — consigne Saar réaffirmée en cours de chantier, avec une clarification importante sur le
mode de validation : **pas de confirmation navigateur par fichier**. Saar : *"Je ne compte pas tester
les choses une par une mais faire une session de beta test avec des amis pour vérifier tout."* — la
validation fonctionnelle de ce lot se fera donc en bloc, plus tard, via une session beta groupée,
jamais fichier par fichier par Saar lui-même.

Ordre traité : `CombatStunWindow`, `CombatTimeline`, `CombatDeclareLog` (reste), `CombatInitStateWindow`
(reste), `CombatPnjPanel`, `CombatDamageWindow`, `CombatCacModifiersWindow`, `DroneDeclareSection`,
`DroneWeaponPanel`, `CombatResultPanels`, `CombatModifiersWindow`, `CombatOverlay` (reste),
`MeleeCombatPanel` (reste), `AssaultRangedPanel` (reste), `CombatRosterWindow`,
`CombatGmDeclareWindow` (reste), `CombatActionWindow` (reste, le plus dense — ~30 clés).

Convention de réutilisation appliquée systématiquement : avant de créer une clé, vérifier si le même
texte existe déjà ailleurs dans `combat.json` (Règle 2) — nombreuses clés partagées entre fichiers
(`common.changeButton`, `common.chooseTargetButton`, `common.targetSection`,
`meleeCombatPanel.weaponSection`, `meleeCombatPanel.targetsCount`, `assaultPanel.noWeapon`,
`stunnedActionsTooltip`, `sectionTitles.action`, `damageWindow.rollButton`/`closeButton`,
`cacModifiers.targetSizeSection`/`rolling`/`compFallback`, `stunWindow.outcomes.*`,
`damageWindow.shockOutcomes.ok`, `gmDeclareWindow.tacticSection`/`equipmentSection`/
`quickActionsSection`, `droneWeaponPanel.ready`, `ini`, `actionLabels.move`, `iniBreakdown.melee`,
`states.fireMode.*.label`).

Nettoyage passager au fil des fichiers déjà entièrement retouchés (`CombatOverlay`, `CombatRosterWindow`,
`CombatGmDeclareWindow`, `CombatActionWindow`) : renommage des callbacks `tokens.find(t => t.id === …)`
en `tokens.find(tk => tk.id === …)` — `t` masquait la fonction de traduction du même nom (sans bug
fonctionnel réel, la portée JS est correcte, mais source de confusion à la relecture).

`combat.json` compte 30 sections top-level en fin de Lot 1, sans doublon (vérifié par script à chaque
étape — un JSON avec deux clés identiques au même niveau ne lève pas d'erreur de parsing, seule la
dernière survit silencieusement ; un script dédié compare le compte de clés brutes au texte source
pour l'exclure).

---

## 3quater. Lot 2 — Équipement / fiche personnage (7 fichiers, 2026-07-25)

Ordre traité (plus isolé → plus dense, un fichier à la fois) : `AimedLocationPicker`,
`ArmorWoundPanel`, `ModingWindow`, `ContainerPanel`, `LocationPanel`, `InventoryPanel`, `WeaponPanel`.
Consigne Saar : « je veux être sûr » — même méthode de validation stricte que le Lot 1 à chaque
fichier (ESLint + `vite build` + script de résolution i18next), pas de pause navigateur par fichier
(confirmé par Saar : chaîner les 7, session de test groupée après coup, même patron que §3ter).

**Décision de scope (avant le premier fichier)** : `charSheet.json` tel que décrit dans
`docs/SYSTEME/LOCALISATION.md` §2.1 doit à terme absorber aussi 9 sections déjà traduites
(`charSheet`, `advantages`, `skillsPanel`, `entityPanel`, `drone`, `los`, `status`, `radialMenu`,
`tokenRadial`), utilisées par 13 fichiers déjà fonctionnels — plusieurs mélangent ces sections avec
d'autres restant dans `fr.json` (ex. `CharacterSheet.jsx` : `charSheet`+`character`+`common`), sans
aucun précédent de composant multi-namespace dans le projet. **Écart appliqué, même principe que
§3 pour `combat.json`** : `charSheet.json` créé neuf et isolé, ne reçoit que le retrofit des 7
fichiers du Lot 2. La migration des 9 sections legacy reste un chantier séparé, non ouvert.

**Vocabulaire partagé cross-domaine trouvé** : `AimedLocationPicker`, `LocationPanel` et
`WeaponPanel` affichent les mêmes 6 libellés courts de zone corporelle (Tête/Corps/Bras G/Bras D/
Jambe G/Jambe D), jusqu'ici lus en dur depuis `shared/armorConstants.js` (`LOCATION_LABELS`) — module
aussi consommé **côté serveur** (`socketCombatHelpers.js`, `socketCombatResolution.js`) pour
construire du texte de jeu réel, donc ses valeurs n'ont pas été touchées. `combat.json` a déjà sa
propre copie de ce même vocabulaire, en forme longue (`resultPanels.location.*`, exclusif à
`CombatResultPanels.jsx`). Résolu par duplication contrôlée plutôt que par un premier usage
multi-namespace : nouvelle clé `charSheet.json` → `locations.*` (formes courtes, identiques à
l'affichage actuel) + nouveau module partagé `client/src/lib/locationI18nKeys.js`
(`LOCATION_I18N_KEYS`, code slot → clé i18n) réutilisé tel quel par les 3 fichiers concernés — entorse
littérale à la Règle 2 de `docs/RegleDocumentaire.md` (une information = un seul endroit), actée avec Saar avant de coder.

**Points par fichier** :
- `ModingWindow.jsx` : commentaire de tête retiré (« i18n : équipement hors scope actuel » — devenu
  faux, l'équipement est justement ce lot). Titre à deux comptes indépendants (armes/mods) — deux
  clés `_one`/`_other` séparées composées dans une clé parente à interpolation, pas un seul `count`
  (limite native i18next : un seul pluriel par appel `t()`).
- `ContainerPanel.jsx` : `common.loading`/`common.closeButton` posés dans `charSheet.json` pour
  réutilisation immédiate par `ModingWindow.jsx` (même patron que `combat.json` §3ter : vérifier
  l'existant avant de créer une clé, dans le même namespace).
- `LocationPanel.jsx` : réutilise `LOCATION_I18N_KEYS` (labels de zone) et `containerPanel.equipError`/
  `unequipError`/`unequipTooltip`/`equipPlaceholder` (mêmes messages qu'`ContainerPanel.jsx`, pas
  redupliqués). Libellés de sévérité abrégés (`Lég`/`Moy`/`Gra`/`Crit`/`Mort`) distincts des libellés
  longs déjà dans `combat.json` (`resultPanels.severity.*`) — même situation que les localisations,
  forme courte propre à cette grille compacte.
- `InventoryPanel.jsx` : `CONTAINER_ORDER` (`Sac`/`Ceinture`/`Coffre`) sert à la fois de valeur
  envoyée à l'API (`container: newContainer`) et de texte affiché — split en `CONTAINER_LABEL_KEYS`
  (affichage uniquement, `t()`) sans toucher aux valeurs `value=`/payload envoyées au serveur. Les
  codes de slot (`VALID_SLOTS` : T/C/BG/BD/JG/JD/MG/MD/2M/Tr) laissés en dur — identifiants
  techniques au sens de `docs/SYSTEME/LOCALISATION.md` §3, pas du texte affiché.
- `WeaponPanel.jsx` (le plus dense) : `SLOT_LABELS`/`shieldExtraLocationLabels` suivaient déjà le
  patron « module exporte un code, le composant résout via `t()` » — juste raccordés aux vraies clés.
  `shieldExtraLocationLabels` est une fonction pure hors composant : `t` reçu en paramètre explicite
  (§3.1), pas de hook interne. `WeaponCard` et `ItemRow` (`InventoryPanel.jsx`) sont des composants
  React à part entière (pas du JSX inline) : chacun a son propre appel `useTranslation('charSheet')`.

Aucune dette hors scope trouvée pendant ce lot (contrairement au Lot 1, aucun signalement
`I18N-LINT*`/`I18N-DEADCODE*` supplémentaire).

`charSheet.json` compte 9 sections top-level en fin de Lot 2 (`locations`, `aimedLocationPicker`,
`common`, `armorWoundPanel`, `containerPanel`, `weaponPanel`, `inventoryPanel`, `locationPanel`,
`modingWindow`), zéro texte en dur restant sur les 7 fichiers confirmé par ré-audit (script §1) et
script de résolution i18next (103 clés vérifiées, y compris les clés dynamiques par gabarit et les
formes plurielles `_one`/`_other`).

---

## 3quinquies. Lot 3 — Builder / Surface (6 fichiers, 2026-07-25)

Ordre traité (plus isolé → plus dense) : `Object3DPreview`, `SurfaceMaterialEditor`,
`SurfaceRoomPanel`, `SurfaceWallPanel`, `MaterialGeneratorTab`, `SurfaceConnectorPanel`. Même méthode
que les Lots 1-2 (un fichier à la fois, ESLint + `vite build` + script de résolution à chaque étape),
chaînés sans pause navigateur par fichier (consigne Saar reconfirmée).

**Point de vigilance signalé avant de coder, non bloquant** : ces 6 fichiers (éditeur Surface) sont au
cœur du chantier parallèle moteur-monde (Codex, `dev/monde`, dépôt physique séparé,
`docs/EN_COURS.md` « CHANTIER PARALLÈLE — MOTEUR DE MONDE »). Seule la couche texte/JSX a été
touchée — aucune logique spatiale, aucun appel `WorldSnapshot`/`world*` modifié — mais un conflit de
fusion reste possible si Codex retouche les mêmes fichiers de son côté. Saar informé, a donné le go.

**Même décision de scope que Lots 1-2** : `builder.json` créé neuf et isolé (pas de migration des 5
sections legacy `builder`/`surfaceEditor`/`texturePacks`/`workshop`/`entity` déjà utilisées par
d'autres fichiers fonctionnels — même situation de mélange multi-namespace que `charSheet.json`,
même déviation appliquée).

**Réutilisation intra-namespace (Règle 2)** trouvée à plusieurs reprises, la plupart entre
`SurfaceMaterialEditor.jsx` et `MaterialGeneratorTab.jsx` (deux éditeurs de matière procédurale
distincts partageant le même vocabulaire — Motif/Peinture/Usure/Relief) : clés `surfaceMaterialEditor.*`
réutilisées telles quelles plutôt que redupliquées. Exception notée : `MaterialGeneratorTab.jsx` utilise
une orthographe sans accents propre à ce fichier (« Matiere », « Salete », « Generateur »...) —
préservée verbatim (relocalisation de texte, pas correction orthographique hors scope). « Identité »/
« Apparence » (titres de section répétés entre `SurfaceRoomPanel`/`SurfaceWallPanel`) et « Coût de
déplacement »/« Confirmer la suppression » (répétés entre `SurfaceRoomPanel`/`SurfaceConnectorPanel`)
promus dans `common`/réutilisés en cross-fichier plutôt que redupliqués.

**Patron « code sert aussi de valeur »** rencontré deux fois, même traitement que `CONTAINER_ORDER`
du Lot 2 (`InventoryPanel.jsx`) : `CATEGORY_OPTIONS` (`MaterialGeneratorTab.jsx`, valeur envoyée à
l'API via `category_label`) et `MODEL_SLOT_LABELS`/`ELEVATOR_PHASE_LABELS`
(`SurfaceConnectorPanel.jsx`, codes de slot/phase runtime) — split en mapping code→clé i18n pour
l'affichage uniquement, valeur brute inchangée dans le payload/la comparaison.

**Fonctions pures hors composant** (§3.1) : `connectorTypeLabel` (`SurfaceConnectorPanel.jsx`) reçoit
`t` en paramètre explicite, même patron que `shieldExtraLocationLabels` du Lot 2.

**Composants séparés avec leur propre hook** : `ElevatorRuntimeControls` (dans
`SurfaceConnectorPanel.jsx`) — même situation que `WeaponCard`/`ItemRow` au Lot 2, chacun appelle son
propre `useTranslation('builder')`. `SliderField` (`MaterialGeneratorTab.jsx`) reçoit son `label` déjà
résolu en prop par l'appelant, donc aucun hook propre nécessaire.

Aucune dette hors scope trouvée pendant ce lot.

`builder.json` compte 8 sections top-level en fin de Lot 3 (`object3DPreview`, `surfaceMaterialEditor`,
`common`, `surfaceRoomPanel`, `surfaceWallPanel`, `materialGeneratorTab`, `surfaceConnectorPanel`,
`elevatorRuntimeControls`), zéro texte en dur restant sur les 6 fichiers confirmé par ré-audit
(script §1) et script de résolution i18next (141 clés vérifiées, y compris les mappings code→clé et
les formes plurielles `_one`/`_other`).

---

## 3sexies. Lot 4 — Outils dés (1 fichier, 2026-07-25)

**Décision d'ouverture de lot** : `DiceCalibrationPage.jsx` (outil dev de calibration des normales de
face GLB, jamais atteint par un joueur/MJ en jeu — route utilisée par Saar seul) tranché hors scope par
Saar avant tout code — reste en dur. Seul `DicePanel.jsx` (lanceur de dés réel, en jeu) est retenu.

**Différence de méthode vs Lots 1-3** : pas de nouveau namespace créé. `fr.json` (namespace par défaut,
`translation`) contient déjà une section `dice.*` de 13 clés, dont 11 orphelines — vérifié par
recherche exhaustive des consommateurs (`grep` sur tout `client/src`) : seules `dice.criticalSuccess`/
`dice.criticalFail` avaient un consommateur réel (`Sidebar.jsx`), les 11 autres (`roll`, `result`,
`formula`, `panel`, `gmRoll`, `gmRollSoon`, `launch`, `move`, `advanced`, `disabledInEdit`, `history`)
n'étaient utilisées nulle part — probablement pré-semées en prévision de ce retrofit. `DicePanel.jsx`
n'avait par ailleurs jamais utilisé aucun autre namespace (0 `useTranslation` avant ce lot), donc aucun
risque de mélange multi-namespace : `useTranslation()` (défaut) suffit, pas de `charSheet.json`/
`builder.json` à créer pour ce lot.

**Réutilisation trouvée** : `panel` ("Lanceur de dés"), `gmRoll` ("Jet au MJ"), `history`
("Historique"), `move` ("Déplacer") et `launch` ("Lancer") — 5 des 11 clés orphelines correspondent
exactement à du texte du fichier, jusqu'ici recopié en dur en plus (souvent en majuscules pour le
rendu HUD/console). Réutilisées telles quelles avec `textTransform: 'uppercase'` ajouté au `style`
là où l'affichage actuel est en capitales (`LANCEUR DE DÉS`, `JET AU MJ`, `LANCER`, `HISTORIQUE`) —
changement CSS pur, aucun changement de contenu ni de rendu visuel. `common.cancel` (déjà utilisée
ailleurs dans le projet) réutilisée pour le bouton « Annuler » du formulaire macro. **Trouvé lors du
run à vide de relecture** : `dashboard.create` (= « Créer ») existait déjà — clé `dice.createButton`
initialement créée par erreur (doublon Règle 2, non vérifiée contre tout `fr.json` au moment de
l'écrire, seulement contre `common`) retirée, bouton « Créer » du formulaire macro repointé vers
`dashboard.create`.

**Patron « code sert aussi de valeur »** : aucune occurrence cette fois (contrairement aux Lots 2/3) —
les seules valeurs numériques/symboliques affichées sur les dés (`10`, `%`, `6`, `8`, `12`, `20`, `4`)
sont des chiffres/symboles universels, hors périmètre `docs/SYSTEME/LOCALISATION.md` §3 (identifiants
techniques), pas du texte.

**Composant séparé avec son propre hook** : `DieButton` (interne à `DicePanel.jsx`) — même patron que
`WeaponCard`/`ItemRow` (Lot 2) et `ElevatorRuntimeControls` (Lot 3), son propre `useTranslation()`.

**Dette hors scope trouvée, routée séparément (pas traitée ici)** : `I18N-LINT4` —
`docs/BUGIDENTIFIE.md` cluster H — `handleDragEnd` référencé avant déclaration dans
`DicePanel.jsx:331-335` (ESLint `react-hooks/immutability`), confirmé préexistant par `git show HEAD`
avant toute modification de ce chantier.

`fr.json` section `dice` passe de 13 à 44 clés (31 nouvelles, dont 5 réutilisent une clé orpheline
préexistante ; un 6e réemploi, `dashboard.create`, reste hors section `dice`), zéro texte en dur
restant sur `DicePanel.jsx` confirmé par ré-audit (script §1) et script de résolution i18next
(44 clés vérifiées).

---

## 4. Fichiers vérifiés sans texte utilisateur (hors chantier)

Vérifié par lecture (pas supposé) : ces 23 fichiers n'utilisent pas `useTranslation` et n'ont aucune
occurrence de texte visible détectée. Composants de rendu 3D pur, providers ou wrappers qui délèguent
tout le texte à leurs enfants.

`App.jsx`, `main.jsx`, `SocketContext.jsx`, `SilhouettePanel.jsx`, `BodySilhouetteSvg.jsx`,
`CulledVoxelScene.jsx`, `DungeonTerrainScene.jsx`, `SurfaceDungeonScene.jsx`, `SurfaceEditorScene.jsx`,
`Editor3D.jsx`, `EntityEditor.jsx`, `EntityMesh.jsx`, `Voxel.jsx`, `GeometryIcon.jsx`,
`ReliefBoxGeometry.jsx`, `FloatingPanelSection.jsx`, `TimelineCard.jsx`, `DiceLights.jsx`,
`DiceMesh.jsx`, `DiceRoller.jsx`, `DiceCalibrationProbe.jsx` (dev),
`components/creation/WizardCreationPage.jsx`, `pages/WizardCreationPage.jsx`.

**Trouvaille hors scope, non traitée ici** : les deux `WizardCreationPage.jsx` sont quasi-identiques,
l'un semble mort — pas un sujet i18n, loguée séparément → `docs/BUGIDENTIFIE.md` (`I18N-DEADCODE1`).

---

## 5. Hors périmètre de ce plan

- Anglais (`en.json`) — gelé, voir `docs/SYSTEME/LOCALISATION.md` §1.
- Suppression du fichier dupliqué `WizardCreationPage.jsx` (§4) — chantier dead-code séparé.
- Toute clé déjà correctement traduite dans les 50 composants existants.
- `DiceCalibrationPage.jsx` — outil dev, tranché hors scope par Saar (§3sexies), reste en dur.

---

## 6. Validation

- ESLint 0 *nouvelle* erreur (`git diff`/`git diff --stat` utilisés à chaque fichier pour distinguer
  préexistant de régression — toutes les erreurs restantes sont dans `docs/BUGIDENTIFIE.md`).
- `vite build` propre après chaque fichier.
- Clés vérifiées par script Node simulant la résolution i18next (namespace + chemin) à chaque fichier.
- Aucune régression visuelle détectable statiquement (pas de clé orpheline, pas de doublon top-level).
- Parcours navigateur réel : **différé** — pas de confirmation par fichier ni par lot (décision Saar
  §3ter), validation prévue via une session beta groupée avec d'autres joueurs.

**Testé (Lot 1 complet, 17 fichiers + `combatSections.js`)** : ESLint (0 nouvelle erreur sur l'ensemble
du lot), `vite build` propre, toutes les clés de `combat.json` vérifiées par script de résolution,
zéro texte en dur restant confirmé par ré-audit (script §1) sur les 17 fichiers.
**Non testé :** tout parcours navigateur réel — aucun écran Combat n'a encore été ouvert en jeu depuis
ce chantier.

**Testé (Lot 2 complet, 7 fichiers)** : ESLint (0 nouvelle erreur sur l'ensemble du lot), `vite build`
propre, 103 clés vérifiées par script de résolution i18next (namespace `charSheet`, y compris clés
dynamiques et formes plurielles), zéro texte en dur restant confirmé par ré-audit (script §1) sur les
7 fichiers.
**Non testé :** tout parcours navigateur réel — aucun écran Équipement/Fiche personnage n'a encore été
ouvert en jeu depuis ce chantier (décision Saar §3quater : session de test groupée après coup, pas de
confirmation par fichier).

**Testé (Lot 3 complet, 6 fichiers)** : ESLint (0 nouvelle erreur sur l'ensemble du lot), `vite build`
propre, 141 clés vérifiées par script de résolution i18next (namespace `builder`, y compris mappings
code→clé et formes plurielles), zéro texte en dur restant confirmé par ré-audit (script §1) sur les
6 fichiers.
**Non testé :** tout parcours navigateur réel — aucun écran Builder/Surface n'a encore été ouvert en
jeu depuis ce chantier (même décision Saar : session de test groupée après coup). Risque de conflit de
fusion avec le chantier parallèle moteur-monde non vérifiable depuis cette instance (§3quinquies).

**Testé (Lot 4 complet, 1 fichier — `DiceCalibrationPage.jsx` exclu)** : ESLint (0 nouvelle erreur —
`I18N-LINT4` confirmé préexistant par `git show HEAD`, routé séparément), `vite build` propre, 44 clés
vérifiées par script de résolution i18next (namespace par défaut, section `dice.*` de `fr.json`), zéro
texte en dur restant confirmé par ré-audit (script §1).
**Non testé :** tout parcours navigateur réel — même décision Saar, session de test groupée après coup.

**Les 4 lots de `docs/PLAN_LOCALISATION.md` sont maintenant entièrement codés.** Aucun n'a de
confirmation navigateur — la session de test groupée reste à faire avant d'archiver ce plan dans
`docs/ASBUILT.md` (Règle 10, `docs/RegleDocumentaire.md`).

---

## 7. Lot 5 — Contenu de catalogue `ref_*` en base (plan rédigé 2026-09-02)

### 7.1 Nature de la dette

La méthode d'audit du §1 ne scanne que les `.jsx` du client — par construction elle ne voit pas le
texte de jeu **stocké en base** dans les tables `ref_*` (équipements, compétences, avantages, mutations,
carrières…), seedé depuis le *Livre de Base*. Ce texte est FR en dur dans des colonnes (`name`,
`label`, `description`, et plusieurs colonnes de prose annexes — §7.3), affiché directement par les
composants (`equip.name`, `skill.description`, sans `t()`). Même catégorie de dette que les Lots 1-4,
autre entrepôt.

**Déclencheur** : correction de `docs/Old/BUG WIZARD.md` bug #16 (`ref_advantages.name` = « Sens
diminué (hearing) », anglais non traduit). Saar a posé la question de principe : l'architecture doit
pouvoir accueillir EN/DE/JP sans réécriture (objectif produit toujours **FR seul** —
`LOCALISATION.md` §1/§5 inchangés). Impossible à faire bug par bug sur les `ref_*` sans incohérence →
Lot 5 dédié.

### 7.2 Pourquoi un mécanisme distinct des Lots 1-4 (autorité : `LOCALISATION.md` §6)

Deux entrepôts de texte, deux outils :

- **Texte d'interface** (JSX : boutons, titres, tooltips) → fichiers `client/src/locales/*.json` par
  domaine (i18next). C'est les Lots 1-4. Rien à changer.
- **Contenu de catalogue** → vit **en base**, ~1630 lignes dont des `description` de plusieurs
  paragraphes, édité par les outils admin (`server/src/admin/ref-equipment-tool.html`), pas par un
  commit. Ne peut pas passer par `locales/` : (a) poids du bundle — les JSON i18next sont parsés au
  chargement navigateur, le chunk est déjà à 3,9 Mo, ×chaque langue ; (b) le **serveur** doit résoudre
  ce texte (messages de chat, export PDF de fiche) ; (c) cycle de vie éditorial (admin live, pas
  déploiement).

Pratique pro du contenu multilingue en base (Django `modeltranslation`/`parler`, Rails `globalize` /
`mobility`, Laravel `spatie/laravel-translatable`) : colonne par champ **ou** table de traduction à
côté **ou** TMS externe — **les trois gardent la traduction dans la base, avec la donnée**. Le
consensus documenté (§7.12) : *read-heavy + peu de langues → colonne JSONB* ; *beaucoup de langues +
requêtes complexes → table séparée*. Enclume est read-heavy, 1 langue, dev solo, JSONB déjà en usage
(`campaigns.settings`, `char_pc_ledger.skill_allocations`) → **colonne JSONB `<champ>_i18n` par champ
traduisible, sur la table elle-même**. Pas de jointure, aucune migration de schéma pour ajouter une
langue ensuite. La table de traduction séparée (jointure à chaque lecture) n'apporte rien à cette
échelle. Mécanisme complet : `LOCALISATION.md` §6.2 ; références : §7.12 ; adaptativité : §7.13.

### 7.3 Inventaire des colonnes (audit base 2026-09-02 — les 10 tables, toutes colonnes texte lues)

Colonnes de **prose** → couvertes par le Lot 5. Colonnes de **taxonomie** et micro-formats → hors
périmètre (§7.9), pas dans la migration.

| Table | Lignes | Prose → `<champ>_i18n` | Hors périmètre (taxonomie / codes / formules / noms propres) |
|---|---|---|---|
| `ref_equipment` | 790 | `name`, `description` | `family`, `category` (taxo) · `manufacturer`, `nation` (noms propres) · `damage_*`, `range`, `shock`, `fire_mode`, `caliber`, `rarity`, `ammo_effects`, `mod_slot`, `location`, `linked_attr`, `price_modifier`, `duration` |
| `ref_career_random_benefits` | 370 | `description` | `effects` (jsonb) |
| `ref_skills` | 249 | `label`, `description` | `family` (taxo) · `id`, `parent`, `attr_1/2`, `marker` |
| `ref_advantages` | 79 | `name`, `description`, `special_rule` | `family`, `type` (taxo) · `subtype` (code, déjà traduit client via `t('step3.subtype_labels.*')`) · `mod_*`, `mod_monthly_income_formula` |
| `ref_mutations` | 45 | `name`, `description`, `stack_effect`, `special_effect` | `subtype`, `mod_sex`, `mod_fertility`, `max_cumul_group` (codes) · `mod_*`, `natural_weapon_*_formula` |
| `ref_careers` | 37 | `name`, `description`, `geographic_origin_details` | `code`, `illustration`, `min_attributes_logic`, `ally_type`, `enemy_rule` (codes) |
| `ref_setbacks` | 27 | `name`, `description` | `effects` (jsonb) |
| `ref_backgrounds` | 22 | `name`, `description` *(NULL sur 22/22 aujourd'hui — colonne ajoutée quand même, backfill vide, cf. §7.10)* | `type` (taxo) · `code`, `parent_type`, `parent_code` |
| `ref_mutation_subtypes` | 8 | `name`, `description`, `special_trait` | `skill_bonus`, `immunity` (micro-format — §7.9) |
| `ref_genotypes` | 4 | `label`, `description` | `illustration_url` |

**Champs de prose ratés par une approche « name/description » naïve** (l'argument pour une migration
complète, pas incrémentale) : `special_rule` (advantages), `stack_effect` + `special_effect`
(mutations), `geographic_origin_details` (careers), `special_trait` (mutation_subtypes).

### 7.4 Architecture d'exécution

#### 7.4.1 Migration unique — `NNN_ref_catalog_i18n.js`  *(sous-lot 5.0)*

- **Une seule migration**, les 10 tables, tous les champs de prose du §7.3.
- Par champ : `ALTER TABLE "<table>" ADD COLUMN IF NOT EXISTS "<champ>_i18n" jsonb NOT NULL DEFAULT '{}'::jsonb`
  (`IF NOT EXISTS` : métadonnée seule en PG 11+, aucune réécriture de table même sur `ref_equipment`).
- **Backfill dans la même migration** : `UPDATE "<table>" SET "<champ>_i18n" = jsonb_build_object('fr', "<champ>") WHERE "<champ>" IS NOT NULL AND "<champ>" <> ''`.
- **Idempotent** : `ADD COLUMN IF NOT EXISTS` + backfill qui réécrit la même valeur → un 2ᵉ `up()`
  accidentel (piège nodemon P54) ne corrompt rien (le cas « 2ᵉ `up()` corrompt silencieusement » ne
  s'applique pas ici).
- `down()` : `DROP COLUMN` de toutes les colonnes ajoutées (retour arrière pur — les colonnes brutes
  restent la source, aucune perte).
- Round-trip `up()`/`down()` vérifié **hors dépôt** (§7.11) — pas de `*.test.mjs` sous `server/`.
- **Numéro** : prochain entier libre vérifié à la fois sur `ls server/src/db/migrations/` **et**
  `SELECT max(...) FROM knex_migrations` au moment de créer le fichier (317 au 2026-09-02 ; travail
  parallèle possible).
- **Écart assumé vs `rules/migrations.md` « une table = un fichier »** : cette règle vise (a) la
  *création* d'une table et (b) l'interdiction d'empiler un correctif sur une migration antérieure.
  Ici : un seul changement **additif transverse**, aucune migration antérieure modifiée, aucune table
  créée. Regrouper garantit la complétude (une colonne oubliée = migration corrective, exactement ce
  qu'on veut éviter — demande explicite de Saar 2026-09-02) et l'atomicité. Déviation actée.
- **Avant d'écrire le fichier** : lire `docs/SYSTEME/CORE.md` § « Migrations — pièges (P52-P56) ».
  `nodemon` applique la migration dès l'écriture du fichier sous `server/` → ne jamais rappeler
  `up()` sans `SELECT` préalable dans `knex_migrations`.
- **Rétrocompatible avec le code déployé** : colonnes nullable-avec-défaut, aucun consommateur ne les
  lit encore à ce stade.

#### 7.4.2 Résolveur — `server/src/lib/refI18n.js`  *(même commit que 7.4.1)*

Résolution **en couche applicative** (JS au point de projection), pas en SQL — c'est le chemin de
lecture de toutes les libs matures (Mobility, spatie, `parler`, `globalize`) : un accesseur applique
la chaîne de repli, le blob brut n'est jamais sérialisé. Le `COALESCE` SQL est réservé au futur tri /
recherche *par valeur traduite* (§7.13), pas au rendu.

Le module porte **la seule source de vérité « quels champs sont traduisibles par table »** —
équivalent du `translates :name, :description` de Mobility / du `$translatable` de spatie :

```js
// server/src/lib/refI18n.js
export const REF_TRANSLATABLE = {
  ref_genotypes:              ['label', 'description'],
  ref_mutation_subtypes:      ['name', 'description', 'special_trait'],
  ref_backgrounds:            ['name', 'description'],
  ref_setbacks:               ['name', 'description'],
  ref_careers:                ['name', 'description', 'geographic_origin_details'],
  ref_mutations:              ['name', 'description', 'stack_effect', 'special_effect'],
  ref_advantages:             ['name', 'description', 'special_rule'],
  ref_skills:                 ['label', 'description'],
  ref_career_random_benefits: ['description'],
  ref_equipment:              ['name', 'description'],
}

export function resolveRefField(row, field, locale = 'fr') { /* locale → fr → colonne brute → null */ }
export function localizeRef(table, row, locale = 'fr') { /* champs REF_TRANSLATABLE[table] résolus, clés *_i18n retirées */ }
export function localizeRefRows(table, rows, locale = 'fr') { /* map de localizeRef */ }
```

- `resolveRefField` : `row?.[`${field}_i18n`]?.[locale] ?? row?.[`${field}_i18n`]?.fr ?? row?.[field] ?? null`.
  Gère `row == null` (retour `.first()` vide) → `null`. `row.description === ''` → `''` (inchangé vs
  aujourd'hui).
- `localizeRef` : clone superficiel, résout les champs de `REF_TRANSLATABLE[table]`, **supprime toute
  clé finissant par `_i18n`**. Ce strip tient l'invariant §7.8 **et** protège contre un `{...refRow}`
  propagé dans un `INSERT` sur une autre table (colonne `*_i18n` absente de la cible → l'insert
  casserait — spatie traite la même fuite dans `toArray()` comme un bug, §7.12).
- `locale` : signature prête, **aucun appelant ne la passe** aujourd'hui — figé `'fr'` (§6.2). Un seul
  point de branchement le jour d'une 2ᵉ langue.
- Test pur `server/src/lib/refI18n.test.mjs` (aucune base) : repli locale→fr→brut, `row` null,
  `field`/`_i18n` absent, `_i18n = {}`, strip effectif, `''` inchangé.
- **Résolveur unique / couture unique** : jamais dupliqué par table ni par service, jamais de repli
  côté client (`AGENTS.md` §3, `LOCALISATION.md` §4). Un futur changement de backend pour *une* table
  (ex. `ref_equipment` → table de traduction séparée) ne touche que ce module — « backend enfichable »
  de Mobility (§7.13).

#### 7.4.3 Retrofit des consommateurs

Sûr par construction : tant qu'un consommateur n'est pas retrofité, il lit la colonne brute (toujours
peuplée) → affichage inchangé. Le retrofit se fait **au point de projection** (handler de route /
getter de service) pour que `*_i18n` ne parte jamais au client.

**Décision (analyse à charge 2026-09-02)** : le swap mécanique de **tous** les `select('*')` sur
`ref_*` (~15 sites — `routes/character/ref.js`, `services/creationService.js`, `services/tradeService.js`,
`services/advantageService.js`) vers `localizeRefRows('<table>', rows)` est fait **dans le sous-lot
5.0**, pas éclaté sur 5a→5g. Raisons : (a) sinon tous les payloads catalogue portent `*_i18n` en
double pendant des semaines (invariant §7.8 violé) ; (b) un `{...refRow}` propagé dans un `INSERT`
casserait dès l'application de la migration ; (c) la transformation est uniforme — une ligne, valeur
résolue == colonne brute post-backfill, aucun consommateur ne peut casser. Le retrofit **non
uniforme** (alias SQL de jointure type `rms.name as subtype_db_name`, gabarits de message serveur,
vérif client, scénario réel par domaine) reste éclaté par sous-lot 5a→5g.

### 7.5 Découpage en sous-lots

| Sous-lot | Table(s) | Lignes | Champs de prose |
|---|---|---|---|
| **5.0** | *(infra)* migration `NNN_ref_catalog_i18n` + résolveur `refI18n.js` + swap mécanique des ~15 `select('*')` sur `ref_*` + `refI18n.test.mjs` — **commit isolé, préalable au retrofit fin** | — | — |
| 5a | `ref_genotypes` · `ref_mutation_subtypes` | 4 · 8 | label/description · name/description/special_trait |
| 5b | `ref_backgrounds` · `ref_setbacks` | 22 · 27 | name · name/description |
| 5c | `ref_careers` · `ref_mutations` | 37 · 45 | name/description/geographic_origin_details · name/description/stack_effect/special_effect |
| 5d | `ref_advantages` | 79 | name/description/special_rule |
| 5e | `ref_skills` | 249 | label/description |
| 5f | `ref_career_random_benefits` | 370 | description |
| 5g | `ref_equipment` | 790 | name/description |

Un sous-lot = un plan validé + une analyse à charge + code (étapes distinctes, une par tour — CLAUDE.md).
Le suivant attend la validation du précédent. Pas de confirmation navigateur par sous-lot (décision
Saar §3ter — session beta groupée) ; la migration `5.0` et chaque sous-lot touchant un flux réel
(Wizard, octroi MJ, marchand, combat) exigent un scénario réel listé pour cette session (§7.11).

### 7.6 Méthode par sous-lot (à partir de 5a)

1. `grep` exhaustif des consommateurs de la/les table(s) : `routes/`, `services/`, `socket/`,
   `lib/`, `shared/`, tests — `db('<table>')`, `from('<table>')`, jointures `... as`, vues SQL.
2. Classer chaque site **par lecture du code, pas supposé** (`AGENTS.md` §1) :
   - affiche un champ de prose → retrofit via helper au point de projection ;
   - lit uniquement des colonnes numériques / codes (`mod_*`, `pc_cost`, `*_formula`…) → **non
     touché**, listé dans le plan du sous-lot avec la raison.
3. Vérifier côté client que le `.jsx` rend la chaîne **reçue du serveur** (pas une constante client).
4. Validation : `node --check` sur chaque `.js` serveur touché, tests ciblés du module,
   `cd client && npm run build`, scénario réel noté pour la session beta.

### 7.7 Sous-lot 5a — consommateurs (inventaire fait 2026-09-02, à reconfirmer par lecture à l'ouverture du sous-lot)

**`ref_genotypes`** — sites qui exposent réellement `label` / `description` :
- `server/src/routes/character/ref.js` `/genotypes` (`select('*')` → client Wizard / CharacterSheet)
  → couvert par le swap 5.0 (`localizeRefRows('ref_genotypes', genotypes)`)
- `server/src/services/creationService.js:146-147` (`requiredGenotypeLabel`) → `resolveRefField(g, 'label')` *(non-`select('*')` — retrofit fin 5a)*

Lecture de modificateurs numériques seulement (`mod_for`…, `pc_cost`) — **non touchés** :
`creationService.js:796`, `socketDice.js:152`, `socketCombatState.js` (×2), `socketEntity.js` (×2),
`routes/battlemaps.js:234`, `routes/character/char-sheet.js` (×3), `characterExportService.js:67`,
`inventoryService.js:200`, `combatantContextService.js:72`, `movementBudgetService.js:67`,
`damageService.js:258`, `coldExposureService.js:206`, `environmentalHazardService.js:102`,
`fallDamageService.js:59`, `fatigueService.js:48`, `woundEvolutionService.js:142`.

**`ref_mutation_subtypes`** — sites qui exposent `name` / `description` / `special_trait` :
- `server/src/routes/character/ref.js` `/mutations` — `ref_mutations` + `ref_mutation_subtypes` en
  `select('*')`, `subtable[]` envoyée au client → swap 5.0 sur les deux `select('*')`, puis en 5a
  localiser chaque élément de `subtable[]`
- `server/src/services/creationService.js:228` (`getStep3RefData`, `select('*')`) → swap 5.0 ; en 5a,
  localiser le tableau `subtypes`
- `server/src/services/creationService.js:299-308` (`getStep3State`, alias SQL `rms.name as
  subtype_db_name` — **pas** un `select('*')`) → 5a : reshape de la requête, résoudre en JS après le `select`
- `server/src/services/mutationService.js:24,52` (`subtype_name` d'affichage) → 5a : via `resolveRefField`

Note : le gabarit FR `Cette profession nécessite le génotype : ${label}` (`creationService.js:115-116`)
et les phrases serveur analogues qui *incorporent* un libellé `ref_*` sont une dette distincte (type
Lot 6) — **hors périmètre 5a**, à recenser.

### 7.8 Invariant

La résolution de la langue affichée est **exclusivement côté serveur, via `refI18n.js`, résolveur
unique** (couture unique — §7.4.2). Jamais dupliquée par table ou par service ; jamais de repli côté
client. Le client reçoit une chaîne déjà résolue (`equip.name`), jamais l'objet `*_i18n`. Corollaire
de `LOCALISATION.md` §4 (le client ne décide jamais de la langue) et `AGENTS.md` §3 (une propriété =
une autorité unique).

### 7.9 Hors périmètre du Lot 5

- **Colonnes de taxonomie** `family` / `category` / `type` (`ref_equipment`, `ref_skills`,
  `ref_advantages`, `ref_backgrounds`) : vocabulaire fermé (~90 valeurs distinctes recopiées sur des
  centaines de lignes), curé par le dev, **aussi utilisé comme clé de regroupement / filtre** en base
  et côté client. Traitement propre = codes + clés i18next côté client (pas JSONB) — mais c'est une
  migration de *valeurs* + le retrofit de tous les `where`/`groupBy`, blast radius distinct. →
  **Lot 7**, non ouvert.
- Colonnes à micro-format structuré ou mono-token : `ref_mutation_subtypes.skill_bonus`
  (`"Acrobatie/Équilibre:+3"`) / `immunity` (`"vertige"`), `ref_equipment.caliber` / `price_modifier`
  (`"x niv"`) / `duration` (`"16 h"`) / `mod_slot`. Notées, décision différée.
- Toute langue ≠ `fr` ; le champ `locale` réel (utilisateur / campagne).
- Phrases FR **composées côté serveur** qui incorporent un libellé `ref_*` (`creationService`
  messages d'éligibilité, etc.) — dette type Lot 6.
- Correction du **contenu FR** lui-même : fautes, anglais résiduel (bug #16), mojibake — voir §7.10.
- Lots 1-4 (validation navigateur), Lot 6.

### 7.10 Trouvailles hors i18n (routées séparément, pas corrigées dans le Lot 5)

- `ref_genotypes.description` : double-encodage UTF-8 sur les 4 lignes
  (`"NÃ© avec les mutations nÃ©cessaires Ã  la survie"` au lieu de
  `"Né avec les mutations nécessaires à la survie"`). → ticket `bug_tickets`.
- `ref_backgrounds.description` : `NULL` sur 22/22 lignes — colonne jamais peuplée (le contenu
  existe-t-il dans le *Livre de Base* ?). → ticket `bug_tickets`.

### 7.11 Validation

- **Migration `5.0`** : round-trip vérifié par **Saar via script scratchpad** (hors `server/` —
  `rules/migrations.md` ; `naturalMigrationSource` exclut `*.test.mjs` de toute façon) : import du
  module par chemin absolu, `up()` puis `down()`, assert backfill `"<champ>_i18n"->>'fr' = "<champ>"`
  par table + `DROP` effectif. Résultat consigné au message de commit. Application réelle : nodemon de
  Saar au démarrage ; `SELECT knex_migrations` avant tout rappel manuel de `up()`.
- **Résolveur** : `node --test server/src/lib/refI18n.test.mjs` (pur, sans base).
- **Swap `select('*')` (5.0)** : `node --check` sur les ~15 `.js` touchés + `cd client && npm run build`
  propre ; ré-lecture de chaque site pour confirmer qu'aucun ne fait `{...refRow}` → `INSERT`/`UPDATE`
  sur une autre table (sinon corrigé dans 5.0, pas différé).
- **Par sous-lot 5a→5g** : `node --check` sur les `.js` serveur touchés, tests ciblés des modules,
  `cd client && npm run build` propre.
- **Scénario réel** (session beta groupée, listé par sous-lot) : 5.0 → catalogue Wizard + marchand
  s'affichent identiques ; 5a → Wizard étape génotype + octroi MJ d'une mutation à sous-table ;
  5c → écran carrières Wizard ; 5d → panneau avantages narratif ; 5g → marchand + fiche équipement.
- **Retour arrière** : migration `5.0` = `DROP COLUMN` pur (colonnes brutes intactes) ; swap
  `select('*')` et chaque retrofit = revert de commit.

### 7.12 Références (recherche pratiques pro, 2026-09-02)

L'architecture retenue est le patron dominant du contenu multilingue en base pour un profil
*read-heavy, peu de langues* — pas une invention locale.

- **JSONB vs table séparée** : consensus « read-heavy + peu de langues → colonne JSONB ; beaucoup de
  langues + requêtes complexes → table séparée » (IntlPull *Database Localization Patterns 2026* ;
  dejimata *JSONify your Ruby Translations* ; *Mastering I18n with PostgreSQL JSONB*).
- **Chaîne de repli centralisée, décidée tôt** : spatie `laravel-translatable` (`$fallbackLocale`,
  `$fallbackAny`, `$missingKeyCallback`), Mobility (`fallbacks:`). Enclume : `locale → fr → colonne
  brute → null`.
- **Résolution en couche applicative + strip du blob** : Mobility, spatie, `parler`, `globalize`
  résolvent au rendu côté application, pas en SQL ; le blob brut qui fuite dans `toArray()`/`toJSON()`
  est traité comme un **bug** (spatie issue #47) → d'où le strip `*_i18n` de `localizeRef` (§7.4.2).
- **Backend enfichable** : Mobility sépare l'API de traduction du stockage → changer le backend d'un
  modèle sans toucher les consommateurs. `refI18n.js` = cette couture (§7.13).
- **Indexation** : GIN sur la colonne jsonb *seulement si on requête dedans*. Enclume trie / filtre
  sur la colonne brute (`orderBy('label')`, `where({family})`) → **aucun index ajouté en 5.0**.

### 7.13 Pérennité & adaptativité

- **Ajouter une langue** (EN/DE/JP) : `UPDATE ref_x SET name_i18n = name_i18n || jsonb_build_object('en', …)`
  par script de données. Aucune migration de schéma, aucun changement de `refI18n.js`.
- **Ajouter un champ traduisible** : `ADD COLUMN <champ>_i18n` (petite migration) + une entrée dans
  `REF_TRANSLATABLE`. Rien d'autre.
- **Locale par utilisateur / campagne** : `resolveRefField(row, field, locale)` prend déjà `locale` ;
  un seul point câble sa source le jour venu.
- **Tri / recherche par valeur traduite** dans une locale ≠ fr : passer ce point de lecture précis en
  SQL `ORDER BY COALESCE(name_i18n->>:locale, name_i18n->>'fr', name)` + index d'expression si le
  volume l'exige. Local à la requête, pas un changement d'architecture.
- **Une table qui explose** (dizaines de milliers de lignes) : bascule de cette table seule vers une
  table de traduction séparée en ne réécrivant que l'implémentation de `refI18n.js` pour ce cas — les
  ~15 consommateurs restent inchangés (couture unique).

---

## 8. Lot 6 — Messages `COMBAT_DECLARE_ERROR` serveur (découvert 2026-08-28)

**Écart avec ce plan** : la méthode d'audit §1 ne scanne que les `.jsx` client — elle n'a jamais vu le
texte FR émis par le **serveur**. `COMBAT_DECLARE_ERROR` (bannière de refus de déclaration, phase
ANNONCE, + message de chat `declare_error`) est émis depuis **~70 sites** avec un `message:` FR en dur
(`socketCombatAnnouncement.js`, `socketCombatExo.js`, `socketCombatHelpers.js`,
`socketCombatResolution.js`, `losService.js`, `movementBudgetService.js`). Violation directe de
`.claude/rules/i18n.md` (« le serveur n'émet jamais de FR figé »).

**Chaîne actuelle** `[VÉRIFIÉ 2026-08-28]` : serveur `emit(COMBAT_DECLARE_ERROR, { message, username })`
→ `useCombatSocket.js#onDeclareError({ message, ... })` → `setDeclareError(text)` + `addMessage` chat →
`CombatDeclareErrorBanner` (`sessionStore.declareError.message`) + `MessageRendererRegistry.renderDeclareError`.
Texte brut de bout en bout, aucune clé.

**Ce que ça implique** (pourquoi c'est un lot dédié, pas une correction au fil de l'eau) :
- Changement de schéma du payload `COMBAT_DECLARE_ERROR` : `{ message }` → `{ i18nKey, i18nParams }`
  (rétrocompatibilité pendant la transition à prévoir — `message` optionnel en repli).
- ~70 sites d'émission, dont plusieurs **dynamiques** (`Tir visé impossible : ${aimReasons.join(', ')}`,
  `Mode de tir ${fireMode} non disponible...`) → clés paramétrées + sous-listes de raisons elles-mêmes
  à cléer.
- Chaîne client à adapter : `useCombatSocket`, `sessionStore`, `CombatDeclareErrorBanner`,
  `MessageRendererRegistry`.
- Combat-critique (phase ANNONCE) → validation transport + scénario réel par famille de refus.

**Décision Saar (2026-08-28)** : différé ici. En attendant, un **swap de mot** « Assaut » → « Tir » a
été fait sur les ~9 messages concernés de `socketCombatAnnouncement.js` (cohérence terminologique avec
`docs/Old/PLAN_RW_DECLARE_DESIGN.md` lot B3 (chantier clos) ; ne corrige **pas** la violation i18n).

**Reste à écrire avant de coder** : inventaire exhaustif des sites (grep `COMBAT_DECLARE_ERROR` +
`WS.COMBAT_DECLARE_ERROR`), regroupement par familles de message, forme du helper de résolution
client, stratégie de transition (repli `message`).
