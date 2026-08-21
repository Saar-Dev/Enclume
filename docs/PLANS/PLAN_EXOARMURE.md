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
> complet §7. **Lot 2bis (Armure à terre) ✅ codé (2026-08-19, §9)** — fondation UI dédiée exo-armure
> (§8) codée le même jour, migration `249`, `resolveExoStandUpAction`, `CombatExoActionWindow.jsx`
> joueur+MJ. Trou de permission trouvé et corrigé au passage (`isExoActorAuthorized`, §9.3) : un
> pilote ≠ propriétaire ne pouvait déclarer aucune action pour son exo, pas seulement se relever.
> **Lot 3 (Initiative) ✅ codé (2026-08-19, §10)** — `min(Réaction, Manœuvre d'armure) − malus`
> (`COMBAT_START`, `socketCombatState.js`), seuil différé volontairement non géré (décision Saar).
> Même bug de routage trouvé une 3ᵉ fois (`is_pnj`/ciblage `COMBAT_SURPRISE_ROLL`) et corrigé au
> passage. **Non testé en navigateur** (aucune exo-armure en base à ce jour). **Improvisation interdite (consigne explicite Saar 2026-07-30, réaffirmée 2026-08-06)**
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
  combat, plafond de Compétence par Manœuvre d'armure, 1 seule Attaque/Tour. **✅ codé (2026-08-18,
  §7)**.
- **Lot 2bis — Armure à terre** : Test de Manœuvre d'armure pour se redresser (§2.2, §9). **✅ codé
  (2026-08-19, §9)**, non testé en navigateur.
- **Lot 3 — Initiative** : `min(Réaction, Manœuvre d'armure) − malus environnemental (×2 hors-milieu)`.
  Seuil différé **volontairement non géré** (décision Saar 2026-08-19, §10.1). **✅ codé (2026-08-19,
  §10)**, non testé en navigateur.
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

**Trouvaille en relisant §2.2 avant de clore ce Lot** : §2.2 assignait aussi le **Malus de Saisie/Lutte**
(`EXO_GRAPPLE_MALUS_TABLE`, `shared/exoConstants.js`, déjà écrite au Lot 1) à ce Lot 2 — jamais vérifié
depuis. **Vérifié (2026-08-18), même conclusion que "1 seule Attaque/Tour" : aucun code nécessaire.**
`ARTS_MARTIAUX_LUTTE` (`ref_skills`) n'est référencée nulle part dans `socketCombatHelpers.js` ou
ailleurs en résolution de combat — seulement dans les migrations de seed carrières (achat de la
Compétence à la création). Le statut `grappled` existe (`token_statuses`), mais uniquement comme
toggle manuel MJ/propriétaire (`TOKEN_STATUS_TOGGLE`, `socketToken.js:143-162`, même famille que
`stunned`/`blinded`/`poisoned`) — jamais posé par un jet automatisé. La Lutte comme action de combat
distincte (Test de Saisie en opposition, RAW p.225) n'est pas mécanisée dans ce projet, exactement
comme "Plusieurs Attaques par Tour" — rien à plafonner tant qu'aucun Test de Lutte n'existe à plafonner.
**À rouvrir si la Lutte est un jour mécanisée** (Test de Saisie automatisé) — `EXO_GRAPPLE_MALUS_TABLE`
reste prête, juste jamais consommée.

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

---

## 8. Décision d'architecture UI — fenêtres dédiées exo-armure (2026-08-18 planifié, ✅ codé 2026-08-19)

> Origine : en cadrant le Lot 2bis avec Saar, question ouverte sur où loger l'interface de "tenter de
> se relever". Saar : *"l'interface actuelle, pour humanoïde, n'est sans doute pas adaptée à
> l'interface Exo-armure [...] des fenêtres dédiées aux actions en exo-armure plutôt que tout mixer
> dans les fenêtres humanoïdes [...] plus simple à coder et pour l'utilisateur."* Inventaire fait par
> lecture réelle du code client (pas de suppositions) avant de trancher — détail ci-dessous.

### 8.1 Constat — l'axe de découpage réel aujourd'hui

