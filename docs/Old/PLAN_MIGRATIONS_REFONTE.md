# PLAN_MIGRATIONS_REFONTE — Consolidation du système de migrations

> Statut (2026-08-22) : Phase 1 faite et vérifiée. **Phase 2 engagée** (§5bis) — objectif reformulé par
> Saar : la totalité du projet (~260 migrations), pas seulement `ref_equipment`, une création + un
> seed par table, nouvelle base, `vtt` jamais touchée. Audit table par table des données de référence
> en cours, décisions actées consignées en §5bis. **Aucun fichier de migration touché, aucune base
> de travail (`vtt`) modifiée** — travail fait sur une base jetable séparée (`enclume_squash_check`).
> Rédigé 2026-08-08 (Claude, sur demande explicite de Saar après l'incident migration 135/distant).
> Règle 10 (`RegleDocumentaire.md`) : ce PLAN est temporaire — à la clôture, retiré ou archivé, tout
> invariant durable qui en résulte va dans `docs/SYSTEME/CORE.md` ou une règle domaine, jamais laissé
> ici comme référence permanente.

> **Contre-revue à charge (2026-08-08, Claude, demandée par Saar)** : 7 lacunes corrigées ci-dessous —
> le plus grave, un risque de répéter l'incident nodemon de ce soir à plus grande échelle (§5 Lot A),
> une confiance non vérifiée dans les données locales comme "vérité" (§5 Lot A), le découpage
> schéma→fichiers présenté comme trivial alors qu'il ne l'est pas (§4/§5), la réconciliation
> `knex_migrations` locale sous-documentée pour l'opération la plus risquée du plan (§5 Lot C), schéma
> et données validés en un seul bloc plutôt que séquencés (§5), le serveur distant présenté comme le
> test principal plutôt qu'une confirmation secondaire (§5 Lot C), et une reformulation factuelle de
> §1 (le correctif ciblé n'a jamais été testé jusqu'à l'échec — Saar a choisi d'arrêter avant, ce n'est
> pas un échec technique constaté).

> **Contre-revue à charge — passe 2 (2026-08-08, Claude, demandée par Saar — "bonnes pratiques pros,
> dépôts GitHub inspirants, jamais coder de zéro")** : le §4 initial proposait d'écrire un script
> maison pour découper le `pg_dump` en fichiers par table — exactement le genre de réinvention que
> Saar demandait d'éviter. Recherche approfondie (Atlas/ariga, migra/migradiff) : ce que Saar décrit
> ("un fichier par table = sa définition actuelle") est le pattern de gestion de schéma
> **déclarative** ("Terraform pour bases de données"), pas les migrations incrémentales classiques.
> Décision : utiliser `migra`/`migradiff` (outil expert de diff de schéma Postgres) pour générer le
> SQL de schéma, plutôt qu'un parseur écrit à la main — corrige le risque §4/§6 "découpage sous-estimé"
> avec un vrai outil au lieu d'une mitigation procédurale. Atlas (déclaratif complet, remplacerait Knex
> pour toute la gestion de schéma) écarté pour l'usage **permanent** — binaire Go, et le serveur
> distant a déjà planté deux fois sur des binaires exigeant `x86-64-v2` (MinIO, Claude Code lui-même,
> `P-SRV-8`) — mais retenu comme piste future si l'hébergement change, pas fermé définitivement. Ce
> risque ne s'applique pas à `migra` utilisé une seule fois en local : le livrable reste des
> migrations Knex/JS classiques, le distant ne exécute jamais l'outil de génération lui-même.

> **Contre-revue à charge — passe 3 (2026-08-08, Claude, demandée par Saar)** : vérification
> exhaustive (pas supposée) du périmètre réel du défaut. `server/src/db/seeds/` ne contient
> **qu'un seul** script hors chaîne (`2_seed_equipment.js`) — toutes les autres données de référence
> (`ref_careers`, `ref_mutations`, `ref_skills`, `ref_backgrounds`, `ref_setbacks`) sont déjà seedées
> **dans** la chaîne de migrations (95, 98, 113/114/116, 126), donc déjà saines. Recherche exhaustive
> des migrations dépendantes : **135, 141, 142, 160, 168, 178, 184, 190, 209, 235** (10, pas "au moins
> 5") référencent `ref_equipment` par `name`/`id` en supposant la donnée déjà présente — toutes
> corrigées par le même correctif racine. Découverte en marge : **la migration 160 utilise des `id`
> codés en dur** (`ITEM_IDS`), le même défaut que la 209 (SEED-ID-DETERM), jamais corrigé jusqu'ici —
> résolu par la même refonte plutôt que consigné séparément au registre de bugs, puisqu'elle touche
> exactement le périmètre retravaillé. **Conclusion** : le défaut est confiné à `ref_equipment` (table
> unique) + ses 10 migrations dépendantes, pas aux ~90 tables/235 migrations du projet. Reconstruire
> l'intégralité du système de migrations pour corriger un défaut localisé à une table est
> disproportionné — discuté avec Saar, découpage retenu en deux phases séquentielles (§5) : Phase 1
> (`ref_equipment`, ce chantier, maintenant) et Phase 2 (le reste du projet, chantier séparé différé,
> même méthode déjà conçue ici, réutilisée sans pression de délai).

> **Contre-revue à charge — passe 4 (2026-08-08, Claude, demandée par Saar)** : le compte "10
> migrations" de la passe 3 était **incomplet** — recherche limitée aux dépendances de *données*
> (`.where({name...})`), pas aux modifications de *schéma* (`alterTable`). Deux migrations manquantes
> trouvées (**87**, **182** — ajoutent les colonnes `generation`/`mod_key`) : laissées en place, elles
> auraient tenté un `ADD COLUMN` sur une colonne déjà présente dans le schéma final capturé par
> `migra`, provoquant le **même type d'échec que l'incident 135 de ce soir**, découvert seulement au
> Lot B1 ou pire sur le distant. Recherche élargie à toute mention de `ref_equipment` (26 fichiers,
> classés un par un, pas un filtre approximatif) : liste complète et définitive du périmètre Phase 1 —
> **48, 53, 73, 75, 76d, 83, 87, 135, 141, 142, 160, 168, 178, 182, 184, 190, 209, 235** (18 fichiers).
> Deux ajouts significatifs :
> - **53 et 75** dépendent aussi de `ref_equipment` peuplé, mais avec un garde `if (!row) return`
>   silencieux au lieu d'un `throw` — sur un install neuf, elles ne plantent pas, elles ne font **rien**
>   (doublons de munitions jamais nettoyés, sans avertissement). Même cause racine que le reste, symptôme
>   différent — renforce le diagnostic, ne le remet pas en cause.
> - **73, 76d, 83** insèrent/modifient déjà des lignes `ref_equipment` (catalogue logiciels drone)
>   **depuis l'intérieur** de la chaîne de migrations (pas concernées par le défaut source), mais leurs
>   lignes seront de toute façon capturées par le snapshot du Lot A — les laisser actives dupliquerait
>   ces lignes en silence (`ref_equipment.name` n'a pas de contrainte UNIQUE) une fois la Phase 1 en
>   place. À archiver avec les autres.
> Conséquence méthodologique : une recherche manuelle par motif, refaite trois fois, a raté des fichiers
> deux fois de suite. Le Lot A intègre désormais une **vérification scriptée** de complétude (pas un
> grep ponctuel) avant toute génération.

---

## 1. Déclencheur

Bug "module Arme KO" (serveur distant) tracé à une cause plus profonde qu'un champ isolé
(`ref_equipment.location`) : le projet mélange deux philosophies de gestion des données de
référence sans jamais l'avoir décidé consciemment.

- Un seed hors chaîne (`server/src/db/seeds/2_seed_equipment.js`), lancé manuellement, à un moment
  arbitraire de l'historique — **seul cas dans tout le projet** (vérifié, pas supposé — voir passe 3).
- 18 migrations touchent le schéma ou les données de `ref_equipment*` (48, 53, 73, 75, 76d, 83, 87,
  135, 141, 142, 160, 168, 178, 182, 184, 190, 209, 235 — liste définitive, voir passe 4) : certaines
  supposent la donnée déjà présente et plantent (135, 209) ou échouent silencieusement (53, 75) sur un
  install neuf ; d'autres modifient le schéma en place (87, 182) ou insèrent leurs propres données
  (73, 76d, 83) et seraient dupliquées/en conflit une fois la Phase 1 posée. Aucune autre table du
  projet n'a ce défaut.

Tenté ce soir : correctif ciblé (migration 235 backfill + générateur). A permis de fermer le trou
`location`/`caliber` sur les données déjà en base, et a révélé le vrai problème en tentant un rebuild
complet du serveur distant : migration 135 plante sur base vierge, chaîne cassée dès le premier
install propre jamais tenté. Un correctif ponctuel (relancer le seed puis reprendre les migrations
à partir de la 135) a été proposé mais **jamais exécuté ni testé jusqu'à l'échec** — Saar a choisi
d'arrêter avant de le tenter et de partir sur une refonte complète. C'est une décision stratégique,
pas un échec technique constaté ; ce document ne prétend pas le contraire.

**Décision Saar : pas de nouveau correctif ponctuel — refonte complète.**

---

## 2. Cause racine (confirmée, pas hypothèse)

Deux patterns industriels valides existent et sont documentés :

- **Pattern Rails/Knex** : migrations = structure uniquement ; un seed séparé peuple les données,
  lancé une fois après toutes les migrations, aucune migration ne référence une donnée de seed.
- **Pattern Flyway** : données de référence ET schéma sont dans la **même** chaîne versionnée — pas
  de seed séparé du tout.

Ce projet applique le premier pattern pour le seed initial et glisse vers le second pour toute
correction ultérieure (135, 160, 168, 209, 235), sans jamais avoir tranché. Le mélange, pas l'un ou
l'autre pattern pris seul, est la cause racine. Confirmé par recherche (sources en fin de document).

---

## 3. Objectif

Un jeu de migrations qui, rejoué de zéro sur une base strictement vide, reproduit exactement l'état
actuel de l'instance locale (schéma + données de référence curées) — testable, déterministe, sans
étape manuelle ni ordre implicite. Fin de la distinction "seed" vs "migration" pour tout ce qui est
référencé par une autre migration : un seul système, une seule vérité.

**Deux phases, même méthode, urgence différente** (décision Saar, passe 3) :
- **Phase 1 — `ref_equipment` seul** : périmètre exact du défaut confirmé (18 migrations concernées,
  4 tables du même cluster). Corrige le bug déclencheur (module Arme). Exécutée maintenant.
- **Phase 2 — le reste du projet** (~85 tables, ~217 migrations restantes) : aucun défaut connu à ce
  jour, mais bénéficie du même objectif "une seule vérité par table" et du seuil des 200+ migrations
  où la doc pro recommande de simplifier (§ Sources). Chantier séparé, différé, repris avec la méthode
  ci-dessous une fois la Phase 1 validée et le bug fermé — pas détaillé lot par lot dans ce document
  tant qu'il n'est pas engagé.

---

## 4. Méthode retenue — et pourquoi pas une autre (Phase 1, périmètre `ref_equipment`)

**Rejetée : fusionner/nettoyer les 10 fichiers de migration concernés à la main.** Les outils de
squash automatiques sont documentés comme peu fiables sur les projets de taille moyenne (échouent à
optimiser, cassent des migrations — retour d'expérience Django cité en source). Même à l'échelle
réduite de 10 fichiers, dont l'intention exacte n'est pas toujours ré-auditable (certains corrigent
des corrections antérieures, ex. 209 sur 178), une fusion manuelle reste propice à l'erreur
silencieuse.

**Retenue : snapshot de l'état réel de la base locale, limité au cluster `ref_equipment`** (source de
vérité confirmée fonctionnelle pour ce périmètre), pas relecture du code historique des migrations.
Tables concernées : `ref_equipment`, `ref_equipment_skills`, `ref_equipment_skill_assoc`,
`ref_equipment_ammo_compat` — les 4 tables de référence touchées par les 18 migrations identifiées.
Aucune autre table (y compris `char_inventory_mods`, qui référence `ref_equipment` mais contient des
données de personnage, pas du catalogue) n'entre dans ce périmètre.

- Schéma : `pg_dump --schema-only` sur l'instance locale → capture la définition **actuelle et
  vraie** de chaque table, indépendamment de combien de migrations l'ont fait évoluer et dans quel
  ordre. Élimine le risque de rejouer une logique de migration obsolète ou contradictoire.
- Données de référence : `pg_dump --data-only` ciblé sur les 4 tables du cluster `ref_equipment`
  (pas tous les `ref_*` du projet — hors périmètre Phase 1) → capture les valeurs **curées et
  confirmées fonctionnelles** (celles qui ont justifié ce chantier), pas l'extraction Excel d'origine
  (déjà prouvée incomplète/désynchronisée ce soir : 155 lignes locales absentes de la source, 284
  écarts de valeur).
- Découpage en fichiers : un fichier par table pour le schéma (demande explicite de Saar), regroupé
  par domaine fonctionnel dans la numérotation pour respecter l'ordre des clés étrangères (ex. `users`
  avant `campaigns` avant `characters` avant `char_inventory`) — même contrainte d'ordre qu'aujourd'hui,
  juste un seul fichier définitif par table au lieu de N correctifs dispersés dans le temps.
  **Généré via `migra`/`migradiff`** (outil expert de diff de schéma Postgres — compare une base vide
  et la base locale actuelle, produit le SQL exact incluant tables, contraintes, index, vues,
  séquences, extensions), pas un parseur maison du `pg_dump` brut. `pg_dump --schema-only` seul
  produit un script cohérent où les contraintes FK sont souvent ajoutées après coup en fin de fichier
  (`ALTER TABLE ... ADD CONSTRAINT`), précisément pour éviter les problèmes d'ordre circulaire —
  re-découper ça à la main aurait été le point le plus fragile du chantier ; `migra` fait ce travail
  de diff de façon éprouvée, le découpage en fichiers par table reste une étape mécanique simple
  par-dessus sa sortie.
- Vues, séquences, extensions : couvertes nativement par `migra` (diff de schéma complet — tables,
  vues, fonctions, index, contraintes, séquences, extensions), pas seulement les tables. Inventaire de
  sortie vérifié en Lot A avant découpage.
- Phase 1 : 4 tables → au plus 4 fichiers de schéma + 1 fichier de données de catalogue (ou fusionnés
  si plus lisible ainsi, à trancher en Lot A). Le reste du projet (~85 tables, liste complète en
  annexe §9) est hors périmètre de cette phase — la question "un fichier par table strict, ou
  regroupement par domaine (ex. `combat_*`)" ne se pose que pour la Phase 2, à trancher le moment venu.

---

## 5. Étapes proposées — Phase 1 (`ref_equipment`, maintenant)

Lots séquentiels, validation entre chaque. Périmètre : 4 tables, 18 migrations existantes concernées
(48, 53, 73, 75, 76d, 83, 87, 135, 141, 142, 160, 168, 178, 182, 184, 190, 209, 235) + le seed
`2_seed_equipment.js` — liste définitive, voir contre-revue passe 4.

### Lot A0 — Précondition obligatoire, avant tout écriture de fichier
**Arrêter le serveur local (nodemon)** avant d'écrire le moindre fichier dans
`server/src/db/migrations/`. Vécu ce soir (incident `20260714`, P53 `EN_COURS.md`) : nodemon
auto-applique toute migration dès son écriture sur disque, sans attendre une exécution volontaire.
Périmètre réduit (quelques fichiers, pas 90) donc risque plus petit qu'envisagé initialement, mais
reste un prérequis bloquant — ce n'est pas une option.

### Lot A — Snapshot, audit et génération (lecture seule sur la base locale, aucune écriture destructive)
0. **Prérequis** : `migra`/`migradiff` disponible en local (paquet Python — usage ponctuel, jamais
   déployé sur le distant). Vérifier l'installation avant de commencer ; sinon l'installer (pip/pipx),
   scope limité à la machine locale de Saar.
1. `migra` entre une base Postgres vide et l'instance locale actuelle, **filtré aux 4 tables du
   cluster `ref_equipment`** → SQL de schéma complet (tables, contraintes, index), généré par un outil
   éprouvé plutôt que déduit à la main d'un `pg_dump` brut.
2. `pg_dump --data-only --table=ref_equipment --table=ref_equipment_skills
   --table=ref_equipment_skill_assoc --table=ref_equipment_ammo_compat` → données de catalogue
   (`migra` est un outil de schéma, pas de données — pas d'équivalent pour cette partie).
3. **Audit avant confiance** : revue explicite des 4 tables avant de les figer comme vérité
   définitive — au minimum `ref_equipment_skill_assoc`, dont la migration 135 documente elle-même des
   lignes issues de "tests manuels ponctuels via l'admin API, jamais reliées à la donnée source". Tout
   résidu de test identifié est signalé à Saar avant d'être inclus ou exclu, jamais figé
   silencieusement par le dump. `ref_equipment` lui-même déjà audité ce soir (`location`/`caliber`).
4. **Vérification scriptée de complétude** (pas un grep manuel refait à la main — un grep manuel a
   raté 87/182 puis 53/73/75/76d/83 lors de l'analyse de ce plan, deux fois de suite). Script qui liste
   tout fichier de `server/src/db/migrations/` contenant `ref_equipment`, `ref_equipment_skills`,
   `ref_equipment_skill_assoc` ou `ref_equipment_ammo_compat` sous une forme autre qu'une déclaration
   de clé étrangère simple (`.references('id').inTable(...)`), et échoue explicitement si un fichier
   trouvé n'est pas dans la liste des 18 déjà identifiées — garde-fou avant toute génération, pas une
   confirmation a posteriori.
5. Découpage de la sortie `migra` (schéma) et du dump de données en fichiers de migration — au plus un
   par table (4 + 1 données), fusionnables si plus lisible ainsi vu le petit nombre.
6. Rapport de couverture : lignes de données, différences avec les 18 migrations actuelles concernées,
   résultat des audits des points 3 et 4 — **présenté avant toute écriture de fichier**.

### Lot B1 — Validation schéma seul (base de test jetable, jamais la base locale ni distante)
1. Nouvelle base PostgreSQL vide (conteneur/DB jetable, jamais `vtt` locale).
2. Rejouer les migrations de schéma des 4 tables `ref_equipment*` **plus toutes les migrations
   antérieures nécessaires** (le cluster a des FK vers d'autres tables déjà existantes à ce point de
   la chaîne — ex. `char_inventory_mods` référence `ref_equipment`) : soit rejouer les migrations
   1-234 existantes jusqu'au point d'insertion puis les 4 nouvelles, soit isoler un sous-ensemble
   minimal de dépendances — à confirmer au moment de générer (Lot A, point 5).
3. Diff structurel complet contre le schéma local actuel pour ces 4 tables (colonnes, types,
   contraintes, index — pas seulement "les tables existent").

### Lot B2 — Validation données de référence (même base jetable, après B1 validé)
1. Rejouer les migrations de données générées au Lot A sur la base issue de B1.
2. Diff exhaustif des données des 4 tables contre la base locale (pas un sondage).
3. Tests serveur existants (`node --test`) contre cette base reconstruite, en particulier tout test
   touchant l'équipement/inventaire/armes.

### Lot C — Bascule
1. **Sauvegarde complète de la base locale** (`pg_dump` full, fichier daté, conservé) avant toute
   opération sur `knex_migrations` local — la base locale est la seule instance non jetable de tout ce
   chantier, elle doit être récupérable si la réconciliation suivante se passe mal.
2. Archivage (pas suppression) des **18 migrations concernées** (48, 53, 73, 75, 76d, 83, 87, 135,
   141, 142, 160, 168, 178, 182, 184, 190, 209, 235) + `2_seed_equipment.js` vers un dossier hors
   chaîne active (ex. `server/src/db/migrations_archive/`), retirés du scan Knex. Les ~217 autres
   migrations restent intactes, à leur place actuelle — Phase 1 ne les touche pas. Le script de
   vérification du Lot A (point 4) sert aussi ici de garde-fou final avant l'archivage.
3. Nouveaux fichiers déposés dans `server/src/db/migrations/`, numérotés pour prendre la place
   libérée (probablement autour de la position de la 48, qui crée `ref_equipment` — à confirmer selon
   la structure retenue en Lot A).
4. Réconciliation `knex_migrations` sur l'instance locale (marquer les nouvelles migrations comme déjà
   appliquées sans les rejouer, retirer les 18 anciennes entrées). Étape la plus risquée du plan pour
   la seule instance qui compte vraiment — core.md (P54) prévient explicitement contre ce type de
   manipulation manuelle sans vérification préalable : vérifier le contenu exact de `knex_migrations`
   avant ET après, comparer au dry-run effectué en Lot B, jamais improvisé en direct.
5. Serveur distant (déjà rasé ce soir, jetable, confirmé par Saar) : **confirmation secondaire**, pas
   le test principal — la validation rigoureuse est le Lot B (itération rapide, base jetable). Le
   distant sert à vérifier qu'un vrai réseau/déploiement fonctionne, avec le coût d'itération plus
   lent (aller-retours SSH) déjà observé ce soir — pas présenté comme la preuve de fond du système.

### Lot D — Nettoyage et documentation
1. Retrait de `generate-catalog-migration.js` et `equipmentMapping.js` si leur rôle est absorbé par
   le nouveau système (à confirmer — pourraient rester utiles pour de futures corrections catalogue
   avant qu'elles ne soient, elles aussi, versionnées).
2. Mise à jour `docs/SYSTEME/CORE.md` (ou création si absent) : invariant durable "toute donnée de
   référence référencée par une autre migration vit dans la chaîne de migrations, jamais dans un seed
   hors chaîne" — pour que ce mélange ne se reproduise jamais, sur `ref_equipment` ou ailleurs.
3. Mise à jour `SERVEURDISTANTKIWI.md` (procédure de déploiement, déjà obsolète sur ce point).

---

## 5bis. Phase 2 — le reste du projet (ENGAGÉE, 2026-08-22)

> Engagée sur demande explicite de Saar (2026-08-22), qui reformule l'objectif en clair : la
> totalité des ~260 migrations (Phase 1 + `PLAN_EXOEQ_FUSION.md` comprises) devient, table par table,
> **une migration de création + une migration de seed, point.** Nouvelle base (`vtt` jamais touchée,
> jamais reclonée), seules les données de référence sont conservées — aucune donnée jouée (comptes,
> personnages, parties), à l'exception du compte admin `d.lebosse@protonmail.com` recréé à part.
> Priorité explicite de Saar pour tout ce chantier : qualité et sûreté avant vitesse, aucune limite de
> temps, vérifier même quand ça ne trouve rien — repris ci-dessous à chaque étape.

### Inventaire réel (2026-08-22, scripté, pas estimé)

230 fichiers de migration actifs (hors `migrations_archive`) touchent ~92 tables. Répartition très
inégale : `campaigns` (38 fichiers), `battlemaps` (25), `characters`/`ref_careers` (24),
`users`/`char_sheet` (21)... jusqu'à 1 seul fichier pour la majorité des tables. La quasi-totalité de
ces fichiers sont des `ALTER TABLE ADD COLUMN` d'évolution normale (pas le bug ref_equipment de la
Phase 1) — `migra` absorbe cette évolution en une seule passe de diff, peu importe le nombre de
fichiers historiques par table. Le vrai travail manuel ne porte que sur les tables de **référence**
(catalogues `ref_*` + textures), où les données doivent être auditées avant d'être figées en seed.

### Méthode affinée (corrige une hypothèse initiale invalidée par l'audit ci-dessous)

Idée initiale : utiliser un rejeu complet des migrations (base neuve, zéro intervention manuelle)
comme unique source de vérité pour les données de référence — plus fiable que `vtt` (vivante,
modifiable à la main via l'admin), donc a priori non contaminée. **Invalidée par la vérification
réelle** : `vtt` contient des corrections faites à la main (admin UI ou édition directe) jamais
reportées dans une migration. Un squash aveugle depuis le rejeu seul aurait donc **effacé en silence**
des corrections réelles. Méthode retenue : pour chaque table de référence, comparer explicitement
`vtt` (vivante) contre un rejeu neuf, résoudre les FK vers des clés stables (`code`/`name`, pas les
`id` UUID aléatoires, cf. `SEED-ID-DETERM`) pour ne pas se faire piéger par les `id` qui changent à
chaque rejeu, et trancher au cas par cas — jamais figer une table sans cet audit.

### Vérifications faites (2026-08-22)

- Aucune extension Postgres exotique, aucune fonction/trigger, une seule vue (`char_mutation_effects_view`,
  déjà patchée par 3 migrations successives 96/109/127/128 — capturée dans sa forme finale par `migra`).
  PostgreSQL 16.13, `gen_random_uuid()` natif (pas besoin de `pgcrypto`).
- `vtt` a bien ses 265 migrations à jour ; les 10 nouvelles EXOEQ (266-275) confirmées **non
  appliquées** dessus (aucune contamination accidentelle malgré leur présence sur disque).
- Base jetable `enclume_squash_check` créée (même instance Postgres que `vtt`, jamais `vtt` elle-même)
  et rejeu complet 1→275 réussi (3 migrations mortes 244-246 neutralisées par le contournement déjà
  documenté `SERVEURDISTANTKIWI.md` P-SRV-11 — aucune table/colonne concernée).
- Audit table par table (comparaison par clé naturelle, `vtt` vivante vs rejeu neuf) sur les ~30
  tables de référence + catalogues de textures. **Résultat : la grande majorité est déjà identique**
  (`ref_careers` et son cluster de 8 tables liées, `ref_mutations`, `ref_backgrounds`, `ref_advantages`,
  `ref_setbacks`, `ref_equipment` hors nouveauté exo, tout le loadout exo `ref_exo_template_*`) — la
  Phase 1 et `PLAN_EXOEQ_FUSION.md` sont bien complètes et cohérentes, et le reste du catalogue de
  règles n'a pas de dérive généralisée. La dérive trouvée est **localisée**, pas systémique.

### Décisions actées avec Saar suite à l'audit (2026-08-22)

| Table | Écart trouvé | Décision |
|---|---|---|
| `ref_skills` | 6 catégories (`MANOEUVRE_DARMURE`, `CONNAISSANCE_MILIEU_NATUREL`, `TACTIQUE`, `LANGUE_ETRANGERE`, `LANGAGES_SPECIFIQUES`, `LANGUE_ANCIENNE`) présentes sur `vtt`, absentes de toute migration | **Gardées** — la version `vtt` fait foi, à écrire dans la migration de seed finale |
| `ref_skills` | ~20 corrections d'orthographe faites à la main sur `vtt` (ex. "Tir automatique"→"Tir automatiques", "Premier soin"→"Premier soins") jamais migrées | **Gardées** — version `vtt` fait foi |
| `ref_skills` | `ARTS_MARTIAUX.marker` = `null` sur `vtt` vs `"(-3)"` dans les migrations d'origine | **Tranché : `null` (pas de -3)** — version `vtt` fait foi |
| `ref_skill_requirements` | Faute de frappe d'origine (`PILOTAGE_NAVIRES_LEGERS` un seul `_`, ne correspond à aucune compétence réelle) corrigée à la main sur `vtt` (`PILOTAGE__NAVIRES_LEGERS`), jamais migrée ; + 1 ligne entière (`MAITRISE_DE_LA_FORCE_POLARIS`) ajoutée à la main, absente de toute migration | **Présumé : version `vtt` fait foi** (même principe que les 3 lignes ci-dessus, pas explicitement reconfirmé par Saar — à re-vérifier avant d'écrire le fichier final) |
| Catalogue textures (`texture_packs`/`texture_pack_categories`/`voxel_textures`) | Pack "structure-station" présent en migration absent de `vtt` ; renommage "texture-5-baril-explosif"/"texture-5-baril-2" incohérent entre les deux | **Ce catalogue n'est PAS importé du tout** dans la nouvelle base — décision Saar, hors périmètre de la consolidation |
| `ref_exo_templates.illustration_url` | Fichier binaire uploadé en direct sur `vtt`, aucune migration ne peut le reproduire | **Noté, hors SQL** — ré-upload manuel à prévoir séparément au moment de la bascule, pas un défaut de méthode |

### Outillage validé (2026-08-22)

`migradiff` installé (fork maintenu — pas l'original `migra` déprécié, corrigé après une première
installation erronée) + `psycopg2-binary` (driver manquant). Testé sur le schéma complet du projet
(`enclume_empty_check` vs `enclume_squash_check`, 99 tables) : diff propre, 2988 lignes, tables +
séquences + contraintes + vue capturées correctement. Structure de sortie confirmée en 4 vagues
strictement séparées, jamais entrelacées table par table : (1) séquences + `CREATE TABLE` nu (aucune
table ne dépend d'une autre à ce stade, ordre alphabétique, aucun tri topologique nécessaire),
(2) `CREATE INDEX`, (3) `ALTER TABLE ADD CONSTRAINT` (PK/UNIQUE/CHECK puis les 165 FK, une fois que
toutes les tables existent), (4) vues. Décision : reprendre cette structure telle quelle pour le
découpage plutôt que de forcer "table + ses propres FK" dans un seul fichier (qui aurait exigé un tri
topologique manuel sur 92 tables — risque inutile que l'outil a déjà évité).

### Points trouvés en analyse à charge avant découpage — tranchés avec Saar (2026-08-22)

| Point | Problème | Décision |
|---|---|---|
| `knex_migrations`/`knex_migrations_lock` | Présentes dans le dump (Knex les crée lui-même dans la base de rejeu) — une migration qui les recréerait entrerait en conflit avec le bootstrap Knex de la nouvelle base | **Exclues** du découpage, jamais générées comme fichier de migration |
| Séquences Postgres (6 tables : `chat_messages`, `pending_catastrophes`, `ref_mutation_subtypes`, `ref_mutations`, `token_statuses`, `voxel_textures`) | Seules `ref_mutations`/`ref_mutation_subtypes` reçoivent un seed à `id` explicite — sans `setval()`, la première vraie insertion entrerait en collision | Migration de seed de ces 2 tables **se termine par un `setval()`** avançant la séquence après le dernier `id` inséré |
| Découpage par table : structure vs contraintes | Un fichier unique "table + ses FK" exigerait un tri topologique manuel sur 92 tables | **Confirmé (Saar)** : un fichier de structure (colonnes) + un fichier de contraintes/index (après que toutes les tables existent) par table, plus un fichier de seed pour les tables de référence — 3 vagues distinctes, toujours "une création + un seed" dans l'esprit |
| `battlemap_texture_usage.voxel_texture_id` et `entity_blueprints.pack_id` référencent `voxel_textures`/`texture_packs` (catalogue exclu) | Sans ces tables, les 2 FK échouent (cible inexistante) | **Confirmé (Saar), option (a)** : `texture_packs`/`texture_pack_categories`/`voxel_textures` sont créées (structure seule, vides) pour garder l'intégrité référentielle de ces 2 tables — aucune donnée de catalogue importée |

### Génération du schéma — faite et vérifiée (2026-08-22)

Numérotation tranchée seul (pas reposée à Saar après refus explicite d'un questionnaire structuré sur
ce point — voir mémoire `feedback_no_questionnaire`) : renumérotation fraîche à partir de 1, le dossier
entier étant remplacé d'un coup (pas un remplacement partiel comme Phase 1/EXOEQ) — pattern standard
des outils pro de squash (Rails/Django/Prisma, § Sources).

Script de découpage écrit et **validé par un vrai cycle up→rollback→re-up** (pas seulement une
génération visuelle), d'abord sur un échantillon de 9 tables choisies pour couvrir les cas difficiles,
puis sur les 97 tables réelles (281 fichiers). Trois bugs réels trouvés et corrigés par ce test, aucun
deviné :
1. **Tri alphabétique par défaut de Knex** ("10_x" avant "2_y") casse l'ordre pour plus de 9 fichiers —
   confirme la nécessité du `NaturalMigrationSource` déjà en place dans `knexfile.cjs` (tri numérique),
   pas un défaut à corriger, juste à ne pas oublier dans les scripts de test.
2. **Dépendance circulaire réelle trouvée** : `campaigns.default_battlemap_id` → `battlemaps.id` ET
   `battlemaps.campaign_id` → `campaigns.id`. Un fichier "table + ses propres contraintes" ne peut pas
   être sûr ici quel que soit l'ordre des fichiers. Corrigé en séparant la vague 2 (index +
   contraintes PK/UNIQUE/CHECK, par table) de la vague 3 (clés étrangères, par table, strictement
   après que TOUTES les vagues 2 de TOUTES les tables soient passées) — mirroring exact de ce que
   `migra` fait déjà lui-même en un seul dump (indexes → PK/UNIQUE/CHECK → FK, jamais mélangé table
   par table).
3. **Séquences non marquées `OWNED BY`** dans les fichiers générés — `DROP TABLE ... CASCADE` ne
   supprimait pas la séquence associée, un rollback puis re-application entrait en collision
   ("relation already exists"). Corrigé : chaque fichier de structure inclut désormais l'instruction
   `ALTER SEQUENCE ... OWNED BY` retrouvée dans le dump source.

**Vérification finale** : `migra` entre `enclume_squash_check` (rejeu des 275 anciennes migrations) et
`enclume_full_test` (rejeu des 281 nouveaux fichiers générés) ne montre que deux catégories d'écarts,
aucun réel :
- `knex_migrations`/`knex_migrations_lock` — normal, Knex les crée lui-même, volontairement exclues du
  découpage (cf. tableau ci-dessus).
- 6 contraintes CHECK (`chk_mut_sex`, `chk_mut_fertility`, `chk_mut_subtype`, `chk_eq_fire_mode`,
  `chk_inventory_slots_code`, `chk_ref_setbacks_roll_range`) réapparaissent avec un texte DDL différent
  mais **vérifié sémantiquement identique** (`pg_get_constraintdef` comparé ligne à ligne des deux
  côtés) — un artefact connu de PostgreSQL quand une expression `ANY (ARRAY[...]::type[])` traverse
  deux fois l'imprimante de contraintes de `migra`/Postgres (cast du tableau entier vs cast élément par
  élément, même prédicat, même valeurs autorisées). Confirmé, pas juste supposé.

**État de l'outillage** : script de découpage fonctionnel, 281 fichiers générés dans un dossier de
travail (pas encore dans `server/src/db/migrations/` — en attente de la phase seed avant bascule
réelle), testés up/rollback/re-up sur base jetable dédiée (`enclume_full_test`, jamais `vtt`).

### Seeds écrits et suite complète validée (2026-08-22)

28 migrations de seed générées (une par table de référence), source par table selon la règle établie
avec Saar (§ précédente — `vtt` par défaut, `enclume_squash_check` pour `ref_equipment` et le cluster
`ref_exo_template_*`). Deux bugs réels trouvés et corrigés en testant l'application complète (309
fichiers, schéma + seeds) sur base jetable (`enclume_full_test`), aucun deviné :
1. **`knex('table').insert([])` lève "The query is empty"** — les 2 tables de référence
   actuellement vides (`ref_career_prerequisites`, `ref_equipment_ammo_compat`) faisaient échouer leur
   propre migration de seed. Corrigé : `up()` ne fait rien si 0 ligne, au lieu d'appeler `insert([])`.
2. **Colonnes `jsonb` corrompues** — `ref_genotypes.prereq_professions` (tableau JS relu depuis
   Postgres) réinjecté tel quel via `knex().insert()` produit "invalid input syntax for type json" (le
   driver `pg` sérialise un tableau JS en littéral tableau Postgres, pas en texte JSON). Corrigé :
   toute valeur objet/tableau est re-sérialisée en chaîne JSON avant insertion.
3. **`ref_exo_templates` doit être sourcée depuis `enclume_squash_check`, pas `vtt`** — son `id` est un
   UUID aléatoire (contrairement à `ref_equipment`, dont l'`id` est figé depuis la Phase 1/l'EXOEQ) ;
   le sourcer depuis `vtt` pendant que ses deux tables filles (`ref_exo_template_equipment/computers`)
   restent sourcées depuis le rejeu neuf cassait leur clé étrangère (`id` différents entre les deux
   instances). Coût accepté : `illustration_url` (upload MinIO, non reproductible en SQL) n'est plus
   repris — déjà noté comme un ré-upload manuel séparé, pas une régression nouvelle.

**Validation finale** : les 309 fichiers (281 schéma + 28 seed) appliqués sur une base strictement
neuve — comptages de lignes vérifiés identiques aux attendus (`ref_skills` 249, `ref_careers` 37,
`ref_career_skills` 901, `ref_equipment` 790, `ref_exo_template_equipment` 410...), séquences
`ref_mutations`/`ref_mutation_subtypes` correctement avancées (`setval` vérifié = `max(id)` réel).
**Suite de tests serveur complète (`node --test`) lancée contre cette base neuve : 374/388 passent.**
Les 14 échecs sont **tous, sans exception**, dans `src/db/migrations_archive/` (9 anciens fichiers de
test de l'ancien cluster exo, qui testent l'existence de `ref_exo_equipment` — table supprimée par la
fusion, comportement attendu). **Zéro échec dans l'arbre actif** (`routes`, `services`, `lib`, `admin`,
`chat`, `socket`, `middleware`, migrations actives). Effet de bord positif noté : le test `PC49`
(`creationRoundTrip.test.mjs`, `id` de `ref_careers` codé en dur) passe désormais, puisque `ref_careers`
est semé avec les données et `id` réels de `vtt` plutôt que régénérés aléatoirement — pas un correctif
ciblé, une conséquence de la méthode.

**Point orthogonal trouvé, hors périmètre de ce chantier** : `node --test` (sans argument) parcourt
aussi `migrations_archive/` par défaut et exécute ses `.test.mjs` — comportement déjà présent avant ce
chantier (Phase 1 et EXOEQ ont eu le même archivage), pas causé par ce travail. À signaler séparément
pour une éventuelle exclusion de configuration, pas corrigé ici.

### Lot C — bascule réelle faite (2026-08-22, accord explicite de Saar : "Ok pour transfert")

- **Archivage** : ~250 fichiers actifs déplacés vers `migrations_archive/` (`git mv`, historique
  préservé). Une collision de nom trouvée et résolue : l'ancien `48_ref_equipment.js` (session 46,
  120 lignes, déjà archivé depuis longtemps) et l'actif `48_ref_equipment.js` (consolidé Phase 1, 137
  lignes) portaient le même nom — l'actif renommé `48_ref_equipment_phase1_consolidated.js` en
  l'archivant, aucun contenu perdu. Les 10 fichiers `266-275` de `PLAN_EXOEQ_FUSION.md` (jamais
  committés, jamais appliqués à `vtt`) supprimés plutôt qu'archivés : aucun historique Git à préserver
  pour des brouillons non commités, et entièrement remplacés par le même contenu dans la nouvelle
  numérotation.
