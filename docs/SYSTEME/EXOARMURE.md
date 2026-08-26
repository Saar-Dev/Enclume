# SYSTEME/EXOARMURE.md — Architecture exo-armure (schéma, services, routes, catalogue)

> Audit de compréhension approfondie 2026-08-26 (suite, priorité haute — chantier actif) : §5/§8
> reconfirmés au caractère près contre `CombatExoActionWindow.jsx` — « se relever » et « passer le
> tour » sont bien les deux seules actions réellement câblées (commentaire du code lui-même : portée
> volontairement étroite, armement/hardpoints au Lot C). Trouvaille réelle : §7 citait une route
> `GET /api/exo-equipment` et un fichier `exoEquipment.js` qui n'existent pas — le catalogue exo passe
> en réalité par la route générique `GET /api/equipment` (confirmé dans `ExoSystemsPanel.jsx`) depuis
> la fusion §1. Valeurs `family` corrigées (`Exo-arme`/`Exo-systeme`, pas `Systeme`) — vérifiées en
> base réelle, pas seulement dans le code.
> Source : `docs/PLANS/PLAN_EXOARMURE.md` (Lots 1-4, Lot B, catalogue §12-§14, illustration §15) — le
> plan garde le détail du raisonnement et des décisions ; ce document garde l'état construit.
> Règles RAW et intention de conception (attributs, dégâts, Intégrité, Incidents) : `docs/MANUELS/
> MANUEL_EXOARMURE.md` — **ne pas dupliquer ici**, seulement référencer. Intégration au moteur de
> combat (contexte de Test, substitution FOR→EXF, routage pilote) : `docs/SYSTEME/COMBAT.md` §"Contexte
> de Test d'un combattant" — également référencé, pas répété.
> Vocabulaire : `docs/VOCABULARY.md` (Exo-armure, Pilote, Exo-Force, Intégrité, Avarie, Manœuvre
> d'armure, Source exclusive).
>
> **Périmètre couvert par ce document** : les 16 modèles RAW prémade et leur catalogue d'équipement
> sont entièrement construits et seedés. Les mécaniques d'Incident/Réparation/pression environnementale
> (MANUEL §4.9-§4.12) sont écrites en RAW mais **non codées** — signalé explicitement à chaque section
> concernée, jamais omis silencieusement.

---

## Vue d'ensemble — deux niveaux, jamais fusionnés

Une exo-armure est un **personnage séparé de son pilote** (`characters.type='exo'`), jamais une
extension de la fiche du pilote — aucune stat n'est jamais copiée du pilote vers l'exo ni l'inverse.
Deux niveaux de données distincts, avec le même schéma dupliqué exprès (catalogue vs instance) :

| Niveau | Rôle | Tables |
|---|---|---|
| **Catalogue** (modèle) | Les 16 armures RAW prémade + leur équipement de série — géré en admin, jamais modifié par un joueur | `ref_exo_templates`, `ref_exo_equipment`, `ref_exo_template_equipment`, `ref_exo_template_computers` |
| **Instance** (personnage) | Une exo-armure réelle jouée en campagne ou au Coffre — état vivant, éditable | `exo_sheet`, `exo_systems`, `exo_weapons`, `exo_computers`, `exo_programs` |

`applyExoTemplate` (§3) est le seul pont entre les deux : il **copie** (jamais ne référence) un modèle
catalogue vers une instance, au moment où un joueur/MJ choisit un modèle pour son exo-armure.

---

## 1. Schéma — catalogue

### `ref_exo_templates` (`71_ref_exo_templates.js`, contraintes `168_...`, seed `307_...` — 16 lignes)

> **Corrigé (audit 2026-08-26)** : numéros de migration périmés (233/243/252/263 → tous réattribués à
> d'autres tables par la refonte 2026-08-22). Vérifié directement dans `71_ref_exo_templates.js`/
> `168_ref_exo_templates_constraints.js`/`307_ref_exo_templates_seed.js`.

PK `id`. `name`, `category` (CHECK exo-alpha/exo-0…6/exo-omega), `environment` (CHECK submarine/
surface/hybrid/atmospheric/spatial/industrial), 3 profondeurs, `base_exoforce`, `base_blindage`,
2 vitesses de base + 2 modes de mouvement (CHECK vit/pilot/blocked), `speeds_extra` jsonb (vitesses
secondaires narratives, ex. propulseur — non consommé par le calcul de mouvement), 2 malus
d'Initiative, `manufacturer`/`price`/`rarity`/`tech_level`/`autonomy` (commerce), `illustration_url`
(text, nullable, créée directement dans `71_ref_exo_templates.js` — §6).

### `ref_exo_equipment` — **TABLE SUPPRIMÉE, corrigé (audit 2026-08-26) : fusionnée dans `ref_equipment`**

> Ce document décrivait `ref_exo_equipment` comme une table vivante et séparée, avec une justification
> détaillée de pourquoi elle devait le rester. **Vérifié faux** : aucune trace de création de cette
> table dans `server/src/db/migrations/` (recherche exhaustive) — seule mention restante, dans le
> **contexte** d'un ticket `bug_tickets` déjà marqué `resolved` (`c9915238-...`, "Catalogue marchand
> ignore ref_exo_equipment"). La fusion (`docs/Old/PLAN_EXOEQ_FUSION.md`) a bien eu lieu : les
> systèmes/armes exo vivent désormais **dans `ref_equipment`** (`family='Exo-arme'`/`'Exo-systeme'` —
> corrigé 2026-08-26, citait `'Systeme'` sans le préfixe ; vérifié en base réelle, deux valeurs
> exactes, `ExoSystemsPanel.jsx` interroge aussi `family='Equipement Général'` pour les capteurs
> portables — seed `303_ref_equipment_seed.js`), au même titre que l'équipement humain —
> `tradeService.js:getCatalog`
> (`db('ref_equipment').select('*')`) les voit donc déjà nativement, sans code séparé à écrire (d'où
> le ticket déjà résolu).

### `ref_exo_template_equipment` (`70_...` création, contraintes `167_...`, FK `258_...`, seed
`308_...` — 431 lignes/16 modèles) — loadout de série

> **Corrigé (audit 2026-08-26)** : ce document décrivait deux FK (`equipment_id` → `ref_exo_equipment`,
> `ref_equipment_id` → `ref_equipment`). Vérifié dans `70_ref_exo_template_equipment.js`/
> `258_ref_exo_template_equipment_foreign_keys.js` : **une seule** colonne équipement existe,
> `ref_equipment_id` → `ref_equipment` RESTRICT — conséquence directe de la fusion ci-dessus, plus de
> `equipment_id` du tout.

PK `id`. `template_id` → `ref_exo_templates` CASCADE. `family` (CHECK arme/systeme). `ref_equipment_id`
→ `ref_equipment` RESTRICT, `label_override` text — contrainte `chk_exo_template_equipment_source` :
l'un des deux doit être renseigné. `level` (nullable — uniquement les systèmes facturés "×niv."). `sort_order`.

### `ref_exo_template_computers` (`69_...` création, contraintes `166_...`, FK `257_...`, seed
`309_...`) — 0 à 2 lignes par modèle

