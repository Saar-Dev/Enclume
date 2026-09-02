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
> 🟡 **Lot 5 (contenu de catalogue `ref_*` en base, 10 tables) — architecture : colonne brute = FR +
> JSONB `<champ>_i18n` pour les langues ≠ fr (`docs/SYSTEME/LOCALISATION.md` §6 ; pratiques pro §7.12 ;
> adaptativité §7.13). **Phase A codée le 2026-09-02** (migration 318 + résolveur `refI18n.js` +
> câblage du catalogue parcouru : Wizard, marchand, panneaux d'octroi — 8 commits `8dc3ce1`→`7b25d4d`,
> §7.5/§7.7). Testé statiquement + smoke base réelle ; parcours navigateur non fait (session beta).
> **Phase B** : affichage des objets possédés (inventaire, combat, export PDF, mods), ratée par le plan
> initial, découverte au ré-audit — §7.7bis (relu site par site). Scindée : **B1** (projection propre,
> ~8 sites, patron Phase A) plan rédigé §7.15, **non codée** ; **B2** (noms d'armes en combat, emmêlé
> avec Lot 6) plan séparé à faire.**

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

## 7. Lot 5 — Contenu de catalogue `ref_*` en base (plan 2026-09-02, révisé après 2 analyses à charge)

### 7.1 Nature de la dette

La méthode d'audit du §1 ne scanne que les `.jsx` du client — elle ne voit pas le texte de jeu
**stocké en base** dans les tables `ref_*` (équipements, compétences, avantages, mutations,
carrières…), seedé depuis le *Livre de Base*. Ce texte est FR en dur dans des colonnes (`name`,
`label`, `description`, + colonnes de prose annexes — §7.3), affiché directement par les composants
(`equip.name`, sans `t()`). Même catégorie de dette que les Lots 1-4, autre entrepôt.

**Déclencheur** : `docs/Old/BUG WIZARD.md` bug #16 (`ref_advantages.name` = « Sens diminué (hearing) »,
anglais non traduit). Saar : l'architecture doit pouvoir accueillir EN/DE/JP sans réécriture (produit
**FR seul** aujourd'hui — `LOCALISATION.md` §1/§5 inchangés).

**Note (analyse à charge)** : corriger un contenu FR fautif (bug #16, mojibake…) **ne dépend pas** du
Lot 5 — c'est un `UPDATE` de la colonne brute, qui reste l'autorité FR (§7.4.1). Le Lot 5 ne prépare
**que** l'ajout d'une langue future.

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

Colonnes **traduisibles** (prose + libellés de catalogue saisis en admin) → couvertes. Codes /
formules / noms propres → hors périmètre (§7.9), pas dans la migration.

| Table | Lignes | Traduisible → `<champ>_i18n` | Hors périmètre |
|---|---|---|---|
| `ref_equipment` | 790 | `name`, `description`, `family`, `category` | `manufacturer`, `nation` (noms propres) · `damage_*`, `range`, `shock`, `fire_mode`, `caliber`, `rarity`, `ammo_effects`, `mod_slot`, `location`, `linked_attr`, `price_modifier`, `duration` |
| `ref_career_random_benefits` | 370 | `description` | `effects` (jsonb) |
| `ref_skills` | 249 | `label`, `description`, `family` | `id`, `parent`, `attr_1/2`, `marker` |
| `ref_advantages` | 79 | `name`, `description`, `special_rule` | `type` (code `advantage`/`disadvantage` — **déjà traduit client** `t('advantages.badge*')`, rien à faire) · `subtype` (code, `t('step3.subtype_labels.*')`) · `mod_*`, `mod_monthly_income_formula` |
| `ref_mutations` | 45 | `name`, `description`, `stack_effect`, `special_effect` | `subtype`, `mod_sex`, `mod_fertility`, `max_cumul_group` · `mod_*`, `natural_weapon_*_formula` |
| `ref_careers` | 37 | `name`, `description`, `geographic_origin_details` | `code`, `illustration`, `min_attributes_logic`, `ally_type`, `enemy_rule` |
| `ref_setbacks` | 27 | `name`, `description` | `effects` (jsonb) |
| `ref_backgrounds` | 22 | `name`, `description` *(NULL sur 22/22 — colonne `_i18n` ajoutée quand même, cf. §7.10)* | `type`, `code`, `parent_type`, `parent_code` |
| `ref_mutation_subtypes` | 8 | `name`, `description`, `special_trait` | `skill_bonus`, `immunity` (micro-format — §7.9) |
| `ref_genotypes` | 4 | `label`, `description` | `illustration_url` |

**`family` / `category` — corrigé après analyse à charge 2** : le plan initial les excluait comme
« taxonomie fermée curée par le dev ». Faux — l'outil admin `ref-equipment-tool.html` les saisit en
**texte libre** (`<input type="text" name="family">`), et `MerchantsPage.jsx` / `EquipmentCatalogPage.jsx`
les affichent **bruts** (clés d'arbre + `[...new Set(items.map(i => i.family))]` pour les filtres).
C'est du contenu classe-`name`. Sous le modèle §7.4.1 (FR en colonne brute) les inclure est quasi
gratuit : la valeur FR reste la chaîne brute, le regroupement client continue de keyer dessus, on
ajoute juste `<champ>_i18n`. Seul travail déférable (optionnel, utile à la 2ᵉ langue) : « regrouper
par code plutôt que par libellé » côté client.

**Champs de prose ratés par une approche « name/description » naïve** : `special_rule` (advantages),
`stack_effect` + `special_effect` (mutations), `geographic_origin_details` (careers), `special_trait`
(mutation_subtypes).

### 7.4 Architecture

#### 7.4.1 Modèle de stockage — le FR reste dans la colonne brute

**Révisé après analyse à charge 2 (2026-09-02).** Le plan initial mettait le FR *dans* `<champ>_i18n`
et rendait la colonne brute vestigiale → **drift à l'édition** (l'outil admin `ref-equipment-tool.html`
et `routes/equipment.js` écrivent la colonne brute ; le résolveur lisait `_i18n` → une édition de nom
serait devenue invisible), + backfill + retrofit de tous les chemins d'écriture.

Modèle retenu — **colonne d'origine = langue par défaut + repli** (patron Django `modeltranslation`,
Rails `globalize`) :

