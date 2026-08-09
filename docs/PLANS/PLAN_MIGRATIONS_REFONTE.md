# PLAN_MIGRATIONS_REFONTE — Consolidation du système de migrations

> Statut : plan soumis à validation, **aucun fichier de migration touché, aucune base modifiée**.
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

## 5bis. Phase 2 — le reste du projet (différée, hors scope immédiat)

~217 migrations, ~85 tables restantes (liste complète en annexe §9), aucun défaut connu à ce jour.
Reprend la même méthode (`migra` + audit + validation séquencée sur base jetable + sauvegarde avant
réconciliation) une fois la Phase 1 validée et le bug fermé. Motivation indépendante et déjà valable
en soi : le projet dépasse le seuil de ~200 migrations où la doc pro recommande de simplifier le
setup d'un environnement neuf (§ Sources). Non détaillée lot par lot ici tant qu'elle n'est pas
engagée — sera un ajout à ce document ou un nouveau PLAN dédié, au choix de Saar le moment venu.

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