> **Corrigé (audit 2026-08-26)** — numéros vérifiés directement ; par coïncidence, `257` reste
> aujourd'hui `ref_exo_template_computers_foreign_keys.js` (toujours exo, contrairement à la plupart
> des autres numéros de ce document).

PK `id`. `template_id` CASCADE. `role` (CHECK valeurs `principal`/`secours` seulement — **pas** de
contrainte d'unicité, rien n'empêche en base deux lignes `principal` sur le même modèle ; RAW l'interdit
et c'est vérifié vrai sur les 16 modèles seedés, mais ce n'est pas un invariant appliqué par le schéma).
`gen`, `nt` (Génération/NT RAW de l'ordinateur). `sort_order`.

---

## 2. Schéma — instance

### `exo_sheet` (`44_exo_sheet.js` — corrigé 2026-08-26 : création consolidée unique depuis la refonte
migrations 2026-08-22, stats de base/notes/colonnes jsonb toutes incluses directement dans ce seul
fichier, plus une évolution en 4 migrations séparées 233/254/255/257 comme décrit précédemment) — PK
`character_id`
`template_id` → `ref_exo_templates` SET NULL (référence d'origine seulement, pas une dépendance de
calcul — voir §3). `pilot_character_id` → `characters` SET NULL, **index unique partiel** (un pilote ne
vole jamais deux exo-armures à la fois).