Ce n'est pas "une fenêtre par type de personnage" mais "une fenêtre par contrôleur" :
`CombatOverlay.jsx` (854 lignes) monte `CombatGmDeclareWindow.jsx` (1284 lignes) si `isGm`,
`CombatActionWindow.jsx` (1753 lignes) si joueur (`client/src/components/CombatOverlay.jsx:184,204`)
— chacune gère ensuite **tous les types** que son contrôleur possède, avec des branches
`isDrone`/`!isDrone` scattées à l'intérieur (16 occurrences dans `CombatActionWindow.jsx`, 6 dans
`CombatGmDeclareWindow.jsx`) qui masquent des sections entières (Position/Vitesse, Armement, Actions
rapides, panneau d'assaut droit) plutôt que de dispatcher proprement.

### 8.2 Ce qui est déjà générique (prouvé par le précédent drone)

- `useAutoMoveMode.js` / `useCombatClickAttack.js` (`client/src/lib/`) — survol déplacement +
  clic-attaque ambiants, déjà type-agnostiques (consommés indifféremment par le PJ direct et par
  `useDroneDeclare.js` qui les enveloppe).
- `useDraggable.js`, le transport socket/chat/dice (`DICE_RESULT`), `CombatDamageWindow.jsx` (jet de
  dégâts post-touche) — déjà consommés indifféremment par PJ/PNJ/drone, aucune raison qu'un exo y
  échappe.
- La table `position` de `combatSections.js` (`STATE_DEFS.position`, composant `StateSelector`) —
  `state_position` vit sur `combat_roster`, pas sur `char_sheet` : réutilisable telle quelle côté
  affichage pour l'exo. Seul le **coût côté serveur** diverge pour la transition depuis `prone` (Test
  au lieu d'un coût fixe, §9) — invisible pour ce composant d'affichage.

### 8.3 Ce qui est humanoïde-only, sans équivalent à construire pour l'exo

Encombrement/inventaire (`char_inventory`), blessures/fatigue, Tir visé/Lunette
(`shared/combatExclusiveActions.js`). **`declarationReducer.js`/`DECLARATION_INITIAL`** (le
`useReducer` qui porte tout l'état de déclaration humanoïde) — le précédent drone le contourne déjà
entièrement : `useDroneDeclare.js` gère son propre état via de simples `useState` locaux, jamais ce
reducer. Ce précédent tranche la question pour l'exo aussi : ne pas raccrocher au reducer humanoïde,
construire un état local propre.

### 8.4 Ce qui n'existe nulle part encore

Affichage pilote (lecture `exo_sheet.pilot_character_id`), jauges d'Intégrité (Structure/
Exosquelette/Générateur, Lot 4+), Avaries/Incidents (Lot 5+), sélection d'arme depuis
`hardpoints`/`equipped_systems` (Lot 5e — pas `char_inventory`). **Brique immédiate (Lot 2bis, §9)** :
déclarer/résoudre "Tenter de se relever" avec son jet et sa conséquence de fin de Tour en cas
d'échec.

### 8.5 Décision retenue

Le drone a eu son propre hook (`useDroneDeclare.js`) mais pas sa propre fenêtre — suffisant parce que
sa divergence reste limitée (armement + cible, rien d'autre, §8.1). L'exo diverge davantage dès ce
lot et continuera à diverger à chaque lot suivant (pilote, Intégrité, Avaries, hardpoints) :
empiler des `isExo` dans `CombatActionWindow.jsx`/`CombatGmDeclareWindow.jsx` reproduirait le même
défaut que celui déjà visible avec `isDrone` (§8.1), en pire (plus de sections nouvelles à venir).

**Retenu :**
1. **`client/src/lib/useExoDeclare.js`** (nouveau, même forme que `useDroneDeclare.js`) — état local
   propre (pas `declarationReducer`), compose `useAutoMoveMode`/`useCombatClickAttack` (génériques,
   §8.2) tels quels.
2. **`client/src/components/CombatExoActionWindow.jsx`** (nouveau) — monté par `CombatOverlay.jsx` à
   la place de `CombatActionWindow` quand `character.type === 'exo'` (même point de branchement que
   `isGm` aujourd'hui, `CombatOverlay.jsx:199-219`), pour le pilote joueur d'une exo. Réutilise
   `StateSelector`/`STATE_DEFS.position` (§8.2), `useDraggable`, `CombatDamageWindow` (inchangé,
   monté par `CombatOverlay.jsx` comme aujourd'hui) ; ne réutilise pas `declarationReducer` (§8.3).
3. **Côté MJ** : pas de nouvelle fenêtre séparée — `CombatGmDeclareWindow.jsx` gère déjà "tout ce que
   le MJ contrôle" par nature (son rôle actuel), une section dédiée `isExo`-branchée y suffit, à
   condition qu'elle reste groupée (un seul bloc clairement délimité) plutôt que scattée comme
   `isDrone` l'est aujourd'hui — pas un nouveau composant, une discipline de rédaction.

**Portée immédiate (Lot 2bis, §9)** : `CombatExoActionWindow.jsx`/section MJ n'ont besoin de porter
qu'une chose pour l'instant — le bouton "Tenter de se relever" (visible seulement si
`entry.state_position === 'prone'`) + l'affichage du résultat du Test. Pilote/Intégrité/Avaries/
hardpoints suivent aux lots suivants, sur le même squelette.

**Hors périmètre de cette décision** : le contenu détaillé des lots 3-8 (pas encore instruits) ;
`DroneWeaponPanel.jsx`/`DroneDeclareSection.jsx` (précédent drone, non touchés, juste lus comme
référence).

---

## 9. Lot 2bis — Armure à terre (plan détaillé 2026-08-18, ✅ codé 2026-08-19)

> **Clôture (2026-08-19)** : codé intégralement selon ce plan, y compris la correction (a) exclusivité
> tranchée par Saar (« oui, exclusivité de l'action ») et la correction (b) primitif de résolution
> (`computeAttackRoll`, pas `resolvePolarisTest` — erreur trouvée en analyse à charge). Détail complet
> (fichiers, testé/non testé) : `docs/JOURNAL8.md`, session 2026-08-19. **Testé** : `node --check` +
> chargement runtime + 33/33 tests `combatantContextService.test.mjs` + 6/6 `combatExclusiveActions.test.mjs`
> + lint/build client propres. **Non testé** : scénario réel en jeu (aucune exo-armure en base).

### 9.1 RAW

`REGLEARMURE.md:381-395` (Armure à terre, optionnel — entrée dans le périmètre par décision §2.2) :

> Si une armure de catégorie exo-1 et plus est mise à terre, à l'air libre, il faudra effectuer un
> Test de Manœuvre d'armure pour la redresser, avec les malus suivants :
> Exo-1 : +5 · Exo-2 : +3 · Exo-3 : +0 · Exo-4 : -3 · Exo-5 : -5 · Exo-6 : -7 · Exo-oméga : -10.
> Sous l'eau, cela ne pose problème que si l'armure n'est pas équipée de palmes ou d'un système de
> propulsion.

Table déjà transcrite Lot 1 : `EXO_PRONE_RECOVERY_TABLE` (`shared/exoConstants.js`), jamais consommée
à ce jour (vérifié `grep` — zéro résultat côté serveur).

**Précision Saar (2026-08-18, RAW muet sur ce point)** : Test raté = reste à terre, **fin du Tour**
pour ce personnage — pas de retry automatique au Tour suivant, le joueur redéclare explicitement la
tentative au Tour suivant s'il le souhaite.

**Correctif d'architecture (Saar, 2026-08-18)** : ma proposition initiale de résoudre ce Test en
phase Annonce était fausse — *"rien ne se résout en phase Annonce. C'est dans le nom. Phase ANNONCE,
phase RÉSOLUTION."* Cohérent avec l'invariant déjà écrit dans `.claude/rules/combat.md` ("Seule la
phase RÉSOLUTION vérifie ce qui est réellement possible") — je l'avais lu comme portant seulement sur
les cibles/portée/LOS, Saar clarifie qu'il porte sur toute résolution, sans exception. Le Test se
résout donc en Résolution, exactement comme une attaque.

### 9.2 Mécanisme retenu

**Déclenchement** : `character.type === 'exo'` et `entry.state_position === 'prone'` et la position
déclarée (`state.position`) ≠ `'prone'` — une tentative de se relever.

**Exclusivité — ✅ tranchée (Saar, 2026-08-18) : exclusif dans tous les cas.** Question soulevée en
analyse à charge (ma première rédaction extrapolait au succès une précision Saar qui ne portait
littéralement que sur l'échec, §9.1) — confirmé explicitement par Saar : *"oui, exclusivité de
l'action"*, sans distinction succès/échec. Cohérent avec le signal externe déjà noté (BattleTech,
déjà une source validée dans ce document, §4) : *"the next movement phase can only be used to stand
up"* — se relever y consomme toute la Phase de Mouvement même en cas de réussite. Architecture
retenue : rejet à la **déclaration** si combiné à une attaque/un déplacement dans la même soumission
(`COMBAT_DECLARE_ERROR`, même philosophie que `getAimIneligibilityReasons`/`isExclusiveDeclaration`,
`shared/combatExclusiveActions.js`) — rien à annuler après coup à la Résolution, la déclaration
elle-même garantit qu'aucune autre action n'existe pour ce Tour.

**Coût d'Initiative** : inchangé — la table `POSITION_TRANSITION_COST` (`shared/combatStatePositionCost.js`,
`prone → standing/crouching/kneeling : -10`) continue de s'appliquer telle quelle à la Déclaration ;
elle modélise le temps physique de la tentative, indépendant de son issue. Ce qui change pour l'exo
n'est *pas* ce coût mais le fait que l'écriture de `state_position` elle-même doit désormais **attendre
la Résolution** (§9.3) au lieu d'être immédiate comme pour un humain.

**Seuil du Test** : Compétence Manœuvre d'armure du **pilote** (résolution déjà existante,
`resolveManeuverSkillId(template)` dans `combatantContextService.js` — actuellement fonction interne
réservée à `meleeSkillCap`, **à exporter**, pas dupliquer, Règle 2 documentaire) `+`
`EXO_PRONE_RECOVERY_TABLE[template.category]`.

**Correction (analyse à charge, 2026-08-18)** : ma première rédaction citait `resolvePolarisTest`
(`polarisTestService.js`) "même primitif que `fallDamageService.js`" — **vérifié faux en relisant les
deux fichiers.** `resolvePolarisTest` ne produit ni `breakdown` (liste de contributions affichable),
ni bonus de Réussite critique (`applyCriticalSuccessBonus`, jamais appelé dans `resolveFall`) ; et
`fallDamageService.js` n'émet même pas de `DICE_RESULT` visible en chat pour ce Test — un jet
interne, pas un jet public. Or ce Lot veut explicitement un jet visible (§9.1). **Le bon primitif est
`computeAttackRoll`** (`server/src/lib/combatAttackRoll.js`), le même noyau pur que
`resolveMeleeDefensePnj`/`resolveMeleeDefensePj` — c'est lui qui produit `breakdown` et s'articule
avec `applyCriticalSuccessBonus`/`resolveCriticalFailReroll`/`maybeTriggerCatastrophe`, la chaîne
complète déjà standard pour tout Test de combat affiché. Mécanisme corrigé :
1. `parseDice('1d20')` (jet réel, comme tout Test de combat).
2. `computeAttackRoll({ skillLabel: 'Manœuvre d'armure', skillTotal, totalLabel: 'Seuil', rollAttaque: roll, contributions: [{ label: 'Catégorie ' + template.category, value: EXO_PRONE_RECOVERY_TABLE[template.category], type: ... }] })`.
3. `applyCriticalSuccessBonus(outcome, getCriticalSuccessBonus({ masteryLevel: ctx.mastery }))` puis
   `resolveCriticalFailReroll(outcome)` — même séquence que `resolveMeleeDefensePnj`, pas une
   variante maison.
4. `maybeTriggerCatastrophe(io, campaignId, tokenId, outcome.catastropheRisk, { site: 'exo_stand_up', actorTokenId: tokenId, targetTokenId: null })`
   — **omis de ma première rédaction**, à inclure : ce Test suit la même règle Catastrophe que tout
   Test de combat en Résolution, `targetTokenId: null` accepté (champ descriptif seulement, vérifié
   dans `catastropheService.js`, aucune structure imposée à `context`).
5. `io.to(campaignId).emit(WS.DICE_RESULT, { ... skillLabel: 'Tentative de se redresser', breakdown, ... })`
   — même forme que `resolveMeleeDefensePnj`.
- **Succès** : `combat_roster.state_position` se met à jour vers la position déclarée (portée par
  `combat_actions.modifiers.targetPosition`, §9.3 — jamais réécrite en amont, contrairement à un
  humain).
- **Échec** : `state_position` reste `'prone'` (déjà sa valeur — aucune écriture). Rien d'autre ne
  s'exécute ce Tour, garanti par l'exclusivité de la déclaration ci-dessus — jamais par une logique
  d'annulation a posteriori (aucune action à annuler, elle n'a jamais pu être déclarée en même temps).

**Angle mort assumé, pas nouveau** : l'exemption sous-marine (palmes/propulseur) dépend d'un signal
d'immersion temps réel que le moteur monde n'expose pas (dette **EAU1**, déjà acceptée pour
`getExoMovementBudget`, `PLAN_EXOARMURE.md` §7.4). Le Test s'applique dans tous les cas plutôt que
d'inventer une détection — même limitation documentée, pas une nouvelle compromission.

**Deux points vérifiés en analyse à charge (2026-08-18), sans changement au plan :**
- **`environment='industrial'` (template sans spécialité Manœuvre d'armure définie, décision Saar
  2026-08-15 en suspens)** — `resolveManeuverSkillId` lève une exception dans ce cas. Vérifié sûr par
  construction : le `try/catch` déjà en place dans `socketCombatResolution.js` autour de la
  résolution d'entrée de timeline (`:337-393`, même bloc que `melee`/`assault`) intercepte déjà toute
  exception, notifie `COMBAT_DECLARE_ERROR` et laisse l'échelle avancer — pas un nouveau risque de
  plantage, juste un cas hérité gratuitement du patron existant.
- **Aucun malus/bonus de combat lié à `state_position='prone'` n'existe aujourd'hui** (vérifié par
  grep exhaustif sur `socketCombatHelpers.js`, zéro résultat) — pour aucun type de personnage,
  humain compris. Seul le coût d'Initiative de la transition existe. Ça relativise (sans l'invalider)
  l'idée que "l'ordre d'Initiative compte tactiquement" pour ce Test — l'argument retenu pour en
  faire une entrée d'échelle plutôt qu'une action simple (§9.3) reste valable indépendamment
  (Test probabiliste + jet visible en chat = même famille que `melee`/`assault` par construction,
  pas besoin de l'argument tactique en plus). Dette générale préexistante, hors périmètre de ce lot.

### 9.3 Fichiers touchés (plan, pas encore codé)

- **Migration** (prochain numéro séquentiel disponible — à reconfirmer contre `knex_migrations` au
  moment de coder, dernier numéro observé aujourd'hui : `247`) — étendre `chk_action_type`
  (`combat_actions`, actuellement `'assault','move_short','move_long','micro','skip','reload','melee'`,
  dernière touche migration `63_melee.js`) avec une nouvelle valeur `'exo_stand_up'`. Aucune nouvelle
  colonne : `modifiers jsonb` (déjà nullable, déjà utilisée pour du payload libre par tous les autres
  types) porte `{ targetPosition }` — le patron déjà en place pour `move_short`
  (`ini_mod`)/`assault`/`melee` (`ref_range`, `dual_wield`...), pas une exception.
- **`server/src/socket/socketCombatAnnouncement.js`** :
  - Détection de la tentative (§9.2) au même point que la boucle `STATE_COSTS.position` actuelle
    (`:381-390`) — garder le calcul d'`iniDelta` inchangé, mais **court-circuiter l'écriture
    immédiate `state_position: resolvedPosition`** (`:596`) pour ce cas précis : le champ persisté
    reste `'prone'`, la position visée voyage dans la nouvelle ligne `combat_actions` (`modifiers.targetPosition`)
    en attendant la Résolution.
  - Nouvelle entrée `actionRows` (miroir du patron `melee`/`assault` déjà en place, `:520-539` —
    `type: 'exo_stand_up'`, `sequence: 3` comme les autres actions complexes).
  - **Trouvaille critique en vérification finale (2026-08-19), après un premier jet fonctionnel en
    apparence (`node --check` + imports propres) mais jamais exercé de bout en bout :** deux listes
    blanches codées en dur, jamais mises à jour pour ce nouveau type, auraient rendu l'action
    silencieusement inerte malgré une ligne `combat_actions` correctement posée :
    1. `buildTimelineEntries` (`socketCombatHelpers.js`) filtrait `type !== 'melee' && type !== 'assault'`
       — sans `'exo_stand_up'` ajouté à cette condition, l'action ne recevait **jamais** d'entrée
       `combat_timeline_entries`, donc n'était jamais atteinte par `step.kind === 'entry'`.
    2. `socketCombatResolution.js` (bloc "actions simples") filtrait `whereNotIn('type', ['melee', 'assault'])`
       — sans `'exo_stand_up'` exclu ici aussi, l'action tombait dans le lot des "actions simples"
       (aucune branche ne la traite, seulement `move_short`/`move_long`/`reload`) et se retrouvait
       marquée `resolved` **sans jamais appeler `resolveExoStandUpAction`** — le pire des deux
       silences (pas d'erreur, pas de crash, juste rien).
    Corrigées toutes les deux, re-vérifiées (`node --check` + import runtime). Trouvé en retraçant le
    cycle de vie complet de l'action plutôt qu'en faisant confiance à la seule absence d'erreur de
    syntaxe — leçon retenue pour les futurs types d'action (Lots 4/5).
  - Garde d'exclusivité (§9.2) : nouvelle fonction dans `shared/combatExclusiveActions.js` (fichier
    déjà responsable de ce concept, `isAimEligible`/`isExclusiveDeclaration`) plutôt qu'un `if` ad hoc
    local — cohérent avec Règle 2 documentaire (un seul endroit pour "qu'est-ce qui est exclusif").
- **`server/src/socket/socketCombatResolution.js`** — nouvelle branche `else if (action.type ===
  'exo_stand_up')` dans le dispatcher d'entrée de timeline (`:337-393`, même niveau que
  `action.type === 'melee'`), appelant une nouvelle fonction serveur.
- **`server/src/socket/socketCombatHelpers.js`** — `resolveExoStandUpAction(io, campaignId, action,
  character, pendingMaps)`, dans ce fichier plutôt qu'un nouveau (pas juste par défaut : réutilise
  directement `resolveCriticalFailReroll`, fonction interne non exportée de ce fichier, §9.2 —
  la déplacer coûterait un export sans bénéfice). Suit le mécanisme corrigé §9.2 : résout
  `{ pilot, exoSheet, template }` via **`resolveExoContext`** (nouveau, voir ci-dessous — un seul
  fetch, pas deux), calcule `exoStats`/`maneuverSkillId` localement, appelle
  `resolveHumanoidTestContext(db, pilot, maneuverSkillId, { forNAOverride: exoStats.exf })`
  directement (déjà exportée) plutôt que de repasser par `resolveCombatantTestContext`/
  `resolveExoTestContext` — ces deux-là referaient le même fetch pilote/template une seconde fois.
- **`server/src/lib/combatantContextService.js`** — **analyse à charge, optimisation retenue (pas
  juste une note) :** au lieu d'exporter seulement `resolveManeuverSkillId` et d'accepter un fetch
  dupliqué comme "coût mineur déjà toléré ailleurs", extraire le fetch commun de
  `resolveExoTestContext` (actuellement inline, `resolvePilot` + lookup `ref_exo_templates`) en une
  nouvelle fonction exportée **`resolveExoContext(db, exoCharacter)`** → `{ pilot, exoSheet,
  template }` (un seul aller-retour DB). `resolveExoTestContext` devient un consommateur de cette
  fonction au lieu de dupliquer sa propre version — améliore le fichier existant au passage, pas
  seulement le nouveau site. Réutilisable tel quel par les Lots 4/5 (Intégrité, Avaries), qui auront
  le même besoin `{ pilot, exoSheet, template }`. Exporter aussi `resolveManeuverSkillId` (§9.2,
  inchangé).
- **Client** — `CombatExoActionWindow.jsx`/`useExoDeclare.js` (§8.5) : bouton "Tenter de se relever"
  visible uniquement si `entry.state_position === 'prone'`, désactive toute autre déclaration ce Tour
  (miroir client de la garde serveur §9.2, jamais la seule protection — `core.md`), affichage du
  résultat du Test (réussite/échec) au retour de Résolution.

### 9.4 Hors périmètre explicite de ce lot

- Intégrité/Avaries/hardpoints (Lots 4-5) — le bouton "se relever" n'a besoin d'aucun d'eux.
- La détection réelle de "à terre" (comment un exo se retrouve `state_position='prone'` en premier
  lieu — déjà un mécanisme générique existant, pas propre à ce lot, aucun changement nécessaire).
- Toute UI au-delà du strict bouton + résultat (§8.4 : pilote/Intégrité viendront aux lots suivants,
  sur le même squelette).

### 9.5 Validation prévue

- `node --check` sur tous les fichiers serveur touchés.
- Test migration (up/down/re-up, CHECK constraint) — même patron que `233_exo_sheet.test.mjs`.
- **`resolveExoContext`** (nouveau, `combatantContextService.test.mjs`) : un seul appel DB par
  invocation (vérifiable par équivalence avec l'ancien comportement inline de
  `resolveExoTestContext`, même patron que les tests existants "dispatch pj/pnj inchangé" §7.7) ;
  `resolveExoTestContext` continue de passer tous ses tests existants après le refactor (non-
  régression, pas seulement le nouveau code).
- Test ciblé sur `resolveExoStandUpAction` : seuil correct par catégorie (les 7 valeurs
  `EXO_PRONE_RECOVERY_TABLE`), succès → écriture `state_position`, échec → `state_position` inchangé,
  bonus de Réussite critique appliqué (mastery), reroll d'Échec critique déclenché, `maybeTriggerCatastrophe`
  appelé quand `catastropheRisk` est vrai, `environment='industrial'` remonte une erreur propre (pas
  un crash, §9.2) — contre PostgreSQL réel (accessible dans cet environnement, vérifié §7.7).
- Garde d'exclusivité (`shared/combatExclusiveActions.js`) : test unitaire pur, sans DB — rejet si
  combinée à une attaque/un déplacement, acceptée seule (§9.2, exclusivité tranchée).
- Scénario réel navigateur (Saar) : aucune exo-armure en base à ce jour — **bloquant pour la
  validation finale**, comme le reste du chantier depuis le Lot 1. Codable et testable en isolation
  (migration + tests Node) sans attendre ce prérequis, mais pas confirmable en jeu avant.

---

## 10. Lot 3 — Initiative (plan détaillé 2026-08-19, ✅ codé 2026-08-19)

> **Clôture (2026-08-19)** : codé selon ce plan, avec un affinement mineur en cours de route
> (§10.3 — `is_pnj` réutilise directement `pilot.type` déjà résolu, pas un second appel
> `resolveCombatantIdentity`). `node --check` + chargement runtime propres, 33/33
> `combatantContextService.test.mjs` toujours verts (non-régression des fonctions réutilisées).
> **Non testé** : scénario réel en jeu (aucune exo-armure en base à ce jour).

### 10.1 RAW

`REGLEARMURE.md:136-158`, deux règles distinctes (pas une seule) :

> **Malus d'Initiative** — chaque armure possède un malus d'Initiative, qui agit au début du Tour de
> combat sur le niveau d'Initiative du personnage [...] lorsque l'armure est utilisée dans un milieu
> différent du milieu pour lequel elle a été conçue [...] le malus d'Initiative est doublé.
>
> **Initiative (optionnel)** — comparez les niveaux de Réaction et de Manœuvre d'armure du
> personnage, et prenez le plus bas niveau des deux. D'autre part, les armures mécanisées imposent
> également un malus d'Initiative au personnage. Si jamais l'Initiative d'un personnage est réduite à
> 0 ou moins, son action est reportée au prochain Tour de combat (le personnage agit alors en premier).

**Décision Saar (2026-08-19)** : le seuil différé (Initiative ≤ 0 → report au Tour suivant) **n'est
pas géré, volontairement** — aucun mécanisme "Initiative ≤ 0" à construire. Une Initiative basse ou
négative reste une valeur normale, triée naturellement en dernier par le tri existant
(`rosterData.sort((a,b) => b.base_ini - a.base_ini ...)`, `socketCombatState.js`) — aucun code
spécifique requis pour cette conséquence, elle découle déjà du tri actuel.

**Décision par symétrie (raisonnement, à confirmer par Saar en testant)** : "niveau de Manœuvre
d'armure" = `calcSkillTotal` seul (attributs + maîtrise + génotype/mutations), **sans**
`effectiveMalus` (blessures/encombrement/fatigue) — même nature que "niveau de Réaction" (`base_ini`
= `calcREA(ADA,PER)`, déjà calculé sans aucun malus de Test). Les deux membres de la comparaison RAW
doivent être sur la même base (un niveau "brut", pas un Seuil de Test complet) pour que la
comparaison ait un sens.

### 10.2 Mécanisme retenu

**Point d'ancrage** : `socketCombatState.js`, handler `COMBAT_START` — `base_ini` y est déjà calculé
une fois par token, avec un précédent direct : `character?.type === 'drone'` court-circuite déjà tout
le calcul humanoïde (Initiative fixe 12, RAW p.320, commentaire "PD1 — fetcher character en premier
pour détecter le type avant d'accéder à char_sheet"). Un `else if (character?.type === 'exo')`
symétrique, avant le fetch `char_sheet` (l'exo n'en a pas) :
1. `resolveExoContext(db, exoCharacter)` → `{ pilot, exoSheet, template }` (déjà exporté, Lot 2bis).
   Pas de pilote/template assigné → `base_ini = 0` (repli neutre, cohérent avec le comportement
   gracieux déjà en place pour un `char_sheet` introuvable juste au-dessus, ligne `74-75`).
2. Réaction du pilote : même calcul que la branche humanoïde (`calcREA(ada_na, per_na, mod_advantage)`)
   mais sur les attributs/avantages du **pilote**, pas de l'exo.
3. Manœuvre d'armure du pilote : `resolveManeuverSkillId(template)` (déjà exportée, Lot 2bis) →
   `calcSkillTotal(attrs, charSkill, refSkill, geno, mutationEffects)` sur le pilote, même spécialité
   que celle utilisée pour `meleeSkillCap`/le Test de se relever — une seule autorité pour "quelle
   spécialité de Manœuvre d'armure s'applique", pas une resélection locale.
4. `base_ini = min(REA_pilote, skillTotal_ManoeuvreArmure) − malus_init`.

**Malus d'Initiative — quelle colonne, doublement hors-milieu** : `ref_exo_templates` porte déjà
`malus_init_surface`/`malus_init_underwater` (Lot 1, jamais consommées). Même limitation EAU1 déjà
acceptée pour `resolveManeuverSkillId`/`getExoMovementBudget` (aucun signal d'immersion temps réel) :
- Templates `submarine` : `malus_init_underwater` **doublé** — hypothèse par défaut (aucun signal
  temps réel ne peut confirmer que le pilote est réellement sous l'eau ; sans template sous-marin
  connu utilisé hors de l'eau à ce jour, ce cas reste théorique) : à réévaluer si un signal
  d'immersion existe un jour, un seul point de bascule ici. **Sauf** si `underwater_movement_mode`
  vaut `'blocked'` (jamais aujourd'hui pour `submarine`, garde théorique cohérente avec le reste).
- Templates `surface`/`atmospheric`/`spatial`/`hybrid` : `malus_init_surface`, **jamais doublé** (même
  répli "surface par défaut" que `resolveManeuverSkillId`/`getExoMovementBudget` — cohérent avec leur
  milieu prévu, pas hors-milieu par hypothèse).
- Template `industrial` : rejeté explicitement (même garde que `resolveManeuverSkillId`, décision
  Saar 2026-08-15 en suspens) — pas de repli silencieux sur un malus arbitraire.

### 10.3 Trouvaille — `is_pnj`/routage Surprise, même famille de bug que Lots 2/2bis

En lisant `COMBAT_START` pour brancher l'Initiative, trouvé **avant tout code** (pas après, cette
fois) : `is_pnj = character?.type === 'pnj'` (ligne ~92) lit le type brut de l'exo — jamais `'pnj'` —
et détermine à la fois (a) si la Surprise s'auto-résout côté serveur ou attend un jet manuel du
joueur, et (b) le `state_weapon` initial (`'drawn'` PNJ vs `'holstered'` PJ). Une exo pilotée par un
PNJ serait donc traitée comme un PJ pour la Surprise — **troisième occurrence du même bug de
routage** que la confirmation de défense (Lot 2, §7.7) et la permission de déclaration (Lot 2bis,
§9.3) : le type/propriétaire brut de la fiche exo utilisé au lieu du pilote effectif.

**Aggravé par un second bug déjà présent, même famille** : le prompt `COMBAT_SURPRISE_ROLL`
(`socketCombatState.js:~302`) cible `character?.user_id` (propriétaire brut) — jamais le pilote — pour
trouver le socket à qui l'envoyer. Une exo surprise et pilotée par un PJ ≠ propriétaire ne recevrait
jamais ce prompt ; une exo pilotée par un PNJ, avec `is_pnj` déjà faux, n'aurait de toute façon jamais
dû recevoir ce prompt (auto-résolution attendue) mais le recevrait quand même, sans personne pour y
répondre.

**✅ Corrigé (2026-08-19)** — deux points, pas un seul mécanisme uniforme (affiné en codant, plus
efficace que la première rédaction) :
- **`is_pnj` dans `COMBAT_START`** — calculé directement depuis `pilot.type` (déjà résolu localement
  par `resolveExoContext` pour l'Initiative, §10.2) plutôt que par un second appel
  `resolveCombatantIdentity` qui referait un fetch déjà en main — un seul aller-retour DB, pas deux.
- **Ciblage `COMBAT_SURPRISE_ROLL`** (fonction différente, `pilot` pas dans son scope) —
  `(await resolveCombatantIdentity(db, character)).userId` au lieu de `character?.user_id`, seul
  endroit où cette fonction était réellement nécessaire.

### 10.4 Fichiers touchés (plan, pas encore codé)

- **`server/src/socket/socketCombatState.js`** :
  - `COMBAT_START` : branche `else if (character?.type === 'exo')` (§10.2), avant le fetch `char_sheet`
    humanoïde — miroir exact du précédent `drone`.
  - `is_pnj` (ligne ~92) : remplacé par `resolveCombatantIdentity` (§10.3) — s'applique à TOUS les
    types, pas seulement exo (comportement humain/pnj/drone strictement inchangé, `effectiveType`
    vaut déjà `character.type` pour eux).
  - Ciblage `COMBAT_SURPRISE_ROLL` (ligne ~302) : `resolveCombatantIdentity` au lieu de
    `character?.user_id` (§10.3).
  - Import `resolveCombatantIdentity`, `resolveExoContext`, `resolveManeuverSkillId` depuis
    `combatantContextService.js` ; `calcSkillTotal` depuis `charStats.js` (à vérifier si déjà importé
    dans ce fichier).

### 10.5 Hors périmètre explicite de ce lot

- Le seuil différé (Initiative ≤ 0 → report au Tour suivant) — décision Saar §10.1, volontairement
  non géré.
- Toute détection réelle d'immersion (EAU1) — dette déjà documentée ailleurs, pas reprise ici.
- Le pipeline de dégâts/Avaries (Lot 4), les Incidents (Lot 5) — aucune dépendance dans ce sens.

### 10.6 Validation prévue

- `node --check` + chargement runtime réel sur `socketCombatState.js`.
- Pas de test DB dédié pour `COMBAT_START` lui-même (même précédent que le reste des handlers socket
  de ce projet, jamais testés par fixture — §9.5) ; la logique réutilisée (`resolveCombatantIdentity`,
  `resolveExoContext`, `resolveManeuverSkillId`) reste couverte par les tests existants
  (`combatantContextService.test.mjs`), non-régression vérifiée en relançant la suite complète après
  modification.
- Scénario réel navigateur (Saar) : aucune exo-armure en base à ce jour — même limite que le reste du
  chantier.

---

## 11. Lot 4 — Pipeline de dégâts (plan détaillé 2026-08-19, ✅ codé 2026-08-19)

> Origine : câblage de la section Avaries de `ExoSheetWindow.jsx` (retour Saar 2026-08-19 : la fenêtre
> a été repensée en onglets larges Fiche/Paramètres, modules empilés en sections repliables — plus un
> onglet par module, voir en-tête du fichier) — le compteur reste vide sans ce lot,
> donc pas un sous-produit du découpage de fenêtre mais un prérequis. Table transcrite depuis une
> capture Saar de la page 326 (compteur d'Avaries), confirmée par Saar (2026-08-19). Analyse à charge
> faite avant tout code (§11.3/§11.6), les 2 décisions RAW tranchées par Saar. Cartographie exhaustive
> des sites de branchement `cibleType` faite avant code (§11.4) — 10 sites au lieu des ~6 estimés,
> chacun personnellement vérifié ligne à ligne (pas seulement délégué). **Clôture** : détail complet
> (fichiers, testé/non testé) dans `docs/JOURNAL8.md`, session 2026-08-19.

### 11.1 RAW

`REGLEARMURE.md:317-407` — seuils de Dommages (5/10/15/20/25/30 → Légère/Moyenne/Grave/Critique/
Catastrophique/Destruction, Blindage retranché avant seuillage), compteur d'Avaries (même principe que
le compteur de Blessures — ligne pleine → case au niveau supérieur, ligne effacée), et perte définitive
d'ITG Structure : *"cette perte intervient bien dès qu'un de ces seuils est atteint, et non à chaque
Avarie reçue dans l'un d'eux (une armure qui subit une première Avarie catastrophique perd
définitivement un point, mais elle n'en perdra pas d'autre si elle subit ensuite une nouvelle Avarie de
même gravité. [...] si elle subit ensuite une Destruction, elle perdra un nouveau point)"*
(`REGLEARMURE.md:344-353`).

### 11.2 Table transcrite (capture Saar, confirmée 2026-08-19)

```js
// shared/exoConstants.js
export const EXO_AVARIE_TABLE = {
  legere:         { threshold: 5,  maxCount: 5, incidentModifier: 0, itgLossStructure: 0 },
  moyenne:        { threshold: 10, maxCount: 5, incidentModifier: 2, itgLossStructure: 0 },
  grave:          { threshold: 15, maxCount: 4, incidentModifier: 4, itgLossStructure: 0 },
  critique:       { threshold: 20, maxCount: 3, incidentModifier: 6, itgLossStructure: 1 },
  catastrophique: { threshold: 25, maxCount: 2, incidentModifier: 8, itgLossStructure: 1 },
  destruction:    { threshold: 30, itgLossStructure: 2 },  // pas de case/compteur — immédiat
}
```

`incidentModifier` n'est pas consommé par ce lot (jet d'incident = Lot 5a) — transcrit ici pour n'avoir
qu'une seule source RAW de cette table, pas dupliquée entre Lot 4 et Lot 5a.

### 11.3 Mécanisme

**`calcExoDegatsNets(exoSheet, template, degautsBruts)`** — nouveau, `server/src/lib/charStats.js`, à
côté de `calcDroneRD`/`calcDroneDegatsNets:66-76` (même fichier tolère déjà les formules de cibles
non-humaines). `bld = computeExoStats(exoSheet, template).bld` (déjà écrit, jamais dupliqué), `rd =
EXO_RD_TABLE[template.category]` (déjà écrit). Formule : `Math.max(0, degautsBruts - bld + rd)` —
**convention d'addition façon humaine** (`damageService.js:404`, RD positif = table affaiblit,
négatif = renforce), **pas la soustraction façon drone** (`charStats.js:75`) : `EXO_RD_TABLE` a été
transcrit directement depuis la même philosophie de signe que la table humaine (commentaire d'origine,
`exoConstants.js:11`), pas construit comme une formule dérivée de l'Intégrité comme celle du drone.

**`severityForExoDamage(net)`** — nouveau, pure, **volontairement pas un partage de
`_severityForDamage`** (`damageService.js:270-278`, privée/non exportée) : les seuils 5/10/15/20/25/30
sont identiques par coïncidence entre deux tables RAW indépendantes (Blessures LdB p.114 vs Avaries
REGLEARMURE p.326) — les coupler créerait une fausse autorité commune, cassante si l'une des deux
tables change un jour sans l'autre. Petite fonction dédiée (6 comparaisons), commentaire explicite sur
la coïncidence pour qu'un futur lecteur ne "corrige" pas la duplication apparente.

**`applyExoAvarie(io, db, campaignId, { characterId, severity })`** — nouveau,
`server/src/lib/exoAvarieService.js` :
1. Transaction DB (comme `woundService.js:20-28` — obligatoire, pas une lecture puis écriture séparées :
   plusieurs coups simultanés sur la même exo au même Tour, rafale ou plusieurs attaquants, sinon
   incrément perdu).
2. Si `severity === 'destruction'` : perte ITG Structure = 2, **inconditionnelle** (pas de compteur
   persistant pour ce palier — aucune colonne `avaries_destruction`), retourne `{ destroyed: true }`.
3. Sinon, cascade récursive sur `avaries_legeres/moyennes/graves/critiques/catastrophiques` :
   incrémente la ligne du `severity` reçu ; si le nouveau total dépasse `maxCount`, remet la ligne à 0
   et se rappelle sur le palier suivant (`legere→moyenne→grave→critique→catastrophique→destruction`
   pour le cas d'overflow depuis catastrophique, cf. §11.6).
4. **Perte ITG Structure sur transition 0→1 uniquement** (pas à chaque coup) — vérifiée à la ligne où
   la cascade *atterrit* réellement, direct ou après promotion : si `avaries_critiques`/
   `avaries_catastrophiques` valait 0 avant cet incrément, applique `itgLossStructure` de ce palier ;
   sinon aucune perte. Corrige une erreur de ma première formulation ("une fois par coup qualifiant"),
   trouvée en analyse à charge — le RAW dit explicitement l'inverse (§11.1).
5. Émet `WS.EXO_AVARIE_UPDATED` (nouveau, `shared/events.js`, même famille que
   `DRONE_INTEGRITY_UPDATED:152`).

### 11.4 Fichiers touchés

> Cartographie exhaustive faite le 2026-08-19 (lecture personnelle intégrale de
> `socketCombatHelpers.js`, `socketCombatResolution.js`, `damageService.js` — chaque site ci-dessous
> vérifié ligne à ligne par moi, pas seulement délégué). Résultat très différent de l'estimation
> initiale ("~6 sites miroir du drone") : **10 sites de code répartis en 2 catégories**, `docs/EN_COURS.md`
> réajusté en conséquence. `socketCombatResolution.js` confirmé **hors périmètre** : aucun dispatcher
> `cibleType`, aucun appel à `resolveTargetHit`, ne fait que déléguer aux handlers de
> `socketCombatHelpers.js` ; ses imports `calcSkillTotal`/`calcDroneDegatsNets` sont morts (aucun autre
> usage dans le fichier).

- `shared/exoConstants.js` — `EXO_AVARIE_TABLE` (§11.2).
- `server/src/lib/charStats.js` — `calcExoDegatsNets` (§11.3).
- `server/src/lib/exoAvarieService.js` (nouveau) — `severityForExoDamage`, `applyExoAvarie` (§11.3).
- `shared/events.js` — `EXO_AVARIE_UPDATED`.

**A. Nouvelles branches `cibleType === 'exo'` (threading déjà correct, ajout seul) :**

1. `damageService.js:310` — `if (cibleType === 'exo') return null`, miroir exact du early-return drone
   déjà présent une ligne au-dessus.
2. `socketCombatHelpers.js:1786` (`resolveDefenselessTarget`) — CaC, cible exo sans défense.
3. `socketCombatHelpers.js:1923-1931` (`resolveMeleeDefensePnj`) — CaC, exo pilotée par PNJ, défense
   active (aucune branche drone n'existe ici, un drone n'atteint jamais cette fonction — nouvelle
   branche pure, pas un miroir).
4. `socketCombatHelpers.js:917-921` (`confirmDamage`) — dégâts différés attaquant PJ, chemin partagé
   CaC + Tir (seul site où `cibleType` arrive déjà intact de bout en bout sans aucune correction, cf.
   catégorie B ci-dessous pour le CaC spécifiquement).
5. `socketCombatHelpers.js:3131-3142` (`resolveAssaultHitPnjNormal`) — Tir immédiat, tireur PNJ ou exo,
   cible exo.
6. `socketCombatHelpers.js:2470-2472` (`resolveDroneAssaultAction`, dispatch cible) — Tir, tireur
   **drone**, cible exo : aujourd'hui absorbée par erreur dans la branche PJ (`resolveDroneAssaultHitPj`,
   `cibleType: null` codé en dur `:2591`, prompt adressé à `cibleCharacter.user_id` au lieu du pilote
   `:2601`). Nouvelle branche `cibleCharacter?.type === 'exo'` **avant** le test `'pnj'`, nouvelle
   fonction sœur `resolveDroneAssaultHitExo` (auto-résolution sans suspend, miroir de
   `resolveDroneAssaultHitDrone:2486-2514`, jamais `resolveDroneAssaultHitPj` qui devient alors
   inatteignable par une exo — pas la peine de réparer son payload cassé).

**B. Corrections de filature préexistantes, nécessaires pour que (A.4) fonctionne réellement en CaC
   quand l'exo est pilotée par un PJ (chaîne de 4 corrections, aucune seule ne suffit) :**

7. `confirmMeleeDefense:578-590` — `cibleType` absent de la déstructuration de `pending` alors qu'il est
   bien stocké en base (`commonPending.cibleType`, posé par `resolveMeleeAction:1711`) → l'ajouter.
8. `confirmMeleeDefense:678-685` — `ctx` reconstruit pour les fonctions-filles post-hit, sans
   `cibleType` non plus (perte indépendante de la précédente) → l'ajouter.
9. `resolveMeleeDefenseHitAttackerPj:722-740` — payload `armAwaitingDamage` sans `cibleType` du tout
   (trouvaille initiale qui a déclenché cette cartographie) → l'ajouter, désormais disponible via `ctx`.
10. `resolveMeleeDefenseHitAttackerPnj:777-783` — `cibleType: 'pj'` **littéral codé en dur**, garde
    `hitResult === null` structurellement morte (commentaire `:758-760` le confirme explicitement) →
    remplacer par le vrai `cibleType` (désormais disponible) et ajouter ici aussi une branche
    `cibleType === 'exo'` réelle (sinon le hit reste silencieusement sans effet, seul le `return`
    changerait de raison).

**Chaque branche exo (catégorie A et le nouveau bloc de la catégorie B point 10) suit le même patron** :
`resolveExoContext(db, { id: characterIdCible })` (vérifié — ne lit que `.id`,
`combatantContextService.js:112-113`, aucun fetch `characters` supplémentaire) → `calcExoDegatsNets` →
`applyExoAvarie`.

**Anomalie trouvée, hors périmètre de ce lot (attaquant, pas défenseur) :** `resolveAssaultAction:2974`
— un tireur exo (`character.type==='exo'`) ne matche jamais `character.type === 'pj'`, donc un pilote PJ
tirant depuis son exo est **toujours** auto-résolu comme un PNJ (aucun prompt `COMBAT_ATTACK_PLAYER_RESULT`/
`CombatDamageWindow`) — asymétrie avec le CaC qui, lui, utilise correctement
`resolveCombatantIdentity`/`defenderEffectiveType` (§3 du present lot). Confirmé par lecture directe,
pas juste une hypothèse. Ne fait pas partie du pipeline de dégâts (Lot 4 = comment l'exo **encaisse**,
pas comment elle **tire**) — signalé ici pour ne pas être reperdu, correction à trancher séparément.

### 11.5 Hors périmètre explicite

- Jet d'incident + localisation (1D10+modificateur, table de localisation) — Lot 5a.
- Effets par localisation (fuite Structure, blocage Exosquelette, coupure Générateur, systèmes/armement
  touchés, dégâts Pilote) — Lot 5b-5f.
- Protocole complet de Destruction (Guillotine/Dernière chance, `REGLEARMURE.md:410-433`) — Lot 6, cf.
  §11.6 pour la limite exacte de ce que Lot 4 fait en attendant.
- Test de Chance pour réduire la sévérité des dégâts — **non codé même côté humain** (confirmé par
  recherche dans `server/src`, aucune fonction `reduceWoundSeverity`/`chance_points`), hors scope ici,
  pas une régression propre à l'exo.
- Localisation D20/visée ciblée sur l'armure ("Viser un endroit particulier") — mécanique de Test
  d'attaque, pas de résolution de dégâts.
- Pression/écrasement en profondeur (Avarie légère automatique, `REGLEARMURE.md:1569-1580`) — Lot 7,
  mécanique de mouvement/temps, pas de combat.

### 11.6 Décisions en attente de Saar avant tout code

1. **Débordement de Catastrophique** (2/2 pleines + nouveau coup) : la cascade §11.3 point 3 atterrit
   sur `destruction`, dont le protocole complet est Lot 6 (pas construit). Proposition : Lot 4
   s'arrête à appliquer la perte ITG (2, inconditionnelle) et retourner `{ destroyed: true }` au
   caller (pattern `drone_sheet.damages.detruit`, `socketCombatHelpers.js:3200`), sans implémenter les
   conséquences narratives (§411-433). **À confirmer.**
2. **Ambiguïté RAW sur Destruction** : le tableau (§11.2) chiffre la perte à 2 points d'ITG Structure ;
   le texte narratif (`REGLEARMURE.md:426`) dit *"vous pouvez considérer qu'après une destruction,
   l'Intégrité de la Structure tombe à 0"*. Lecture proposée : la phrase 426 est une simplification
   optionnelle offerte au MJ ("vous POUVEZ considérer"), pas une règle obligatoire qui remplacerait le
   tableau — donc Lot 4 applique le -2 chiffré par défaut, jamais un snap-à-0. **À confirmer avant de
   coder ce point précis** (les deux lectures sont défendables, je ne tranche pas seul un écart entre
   deux passages du même livre).

**Décision de Saar (2026-08-19) : les deux points ci-dessus confirmés tels que proposés.**

### 11.7 Clôture (2026-08-19)

Codé intégralement selon §11.1-§11.6, cartographie §11.4 vérifiée site par site (pas seulement
déléguée à un agent — chaque citation relue personnellement avant modification).

**Fichiers** :
- `shared/exoConstants.js` — `EXO_AVARIE_TABLE`, `EXO_AVARIE_SEVERITY_ORDER`.
- `shared/events.js` — `EXO_AVARIE_UPDATED`.
- `server/src/lib/charStats.js` — `calcExoDegatsNets` (réutilise `stats.rd` de `computeExoStats`,
  jamais une deuxième lecture de `EXO_RD_TABLE`).
- `server/src/lib/exoAvarieService.js` (nouveau) — `severityForExoDamage`, `applyExoAvarie`
  (transactionnel, `.forUpdate()`), `resolveExoDamage` (orchestrateur partagé par les 6 sites A).
- `server/src/lib/exoAvarieService.test.mjs` (nouveau) — 15 tests (seuils, cascade/promotion,
  transition 0→1 de la perte d'ITG, débordement Catastrophique→Destruction, Destruction directe
  inconditionnelle, plancher ITG à 0, orchestrateur complet avec BLD/RD réels).
- `server/src/lib/damageService.js:310` — early-return `cibleType === 'exo'`, miroir du drone.
- `server/src/socket/socketCombatHelpers.js` — les 10 sites de §11.4 (catégories A et B), plus mise à
  jour du commentaire du stub neutralisant (`resolveMeleeAction:1734-1745`) : **le stub n'est PAS
  retiré** (décision prise en cours de code, pas dans le plan initial) — `char_sheet_id_cible`/
  `for_na_cible`/etc restent neutres pour un défenseur exo, le nouveau pipeline ne les lit jamais
  (passe par `characterIdCible`/`resolveExoContext`), les retirer aurait changé un comportement hors
  périmètre (bonus terrain instable défenseur) sans decision explicite.

**Testé** : `node --check` sur tous les fichiers modifiés, chargement runtime réel (import direct,
détecte les cycles), 15/15 tests `exoAvarieService.test.mjs` + 192/192 tests suite complète
`server/src/lib/*.test.mjs`+`socket/*.test.mjs`+`shared/*.test.mjs` (aucune régression).

**Non testé** : scénario réel navigateur (aucune exo-armure en base, `ref_exo_templates` toujours à
0 ligne — même blocage indépendant du code que le reste du chantier). Les 10 sites de branchement
`cibleType` n'ont donc jamais vu passer un vrai combat exo — seule la logique pure
(`exoAvarieService`) est vérifiée contre PostgreSQL réel.

**Hors périmètre, non touché** : l'anomalie attaquant (`resolveAssaultAction:2974`, exo-tireur jamais
dispatché comme PJ) signalée §11.4, laissée telle quelle par décision explicite.

---

## 12. Catalogue systèmes/armement exo — ébauche (2026-08-19, ⏸️ non validée, pas de code)

> Origine : Saar a extrait `docs/REGLES/SEEDEXO.md` (RAW complet, 1710 lignes) — le catalogue des
> systèmes/armes montables sur une exo-armure (§1) et ~16 armures RAW prémade complètes avec leur
> loadout (§2). Trois questions posées, réponses vérifiées par lecture directe du code (pas de
> supposition) :
> 1. **Rien n'est prévu en BDD pour ces systèmes** — `exo_sheet.hardpoints`/`equipped_systems`/
>    `isolated_systems`/`damaged_systems` (jsonb, migration 233) anticipent la donnée mais aucun
>    catalogue ne les nourrit ; confirme le constat déjà fait §8.4/§11 (Lot 5e non instruit).
> 2. **`ref_equipment` n'est pas seedé avec cet équipement** — vérifié par requête directe (678 lignes,
>    8 familles : Armes/Equipement Général/Logiciels/Munitions/Protections/Vie quotidienne/Équipement
>    informatique/Équipement médical, aucune catégorie exo).
> 3. **`ref_equipment` n'est pas pertinent pour la majorité de ce catalogue** — son schéma
>    (`migrations/48_ref_equipment.js`) porte des champs profondément humains
>    (`location`/`malus_cat` = emplacement de blessure porté, `linked_attr`/`min_str` = attribut humain
>    requis, `shield_*`/`mod_slot` = bouclier/modding humain) et un modèle de possession
>    (`char_inventory`/`char_inventory_slots`, sac à dos personnel d'un personnage) qui ne correspond à
>    rien pour un composant installé sur une exo, jamais porté par un humain.

### 12.1 Proposition retenue (Saar, à affiner)

- **`ref_exo_templates`** (table existante, migration 233+243 — **aucun renommage**, confirmé par
  Saar) reçoit directement les ~16 armures prémade RAW comme nouvelles lignes.
- **`ref_exo_equipment`** (nouvelle table, unique) — regroupe armes et systèmes exo. Taxonomie exacte
  encore à finaliser (§12.1bis/§12.2 — la proposition initiale `family IN ('arme','systeme')` a un cas
  qui ne colle pas au RAW, voir point 6 ci-dessous). **"armure" retiré du périmètre** — pas de 3ᵉ
  famille, aucun composant d'armure vendu séparément identifié dans le texte RAW ; pas de catégorie
  vide construite par anticipation.

### 12.1bis Vérifications faites en analyse à charge (2 passes, 2026-08-19) — rien n'est resté supposé

**Passe 1 — colonnes de `ref_exo_templates` :**
1. **Résistance aux Dommages** : vérifiée manuellement sur les 16 armures contre `EXO_RD_TABLE`
   (`exoConstants.js`) — concordance exacte à chaque fois (RD dépend uniquement de la catégorie, jamais
   une valeur propre à l'armure malgré le texte narratif qui la réaffiche à côté du matériau de coque).
   Confirmé, pas une supposition.
2. **Modificateur de Dommages** : vérifié en recalculant `getModDom(EXF)` pour les 16 armures. Un bug
   réel existait (`Math.floor` au lieu de `Math.ceil`, faux de -1 sur tout écart pair) mais **déjà
   corrigé au Lot 2** (`charStats.js:201-212`, commentaire citant explicitement les mêmes 16 armures via
   `REGLEARMURE.md`, qui contient le même catalogue qu'ici). Mon ébauche affirmait ce point de mémoire
   sans le recalculer au moment de l'écrire — vérifié maintenant, ça tient, mais c'était de la chance
   plus que de la rigueur la première fois.
3. **Malus d'Initiative sous l'eau/à terre** : le texte RAW donne "à terre" = 2× "sous l'eau" pour
   quasiment toutes les armures hybrides/sous-marines (vérifié sur 8 lignes). Risque identifié :
   `socketCombatState.js:108-110` double `malus_init_underwater` automatiquement pour
   `environment==='submarine'`, sans jamais lire `malus_init_surface` dans ce cas — semer cette colonne
   pour une armure sous-marine est donc inoffensif mais inutile. Pour `environment==='hybrid'`, le code
   lit `malus_init_surface` **directement, sans doublement automatique** — le RAW respecte déjà cette
   convention 2× dans ses propres chiffres, donc semer les deux valeurs littéralement reste correct. Le
   risque théorique (double-doublement) ne se matérialise pas, vérifié en lisant le code, pas supposé.

**Passe 2 — colonnes de `ref_exo_equipment` (inventaire systématique des 8 tableaux de prix, grep des
en-têtes, pas de mémoire) :**
4. **Un en-tête de tableau est faux dans le fichier source** : le second tableau "SYSTÈMES FURTIFS"
   (ligne 789) contient en réalité les *Systèmes divers* (Antivol, Autopilote, Câble d'alimentation,
   Revêtement anti-radiations, Volet de sécurité, Système d'alerte) — artefact de transcription du PDF
   source (répétition d'en-tête de page), pas une vraie catégorie furtive. Une catégorisation depuis les
   en-têtes de tableau seuls aurait mal classé ces 6 lignes silencieusement.
5. **Le prix n'est pas un entier plat** — vérifié sur plusieurs lignes réelles : Pince/Griffe =
   `100 x (FOR x FOR)`, Volet de sécurité = `100 x BLD armure`, Amortisseurs de sauts =
   `1000 x cat. de l'exo`, Dispositif d'auto-réparation = `2500 x niv. x NT`. `ref_equipment` a déjà
   résolu exactement ce besoin (`price` integer + `price_modifier` string(50), migration 48) — à
   réutiliser tel quel pour `ref_exo_equipment`, pas réinventer une deuxième solution.
6. **"Systèmes défensifs" appartiennent à Armement, RAW explicite** (SEEDEXO.md:707-709 : *"les
   systèmes défensifs font partie de la catégorie Armement, lorsqu'il s'agit de localiser un incident
   survenu à la suite d'une Avarie"*) et ont une colonne Dom. (2D10+3/3D10+3, mécaniquement des armes de
   contre-attaque). **Corrige la taxonomie §12.1** : `category='defensif'` ne peut pas rester sous
   `family='systeme'`, doit suivre la classification RAW (`family='arme'`) — au moins pour la
   localisation d'incident (Lot 5a), donc autant l'aligner dès le seed plutôt que diverger puis corriger.
7. **Colonne "Capacité"** (durée, ex. "24 h" pour une réserve d'oxygène) présente sur le tableau
   Supports vitaux — absente de l'inventaire de champs communs de la première ébauche.

**Conclusion de ces deux passes** : aucune des deux tables n'est structurellement remise en cause, mais
le détail (taxonomie exacte, forme du champ prix) était moins réglé que la première ébauche ne le
présentait. Une passe systématique ligne-par-ligne sur l'intégralité du catalogue (pas seulement les
en-têtes) reste nécessaire avant tout seed réel — probable qu'elle révèle d'autres cas comme les points
4-7 ci-dessus.

### 12.2 Points ouverts, non tranchés

1. **Formule de dégâts des armes exo** — certaines armes ont une notation à escalade par Tour
   (`3D10 (+3/Tr)`, hydro-foreuse/marteau-piqueur/scie/pince) absente de toute mécanique actuelle
   (le DSL munitions, `shared/weaponAmmoDsl.js`, ne connaît pas ce motif). Stocker le texte tel quel au
   catalogue ne bloque rien immédiatement (données), mais la résolution en combat (Lot 5e ou suivant)
   devra soit l'ignorer (dégât fixe au premier Tour), soit être étendue — décision à prendre au moment
   de câbler la résolution, pas au moment de seeder le catalogue.
2. ~~**Lien template ↔ loadout par défaut**~~ — **✅ tranché par Saar (2026-08-20)** : "armement et
   armes sont des paramètres d'usine. Modifiable mais pré-made (cf. les modèles RAW)" — même
   philosophie que la Base éditable (Lot B, §13.3) : le modèle pré-remplit, l'instance possède et peut
   diverger ensuite. **Conséquence concrète, détaillée §13.4.4** : une table de jonction persistante
   `ref_exo_template_equipment` **est** nécessaire (contrairement à la piste "seed ponctuel sans
   jonction" envisagée ci-dessous le 2026-08-19) — pas pour rester une dépendance live (elle ne l'est
   pas, elle n'est lue qu'au moment de la copie), mais parce qu'il faut bien une source structurée
   *quelque part* pour ce que la copie recopie. L'ambiguïté trouvée ci-dessous (analyseurs sonscan de
   niveau identique) ne bloque pas l'approche — elle se résout par le même échappatoire
   `label_override` déjà retenu pour `exo_systems`/`exo_weapons`/`exo_programs` (§13.4.2/13.4.3),
   pas par une nouvelle mécanique.
   **Analyse d'origine (2026-08-19), conclusion partiellement dépassée par la décision ci-dessus, gardée
   pour la traçabilité de l'ambiguïté relevée** : les 3 analyseurs sonscan du catalogue (Sea-Star/
   Abyss/Delta Azur, ligne 486-488) partagent tous `niveau=12`, ne différant que par cibles/prix — une
   armure dont le loadout dit "Analyseur sonscan niv. 12" ne désigne donc **aucun produit précis** du
   catalogue avec certitude à partir du texte seul. Pas un argument contre la jonction persistante en
   soi, juste la preuve que toutes les lignes ne pourront pas être résolues par FK stricte — certaines
   demanderont un `label_override` ou un choix arbitraire documenté au moment de la transcription.
3. **Pipeline de dégâts d'une exo qui tire** — `resolveExoDamage` (Lot 4) couvre l'exo comme
   **défenseur**. Une exo qui tire une arme de ce catalogue comme **attaquant** ne passe par aucun
   pipeline existant (`getEffectiveWeaponDamage` suppose `char_inventory`) — à construire au moment de
   câbler l'armement, pas avant.
4. **Table des cases module Auto-réparation, malus d'Initiative par interface de contrôle** (§SEEDEXO
   lignes 69-93) — mécaniques secondaires transcrites dans le texte mais pas encore reliées à une
   décision de périmètre (optionnelles comme Armure à terre/Saisie l'ont été §2.2 ?). Pas encore posé
   à Saar.
5. ~~**Taxonomie `category` finale pour `family='systeme'`**~~ — ✅ tranché en codant (§12.4) :
   Stabilisateurs/Amortisseurs de sauts restent sous `Systèmes de contrôle`, classement RAW littéral
   (SEEDEXO.md range ces deux systèmes dans le même tableau que Interface de contrôle/SACEA/Contrôle de
   pression) — pas de sous-catégorie "maniabilité" séparée construite par anticipation, l'ambiguïté
   thématique n'avait pas de conséquence mécanique identifiée qui la justifierait.

### 12.3 Hors périmètre de cette ébauche

Le contenu détaillé du catalogue (transcription ligne à ligne des ~34 systèmes + ~10 armes + ~16
loadouts) — nécessite sa propre session, pas un enchaînement immédiat sur cette ébauche. Le jet
d'incident/Lot 5 (localisation, effets par composant) reste une brique séparée, déjà scindée §3.

### 12.4 Codé et testé (2026-08-19/20) — schéma + seed complets, hors loadout/attaque

Passe systématique faite : les 1709 lignes de `SEEDEXO.md` lues intégralement en une session, pas
seulement les en-têtes de tableau (ce que §12.3 réclamait comme préalable). Trois migrations,
chacune testée up→down→up en CLI et dotée de son fichier `.test.mjs` (patron `schemaAssertions.mjs`
déjà en place pour 233/243) :

- **251 — `ref_exo_equipment`** (schéma) : `family`(CHECK arme/systeme)/`category`/`name`/
  `description`/`price`+`price_modifier`/`tech_level`/`rarity`/`max_level`/`duration`/`damage`/
  `shock`/`range`/`init_mod`(CHECK)/`fire_mode`(CHECK)/`ammo_cost`. Aucune colonne "Cibles" (Analyseurs,
  4 lignes/84, jamais consommées) — texte libre en `description` plutôt qu'une colonne construite par
  anticipation.
- **252 — seed `ref_exo_templates`** : les 16 armures RAW prémade, aucune colonne ajoutée (233+243
  suffisaient). Cross-vérifié par recalcul `computeExoStats` à Intégrité pleine (EXF/Blindage
  recalculés = valeurs de fiche, 16/16) en plus de la relecture ligne à ligne.
- **253 — seed `ref_exo_equipment`** : 84 lignes (arme=17, systeme=67) — plus que l'estimation
  initiale "~34+~10" du §12.3, chaque variante nommée comptant séparément comme le fait le RAW
  lui-même. Taxonomie appliquée telle que verrouillée en §12.1bis/§12.2 : Systèmes défensifs sous
  `family='arme'`, en-tête source faux (SEEDEXO.md:789, "SYSTÈMES FURTIFS" dupliqué) corrigé en
  `Systèmes divers`. Une incohérence source de plus trouvée en transcrivant (pas en relisant les
  en-têtes cette fois, une vraie ligne de donnée) : Générateurs défensifs micro-ondes affiche DIS
  "210 (15)" (SEEDEXO.md:781) — chiffre parasite, corrigé en "10 (15)" (documenté en tête de fichier
  de migration, pas silencieux).

**Descriptions volontairement courtes** (garde-fous mécaniques, pas la prose RAW complète) — rien ne
consomme ce texte aujourd'hui (aucune UI catalogue exo construite), l'enrichir peut attendre une UI
réelle plutôt que de transcrire des paragraphes que personne ne lira d'ici là.

**Toujours hors périmètre, inchangé depuis §12.2/§12.3** : lien template↔loadout (point 2, toujours
pas tranché — penche narratif, pas vérifié sur les 16 loadouts), pipeline exo-attaquant (point 3),
formule de dégâts à escalade (point 1, texte stocké tel quel), mécaniques secondaires
auto-réparation/malus interface (point 4).

**Testé** : `npm test` équivalent (`node --test`) sur toute la suite serveur (348 tests, 55 fichiers,
PostgreSQL réel) après les 3 migrations — 348/348 verts, 0 régression. 7 tests dédiés 251/252 + 2
dédiés 253 (schéma réel, CHECK constraints, up/down transactionnel, données réelles en base).
**Non testé** : navigateur réel — `ref_exo_templates`/`ref_exo_equipment` ne sont interrogés par
aucune UI de sélection de loadout aujourd'hui (`ExoIdentityPanel.jsx` lit déjà `ref_exo_templates`
pour le sélecteur Modèle, ça devient donc testable en navigateur pour la première fois ; le catalogue
`ref_exo_equipment` n'a en revanche aucun consommateur UI, seed pur en attendant Lot 5e).
**Données** : 3 migrations (251/252/253), 100 lignes de données neuves au total (16+84), aucune
table existante modifiée. **Retour arrière** : `down()` testé et propre sur les 3 migrations.

---

## 13. Finition de la fiche exo-armure — avant d'ouvrir le Lot 5 (planifié 2026-08-20)

> Origine : proposition de Saar en reprenant ce chantier — plutôt que d'ouvrir le Lot 5 (Incidents,
> sous-système RAW complet) alors que `ExoSheetWindow.jsx` a encore 3 sections en stub explicite
> (Avaries/Systèmes/Ordinateur), finir la fiche d'abord. Ça débloque enfin un scénario de test
> navigateur complet des Lots 1-4 (bloqué depuis le Lot 1) avant d'empiler un nouveau sous-système
> dessus. Séquencement demandé par Saar : planification large d'abord (cette section), affinage lot
> par lot ensuite — un seul lot détaillé/codé à la fois, comme le reste de ce plan.
>
> Deux sources d'inspiration fournies par Saar pendant cette session, traitées comme référence UI/UX
> et précédent d'implémentation — **jamais comme autorité RAW** (hiérarchie documentaire CLAUDE.md §1,
> Livre de Base > ... > PLAN ; une fiche Roll20 tierce n'a aucune autorité sur le texte source) :
> - `docs/REGLES/FDEA.webp` — capture de la fiche d'armure mécanisée officielle du Livre de Base
>   (mise en page RAW réelle : blocs Attributs/Informations/Dommages/Localisation des
>   incidents/Ordinateur/Systèmes auxiliaires/Armement/Table des marges).
> - Captures d'une fiche Roll20 tierce (feuille de perso Polaris communautaire) — inspiration de
>   structuration de champs uniquement (ex. confirme le champ "Taille"/GAB absent de notre schéma).
>
> **Point signalé, hors périmètre de cette section** : le bloc "Table des marges de réussite et
> d'échec" (bas de `FDEA.webp`) a été proposé comme piste pour débloquer `PLAN_TEST_CRITIQUE.md` §2.3
> (seuil de Catastrophe, en stand-by) — **corrigé par Saar** : MR (Marge de Réussite) est déjà
> implémentée pour les humanoïdes, la Catastrophe déjà codée, la table déjà présente dans
> `shared/polarisUtils.js`. Sujet déjà traité ailleurs par Saar avec un autre agent, pas repris ici.

### 13.1 Découpage retenu

- **Lot A — Onglet Avaries** : câblage UI pur. Les données existent déjà (Lot 4,
  `exoAvarieService.js`, §11) — aucune décision de fond, prêt à détailler/coder immédiatement.
  Détail §13.2.
- **Lot B — Base éditable (refactor)** : correction d'architecture demandée par Saar en vérifiant la
  fiche RAW — aujourd'hui `computeExoStats(exoSheet, template)` et les fonctions qui en dépendent
  (`resolveExoContext`, `calcExoDegatsNets`, `resolveManeuverSkillId`, `getExoMovementBudget`,
  l'Initiative `COMBAT_START`) vont chercher RD/Blindage/EXF-de-base/Vitesse/Malus d'initiative **en
  direct dans `ref_exo_templates`** à chaque lecture — l'instance n'a aucune colonne à elle pour ces
  valeurs. Deux autorités possibles pour la même propriété (le template si présent, rien sinon) viole
  Priorité #4 du CLAUDE.md. Décision Saar (2026-08-20) : à la création depuis un modèle, **copier**
  les valeurs de base sur `exo_sheet` (nouvelles colonnes éditables) — `template_id` devient une
  référence "pré-rempli depuis", plus jamais une dépendance live. Toute valeur de la fiche doit rester
  modifiable par GM/propriétaire/pilote après coup, y compris les deux bornes d'une paire max/courant
  (déjà le cas pour l'Intégrité, §6.1 point 4 — principe étendu à tout le reste). Ne remet pas en
  cause §1.7 (stats *effectives*, dégradées par l'Intégrité, toujours recalculées à la volée — couche
  différente, base éditable vs dérivé recalculé). Champ **Taille** (GAB) à ajouter au passage — confirmé
  par Saar, non prioritaire, peut attendre une migration ultérieure si besoin. Pas encore détaillé lot
  par lot (liste exacte des colonnes à copier, fichiers/fonctions à rebrancher).
- **Lot C — Systèmes / Armement / Ordinateur** : les 4 colonnes jsonb de `exo_sheet`
  (`equipped_systems`/`hardpoints`/`isolated_systems`/`damaged_systems`, migration 233, posées "par
  anticipation" au Lot 1, jamais exploitées) ne portent pas nativement une Intégrité par ligne — or la
  fiche RAW (`FDEA.webp`) montre un ITG par ligne de Systèmes auxiliaires ET d'Armement. **Précédent
  trouvé et retenu** (lecture de `71_drone_sheet.js` + `73_drone_programs_catalog.js`, archivée mais
  son contenu vit dans `48b_ref_equipment_data.js`, + routes `char-sheet.js:1646-1912`) : le drone a
  déjà résolu exactement ce problème.
  - `drone_sheet.ordinateur_gen`/`ordinateur_nt` — 2 colonnes seulement, tout le reste (Niveau max des
    programmes, Gestion systèmes, Potentiel, Coût, Intégrité, Disponibilité) se dérive des formules
    `docs/REGLES/REGLE_ORDINATEUR.md` (p.280-281, fournies par Saar 2026-08-20), jamais stocké — même
    principe que `computeExoStats`.
  - `drone_programs` — table réelle (pas jsonb) : `equipment_id` FK `ref_equipment` (catalogue
    `family='Logiciels'`, déjà seedé, catalogue RAW p.281-282) + `label_override` (programme custom) +
    `level`. C'est le bloc "Programmes" de la fiche Ordinateur, réutilisable tel quel — même catalogue,
    aucune nouvelle donnée nécessaire pour un premier jet.
  - `drone_weapons` — même patron, avec en plus les champs propres à l'instance (`contenance_chargeur`,
    `ammo_restant`, et pour une arme hors catalogue : `name`/`damage_formula`/`portee`/`fire_mode`/`notes`).
    Précédent direct pour Armement.
  - Retenu pour l'exo : `exo_systems` et `exo_weapons` (mirror `drone_weapons` — catalogue
    `ref_exo_equipment` `family='systeme'`/`'arme'` + ITG max/courant par ligne + option custom),
    `exo_programs` (mirror exact `drone_programs`, réutilise le catalogue `ref_equipment
    family='Logiciels'` existant), `exo_sheet.ordinateur_gen`/`ordinateur_nt` (mirror `drone_sheet`).
    Une migration retire les 4 colonnes jsonb devenues mortes. Répond à §12.2 point 2 mieux que la
    piste "copie jsonb à la création" envisagée là-bas — plus cohérent avec ce qui tourne déjà pour le
    drone, et donne gratuitement une Intégrité par système/arme nécessaire de toute façon aux futurs
    Lots 5c/5d/5e (incidents visant un système précis). Pas encore détaillé (schéma exact des 3
    tables, routes, UI).
- **Lot D — Modèles perso dans le Vault** (différé, dette documentée, pas un lot à détailler
  maintenant) : Saar veut que GM/joueur puissent créer leur propre modèle d'exo-armure dans leur Vault
  respectif, la liste RAW n'étant pas exhaustive. Vérifié dans le code (2026-08-20) : le Vault
  (`vaults`/`vaultService.js`, migration 129) ne stocke aujourd'hui que des `characters` — aucun
  mécanisme de catalogue personnel n'existe nulle part dans le projet, pour aucun domaine. Pas urgent :
  une fois le Lot B fait, un GM/joueur peut déjà construire l'équivalent d'un modèle perso en partant
  d'un template existant (ou d'aucun) et en éditant tous les champs à la main — seule manque la
  **réutilisabilité** (sauvegarder ce jeu de valeurs pour créer plusieurs exo-armures identiques sans
  tout retaper). Besoin de confort réel, pas un blocage technique — à ouvrir en session dédiée
  (nouvelle colonne `owner_user_id`/`vault_id` nullable sur `ref_exo_templates`, filtrage à
  l'affichage, probablement) quand Saar voudra vraiment le trancher.

### 13.2 Lot A — Onglet Avaries — ✅ codé (2026-08-20)

**Clôture** : codé intégralement selon le détail ci-dessous, y compris les correctifs trouvés en
codant (émission WS conditionnée à un changement réel, `COLUMN_BY_SEVERITY` déplacé vers
`shared/exoConstants.js` pour être réutilisable côté client) et une trouvaille séparée corrigée dans
la foulée (`canEdit` de `ExoSheetWindow.jsx` ne testait jamais si l'utilisateur est le pilote lié —
pré-existante, affecte aussi Identité/Intégrité, corrigée après confirmation explicite de Saar).

**Testé** : `node --check`/lint sur tous les fichiers touchés (une vraie erreur de syntaxe trouvée et
corrigée en cours de route — parenthèse manquante). 54/54 tests serveur contre PostgreSQL réel
(`exoAvarieService.test.mjs` 21/21 dont 6 nouveaux pour `removeExoAvarie`, `combatantContextService.test.mjs`
non-régression) + 204/204 sur l'ensemble `server/src/lib`/`server/src/socket`/migrations exo. Build
client complet réussi.

**Non testé** : scénario réel navigateur (poser/retirer des Avaries à la main, déclencher une Avarie
réelle en combat et vérifier le rafraîchissement live, confirmer qu'un pilote non-propriétaire voit
maintenant les contrôles actifs) — à la charge de Saar.

**Données** : aucune migration (les colonnes `avaries_*` existent depuis le Lot 4).

**Retour arrière** : pas de migration à annuler — un revert des fichiers listés ci-dessous suffit.

**Fichiers touchés** : `shared/exoConstants.js` (`EXO_AVARIE_COLUMN_BY_SEVERITY` exportée),
`server/src/lib/exoAvarieService.js` (`removeExoAvarie`), `server/src/lib/exoAvarieService.test.mjs`
(6 tests), `server/src/routes/character/char-sheet.js` (2 routes), `client/src/character/ExoAvariesPanel.jsx`
(nouveau), `client/src/character/ExoSheetWindow.jsx` (câblage + correctif `canEdit`/pilote),
`client/src/pages/SessionPage.jsx` (prop `socket`), `client/src/locales/fr.json` (clés `exo.avarie*`).

---

### 13.2 Lot A — Onglet Avaries — détaillé, révisé après analyse à charge (2026-08-20)

**Existant vérifié** :
- `exo_sheet.avaries_legeres/moyennes/graves/critiques/catastrophiques` (migration 233) — déjà tenues
  à jour par `applyExoAvarie` (`exoAvarieService.js`, Lot 4) à chaque dégât encaissé en combat.
- `ExoSheetWindow.jsx:317-323` — la boucle `['avaries', 'systems', 'computer'].map(...)` rend le même
  stub "à venir" pour les 3 sections. Lot A retire `'avaries'` de cette liste.
- **Gap trouvé en vérifiant `DroneWindow.jsx` (précédent direct)** : `DroneWindow.jsx:126-136` écoute
  `WS.DRONE_INTEGRITY_UPDATED` pour rafraîchir l'affichage pendant un combat en cours (le composant
  reçoit `socket` en prop, `SessionPage.jsx`). `ExoSheetWindow.jsx` n'écoute aujourd'hui aucun
  événement WS et ne reçoit même pas `socket` en prop — sans correctif, l'onglet Avaries resterait figé
  pendant qu'un combat modifie les compteurs en direct. Inclus dans ce lot.

**Rejeté après analyse à charge — champ numérique + PATCH brut (`PUT .../exo/integrity` étendu).**
Deux défauts trouvés en creusant :
1. **Mauvais précédent copié.** J'avais mirroré `ExoIntegrityPanel.jsx` (paire max/courant, simple)
   alors que les Avaries sont structurellement un système à seuils/cascade, comme les Blessures
   humaines — pas une paire de nombres. Le vrai précédent est `LocationPanel.jsx:131-145` : une
   Blessure ne s'ajoute **jamais** par PATCH de compteur — un clic sur une case vide appelle `POST
   /wounds` (le vrai service, cascade de promotion incluse), jamais un champ à valeur libre.
2. **Violation d'autorité unique.** Un PATCH brut sur `avaries_*` contournerait `applyExoAvarie` et sa
   perte d'ITG liée à la transition 0→1 (§11.1) — un MJ posant `avaries_critiques: 1` à la main
   n'aurait aucune déduction d'ITG, un état que le combat réel ne produit jamais. Contraire à la
   Priorité #4 CLAUDE.md et à la demande explicite de Saar de traiter la qualité structurelle avant la
   rapidité.

**Conception retenue — grille de cases à cocher, mirror `LocationPanel.jsx` :**

- **Case vide → clic → pose une Avarie.** Nouvelle route `POST /:characterId/exo/avaries/:severity`
  (permission `exoIsGmOrOwnerOrPilot`, patron `req.character.campaign_id` + `req.app.get('io')` déjà
  établi ligne 861-914 de ce fichier pour `applyWound`/`restFatigue`) — appelle **directement**
  `applyExoAvarie(io, db, req.character.campaign_id, { characterId, severity })`, la même fonction que
  le combat, jamais une copie. Route traduit un retour `null` (exo_sheet introuvable) en 404 propre,
  plutôt que de laisser fuiter un objet vide.
  **Changement de frontière de confiance trouvé en analyse à charge** : jusqu'ici `severity` n'était
  jamais fourni par un client — toujours calculé côté serveur par `severityForExoDamage()`. Cette
  route l'expose pour la première fois dans un corps de requête. Ni `applyExoAvarie` ni
  `resolveAvarieIncrement` ne valident que `severity` est une clé connue — une valeur invalide ferait
  planter `EXO_AVARIE_TABLE[severity].maxCount` (`TypeError`) au milieu d'une transaction plutôt qu'un
  400 propre. La route valide donc `severity` contre `EXO_AVARIE_SEVERITY_ORDER` (hors `'destruction'`,
  rejeté explicitement) **avant** d'appeler le service — `core.md` : "Le serveur valide... les données
  avant toute mutation."
- **Case pleine → clic → retire une Avarie.** Nouvelle fonction sœur **`removeExoAvarie(io, db,
  campaignId, { characterId, severity })`** dans `exoAvarieService.js` (même transaction/`.forUpdate()`
  que `applyExoAvarie`) : décrémente la colonne du palier, plancher à 0, émet `EXO_AVARIE_UPDATED`
  **seulement si le compteur a réellement changé** (trouvé en codant, 2026-08-20 — un compteur déjà à
  0 est un succès silencieux, pas une diffusion à toute la campagne pour rien).
  **Explicitement pas symétrique en effet** : ne restaure jamais l'ITG perdue ni ne redéfait une
  cascade passée — outil d'arbitrage MJ, pas la Réparation RAW (Lot séparé, gated par un Test de
  Mécanique, RAW p.327). Route miroir `DELETE /:characterId/exo/avaries/:severity`.
  `severity === 'destruction'` rejeté par les deux routes (RAW : "pas de case" pour ce palier, §11.2)
  — la ligne Destruction de l'UI n'a donc aucune case cliquable, juste le libellé + `itgLossStructure`
  en lecture seule.
  **Permission — tranchée par Saar (2026-08-20), analyse à charge faite : GM-only, pas
  `exoIsGmOrOwnerOrPilot`.** Vérifié contre les deux précédents réels du fichier, pas juste supposé :
  `DELETE /:characterId/wounds/:wid` ("Guérison") est Owner/GM — mais plusieurs routes de ce même
  fichier sont déjà GM-only pour des actions d'arbitrage sans contrepartie RAW mécanisée (`PUT .../xp`,
  `POST/DELETE .../advantages`, `DELETE .../mutations/:id`). Retirer une Avarie sans Test n'a aucun
  équivalent légitime côté joueur (contrairement à la Guérison, qui a un sens narratif de self-service)
  — appartient à la famille GM-only, pas à la famille self-service de la Guérison. Écart avec le
  précédent Guérison noté ici mais **pas rouvert** : système différent, déjà en production, hors
  périmètre de ce Lot. Garde `if (!req.isGm) throw new AppError(403, ...)` (patron déjà utilisé sur
  `xp`/`advantages`/`mutations`), distincte de `exoIsGmOrOwnerOrPilot` qui reste sur la pose. Ce
  cloisonnement referme aussi la question "le retrait est-il seulement nécessaire ?" (ci-dessus) :
  l'abus potentiel (pilote non-propriétaire effaçant ses propres dégâts) qui motivait l'hésitation
  disparaît structurellement une fois l'action GM-only — retrait conservé dans ce Lot A.
- **UX** : aucune confirmation avant clic, cohérent avec le précédent Blessures (`LocationPanel.jsx`
  n'en demande pas non plus, vérifié — aucun `window.confirm` dans ce fichier, y compris pour la
  Blessure la plus grave). Tooltip sur les cases pleines rappelant que le retrait ne restaure pas
  l'ITG (évite qu'un MJ s'attende à tort à une symétrie).
- **Anti-double-appel — granularité ligne, pas case** (précisé, 2ᵉ tour d'analyse à charge 2026-08-20) :
  toutes les cases vides d'une même ligne déclenchent la **même** action ("poser une Avarie de cette
  sévérité", aucune identité par case, §13.2) — désactiver seulement la case cliquée pendant la requête
  en vol permettrait de cliquer deux cases vides différentes de la même ligne et de poser deux Avaries
  au lieu d'une (jamais de corruption serveur, juste un résultat surprenant). Corrigé : la **ligne
  entière** se désactive pendant sa requête en cours, pas la case. L'état local se met à jour
  **uniquement** depuis la réponse HTTP ou depuis l'événement WS reçu — jamais par un
  incrément/décrément optimiste côté client — idempotent si les deux arrivent (l'auteur du clic est
  aussi dans la `campaignId` room et reçoit son propre broadcast).
- **Forme de la réponse HTTP — fixée** (précisé, 2ᵉ tour) : les deux routes répondent `{ exo }` (l'objet
  `exo_sheet` mis à jour), pas le retour brut du service (`{ exoSheet, finalSeverity, destroyed,
  itgLoss }`) — cohérence avec `PUT .../exo/integrity` et le reste des routes exo, un seul contrat de
  réponse pour toute cette famille de routes.
- **Bénéfice de construction** : élimine par nature le souci de validation de borne (plus de champ
  brut à valider — chaque clic est une opération bornée).
- **Angle mort vérifié et accepté, pas un oubli (analyse à charge 2026-08-20)** : `applyExoAvarie`/
  `removeExoAvarie` diffusent via `io.to(campaignId).emit(...)` — le plan prenait `req.character.campaign_id`
  sans garde. Or **une exo-armure peut vivre dans le Vault d'un joueur, hors campagne**
  (`vault.js:24`, `VAULT_CREATABLE_TYPES` inclut `'exo'` ; `characters.campaign_id` nullable depuis la
  migration 129, Vault). `ExoSheetWindow.jsx` n'est aujourd'hui monté que par `SessionPage.jsx`
  (vérifié — inatteignable par l'UI actuelle pour un personnage Vault), mais les routes `char-sheet.js`
  ne sont pas cantonnées à un contexte de campagne — un appel direct à l'API sur une exo-armure de
  Vault passerait `campaignId = null`. `io.to(null).emit(...)` ne plante pas (room bidon, silencieux) —
  la réponse HTTP reste correcte, l'auteur de l'action voit son propre état se mettre à jour (porté par
  la réponse HTTP, pas seulement le WS) ; seule la diffusion aux autres clients d'une room inexistante
  est un no-op, sans conséquence observable (une exo de Vault n'a par nature aucun public de campagne
  à qui diffuser). **Comportement dégradé accepté, documenté ici pour qu'un futur lecteur ne le lise
  pas comme un bug non traité** — même garde-fou déjà en place ailleurs dans ce fichier pour le même
  cas (`char-sheet.js:1089`, `campaignId || null`, autre fonctionnalité), pas une réinvention.

**Fichiers à toucher :**
1. `server/src/lib/exoAvarieService.js` — nouvelle fonction `removeExoAvarie` (miroir structurel
   d'`applyExoAvarie`, sans cascade ni perte d'ITG).
2. `server/src/routes/character/char-sheet.js` — `POST`/`DELETE /:characterId/exo/avaries/:severity`
   (nouvelles routes, patron `req.character.campaign_id`/`req.app.get('io')` déjà établi dans ce
   fichier), rejet `severity === 'destruction'`.
3. `client/src/character/ExoAvariesPanel.jsx` (nouveau) — grille de cases par palier (mirror
   `LocationPanel.jsx`, pas `ExoIntegrityPanel.jsx`), lit `EXO_AVARIE_TABLE` (`shared/exoConstants.js`)
   pour les colonnes lecture-seule "Modificateur d'incident"/"Perte définitive d'ITG". Ligne
   Destruction : lecture seule, aucune case. **Deux droits distincts, pas un seul `canEdit`** : cases
   vides cliquables pour GM/propriétaire/pilote (pose), cases pleines cliquables **seulement** pour
   `isGm` (retrait) — inertes sinon pour propriétaire/pilote.
4. `client/src/character/ExoSheetWindow.jsx` — retirer `'avaries'` de la boucle stub (:317), nouveau
   bloc `<CollapsibleBlock>` montant `ExoAvariesPanel`. Ajouter la prop `socket` + `useEffect` d'écoute
   `WS.EXO_AVARIE_UPDATED` (mirror `DroneWindow.jsx:126-136`) — **merge partiel uniquement**
   (`avaries_*` + `itg_structure_current`, jamais un remplacement complet de `exo` : `GET
   /:characterId/exo`, `char-sheet.js:1933-1963`, renvoie `exo_sheet.*` **plus une douzaine de champs
   `template_*` joints** que le payload `EXO_AVARIE_UPDATED` ne contient pas — un remplacement complet
   effacerait l'onglet Identité au premier coup encaissé).
5. Site d'appel de `ExoSheetWindow` (probablement `SessionPage.jsx`, `openSheet`/`case 'exo'`) —
   vérifier que `socket` y est déjà disponible (il l'est pour `DroneWindow`) et le passer en prop.
6. `client/src/locales/fr.json` — bloc `"exo"` existant (vérifié, pas `charSheet.json`) : clés
   manquantes (labels des 5 paliers + 2 colonnes + Destruction + tooltip de retrait).

**Hors périmètre explicite** : Localisation des incidents / Effets des incidents (bloc visible sur
`FDEA.webp` juste sous Avaries) — dépend du Lot 5a, pas encore ouvert. La vraie Réparation RAW (Test
de Mécanique, efface une ligne entière) — Lot séparé, pas ce Lot A.

**Validation prévue** : `node --check` sur les fichiers serveur touchés, tests `exoAvarieService.test.mjs`
étendus pour `removeExoAvarie` (plancher à 0, rejet `destruction`, non-régression des 15 tests
existants), lint + build client, scénario réel navigateur par Saar (poser/retirer des Avaries à la
main, déclencher une Avarie réelle en combat et vérifier le rafraîchissement live pendant que la
fenêtre reste ouverte, vérifier que l'onglet Identité survit à un `EXO_AVARIE_UPDATED`).

### 13.3 Lot B — Base éditable (refactor) — ✅ codé (2026-08-20)

**Clôture** : codé intégralement selon le détail ci-dessous. Deux trouvailles corrigées avant tout
appelant réel : (1) `template.speeds_extra` revient de Postgres déjà désérialisé (jsonb → tableau JS)
par le `SELECT` — le réinjecter tel quel dans l'`UPDATE` (`applyExoTemplate` et la route `PUT
/:characterId/exo`) faisait planter Postgres ("invalid input syntax for type json", le driver
sérialise un tableau JS en littéral Postgres, pas en JSON) — corrigé par un `JSON.stringify()`
explicite avant écriture, même ré-encodage que le seed 252 ; (2) en comparant la disposition retenue à
la fiche RAW réelle (`docs/REGLES/FDEA.webp`, relue directement, pas seulement décrite) plutôt qu'à la
seule capture Roll20 tierce, 3 champs RAW étaient absents du plan initial — Malus de Saisie/Armure à
terre (dérivés, `EXO_GRAPPLE_MALUS_TABLE`/`EXO_PRONE_RECOVERY_TABLE`, déjà dans `shared/exoConstants.js`,
aucune colonne) et Notes (texte libre, nouvelle colonne) — les 3 ajoutés après confirmation explicite
de Saar (migration 255 pour `notes`).

**Testé** : `node --check` sur tous les fichiers serveur touchés. 78/78 tests serveur contre
PostgreSQL réel (migrations 233/243/254/255, `combatantContextService.test.mjs` 33/33 non-régression
+ fixtures réécrites, `exoAvarieService.test.mjs` 21/21 non-régression, nouveau
`exoTemplateService.test.mjs` 6/6, `movementBudgetService.test.mjs` 2/2 non-régression) +
`charStats.test.mjs` 3/3 + `shared/exoStats.test.mjs` 18/18 réécrit (signature à un seul paramètre).
Build client complet réussi, lint client propre sur les fichiers touchés (1 avertissement
`react-hooks/set-state-in-effect` pré-existant sur `ExoSheetWindow.jsx`, confirmé hors diff de ce Lot,
même trouvaille que le Lot A).

**Non testé** : scénario réel navigateur (sélectionner un modèle, vérifier la copie des 19+3+1 champs,
éditer un champ copié à la main, changer de modèle et vérifier l'écrasement complet, dissocier le
modèle et vérifier que les champs personnalisés survivent, combat réel avec Initiative/dégâts/Manœuvre
d'armure sur une exo utilisant la nouvelle base) — à la charge de Saar.

**Données** : migrations 254 (22 colonnes + 4 CHECK + backfill — vérifié par un test dédié sur une
ligne `exo_sheet` avec `template_id` déjà assigné avant `up()`) et 255 (`notes`), toutes deux déjà
appliquées automatiquement par le watcher nodemon en développement.

**Retour arrière** : `knex migrate:down` x2 (255 puis 254) restaure le schéma d'avant ce Lot ; sinon
revert des fichiers listés ci-dessous.

**Fichiers touchés** : `server/src/db/migrations/254_exo_sheet_base_stats.js`+test (nouveau),
`server/src/db/migrations/255_exo_sheet_notes.js`+test (nouveau), `server/src/lib/exoTemplateService.js`
(nouveau, `applyExoTemplate`)+test, `shared/exoStats.js` (signature 1 paramètre)+test,
`server/src/lib/charStats.js` (`calcExoDegatsNets`), `server/src/lib/combatantContextService.js`
(`resolveExoContext`/`resolveManeuverSkillId`)+test, `server/src/lib/exoAvarieService.js`
(`resolveExoDamage`)+test, `server/src/socket/socketCombatHelpers.js`+`socketCombatState.js`,
`server/src/services/movementBudgetService.js`, `server/src/routes/character/char-sheet.js` (GET
simplifié, PUT étendu), `shared/exoConstants.js` (`EXO_ENVIRONMENT_VALUES`/`EXO_MOVEMENT_MODE_VALUES`),
`client/src/character/ExoIdentityPanel.jsx` (calcul direct), `client/src/character/ExoAttributesPanel.jsx`
(nouveau), `client/src/character/ExoInfoPanel.jsx` (nouveau), `client/src/character/ExoSheetWindow.jsx`
(câblage 2 sections), `client/src/locales/fr.json` (clés `exo.tabAttributes/tabInfo/field*`).

---

### 13.3 Lot B — Base éditable (refactor) — détaillé (2026-08-20)

**Existant vérifié — 4 points d'accès en dépendance live à `ref_exo_templates`, en plus de la lecture
GET déjà connue :**
1. `shared/exoStats.js#computeExoStats(exoSheet, template)` — lit `template.base_exoforce`,
   `template.base_blindage`, `template.category`.
2. `combatantContextService.js#resolveExoContext(db, exoCharacter)` (:130-136) — fait le join lui-même
   (`db('ref_exo_templates').where({id: exoSheet.template_id}).first()`), retourne `{pilot, exoSheet,
   template}`.
3. `combatantContextService.js#resolveManeuverSkillId(template)` (:167-185) — lit `template.environment`,
   `template.surface_movement_mode`.
4. `movementBudgetService.js#getExoMovementBudget(characterId, gait)` (:89-124) — fait **son propre**
   join séparé (`leftJoin('ref_exo_templates', ...)`), lit `base_speed_underwater/surface`,
   `underwater_movement_mode/surface_movement_mode`.
5. Initiative (`COMBAT_START`, `socketCombatState.js`, §10.2) — passe par `resolveExoContext` (point 2),
   lit `template.malus_init_underwater/surface`, `template.environment`,
   `template.underwater_movement_mode`.
6. `server/src/lib/charStats.js#calcExoDegatsNets(exoSheet, template, degautsBruts)` (Lot 4, §11.3) —
   passe `template` à `computeExoStats` en interne.
7. **Client, même défaut dupliqué** : `ExoIdentityPanel.jsx:19-24` reconstruit un objet
   `{base_exoforce, base_blindage, category}` à la main depuis les champs `exo.template_*` joints par
   le GET, pour appeler `computeExoStats` côté client — même dépendance live, juste recopiée en JS au
   lieu d'un JOIN SQL.
8. `GET /:characterId/exo` (`char-sheet.js:1933-1963`) — 13 colonnes `template_*` jointes.
9. `POST /characters` (type=exo) → `createCompanionSheet` (`charSheetService.js:45-48`) — insère un
   `exo_sheet` **vide**, `template_id` toujours `NULL` à la création (aucun sélecteur au formulaire,
   Lot 1 §6.5) : le seul point où `template_id` est réellement posé aujourd'hui est `PUT
   /:characterId/exo` (:1966-1988), pas la création. **Conséquence directe pour ce Lot** : le
   déclencheur de copie ne peut pas être "à la création" (ça n'arrive jamais avec un template) — il
   doit vivre dans `PUT /:characterId/exo`, au moment où `template_id` est effectivement fourni.

**Champs à copier** (mirror `ref_exo_templates`, nouvelles colonnes `exo_sheet`, toutes nullable —
l'invariant "non configurée" de Lot 1 §6.5 survit, juste porté par un champ sentinelle différent, voir
plus bas) : `category`, `environment`, `depth_operational`, `depth_limit`, `depth_crush`,
`base_exoforce`, `base_blindage`, `base_speed_underwater`, `base_speed_surface`,
`underwater_movement_mode`, `surface_movement_mode`, `speeds_extra`, `malus_init_underwater`,
`malus_init_surface`, `manufacturer`, `price`, `rarity`, `tech_level`, `autonomy`, **+ `taille`, `type_batterie`,
`type_coque`** (3 champs nouveaux, confirmés en comparant la fiche Roll20 tierce — absents de
`ref_exo_templates` comme de `exo_sheet` aujourd'hui, tous trois texte libre narratif, aucun calcul ne
les consomme).

**CHECK constraints — valeurs exactes mirrorées de `233_exo_sheet.js`/`243_..._movement_and_commerce.js`,
pas réinventées** :
- `category IN ('exo-alpha','exo-0','exo-1','exo-2','exo-3','exo-4','exo-5','exo-6','exo-omega')`
  (`233:49-50`).
- `environment IN ('submarine','surface','hybrid','atmospheric','spatial','industrial')` (`233:51-52`).
- `underwater_movement_mode IN ('vit','pilot','blocked')` / `surface_movement_mode IN
  ('vit','pilot','blocked')` (`243:41-44`).

**Divergence délibérée par rapport à `ref_exo_templates`, à documenter dans la migration pour qu'un
futur lecteur ne la lise pas comme un oubli** : sur `ref_exo_templates`, `base_exoforce`/`base_blindage`/
`malus_init_*`/`*_movement_mode` sont `NOT NULL DEFAULT ...` (une ligne catalogue est toujours une
définition complète). Sur `exo_sheet`, ces mêmes colonnes doivent être **nullable, sans défaut** — un
défaut non-nul romprait le sentinelle "non configurée" (toute nouvelle exo naîtrait "configurée" avec
des valeurs arbitraires au lieu de `NULL`). Deux tables, deux sémantiques, pas un copier-coller
mécanique du schéma source.

**Nouveau sentinelle "non configurée"** : jusqu'ici `template_id IS NULL` signifiait "aucune stat
calculable" (Lot 1 §6.5) — après ce Lot, `template_id` devient une simple référence, plus une
dépendance de calcul. Retenu : `category IS NULL` devient le nouveau sentinelle (premier champ
consommé par `computeExoStats`, et les champs copiés le sont toujours ensemble dans la même
transaction — jamais une copie partielle, donc `category` seul est un proxy fiable pour "tous les
champs de base sont renseignés").

**Déclencheur de copie — `PUT /:characterId/exo`, uniquement quand `template_id` est fourni et
résout un template réel.** Toujours une **copie complète, jamais une fusion intelligente** : choisir
un nouveau modèle écrase les 19+3 champs ci-dessus avec les valeurs du modèle choisi, y compris s'ils
avaient été personnalisés avant — comportement prévisible (« ce que vous voyez après sélection, c'est
ce que le modèle donne »), pas de logique de fusion à deviner. **`template_id: null` (dissociation) ne
réinitialise PAS les champs copiés** — une fois copiées, ces valeurs appartiennent à l'instance ;
dissocier la référence ne doit pas effacer des données déjà possédées. Décision par défaut, à confirmer
par Saar si un autre comportement est voulu.

**Extraction en fonction de service dédiée — `applyExoTemplate(db, characterId, templateId)`** (analyse
à charge 2026-08-20), pas une logique inline dans la route : §12.2 point 2 était encore ouvert au
moment d'écrire ce Lot ("le modèle pré-remplit-il aussi le loadout Systèmes/Armement ?") — **tranché
entre-temps par Saar : oui** (§13.4.4). Si la copie des stats de base avait été écrite directement dans
le corps de la route `PUT /:characterId/exo`, le Lot C aurait dû rouvrir cette route déjà livrée pour y
ajouter la copie du loadout. En l'isolant dans sa propre fonction dès ce Lot B, le Lot C n'a qu'à
**étendre** `applyExoTemplate` d'une étape (insertion `exo_systems`/`exo_weapons` depuis
`ref_exo_template_equipment`, §13.4.4) — la route, la permission, tout le reste du Lot B reste intact
et non retesté pour rien.

**Contrat précis** (`server/src/lib/combatantContextService.js` ou nouveau fichier — à trancher au
moment de coder selon où vivent déjà les fonctions exo serveur, pas un nouveau fichier par principe) :
- **Signature** : `async function applyExoTemplate(db, characterId, templateId)` → `exo_sheet` mis à
  jour (`.returning('*')`) ou `null` si `templateId` ne résout aucune ligne `ref_exo_templates`
  (mirror la convention "retour null sur introuvable" déjà en place, `applyExoAvarie`).
- **`templateId` validé comme UUID avant toute requête** (analyse à charge 2026-08-20, même trouvaille
  qu'au Lot A pour `severity`) : un `templateId` mal formé ferait planter Postgres
  (`invalid input syntax for type uuid`) et fuiterait en 500 brut au lieu d'un 400 propre — validé
  avant tout accès DB, pas laissé au hasard d'un format supposé correct.
- **Transactionnel dès ce Lot B, verrou de ligne compris — pas seulement l'écriture** (révisé, analyse
  à charge 2026-08-20). Une seule écriture (`UPDATE exo_sheet`) suffirait aujourd'hui sans verrou —
  mais le Lot C y ajoutera un remplacement complet du loadout (`DELETE` puis `INSERT` dans
  `exo_systems`/`exo_weapons`, §13.4.4), et **sans verrou**, deux sélections de modèle concurrentes sur
  la même exo-armure pourraient intercaler leurs `DELETE`/`INSERT` respectifs et produire un loadout
  mélangé des deux modèles — une vraie corruption de données, pas un état incohérent temporaire sans
  suite. Corrigé : `SELECT ... FOR UPDATE` sur la ligne `exo_sheet` en première étape de la transaction
  (même patron que `.forUpdate()` dans `applyExoAvarie`), avant toute écriture — sérialise
  automatiquement l'extension future sans qu'elle ait à reposer son propre verrou. Même raisonnement
  que l'extraction en fonction dédiée elle-même : poser la robustesse maintenant coûte une ligne,
  la retrofiter sur du code déjà livré coûterait une réouverture complète.
- **Route `PUT /:characterId/exo`** : `template_id` non-null dans le payload déclenche
  `applyExoTemplate` (remplace l'ancien simple `updates.template_id = template_id`). **Exclusivité
  revue** (analyse à charge 2026-08-20) : `template_id` non-null combiné à un autre champ dans la même
  requête est désormais un **400 explicite**, pas un silence — ma première rédaction faisait ignorer
  silencieusement les autres champs, un contrat d'API dangereux (un futur appelant qui combinerait les
  deux perdrait une partie de sa mise à jour sans le savoir). Aucun coût réel : le client actuel
  (`ExoIdentityPanel.jsx`) n'envoie de toute façon jamais `template_id` combiné à autre chose.
  `template_id: null` (dissociation) reste un simple `updates.template_id = null` dans le patch
  générique existant — ne passe jamais par `applyExoTemplate` (pas de copie à faire en sens inverse,
  §13.3 déjà tranché : dissocier ne réinitialise rien).
- **Validation avant écriture, pas de CHECK Postgres brut qui fuite en 500 — atomique** (précisé, 2ᵉ
  tour d'analyse à charge 2026-08-20) : la route valide **tous** les champs contraints fournis
  (`category`/`environment`/`underwater_movement_mode`/`surface_movement_mode`) contre les mêmes listes
  blanches que les CHECK constraints (ci-dessus) avant le moindre `UPDATE` — si un seul champ échoue,
  **aucun** n'est appliqué (tout ou rien), jamais une application partielle des champs valides pendant
  qu'un champ invalide est rejeté séparément. Même discipline que la validation de `severity` au Lot A
  (§13.2, "le serveur valide... les données avant toute mutation", `core.md`).
- **Vérifié, pas un trou — `avaries_*`/`itg_*_current` ne sont jamais touchés par un changement de
  modèle** (2ᵉ tour) : question posée puis vérifiée plutôt que supposée — ces champs ne font partie ni
  de la copie de base ni d'aucune étape d'`applyExoTemplate`, donc un changement de modèle ne remet
  jamais à zéro les dégâts/Intégrité accumulés. Comportement déjà correct par construction (ces champs
  ne sont simplement jamais dans la liste des colonnes copiées), pas une décision explicite qu'il
  fallait ajouter — juste confirmé plutôt que laissé en angle mort.
- **Requêtes à réécrire explicitement, pas juste amputer d'un `.leftJoin` — vérifié fonction par
  fonction, pas supposé** (analyse à charge 2026-08-20) : `resolvePilot`/`resolveExoContext`
  (`combatantContextService.js`) font déjà un `SELECT *` implicite sur `exo_sheet` — les nouvelles
  colonnes arrivent automatiquement, rien à réécrire au-delà de la suppression du join vers
  `ref_exo_templates`. **`getExoMovementBudget` (`movementBudgetService.js:89-101`) fait en revanche une
  liste de colonnes explicite** (`'exo_sheet.template_id', 'ref_exo_templates.base_speed_underwater',
  ...`) — celle-là doit être réécrite ligne par ligne avec les nouveaux noms de colonnes natifs
  (`exo_sheet.base_speed_underwater` etc.), pas seulement perdre son `.leftJoin`.

**Migration — backfill obligatoire, pas seulement l'ajout de colonnes** (trouvé en analyse à charge,
2026-08-20) : le catalogue `ref_exo_templates` vient d'être seedé cette semaine (§12.4) et une partie
du travail de cette session (validation navigateur des Lots 1-4) suppose qu'une exo-armure réelle ait
déjà `template_id` assigné. Ajouter les colonnes vides sans backfill ferait basculer silencieusement
toute exo-armure déjà configurée en "non configurée" (nouveau sentinelle `category IS NULL`) dès le
déploiement de cette migration. Le `up()` doit donc, après `ALTER TABLE`, exécuter un `UPDATE
exo_sheet ... FROM ref_exo_templates WHERE exo_sheet.template_id = ref_exo_templates.id` copiant les
mêmes colonnes qu'`applyExoTemplate` copiera à l'avenir — un backfill ponctuel (au moment de la
migration), pas un mécanisme permanent. `taille`/`type_batterie`/`type_coque` n'ont aucune source sur
`ref_exo_templates` — restent `NULL` pour les lignes existantes, rien à backfiller (attendu, pas un
oubli).

**Extension de whitelist — même route** : les 19 champs deviennent aussi éditables directement (pas
seulement via sélection de modèle), même permission `exoIsGmOrOwnerOrPilot` déjà en place sur cette
route — cohérent avec "toute valeur de la fiche modifiable" (§13.1).

**Refactors de signature (suppression du paramètre `template`, lecture directe sur `exoSheet`) :**
- `computeExoStats(exoSheet)` — plus de second paramètre.
- `resolveManeuverSkillId(exoSheet)` — idem.
- `resolveExoContext(db, exoCharacter)` — retourne `{ pilot, exoSheet }` ; le join `ref_exo_templates`
  disparaît du chemin chaud. Si un appelant a encore besoin du nom du modèle d'origine pour affichage
  (ex. "pré-rempli depuis : Armure Mentor"), fetch séparé et explicite à sa charge — jamais réintroduit
  dans cette fonction partagée par tous les sites de combat.
- `getExoMovementBudget` — supprime le `leftJoin`, lit `base_speed_*`/`*_movement_mode` directement sur
  `exo_sheet`.
- `COMBAT_START` (Initiative) — idem, lit `malus_init_*`/`environment`/`underwater_movement_mode`
  directement sur `exoSheet` déjà résolu par `resolveExoContext`.
- `calcExoDegatsNets(exoSheet, degautsBruts)` — un paramètre de moins.
- `resolveExoDamage` (`exoAvarieService.js`) — garde `!exoSheet` mais remplace `!template` par
  `!exoSheet.category` (nouveau sentinelle).
- `ExoIdentityPanel.jsx:19-24` — supprime la reconstruction manuelle, appelle `computeExoStats(exo)`
  directement.
- `GET /:characterId/exo` — le join `ref_exo_templates` se réduit à `name as template_name` seul
  (affichage "basé sur X"), les 12 autres colonnes `template_*` disparaissent (l'info vit maintenant
  nativement sur `exo_sheet`, sous son propre nom de colonne, pas préfixée).

**Disposition UI — tranchée (Saar, 2026-08-20) : copier la fiche RAW.** 19 nouveaux champs éditables
ne rentrent pas dans l'onglet Identité actuel (Pilote/Modèle/Stats dérivées) — 2 nouvelles sections
repliables dans `ExoSheetWindow.jsx`, calquées sur les 2 blocs de `FDEA.webp` : **"Attributs de
l'Armure"** (RD/Blindage/EXF/Vitesse/Malus init — les 4 champs déjà dérivés par `computeExoStats`
restent en lecture seule à côté de leurs bases éditables, pas fusionnés) et **"Informations sur
l'Armure"** (Catégorie/NT/Taille/Profondeurs Optimale-Limite-Écrasement/Autonomie/Notes). Pilote/Modèle
restent dans Identité (inchangé, déjà en place) — ces 2 nouveaux blocs portent uniquement les champs
copiés depuis le template.

**Détail de champs confirmé contre la fiche Roll20 tierce (captures Saar, 2026-08-20 — inspiration de
présentation uniquement, cf. avertissement §13)** :
- **Informations** : Type/Nom, Catégorie, NT, GAB (Taille), Prf. Optimale/Limite/Écrasement, Autonomie,
  Malus de Saisie, Armure à terre, Notes — **+ un champ non prévu jusqu'ici, `type_batterie`** (texte
  libre, ex. "Générateur thermoélectrique à radio-isotope") — ajouté à la liste des 19+1 champs
  copiés/éditables.
- **Attributs** : RD, type de coque (texte libre, narratif, pas consommé par un calcul — ajouté par
  cohérence de présentation, comme `type_batterie`), Blindage, Exo-Force, MD (`getModDom`, déjà
  calculé — affiché à titre indicatif, jamais une seconde autorité), Vitesse, Malus d'initiative.
- **Non repris tel quel — ambigu, pas une donnée fiable** : la capture affiche 4 sous-valeurs
  ("Vic/s Eau"/"Vic/s Terre"/"Mi's Eau"/"Mi's Terre") sous RD/Blindage/Volet/Exo-Force dont le sens
  exact n'est pas clair (probablement un artefact de mise en page de la fiche tierce, pas une donnée
  RAW distincte — `malus_init_underwater/surface` et `base_speed_underwater/surface` couvrent déjà la
  distinction milieu/milieu). Pas adopté sans confirmation.
- **Case "Volet de Sécurité sur Visière"** : ne devient pas une colonne `exo_sheet` — c'est un système
  du catalogue (`ref_exo_equipment`, "Volet de sécurité", déjà seedé §12.4) que le Lot C représente
  nativement via une ligne `exo_systems`, pas un booléen redondant sur la fiche de base.

**Hors périmètre explicite** : Systèmes/Armement/Ordinateur (Lot C) — aucune interaction, colonnes
différentes. Modèles perso Vault (Lot D) — ce Lot B les rend juste inutiles à attendre (§13.1).

**Validation prévue** : migration testée up/down/re-up (patron `schemaAssertions.mjs`) **avec un cas
dédié au backfill** — créer une ligne `exo_sheet` avec `template_id` assigné avant `up()`, vérifier
qu'elle ressort avec les 19 champs correctement copiés après (pas seulement un test sur une base
vierge, qui ne l'aurait jamais exercé) ; `applyExoTemplate` testé isolément (transaction, retour `null`
sur `templateId` invalide, exclusivité vs. autres champs de la requête) ; non-régression des tests
existants après refactor de signature (`exoAvarieService.test.mjs`, `combatantContextService.test.mjs`,
`charStats.test.mjs`, `exoStats` si testé) ; `node --check` sur tous les fichiers touchés, build+lint
client, scénario réel navigateur par Saar (sélectionner un modèle, vérifier la copie, éditer un champ
copié à la main, changer de modèle et vérifier l'écrasement complet, dissocier le modèle et vérifier
que les champs survivent).

### 13.4 Lot C — Systèmes / Armement / Ordinateur — détaillé (2026-08-20)

> **Étape 1 (migration schéma) ✅ codée et testée contre PostgreSQL réel (2026-08-21)** —
> `257_exo_loadout_schema.js`+test : crée `exo_systems`/`exo_weapons`/`exo_programs`/`exo_computers`
> (instance) et `ref_exo_template_equipment`/`ref_exo_template_computers` (catalogue, révision
> Ordinateur ci-dessus), retire les 4 colonnes jsonb mortes de `exo_sheet`. Appliquée automatiquement
> par nodemon au démarrage serveur (P53) — a immédiatement révélé un régression réelle, pas seulement
> hypothétique : `exo_systems`/`exo_weapons`/`exo_programs`/`exo_computers` portent une FK vers
> `characters(id)` sans être enregistrées dans `COMPANION_REGISTRY` (`vaultService.js`), ce qui aurait
> fait échouer `assertRegistryUpToDate` — donc **tout** clonage Vault, pour **tout** type de personnage
> (pas seulement exo) — en 500 dès le prochain clonage. Corrigé dans la foulée (même commit que la
> migration, pas différé) : retrait de `damaged_systems: '{}'` dans `cloneExoSheet` (colonne
> supprimée), ajout des 4 nouvelles tables à `COMPANION_REGISTRY.exo.characterKeyed`. La remise à neuf
> de `integrite_current` au clonage (§13.4.3 point 3 ci-dessous) reste différée — aucune ligne
> `exo_systems`/`exo_weapons`/`exo_computers` n'existe encore en pratique (routes pas encore codées),
> donc aucun risque actif tant que ce Lot n'est pas allé plus loin.
> **Testé** : suite ciblée exo/vault contre PostgreSQL réel (100/100 : migrations 233/243/251/252/253/
> 254/255/257, `exoTemplateService`, `exoAvarieService`, `combatantContextService`,
> `movementBudgetService`, `vaultCloneRegistry` — ce dernier confirme explicitement que
> `cloneCharacterDeep` réussit à nouveau pour pj/drone/exo). `233_exo_sheet.test.mjs` mis à jour (son
> test "schéma réel" vérifiait encore les 4 colonnes retirées par 257 — corrigé en distinguant "ce que
> 233 crée dans son propre replay transactionnel" de "ce qui survit dans le schéma déployé aujourd'hui",
> jamais une modification de la logique `up()`/`down()` de 233 elle-même, CLAUDE.md §5). **Non testé** :
> suite serveur complète (tentative avortée — collision de port avec le serveur dev de Saar déjà
> lancé, pas retentée pour ne pas perturber sa session) ; reste des étapes 2+ de ce Lot (services,
> routes, panneaux client) à coder avant toute validation navigateur.
>
> **Étape 2 (`shared/computerStats.js`) ✅ codée et testée (2026-08-21)** — `computeOrdinateurStats`
> (4 formules RAW, exemple chiffré p.280 vérifié littéralement + un second jeu gen/nt distinct pour
> confirmer qu'un principal et un secours de génération différente donnent bien des profils
> différents) et `computeBlindageIemCost`, tous deux avec garde explicite `gen`/`nt`/`niv` absent →
> `null` (jamais un NaN silencieux, `0` traité comme une valeur valide distincte de "absent"). L'Intégrité
> de départ (jet, pas une formule) reste volontairement hors de ce fichier — à câbler dans
> `applyExoTemplate` via `parseDice` (§13.4.1). **Testé** : `node --check` + 8/8 tests (fonction pure,
> aucun accès DB, tourne toujours). **Non testé** : aucun appelant réel ne consomme encore cette
> fonction (ni serveur ni client) — prochaine étape logique.
>
> **Étape 2bis (`resolveOrdinateurIntegrityFormula`) ✅ ajoutée à `computerStats.js` (2026-08-21)** —
> table RAW directe (Gén. I-II → `2d6+3`, III-VIII → `2d6+8`, IX-X → `3d6+7`,
> `REGLE_ORDINATEUR.md:91-93`), erreur explicite hors plage I-X. **Testé** : 2/2 tests (bornes exactes
> des 3 paliers, rejet hors plage).
>
> **Étape 3 (`applyExoTemplate` étendu — loadout complet) ✅ codée et testée contre PostgreSQL réel
> (2026-08-21)** — trou trouvé en préparant cette étape : ni `ref_exo_equipment` ni
> `ref_exo_template_equipment` ne portaient de colonne Intégrité, contrairement à l'Ordinateur (qui a
> sa propre table par Génération). Question posée à Saar (2026-08-21) : **Intégrité de départ de
> `exo_systems`/`exo_weapons` copiés depuis un loadout = fixe à 20 (matériel neuf)**, jamais un jet —
> tranché explicitement, distinct de la règle générale "matériel d'occasion 2D6+6" de l'intro
> `SEEDEXO.md` (qui ne s'applique pas aux armures prémade RAW, sorties d'usine). L'Ordinateur garde
> son propre jet par génération (règle RAW dédiée, aucune alternative "neuf" dans le texte source —
> pas de contradiction avec la décision ci-dessus). `applyExoTemplate` : après la copie des champs de
> base, écrase tout le loadout existant (`DELETE` sur `exo_systems`/`exo_weapons`/`exo_computers` du
> personnage — même verrou `FOR UPDATE` déjà posé sur `exo_sheet` qui sérialise l'ensemble, pas de
> second verrou nécessaire), puis réinsère depuis `ref_exo_template_equipment` (Intégrité fixe 20) et
> `ref_exo_template_computers` (un `parseDice` **par ligne**, formule selon **sa propre** génération —
> vérifié explicitement par test qu'un principal Gén. V et un secours Gén. II tirent deux formules
> différentes, jamais le même jet réutilisé). **Testé** : suite ciblée 98/98 contre PostgreSQL réel
> (`exoTemplateService` 9/9 dont les 3 nouveaux : Intégrité neuve fixe, jet par ligne avec bornes
> vérifiées par formule, écrasement complet au changement de modèle — relancé 3x pour confirmer la
> stabilité des assertions dépendant du hasard ; `computerStats` 10/10 ; migrations 233/254/257 ;
> `exoAvarieService`/`combatantContextService`/`movementBudgetService`/`vaultCloneRegistry`, aucune
> régression). **Non testé** : aucune route/UI ne consomme encore le loadout — reste à coder (routes
> systèmes/armes/programmes/ordinateurs, panneaux client), puis la session de transcription RAW
> (§13.4.4, ~200-300 lignes).
>
> **Étape 4 (migration 258 — `exo_programs.exo_computer_id`) ✅ codée et testée (2026-08-21)** — trou
> trouvé en préparant les routes `POST/PUT /:characterId/exo/programs` : le RAW plafonne Potentiel/
> Niveau max **par ordinateur** (`REGLE_ORDINATEUR.md:11,16`, singulier), or une exo peut porter 0/1/2
> ordinateurs distincts (§13.4.1). Question posée à Saar : **`exo_computer_id` nullable, `ON DELETE
> SET NULL`** (un programme survit à la suppression de son ordinateur, devient simplement "non géré"
> plutôt que détruit — cohérent avec le texte RAW lui-même). **Testé** : 3/3 tests migration (schéma,
> up/down, SET NULL vérifié explicitement par insertion + suppression réelle de l'ordinateur).
>
> **Étape 5 (routes serveur — 4 familles, 16 routes) ✅ codées (2026-08-21)** —
> `char-sheet.js` : `GET/POST/PUT/DELETE` pour `/:characterId/exo/{systems,weapons,computers,programs}`,
> patron uniforme (4 GET séparées, jamais agrégées dans `GET /:characterId/exo`, décision confirmée par
> Saar — le précédent drone est asymétrique entre programmes bundlés et armes séparées, pas reproduit).
> Permission uniforme `exoIsGmOrOwnerOrPilot`. Deux divergences assumées et documentées par rapport au
> précédent drone (code neuf, pas de raison de reproduire ses lacunes connues) : (1) jamais la
> vérification inline `req.character.user_id === req.user.id` que `PUT /drone/weapons/:id`
> réimplémente au lieu de réutiliser son propre helper ; (2) `PUT /:characterId/exo/programs/:id`
> **revalide** Potentiel/Niveau max si `level`/`exo_computer_id` changent (`drone_programs` ne le fait
> jamais, gap préexistant non corrigé côté drone, juste pas reproduit ici). `exo_computer_id` optionnel
> sur `POST/PUT /exo/programs` : si fourni, validé (appartenance au personnage + `computeOrdinateurStats`
> pour Potentiel/Niveau max) ; si absent, aucune validation (mirror le comportement du drone quand
> `ordinateur_gen`/`nt` sont NULL). **Testé** : `node --check` + import ESM réel du module (résout tous
> les imports, aucune erreur d'enregistrement de route) + smoke test jetable (hors dépôt, scratchpad)
> exerçant les requêtes knex réelles des 4 familles contre PostgreSQL réel — insert/update/delete
> `exo_systems`/`exo_weapons`, deux `exo_computers` de rôles/générations distincts, calcul Potentiel
> réel (Gén. V/NT III → 40, cohérent avec `computerStats`), détection d'un dépassement de Potentiel
> simulée, et confirmation réelle que `exo_computer_id` passe à `NULL` (pas de cascade) quand
> l'ordinateur est supprimé — 9/9. Suite ciblée existante 101/101, aucune régression. **Non testé** :
> aucun scénario HTTP de bout en bout (ce projet n'a pas d'infrastructure de test HTTP, routes
> validées par lecture + smoke test service-layer, comme tous les lots précédents) ; aucune UI ne les
> consomme encore. Reste : panneaux client (`ExoSystemsPanel.jsx`/`ExoWeaponsPanel.jsx`/
> `ExoProgramsPanel.jsx`/`ExoComputerPanel.jsx`), câblage `ExoSheetWindow.jsx`, clés i18n, puis la
> session de transcription RAW (§13.4.4).
>
> **Précision RAW — relation principal/secours (Saar, 2026-08-21), à retenir pour le panneau client et
> pour Lot 5** : le "secours" n'est **jamais actif en parallèle** du "principal" — il reste inactif
> tant que le principal est fonctionnel, et ne prend le relais que lorsque celui-ci tombe HS (Intégrité
> courante ≤ 0, même convention que le Générateur exo, `exoStats.js`). N'affecte ni le schéma
> (257/258) ni `computeOrdinateurStats` (Potentiel/Niveau max restent des propriétés du matériel, pas
> de son état d'activation — un programme installé sur le secours occupe bien son propre budget, prêt
> à l'emploi même hors service) : l'activation est un état de combat/runtime dérivé, jamais stocké,
> hors périmètre du Lot C (qui ne couvre que la fiche). **`resolveActiveComputer(computers)` ajoutée à
> `computerStats.js`** (fonction pure, dérive l'ordinateur actif à partir d'`integrite_current`) pour
> que le panneau client à venir puisse afficher correctement lequel des deux fonctionne réellement,
> plutôt que de présenter les deux comme équivalents. **Testé** : 6/6 tests (principal fonctionnel,
> relais au principal HS, aucun relais possible sans secours, cas à un seul ordinateur, aucun
> ordinateur, les deux HS). 16/16 au total sur `computerStats.test.mjs`.
>
> **Précision RAW — catalogue "Programmes" (Saar, 2026-08-21)** : pas de liste de programmes propre
> aux exo-armures dans le Livre de Base (confirmé — aucun des 16 loadouts `SEEDEXO.md` n'en liste),
> parce que RAW traite l'Ordinateur comme un sous-système générique "incorporé à des ordinateurs de
> drones ou d'appareils" (`REGLE_ORDINATEUR.md:101`) — un seul catalogue partagé, pas un par
> plateforme. Vérifié en base : `ref_equipment` famille `'Logiciels'` (34 lignes) mélange
> effectivement des programmes de comportement drone (Esquive, Pilotage, Contact, Balistique,
> Bombardement), des programmes ordinateur génériques (Sécurité, Offensif, Cryptage, Décryptage,
> Brise-code, Analyse senseurs, Communication...) et des programmes médicaux/scientifiques
> (Chirurgie, Analyse médicale, Science botanique...) — une seule famille RAW, pas trois. **Corrigé
> côté route** : `POST /:characterId/exo/programs` (§13.4.2/étape 5) ne filtrait sur aucune famille
> (mirror strict de `drone_programs`, qui ne filtre pas non plus) — resserré à `family: 'Logiciels'`
> (divergence documentée, empêche seulement d'assigner une arme/armure comme "programme" par erreur ;
> pas de sous-filtre par `category` esquive/medical/etc., RAW ne distingue pas non plus quel programme
> convient à quelle plateforme, jugement MJ). `drone_programs` non touché (hors périmètre, code
> existant). **Testé** : `node --check` + réimport du module, aucune erreur.
>
> **Étape 6 (panneaux client) ✅ codée (2026-08-21) — Lot C entièrement codé.** Consultation directe de
> la fiche RAW officielle (`docs/REGLES/FDEA.webp`) avant de trancher la disposition, plutôt que de
> deviner : confirme que "Systèmes auxiliaires" et "Armement" sont deux blocs visuellement distincts
> (colonnes différentes : Matériel/Niv./Description/ITG vs Dom./Choc/Portée/Ini./Mode de tir/Mun./
> Notes/NT/ITG) — jamais fusionnés (§13.4.3 laissait la question ouverte) ; et que "Programmes" est
> imbriqué **à l'intérieur** du bloc "Ordinateur" sur la fiche officielle, pas une section à part —
> confirme le choix de scoper `exo_programs` par `exo_computer_id` (étape 4) au niveau UI aussi.
> `ExoSystemsPanel.jsx`/`ExoWeaponsPanel.jsx` (catalogue `GET /api/exo-equipment`, nouvelle route —
> aucune n'existait pour lister `ref_exo_equipment` côté client, trou trouvé en préparant ce panneau ;
> mirror `exoTemplates.js`) + `ExoComputerPanel.jsx` (une carte par ordinateur avec badge Actif/En
> veille via `resolveActiveComputer`, programmes imbriqués par ordinateur avec jauge Potentiel
> utilisé/max en direct). `SHEET_SECTIONS` (`ExoSheetWindow.jsx`) étendue de `'weapons'`, stub retiré
> pour les 3 sections. Clés i18n ajoutées sous `exo.*` (fr.json), `exo.category.*` non dupliquée —
> réutilise `drone.category.*` (même catalogue `Logiciels` partagé, étape "précision programmes").
> `exo.comingSoon` devenue orpheline, supprimée (dernier usage retiré par ce Lot). **Testé** : ESLint
> ciblé sur les 4 fichiers touchés (0 erreur/0 warning sur les 3 nouveaux panneaux ; 1 erreur
> `react-hooks/set-state-in-effect` sur `ExoSheetWindow.jsx` — préexistante, confirmée hors diff de ce
> Lot, même trouvaille que le Lot A/B), lint complet du client (159 problèmes préexistants ailleurs
> dans le repo, aucun nouveau), build client complet réussi. **Non testé** : scénario réel navigateur
> (à la charge de Saar, comme toujours) — créer/éditer/retirer un système, une arme, un ordinateur
> (principal + secours), un programme scopé par ordinateur, vérifier le badge Actif/En veille et la
> jauge Potentiel en conditions réelles.
>
> **Reste avant que le Lot C soit jouable en jeu réel** : la session de transcription RAW (§13.4.4,
> ~200-300 lignes de loadout `ref_exo_template_equipment`/`ref_exo_template_computers`, différée
> explicitement à une session dédiée) — sans elle, `applyExoTemplate` copie un loadout vide pour les
> 16 modèles existants (rien à copier, pas un bug, juste aucune donnée à copier). Le catalogue
> `ref_exo_equipment` (Systèmes/Armement libres) et le catalogue `Logiciels` (Programmes) sont déjà
> peuplés et utilisables dès maintenant, indépendamment de cette transcription.
>
> **Bug trouvé par Saar en premier test navigateur réel (2026-08-21)** : un système/une arme ajouté(e)
> depuis le catalogue affiche "—" au lieu de son nom. Diagnostiqué en base avant tout correctif
> (`GET` rejoué manuellement sur la ligne réelle de Saar : `display_name` correct, "Lance-harpons AV")
> — donc pas un problème de données ni de `GET`. Cause racine trouvée par lecture : **`POST`/`PUT` sur
> `exo_systems`/`exo_weapons` renvoyaient la ligne brute (`.returning('*')`, sans jointure
> `ref_exo_equipment`)**, contrairement à `GET` — mirror manqué du précédent `drone_weapons`, qui
> refait bien la jointure après `insert`/`update` (`char-sheet.js:1842-1856,1885-1899`, lu au moment
> d'écrire ce Lot mais pas appliqué à ces deux routes précises). Le state client optimiste (POST) puis
> toute édition (PUT, ex. Intégrité) réinjectait donc une ligne sans `display_name`, écrasant même une
> valeur correcte lue juste avant par `GET`. Corrigé : `selectExoSystemFields`/`selectExoWeaponFields`
> (helpers partagés, un seul SELECT par table au lieu de 3 copies GET/POST/PUT divergentes) — `POST`
> insère puis rejoue le SELECT enrichi sur l'`id` retourné, `PUT` idem après l'`UPDATE`. **Testé** :
> simulation directe du nouveau flux POST contre PostgreSQL réel (insert + re-select, `display_name`
> correct), suite ciblée 95/95, `node --check` + réimport du module. **Non testé** : re-confirmation
> navigateur par Saar (le correctif n'a pas encore été revu en conditions réelles après ce fix).



> **Deux corrections à la synthèse du 2026-08-20 (§13.1), trouvées en vérifiant le code réel du drone
> avant de rédiger ce détail — pas juste supposées par analogie :**
> 1. Le drone ne dérive **pas déjà** les stats Ordinateur. `drone_sheet.ordinateur_gen`/`ordinateur_nt`
>    sont stockés (`71_drone_sheet.js:30-31`), mais rien dans le projet ne calcule Niveau max des
>    programmes/Gestion systèmes/Potentiel/Coût à partir de ces deux valeurs — `DroneSheet.jsx:388-389`
>    les affiche tels quels, aucun calcul. Le précédent donne la **forme de stockage**, pas les
>    formules — celles-ci restent à écrire dans ce Lot.
> 2. `drone_weapons` n'a **aucune** Intégrité par ligne (vérifié `76c_drone_weapons_schema.js` —
>    `name`/`damage_formula`/`portee`/`fire_mode`/`notes`, pas de colonne ITG ; le drone ne track
>    l'Intégrité qu'au niveau du drone entier, `drone_sheet.integrite_*`). La fiche RAW (`FDEA.webp`)
>    montre pourtant un ITG par ligne de Systèmes/Armement — extension réelle par rapport au patron
>    drone, pas une simple copie.
>
> **Troisième correction, trouvée en reprenant ce Lot le 2026-08-21 — le point 1 de §13.4.1 ci-dessous
> était faux, pas juste incomplet.** L'analyse du 2026-08-20 affirmait "la ligne 'Ordinateur NT X,
> Gén. Y' apparaît dans le loadout de la quasi-totalité des 16 armures" sans avoir compté combien
> d'armures en montrent réellement DEUX. Vérification ligne à ligne de `SEEDEXO.md` (pas un sondage) :
> **4 armures sur 16 (Nymph 1-A:1029-1030, Heimdall-Pyrelia:1402-1403, Odin:1497-1498,
> Moloch:1612-1613) ont un ordinateur "principal" ET un ordinateur "secours" distincts, chacun avec
> son propre NT/Gén.** Même mécanisme RAW que la redondance des interfaces de contrôle ("on peut
> monter plusieurs commandes différentes sur un même appareil comme système de secours, mais jamais
> deux systèmes identiques à la fois", `SEEDEXO.md:22-24`) — et le texte RAW liste d'ailleurs
> l'Ordinateur **à l'intérieur** du bloc "Systèmes auxiliaires" de chaque fiche, jamais dans les
> Attributs, cohérent avec un système redondant comme un autre plutôt qu'une stat de base unique.
> Deux colonnes scalaires (`ordinateur_gen`/`ordinateur_nt` sur `exo_sheet`) ne peuvent physiquement
> pas porter un second ordinateur — la transcription du loadout (§13.4.4) aurait perdu silencieusement
> l'ordinateur de secours sur 25% du catalogue, sans erreur ni signal, la classe de bug que ce plan a
> justement débusquée et corrigée à plusieurs reprises ailleurs (backfill Lot B, `computeExoStats`
> "jamais un NaN silencieux", etc.). **Décision Saar (2026-08-21, question posée explicitement avant
> tout code) : table dédiée plutôt que colonnes scalaires** — voir §13.4.1 réécrit ci-dessous, qui
> remplace intégralement l'ancienne conclusion (barrée, gardée pour trace du raisonnement invalidé).

#### 13.4.1 Ordinateur — révisé (2026-08-21)

**Formules RAW** (`docs/REGLES/REGLE_ORDINATEUR.md` p.280-281, fournies par Saar) — nouveau fichier
pur **`shared/computerStats.js`** (même famille que `exoStats.js`/`polarisUtils.js`, jamais un accès
DB) :
- `computeOrdinateurStats({ gen, nt })` → `{ niveauMaxProgrammes: gen + 2*nt, gestionSystemes: 10 +
  gen*nt, potentiel: 10 + (gen*nt)*2, cout: 500*(gen*nt) }`.
- Intégrité de départ (2D6+3 Gén I-II / 2D6+8 Gén III-VIII / 3D6+7 Gén IX-X) : **un jet**, pas une
  formule pure — comme toute Intégrité de départ d'équipement (§ Intégrité du matériel, RAW p.273),
  stockée une fois tirée, jamais recalculée. Pas dans `computeComputerStats`.
- Coût du Blindage IEM (`(niv×niv)×200`) : fonction séparée, `niv` est un choix (équipement acheté),
  pas dérivé de `gen`/`nt`.

**~~Les 5 champs ne sont PAS homogènes... 3 mécanismes différents, pas une seule "copie".~~ — analyse du
2026-08-20 gardée pour trace, invalidée par la trouvaille du 2026-08-21 ci-dessus (point 1 supposait un
seul ordinateur par armure). Les 3 mécanismes identifiés (copié / tiré / manuel) restent corrects
individuellement — c'est la forme de stockage (scalaire vs ligne) qui change ci-dessous, pas la nature
de chaque champ.**

**Décision révisée — table dédiée, pas des colonnes scalaires sur `exo_sheet`/`ref_exo_templates`.**
Un ordinateur exo est un système à cardinalité variable (0, 1 ou 2 par armure selon le RAW réel), exactement
la même famille de besoin que `exo_systems`/`exo_weapons`/`exo_programs` juste en dessous (§13.4.2-13.4.3)
— pas une stat de base à cardinalité fixe comme EXF/Blindage. Cohérent avec la doctrine déjà appliquée
tout au long de ce chantier (une table par concept à cardinalité N, jamais des colonnes `_secours_*`
dupliquées façon anti-patron `*_turns_left` déjà rejeté au cadrage §1.8).

**`ref_exo_template_computers`** (catalogue, migration de ce Lot) : `id`, `template_id` FK
`ref_exo_templates` `ON DELETE CASCADE` (même sémantique que `ref_exo_template_equipment`, §13.4.4 —
une ligne de loadout catalogue n'a aucun sens sans son template), `role text CHECK IN ('principal',
'secours')`, `gen smallint NOT NULL`, `nt smallint NOT NULL`, `sort_order smallint`.

**`exo_computers`** (instance, character_id-keyed comme `exo_systems`/`exo_weapons`/`exo_programs`) :
`id`, `character_id` FK `characters` `ON DELETE CASCADE`, `role text CHECK IN ('principal','secours')`,
`gen smallint NOT NULL`, `nt smallint NOT NULL`, `blindage_iem integer` (manuel, nullable — la
trouvaille du 2026-08-20 tient toujours : "Blindage IEM" n'est jamais imputable à un ordinateur précis
dans le texte source, encore moins de raison qu'il soit identique entre principal et secours une fois
que les deux existent comme lignes distinctes), `integrite_max`/`integrite_current integer` (tirés,
jamais copiés — RAW explicite : l'Intégrité de départ dépend d'un jet selon la génération, 2D6+3 Gén
I-II / 2D6+8 Gén III-VIII / 3D6+7 Gén IX-X, chaque exemplaire tire la sienne), `sort_order smallint`.
Pas de contrainte d'unicité `(character_id, role)` : rien dans le RAW n'interdit explicitement un
exemplaire personnalisé avec deux ordinateurs "principal" après remplacement d'un composant — la seule
règle citée ("jamais deux systèmes identiques à la fois") porte sur le catalogue standard, pas une
garantie applicative à faire respecter en base.

**`applyExoTemplate` étendu d'une étape supplémentaire** (même transaction que la copie de base et le
loadout `exo_systems`/`exo_weapons`, §13.4.4) : pour chaque ligne `ref_exo_template_computers` du
template sélectionné, insère une ligne `exo_computers` avec `gen`/`nt`/`role` copiés et
`integrite_current = integrite_max` = résultat d'un `parseDice` sur la formule correspondant à `gen`
(`server/src/lib/diceParser.js`, déjà utilisé partout ailleurs dans le projet — pas de nouvelle logique
de dés). Changer de modèle réapplique le même écrasement complet déjà acté pour `exo_systems`/
`exo_weapons` (§13.4.4) : les `exo_computers` existants sont remplacés par le loadout d'usine du
nouveau modèle, pas fusionnés.

**Formules dérivées** (`computeOrdinateurStats`, ci-dessous) appelées **par ligne** `exo_computers` —
`ExoComputerPanel.jsx` affiche une carte par ordinateur (principal, puis secours s'il existe), jamais un
seul jeu de stats agrégé pour l'armure entière.

**Piste notée, pas engagée maintenant** : `drone_sheet.ordinateur_gen`/`ordinateur_nt` restent des
colonnes scalaires (le drone n'a jamais de redondance dans son propre patron actuel) — `DroneSheet.jsx`
n'affiche toujours aucune valeur dérivée, `computeComputerStats` pourrait lui bénéficier gratuitement
une fois écrite, sans changer son schéma. Hors périmètre de ce chantier exo, à proposer séparément si
Saar veut l'étendre au drone.

#### 13.4.2 Programmes — mirror exact `drone_programs`

`exo_programs` (nouvelle table) : `id`, `character_id` FK `characters`, `equipment_id` FK
`ref_equipment` nullable (catalogue `family='Logiciels'`, déjà seedé — **aucune nouvelle donnée**),
`label_override` text nullable, `category` text (copié depuis `ref_equipment.category` à l'insert,
même patron que `drone_programs`), `level` integer `checkBetween([0,30])`, `sort_order` smallint.
Contrainte `equipment_id IS NOT NULL OR label_override IS NOT NULL` — **CHECK en base**, comme
`chk_dp_source`. Routes `POST/PUT/DELETE /:characterId/exo/programs[/:id]` — mirror exact
`char-sheet.js:1646-1757` (`droneIsGmOrOwner` → `exoIsGmOrOwnerOrPilot`).

**Discipline retenue pour les 3 nouvelles tables (analyse à charge 2026-08-20)** : le précédent drone
est lui-même incohérent — `drone_programs` impose "`equipment_id` OU `label_override`" par une
contrainte CHECK en base (`chk_dp_source`), `drone_weapons` impose le même invariant **seulement
côté route** (`if (!equipment_id && (!name || !damage_formula))`, aucun CHECK DB — un futur bug de
route pourrait insérer une ligne invalide sans barrière). Retenu pour `exo_systems`/`exo_weapons`/
`exo_programs` : **CHECK en base pour les trois**, pas un mirror aveugle de cette incohérence.
**Permission — vérifiée, pas juste recopiée** : `exoIsGmOrOwnerOrPilot` réutilisée sur les 3 familles
de routes sans barrière économique (aucun jet d'achat/disponibilité), **cohérent avec le précédent
drone** (`drone_weapons`/`drone_programs` n'en ont pas non plus) — pas un trou nouveau introduit par
l'exo, mais nommé explicitement plutôt que hérité en silence (même discipline que la permission
retenue au Lot A).

#### 13.4.3 Systèmes auxiliaires et Armement — mirror `drone_weapons` + extension Intégrité par ligne

**Portée de ce Lot** : la fiche (liste, édition, catalogue) — **pas** la résolution combat d'une exo
qui tire (§12.2 point 3, toujours non tranché, pipeline distinct à construire séparément). Une arme
listée ici est une donnée de fiche, pas encore un système attaquable en combat.

`exo_systems` : `id`, `character_id`, `equipment_id` FK `ref_exo_equipment` nullable
(`family='systeme'`), `label_override`, `level` integer nullable (RAW : certains systèmes se
facturent "X/niv." jusqu'à `ref_exo_equipment.max_level` — niveau choisi à l'achat, pas dérivé ;
`null` pour un système à niveau fixe déjà porté par `name`/`description` du catalogue, §12.1bis point
5), `integrite_max`/`integrite_current` integer (**nouveau, absent du patron drone** — point 2
ci-dessus), `sort_order`.

`exo_weapons` : même forme, `equipment_id` FK `ref_exo_equipment` (`family='arme'`), `label_override`,
`integrite_max`/`integrite_current`, `sort_order`. **Volontairement pas** de `ammo_restant`/
`contenance_chargeur` (contrairement à `drone_weapons`) — aucun mécanisme de tir/rechargement exo
n'existe encore (§12.2 point 3) ; ajouter ces colonnes maintenant anticiperait une mécanique de combat
non conçue. Portée/dégâts/mode de tir restent sur `ref_exo_equipment` (catalogue), pas dupliqués par
ligne — une arme custom hors catalogue (`equipment_id NULL`) reste possible via `label_override` +
`description` libre, sans les champs riches (`damage`/`range`/etc.) que seul un `equipment_id`
valide fournit — cohérent avec le principe "catalogue = donnée structurée, custom = texte libre"
déjà appliqué à `drone_weapons`.

Même contrainte CHECK `equipment_id IS NOT NULL OR label_override IS NOT NULL` sur les deux tables
(discipline retenue ci-dessus §13.4.2, pas un mirror de l'incohérence drone). Routes
`POST/PUT/DELETE /:characterId/exo/systems[/:id]` et `/:characterId/exo/weapons[/:id]` — mirror
`char-sheet.js:1760-1912` (armes drone), permission `exoIsGmOrOwnerOrPilot` (même vérification qu'au
§13.4.2 — cohérent avec le précédent drone, pas de barrière économique).

**Hardpoints — pas de contrainte de capacité modélisée.** RAW mentionne les hardpoints comme lieu de
montage narratif ("armes montées sur les hardpoints", `MANUEL_EXOARMURE.md`), mais aucun nombre de
slots par template n'apparaît sur la fiche officielle (`FDEA.webp`, bloc "Informations sur l'Armure" —
pas de champ "nb hardpoints"). Décision : `exo_weapons`/`exo_systems` restent des listes libres, sans
plafond de capacité — cohérent avec ce que la fiche réelle donne à voir, pas une mécanique RAW
retirée par oubli.

**Angle mort assumé pour Lot 5 (pas à corriger ici)** : les colonnes jsonb retirées
(`isolated_systems`/`damaged_systems`) portaient l'intention "un système peut être isolé/en panne
suite à un incident" (Lot 5c/5d/5e). `integrite_current` sur `exo_systems`/`exo_weapons` couvre la
perte de points, mais pas forcément un état binaire "isolé du circuit" (RAW p.328, Générateur) —
probable qu'une colonne `is_isolated`/statut dédiée soit nécessaire quand le Lot 5 sera conçu. Pas
ajoutée maintenant : sa forme exacte dépend de mécaniques pas encore instruites, ajouter une colonne à
l'aveugle recréerait le même défaut que les jsonb "posés par anticipation" du Lot 1. Une migration
future l'ajoutera quand le Lot 5 sera réellement détaillé.

**Migrations pour ce Lot — schéma et seed séparés**, même discipline déjà appliquée à
`ref_exo_equipment` (251 schéma / 252 modèles / 253 équipement, §12.4) plutôt qu'un seul fichier
géant : une migration schéma (crée `exo_systems`/`exo_weapons`/`exo_programs`/
`ref_exo_template_equipment`/`exo_computers`/`ref_exo_template_computers` (les deux dernières, révision
2026-08-21 §13.4.1 — remplace l'idée initiale de colonnes `ordinateur_*` sur `exo_sheet`/
`ref_exo_templates`), retire `equipped_systems`/`hardpoints`/`isolated_systems`/`damaged_systems`),
une migration seed séparée pour les ~200-300 lignes de `ref_exo_template_equipment`/
`ref_exo_template_computers` transcrites (§13.4.4 — volume qui justifie à lui seul la séparation).
`ref_exo_template_equipment.template_id`/`ref_exo_template_computers.template_id` : `ON DELETE CASCADE`
(une ligne de loadout n'a aucun sens sans son template, contrairement à `exo_sheet.template_id` qui
reste `SET NULL` — une exo-armure existe indépendamment de son modèle d'origine, pas une ligne de
loadout catalogue).

**Corrigé — "colonnes mortes, jamais lues par aucun code" était faux, jamais vérifié côté écriture
(analyse à charge 2026-08-20).** `vaultService.js:51-68` (`cloneExoSheet`, clonage Vault d'une
exo-armure) écrit explicitement `damaged_systems: '{}'` à chaque clonage — supprimer la colonne sans
toucher ce fichier casse le tout premier clonage d'exo-armure après déploiement (`column
damaged_systems does not exist`). **`vaultService.js` rejoint donc la liste des fichiers touchés par
ce Lot**, trois changements :
1. Retirer la ligne `damaged_systems: '{}'` de `cloneExoSheet` (colonne supprimée).
2. **Plus grave, sans rapport avec les jsonb** : `COMPANION_REGISTRY.exo.characterKeyed` (`:118-127`)
   vaut `[]` aujourd'hui — un garde-fou anti-dérive existant (`assertRegistryUpToDate`,
   `vaultCloneRegistry.test.mjs`) fait échouer `cloneCharacterDeep` en 500 pour **tout type de
   personnage** si une table avec FK vers `characters` n'est ni enregistrée ni exclue. Les 4
   nouvelles tables character_id-keyed doivent y être ajoutées (`['exo_systems', 'exo_weapons',
   'exo_programs', 'exo_computers']` — révisé 2026-08-21, `exo_computers` inclus depuis §13.4.1),
   même mécanisme générique déjà éprouvé pour le drone (`:115`,
   `['drone_sheet', 'drone_programs', 'drone_weapons']`) — sinon ce Lot casse le clonage Vault de
   n'importe quel personnage à son déploiement, pas seulement d'une exo.
3. **Cohérence, pas obligation technique — étendue par la révision 2026-08-21** : `cloneExoSheet`
   remet déjà `itg_structure/exosquelette/generator_current` à leur max au clonage ("un export reste un
   modèle réutilisable, pas un instantané endommagé"). `exo_systems`/`exo_weapons`/`exo_computers`
   passent par le `characterKeyed`/`cloneRows` générique (point 2 ci-dessus), qui copie
   `integrite_current` tel quel — un export endommagé resterait endommagé dans le Coffre, contraire à
   la même philosophie. `cloneExoSheet` (l'`onClone` de l'entrée `exo`) s'exécute **après** la boucle
   `characterKeyed` (`cloneCharacterDeep`, ordre déjà vérifié dans le code) — lui ajouter un
   `UPDATE exo_systems/exo_weapons/exo_computers SET integrite_current = integrite_max WHERE
   character_id = newCharacterId` en fin de fonction couvre les 3 tables sans toucher au mécanisme
   générique ni dupliquer la logique de remise à neuf.

**Client** : nouvelles sections dans `ExoSheetWindow.jsx` (`systems`/`computer` déjà dans
`SHEET_SECTIONS`, retirés de la boucle stub comme `avaries` au Lot A) — `ExoSystemsPanel.jsx`,
`ExoWeaponsPanel.jsx` (ou fusionnés en un seul si la fiche RAW les groupe visuellement — à revoir),
`ExoComputerPanel.jsx`. Précédent direct `DroneWeaponPanel.jsx` à lire avant de coder (jamais fait à ce
jour, seulement cité comme référence).

**Hors périmètre explicite** : résolution combat d'une exo-attaquante (§12.2 point 3), formule de
dégâts à escalade (§12.2 point 1), statut isolé/en panne (ci-dessus, Lot 5). Changer de modèle en plein
combat (loadout remplacé sous une action en cours) — non concerné aujourd'hui, aucun pipeline combat
ne lit encore `exo_weapons` (§12.2 point 3 toujours ouvert), mais à surveiller le jour où ce pipeline
sera construit.

**Validation prévue** : `shared/computerStats.js` testé unitairement contre les exemples chiffrés
RAW (Gén V/NT III → coût 7500, programmes niv. max 11, 25 systèmes, 40 niveaux de programmes — exemple
littéral du texte, p.280). Migration testée up/down/re-up. Tests routes (patron `drone_programs`/
`drone_weapons` existants). `node --check`, build+lint client. Scénario réel navigateur par Saar.

#### 13.4.4 Loadout par défaut — `ref_exo_template_equipment` (tranché par Saar, 2026-08-20)

**Décision** : "armement et armes sont des paramètres d'usine. Modifiable mais pré-made (cf. les
modèles RAW)" — répond à §12.2 point 2, resté ouvert depuis la première ébauche du catalogue
(2026-08-19). Même philosophie que le Lot B (§13.3) : le modèle pré-remplit au moment de la sélection,
l'instance possède ensuite et peut librement diverger — jamais une dépendance live relue en combat.

**Nouvelle table `ref_exo_template_equipment`** (migration de ce Lot, aux côtés de
`exo_systems`/`exo_weapons`/`exo_programs`) : `id`, `template_id` FK `ref_exo_templates`,
`family` (CHECK `'arme'|'systeme'`, miroir `ref_exo_equipment`), `equipment_id` FK `ref_exo_equipment`
nullable, `label_override` text nullable (même CHECK `equipment_id IS NOT NULL OR label_override IS
NOT NULL` que les 3 tables sœurs, §13.4.2 — **nécessaire ici en particulier** : l'ambiguïté trouvée le
2026-08-19 sur les analyseurs sonscan de niveau identique, sans discriminant fiable dans le texte
source, se résout par `label_override` plutôt que par une FK devinée), `level` integer nullable
(même sémantique "niveau acheté" que `exo_systems.level`), `sort_order`. L'Ordinateur n'y transite pas
— `ref_exo_template_computers` (§13.4.1, révision 2026-08-21) est sa propre table, pas une ligne
`family` supplémentaire ici : contrairement à `exo_systems`/`exo_weapons`, une ligne Ordinateur porte
`gen`/`nt` (deux entiers), pas un `equipment_id`/`label_override` — forme de données différente, table
différente plutôt qu'un `family IN ('arme','systeme','ordinateur')` avec des colonnes qui ne
s'appliqueraient qu'à un seul des trois cas.

**`applyExoTemplate` étendu (§13.3)** : après la copie des champs de base, insère une ligne
`exo_systems`/`exo_weapons` par ligne `ref_exo_template_equipment` du template sélectionné —
`integrite_current = integrite_max` (état neuf), niveau copié tel quel — **et une ligne `exo_computers`
par ligne `ref_exo_template_computers`** (§13.4.1, même transaction, Intégrité tirée via `parseDice`
plutôt que copiée). Changer de modèle réapplique la même logique d'écrasement complet déjà actée pour
les champs de base (§13.3) : les `exo_systems`/`exo_weapons`/`exo_computers` existants de l'instance
sont remplacés par le loadout d'usine du nouveau modèle, pas fusionnés — cohérence avec la règle déjà
posée, pas une règle séparée à inventer pour le loadout.

**Reste réellement à faire, taille non négligeable** : transcrire les loadouts complets des 16
armures depuis `docs/REGLES/SEEDEXO.md` (10 à 25 lignes par armure selon §12.3) — travail de
transcription explicitement différé en 2026-08-19 ("nécessite sa propre session, pas un enchaînement
immédiat"), maintenant confirmé nécessaire plutôt qu'optionnel. Pas une seed triviale : chaque ligne
demande de retrouver la bonne entrée `ref_exo_equipment` (ou de trancher un `label_override` pour les
cas ambigus type "Analyseur sonscan niv. 12"), sur les ~200-300 lignes cumulées des 16 loadouts —
session de transcription dédiée à prévoir, pas un sous-produit du reste du Lot C.

**Même migration seed — une ligne `ref_exo_template_computers` par ordinateur trouvé dans le texte
source, pas un backfill de colonnes** (révisé 2026-08-21, §13.4.1 : plus de colonnes `ordinateur_*` sur
`ref_exo_templates` à remplir a posteriori — la table `ref_exo_template_computers` n'existe qu'à partir
de cette migration, donc aucune ligne héritée à corriger, juste la transcription normale). Point de
vigilance qui remplace l'ancien risque de backfill silencieux : **12 des 16 armures ont une seule ligne
(role='principal'), 4 en ont deux (Nymph 1-A, Heimdall-Pyrelia, Odin, Moloch — role='principal' +
role='secours', §13.4.1)** — vérifier ce compte exact pendant la transcription plutôt que supposer une
ligne par armure par défaut, sous peine de perdre silencieusement les 4 ordinateurs de secours de la
même façon que l'aurait fait l'ancien schéma scalaire.

**Hors périmètre encore** : reste après cette décision, toujours pas tranché — la formule de dégâts à
escalade (§12.2 point 1) et le pipeline exo-attaquant (§12.2 point 3), aucun lien avec le loadout par
défaut lui-même.

**Validation prévue (ajout)** : test de la cascade `applyExoTemplate` (sélection d'un modèle avec
loadout → `exo_systems`/`exo_weapons` peuplés correctement, changement de modèle → ancien loadout
entièrement remplacé), vérification manuelle d'un échantillon de loadouts transcrits contre
`SEEDEXO.md` ligne à ligne (pas juste les totaux).
