# PLAN_LOCALISATION — Résorption du texte en dur (i18n)

> 2026-07-23 · Plan temporaire (Règle 10, `docs/RegleDocumentaire.md`) — sera archivé et fusionné dans
> `docs/ASBUILT.md` une fois clos.
> Norme durable : `docs/SYSTEME/LOCALISATION.md` + `.claude/rules/i18n.md`.
> Statut (2026-07-24) : 🟢 **Lot 1 (Combat, 17 fichiers) entièrement clos** — `combatSections.js`
> migré (Segments 1-7, §3bis) + texte propre à chacun des 17 fichiers (§3ter). Zéro texte en dur
> restant, confirmé par ré-audit. Lots 2-4 non commencés.

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

### Lot 4 — Outils dés (2 fichiers) → `common.json` (`dice.*`, déjà une section)

`DicePanel`, `DiceCalibrationPage` (outil dev — vérifier avec Saar si ce dernier vaut la peine d'être
traduit ou si un outil interne peut rester en dur, décision produit mineure à trancher en ouvrant le
lot, pas ici).

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
ce chantier. Lots 2 (Équipement), 3 (Builder), 4 (Dés) non commencés.