Intégrité (3 jauges indépendantes, `docs/VOCABULARY.md` "Intégrité") : `itg_structure_max/current`,
`itg_exosquelette_max/current`, `itg_generator_max/current` — int NOT NULL default 20 chacune.

Avaries (`docs/VOCABULARY.md` "Avarie") : `avaries_legeres/moyennes/graves/critiques/catastrophiques`
int NOT NULL default 0. Pas de colonne pour le palier `destruction` (immédiat, pas de compteur
persistant à ce palier).

19 colonnes de stats de base — **copiées** depuis `ref_exo_templates` par `applyExoTemplate` (§3),
jamais lues par JOIN live après leur copie (colonnes créées directement dans `44_exo_sheet.js`, pas "migration 254") : `category`, `environment`, 3 profondeurs,
`base_exoforce`, `base_blindage`, 2 vitesses, 2 modes de mouvement, `speeds_extra`, 2 malus Init,
`manufacturer`/`price`/`rarity`/`tech_level`/`autonomy`. Toutes nullables **sans défaut** — divergence
délibérée par rapport au catalogue (un défaut non-nul romprait la sentinelle ci-dessous).

**Sentinelle "armure non configurée"** : `category IS NULL`. Avant ce modèle de copie c'était
`template_id IS NULL` — un exo peut aujourd'hui avoir un `template_id` (référence d'origine) tout en
étant "non configuré" si ses stats de base n'ont jamais été copiées (cas théorique seulement,
`applyExoTemplate` pose toujours les deux ensemble dans la même transaction).

4 colonnes narratives (`44_exo_sheet.js`, pas "255" — corrigé 2026-08-26), jamais calculées, aucun équivalent catalogue : `taille`, `type_batterie`,
`type_coque`, `notes`.

**Retiré** (257, jamais consommé en production) : `equipped_systems`/`hardpoints`/`isolated_systems`/
`damaged_systems` (jsonb) — remplacés par les tables dédiées ci-dessous.

### `exo_systems` / `exo_weapons` (257, source exclusive 260/262) — équipement réellement installé
Même patron `equipment_id`/`ref_equipment_id`/`label_override` que le catalogue (§2 ci-dessous), plus
`integrite_max`/`integrite_current` propres à **cette ligne** (un système/une arme installée a sa
propre jauge d'Intégrité, distincte des 3 jauges globales de `exo_sheet`). `exo_systems` a en plus
`level` (systèmes facturés "×niv.") ; `exo_weapons` n'en a pas (aucune arme exo n'est facturée ainsi).

### `exo_computers` (`42_exo_computers.js` — corrigé 2026-08-26, pas "257" qui est
`ref_exo_template_computers_foreign_keys.js`, une table différente — le catalogue par modèle, pas
l'instance par personnage) — 0 à 2 lignes par personnage
`role` (CHECK principal/secours), `gen`, `nt`, `blindage_iem` (int, option achetée — niveau saisi
librement, aucune validation serveur du coût). Coût RAW `(niv²)×200` sols (`docs/REGLES/
REGLE_ORDINATEUR.md:97-99`) calculé par `computeBlindageIemCost` (`shared/computerStats.js`, testé) et
affiché côté client (`ExoComputerPanel.jsx`) à titre informatif — jamais imposé côté serveur, aucune
colonne sols/budget n'existe sur `exo_computers`. `integrite_max`/`integrite_current`.

