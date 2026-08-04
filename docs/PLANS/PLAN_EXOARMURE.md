# PLAN — Système Exo-Armures

> Statut : Lot 0 (cadrage architecture) clos, Lot 1 (Fondations) rédigé et prêt à coder (§6),
> 2026-07-30. **Improvisation interdite (consigne explicite Saar 2026-07-30)** — architecture validée
> contre des dépôts pro réels (Lancer/Foundry VTT, MekHQ) avant tout code. Rien n'est codé. 2 des 3
> questions RAW tranchées (§2.1, §2.2) ; **§2.3 (seuil de Catastrophe) en stand-by**, dépend de
> `docs/PLAN_TEST_CRITIQUE.md` (chantier séparé, en pause côté Saar) — bloque uniquement le Lot 8.
> Document temporaire (`docs/RegleDocumentaire.md` Règle 10) — à archiver dans `docs/Old/` une fois le
> chantier clos, contenu durable transféré vers `docs/SYSTEME/EXOARMURE.md` (à créer) et
> `docs/VOCABULARY.md`.
>
> Source RAW : `docs/REGLES/REGLEARMURE.md` (extrait Livre de Base Polaris, p.323-329). Autorité
> supérieure à ce PLAN et à `docs/MANUELEXOARMURE.md` — en cas de contradiction, RAW gagne
> (`RegleDocumentaire.md` Règle 12).
> Entrée : `docs/MANUELEXOARMURE.md` (brouillon technique fourni par Saar, V2 codée + V3 "à valider") —
> traité comme proposition d'entrée, pas comme source de vérité (mélange RAW + architecture,
> contrevient à la responsabilité unique documentaire).

---

## 1. Décisions actées (cadrage avec Saar, 2026-07-30)

1. **L'exo-armure est une catégorie de `character` à part entière** : `characters.type` étendu à
   `'exo'`, au même rang que `'pj'/'pnj'/'drone'` (déjà extensible, cf. `docs/SYSTEME/COMBAT.md:1069-1074`,
   PC27), future extension `'vehicle'`/navire hors périmètre de ce chantier.
   - Une exo-armure n'est **pas** un drone : le drone est autonome (programmes propres, jamais
     piloté avec plafonnement de stats d'un opérateur — la Compétence Télépilotage RAW existe dans
     `docs/REGLES/REGLEDRONE.md` mais n'a jamais été codée). L'exo-armure, elle, dépend structurellement
     d'un pilote humain (Initiative, plafond de Compétences, dégâts "Pilote").
2. **Fiche dédiée `exo_sheet`** (PK `character_id`), même patron que `drone_sheet` — **pas** de
   passage par `charStats.js` (pipeline humain).
3. **Lien pilote dynamique et simple** : `exo_sheet.pilot_character_id` (nullable, éditable comme un
   champ de fiche normal). Pas de FSM embarquer/débarquer, pas de gestion automatique du token du
   pilote humain pendant qu'il pilote — hors périmètre v1.
4. **Ancrage persistant confirmé** : intégrité/avaries/dégâts de l'armure vivent sur `exo_sheet`/table
   liée à `character_id` (persistant), **jamais** sur `combat_roster`/`token_id` (vidés à
   `COMBAT_END`, cf. `socketCombatHelpers.js:2981`) — corrige une erreur du brouillon V3 de
   `docs/MANUELEXOARMURE.md` qui proposait `exo_armure_state.roster_id PK REFERENCES combat_roster(id)`.
5. **Compteurs à durée (paralysie/coupure/fuite)** : réutilisent `token_statuses.expires_at_turn`
   (mécanisme générique déjà en place pour `is_stunned`) — pas de colonnes `*_turns_left` bespoke sur
   la table exo comme le proposait le brouillon V3.
6. **Pipeline d'incident autonome** : pas de dépendance au "Test de panne" générique
   (`docs/REGLES/REGLEMATERIEL.md` p.273-274), qui n'est pas codé côté serveur (confirmé — narratif
   seul actuellement, decision Lot IEM C2, `docs/EN_COURS.md` 2026-07-16). Dette loggée séparément
   dans `docs/BUGIDENTIFIE.md`, hors scope ici.
