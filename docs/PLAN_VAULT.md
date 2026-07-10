# PLAN_VAULT.md — Vault personnel (personnages hors campagne, transférables)
> Rédaction initiale — 2026-07-09. Relecture critique + recherche complémentaire — 2026-07-10.
> Session de planification pure, aucun code écrit.
> Suite d'une discussion libre (hors fichier) sur l'inspiration Roll20 Character Vault.

---

## Objectif

Permettre à un joueur de stocker ses personnages dans un espace **personnel**, indépendant de
toute campagne (aucune carte, aucun GM, aucun autre joueur), et de les faire circuler entre
campagnes sans les recréer à chaque fois.

**Portée de ce plan** : le mécanisme de stockage + transfert de `characters` uniquement.
**Hors scope explicite** (voir section dédiée) : placement du bouton d'accès UI (Dashboard vs
Sidebar PERSOS — tranché par Saar comme "à traiter plus tard, lorsque Vault sera plus complet"),
et tout futur contenu non-personnage du Vault (skins de dés, modèles `.glb`, "boutique" — mentionnés
par Saar comme extensions possibles à terme, mais aucune ne fait partie de ce chantier).

---

## Recherche préalable (2026-07-09) — pourquoi ces décisions

Deux implémentations pro comparées avant de concevoir quoi que ce soit (demande explicite Saar :
ne pas coder de zéro, s'inspirer de l'existant) :