### `exo_programs` (`43_exo_programs.js`, FK/SET NULL dans `237_exo_programs_foreign_keys.js` —
corrigé 2026-08-26, pas "257"/"258")
`equipment_id` → `ref_equipment` RESTRICT (catalogue "Logiciels") **OU** `label_override` — simple OR,
**pas** durci en source exclusive comme les tables d'équipement (pas de contrainte CHECK
mutuellement-exclusive ici). `category`, `level` (CHECK 0-30). `exo_computer_id` → `exo_computers`
**SET NULL** (`237_exo_programs_foreign_keys.js`) : un programme orphelin devient "non géré/manuel" plutôt que supprimé en cascade —
cohérent RAW, un logiciel ne disparaît pas avec l'ordinateur qui le faisait tourner.

### Autres colonnes touchées ailleurs
`characters.type` CHECK étendu à `'exo'` (`125_characters_constraints.js`, pas "233" — corrigé
2026-08-26). `combat_actions.type` CHECK étendu à `'exo_stand_up'`
(`127_combat_actions_constraints.js`, pas "249" — Manœuvre d'armure pour se relever, résolue comme une action de combat à part entière).

---

## 2bis. Source exclusive — le patron répété sur 3 tables

`docs/VOCABULARY.md` "Source exclusive (catalogue équipement)". Une ligne d'équipement (modèle ou
instance) référence **soit** `ref_exo_equipment` (`equipment_id`), **soit** `ref_equipment`
(`ref_equipment_id`), jamais les deux — contrainte CHECK réelle (migrations 260 puis 262, la première
version interdisait à tort la coexistence source+annotation) :

```sql
NOT (equipment_id IS NOT NULL AND ref_equipment_id IS NOT NULL)
AND (equipment_id IS NOT NULL OR ref_equipment_id IS NOT NULL OR label_override IS NOT NULL)
```

`label_override` peut coexister avec l'une des deux sources comme **annotation d'affichage** (ex.
"SACEA (secours)", "Dague Shark (rétractable)") sans être une 3ᵉ source concurrente ; ou porter seul un
objet inventé sans équivalent catalogue. Appliqué identiquement sur `ref_exo_template_equipment`,
`exo_systems`, `exo_weapons`.

**Clone vs lien, la règle de choix** (posée en construisant le catalogue, `PLAN_EXOARMURE.md` §12-§13) :
- Une **arme** qui a un équivalent exact dans `ref_equipment` (dague, harpon, pistolet lourd,
  mitrailleuse...) est **toujours liée** (`ref_equipment_id`), jamais clonée — une dague reste une
  dague, montée sur exo ou tenue en main.
- Un **capteur "portable"** (Sonscan/Radar/Caméra/Balise/Analyseur environnemental) dont le texte RAW
  confirme une existence indépendante (utilisable hors exo-armure, ex. en station) est **cloné** en
  nouvelle ligne `ref_exo_equipment` — un `ref_equipment_id` unique confondrait deux achats
  indépendants. La description du clone cite toujours sa source pour la traçabilité si l'original
  change de prix/stats.

---

## 3. Services

### `applyExoTemplate(db, characterId, templateId)` — `server/src/lib/exoTemplateService.js`
Seul pont catalogue → instance. Transactionnel (`SELECT ... FOR UPDATE` sur `exo_sheet`, sérialise
toute l'opération). `templateId` validé comme UUID avant requête (400 explicite plutôt qu'une erreur
Postgres brute).

