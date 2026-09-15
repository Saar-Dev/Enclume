# PLAN_KIWI_BASCULE — Bascule `vtt` → `enclumeBD` sur le serveur distant (Kiwi)

> Créé 2026-09-05. PLAN temporaire (RegleDocumentaire.md Règle 10) — archivé/supprimé une fois la
> bascule terminée et validée, contenu durable remonté dans `docs/SERVEURDISTANTKIWI.md`.
> Décision Saar : stratégie **A — bascule vers base neuve + report des données réelles**
> (voir `docs/SYSTEME/CORE.md` P57, `docs/SERVEURDISTANTKIWI.md` P-SRV-12).

## Contexte (résumé de la session BETA-40)

- Le chantier `PLAN_MIGRATIONS_REFONTE.md` (2026-08-22) a créé une base neuve locale `enclumeBD`
  (310 fichiers de migration consolidés) et repointé `.env` **local** dessus. `vtt` locale conservée
  intacte, jamais retouchée.
- **Ce repointage n'a jamais été fait sur Kiwi.** Confirmé 2026-09-05 :
  - `.env` distant : `DATABASE_URL=...@localhost:5432/vtt`.
  - `enclumeBD` **n'existe pas** dans le conteneur Postgres de Kiwi (`\l` : postgres, template0/1,
    vtt, vtt_codex, vtt_fusion — rien d'autre).
  - `vtt` distant : 229 lignes dans `knex_migrations`, la dernière étant
    `265_seed_exo_template_loadout.js` — un fichier **archivé** par la refonte (absent du dossier
    `migrations/` actif depuis). `vtt` distant s'arrête donc exactement à la frontière juste avant la
    refonte.
  - Le code sur disque de Kiwi est pourtant à jour (`git log` confirme un commit récent, largement
    postérieur à la refonte). Conclusion : **le process `enclume-server` n'a pas redémarré depuis
    avant le 22/08** — `git pull` a mis à jour les fichiers, mais sans redémarrage `db.migrate.latest()`
    n'a plus jamais tourné. C'est la cause commune du bug déclencheur (onglet Joueurs de la Config
    campagne, `BETA-40` — route absente du process encore actif) et de tout le reste : aucune
    fonctionnalité serveur ajoutée depuis 3 semaines n'est réellement active sur Kiwi.
- **Vérification en attente (Saar)** : `sudo systemctl status enclume-server` — la ligne
  `Active: ... since <date>` doit confirmer un uptime antérieur au 22/08.

## Danger à éviter absolument

**Ne jamais redémarrer `enclume-server` sur Kiwi tant que ce plan n'est pas terminé.** Un redémarrage
non préparé déclencherait `db.migrate.latest()` avec les 310+ fichiers actuels contre `vtt`, qui a déjà
tout ce schéma sous les anciens noms de migration — collision quasi certaine dès la première création
de table, sur des données de production réelles (comptes, campagnes, personnages de joueurs actifs).

## Invariant transversal

**`vtt` distant n'est jamais écrit, à aucune phase.** Uniquement lu (dump/export). Le filet de sécurité
absolu reste : si tout échoue, `vtt` est intacte, il suffit de ne rien changer côté `.env`/service.

## Phases

### Phase 0 — Filet de sécurité (bloquant, à faire en premier, aucun risque)
- Saar : `pg_dump` complet de `vtt` distant, horodaté, copié hors du serveur (poste local ou autre
  stockage). Retour arrière absolu, indépendant de tout ce qui suit.
- Statut : **à faire**.

### Phase 1 — Créer `enclumeBD` neuve sur Kiwi et vérifier qu'elle migre proprement
- Aucun contact avec `vtt` — une base neuve et vide dans le même conteneur Postgres.
- `CREATE DATABASE "enclumeBD";` (même conteneur, même rôle `vtt`).
- Rejouer `migrate.latest()` contre **cette base neuve uniquement**, via un `DATABASE_URL` temporaire
  (jamais celui de `.env` de prod à ce stade) — reproduit ce qui a déjà été validé en local (310+
  fichiers sur base vierge, testé et documenté `JOURNAL8.md` 2026-08-22).