- **Dépôt des 309 nouveaux fichiers** dans `server/src/db/migrations/` (281 schéma + 28 seed).
- **Base réelle `enclumeBD` créée** (pas jetable, candidate à devenir la base de travail) — `migrate.latest()`
  appliqué directement depuis le vrai dossier du dépôt (pas une copie de test) : 309/309 fichiers, aucune erreur.
- **Suite de tests complète relancée contre `enclumeBD`** : 393/422 passent. Le delta de fichiers
  découverts par `node --test` par rapport au test précédent (422 vs 388) vient de l'archivage lui-même
  (les `.test.mjs` compagnons des ~250 fichiers archivés sont maintenant, eux aussi, dans
  `migrations_archive/`, que `node --test` parcourt par défaut). **Vérifié explicitement (pas supposé)**
  : les 29 échecs restent confinés aux 8 fichiers déjà connus (`251/253/257/260/261/262/264/265`,
  ancien cluster exo, testent `ref_exo_equipment` — supprimée par la fusion, échec attendu) — zéro
  échec nouveau, zéro échec dans l'arbre actif.
- **Serveur démarré pour de vrai contre `enclumeBD`** (`node src/index.js`, 15s, arrêté proprement) :
  connexion DB OK, `[BOOTSTRAP-ADMIN] Aucun compte "d.lebosse@protonmail.com" trouvé` (attendu — voir
  ci-dessous), catalogue 3D (72 modèles) synchronisé sans erreur malgré le catalogue de textures vide
  (confirme que l'option (a) — tables texture créées vides plutôt que absentes — évite bien tout
  crash), MinIO connecté, migrations à jour.