1. Copie les 19 colonnes de base (même liste que `COPIED_FROM_TEMPLATE_COLUMNS`, `44_exo_sheet.js` —
   dupliquée intentionnellement, une migration appliquée n'est jamais retouchée) + `template_id`.
2. **Toujours un remplacement complet, jamais une fusion** : vide `exo_systems`/`exo_weapons`/
   `exo_computers` pour ce personnage, puis réinsère des copies fraîches depuis
   `ref_exo_template_equipment`/`ref_exo_template_computers` filtrées par `template_id`.
3. Intégrité posée à l'insertion — deux règles différentes, décision Saar 2026-08-21 :
   - `exo_systems`/`exo_weapons` : **20 fixe** (matériel neuf sorti d'usine), jamais de jet — la règle
     générale "2D6+6" du matériel d'occasion ne s'applique pas à un modèle de série tout juste choisi.
   - `exo_computers` : **un jet par ligne**, formule dépendant de la Génération
     (`resolveOrdinateurIntegrityFormula`, `shared/computerStats.js`).

Retourne la ligne `exo_sheet` à jour, ou `null` si le personnage n'a pas d'`exo_sheet` ou si le modèle
est introuvable.

### `exoAvarieService.js` — compteur d'Avaries + perte d'Intégrité Structure
- `severityForExoDamage(net)` — seuils numériques (5/10/15/20/25/30 → légère…destruction), coïncidence
  avec les seuils Blessure humaine, **jamais du code partagé** avec elle.
- `applyExoAvarie` — transactionnel, cascade de promotion si le palier visé est déjà plein (même
  logique de principe que `resolveWoundInsertion` côté humain, implémentation séparée). Décrémente
  `itg_structure_current` sur la transition 0→1 du palier qui encaisse réellement, **mais seulement si
  ce palier a un `itgLossStructure` non nul** (`EXO_AVARIE_TABLE`) — en pratique légère/moyenne/grave
  (0) n'entraînent jamais de perte, seuls critique/catastrophique (1) et destruction (2, inconditionnel
  à chaque coup) en causent une. Émet `WS.EXO_AVARIE_UPDATED`.
- `removeExoAvarie` — correctif MJ, décrémente sans jamais restaurer l'Intégrité perdue ni annuler une
  cascade passée (asymétrie assumée).
- `resolveExoDamage(io, db, campaignId, {characterId, degautsBruts})` — orchestrateur unique appelé par
  tous les sites `cibleType==='exo'` de `socketCombatHelpers.js` : contexte exo → dégâts nets
  (`charStats.js`) → sévérité → `applyExoAvarie`. `null` si l'exo n'a pas de base configurée.

### `computeExoStats(exoSheet)` — `shared/exoStats.js`
Pure, synchrone, sans accès DB. **Signature à un seul paramètre** (le second paramètre "template" a
été retiré avec le passage au modèle de copie (`44_exo_sheet.js`) — ne pas se fier à une référence antérieure qui en mentionnerait deux).
`null` si `category` est NULL (sentinelle non configurée). Sinon `{ exf, bld, rd }` :
- `exf = floor(base_exoforce × facteur_exosquelette × facteur_générateur)` — **un seul plancher
  combiné**, jamais deux arrondis successifs (l'ordre des deux facteurs n'a pas de justification RAW,
  décision Saar).
- `bld = floor(base_blindage × facteur_structure)`.
- `rd = EXO_RD_TABLE[category]` (`shared/exoConstants.js`) — lève une erreur explicite si la catégorie
  est inconnue de la table, jamais un repli silencieux.
- `vit` **n'est jamais retourné ici** — le mouvement est l'autorité exclusive de
  `movementBudgetService.js` (§5).

### Branche exo de `combatantContextService.js`
Détail complet, formules de substitution FOR→EXF et plafond de Compétence :
`docs/SYSTEME/COMBAT.md` §"Contexte de Test d'un combattant" — `resolveExoTestContext`,
`resolveCombatantIdentity`, `isExoActorAuthorized`, `resolveManeuverSkillId`.

---

## 4. Mouvement

`movementBudgetService.js#getExoMovementBudget(characterId, gait)` — dispatch sur
`exo_sheet.*_movement_mode` selon l'environnement (surface essayé en premier, puis sous-marine ;
limitation documentée EAU1 — aucun signal d'immersion temps réel n'existe encore pour une armure
hybride). `'pilot'` délègue récursivement à `getCharacterMovementBudget(pilotId, gait)` ; `'blocked'`
exclut cet environnement ; `'vit'` calcule via `calcAllures`. Lève une erreur explicite (jamais un
repli silencieux) si l'exo n'a pas de catégorie, aucun environnement valide, ou délègue à un pilote
absent.

---

## 5. Action de combat — `exo_stand_up`