7. **Stats effectives jamais stockées** (confirmé par la recherche externe §4, patron Foundry/Lancer
   "source data vs derived data") : EXF/VIT/BLD effectifs de l'armure ne sont **pas** des colonnes —
   ils sont recalculés par une fonction de service pure (`computeExoStats(exoSheet)`, patron déjà
   esquissé par `calculateDynamicExoAttributes` dans `docs/MANUELEXOARMURE.md` V3) à partir de
   l'intégrité courante des 3 composants, à chaque lecture/action. Aucune désynchronisation possible
   puisqu'il n'y a rien à synchroniser. Cette fonction sert de patron de référence pour le Lot 2.
8. **Deux familles distinctes d'effets à durée** (confirmé §4, patron Lancer Structure vs Burn) — à ne
   pas unifier artificiellement au Lot 5 :
   - **(a) Durée fixe décomptée automatiquement** (ex. `paralyzed_turns_left`, `unpowered_turns_left`
     RAW "2 Tours", "1D6+1 Tours") → `token_statuses.expires_at_turn`, l'effet cesse simplement à
     expiration.
   - **(b) Effet évolutif nécessitant une résolution active** (ex. la fuite Structure : le pilote a
     N Tours pour colmater, sinon l'Avarie automatique s'aggrave chaque Tour) → un compteur qui reste
     actif tant qu'aucune action de colmatage n'est déclarée, réévalué/aggravé à chaque Tour plutôt que
     simplement expiré. Ne pas modéliser comme un `token_statuses` classique qui "s'éteint" — il faut un
     hook explicite au changement de Tour qui vérifie si l'action de résolution a eu lieu.

---

## 2. Questions RAW — tranchées le 2026-07-30 (à la demande de Saar, alignement dès le départ)

### 2.1 Dommages au contact — ✅ RÉSOLU

`getModDom(for_na)` existe déjà (`server/src/lib/charStats.js:172`) — table Modificateur de Dommages
LdB p.113, **et extrapole déjà au-delà de 21** (`5 + Math.floor((for_na - 21) / 2)`), donc jusqu'à
EXF 100 sans rien ajouter. RAW dit explicitement (`REGLEARMURE.md:130-131`) : *"la formule utilisée
est la même que celle des personnages"*. **Décision : Lot 4 réutilise `getModDom(exf)` tel quel**,
jamais un `dmg_mod_human` figé par template (corrige `MANUELEXOARMURE.md` V1/V2). Reste à ajouter :
la table de dés de base par catégorie (`REGLEARMURE.md:258-264`, exo-alpha 1D6+2 … exo-oméga 3D10+3),
nouvelle donnée sur `ref_exo_templates`.
**Hors scope explicite (aucun template actuel n'atteint ces seuils)** : EXF ≥ 50 (dégâts à l'échelle
Véhicules légers, RAW p.267-269) et EXF ≥ 100 ("Dommages massifs à l'échelle humaine") — dépendent
tous deux d'un système de véhicules/dégâts massifs qui n'existe pas encore. Documenté ici, pas
bloquant pour le Lot 4.

### 2.2 Malus de Saisie/Lutte, Armure à terre, Encombrement sur EXF — ✅ RÉSOLU

RAW marque explicitement **"Malus de Saisie" et "Armure à terre" comme règles OPTIONNELLES**
(`REGLEARMURE.md:371`, `:381`) — pas l'Encombrement. Décision : les trois entrent dans le périmètre
(cohérent avec la demande de qualité/exhaustivité) :
- **Encombrement sur EXF** → Lot 2 (substitution), réutilise `calcEncumbrancePenalty` en substituant
  EXF à FOR_na — aucune nouvelle fonction.
- **Malus de Saisie/Lutte** (table fixe par catégorie, `REGLEARMURE.md:371-380`) → Lot 2 également,
  simple table de malus statique par catégorie sur les actions de Lutte.
- **Armure à terre** (Test de Manœuvre d'armure pour se redresser, malus par catégorie,
  `REGLEARMURE.md:381-395`) → nouveau lot dédié, **Lot 2bis — Armure à terre**, car ça introduit une
  nouvelle action déclarable (se redresser), pas juste une substitution passive. Positionné juste
  après le Lot 2.

### 2.3 Seuil de "Catastrophe" — ⏸️ EN STAND-BY (2026-07-30)