- **La colonne existante (`name`, `label`, `description`, `family`…) est l'autorité `fr`.** Inchangée.
  C'est déjà la cible des écritures (outil admin, `equipment.js` CRUD, seeds) → **aucun retrofit
  d'écriture, aucun drift possible**.
- **`<champ>_i18n jsonb` ne porte QUE les langues ≠ fr** : `{"en": "…", "de": "…"}`. Vide `{}`
  aujourd'hui (FR seul). **Jamais de clé `fr` dedans.**
- Ajouter une langue = peupler des clés `_i18n` par script de données. Aucune migration de schéma,
  aucun changement du résolveur.

**Migration `NNN_ref_catalog_i18n.js` (étape 5.0)** :
- `ALTER TABLE "<table>" ADD COLUMN IF NOT EXISTS "<champ>_i18n" jsonb NOT NULL DEFAULT '{}'::jsonb`
  pour chaque colonne traduisible du §7.3 (`IF NOT EXISTS` : métadonnée seule en PG 11+, pas de
  réécriture de table).
- **Aucun backfill** — le FR est déjà à sa place. DDL additif pur, donc trivialement idempotent et
  atomique.
- `down()` : `DROP COLUMN` de toutes (retour arrière pur — le FR n'est jamais touché).
- Round-trip vérifié **hors dépôt** (§7.11) — pas de `*.test.mjs` sous `server/`.
- **Numéro** : prochain entier libre vérifié sur `ls server/src/db/migrations/` **et**
  `knex_migrations` au moment de créer le fichier (317 au 2026-09-02).
- **Écart assumé vs `rules/migrations.md` « une table = un fichier »** : la règle vise la *création*
  d'une table et l'interdiction d'empiler un correctif sur une migration antérieure. Ici : un seul
  changement **additif transverse**, aucune migration antérieure modifiée, aucune table créée.
  Regrouper garantit la complétude (demande explicite de Saar) ; encore plus net sans backfill.
- **Avant d'écrire** : lire `docs/SYSTEME/CORE.md` § P52-P56. `nodemon` applique dès l'écriture du
  fichier sous `server/` → `SELECT knex_migrations` avant tout rappel manuel de `up()`.

#### 7.4.2 Résolveur — `server/src/lib/refI18n.js`  *(même commit que la migration)*

Résolution **en couche applicative** au point de projection (chemin de lecture de Mobility / spatie /
`parler` / `globalize` ; `COALESCE` SQL réservé au futur tri par valeur traduite — §7.13).

```js
// server/src/lib/refI18n.js
export const DEFAULT_LOCALE = 'fr'

export const REF_TRANSLATABLE = {
  ref_genotypes:              ['label', 'description'],
  ref_mutation_subtypes:      ['name', 'description', 'special_trait'],
  ref_backgrounds:            ['name', 'description'],
  ref_setbacks:               ['name', 'description'],
  ref_careers:                ['name', 'description', 'geographic_origin_details'],
  ref_mutations:              ['name', 'description', 'stack_effect', 'special_effect'],
  ref_advantages:             ['name', 'description', 'special_rule'],
  ref_skills:                 ['label', 'description', 'family'],
  ref_career_random_benefits: ['description'],
  ref_equipment:              ['name', 'description', 'family', 'category'],
}

// locale par défaut → colonne brute ; autre langue → _i18n[locale] sinon repli colonne brute
export function resolveRefField(table, row, field, locale = DEFAULT_LOCALE) {
  if (row == null) return null
  if (locale === DEFAULT_LOCALE) return row[field] ?? null
  return row?.[`${field}_i18n`]?.[locale] ?? row[field] ?? null
}

export function localizeRef(table, row, locale = DEFAULT_LOCALE) {
  if (row == null) return row
  const out = {}
  for (const [k, v] of Object.entries(row)) if (!k.endsWith('_i18n')) out[k] = v  // jamais au client
  for (const f of REF_TRANSLATABLE[table] ?? []) out[f] = resolveRefField(table, row, f, locale)
  return out
}

export const localizeRefRows = (table, rows, locale = DEFAULT_LOCALE) =>
  rows.map(r => localizeRef(table, r, locale))
```

- `locale === 'fr'` (cas unique aujourd'hui) → `localizeRef` = clone + strip des clés `_i18n` ; les
  champs sont renvoyés **inchangés** depuis la colonne brute. Prouvablement sûr : sortie == entrée
  moins des clés qui n'existaient pas avant la migration.
- `table` en 1ᵉʳ paramètre de `resolveRefField` : symétrie + permet plus tard d'asserter
  `field ∈ REF_TRANSLATABLE[table]`.
- Test pur `server/src/lib/refI18n.test.mjs` (aucune base) : cas `fr` (pass-through + strip effectif),
  cas `en` présent, cas `en` absent → repli colonne brute, `row` null, table inconnue, `''` inchangé.
- **Couture unique** : jamais dupliqué par table/service, jamais de repli client (`AGENTS.md` §3,
  `LOCALISATION.md` §4). Un futur changement de backend pour *une* table ne touche que ce module —
  « backend enfichable » de Mobility (§7.13).

#### 7.4.3 Câblage des projections de lecture

Chaque point où une ligne `ref_*` (ou une sous-liste jointe) part vers le client passe par
`localizeRef` / `localizeRefRows`. Le client reçoit du texte résolu, jamais `_i18n`. Sûr par
construction (7.4.2). **Aucun chemin d'écriture touché** (§7.4.1).

### 7.5 Découpage — deux phases

**Phase A — catalogue parcouru par l'utilisateur** (Wizard, marchand, panneaux d'octroi MJ). **Fait
2026-09-02.**

| Étape | Contenu | Commit |
|---|---|---|
| **5.0** | migration `318_ref_catalog_i18n` (27 colonnes) + `refI18n.js` + `refI18n.test.mjs` | `8dc3ce1` |
| **5.1** | `routes/character/ref.js` — `/genotypes`, `/skills`, `/mutations` (+ `subtable[]`), `/advantages` | `7ede3a5` |
| **5.2a** | `creationService.getStep4RefData` (backgrounds, careers, career_random_benefits, setbacks) | `4f63f37` |
| **5.2b** | `creationService.getStep3RefData` + `getStep5RefData` (mutations, subtypes, advantages) | `4ec29a4` |
| **5.2c** | `creationService` jointures `ref_skills` (skill picker) + `getStep3State` (alias SQL) | `698db50` |
| **5.3a** | `tradeService.getCatalog` (`ref_equipment`, après `evaluateItem`) | `a3a95b5` |
| **5.3b** | `mutationService.getMutations` (jointure, alias SQL) | `c131cab` |
| **5.3c** | `advantageService.getAdvantages` (jointure) + `add/grantAdvantage` (`allRefAdvantages` → `snapshot_data` propre) | `7b25d4d` |

**Phase B — affichage des objets possédés par le personnage** (inventaire, combat, export PDF, mods).
**Non commencée** — découverte par le ré-audit post-5.3 : le plan §7.7 initial était Wizard-centré et
a raté cette surface (~équivalente à la Phase A, dont du code socket combat-critique). Inventaire
§7.7bis. Nécessite son propre plan + analyse à charge.

Une étape par tour (plan → analyse à charge → code — CLAUDE.md). Pas de confirmation navigateur par
étape (§3ter) ; validation §7.11.

### 7.6 Ce qui n'est PAS fait (et pourquoi)

- **Phase B** (§7.7bis) : inventaire / combat / export / mods. Plan dédié requis, surtout le code
  socket combat.
- **Retrofit des chemins d'écriture** (`equipment.js` CRUD, import admin, seeds) : **rien à faire** —
  le FR reste dans la colonne brute, déjà leur cible (§7.4.1). *Exception traitée en 5.3c :
  `char_advantages.snapshot_data` fait `JSON.stringify` d'une ligne `ref_advantages` → localisée en
  amont pour ne pas persister les clés `_i18n` vides. Vérifier le même patron `snapshot`/`custom_*` en
  Phase B (`char_inventory.custom_name`/`custom_desc`).*
- **Peuplement d'une 2ᵉ langue** : hors sujet tant qu'aucune langue ≠ fr n'est un objectif produit. Le
  jour venu : script `SET <champ>_i18n = <champ>_i18n || '{"en":…}'` + câbler la source de `locale` en
  **un** point + éventuel « group by code » client. Aucune migration, aucun changement du résolveur.
- **Phrases FR composées côté serveur** incorporant un libellé `ref_*` (`creationService`
  `checkCareerEligibility`/`formatEligibilityReason`, `AppError` avec `refAdv.name`, etc.) → dette
  **Lot 6**. `checkCareerEligibility` **n'a pas** été touché en 5.2 (le plan §7.7 le prévoyait à
  tort — résoudre le libellé encapsulé ne corrige pas la phrase figée).