Manœuvre d'armure pour se relever (`state_position==='prone'`) — auto-résolue comme une défense PNJ
(pas de confirmation joueur) : `resolveExoStandUpAction` (`socketCombatHelpers.js`) lance 1D20 via
`computeAttackRoll` contre le `skillTotal` du pilote (`resolveHumanoidTestContext` avec
`forNAOverride: exf`), modificateur de catégorie depuis `EXO_PRONE_RECOVERY_TABLE`
(`shared/exoConstants.js`). Enregistrée dans la FSM combat comme `combat_actions.type='exo_stand_up'`
(`127_combat_actions_constraints.js`, pas "migration 249" — voir §2).

---

## 6. Illustration (`illustration_url` créée directement dans `71_ref_exo_templates.js` — corrigé
2026-08-26, pas "migration 263", 2026-08-21)

Deux mécanismes distincts selon l'origine de l'exo-armure — jamais confondus :

| Origine | Colonne | Upload |
|---|---|---|
| Modèle RAW catalogue (`ref_exo_templates`) | `illustration_url` | `POST /api/exo-templates/:id/illustration`, `requireAdmin` |
| Exo custom du Coffre (`characters.type='exo'`) | `characters.portrait_url` (générique, déjà existant) | `POST /api/characters/:id/portrait`, propriétaire/pilote/MJ |

Même mécanique MinIO sous-jacente pour les deux (clé fixe par entité, cache-bust `?v=timestamp`,
servi par `GET /api/assets/:folder/*filePath`) — seule la garde d'autorisation change (catalogue
partagé → admin ; fiche de joueur → propriétaire).