- Lancer les seeds de référence (`ref_equipment` etc., voir `SERVEURDISTANTKIWI.md` §Seeds) —
  identique à une première install.
- Critère de passage à la Phase 2 : `enclumeBD` sur Kiwi migre et se seed sans erreur, schéma
  identique à `enclumeBD` locale (vérification `information_schema` si doute).
- Statut : **à faire**.

### Phase 2 — Classer les tables : catalogue (déjà bon dans `enclumeBD`) vs données réelles (à porter)
- 30 tables ont un fichier `NNN_table_seed.js` (`ref_*` + `bug_tickets`) — leur contenu dans
  `enclumeBD` fait déjà foi (audité une fois le 22/08), **ne pas** les écraser avec la version `vtt`
  de Kiwi. Exception à trancher : `bug_tickets` — le seed local vient du `vtt` **local**, pas de celui
  de Kiwi ; les tickets réels de Kiwi (s'il y en a eu créés depuis une install locale de l'outil sur ce
  serveur — à vérifier, peu probable) seraient perdus sinon.
- Toutes les autres tables (~80, `users`, `campaigns`, `campaign_members`, `characters`, `char_sheet`
  et ses tables filles, `char_inventory*`, `battlemaps`, `chat_messages`, `dice_rolls`,
  `combat_*`, `vault_*`, etc.) sont des données réelles à porter depuis `vtt` distant.
- Pour chaque table à porter : vérifier que son schéma dans `enclumeBD` (après 310 + ~50 migrations
  post-refonte) est un sur-ensemble compatible de celui de `vtt` — colonnes ajoutées nullables ou avec
  défaut (jamais une colonne supprimée/renommée qui casserait un import direct). Audit réel
  (`information_schema.columns` des deux côtés), jamais supposé — même discipline que P-SRV-11.
- Repérer aussi les migrations post-265 qui sont des correctifs empilés sur une table existante plutôt
  que la forme `NNN_table.js`/`NNN_table_seed.js` (ex. `combat_action_targets_damage_modifier_nullable`,
  `fix_ammo_effects_darts_762_556`, `campaigns_current_battlemap_id` déjà repérées) — matière à la
  question de consolidation posée par Saar, à trancher une fois ce classement fait.
- Statut : **à faire**.

### Phase 3 — Script de report des données réelles (testé sur copie jetable d'abord)
- Un script qui lit `vtt` (lecture seule) et écrit dans une **copie jetable** de `enclumeBD` Kiwi,
  table par table dans l'ordre des FK, préserve les UUID existants (contrairement aux tables
  catalogue), réinitialise les séquences si besoin.
- Validation sur la copie avant tout geste sur la vraie `enclumeBD` : comptage de lignes par table
  (`vtt` vs copie portée), spot-check sur quelques personnages/campagnes réels.
- Statut : **à faire** (dépend de la Phase 2).

### Phase 4 — Bascule finale
- Une fois la Phase 3 validée sur copie : rejouer le report sur la vraie `enclumeBD` de Kiwi.
- Repointer `.env` de Kiwi sur `enclumeBD`.
- **Seul moment où le service est interrompu** : `sudo systemctl restart enclume-server
  enclume-client`.
- Vérification post-bascule : connexion d'un vrai joueur, ouverture d'une fiche personnage, onglet
  Joueurs de la Config campagne (bug déclencheur `BETA-40`).
- Statut : **à faire** (dépend de la Phase 3).

## Ce qui reste hors périmètre de ce plan

- La question de consolider les migrations post-265 (une table = une création + un seed) — dépend du
  classement fait en Phase 2, tranchée à ce moment-là, pas avant.
- Toute décision sur `dev/monde`/`integration` (autres dépôts `codex` sur le même serveur physique,
  `docs/WORKFLOW_FUSION.md`) — hors périmètre, bases Postgres distinctes (`vtt_codex`, `vtt_fusion`).