- **`.env` et `vtt` non touchés** — revérifié après coup : `DATABASE_URL` toujours sur `vtt`,
  `knex_migrations` toujours à 229 lignes.

**Reste, volontairement laissé à Saar** : l'inscription du compte admin elle-même (choix du mot de
passe, geste de compte) — je n'ai pas keyé-frappe cette étape à sa place. Séquence exacte (§8ter déjà
écrit) : démarrer le serveur avec `DATABASE_URL` sur `enclumeBD`, s'inscrire via l'UI normale
(`d.lebosse@protonmail.com`, code `REGISTRATION_CODE` de `.env`), puis redémarrer pour que
`bootstrapAdminFromEnv` promeuve le compte. Une fois confirmé en usage réel : `.env` de travail
repointé durablement sur `enclumeBD`, `vtt` conservée sans suppression.

**Point orthogonal à corriger séparément** : `node --test` par défaut parcourt aussi
`migrations_archive/` — problème amplifié par cet archivage (beaucoup plus de fichiers concernés
qu'avant). Une exclusion de configuration (pas une suppression de fichiers, décision actée avec Saar)
reste à faire, hors périmètre de ce chantier.

### Clôture (2026-08-22)

Compte admin recréé et promu, confirmé en base (`role='admin'`). **Validé par Saar en usage réel.**
`.env` repointé durablement sur `enclumeBD` (revérifié : le serveur démarre normalement dessus sans
variable d'environnement ajoutée). `vtt` conservée, non supprimée.

**Ajout post-bascule (demande explicite de Saar)** : les 57 lignes de `bug_tickets` (suivi de bugs en
base, écran `/admin/tickets`) n'étaient pas dans le périmètre initial des tables de référence — importées
séparément, migration `310_bug_tickets_seed.js`, source `vtt`. Un seul auteur trouvé sur les 57 tickets
(`reporter_id`/`reviewed_by`, un seul id distinct) : le compte admin lui-même — `reporter_id`/`reviewed_by`
remappés de l'ancien id `vtt` vers le nouvel id admin d'`enclumeBD` (même personne, même email), pas
mis à `null`. Appliqué et vérifié : 57/57 lignes, un seul `reporter_id` distinct après remap.

**Phase 1 (`ref_equipment`) et Phase 2 (le reste du projet) sont closes.** Reste, hors du périmètre
migrations : le point orthogonal `node --test`/`migrations_archive` ci-dessus, à traiter séparément.

---

## 6. Risques et mitigations (Phase 1)

| Risque | Mitigation |
|---|---|
| nodemon auto-applique les nouveaux fichiers sur la base locale réelle dès leur écriture (vécu ce soir) | Lot A0 : arrêt du serveur local **avant** toute écriture, prérequis bloquant — impact réduit vs le plan initial (quelques fichiers, pas 90) mais toujours bloquant |
| Données locales figées comme "vérité" sans audit (résidus de test connus, ex. `ref_equipment_skill_assoc`) | Lot A, point 3 : audit explicite avant inclusion, signalé à Saar |
| Découpage schéma→fichiers par table sous-estimé (ordre FK, contraintes ajoutées après coup par `pg_dump`) | Généré par `migra`/`migradiff` (outil expert de diff de schéma), pas un parseur maison ; validé seul en Lot B1 avant d'ajouter les données (Lot B2) |
| Dépendances FK du cluster `ref_equipment` vers des tables hors périmètre (ex. `char_inventory_mods`) compliquent l'isolation en Lot B1 | Signalé explicitement en Lot B1 point 2 — décision de rejouer les migrations antérieures complètes vs isoler un sous-ensemble, à trancher au moment de générer |
| `migra` indisponible/non installable en local (paquet Python) | Prérequis explicite Lot A point 0, vérifié avant toute autre étape — usage ponctuel local uniquement, jamais une dépendance du distant |
| Irréversible une fois basculé (confirmé par la recherche — squash = point de non-retour) | Lot B1/B2 testent sur base jetable AVANT toute bascule réelle ; ancien système archivé, pas supprimé |
| Réconciliation `knex_migrations` locale mal faite (seule instance non jetable) | Lot C, point 1 : sauvegarde complète (`pg_dump`) avant toute manipulation ; vérification du contenu avant/après (leçon P54 core.md) |
| Incohérence entre instances si le squash est fait pendant que local et distant divergent | Distant déjà rasé et jetable (confirmé Saar) — pas d'instance "à mi-chemin" à réconcilier ; sert de confirmation secondaire, pas de validation principale (celle-ci reste le Lot B) |
| Perte de l'historique "pourquoi ce champ a cette valeur" (ex. les commentaires de la migration 135 expliquant les 3 corrections manuelles Saar, ou de la 160 sur les id codés en dur) | Fichiers archivés (pas supprimés) + `git log`/messages de commit restent la source de cet historique, comme pour tout le reste du projet |
| Script de génération lui-même bugué (vécu ce soir avec la numérotation 235) | Rapport de couverture avant écriture (Lot A) + validation séquencée (Lot B1 puis B2) avant toute bascule |
| Phase 2 oubliée/jamais reprise une fois le bug fermé | §5bis conservé dans ce document jusqu'à engagement, pas juste mentionné puis perdu |

---

## 7. Hors périmètre de la Phase 1

- Les ~85 autres tables et ~217 autres migrations — Phase 2 (§5bis), chantier séparé et différé.
- Les 155 lignes de `ref_equipment` présentes en local mais absentes de la source seed actuelle
  (signalé ce soir, jamais creusé) — à traiter séparément une fois le nouveau système en place, pas
  mélangé à cette refonte.
- Toute nouvelle fonctionnalité ou correctif métier — ce chantier est strictement infrastructure de
  migration.

---

## 8. Critères de clôture (Phase 1)

- Lot B1 validé : diff structurel = zéro écart entre schéma reconstruit et schéma local actuel pour
  les 4 tables du cluster `ref_equipment`.
- Lot B2 validé : diff exhaustif = zéro écart entre données reconstruites et base locale actuelle
  (hors résidus de test explicitement exclus lors de l'audit du Lot A).
- Sauvegarde locale (Lot C, point 1) effectuée et vérifiée lisible avant toute réconciliation.
- Serveur distant démarre et sert l'application depuis une base vide + migrations complètes
  (existantes + Phase 1), sans intervention manuelle.
- Module Arme (bug déclencheur) fonctionnel sur le distant reconstruit.
- Testé / Non testé documenté explicitement à la clôture, comme toute tâche du projet.
- Phase 2 reste consignée dans ce document (§5bis) comme chantier ouvert, pas refermée par la
  clôture de la Phase 1.

---

## 9. Annexe — Liste complète des tables du projet (92 objets, capturée lors du `DROP SCHEMA CASCADE`
distant du 2026-08-08) — pour mémoire et pour la Phase 2 ; seules les 4 tables `ref_equipment*` en
gras sont concernées par la Phase 1

users, campaigns, campaign_members, battlemaps, tokens, documents, dice_rolls, walls, legacy_zones,
player_locations, characters, texture_packs, texture_pack_categories, voxel_textures,
battlemap_texture_usage, ref_genotypes, ref_skills, ref_skill_requirements, char_sheet, char_identity,
char_archetype, char_attributes, char_skills, entity_blueprints, entities, polaris_mr,
**ref_equipment**, **ref_equipment_skills**, **ref_equipment_skill_assoc**,
**ref_equipment_ammo_compat**, character_wounds,
char_inventory, combat_state, combat_roster, combat_actions, character_macros, campaign_documents,
token_statuses, drone_sheet, drone_programs, drone_weapons, combat_pending, merchants, trade_log,
trade_offers, ref_advantages, ref_careers, ref_career_skills, ref_career_titles,
ref_career_prerequisites, ref_career_education, ref_career_random_benefits, ref_career_equipment,
ref_career_point_categories, ref_mutations, ref_mutation_subtypes, ref_mutation_skills,
ref_mutation_discounts, ref_mutation_incompatibilities, char_mutations, char_polaris,
char_personal_advantages, char_careers, char_traits, char_pc_ledger, ref_backgrounds,
ref_background_skills, ref_setbacks, char_advantages, char_advantage_notes,
char_mutation_effects_view (vue), vaults, vault_transfer_requests, char_inventory_mods,
world_effect_definitions, world_feature_states, world_effect_instances, world_effect_events,
world_elevator_passengers, char_inventory_slots, combat_timeline_entries, wizard_locks,
battlemap_folders, game_echeances, ref_character_state_values, character_states, chat_messages,
ref_exo_templates, exo_sheet, pending_catastrophes.

---

## Sources (recherche 2026-08-08)

- [Rails Data Migration Best Practices Guide 2026](https://www.railscarma.com/blog/rails-data-migration-best-practices-guide/)
- [Rails Database Migrations Best Practices — FastRuby.io](https://www.fastruby.io/blog/db-migrations-best-practices.html)
- [Flyway (software) — Wikipedia](https://en.wikipedia.org/wiki/Flyway_(software))
- [Migrations — Knex.js official guide](https://knexjs.org/guide/migrations)
- [Knex Migration — For schema and seeds with PostgreSQL](https://medium.com/make-it-heady/knex-migration-for-schema-and-seeds-with-postgresql-700104090f1)
- [When and how to squash migrations — Accreditly](https://accreditly.io/articles/when-and-how-to-squash-migrations)
- [Stop Using Django's squashmigrations: There's a Better Way](https://johnnymetz.com/posts/squash-django-migrations/)
- [Squashing migrations — Prisma Documentation](https://www.prisma.io/docs/orm/prisma-migrate/workflows/squashing-migrations)
- [Atlas — Manage your database schema as code](https://atlasgo.io/)
- [GitHub — ariga/atlas](https://github.com/ariga/atlas)
- [Atlas: Like Terraform, but for Databases](https://atlasgo.io/blog/2024/10/01/terraform-for-database-schemas)
- [GitHub — postgresql-tools/migra (fork actif)](https://github.com/postgresql-tools/migra)
- [Managing Postgres schema changes with Migra](https://ray.cat/writing/managing-postgres-schema-changes-with-migra/)