- Colonnes micro-format (`skill_bonus`, `immunity`, `caliber`, `price_modifier`, `duration`,
  `mod_slot`) → notées, décision différée.
- Lots 1-4 (validation navigateur), Lot 6.

**État du seam** : côté catalogue (Phase A), complet et *inerte* (FR seul → `localizeRef` =
pass-through + strip). Côté personnage (objets possédés), **non câblé** — Phase B.

### 7.7 Phase A — consommateurs câblés (as-built 2026-09-02)

**5.1 `routes/character/ref.js`** — `/genotypes`, `/skills`, `/mutations` (+ `subtable[]`),
`/advantages` → `localizeRef(Rows)`.

**5.2 `creationService.js`** :
- `getStep4RefData` : `ref_backgrounds`, `ref_careers`, `ref_career_random_benefits`, `ref_setbacks`
  → `localizeRefRows`. Jointures `ref_skills` (bgSkills/careerSkills `rs.label`/`rs.family`) → fetch
  `ref_skills` localisé séparé, rattaché par id (`skillRef` Map).
- `getStep3RefData` : `ref_mutations` + `ref_mutation_subtypes` → `localizeRefRows`.
- `getStep5RefData` : `ref_advantages` → `localizeRefRows` (avant le filtre `polaris_latent`).
- `getStep3State` : alias SQL `rm.name`/`rms.name` → `SELECT` tire aussi `*_i18n`, `resolveRefField`
  sur synthetic row dans `meta`.