**Ma conclusion précédente ("RÉSOLU", `mr ≤ -20`) était prématurée — corrigée ici plutôt que
silencieusement effacée.** En creusant le même sujet plus profondément pour les Blessures, Saar a
découvert que la résolution des Tests critiques/Catastrophe est **actuellement mal codée dans tout le
projet** : `roll === 1`/`roll === 20` (valeur brute du dé) est utilisé partout en production
(`resolvePolarisTest`, `combatAttackRoll.js` et au moins 6 sites combat), alors que la vraie règle RAW
se base sur la **marge** (écart jet/Seuil), pas sur la valeur du dé — confirmé par Saar : *"une
catastrophe n'est PAS un 20 sur un d20 mais une marge de réussite"*. Chantier dédié ouvert :
`docs/PLAN_TEST_CRITIQUE.md`, **en pause côté Saar** (il doit revenir avec la lecture RAW exacte de la
table avant de trancher).

Cette relecture plus rigoureuse a aussi révélé une incohérence dans ma propre transcription de la
photo : `PLAN_TEST_CRITIQUE.md` §2 place "Catastrophique" à la tranche de marge **15-19** (pas 20-24
comme j'avais conclu ici), avec le modificateur d'échec encore `[À CONFIRMER]` — donc le commentaire
de la migration 46 (`mr -15/-19` étiqueté "Catastrophique") que j'avais qualifié de "coquille" était
peut-être correct depuis le début. Aucune des deux lectures n'est confirmée pour l'instant.

**Décision : ce chantier reste en stand-by sur ce point précis, à la demande explicite de Saar.**
Ne pas construire de mécanisme de détection de Catastrophe propre aux exo-armures tant que
`PLAN_TEST_CRITIQUE.md` n'a pas tranché — le Lot Réparation (Lot 8) en dépend directement et devra
réutiliser la solution unique qui en sortira (`resolvePolarisTest` corrigé), jamais une variante
maison. Le Lot 8 est donc **bloqué en attente de `PLAN_TEST_CRITIQUE.md`**, indépendamment de l'ordre
des autres lots.

---

## 3. Découpage en lots (proposition initiale, granularité à ajuster)

Un lot = un sujet fermé et validé (fonctionnel + navigateur si applicable) avant le suivant. Ordre
non figé — à valider avec Saar une fois la recherche externe (§4) intégrée.

- **Lot 1 — Fondations** : migration `characters.type='exo'`, table `exo_sheet`, table
  `ref_exo_templates`, entrée `docs/VOCABULARY.md`. Pas de combat, juste fiche + création.
- **Lot 2 — Substitution d'attributs** : EXF/VIT/BLD remplacent FOR/VIT/déplacement humains en
  combat, plafond de Compétence par Manœuvre d'armure, 1 seule Attaque/Tour.
- **Lot 3 — Initiative** : `min(Réaction, Manœuvre d'armure) − malus environnemental (×2 hors-milieu)`,
  seuil différé (report au Tour suivant si Initiative ≤ 0).
- **Lot 4 — Pipeline de dégâts** : Blindage/RD dynamiques par palier d'Intégrité (Structure), seuils
  d'Avarie (5/10/15/20/25/30), compteur d'Avaries. Tranche la question dommages-au-contact (§2).
- **Lot 5 — Incidents** (splitté, trop volumineux pour un seul lot — 6 sous-lots, un seul à la fois) :
  - **5a** — Moteur générique : jet d'incident (1D10 + modificateur d'Avarie) + jet de localisation
    (1D10) + dispatch vers le bon handler par élément. Pas d'effets encore.
  - **5b** — Incidents Structure (fuite évolutive — le sous-lot le plus complexe : nouvelle action
    "colmater", escalade si non résolue, famille de timer (b) décision 8).
  - **5c** — Incidents Exosquelette (blocage membre/paralysie générale — famille de timer (a),
    `token_statuses`).
  - **5d** — Incidents Générateur (coupure/malus systèmes — famille de timer (a), `token_statuses`).
    Ne couvre **pas** la routine d'isolation automatique par palier d'Intégrité (p.329) — celle-ci se
    déclenche par palier, pas par jet d'incident, donc rattachée au Lot 2.
  - **5e** — Incidents Systèmes auxiliaires + Armement (sélection aléatoire d'un système/hardpoint,
    statut offline/bloqué).
  - **5f** — Incidents Pilote (dégâts directs bypass armure, réutilise le pipeline de dégâts humain
    existant — `character_wounds`).