- **Roll20 Character Vault** ([wiki](https://wiki.roll20.net/Character_Vault),
  [forum officiel](https://app.roll20.net/forum/post/11550134/free-transfers-now-available-in-the-character-vault)) :
  le transfert est **une copie, jamais un déplacement** — *"It makes a copy of the character to the
  Vault, so you won't lose your character"*. Import (jeu→Vault) et Export (Vault→jeu) créent chacun
  une nouvelle copie détachée. Le GM active/désactive la fonctionnalité au niveau des réglages de sa
  partie ; pas de validation au cas par cas côté Roll20 (juste un plafond de 3 exports/partie pour
  les comptes gratuits).
- **Foundry VTT Compendium Packs** ([doc officielle](https://foundryvtt.com/article/compendium/),
  [Actors](https://foundryvtt.com/article/actors/)) : même principe — *"once content has been
  imported into a game world it becomes a localized part of that world"*, sans synchronisation
  retour vers la source.

**Conséquence directe sur l'architecture** : un personnage cloné n'a besoin d'aucune purge d'état
runtime (position token, `combat_state`, `trade_offers`...) parce qu'il **démarre une nouvelle ligne
`characters` vierge** dans le contexte cible — zéro table transversale à toucher. C'est ce qui rend
cette approche plus robuste qu'un `UPDATE characters.campaign_id` (déplacement) envisagé dans une
première itération de la réflexion, puis abandonné.

### Recherche complémentaire (2026-07-10) — validation de l'architecture avant codage

Demande explicite Saar : ne pas coder de zéro, s'appuyer sur l'expérience de projets pros, et
s'assurer que l'architecture reste robuste dans la durée (nouvelles tables ajoutées plus tard sans
que personne n'y repense).

- **Comparaison avec la référence la plus mature du problème "dupliquer une fiche + toutes ses
  données liées"** : l'écosystème Ruby on Rails a deux gemmes concurrentes pour exactement ce
  problème — [`amoeba`](https://github.com/amoeba-rb/amoeba) et `deep_cloneable`. Les deux tranchent
  dans le même sens que ce plan : **lister explicitement quoi copier**, jamais une copie "magique"
  qui déduit toute seule la liste par réflexion sur le schéma — cette dernière approche est
  documentée comme fragile dès que les relations se complexifient (cas circulaires, associations
  imbriquées). **Conclusion : l'architecture de ce plan (service avec liste explicite de tables) suit
  la pratique reconnue, pas une improvisation.**
- **Risque résiduel identifié malgré cette validation** : une liste écrite en dur devient fausse avec
  le temps si une nouvelle table `character_id`/`char_sheet_id` est ajoutée plus tard sans que
  `cloneCharacterDeep` soit mis à jour — perte de donnée **silencieuse** (aucune erreur), pas
  seulement théorique dans ce projet (voir historique des dettes `[CS7]`/`MUT2`/P55 : ce type d'oubli
  lors d'une évolution de schéma s'est déjà produit plusieurs fois). **Voir "Garde-fou anti-dérive"
  dans la section Service ci-dessous — c'est la réponse apportée à ce risque.**
- **Audit des colonnes JSONB du sous-arbre `char_sheet`** (`pro_advantages`, `random_picks`,
  `params`, `snapshot_data`, `prereq_professions`, `setback_rolls`...) : aucune n'embarque d'ID
  pointant vers un AUTRE personnage — soit des données narratives/scalaires, soit des ID vers des
  tables de référence communes (`ref_advantages`, `ref_careers`, `ref_skills` — stables, jamais
  dupliquées, donc jamais besoin de réécriture d'ID au clonage). Un clone relationnel simple
  (dupliquer les lignes, réattribuer les nouveaux `character_id`/`char_sheet_id`) suffit — pas besoin
  de remapper des ID à l'intérieur des blobs JSON.
- **Effet de bord trouvé pendant cet audit, hors sujet Vault** : `char_careers.setbacks` (colonne
  JSONB, migration 96, écrite en dur à `[]` par `creationService.js:514`) est un vestige de
  l'échafaudage Wizard d'origine, jamais branché à aucune UI — à ne pas confondre avec la nouvelle
  colonne `char_archetype.setback_rolls` (migration 126, chantier Revers) qui, elle, est la vraie
  mécanique. Doublon mort, sans impact sur le Vault (toujours `[]`, rien à cloner dedans) — **inscrit
  en dette séparée, hors scope de ce plan, à traiter le jour où le chantier Revers est repris.**

---

## Décisions actées (2026-07-09, avec Saar)

1. **Vault = entité propre** (table `vaults`), pas une fausse campagne. Rejeté explicitement :
   modéliser le Vault comme une `campaigns` avec un seul membre — sémantiquement malhonnête (pas de
   GM, pas de carte, ne doit jamais apparaître dans la liste de campagnes) même si ça avait été
   envisagé un temps pour réutiliser telle quelle l'autorisation `campaign_members`.
2. **Transfert = copie (clone profond)**, jamais un déplacement — voir recherche ci-dessus.
3. **Asymétrie de permission, tranchée par Saar** :
   - **Vers le Vault : libre.** Le joueur clone son propre personnage de campagne vers son Vault en
     self-service — seule condition : propriétaire du personnage source.
   - **Depuis le Vault : restreint.** Cloner un personnage du Vault vers une campagne exige
     **(a)** faire partie de cette campagne (`campaign_members`) **ET (b)** l'autorisation du GM de
     cette campagne — via une requête en attente, pas un import direct.
4. **UI (bouton d'accès) hors scope** — à planifier séparément, une fois ce mécanisme construit.

---

## Modèle de données

### Table `vaults` (NOUVELLE)

Une ligne par compte, créée à la volée au premier accès (pas de bootstrap à l'inscription — inutile
tant que personne n'utilise la fonctionnalité).

```js
// XXX_vaults.js (numéro exact à confirmer au codage — voir Piège P1)
vaults
  id          UUID PK, default gen_random_uuid()
  user_id     UUID NOT NULL, FK users(id) ON DELETE CASCADE, UNIQUE
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
```

Minimale par design — c'est le point d'ancrage pour toute extension future (nom, quota, ou toute
autre table qui voudra un jour référencer `vault_id` : skins de dés, modèles `.glb`, "boutique"),
pas une table à charger de colonnes spéculatives aujourd'hui.

### `characters` — modification

`characters.campaign_id` (`server/src/db/migrations/20260331_15_characters.js:12`) est aujourd'hui
`NOT NULL`. Il devient nullable, et une nouvelle colonne `vault_id` (nullable, FK `vaults.id`)
apparaît à côté :

```js
table.uuid('campaign_id').nullable().alter()  // était notNullable()
table.uuid('vault_id').nullable().references('id').inTable('vaults').onDelete('CASCADE')
```

**Invariant** : un personnage a exactement un des deux (`campaign_id` XOR `vault_id`), jamais les
deux, jamais aucun. Contrainte `CHECK` SQL à privilégier — **confirmé faisable 2026-07-10** :
`table.check(...)` est déjà utilisé 2× dans ce projet (`93_ref_careers.js:137`,
`98_ref_backgrounds.js:65`), donc pas seulement une invariant côté service : `table.check('(campaign_
id IS NULL) != (vault_id IS NULL)')` (ou `knex.raw(...)` équivalent) au moment de la migration.

**Ce qui NE change PAS** : `char_sheet` et toutes ses tables filles (`char_identity`,
`char_archetype`, `char_attributes`, `char_skills`, `char_advantages`, `char_inventory`, et les
autres — **liste exhaustive à revérifier en base au moment du codage**, ne pas coder sur la
mémoire de ce plan) ne référencent que `character_id`/`char_sheet_id`, jamais `campaign_id`
directement — **confirmé par grep exhaustif des migrations le 2026-07-10** (12 fichiers déclarent
une colonne `character_id`/`char_sheet_id`, aucun `campaign_id` dans le sous-arbre `char_sheet`).
Un clone profond est donc une opération strictement additive : dupliquer la ligne `characters` +
tout le sous-arbre `char_sheet`, sans toucher à aucune table de campagne existante.

**Exclusion explicite** : `char_creation_snapshot` (`char_sheet_id` FK, migration 96) est un scratch
de rollback Wizard (Step4→Step3), sans valeur une fois la fiche verrouillée — à exclure de la liste
de clonage dès l'Étape 0, pas à découvrir en cours de codage.

---

## Architecture cible

### Deux familles de routes distinctes — pas une extension de `char-sheet.js`

**Décision de conception** (évite de toucher aux emissions socket `io.to(req.character.
campaign_id)` déjà recensées dans `char-sheet.js` et aux appels `getCampaignSettings(db, req.
character.campaign_id)` — lignes exactes à revérifier au codage, décalées de quelques lignes depuis
la rédaction de ce plan, ex. `getCampaignSettings` est en réalité ligne 98/475 au 2026-07-10, pas
97/474) : un personnage en Vault est un **instantané figé** (vue, renommage, suppression,
demande de transfert), pas un personnage jouable. Il ne traverse donc jamais les routes de mutation
de `char-sheet.js` (achat compétence, inventaire, blessures...) — ces routes gardent leur logique
actuelle **totalement inchangée**, aucun garde `if (campaign_id)` à ajouter dessus.

**Nouveau fichier `server/src/routes/vault.js`**, monté sur `/api/vault`, avec son **propre**
`router.param` — ownership seule (`character.user_id === req.user.id`), sans notion de
`campaign_members` puisqu'un Vault n'a pas de membres :

```
GET    /api/vault/characters                    — liste des personnages du Vault de l'utilisateur
GET    /api/vault/characters/:id                 — fiche complète en lecture (même forme que
                                                     GET /char-sheet/:characterId, réutilise les
                                                     mêmes SELECT — à factoriser au codage)
PATCH  /api/vault/characters/:id                 — renommage uniquement (scope minimal)
DELETE /api/vault/characters/:id                 — suppression définitive
POST   /api/vault/characters/:id/request-import  — crée une demande de transfert vers une campagne
                                                     body: { targetCampaignId }
                                                     rejette si le demandeur n'est pas membre de
                                                     targetCampaignId (condition (a) de la décision 3)
POST   /api/vault/transfer-requests/:id/approve  — GM de la campagne cible uniquement (condition (b))
POST   /api/vault/transfer-requests/:id/reject   — idem
```

**Une seule route ajoutée dans `char-sheet.js`** (celle-ci reste dans ce fichier car elle opère sur
un personnage de campagne vivant, via le `router.param` existant qui fait déjà tout le travail
d'ownership — aucune nouvelle logique d'auth) :

```
POST /api/char-sheet/:characterId/clone-to-vault   — transfert libre (décision 3, "vers le Vault")
```

### Table `vault_transfer_requests` (NOUVELLE)

```js
vault_transfer_requests
  id                    UUID PK
  vault_character_id    UUID NOT NULL, FK characters(id) ON DELETE CASCADE   -- reste dans le Vault
  target_campaign_id    UUID NOT NULL, FK campaigns(id) ON DELETE CASCADE
  requested_by          UUID NOT NULL, FK users(id)
  status                TEXT NOT NULL DEFAULT 'pending'   -- pending | approved | rejected
  reviewed_by           UUID NULL, FK users(id)
  reviewed_at           TIMESTAMPTZ NULL
  created_character_id  UUID NULL, FK characters(id)       -- le clone créé dans la campagne, si approuvé
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
```

**Piège identifié dès la conception (P2)** : la condition (a) "faire partie de la campagne" doit
être revérifiée **à l'approbation**, pas seulement à la création de la requête — un joueur peut
quitter la campagne (ou en être retiré) entre le moment où il demande le transfert et le moment où
le GM traite la demande. Revalider `campaign_members` dans `approveImport`, pas uniquement dans
`requestImport`.

### Service `server/src/services/vaultService.js` (NOUVEAU)

Pattern identique à `advantageService.js`/`mutationService.js` — couche DB pure, pas de `req`/`res`,
pas d'émission socket (un Vault n'a pas de room à notifier, personne d'autre n'y a accès).
**Correction 2026-07-10** : la version précédente de ce plan citait aussi `modingService.js` comme
précédent — **ce fichier n'existe pas** (`docs/PLAN_MODING.md` est resté à l'état papier, 0% codé,
chantier en pause). Seuls `advantageService.js`/`mutationService.js` sont de vrais précédents dans
ce projet.

- `getOrCreateVault(userId)`
- `listVaultCharacters(userId)`
- `cloneCharacterDeep(sourceCharacterId, { campaignId, vaultId })` — cœur du mécanisme, appelé dans
  les deux sens ; construit la nouvelle ligne `characters` + duplique tout le sous-arbre
  `char_sheet` en une transaction. **Stampe systématiquement `char_sheet.wizard_locked_at = now()`
  sur la copie créée** (voir Piège P6) — sans condition sur l'état de la source, jamais de
  personnage à moitié fini qui traîne, ni côté Vault ni côté campagne cible.
- `cloneToVault(characterId, userId)` — vérifie ownership, appelle `cloneCharacterDeep`
- `requestImport(vaultCharacterId, targetCampaignId, userId)`
- `approveImport(requestId, gmUserId)` — revalide membership (P2), appelle `cloneCharacterDeep`,
  marque la requête `approved` + `created_character_id`
- `rejectImport(requestId, gmUserId)`

#### Garde-fou anti-dérive (nouveau, 2026-07-10)

Réponse au risque identifié dans "Recherche complémentaire" ci-dessus : la liste de tables à copier
dans `cloneCharacterDeep` est écrite en dur (bonne pratique confirmée), mais doit être **vérifiée
automatiquement contre la réalité de la base à chaque appel**, pas seulement relue une fois au
codage. Avant de dupliquer quoi que ce soit, `cloneCharacterDeep` interroge
`information_schema.columns` pour la liste réelle des tables portant `character_id`/`char_sheet_id`,
la compare à sa propre liste écrite en dur, et lève une erreur explicite (`AppError 500`, message
listant la/les table(s) manquante(s)) en cas d'écart — au lieu de cloner en silence en oubliant une
table. Coût : une requête de plus par clonage (opération rare, pas un chemin chaud). Bénéfice : toute
future migration qui ajoute une table `character_id`/`char_sheet_id` sans mettre à jour ce service
casse bruyamment au premier clonage testé, au lieu de perdre une donnée sans que personne ne le
remarque avant des mois.

---

## Priorités d'implémentation

| Étape | Contenu | Dépendance |
|---|---|---|
| 0 | Lister exhaustivement les tables filles de `char_sheet`/`characters` à cloner (requête réelle en base, pas de mémoire) | — |
| 1 | Migration — `vaults` + `characters.campaign_id` nullable + `characters.vault_id` + invariant | Étape 0 |
| 2 | Migration — `vault_transfer_requests` | — |
| 3 | `vaultService.js` (`cloneCharacterDeep` en premier, c'est le cœur — tout le reste en dépend) | Étapes 1+2 |
| 4 | Route `POST /char-sheet/:characterId/clone-to-vault` (`char-sheet.js`) | Étape 3 |
| 5 | `vault.js` — routes liste/vue/renommage/suppression | Étape 3 |
| 6 | `vault.js` — routes `request-import`/`approve`/`reject` | Étapes 3+5 |
| 7 | (hors ce plan) UI d'accès — voir "Hors scope" | Étape 6 |

---

## Pièges à anticiper

- **P1** : numéro de migration à reconfirmer via `ls server/src/db/migrations/` au moment de coder,
  pas depuis ce plan. **Mis à jour 2026-07-10** : 124 (`char_advantage_notes`), 125
  (`char_mutations_source_campaign`) et 126 (`ref_setbacks_revers_table`, chantier Revers, non
  commité) sont désormais pris. Prochain numéro libre au 2026-07-10 : **127**, mais à revérifier une
  dernière fois au moment de coder (P53 — nodemon peut avoir fait avancer la numérotation
  entre-temps).
- **P2** : voir ci-dessus — revalider `campaign_members` à l'approbation, pas seulement à la requête.
- **P3** : `cloneCharacterDeep` doit être une transaction unique (insert `characters` + tous les
  inserts `char_sheet`/tables filles) — un échec partiel laisserait un personnage à moitié cloné.
- **P4** : l'invariant `campaign_id` XOR `vault_id` doit être vérifié aussi bien pour les
  personnages **existants** (tous ont `campaign_id` non-null aujourd'hui, `vault_id` null — cohérent
  par défaut, aucun backfill nécessaire) que pour tout nouveau chemin de création de personnage —
  auditer `creationService.js:startCreation` et `characters.js` (route `POST /`) pour confirmer
  qu'aucun ne pourrait accidentellement produire les deux `NULL` ou les deux renseignés.
- **P5** : `characters.type` (probablement `'pj'`) et `visible` sur un clone Vault — valeurs à
  fixer explicitement dans `cloneCharacterDeep` plutôt que de copier `visible` tel quel (un
  personnage en Vault n'a pas de carte, `visible` n'a pas de sens — vérifier si la colonne doit
  simplement être ignorée/mise à une valeur neutre côté Vault). **Confirmé 2026-07-10** : `type` doit
  être fixé à `'pj'` en dur (un Vault n'appartient qu'à un joueur, jamais un MJ qui y stockerait un
  PNJ — cohérent avec `creationService.js:245`, seul autre point de création de personnage, qui fixe
  déjà `type: 'pj'` en dur de la même façon).
- **P6 (trouvé en relecture critique, 2026-07-10)** : `routes/characters.js:74-79` **cache de la
  liste de personnages d'une campagne tout `char_sheet` dont `wizard_locked_at` est `NULL`**
  (invariant introduit Session 139, commenté explicitement dans le code : *"ne jamais exposer un
  brouillon en cours"*). Un clone produit par `approveImport` (Vault → campagne) qui n'aurait pas ce
  champ posé serait **invisible dans la campagne cible sans aucune erreur** — bug silencieux,
  indétectable sans relire ce filtre précis. **Décision : `cloneCharacterDeep` fixe
  systématiquement `wizard_locked_at = now()` sur toute copie produite**, qu'elle aille vers le Vault
  ou vers une campagne, et quel que soit l'état (verrouillé ou non) du personnage source — règle
  unique, sans cas particulier à retenir. Conséquence acceptée : un brouillon Wizard non terminé
  cloné vers le Vault y devient une copie "figée" (cohérent avec la nature du Vault, un instantané,
  pas un Wizard en cours — voir "Architecture cible" plus haut).

---

## Hors scope (rappel, à planifier séparément)

- **Placement du bouton d'accès UI** (Dashboard vs Sidebar onglet PERSOS, "Wizard" vs "création
  directe") — tranché par Saar : à traiter plus tard, une fois ce mécanisme construit.
- **Contenu non-personnage du Vault** (skins de dés, modèles `.glb`, "boutique") — mentionnés par
  Saar comme extensions possibles de l'entité `vaults`, mais chacun son propre chantier avec sa
  propre table dédiée (`vault_id` en FK, même convention que `campaign_id` aujourd'hui) — pas une
  table générique fourre-tout, décision actée dans la discussion mais aucune de ces tables n'est
  créée par ce plan.
- **Notification temps réel** d'une demande de transfert en attente (le GM devrait voir "1 demande
  en attente" quelque part) — aucun mécanisme socket prévu dans ce plan, probablement un simple
  GET au chargement de la fenêtre GM suffit pour une v1, à trancher au moment de l'UI (hors scope).

---

## Historique des révisions

- **2026-07-09** — rédaction initiale à partir d'une discussion libre (hors fichier) : comparaison
  Roll20/Foundry, décision copie-pas-déplacement, décision `vaults` en table dédiée (pas de fausse
  campagne, pas de table polymorphe fourre-tout), asymétrie de permission actée par Saar. Aucun code
  écrit — session de planification pure.
- **2026-07-10** — relecture critique (à froid, contre le code réel) + recherche complémentaire
  demandée par Saar. Corrections : numéro de migration réactualisé (125→127, 126 consommé
  entre-temps par le chantier Revers) ; précédent inexistant retiré (`modingService.js` n'existe pas,
  `PLAN_MODING.md` à 0% codé) ; `characters.type` confirmé `'pj'` en dur. **Vrai trou trouvé et
  corrigé** : aucune gestion de `char_sheet.wizard_locked_at` sur les clones — un import Vault→
  campagne serait resté invisible sans erreur (nouveau **Piège P6**, règle retenue : toute copie
  produite par `cloneCharacterDeep` est systématiquement stampée verrouillée). **Recherche validant
  l'architecture** : comparaison avec les gemmes Rails `amoeba`/`deep_cloneable` (référence mature du
  même problème) — confirme que la liste explicite de tables à copier est la bonne pratique, pas une
  copie générique par réflexion. **Garde-fou ajouté** en réponse au risque de dérive dans le temps
  identifié par Saar : `cloneCharacterDeep` vérifie désormais sa propre liste contre
  `information_schema` à chaque appel et refuse de cloner en cas d'écart, au lieu de perdre une
  donnée en silence si une future table est oubliée. Audit JSONB du sous-arbre `char_sheet` : aucun
  ID inter-personnage caché trouvé, clone relationnel simple confirmé suffisant. `char_creation_
  snapshot` ajouté explicitement à la liste d'exclusion. Toujours aucun code écrit.