- `getStep2State` : `genotype_id` seul, rien. `reconcileCreation` : lectures internes (calcul), pas
  de texte au client, pas de `{...row}` → `INSERT` — rien.
- `checkCareerEligibility` : **NON touché** → Lot 6 (phrase FR figée).

**5.3** :
- `tradeService.getCatalog` : `localizeRef('ref_equipment', item)` dans `catalog.push`, **après**
  `evaluateItem` (règles marchand écrites en FR contre les valeurs brutes).
- `mutationService.getMutations` : jointure `rm.name`/`rm.description`/`rmst.name` → `SELECT` + `*_i18n`
  + `resolveRefField`. `addMutation` : inchangé.
- `advantageService` : `getAdvantages` (jointure `ra.*` → `SELECT` + `*_i18n` + `resolveRefField`) ;
  `add/grantAdvantage` : `allRefAdvantages` → `localizeRefRows` (rend `refAdv` propre pour
  `snapshot_data` **et** le retour de `grantAdvantage`). `removeAdvantage` : jointure mécanique,
  inchangé.

### 7.7bis Phase B — affichage des objets possédés

Ré-audit `ref_*` sur tout `server/src` (2026-09-02, post-5.3), **relu site par site** (le premier jet
au `grep` sur-comptait). Deux sous-phases.