- **Lot 6 — Destruction majeure (≥30)** : protocole complet, systèmes "Dernière chance"
  (Guillotine/Congélation/Injection).
- **Lot 7 — Routine environnementale** : pression/écrasement en profondeur (tâche planifiée).
- **Lot 8 — Réparation** ⏸️ **bloqué** : effacement du compteur d'Avaries + restauration d'Intégrité
  par élément (Mécanique/Électronique/Armurerie). Dépend de `docs/PLAN_TEST_CRITIQUE.md` (§2.3,
  en pause côté Saar) pour la détection de Catastrophe — ne pas ouvrir avant que ce chantier soit
  tranché, quel que soit l'avancement des Lots 1-7.

---

## 4. Recherche externe (patrons pro) — synthèse 2026-07-30

Consigne Saar 2026-07-30 : ne jamais coder à l'aveugle, s'inspirer de dépôts/projets pros avant de
figer le schéma. Recherche menée avec accès réel au code source (API GitHub), pas de déduction —
sources citées ci-dessous.

**Lancer RPG (Foundry VTT) — `Eranziel/foundryvtt-lancer` + `massif-press/lancer-data` :**
- Relation Pilote↔Mech = **deux `Actor` distincts et persistants**, liés par référence croisée
  bidirectionnelle (`pilot.ts:11` `active_mech`, `mech.ts:33` `pilot`) — jamais fusionnés. Valide
  directement notre décision 1/3 (`characters.type='exo'` + `pilot_character_id`).
- Les stats du pilote ne sont **jamais copiées** dans la fiche du mech — injectées comme effets
  éphémères recalculés à la volée (`effector.ts`), jamais persistées. Confirme la décision 7
  ci-dessus.
- Table de dégâts par paliers (`flows/structure.ts`) : nombre de dés = points de structure manquants
  (garde le pire) → la sévérité probable dépend du palier de dégradation actuel, pas d'un jet fixe.
  Notre RAW fait déjà ça nativement (modificateur d'incident lié à la gravité d'Avarie reçue,
  `REGLEARMURE.md` p.326-328) — cohérent, rien à changer, juste une confirmation que le principe est
  standard.
- Deux familles d'effets à durée (`structure.ts` vs `flows/burn.ts`) → décision 8 ci-dessus.

**BattleTech/MekHQ (`MegaMek/megamek`, `MegaMek/mekhq`)** : modèle par emplacement/slot critique avec
transfert de dégâts vers le slot suivant si la localisation visée est déjà détruite. Beaucoup plus
granulaire que nos 3 jauges globales — **non applicable au schéma retenu**. Seul point utile : si un
incident vise un élément déjà à Intégrité plancher, faut-il un report ? Vérifié : nos paliers RAW
(`calculateDynamicExoAttributes`) gèrent déjà explicitement l'état plancher (Exosquelette/Générateur/
Structure ≤0 → valeurs à 0 + hardlock) — pas de mécanisme de transfert à construire.

**Derived stats (pattern Foundry `prepareData()`)** : distinction stricte source data (stockée,
éditable) vs derived data (jamais stockée, recalculée à chaque cycle) — c'est la réponse à la décision
7. Le mécanisme `ActiveEffect` lui-même (documents réactifs client) ne s'applique pas à notre stack —
l'équivalent Node est une couche service pure, pas une nouvelle table.

**Statuts à durée** : Foundry décrémente les durées via le document `Combat` à chaque tour — chez nous
l'équivalent est un tick serveur explicite sur avancement de round (déjà notre patron `endTurn`,
`socketCombatHelpers.js`), pas un hook client. Confirme qu'on branche le Lot 5 sur `endTurn`, pas sur
un minuteur séparé.

---

## 5. Hors périmètre explicite

- Navires/véhicules légers (catégorie `characters.type='vehicle'`, mentionnée comme suite possible) —
  chantier séparé.
- Attaque IEM ciblant les exo-armures (`docs/EN_COURS.md`, Lot C2 IEM) — dépend de ce chantier mais
  reste un chantier séparé, à ne pas rouvrir ici.
- Télépilotage des drones (rétrofit du patron pilote/machine sur `drone_sheet`) — hors scope, noter
  seulement que l'architecture retenue ici devrait rester compatible avec une réutilisation future.