`GET /:characterId/exo` (§7) renvoie `template_illustration_url` en plus de `template_name` — la fiche
d'une exo-armure affiche en priorité son propre `portrait_url` (personnalisation), et **replie** sur
l'illustration du modèle catalogue si aucun portrait custom n'a été uploadé (`ExoSettingsPanel.jsx`).
Aucune duplication de la valeur : l'illustration du modèle reste lue par JOIN à chaque affichage,
jamais copiée sur `exo_sheet` (elle est purement décorative, contrairement aux 19 stats de base
copiées par `applyExoTemplate` — celles-là ont besoin d'un instantané indépendant du catalogue, pas
l'illustration).

Outil admin : `server/src/admin/exo-templates-tool.html` (page statique gardée `requireAdmin`, même
patron que `ref-equipment-tool.html`), accessible depuis `/admin` → tuile "Illustrations exo-armures".

---

## 7. Routes API

| Route | Garde | Rôle |
|---|---|---|
| `GET /api/exo-templates` | `requireAuth` | Liste les 16 modèles (colonnes résumé + `illustration_url`) — sélecteur |
| `POST /api/exo-templates/:id/illustration` | `requireAdmin` | Upload illustration modèle (§6) |
| ~~`GET /api/exo-equipment?family=arme\|systeme`~~ | — | **Périmé (audit 2026-08-26)** — cette route/ce fichier `exoEquipment.js` n'existe pas (vérifié, zéro occurrence de `exo-equipment` dans `server/src`). Conséquence directe de la fusion §1 : le catalogue exo se lit via la route générique `GET /api/equipment?family=Exo-arme\|Exo-systeme\|Equipement%20Général` (`equipment.js`, déjà documentée dans `ADMIN.md`), consommée directement par `ExoSystemsPanel.jsx`/`ExoWeaponsPanel.jsx` — pas de route dédiée. |
| `GET /:characterId/exo` | ouvert (membre campagne) | `exo_sheet.*` + `template_name`/`template_illustration_url` joints |
| `PUT /:characterId/exo` | `exoIsGmOrOwnerOrPilot` | 2 modes exclusifs : `template_id` seul → `applyExoTemplate` ; sinon patch des 19+4 champs de base + `pilot_character_id` |
| `PUT /:characterId/exo/integrity` | idem | Patch des 6 colonnes `itg_*` |
| `POST /:characterId/exo/avaries/:severity` | idem | `applyExoAvarie` |
| `DELETE /:characterId/exo/avaries/:severity` | GM seul | `removeExoAvarie` |
| `GET/POST/PUT/DELETE /:characterId/exo/systems[/:id]` | idem | CRUD `exo_systems`, source exclusive validée serveur |
| `GET/POST/PUT/DELETE /:characterId/exo/weapons[/:id]` | idem | CRUD `exo_weapons`, idem |
| `GET/POST/PUT/DELETE /:characterId/exo/computers[/:id]` | idem | CRUD `exo_computers` — Intégrité fournie par l'appelant, pas de jet serveur ici (contraste avec `applyExoTemplate`) |
| `GET/POST/PUT/DELETE /:characterId/exo/programs[/:id]` | idem | CRUD `exo_programs`, revalide Potentiel/Niveau max de l'ordinateur si `exo_computer_id` fourni |

Toutes montées dans `server/src/routes/character/char-sheet.js` sauf `GET/POST /api/exo-templates*`
(`exoTemplates.js`) — corrigé 2026-08-26, `exoEquipment.js` n'existe pas, voir ligne barrée ci-dessus.

---

## 8. Composants client

| Composant | Rôle |
|---|---|
| `ExoSheetWindow.jsx` | Fenêtre flottante (drag/resize), onglets Fiche (sections empilées) / Réglages |
| `ExoIdentityPanel.jsx` | Sélecteur Pilote + Modèle (déclenche `applyExoTemplate`) |
| `ExoAttributesPanel.jsx` | EXF/BLD/RD effectifs (`computeExoStats` côté client, même autorité que serveur), champs de base éditables |
| `ExoInfoPanel.jsx` | Profondeurs, NT, taille, batterie, autonomie, notes ; affichage dérivé Malus Saisie/Armure à terre |
| `ExoIntegrityPanel.jsx` | 3 jauges Structure/Exosquelette/Générateur |
| `ExoAvariesPanel.jsx` | Grille de cases à cocher par palier — clic = pose une Avarie, retrait MJ seul |
| `ExoSystemsPanel.jsx` / `ExoWeaponsPanel.jsx` | CRUD `exo_systems`/`exo_weapons`, sélecteur catalogue exo **ou** général **ou** personnalisé |
| `ExoComputerPanel.jsx` | Liste `exo_computers` + `exo_programs` imbriqués, badge Actif/En veille |
| `ExoSettingsPanel.jsx` | Portrait (avec repli illustration modèle, §6), description, notes MJ, propriétaire, GLB, envoi au Coffre, suppression |
| `CombatExoActionWindow.jsx` | Déclaration de tour en combat (joueur et MJ) — seules actions câblées à ce jour : se relever, passer le tour |

---

## 9. Non codé — écrit en RAW, pas encore construit

Signalé explicitement pour ne jamais être supposé fonctionnel :

- **Incidents** (`MANUEL_EXOARMURE.md` §4.9) — jet de localisation + effets par composant (fuite
  Structure, blocage Exosquelette, coupures Générateur, incidents Systèmes/Armement/Pilote).
- **Destruction majeure** (§4.10) — dégâts nets ≥30 en un coup.
- **Routine environnementale/pression** (§4.11).
- **Réparation** (§4.12) — bloqué en amont par `PLAN_TEST_CRITIQUE.md` (résolution par marge), pas
  seulement non priorisé.
- **Isolation automatique de systèmes** quand le Générateur est dégradé (règle écrite §4.8.3, aucun
  code ne la déclenche).
- **Fenêtre de fiche pour une exo-armure custom du Coffre** — `VaultCharacterPage.jsx` affiche un
  placeholder pour `type='exo'`, jamais construite (`docs/ROADMAP.md`, non prioritaire).

---

## 10. Historique de construction (pointeurs, pas de détail dupliqué)

Décisions, alternatives écartées, analyses à charge : `docs/PLANS/PLAN_EXOARMURE.md`. Transcription RAW
source du catalogue et des 16 loadouts : `docs/REGLES/SEEDEXO.md` (autorité "pourquoi cette ligne
catalogue existe"). Migrations clé, dans l'ordre : 233 (fondations) → 251/252/253 (catalogues initiaux)
→ 254 (stats de base sur `exo_sheet`) → 255/257/258 (notes, loadout, programmes) → 260/262 (source
exclusive durcie) → 261/264 (extensions catalogue) → 263 (illustration) → 265 (seed loadout complet).