#### B1 — projection propre (jointure/alias → client ou PDF, patron Phase A)

| Fichier / site | Champs à résoudre | Champs laissés bruts (mécanique) | Écran |
|---|---|---|---|
| `inventoryService.getInventory` **et** `getItemWithRef` (join `ref_equipment`, alias `ref_*`) | `ref_name`, `ref_description`, `ref_family`, `ref_category` | `ref_location`, `ref_malus_cat`, `ref_caliber`, `ref_damage_h`, `ref_fire_mode`, … (~30) | inventaire PJ |
| `char-sheet.js` `/macro-options` (join `ref_skills`) | `label`, `family` | — | picker macro |
| `char-sheet.js` enrich programme (`ref_equipment` `.first()`, ×4 : l.1711/1749/2576/2634) | `name`, `description` (→ `program_name`/`program_description`) | — | fiche perso |
| `characterExportService.js` (join `ref_skills` l.47) | `rs.label`, `rs.family`, `rs.description`, `parent_rs.label as parent_label` | `attr_1/2`, `marker`, `is_category` | export PDF |
| `characterExportService.js` `ref_genotypes` l.67 | **vérifier** si `genotypeRow.label`/`description` affichés dans l'export | `mod_*` | export PDF |
| `battlemaps.js` weaponRows l.272 | `ref_equipment.name`, sous-requête `rs.label as skill_label` | `ref_category` (logique `resolveHandWeapons` COM24), `ref_damage_h`, `ref_shock`, `ref_fire_mode`, `ref_caliber` | fenêtre combat MJ |
| `battlemaps.js` armorRows l.305 | `ref_equipment.name` | `ref_equipment.location` (code) | fenêtre combat MJ |
| `battlemaps.js` naturalWeaponRows l.319 | `rm.name` | `natural_weapon_formula`, `natural_weapon_requires_grapple` | fenêtre combat MJ |
| `modingService.getModingState` — `weaponsRaw` (`q.raw`) + `installableMods` (builder) | `re.name` (des deux) | `re.family`, `re.category` (filtres de requête) | panneau mod |

#### B2 — noms d'armes en combat (emmêlé, **plan séparé**)

- `socketCombatHelpers.js` : `weapon.ref_name` dans messages de chat (l.3502) / `skillLabel` (l.3600),
  **+ comparaison en dur `weapon.ref_name !== 'Klauss'` (l.3499)** → localiser casserait ce test en
  langue ≠ fr. Débusquer toutes les comparaisons `ref_name === '…'` avant d'agir.
- `socketCombatAnnouncement.js` l.293/326/439, `socketCombatExo.js` l.75/273 :
  `COALESCE(<...>.label_override, ref_equipment.name) as display_name` — chaîne de repli custom→catalogue.
- `socketCombatHelpers.js:2508` : `COALESCE(drone_weapons.label_override, drone_weapons.name, ref_equipment.name)`.
- `socketCombatHelpers.js:2868` : mod `re.name` dans `installedMods`.
- Ces messages sont **déjà** du FR composé serveur → chevauche **Lot 6**. Analyse à charge dédiée
  obligatoire (combat-critique).

#### Confirmé HORS Phase B (laisser brut — vérifié par lecture)

- Tous les `.where('ref_equipment.category'|'family', '…')` : filtres contre le texte RAW des règles.
- Sélects mécaniques : `shield_atk_malus`, `natural_weapon_formula`, `malus_cat`, `location`,
  `mod_key`, `bonus`, `damage_h`, `shock`, `mod_sex`, `mod_fertility`.
- `weaponModService.js` (l.119 : `re.mod_key`/`re.bonus` seulement), `identityService.js`
  (l.70/75 : `mod_sex`/`mod_fertility`/`mod_identity`) : **entièrement hors périmètre.**
- `modingService.js` l.93/94 (`weaponRef`/`modRef` `.first()`) : validation `family`/`category`, aucun
  texte affiché.