---

## 6. Lot 1 — Fondations — rédaction détaillée (2026-07-30)

> **Analyse à charge menée 2026-07-30 (demandée par Saar avant tout code)** — 6 trous trouvés,
> vérifiés contre le code réel (pas de supposition), corrigés directement dans le texte ci-dessous :
> 1. **Bloquant** : `template_id NOT NULL` + "pas de seed en Lot 1" + le formulaire de création
>    (`Sidebar.jsx`) n'a aucun champ pour choisir un template → le scénario de validation §6.7 était
>    irréalisable tel quel. Corrigé : `template_id` nullable.
> 2. **Incohérence de patron** : le drone sépare fiche descriptive (`PUT /:characterId/drone`) et
>    Intégrité (`PUT /:characterId/drone/integrity`, route dédiée, `char-sheet.js:1475`) — mon plan
>    initial mettait tout dans une seule route. Corrigé : même split pour l'exo-armure.
> 3. **Permission non spécifiée** : le drone a un helper explicite `droneIsGmOrOwner` (GM ou
>    `character.user_id === req.user.id`, `char-sheet.js:1347-1348`) — absent de mon plan initial pour
>    les routes exo. Corrigé et tranché par Saar (2026-07-30) : GM, propriétaire ET pilote lié ont
>    tous les droits de modification (§6.3, `exoIsGmOrOwnerOrPilot`).
> 4. **`itg_*_max` oublié** : seul `itg_*_current` était éditable, alors que le RAW permet
>    explicitement une armure d'occasion avec des Intégrités maximales différentes (Générateur neuf
>    20, Exosquelette fatigué 15, `REGLEARMURE.md:275-283`). Corrigé : les deux éditables.
> 5. **Ordre des catégories non capturé** : les tables Saisie/Armure à terre (Lot 2/2bis) s'expriment
>    en "catégorie X et plus" — ça suppose un ordre total sur les 9 catégories, absent du schéma.
>    Corrigé : rang explicite ajouté à `shared/exoCategoryTable.js` (§6.2).
> 6. **Garde applicative manquante** : rien n'empêchait qu'un `drone` ou une autre `exo` soit assigné
>    comme `pilot_character_id` — non-sens RAW (le pilote est un humain). Corrigé : validation
>    applicative ajoutée en invariant (§6.5).
> **Vérifié, pas de trou** : `chk_character_type` confirmé inchangé depuis la migration 71
> (`('pj','pnj','drone')`) — aucune migration intermédiaire ne l'a retouché, l'hypothèse de départ
> (migration 225 disponible, contenu du CHECK) tient.

