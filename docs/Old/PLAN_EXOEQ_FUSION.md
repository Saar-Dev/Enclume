# PLAN_EXOEQ_FUSION — Fusion ref_exo_equipment → ref_equipment

> Statut (2026-08-22, mis à jour — HANDOFF) : **Lot A et Lot B faits et validés, réellement testés
> deux fois (base vide ET clone de `vtt`).** Exécution du Lot C volontairement **non faite par cet
> agent** — décision explicite de Saar après plusieurs dérives de méthode dans cette session
> (stratégie changée en cours de route sans comparer les options d'abord, cf.
> `feedback_present_strategy_options_before_executing` en mémoire) : documenter intégralement et
> passer la main à un autre agent/une autre session pour l'exécution réelle. Ce n'est pas un problème
> de fond avec le plan lui-même — le contenu (migrations 266-275, code consommateur) est fait, testé,
> vert des deux façons. C'est un choix de sécurité sur qui appuie sur le bouton.
>
> **Stratégie Lot C définitivement tranchée avec Saar (2026-08-22, à lire avant toute exécution)** :
> PAS de clone de `vtt` (`vtt_lotc_staging`, testé puis abandonné — voir §8bis pour la raison : cloner
> l'état actuel ne nettoie que le cluster exo, laisse les ~250 autres migrations telles quelles, ce
> n'est pas ce que Saar veut). À la place : **base neuve, construite uniquement en rejouant les
> fichiers de migration actuels** (`db.migrate.latest()` sur une base vide — déjà validé, 322/323,
> voir §8ter) — `vtt` n'est **jamais** touchée, ni clonée, ni modifiée. **Aucune donnée de `vtt`
> recopiée** (confirmé par Saar : les comptes/personnages de test ne comptent pas) — **seule
> exception : le compte admin `d.lebosse@protonmail.com`**, à recréer manuellement sur la nouvelle
> base (inscription normale + redémarrage pour la promotion automatique, `bootstrapAdmin.js` — détail
> §8ter, ce mécanisme ne CRÉE pas de compte, il ne fait que PROMOUVOIR un compte déjà inscrit).
>
> Rédigé 2026-08-22 (Claude, sur demande explicite de Saar, suite EXOEQ-FUSION1 `EN_COURS.md`).
> Règle 10 (`RegleDocumentaire.md`) : ce PLAN est temporaire — à la clôture, retiré ou archivé, tout
> invariant durable qui en résulte va dans `docs/SYSTEME/CORE.md` ou une règle domaine.
> Méthode réutilisée telle quelle depuis `PLAN_MIGRATIONS_REFONTE.md` (Lot A/B/C, déjà validée sur le
> cluster `ref_equipment`) — pas réinventée pour ce chantier.

---

## 1. Déclencheur et décision

Ticket `EXOEQ-FUSION1` (`EN_COURS.md`) rouvert par Saar (2026-08-22) suite au bug INV7/INV1 : décision
de nettoyer la totalité du cluster migrations, exo compris, plutôt que d'empiler un énième correctif.
Décisions actées avec Saar avant ce plan :
- Fusion complète, pas un lien de plus par-dessus l'existant.
- Catalogue exo exposé à tout marchand par défaut — comportement voulu, pas une fuite à corriger
  (confirmé : `tradeService.getCatalog` fait déjà `select('*') from ref_equipment` sans filtre de
  famille, filtrable ensuite par règle FAM si un GM veut restreindre un marchand précis — rien à coder
  côté marchand, déjà générique).
- Réécrire le cluster de migrations exo (251→265) sous sa forme finale plutôt que fusionner puis
  re-nettoyer séparément — même discipline que Phase 1 `PLAN_MIGRATIONS_REFONTE.md`.

---

## 2. Correction au ticket d'origine (audit fait, pas supposé)

Le ticket citait `tech_level` "III-IV"/"Selon NT" comme obstacle bloquant. Vérifié ligne à ligne
(migrations 251/253/261/264) : **"III-IV" n'existe pas dans `ref_exo_equipment`** — c'est une valeur de
`ref_exo_templates` (les 16 armures complètes, table distincte, hors périmètre de cette fusion : elle a
des dizaines de colonnes propres — EXF/Blindage/vitesses/profondeurs — sans équivalent dans
`ref_equipment`, fusionner ferait perdre le sens de "modèle d'armure").

Dans `ref_exo_equipment` (la vraie cible), les ~95 lignes réelles n'ont que deux formes de
`tech_level` :
- Chiffre romain (`'II'`, `'III'`, `'IV'`, `'V'`) sur ~93 lignes → correspond exactement à l'échelle
  1-7 de `ref_equipment.tech_level`.
- `'Selon NT'` sur exactement 2 lignes (`Dispositif d'auto-réparation • Centrale`/`Module annexe`) —
  valeur contextuelle (dépend du système réparé), formule déjà entièrement écrite dans `description`.

**Conclusion** : conversion triviale pour 93/95 lignes, NULL assumé pour 2 lignes — pas l'obstacle
bloquant décrit à l'origine.

---

## 3. Ce qui a changé depuis la rédaction du ticket (08-08 → 21/22-08)

Le ticket ignorait un développement plus récent : migrations 257/260/262 ont construit un **exclusive
arc** délibéré et sourcé (`exo_systems`/`exo_weapons`/`ref_exo_template_equipment` référencent SOIT
`ref_exo_equipment` (`equipment_id`) SOIT `ref_equipment` (`ref_equipment_id`) SOIT un texte libre
(`label_override`), jamais deux à la fois) — précisément pour éviter de dupliquer dans le catalogue
exo une arme/un senseur déjà présent dans le catalogue général. La fusion ne rend pas ce mécanisme
obsolète sans remplacement : elle le **simplifie** (plus qu'une seule vraie source catalogue possible,
donc une seule FK au lieu de deux + CHECK d'exclusivité) — mais ça veut dire réécrire ces 3 tables, pas
seulement `ref_exo_equipment`.

---

## 4. Périmètre exact — fichiers concernés

**Migrations à réécrire sous forme finale** (251, 252, 253, 254, 255, 257, 258, 260, 261, 262, 263,
264, 265 — 13 fichiers ; 233/243/249/250/256/259 touchent le même dossier mais des tables hors
périmètre de cette fusion précise, à vérifier au cas par cas en Lot A s'ils dépendent d'une des tables
réécrites) :
- `ref_exo_equipment` (251/253/261/264) — **supprimée**, ses ~95 lignes deviennent des lignes
  `ref_equipment` neuves.
- `ref_exo_templates` (252) — **inchangée**, hors périmètre (voir §2).
- `exo_sheet`/`exo_computers`/`ref_exo_template_computers` (233/243/254/255/257/258) —
  **inchangées sur le fond**, réécrites seulement si leur position dans la chaîne dépend d'un numéro
  de migration touché.
- `exo_systems`/`exo_weapons`/`ref_exo_template_equipment` (257/260/262) — colonne `equipment_id`
  retirée, `ref_equipment_id` devient la seule FK, CHECK d'exclusivité simplifié à 2 branches.

**Code serveur consommateur** (`server/src/routes/character/char-sheet.js`) :
- `selectExoSystemFields`/`selectExoWeaponFields` (lignes ~2163-2188) : un seul `leftJoin('ref_equipment', ...)`,
  `COALESCE` réduit à `label_override`/`ref_equipment.*` (plus de double source).
- `validateExoEquipmentSource` (ligne ~2198) : 2 branches au lieu de 3 (`ref_equipment_id`/`label_override`).
- Les 2 routes `POST /exo/systems`/`POST /exo/weapons` (validation catalogue) : un seul lookup
  `ref_equipment`, filtré par la nouvelle valeur de `family` (§6) au lieu de deux blocs `if`.

**Route à supprimer** : `server/src/routes/exoEquipment.js` (`GET /api/exo-equipment`) — plus de
catalogue séparé, `GET /api/equipment?family=...` suffit (route déjà existante, `equipment.js`).

**`server/src/lib/exoTemplateService.js`** (`applyExoTemplate`, ~ligne 103-128) : copie déjà
`row.ref_equipment_id` en plus de `row.equipment_id` — un seul champ à copier après la fusion, pas de
changement de logique, juste retrait de la branche morte.

**Client** :
- `ExoSystemsPanel.jsx`/`ExoWeaponsPanel.jsx` : actuellement 2 appels réseau (`GET /exo-equipment` +
  `GET /equipment`) + un sélecteur de "mode" (catalogue exo vs catalogue général) qui décide quel champ
  remplir. Après fusion : un seul `GET /equipment?family=...`, le sélecteur de mode disparaît ou devient
  un simple filtre visuel (garder le regroupement visuel "Systèmes dédiés" / "Équipement général" dans
  l'UI est un choix, pas une obligation — décision à trancher avec Saar en Lot A, pas dans ce plan).

---

## 5. Schéma `ref_equipment` — deltas nécessaires

Vérifié colonne par colonne contre `48_ref_equipment.js` (schéma final déjà consolidé, Phase 1) :
`price`/`price_modifier`/`max_level`/`shock`/`range`/`init_mod`/`fire_mode`/`ammo_cost`/`rarity`
existent déjà avec un type compatible — **aucun changement**. Deux deltas réels :

1. **Nouvelle colonne `duration` (string, nullable)** — capacité des Supports vitaux (ex. "Réserve
   d'oxygène" = 24h), aucun équivalent existant, ne concerne que les lignes exo.
2. **`tech_level` : `NOT NULL` → nullable.** Aujourd'hui chaque ligne `ref_equipment` a une valeur
   fixe garantie ; les 2 lignes "Selon NT" introduisent un cas légitime où ce n'est pas vrai
   (dépend d'un autre système au moment de l'usage). Relâcher la contrainte plutôt qu'inventer une
   valeur arbitraire pour ces 2 lignes — **à confirmer explicitement avec Saar**, c'est un
   assouplissement d'une garantie qui existait pour tout le reste du catalogue jusqu'ici.
3. **Dommages arme** : `ref_exo_equipment.damage` → `ref_equipment.damage_h` (déjà le mapping utilisé
   par le COALESCE actuel de `char-sheet.js`, confirmé, pas une nouvelle décision) ; pas d'équivalent
   `damage_v_low`/`damage_v_high` pour les armes exo (aucune ligne exo n'en a besoin).

---

## 6. Décision à trancher — valeurs `family`

`ref_equipment.family` n'a pas de CHECK (texte libre), mais porte déjà une taxonomie French
capitalisée cohérente (`'Armes'`, `'Armures'`, `'Equipement Général'`...). `ref_exo_equipment.family`
est aujourd'hui binaire (`'arme'`/`'systeme'`), utilisé par les routes serveur pour valider qu'un
`equipment_id` posté correspond au bon type. Pour préserver cette validation sans ambiguïté :

**Proposition : deux valeurs distinctes, `'Exo-arme'` et `'Exo-systeme'`** (au lieu d'une seule
`'Exo-armure'` suggérée par le ticket d'origine, qui perdrait la distinction binaire déjà exploitée par
le code). `category` (déjà riche : "Systèmes de contrôle", "Arme de contact", "Torpilles et
missiles"...) reste la sous-classification fine, inchangée. **À valider par Saar avant Lot A** — pur
choix de nommage, aucun impact structurel si changé.

---

## 7. Point bloquant pour Lot A — à confirmer par Saar (pas de session DB dans cet agent)

**Existe-t-il aujourd'hui un personnage réel avec des lignes `exo_systems`/`exo_weapons` déjà
équipées ?** Tout indique que non (`EN_COURS.md` : "aucune exo-armure réelle en jeu à ce jour",
validation navigateur jamais faite sur ce Lot) — si confirmé, la fusion n'a **aucune donnée
personnage à migrer**, seulement du catalogue/loadout (`ref_exo_template_equipment`, régénéré
directement sous sa forme finale, pas de reconciliation d'`id` nécessaire). Si un personnage de test a
au contraire déjà équipé quelque chose, il faut une étape de plus (répointer ses lignes vers les
nouveaux `id` `ref_equipment` par correspondance de nom) — à trancher avant d'écrire Lot A, pas après.

`id` des nouvelles lignes `ref_equipment` : suivre le même principe déjà appliqué à `48b_ref_equipment_data.js`
(id explicites, pas `gen_random_uuid()`) — corrige la même classe de risque que SEED-ID-DETERM pour ce
cluster aussi, pas seulement pour l'ancien.

---

## 8. Méthode d'exécution (reprise de PLAN_MIGRATIONS_REFONTE.md §5, appliquée à ce périmètre)

- **Lot A0** : serveur local arrêté avant toute écriture de fichier (nodemon).
- **Lot A** : écriture des migrations finales (schéma + données), rapport de couverture avant toute
  application — inclut la table de conversion tech_level ligne par ligne, présentée à Saar avant
  d'être figée.
- **Lot B1/B2** : base PostgreSQL jetable, jamais `vtt` locale — diff structurel puis données, suite
  serveur `node --test` rejouée dessus.
- **Lot C** : sauvegarde de la base locale, archivage (pas suppression) des anciens fichiers,
  réconciliation `knex_migrations` vérifiée avant/après. Distant en confirmation secondaire seulement
  (rappel §-note ajoutée `SERVEURDISTANTKIWI.md` 2026-08-22 : tout redémarrage du service applique les
  migrations pending, pas seulement un `git pull` volontaire — ne jamais pousser ce commit avant Lot B
  validé en entier).

### 8bis. Piste abandonnée — clone + réconciliation en place (pour mémoire, ne pas reprendre)

Une première approche a été testée et validée techniquement (clone exact de `vtt`, script de
réconciliation ponctuel, 2 exécutions indépendantes vertes, 323/323 tests, données réelles
préservées) — puis **abandonnée sur décision de Saar**, pas pour une raison technique : cloner l'état
actuel de `vtt` ne fait que rapiécer le cluster exo par-dessus un historique de ~250 autres migrations
laissées telles quelles (patch-sur-patch). Ce n'est pas ce que "une table = une migration" visait.
Script (`server/src/db/lotc_exoeq_fusion_reconcile.mjs`) supprimé — gardé nulle part, ne pas le
recréer sans qu'une future session ait une vraie raison d'y revenir.

### 8ter. Lot C — procédure retenue : base neuve depuis les fichiers de migration seuls

**Déjà validé** (avant même l'exploration du clone, §8bis) : `db.migrate.latest()` rejoué sur une
base PostgreSQL strictement vide, avec l'état ACTUEL du dossier `server/src/db/migrations/` (9
anciennes migrations exo archivées, 266-275 nouvelles) réussit intégralement — 275 fichiers
appliqués (moins 244-246, mortes de longue date, contournement déjà documenté
`SERVEURDISTANTKIWI.md` P-SRV-11), 322/323 tests serveur (le seul échec, `creationRoundTrip.test.mjs`,
dépend d'un `id` de carrière qui n'existe que sur `vtt` — normal sur une base neuve, PC49
`EN_COURS.md`, sans rapport avec cette fusion). C'est cette voie-là qui est retenue, pas le clone.

**Procédure pour l'agent qui exécute** (à faire sur une base neuve, jamais sur `vtt`) :
1. Vérifier `server/src/db/migrations/` correspond bien à l'état laissé par cette session (266-275
   présentes, les 9 anciennes archivées dans `migrations_archive/`) — `git status`/`git log` avant
   tout, au cas où d'autres commits seraient arrivés entre-temps.
2. Créer la nouvelle base PostgreSQL (nom à choisir avec Saar — pas `vtt`, ne pas écraser l'existante).
3. `DATABASE_URL` de l'environnement pointé sur cette nouvelle base, lancer le serveur normalement
   (`db.migrate.latest()` tourne au démarrage, `index.js:161`) — ou `node --env-file=.. -e "..."`
   équivalent si un démarrage complet n'est pas souhaité tout de suite.
4. Vérifier : `ref_equipment` porte 112 lignes `family IN ('Exo-systeme','Exo-arme')`,
   `ref_exo_template_equipment`/`_computers` portent 410/21 lignes, `ref_exo_equipment` n'existe plus.
5. **Compte admin** — `bootstrapAdminFromEnv()` (`server/src/lib/bootstrapAdmin.js`) tourne aussi au
   démarrage mais **ne crée jamais de compte**, il ne fait que PROMOUVOIR un compte déjà inscrit
   correspondant à `ADMIN_BOOTSTRAP_EMAIL` (`.env`, `d.lebosse@protonmail.com`) — sur une base neuve
   sans ce compte, il se contente d'avertir en log, rien d'autre. Séquence correcte : inscription
   normale via l'UI (code d'inscription `REGISTRATION_CODE`, `.env`) avec cet email, PUIS redémarrage
   du serveur pour que la promotion admin s'applique.
6. Suite serveur complète (`node --test`) contre cette base avant de considérer le chantier clos.
7. Une fois confirmé par Saar en usage réel : `.env` de l'environnement de travail habituel repointé
   sur cette nouvelle base de façon durable ; `vtt` reste disponible, jamais supprimée, jusqu'à
   décision explicite contraire.

---

## 9. Hors périmètre de ce plan

- `ref_exo_templates` (16 armures complètes) et son propre `tech_level` texte — pas concerné (§2).
- Reste du projet migrations (Phase 2 `PLAN_MIGRATIONS_REFONTE.md`) — chantier séparé, différé.
- Décision UI fine (garder ou non le regroupement visuel "Systèmes dédiés"/"Équipement général" dans
  `ExoSystemsPanel.jsx`) — tranchée en Lot A avec Saar, pas figée ici.