- Les dizaines de `db('ref_genotypes'|'ref_skills').where({id}).first()` de `combatantContextService`,
  `damageService`, `movementBudgetService`, `fatigueService`, `fallDamageService`, `coldExposureService`,
  `environmentalHazardService`, `woundEvolutionService`, `socketDice`, `socketCombatState`,
  `socketEntity`, `gmArbitratedTestService` : modificateurs numériques seulement.

**Point d'attention B1** : `char_inventory` a `custom_name`/`custom_desc` (override joueur) — le client
affiche `custom_name || ref_name` ; la Phase B1 ne touche que `ref_name` (côté catalogue), `custom_*`
reste tel quel (texte joueur, hors i18n).

### 7.8 Invariant

Le **FR est autoritaire dans la colonne brute**, jamais dupliqué (§7.4.1). La résolution de la langue
affichée est **exclusivement côté serveur, via `refI18n.js`, résolveur unique** (couture unique —
§7.4.2). Jamais dupliquée par table ou par service ; jamais de repli côté client. Le client reçoit une
chaîne déjà résolue (`equip.name`), jamais l'objet `*_i18n`. Corollaire de `LOCALISATION.md` §4 (le
client ne décide jamais de la langue) et `AGENTS.md` §3 (une propriété = une autorité unique).

### 7.9 Hors périmètre du Lot 5

- `ref_advantages.type` : code `advantage`/`disadvantage` **déjà traduit côté client**
  (`t('advantages.badge*')`) — pas une dette, rien à faire.
- Colonnes à micro-format structuré ou mono-token : `ref_mutation_subtypes.skill_bonus`
  (`"Acrobatie/Équilibre:+3"`) / `immunity` (`"vertige"`), `ref_equipment.caliber` / `price_modifier`
  (`"x niv"`) / `duration` (`"16 h"`) / `mod_slot`. Notées, décision différée.
- Toute langue ≠ `fr` et le champ `locale` réel (utilisateur / campagne) — §7.6.
- Regroupement client par code (au lieu du libellé `family` / `category`) — utile seulement à la 2ᵉ
  langue, différé (§7.6).
- Phrases FR **composées côté serveur** incorporant un libellé `ref_*` — dette type Lot 6.
- Correction du **contenu FR** (fautes, anglais résiduel bug #16, mojibake) → `UPDATE` de colonne
  brute, indépendant du Lot 5 (§7.10).
- Lots 1-4 (validation navigateur), Lot 6.

### 7.10 Trouvailles hors i18n (routées séparément — se corrigent par `UPDATE` de colonne brute, sans attendre le Lot 5)

- `ref_genotypes.description` : double-encodage UTF-8 sur les 4 lignes
  (`"NÃ© avec les mutations nÃ©cessaires Ã  la survie"` au lieu de
  `"Né avec les mutations nécessaires à la survie"`). → `UPDATE` de la colonne brute, hors Lot 5.
- `ref_backgrounds.description` : `NULL` sur 22/22 lignes — colonne jamais peuplée (le contenu
  existe-t-il dans le *Livre de Base* ?). → à peupler (colonne brute), hors Lot 5.

### 7.11 Validation (Phase A)

**Testé** :
- Migration 5.0 : appliquée par nodemon (batch 10), vérifiée **en lecture** — 27 colonnes `jsonb
  NOT NULL DEFAULT '{}'`, zéro écart sur les 10 tables. `down()` (`DROP COLUMN IF EXISTS`) non
  exécuté (trivial) ; script `verify_318.js` (scratchpad) disponible pour le cycle complet.
- Résolveur : `node --test server/src/lib/refI18n.test.mjs` — 14/14.
- Chaque étape 5.1 → 5.3c : `node --check` + `git diff --check` ; smoke test sur base réelle
  (résolution `== colonne brute` en fr, zéro fuite `*_i18n`, colonnes non traduisibles préservées) —
  couvre `ref_genotypes`/`skills`/`advantages`/`mutations`/`equipment` (790)/`backgrounds`/`careers`/
  `setbacks`/`career_random_benefits` + les jointures (1047 lignes bgSkills/careerSkills, subtable
  mutations, `snapshot_data` `refAdv`).

**Non testé** :
- Tout parcours navigateur réel — session beta groupée (décision Saar §3ter).
- Cycle `down()`/`up()` réel de la migration 318.
- `cd client && npm run build` — Phase A ne touche aucun `.jsx` (serveur seul), non lancé.

**⚠️ Clos partiel** : Phase B (§7.7bis) non faite.

**Retour arrière** : 5.0 = `DROP COLUMN` pur (FR jamais touché) ; 5.1 → 5.3c = revert de commit.

### 7.12 Références (recherche pratiques pro, 2026-09-02)

L'architecture retenue est le patron dominant du contenu multilingue en base pour un profil
*read-heavy, peu de langues* — pas une invention locale.

- **JSONB vs table séparée** : consensus « read-heavy + peu de langues → colonne JSONB ; beaucoup de
  langues + requêtes complexes → table séparée » (IntlPull *Database Localization Patterns 2026* ;
  dejimata *JSONify your Ruby Translations* ; *Mastering I18n with PostgreSQL JSONB*).
- **Colonne d'origine = langue par défaut + repli** : Django `modeltranslation` (colonne d'origine +
  `field_<lang>`), Rails `globalize` (les colonnes du modèle sont le fallback). Enclume : colonne
  brute = `fr`, `_i18n` = langues supplémentaires. Repli : `locale → colonne brute (= fr) → null`.