Vérifié avant rédaction : plus haut numéro de migration séquentielle présent = `223`
(`223_campaigns_pending_advance.js`, impair = Claude) — aucun `224`/`225` déjà pris. **Numéro réservé :
`225`** (impair), à reconfirmer contre `knex_migrations` juste avant exécution réelle
(`CLAUDE.md` §2/§5 — l'autre développeur peut avoir avancé sur `224` entre-temps).

### 6.1 Migration `225_exo_sheet.js`

Patron exact repris de `71_drone_sheet.js` (précédent direct pour étendre `characters.type` +
créer une fiche dédiée) :

**Up :**
1. Étendre le CHECK `chk_character_type` : `DROP CONSTRAINT` / `ADD CONSTRAINT ... CHECK (type IN
   ('pj','pnj','drone','exo'))`.
2. Créer `ref_exo_templates` (catalogue des modèles, PK `uuid` — même style que `ref_equipment`,
   migration 48) :
   - `id uuid PK default gen_random_uuid()`
   - `name text NOT NULL`
   - `category text NOT NULL CHECK IN ('exo-alpha','exo-0','exo-1','exo-2','exo-3','exo-4','exo-5','exo-6','exo-omega')`
   - `environment text NOT NULL CHECK IN ('submarine','surface','hybrid','atmospheric','spatial','industrial')`
     — milieu nominal (RAW §"Types d'armures")
   - `depth_operational integer` / `depth_limit integer` / `depth_crush integer` (nullable — uniquement
     pertinent si `environment` implique du sous-marin)
   - `base_exoforce integer NOT NULL DEFAULT 0`
   - `base_speed_underwater integer` / `base_speed_surface integer` (nullable selon milieu)
   - `base_blindage integer NOT NULL DEFAULT 0`
   - `malus_init_underwater integer NOT NULL DEFAULT 0` / `malus_init_surface integer NOT NULL DEFAULT 0`
   - `created_at`/`updated_at` (patron standard du projet)
   - **Volontairement absent** : RD, dés de dégâts au contact, malus de Saisie, malus Armure à terre —
     ce sont des constantes **par catégorie**, pas par template (RAW donne une table fixe par catégorie
     pour ces quatre valeurs, `REGLEARMURE.md:90-98` RD, `:258-264` dégâts, `:377-380` Saisie,
     `:385-391` Armure à terre) → `shared/exoCategoryTable.js` (§6.2), jamais dupliquées sur chaque
     ligne de `ref_exo_templates`.
3. Créer `exo_sheet` (instance, PK `character_id` — même style que `drone_sheet`, migration 71) :
   - `character_id uuid PK REFERENCES characters(id) ON DELETE CASCADE`
   - `template_id uuid REFERENCES ref_exo_templates(id) ON DELETE SET NULL` — **nullable** (corrigé par
     l'analyse à charge, point 1) : la création (`Sidebar.jsx`) ne propose aucun sélecteur de template
     et Lot 1 ne seed aucune donnée dans `ref_exo_templates` — une exo-armure peut donc naître sans
     template, assigné ensuite via `PUT /:characterId/exo` une fois un template disponible. **Invariant
     Lot 2** : tant que `template_id` est `NULL`, aucune stat effective n'est calculable — le Lot 2
     devra gérer ce cas explicitement (ex. blocage de mise en combat), pas juste supposer un template
     toujours présent.
   - `pilot_character_id uuid REFERENCES characters(id) ON DELETE SET NULL` (nullable, décision §1.3 —
     simple champ éditable). **Unique tranché par Saar (2026-07-30)** : un personnage ne peut piloter
     qu'une seule exo-armure à la fois (sémantique "aux commandes maintenant", pas "propriétaire
     habituel") →
     `CREATE UNIQUE INDEX exo_sheet_pilot_unique ON exo_sheet(pilot_character_id) WHERE
     pilot_character_id IS NOT NULL` (index unique partiel — plusieurs `NULL` restent autorisés, seule
     une valeur non-nulle en double est rejetée). Le handler `PUT /:characterId/exo` doit intercepter la
     violation de contrainte et répondre une erreur métier claire ("déjà pilote d'une autre exo-armure"),
     pas laisser fuiter l'erreur Postgres brute.
   - `itg_structure_max/current integer NOT NULL DEFAULT 20` (×3 pour Exosquelette, Générateur —
     valeurs **par instance**, pas par catégorie : RAW confirme explicitement que deux armures du même
     modèle peuvent avoir des Intégrités différentes selon l'usure, `REGLEARMURE.md:275-283`)
   - `avaries_legeres/moyennes/graves/critiques/catastrophiques integer NOT NULL DEFAULT 0`
   - `equipped_systems jsonb NOT NULL DEFAULT '[]'`
   - `hardpoints jsonb NOT NULL DEFAULT '{}'`
   - `isolated_systems jsonb NOT NULL DEFAULT '[]'`
   - `damaged_systems jsonb NOT NULL DEFAULT '{}'`
   - `created_at`/`updated_at`

**Down :** supprimer `exo_sheet` puis `ref_exo_templates`, supprimer les `characters` de type `'exo'`
avant de restaurer le CHECK sans `'exo'` (même garde que 71 down — un CHECK ne peut pas se restaurer
tant que des lignes le violeraient).

Fichier de test associé `225_exo_sheet.test.mjs` (même patron que `221`/`223`) : up/down réversibles,
CHECK constraint refuse un type hors-liste, cascade `character_id` fonctionne, `template_id` passe à
`NULL` si le template référencé est supprimé (`SET NULL`, corrigé §6.1 point 1), l'index unique
partiel rejette un second `pilot_character_id` identique non-nul mais accepte plusieurs `NULL`.

### 6.2 `shared/exoCategoryTable.js` (nouveau fichier, données seules)

Transcription RAW pure des 4 tables par catégorie (pas de logique) — consommées à partir du Lot 2
(Saisie), Lot 2bis (Armure à terre) et Lot 4 (RD + dégâts au contact), mais définies maintenant pour
avoir une seule source dès le départ :
- **`EXO_CATEGORY_ORDER`** (corrigé par l'analyse à charge, point 5) : rang explicite des 9 catégories
  dans leur ordre RAW (`exo-alpha < exo-0 < exo-1 < exo-2 < exo-3 < exo-4 < exo-5 < exo-6 <
  exo-omega`) — nécessaire dès le Lot 2/2bis pour exprimer "catégorie X et plus" (Saisie, Armure à
  terre), sinon comparaison de chaînes dans le désordre. Table unique, pas réinventée lot par lot.
- `EXO_RD_TABLE` (`REGLEARMURE.md:90-98`)
- `EXO_CONTACT_DAMAGE_TABLE` (dés de base par catégorie, `:258-264` — le modificateur EXF vient de
  `getModDom(exf)`, déjà existant, jamais dupliqué ici)
- `EXO_GRAPPLE_MALUS_TABLE` (`:377-380`, catégories exo-2/3 et plus uniquement)
- `EXO_PRONE_RECOVERY_TABLE` (`:385-391`, catégories exo-1 et plus uniquement)

### 6.3 Routes serveur

- `server/src/routes/characters.js` — extension de la même route générique que le drone (déjà
  générique par construction, `typeOverride`) :
  - L.107 : `type` accepte aussi `'exo'` (en plus de `'drone'`).
  - L.121-126 : branche `else if (type === 'exo')` → exige `template_id` dans le payload, insère la
    ligne `exo_sheet`.
  - L.183 (PUT, garde anti-réassignation de type) : étendre la condition à
    `character.type !== 'drone' && character.type !== 'exo'` (sinon un changement de `user_id`
    réécrirait silencieusement le type d'une exo-armure).
- `server/src/routes/character/char-sheet.js` — miroir exact du patron `drone` existant, **corrigé
  par l'analyse à charge (points 2-4)** pour suivre le même split fiche/Intégrité que le drone, pas une
  route unique :
  - `GET /:characterId/exo` (lecture `exo_sheet` + jointure `ref_exo_templates`).
  - `PUT /:characterId/exo` (fiche descriptive) — champs éditables : `pilot_character_id`,
    `template_id`. **Validation applicative ajoutée (point 6)** : si `pilot_character_id` est fourni,
    vérifier que `characters.type` de la cible ∈ `('pj','pnj')` avant d'accepter — sinon une exo ou un
    drone pourrait devenir "pilote", non-sens RAW. Aucun CHECK DB ne peut porter cette règle
    (référence croisée inter-lignes) — elle doit vivre dans le handler de route.
  - `PUT /:characterId/exo/integrity` (route séparée, miroir `char-sheet.js:1475`) — champs éditables :
    `itg_structure_max/current`, `itg_exosquelette_max/current`, `itg_generator_max/current` (les
    `_max` sont corrigés ajoutés, point 4 — le RAW permet une armure d'occasion avec des maximums
    différents de la valeur par défaut). Les avaries/incidents restent en lecture seule jusqu'aux
    Lots 4-5.
  - **Permission — tranché par Saar (2026-07-30) : GM, propriétaire (`characters.user_id`) ET pilote
    lié ont tous les trois les droits de modification** sur la fiche exo-armure (fiche descriptive et
    Intégrité). Contrairement à `droneIsGmOrOwner` (vérification synchrone sur la seule ligne déjà
    chargée), `exoIsGmOrOwnerOrPilot` doit résoudre une référence croisée (`exo_sheet.pilot_character_id
    → characters.user_id`), donc **async** et nécessite l'`exo_sheet` déjà chargé (ou une jointure) :
    ```js
    const exoIsGmOrOwnerOrPilot = async (req, exoSheet) => {
      if (req.isGm) return true
      if (req.character.user_id && req.character.user_id === req.user.id) return true
      if (!exoSheet?.pilot_character_id) return false
      const pilot = await db('characters').where({ id: exoSheet.pilot_character_id }).first()
      return !!(pilot?.user_id && pilot.user_id === req.user.id)
    }
    ```
    Appliqué aux deux routes `PUT` (fiche et Intégrité) — un pilote sans lien de propriété peut donc
    aussi ajuster l'Intégrité de l'armure qu'il pilote, pas seulement se dissocier comme pilote.

### 6.4 UI — localisée (confirmé par Saar 2026-07-30)

`client/src/components/Sidebar.jsx`, onglet PERSOS (`activeTab === 'persos'`), bouton "Nouveau"
(`sidebar.newCharacter`) → formulaire `handleCreateCharacter`, `<select>` L.2339-2347 :

```jsx
<option value="pnj">{t('drone.typeHumanoid')}</option>
<option value="drone">{t('drone.typeDrone')}</option>
<option value="armure" disabled>{t('drone.typeArmor')}</option>
```

**Un stub désactivé existe déjà** pour cette option (`value="armure"`, clé i18n `drone.typeArmor`) —
posé par une session antérieure en anticipation de ce chantier. **Écart de nommage à noter** : la
valeur `"armure"` ne correspond pas à `characters.type='exo'` retenu partout ailleurs dans ce plan
(cohérent avec les codes courts existants `'pj'/'pnj'/'drone'`). Décision : au moment de coder,
changer uniquement l'attribut `value` (`"armure"` → `"exo"`) et retirer `disabled` — garder la clé
i18n `drone.typeArmor` telle quelle (c'est un label d'affichage, pas un identifiant technique). Pas de
question à reposer à Saar sauf s'il tient spécifiquement à `'armure'` comme code technique.

### 6.5 Invariants Lot 1

- Un personnage `type='exo'` a toujours exactement une ligne `exo_sheet` (même garantie transactionnelle
  que `char_sheet`/`drone_sheet`, un seul `db.transaction()` pour `characters` + fiche).
- `pilot_character_id`, s'il est non-`NULL`, référence toujours un personnage de type `'pj'` ou
  `'pnj'` — **jamais vérifié par un CHECK DB** (référence croisée inter-lignes, un CHECK Postgres ne
  peut pas la porter), **appliqué dans le handler `PUT /:characterId/exo`** (corrigé par l'analyse à
  charge, point 6). Un `drone` ou une autre `exo` assigné comme pilote est un non-sens RAW à rejeter
  explicitement, pas juste à ne pas empêcher.
- Un personnage ne pilote jamais plus d'une exo-armure à la fois — **tranché par Saar (run à vide
  2026-07-30)**, appliqué par un index unique partiel (§6.1) plutôt qu'une vérification applicative
  seule (garantie même sous concurrence, deux requêtes simultanées ne peuvent pas toutes les deux
  réussir).
- `template_id`, s'il est `NULL`, signifie une exo-armure "non configurée" — état valide en Lot 1
  (corrigé, point 1), mais le Lot 2 doit le traiter explicitement (pas de stats calculables sans
  template).
- Aucune stat effective (EXF/VIT/BLD dynamiques) n'existe encore à ce stade — décision §1.7, rien à
  calculer avant le Lot 2.

### 6.6 Hors périmètre Lot 1

- Aucun calcul de stats dynamiques, aucune intégration combat (`combat_roster`) — Lots 2+.
- Aucun UI de fiche exo-armure complète (affichage Intégrité, avaries...) — juste la route API. Le
  rendu visuel peut attendre que les Lots suivants donnent quelque chose à afficher.
- `ref_exo_templates` créée vide — pas de seed de données dans ce lot (le template `orka_mk1` du
  manuel peut servir de premier jeu de test manuel, à insérer à la main en dev, pas en migration).

### 6.7 Validation prévue

- `node --check` sur les fichiers touchés/créés.
- Test Node ciblé (`225_exo_sheet.test.mjs`) : up/down, CHECK, cascade `character_id`, `template_id`
  nullable + `SET NULL` au lieu de RESTRICT (corrigé, point 1) — en conditions réelles si connexion
  PostgreSQL disponible dans l'environnement d'exécution, sinon signalé explicitement en **Non testé**.
- Scénario réel navigateur (à la charge de Saar, comme d'habitude) : créer une exo-armure de test
  depuis l'UI GM **sans template** (chemin réellement disponible avec le formulaire actuel, corrigé
  point 1), vérifier `exo_sheet` en base, assigner `pilot_character_id` via `PUT /:characterId/exo`
  (tester aussi le rejet si la cible n'est pas `pj`/`pnj`, point 6), assigner `template_id` une fois un
  template inséré à la main en dev, ajuster `itg_*_max`/`itg_*_current` via
  `PUT /:characterId/exo/integrity`.
