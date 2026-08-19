# PLAN — Système Exo-Armures

> Statut : Lot 0 (cadrage architecture) clos, Lot 1 (Fondations) ✅ codé (2026-08-06), **non testé en
> navigateur**. Lot 2 (Substitution d'attributs) — **dérive documentaire corrigée le 2026-08-18** :
> cette section n'avait jamais été remise à jour après le 2026-08-06 alors que le travail avait
> continué. État réel : mouvement (VIT) ✅ codé, `computeExoStats` ✅ codée (2026-08-13),
> `docs/PLANS/PLAN_COMBATANT_CONTEXT.md` Lots A-G ✅ intégralement clos (2026-08-15, dispatcher +
> branche exo assemblés), plafond de Compétence (Manœuvre d'armure) ✅ codé (commit `7247ebb`,
> 2026-08-15, dans la foulée du Lot G), 1 seule Attaque/Tour **sans code nécessaire** (règle avancée
> dont elle dépend jamais implémentée pour personne, voir §7.7), routage de la confirmation de défense
> pour un `type='exo'` ✅ codé (2026-08-18, trou trouvé en clôturant ce Lot 2, §7.7). **Lot 2
> intégralement codé** — reste la validation en jeu réel (aucune exo-armure en base à ce jour). Détail
> complet §7. **Improvisation interdite (consigne explicite Saar 2026-07-30, réaffirmée 2026-08-06)**
> — architecture validée contre des dépôts pro réels (Lancer/Foundry VTT, MekHQ) avant tout code. 2 des
> 3 questions RAW tranchées (§2.1, §2.2) ; **§2.3 (seuil de Catastrophe) en stand-by**, dépend de
> `docs/PLAN_TEST_CRITIQUE.md` (chantier séparé, en pause côté Saar) — bloque uniquement le Lot 8.
> Document temporaire (`docs/RegleDocumentaire.md` Règle 10) — à archiver dans `docs/Old/` une fois le
> chantier clos, contenu durable transféré vers `docs/SYSTEME/EXOARMURE.md` (à créer) et
> `docs/VOCABULARY.md`.
>
> **Corrections de dérive au moment de coder le Lot 1 (2026-08-06)**, plan rédigé le 2026-07-30 :
> - Numéro de migration réservé (`225`) déjà pris entre-temps par un autre chantier (Fatigue/Dommages,
>   `225_token_statuses_data.js`) — migration réellement posée : **`233_exo_sheet.js`** (dernière
>   migration présente au moment de coder : `232_chat_messages.js`).
> - Stub UI `value="armure" disabled` déplacé de `Sidebar.jsx` vers
>   `client/src/components/SidebarCharactersTab.jsx:88` (extraction Sidebar antérieure au plan) —
>   activé au même endroit (`value="exo"`, `disabled` retiré).
> - **Trou trouvé en relisant `char-sheet.js:69-91`** (absent de l'analyse à charge du 2026-07-30) :
>   `router.param('characterId')` gate toutes les routes du fichier sur `isOwner || isGm || isDrone` —
>   sans bypass équivalent, un pilote non-propriétaire/non-GM aurait reçu un 403 avant même d'atteindre
>   `exoIsGmOrOwnerOrPilot` dans les handlers PUT, contredisant la décision §6.3. Corrigé : `isExo`
>   ajouté au bypass, même patron que `isDrone` (lecture ouverte à tout membre de campagne, écriture
>   gardée séparément par route).
> - §6.3 contenait une contradiction interne (« exige `template_id` dans le payload ») laissée par
>   inadvertance après la correction du point 1 de l'analyse à charge (`template_id` nullable). Codé
>   selon la version tranchée : `template_id` absent accepté à la création (§6.5, invariant "non
>   configurée").
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
- Test Node ciblé (`233_exo_sheet.test.mjs`) : up/down, CHECK, cascade `character_id`, `template_id`
  nullable + `SET NULL` au lieu de RESTRICT (corrigé, point 1) — en conditions réelles si connexion
  PostgreSQL disponible dans l'environnement d'exécution, sinon signalé explicitement en **Non testé**.
- Scénario réel navigateur (à la charge de Saar, comme d'habitude) : créer une exo-armure de test
  depuis l'UI GM **sans template** (chemin réellement disponible avec le formulaire actuel, corrigé
  point 1), vérifier `exo_sheet` en base, assigner `pilot_character_id` via `PUT /:characterId/exo`
  (tester aussi le rejet si la cible n'est pas `pj`/`pnj`, point 6), assigner `template_id` une fois un
  template inséré à la main en dev, ajuster `itg_*_max`/`itg_*_current` via
  `PUT /:characterId/exo/integrity`.

---

## 7. Lot 2 — Substitution d'attributs — resserré et partiellement codé (2026-08-06)

> Lot 2 n'avait qu'une ligne de description (§3) contrairement au Lot 1. En creusant le code réel
> avant de coder, deux blocages sont apparus — le lot est resserré en conséquence (décision Saar).

### 7.1 Découverte — `socketCombatHelpers.js` bloque toute intégration combat

`resolveMeleeAction` et l'équivalent tir (`socketCombatHelpers.js`, ~2800 lignes) interrogent
`char_sheet` directement par `character.id` à ~8 endroits (attaquant CaC ~1243, défenseur CaC ~1546,
tireur ~2571, + lookups cible), avec un garde `if (!sheetAttaquant) return { suspend:false }`. Aucun
personnage sans `char_sheet` ne peut donc attaquer aujourd'hui — **pas même un drone**, qui subit le
même garde. Il n'existe donc aucun patron existant de "combattant qui emprunte les compétences d'un
autre personnage" à reproduire pour le pilote d'exo-armure.

**Décision Saar (2026-08-06) : le refactor de `socketCombatHelpers.js` nécessaire pour accueillir
cette redirection est mis en pause**, chantier séparé — **cadré depuis, `docs/PLANS/PLAN_COMBATANT_CONTEXT.md`
(2026-08-06)**. Point de couture unique retenu : `resolveHumanoidTestContext(db, character, skillId)`
(`server/src/lib/combatantContextService.js`) — 7 sites recensés par lecture intégrale (pas 8,
l'estimation ci-dessus), pas une table de dispatch mais des guard clauses par `character.type`.

**Mise à jour 2026-08-13 : Lots A-F de `PLAN_COMBATANT_CONTEXT.md` clos** (détail complet
`docs/JOURNAL8.md` session du même jour) — les 7 sites recensés migrent tous vers ce point d'entrée
unique, plus aucune réimplémentation inline de la chaîne attrs/archetype/skills/mutations, validé en
jeu réel sur `pj`/`pnj`.

**Mise à jour 2026-08-15 : Lot G clos** (`docs/JOURNAL8.md` session du même jour) — dispatcher
`resolveCombatantTestContext` + branche `resolveExoTestContext` assemblés dans
`combatantContextService.js`, les 7 sites rebranchés dessus. **Le jour même, dans la foulée, le
plafond de Compétence par Manœuvre d'armure a aussi été codé** (commit `7247ebb`) — détail §7.7,
jamais reporté ici avant le 2026-08-18.

**Mise à jour 2026-08-18 (dérive documentaire corrigée)** : en reprenant ce Lot 2 pour en faire
l'inventaire, deux choses ressorties de la relecture du code réel (pas de la mémoire de conversation) :
1. Le plafond de Compétence ci-dessus était déjà codé et fonctionnel, mais cette section ne le
   reflétait pas — jamais mis à jour après le commit du 2026-08-15.
2. "1 seule Attaque/Tour" ne demande aucun code aujourd'hui (§7.7) ; en revanche un vrai trou —
   absent de l'inventaire d'origine du 2026-08-06 — a été trouvé : le routage de la confirmation de
   défense pour un `type='exo'` (`resolveMeleeAction`) ignore le pilote et cible le propriétaire brut
   de la fiche exo. Détail et correctif §7.7.

#### Besoins précis de `PLAN_COMBATANT_CONTEXT.md` Lot G sur `computeExoStats` — à livrer par ce Lot 2

Le squelette déjà écrit dans `PLAN_COMBATANT_CONTEXT.md` §3.4 est :

```js
async function resolveExoTestContext(db, exoCharacter, skillId) {
  const exoSheet = await db('exo_sheet').where({ character_id: exoCharacter.id }).first()
  if (!exoSheet?.pilot_character_id) return null
  const pilot = await db('characters').where({ id: exoSheet.pilot_character_id }).first()
  const pilotCtx = await resolveHumanoidTestContext(db, pilot, skillId)
  const exoStats = await computeExoStats(db, exoSheet)  // ← dépendance de ce Lot 2
  return { ...pilotCtx, for_na: exoStats.exf }           // FOR → EXF, §0.2 de ce plan
}
```

**Contrat précis attendu de `computeExoStats`** (à figer au moment de coder ce Lot 2, pas avant) :

1. **Fonction pure, pas d'accès DB** — cohérent avec `charStats.js:4` (*"aucun accès DB"*, doctrine
   déjà établie dans ce projet) et avec la décision §1.7 de ce plan-ci qui la qualifie déjà de
   *"fonction de service pure"*. Signature attendue : `computeExoStats(exoSheet, template)` — pas
   `computeExoStats(db, exoSheet)`. Le join `exo_sheet.template_id → ref_exo_templates` reste à la
   charge de l'appelant (`resolveExoTestContext`, dans l'autre plan), jamais interne à cette fonction.
2. **Retour minimal exigé par le Lot G** : `{ exf: number, ... }` — `exf` est le seul champ
   effectivement consommé aujourd'hui (substitution FOR→EXF, §0.2). `vit` n'est pas nécessaire ici
   (mouvement déjà traité séparément, `movementBudgetService.js`, §7.4) ; `bld` non plus (pipeline de
   dégâts, Lot 4, hors périmètre de ce point de couture). Rien n'empêche que la fonction retourne les
   trois par cohérence architecturale — juste noter qu'un retour partiel ne bloquerait pas ce Lot G.
3. **`template_id` NULL** (exo "non configurée", Lot 1 §6.5) — `computeExoStats` doit soit refuser cet
   appel explicitement (lever ou retourner `null`/`exf: null`), soit documenter clairement qu'elle
   suppose un `template` déjà résolu et non-null, laissant à l'appelant la responsabilité du garde.
   **Ne pas laisser un `NaN`/`undefined` silencieux se propager jusqu'au Seuil de Test** — ce serait
   exactement le genre de trou qu'un `[DBG-DECOUPLAGE]` aurait dû attraper ailleurs dans ce chantier.
4. **Angle mort réel trouvé en écrivant ce besoin, pas encore résolu, à traiter *dans* le Lot G (pas
   ici)** : le squelette ci-dessus fait `{ ...pilotCtx, for_na: exoStats.exf }` — mais `pilotCtx.effectiveMalus`
   et `pilotCtx.modDom` ont déjà été calculés par `resolveHumanoidTestContext` **avec le `for_na` du
   pilote**, pas l'EXF. Écraser `for_na` après coup dans l'objet retourné ne recalcule pas ces deux
   champs, alors que ce plan-ci exige justement leur substitution (§2.1 *"Lot 4 réutilise
   `getModDom(exf)`"*, §2.2 *"Encombrement sur EXF... réutilise `calcEncumbrancePenalty` en substituant
   EXF à FOR_na"*). Le squelette actuel de `resolveExoTestContext` est donc **incomplet en l'état** —
   corrigé quand le Lot G sera réellement codé (probablement : recalcul explicite de `effectiveMalus`/
   `modDom` avec `exoStats.exf`, au prix d'un second petit fetch wounds/inventory/settings côté
   `resolveExoTestContext`, même compromis déjà accepté ailleurs dans ce chantier pour des duplications
   mineures). **Ne change rien aux besoins de ce Lot 2** — noté ici pour que la personne qui code ce
   Lot 2 ne soit pas surprise si `computeExoStats` est rappelée avec des arguments légèrement
   différents de ce squelette une fois le Lot G réellement écrit.
5. **Priorité de livraison** : `computeExoStats` seule débloque le Lot G — elle ne dépend d'aucune
   autre pièce de ce Lot 2 (ni le plafond de Compétence, ni "1 seule Attaque/Tour", tous deux des
   gardes de Déclaration/Résolution qui ne concernent pas la résolution du contexte de Test). Si ce
   Lot 2 est découpé en sous-étapes, livrer `computeExoStats` en premier permet au Lot G de démarrer
   sans attendre la fermeture complète de ce Lot 2.

**`computeExoStats` — ✅ codée (2026-08-13)**, `shared/exoStats.js` (pas `server/src/lib/`, fonction
pure sans DB, même famille que `shared/polarisUtils.js`/`shared/exoConstants.js` — réutilisable
côté client sans dupliquer la formule). Signature `computeExoStats(exoSheet, template)`, retour
`{ exf, bld, rd }` (`bld`/`rd` ajoutés par cohérence architecturale au-delà du strict besoin du Lot G
— `vit` volontairement exclu, déjà porté par `movementBudgetService.js` §7.4). `template` absent/`null`
→ retourne `null` (jamais de `NaN` silencieux, point 3 ci-dessus).

Deux points RAW non tranchés par le texte source (`REGLEARMURE.md:565-621`), décidés par Saar
(session 2026-08-13/14) — pas un raccourci silencieux (§1.9) :
- Exosquelette et Générateur réduisent l'EXF de façon **cumulative**, pas indépendamment — mais
  **jamais par deux `floor` séquentiels**. Analyse à charge (2026-08-14) : `exo_sheet` ne garde aucun
  historique de quel composant a été touché en premier (§1.7, "recalculées à chaque lecture", pas de
  journal d'événements) — un double floor dans un ordre choisi (Exosquelette d'abord, comme codé en
  premier jet) inventerait donc un ordre RAW inexistant. Vérifié par calcul exhaustif :
  `floor(floor(x×a)×b) ≠ floor(floor(x×b)×a)` dans 225 cas sur la plage réaliste (EXF 20-70,
  Intégrité 0-15) — ex. EXF base 21, Exosquelette à 7, Générateur à 3 → 7 dans un ordre, 6 dans
  l'autre. **Corrigé** : les deux facteurs se combinent en une seule multiplication avec un seul
  arrondi final (`floor(base × facteur_exosquelette × facteur_générateur)`) — commutatif par
  construction, plus aucun ordre à trancher.
- Générateur à Intégrité ≤ 0 → **EXF = 0** (le RAW dit seulement "l'armure n'est plus alimentée",
  sans le formuler explicitement en EXF — contrairement à `MANUEL_EXOARMURE.md` qui l'affirmait sans
  le sourcer).

**Trouvaille distincte pendant cette lecture, non corrigée ici** (CLAUDE.md §6.8, un plan = un seul
problème) : `getExoMovementBudget` (`movementBudgetService.js`, §7.4 déjà clos) n'applique aucune
réduction de Vitesse liée aux paliers Exosquelette/Générateur, alors que le RAW réduit aussi la
Vitesse "déplacement naturel" à ces mêmes paliers (`REGLEARMURE.md:567-568,589-590,595-596`). Ouvert
comme ticket séparé `EXOARM-VIT-PALIERS1` (`bug_tickets`, confirmé par Saar), pas dans `EN_COURS.md`.

**Robustesse ajoutée en analyse à charge (2026-08-14)** : `EXO_RD_TABLE` vérifiée ligne à ligne contre
le RAW (`REGLEARMURE.md:90-98`, exacte) ; `computeExoStats` lève désormais une erreur explicite si
`template.category` n'est pas une clé de `EXO_RD_TABLE`, plutôt qu'un repli silencieux sur `0`
(indiscernable de la valeur RD réelle d'exo-alpha) — même doctrine que le point 3 du contrat Lot G
("jamais un NaN/undefined silencieux").

**Testé (2026-08-14)** : `shared/exoStats.test.mjs` (18 tests) — les deux exemples chiffrés littéraux
du RAW (EXF 68/Exosquelette 8 → 45, Blindage 34/Structure 7 → 22), le cumul Exosquelette+Générateur
à arrondi unique, un cas de régression documentant l'ancien bug d'ordre (EXF 21, Exosquelette 7,
Générateur 3 → 7 quel que soit l'ordre), les bornes exactes des 3 paliers (11/10, 6/5, 1/0), et le
rejet d'une catégorie RD inconnue. `node --check` sur les deux fichiers. **Non testé** : intégration
réelle via `resolveExoTestContext`/Lot G (autre plan, pas encore codé) — cette fonction n'est appelée
par aucun code de production pour l'instant.

**Conséquence sur le découpage du Lot 2** — état réel au 2026-08-18 (la liste ci-dessous datait du
2026-08-06 et décrivait tout comme bloqué ; jamais mise à jour après coup, corrigé maintenant) :
- **Plafond de Compétence par Manœuvre d'armure** — ✅ codé (commit `7247ebb`, 2026-08-15). Détail §7.7.
- **1 seule Attaque/Tour** — pas un blocage : la règle avancée RAW dont cette restriction dépend
  ("Effectuer plusieurs Attaques par Tour", `REGLESYSCOMBAT.md` p.218) n'est implémentée pour aucun
  type de personnage dans ce projet — rien à plafonner tant qu'elle n'existe pas. Détail §7.7.
- **Routage de la confirmation de défense pour un `type='exo'`** — ✅ codé (2026-08-18) — trou réel
  trouvé en clôturant ce Lot 2 (absent de l'inventaire d'origine du 2026-08-06). Détail §7.7.
- **Substitution VIT pour le mouvement** — ✅ codé (§7.3) : vit dans `movementBudgetService.js`,
  fichier autonome.
- **BLD** (protection) — pas encore attaqué, dépend du pipeline de dégâts (Lot 4).

### 7.7 Clôture réelle du Lot 2 (2026-08-18)

**Plafond de Compétence par Manœuvre d'armure — ✅ codé (commit `7247ebb`, 2026-08-15).**
`calcLimitedSkillTotal` (`charStats.js`) plafonne `skillTotal` (jamais `mastery` — le bonus de
Réussite critique reste basé sur la maîtrise réelle, décision validée avec Saar). `resolveExoTestContext`
(`combatantContextService.js`) résout la spécialité RAW applicable depuis `ref_exo_templates.environment`
(mapping direct submarine/atmospheric/spatial ; hybrid replié sur Armures externes sauf
`surface_movement_mode='blocked'`, repli documenté honnêtement tant qu'aucun signal d'immersion temps
réel n'existe, EAU1 ; industrial rejeté explicitement, décision Saar 2026-08-15 en suspens). Câblé sur
les 2 sites CaC de `socketCombatHelpers.js` (attaquant L.1348, défenseur L.1644) via `meleeSkillCap: true`
— jamais pour le tir ni Acrobatie/Équilibre (RAW : seul le contact est limité). **Non testé** : les 24
tests DB de `combatantContextService.test.mjs` (pas de PostgreSQL dans l'environnement de dev), aucun
scénario réel en jeu (aucune exo-armure en base à ce jour).

**1 seule Attaque/Tour — aucun code nécessaire (décision documentée, pas un raccourci silencieux,
§1.9).** RAW (`REGLESYSCOMBAT.md:207`) : *"qu'une seule Attaque par Tour (si vous utilisez la règle
avancée Effectuer plusieurs Attaques par Tour, page 218)"* — restriction sur une règle avancée
optionnelle. Vérifié par lecture (`64_combat_mode.js` : 5 valeurs normal/offensif/charge/défensif/
retraite, aucun mode "Enchaînement" ; `socketCombatAnnouncement.js` : aucune déclaration de marqueurs
d'Initiative supplémentaires pour une deuxième Attaque) : cette règle avancée n'existe pour aucun type
de personnage dans ce projet — chaque combattant ne peut déjà déclarer qu'une seule action par Tour
(`combat_roster.has_announced`, booléen). Rien à plafonner tant que la règle de base n'existe pas.
**À rouvrir uniquement le jour où "Plusieurs Attaques par Tour" serait implémentée pour les
humains** — ce Lot 2 devra alors exclure explicitement le pilote d'exo-armure de ce bénéfice, un seul
point de bascule (probablement `meleeSkillCap`/un flag jumeau dans `combatantContextService.js`).

**Routage de la confirmation de défense pour un `type='exo'` — trou réel, en cours.** `resolveMeleeAction`
(`socketCombatHelpers.js:1719-1725`) ne teste que `defenderCharacter.type === 'pnj'`/`'drone'` — un
défenseur exo retombe donc sur `resolveMeleeDefensePj`, qui cible `defenderUserId = defenderCharacter.user_id`
(propriétaire brut de la fiche exo), **jamais le pilote actif** (`exo_sheet.pilot_character_id`). Deux
défauts distincts, pas un seul :
1. Pilote **PJ** : le prompt de confirmation part vers le mauvais utilisateur dès que propriétaire ≠
   pilote actif.
2. Pilote **PNJ** : le code actuel attend une confirmation utilisateur qui ne viendra jamais
   légitimement — `resolveMeleeDefensePnj` existe déjà et auto-résout sans prompt pour tout défenseur
   PNJ normal, mais n'est jamais atteint pour un exo piloté par un PNJ.
**✅ Codé (2026-08-18)** : la branche suit désormais le **type effectif du pilote**, pas le type brut de
l'exo — `resolveCombatantSheetId` étendue en `resolveCombatantIdentity` (`combatantContextService.js`)
retourne `{ sheetId, userId, effectiveType }`, `resolveMeleeAction` branche sur `effectiveType`. Détail
complet et tests dans `docs/JOURNAL8.md` (session 2026-08-18) et `docs/SYSTEME/COMBAT.md` — pas
dupliqué ici une deuxième fois (Règle 2 documentaire). **Testé** : `combatantContextService.test.mjs`
25/25 verts contre PostgreSQL réel. **Non testé** : scénario réel en jeu (aucune exo-armure en base).

### 7.2 RAW — Manœuvre d'armure (texte complet fourni par Saar, 2026-08-06)

À réutiliser telle quelle quand le refactor combat reprend :

> Manœuvre d'armures […] Attributs associés : COO/ADA. Compétence limitative pour : toutes les
> actions physiques en armure, notamment Acrobatie/Équilibre, Athlétisme, Escalade ou les Compétences
> de combat au contact. **Les Compétences de combat à distance ne sont, elles, pas limitées.**
> [...] De nombreuses armures — dites "hybrides" — peuvent être utilisées dans plusieurs milieux
> différents : le personnage doit développer la Compétence qui correspond à chaque milieu.
> - Armures atmosphériques (X)
> - Armures externes (y compris armures de Surface)
> - Armures sous-marines
> - Armures spatiales (-3)
> Note : en milieu sous-marin ou en apesanteur, la Compétence de Manœuvre d'armure appropriée
> **remplace** Manœuvres 0G / Manœuvres sous-marines, annulant les pénalités de milieu normalement
> subies sans assistance mécanique.

Conséquences pour l'implémentation future (pas codées maintenant) :
- Le plafond ne s'applique **jamais** aux Compétences de combat à distance — ce n'est pas une
  simplification v1, c'est la règle RAW elle-même (contrairement à ma formulation initiale "combat
  uniquement en v1" qui laissait entendre une restriction temporaire).
  Le périmètre v1 confirmé par Saar (2026-08-06) est donc : plafond sur les Compétences de combat au
  contact uniquement (le sous-ensemble RAW-exact) ; Acrobatie/Athlétisme/Escalade hors combat →
  reportées en v2.
- 4 spécialités déjà présentes dans `ref_skills` (migration 105) :
  `MANOEUVRE_DARMURE__ARMURES_ATMOSPHERIQUES`, `__ARMURES_EXTERNES`, `__ARMURES_SOUS_MARINES`,
  `__ARMURES_SPATIALES` — marqueurs `(X)`/`(-3)` à vérifier en base contre le texte RAW ci-dessus
  avant tout code (pas fait, hors scope tant que le refactor est en pause).

### 7.3 Armement exo — vérifié, rien à construire

Hypothèse initiale (Saar) : les armes utilisables par une exo-armure seraient toutes catégorisées
sous une compétence dédiée ("Arme sous-marine"). **Vérifié faux en l'état** — `ARMES_SOUS_MARINES`
est une compétence déjà existante (`ref_skills`, `skill_group: 'Combat (tir)'`), déjà utilisée par
les armes à harpon/torpille des plongeurs humains (migration 135), sans lien avec les exo-armures.
Aucune arme à l'échelle exo n'existe encore dans `ref_equipment` (catalogue exo pas commencé, Lot 5e).
**Conclusion : le mécanisme déjà en place (`ref_equipment_skill_assoc` → skill_id de l'arme,
`char-sheet.js`/`socketCombatHelpers.js` ligne ~1322-1324) s'applique tel quel à un pilote d'exo —
`ARMES_SOUS_MARINES` est simplement la bonne compétence pour une arme sous-marine, humaine ou
pilotée. Rien de nouveau à construire pour la catégorisation des armes.**

### 7.4 Mouvement (VIT) — ✅ codé (2026-08-06)

RAW (`REGLEARMURE.md:107-122`) : *"[VIT] est comparable à l'Agilité et aux Compétences Athlétisme et
Hybride des êtres humains [...] lorsqu'il s'agit de déterminer leur capacité de déplacement [...]
utilisez simplement la Vitesse"*. VIT remplace donc **à la fois** la Coordination (base) et
l'Athlétisme (plafond) humains — pas seulement l'un des deux. `calcAllures(vit, vit)`
(`shared/polarisUtils.js`) est réutilisé tel quel, aucune nouvelle formule.

`server/src/services/movementBudgetService.js` — `getCharacterMovementBudget` branche désormais sur
`characters.type` (nouvelle requête `characters` en tête, avant l'ancien accès direct à `char_sheet`)
et délègue à `getExoMovementBudget` pour `type === 'exo'` :
- Vitesse choisie : Surface tentée en premier, puis Sous-marine en repli (`getExoMovementBudget`,
  `movementBudgetService.js`) — **limitation documentée** : le moteur monde n'a aujourd'hui aucun
  signal d'immersion en temps réel (dette EAU1, `docs/EN_COURS.md` — nappe d'eau ambiante retirée
  2026-07-29). À corriger quand ce signal existera, sans changer la signature de la fonction (un seul
  point de bascule, l'ordre du tableau `milieux` dans `getExoMovementBudget`). Revu et étendu §7.5
  après vérification contre 16 armures RAW réelles (mode `pilot`/`blocked` par milieu).
- `template_id` absent (exo "non configurée", Lot 1 §6.5) → erreur explicite plutôt qu'un budget
  silencieusement nul.
- Aucun changement aux 4 call sites existants (`socketCombatAnnouncement.js`, `socketToken.js`,
  `battlemaps.js`, `socketCombatResolution.js`) — la branche est interne à
  `getCharacterMovementBudget`, transparente pour les appelants.

**Non testé** : scénario réel navigateur (déplacer un token exo en combat/hors combat) — dépend du
Lot 1 non encore testé en navigateur (aucune exo-armure réelle en base pour l'instant).

### 7.5 Vérification "stockabilité" contre 16 armures RAW réelles (2026-08-06)

Demande Saar : vérifier que les armures RAW (`REGLEARMURE.md` p.339-348 — Explora, Typhon, Nymph 1-A,
Série A, Vanguard, Sylph 56, Vauban, Condor, Cougar, Mentor, Heimdall-Pyrelia, Ouraken, Odin, Vulcain,
Moloch, Orka) sont représentables dans le schéma `ref_exo_templates` (migration 233, pas encore
appliquée — éditée directement, pas de nouvelle migration).

**Confirmé correct sans changement :**
- Résistance aux Dommages — toujours exactement la valeur de `EXO_RD_TABLE` (catégorie), sur les 16
  exemples sans exception. Valide la décision Lot 1 §2.1 (pas stockée par template).
- Blindage, Exo-Force — varient indépendamment de la catégorie (Explora/Typhon même catégorie,
  Blindage 15 vs 17) → colonnes par instance de template, correctement modélisées.

**Gaps trouvés (corrigés initialement en éditant 233 directement, sous l'hypothèse erronée qu'elle
n'avait pas encore tourné — elle l'avait déjà été le même jour, 09:50:27. Réparé le 2026-08-12,
SCHEMADRIFT-EXOTEMPLATES1 : 233 restauré à son contenu réellement exécuté, ces colonnes portées pour
de bon par `243_ref_exo_templates_movement_and_commerce.js`, détail `docs/JOURNAL8.md`) :**
1. **Vitesse** — un simple entier par milieu ne suffisait pas. 3 colonnes ajoutées par milieu
   (`underwater_movement_mode`/`surface_movement_mode`, CHECK `'vit'|'pilot'|'blocked'`,
   `speeds_extra jsonb`) :
   - `'pilot'` — RAW Armure Explora, "à terre : capacité de déplacement du personnage" : le mouvement
     délègue entièrement au budget humain du pilote. `getExoMovementBudget` (§7.4) redirige de façon
     récursive vers `getCharacterMovementBudget(pilot_character_id, gait)`.
   - `'blocked'` — RAW Armure Vulcain, "à terre : -" (incapable de se déplacer hors de l'eau) : milieu
     sauté, repli sur l'autre.
   - `speeds_extra` (narratif, **non consommé** par `getExoMovementBudget`) — plusieurs armures
     donnent 2 vitesses par milieu (ex. "10 exo-palmes / 20 propulseur" sous l'eau). RAW
     (`REGLEARMURE.md:249-255`) : seul le déplacement naturel compte pour le mouvement de combat
     standard — un propulseur project hors de portée en 1-2 Tours, mécanique d'évasion narrative
     distincte, pas un choix d'Allure. `base_speed_*` porte donc uniquement le mode naturel.
2. **Descriptif/commerce** — `manufacturer`, `price`, `rarity`, `tech_level` (texte : la source donne
   "III"/"III-IV", jamais un entier propre, donc pas le même type que `ref_equipment.tech_level`),
   `autonomy` (texte, comme `drone_sheet.autonomie`) — présents dans 100% des exemples RAW, absents du
   schéma initial. Ajoutés.
3. **Systèmes auxiliaires / Armement par défaut du template** — chaque armure RAW liste 10-25 items.
   Toujours hors scope, déjà couvert par le renvoi au Lot 5e (§3) — pas une nouvelle dette.

**Testé (2026-08-06) :** `node --check` sur les fichiers touchés.
**Testé (2026-08-12, réparation SCHEMADRIFT-EXOTEMPLATES1) :** `233_exo_sheet.test.mjs` +
`243_ref_exo_templates_movement_and_commerce.test.mjs` exécutés contre PostgreSQL réel (30/30 tests
migrations verts, suite serveur complète 244/244), rejeu intégral depuis une base neuve diffé
octet-pour-octet contre la base réelle (`\d ref_exo_templates` identique) — détail `docs/JOURNAL8.md`.

### 7.6 Bug trouvé et corrigé — `getModDom()` (`server/src/lib/charStats.js`)

Question Saar en vérifiant §7.5 : le Modificateur de Dommages des exo-armures utilise-t-il une table
différente de celle des personnages ? Réponse vérifiée : **non** — RAW (`REGLEARMURE.md:130-131`)
confirme explicitement la même formule. Mais la vérification a révélé un vrai bug dans le code
existant, **affectant tous les personnages** (pas spécifique aux exo-armures) : l'extrapolation de
`MOD_DOM_TABLE` (LdB p.113, tranches de 2 points) au-delà de sa dernière tranche connue (20-21 → +5)
utilisait `Math.floor((for_na-21)/2)` au lieu de `Math.ceil(...)` — faux de -1 sur tout écart impair.

Vérifié contre 16 armures RAW réelles (7 cas discriminants, écart impair) : `Typhon EXF 30 → +10 (pas
+9)`, `Condor EXF 42 → +16 (pas +15)`, `Mentor EXF 50 → +20 (pas +19)`, `Odin EXF 60 → +25 (pas +24)`,
`Vulcain EXF 62 → +26 (pas +25)`, `Moloch/Orka EXF 68 → +29 (pas +28)` — `ceil` correct sur 7/7 cas
discriminants, `floor` sur 0/7. Confirmé aussi par la continuation naturelle des tranches de
`MOD_DOM_TABLE` elle-même (tranches de 2 : 22-23→+6, 24-25→+7...), pas seulement un ajustement pour
coller aux exemples.

**Corrigé** (`charStats.js:172-179`), avec test dédié (`charStats.test.mjs`, nouveau fichier — aucun
test n'existait pour ce module) : table basse + 12 valeurs d'extrapolation vérifiées contre les 16
armures RAW. **Testé :** `node --test src/lib/charStats.test.mjs` — 2/2 passent.

**Portée de la correction** : `getModDom` est utilisée pour tout personnage avec FOR_na > 21 en
dégâts au contact (pas seulement les exo-armures, cf. `getModDom` appelée depuis
`socketCombatHelpers.js` pour le CaC humain) — correction déjà en production dès ce commit, pas
conditionnée à l'avancement du chantier Exo-armures. **Non testé** : impact réel en jeu sur un
personnage FOR_na > 21 (aucun cas connu actuellement en base, `[INCONNU]`).