- **Résolution en couche applicative + strip du blob** : Mobility, spatie, `parler`, `globalize`
  résolvent au rendu côté application, pas en SQL ; le blob brut qui fuite dans `toArray()`/`toJSON()`
  est traité comme un **bug** (spatie issue #47) → d'où le strip `*_i18n` de `localizeRef` (§7.4.2).
- **Backend enfichable** : Mobility sépare l'API de traduction du stockage → changer le backend d'un
  modèle sans toucher les consommateurs. `refI18n.js` = cette couture (§7.13).
- **Indexation** : GIN sur la colonne jsonb *seulement si on requête dedans*. Enclume trie / filtre
  sur la colonne brute (`orderBy('label')`, `where({family})`) → **aucun index ajouté en 5.0**.

### 7.13 Pérennité & adaptativité

- **Ajouter une langue** (EN/DE/JP) : `UPDATE ref_x SET <champ>_i18n = <champ>_i18n || jsonb_build_object('en', …)`
  par script de données + câbler la source de `locale` en un point. Aucune migration de schéma, aucun
  changement de `refI18n.js`.
- **Ajouter un champ traduisible** : `ADD COLUMN <champ>_i18n` (petite migration) + une entrée dans
  `REF_TRANSLATABLE`. Rien d'autre.
- **Locale par utilisateur / campagne** : `resolveRefField(table, row, field, locale)` prend déjà
  `locale` ; un seul point câble sa source le jour venu.
- **Tri / recherche par valeur traduite** dans une locale ≠ fr : passer ce point de lecture précis en
  SQL `ORDER BY COALESCE(<champ>_i18n->>:locale, <champ>)` + index d'expression si le volume l'exige.
  Local à la requête, pas un changement d'architecture.
- **Une table qui explose** (dizaines de milliers de lignes) : bascule de cette table seule vers une
  table de traduction séparée en ne réécrivant que `refI18n.js` pour ce cas — consommateurs inchangés
  (couture unique).
- **Repli du FR** (si un jour produit EN-first) : migration one-shot qui fait rentrer `fr` dans
  `<champ>_i18n`, `DEFAULT_LOCALE` change. Non prévu.

### 7.15 Phase B1 — plan d'exécution (rédigé 2026-09-02)

Périmètre : les sites B1 de §7.7bis. Aucun `.jsx`, aucune migration, aucune écriture, aucun contenu
FR modifié — projection de lecture uniquement. FR seul → inerte (résolution = valeur brute).

#### B1.0 — helper `localizeRefAliased` dans `refI18n.js` (+ tests)

Les sites B1 sont tous des **jointures à colonnes aliasées** (`ref_equipment.name as ref_name`), pas
des lignes `ref_*` complètes. Répéter le synthetic row de la Phase A (`resolveRefField(table,
{ name: row.ref_name, name_i18n: row.ref_name_i18n }, 'name')`) ferait 4+ lignes verbeuses par site.
Nouveau helper :

```js
// La requête doit aliaser aussi <champ>_i18n : `ref_equipment.name_i18n as ref_name_i18n`.
// aliasMap : { <alias dans la row> : <champ ref_*> }
export function localizeRefAliased(table, row, aliasMap, locale = DEFAULT_LOCALE) {
  if (row == null) return row
  const out = {}
  for (const [k, v] of Object.entries(row)) if (!k.endsWith('_i18n')) out[k] = v
  for (const [alias, field] of Object.entries(aliasMap)) {
    out[alias] = resolveRefField(
      table,
      { [field]: row[alias], [`${field}_i18n`]: row[`${alias}_i18n`] },
      field, locale,
    )
  }
  return out
}
```

Tests (`refI18n.test.mjs`) : fr = pass-through + strip des `*_i18n` aliasés ; `en` présent/absent ;
`row` null ; jointure vide (`row.ref_name` null, `row.ref_name_i18n` null → `null`, cas item custom
`equipment_id` NULL) ; **alias présent sans `_i18n` correspondant → repli valeur brute** (documente le
mode d'échec de la convention `<alias>_i18n`).

**Commit isolé** (élargit la couture, comme 5.0).

#### B1.1 → B1.5 — câblage (un commit chacun, `node --check` + smoke base réelle)

| Étape | Fichier | Geste |
|---|---|---|
| B1.1 | `inventoryService.js` | `getInventory` + `getItemWithRef` : `SELECT` ajoute `ref_equipment.{name,description,family,category}_i18n as ref_{…}_i18n` ; `localizeRefAliased('ref_equipment', row, { ref_name:'name', ref_description:'description', ref_family:'family', ref_category:'category' })` **au bout** (après le calcul d'encombrement). `getItemWithRef` : appelé par ~10 sites (add/equip/move/ammo → réponses client) — le localiser dans la fonction les couvre ; vérifier qu'aucun appelant ne fait `{...item}` → `INSERT` (le strip `_i18n` protège de toute façon). |
| B1.2 | `routes/character/char-sheet.js` | `/macro-options` : `ref_skills.{label,family}_i18n` + `localizeRefAliased('ref_skills', …, { label:'label', family:'family' })`. Enrich programme ×4 : `.select` ajoute `name_i18n`/`description_i18n`, `resolveRefField('ref_equipment', ref, 'name'/'description')` (ou petit helper local `enrichProgramName`) |
| B1.3 | `services/characterExportService.js` | **uniquement** la jointure `ref_skills` : `_i18n` sur `rs.{label,family,description}` + `parent_rs.label_i18n` ; `localizeRefAliased`. `ref_genotypes` l.67 : **vérifié HORS périmètre** — `genotypeRow` sert seulement à `getGenotypeModForAttr` (l.74, mécanique) ; l'export renvoie `genotype_id` (code), jamais le libellé. |
| B1.4 | `routes/battlemaps.js` | weaponRows : `ref_equipment.name_i18n` + sous-requête `skill_label` → tirer aussi `rs.label_i18n` ; résoudre `name` + `skill_label`. **`ref_category` reste brut** : dual-usage — alimente `resolveHandWeapons` (compare `=== 'Bouclier'` / `'Arme de contact'`), le localiser casserait la logique (landmine type `!== 'Klauss'`). S'il est *aussi* affiché dans la fenêtre MJ → même report que §7.9 (regrouper par code client), pas en B1. armorRows : `name`. naturalWeaponRows : `rm.name_i18n` + `resolveRefField('ref_mutations', …)` |
| B1.5 | `services/modingService.js` | `weaponsRaw` (`q.raw`) : ajouter `re.name_i18n` au `SELECT` **et au `GROUP BY`** (jsonb est groupable en PG) ; `.rows.map` résout `re.name`. `installableMods` (builder) : `ref_equipment.name_i18n` + `localizeRefAliased` |

#### Validation B1

- `node --check` + `git diff --check` par fichier.
- `node --test refI18n.test.mjs` (B1.0).
- Smoke base réelle par étape : résolution `== colonne brute` en fr, zéro `*_i18n` dans la sortie,
  champs mécaniques (`ref_category`, `ref_location`, `damage_h`…) **inchangés et présents**.
- **Non testé** : parcours navigateur (session beta) ; `characterExportService` = site le moins
  vérifiable (`node --check` ne teste pas un .xlsx généré ; confiance reportée des tests B1.0 + smoke
  de la requête brute) → « ⚠️ PDF réel non généré » en clôture.
- Retour arrière : revert de commit par étape ; B1.0 = retrait du helper (aucun appelant après revert
  des B1.x).

#### Hors périmètre B1

- B2 (noms d'armes combat) — plan séparé.
- `char_inventory.custom_name`/`custom_desc` — texte joueur, jamais i18n.
- Les filtres `.where('ref_equipment.category', …)` et les sélects mécaniques (§7.7bis).

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
