# PLAN_VAULT.md — Vault personnel (personnages hors campagne, transférables)
> Rédaction initiale — 2026-07-09. Relecture critique + recherche complémentaire — 2026-07-10.
> Session de planification pure, aucun code écrit.
> Suite d'une discussion libre (hors fichier) sur l'inspiration Roll20 Character Vault.

---

## Objectif

Permettre à un joueur de stocker ses personnages dans un espace **personnel**, indépendant de
toute campagne (aucune carte, aucun GM, aucun autre joueur), et de les faire circuler entre
campagnes sans les recréer à chaque fois.

**Portée élargie 2026-07-10 (décision Saar)** : le Vault ne se limite pas aux PJ classiques. Il doit
couvrir, dès l'architecture (pas forcément dès le code), tous les **"compagnons"** qu'un joueur peut
posséder : les drones (déjà implémentés, `characters.type = 'drone'`) et, **à terme**, les
exo-armures et les vaisseaux/sous-marins pilotables — **aucun des deux n'existe encore comme entité
`characters` aujourd'hui** (`docs/MANUELEXOARMURE.md`/`docs/REGLES/REGLEARMURE.md` sont des documents
de règles LdB purs, sans schéma DB associé — vérifié, zéro table `exo_*`/`vaisseau_*` dans les
migrations ; recherche "vaisseau/sous-marin" ne remonte que du texte narratif de carrières, aucune
implémentation). **Conséquence sur l'architecture** : `cloneCharacterDeep` ne doit pas coder en dur
"PJ + un cas spécial drone" — voir "Registre par type de compagnon" plus bas, conçu pour qu'ajouter
un futur type de compagnon n'exige qu'une nouvelle entrée, jamais une réécriture du service.

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
     self-service — condition : propriétaire du personnage source **ET personnage finalisé**
     (`char_sheet.creation_state === 'complete'`) — voir "Run à vide 2026-07-10" plus bas : un
     brouillon Wizard inachevé cloné vers le Vault y resterait bloqué à moitié fini pour toujours (le
     Vault n'a pas de mécanisme pour reprendre un Wizard en cours), donc pas "libre" au sens strict —
     restriction ajoutée à cette décision, pas nouvelle règle inventée.
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

**Ce qui NE change PAS** : `char_sheet` et toutes ses tables filles ne référencent que
`character_id`/`char_sheet_id`, jamais `campaign_id` directement — confirmé par grep exhaustif des
migrations. Un clone profond est donc une opération strictement additive : dupliquer la ligne
`characters` + tout le sous-arbre `char_sheet`, sans toucher à aucune table de campagne existante.

### Étape 0 — Liste exhaustive des tables (auditée 2026-07-10, contre le code réel, pas la mémoire)

**`characters.type` a 3 valeurs aujourd'hui** (`'pj'`, `'pnj'`, `'drone'` — migration 71 ; CHECK
constraint) — corrige la version précédente de ce plan qui n'en supposait que 2 (voir Piège P5).
Les PJ et PNJ partagent le même arbre `char_sheet` ; un drone a son propre arbre, plus petit,
indépendant. **Décision Saar 2026-07-10** : le Vault doit couvrir PJ + compagnons (drones
aujourd'hui, exo-armures/vaisseaux à terme — aucun des deux n'existe encore en base). D'où un
**registre par type de compagnon** plutôt qu'un cas spécial "drone" codé en dur :

**Groupe A — arbre `char_sheet` (types `'pj'`/`'pnj'`) :**

| Table | Clé | Contenu |
|---|---|---|
| `char_sheet` | `character_id` | pivot |
| `char_identity` | `char_sheet_id` PK | identité/description physique |
| `char_archetype` | `char_sheet_id` PK | génotype, sexe, origines, **`setback_rolls`** (Revers) |
| `char_attributes` | `char_sheet_id`+`attr_id` | attributs primaires |
| `char_skills` | `char_sheet_id`+`skill_id` | maîtrise compétences |
| `char_mutations` | `char_sheet_id` | mutations achetées |
| `char_polaris` | `char_sheet_id` PK | état + pouvoirs Polaris |
| `char_personal_advantages` | `char_sheet_id`+`advantage_id` | traits narratifs background |
| `char_careers` | `char_sheet_id` | carrières, années, `pro_advantages`/`random_picks` |
| `char_traits` | `char_sheet_id` | traits divers (`params` JSONB) |
| `char_pc_ledger` | `char_sheet_id` PK | comptabilité PC dépensés |
| `char_advantages` (V2) | `char_sheet_id` | avantages/désavantages achetés |
| `char_advantage_notes` | `char_sheet_id` | notes "Autres" |
| `char_inventory` | `character_id` | équipement possédé |
| `character_wounds` | `char_sheet_id` | blessures actuelles |
| `character_macros` | `character_id` | raccourcis de jet perso — vérifié : `sources[].ref_id`
pointe vers `ref_skills.id` (stable) ou un `attr_id` texte (`'FOR'`...), jamais un ID de ligne
`char_skills`/`char_attributes` — aucun remappage nécessaire au clonage. |

**Groupe B — arbre `drone_*` (type `'drone'`) :**

| Table | Clé | Contenu |
|---|---|---|
| `drone_sheet` | `character_id` PK | stats + `integrite_actuelle`/`damages` (état de combat, **à remettre à neuf au clonage**, voir Piège P7) |
| `drone_programs` | `character_id` | programmes installés |
| `drone_weapons` | `character_id` | armement (FK `ref_equipment`, table de référence stable) |

**Groupes futurs (aucune table aujourd'hui, rien à coder maintenant)** : exo-armure, vaisseau/
sous-marin — le jour où l'un de ces types est implémenté avec sa propre fiche (nouveau
`characters.type` + nouvelles tables `..._id` = `character_id`), il suffit d'ajouter une nouvelle
entrée au registre (voir "Registre par type" dans la section Service) — le reste de
`cloneCharacterDeep` n'a pas besoin d'être modifié. Le garde-fou anti-dérive (voir plus bas) empêchera
justement d'oublier cette étape le jour venu : cloner un personnage de ce nouveau type échouera
bruyamment tant que son entrée n'est pas ajoutée, au lieu de perdre ses données en silence.

**Tables à EXCLURE explicitement (état de session/campagne, pas du personnage, aucun groupe) :**

| Table | Raison |
|---|---|
| `tokens` | position sur la carte — n'a aucun sens hors campagne |
| `trade_log` | historique de transactions — propre à la campagne source |
| `trade_offers` | offre de vente active — état de session |
| `vault_transfer_requests` | **ajoutée au Run à vide 2026-07-10** — référence `characters` deux fois (`vault_character_id`, `created_character_id`) mais décrit la *demande de transfert elle-même*, pas le personnage — trouvée manquante car créée par l'Étape 2, après cet audit initial. **Cette liste doit être revue à chaque nouvelle table ajoutée par ce plan lui-même**, pas seulement au moment de l'Étape 0. |

**Table qui N'EXISTE PLUS, retirée de ce plan** : `char_creation_snapshot` (scratch de rollback
Wizard) a été **supprimée par la migration `102_wizard_client_primary.js`** (le rollback Step4→Step3
vit désormais côté client) — la mention précédente de ce plan pointait vers une table déjà morte,
rien à exclure, elle n'apparaîtra jamais dans un audit `information_schema` réel.

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

- `getOrCreateVault(userId)` — **note Run à vide 2026-07-10** : `vaults.user_id` est `UNIQUE` (voulu,
  Étape 1) — deux appels simultanés (double-clic, deux onglets) peuvent tous les deux échouer à
  trouver un Vault existant puis tenter un `INSERT` en parallèle ; le second violera la contrainte
  `UNIQUE`. À coder avec un `try/catch` explicite sur cette violation (retomber sur un `SELECT`) —
  pas un cas théorique à ignorer, la contrainte elle-même garantit qu'il ne peut PAS créer de doublon
  silencieux, juste qu'il faut gérer l'erreur proprement plutôt que la laisser remonter en 500.
- `listVaultCharacters(userId)`
- `cloneCharacterDeep(sourceCharacterId, { campaignId, vaultId })` — cœur du mécanisme, appelé dans
  les deux sens ; lit `characters.type` de la source, résout **l'entrée du registre** correspondante
  (voir ci-dessous), construit la nouvelle ligne `characters` + duplique tout l'arbre associé en une
  transaction. Pour le Groupe A (`pj`/`pnj`) : **stampe systématiquement `char_sheet.wizard_
  locked_at = now()`** sur la copie créée (voir Piège P6). Pour le Groupe B (`drone`) : remet
  `integrite_actuelle`/`damages` à neuf (voir Piège P7). `type` n'est jamais réécrit (P5).
- `cloneToVault(characterId, userId)` — vérifie ownership, appelle `cloneCharacterDeep`
- `requestImport(vaultCharacterId, targetCampaignId, userId)`
- `approveImport(requestId, gmUserId)` — revalide membership (P2), appelle `cloneCharacterDeep`,
  marque la requête `approved` + `created_character_id`
- `rejectImport(requestId, gmUserId)`

#### Registre par type de compagnon (nouveau, 2026-07-10)

Réponse à la demande Saar de rester extensible aux futurs types (exo-armure, vaisseau) sans réécrire
le service à chaque fois. Une seule structure, pas un `if (type === 'drone')` en dur dans la logique
de clonage :

```js
// Chaque entrée : tables à cloner (dans l'ordre de dépendance) + hook de "remise à neuf" optionnel.
const COMPANION_REGISTRY = {
  pj:  { rootKey: 'char_sheet', tables: [/* Groupe A, voir Étape 0 */], onClone: lockWizard },
  pnj: { rootKey: 'char_sheet', tables: [/* Groupe A, identique à pj */], onClone: lockWizard },
  drone: { rootKey: 'characters', tables: ['drone_sheet', 'drone_programs', 'drone_weapons'], onClone: resetDroneIntegrity },
  // futur : exo: { ... }, vaisseau: { ... } — une entrée de plus, jamais une modification
  // de cloneCharacterDeep lui-même.
}
```

`cloneCharacterDeep` devient alors générique : `const entry = COMPANION_REGISTRY[sourceCharacter.type]
?? throwUnknownType()`, puis boucle sur `entry.tables`, puis appelle `entry.onClone?.(newCharacterId)`.
Ajouter un futur type de compagnon = ajouter une entrée + les tables qui vont avec, jamais toucher à
l'algorithme de clonage.

#### Garde-fou anti-dérive (nouveau, 2026-07-10)

Réponse au risque identifié dans "Recherche complémentaire" ci-dessus : la liste de tables à copier
est écrite en dur, par entrée du registre (bonne pratique confirmée), mais doit être **vérifiée
automatiquement contre la réalité de la base à chaque appel**, pas seulement relue une fois au
codage. Avant de dupliquer quoi que ce soit, `cloneCharacterDeep` interroge
`information_schema` pour la liste réelle des tables ayant **une contrainte FK vers `characters` ou
`char_sheet`, quel que soit le nom de la colonne** (requête sur `information_schema.
table_constraints`/`key_column_usage`/`constraint_column_usage`, **pas une recherche par nom de
colonne** `character_id`/`char_sheet_id` — **correction du Run à vide 2026-07-10** : la première
version de cette idée cherchait seulement les colonnes nommées littéralement `character_id`/
`char_sheet_id`, un angle mort réel démontré par `vault_transfer_requests.vault_character_id`/
`created_character_id`, deux FK bien réelles vers `characters` que cette recherche plus étroite
aurait ratées). La liste obtenue est comparée à **l'union de toutes les entrées de
`COMPANION_REGISTRY` ET de la liste d'exclusion explicite** (voir Étape 0), et toute table absente
des deux lève une erreur explicite (`AppError 500`, message listant la/les table(s) manquante(s)) —
au lieu de cloner en silence en oubliant une table, ou de bloquer à tort une table légitimement hors
scope comme `vault_transfer_requests`. Coût : une requête de plus par clonage (opération rare, pas
un chemin chaud). Bénéfice direct pour l'extensibilité voulue par Saar : le jour où une table
`exo_sheet`/`vaisseau_sheet` est ajoutée sans que son entrée soit créée dans le registre (ou
explicitement exclue), le tout premier clonage testé casse bruyamment avec un message clair — au
lieu de perdre une donnée sans que personne ne le remarque avant des mois.

---

## Priorités d'implémentation

| Étape | Contenu | Dépendance |
|---|---|---|
| 0 | ✅ **FAIT 2026-07-10** — Lister exhaustivement les tables filles de `char_sheet`/`characters` à cloner (16 tables à cloner, 3 à exclure — voir tableau ci-dessus) | — |
| 1 | ✅ **CODÉ + TESTÉ 2026-07-10** — Migration `129_vaults.js` — voir "Étape 1 — plan détaillé" ci-dessous pour le détail des tests | Étape 0 |
| 2 | ✅ **CODÉ + TESTÉ 2026-07-10** — Migration `130_vault_transfer_requests.js` — voir "Étape 2 — plan détaillé" ci-dessous | — |
| 3 | ✅ **CODÉ + TESTÉ 2026-07-10** — `vaultService.js` — voir "Étape 3 — plan détaillé" ci-dessous | Étapes 1+2 |
| 4 | ✅ **CODÉ + TESTÉ 2026-07-10** — Route `POST /char-sheet/:characterId/clone-to-vault` — voir "Étapes 4-6 — plan détaillé" | Étape 3 |
| 5 | ✅ **CODÉ + TESTÉ 2026-07-10** — `vault.js` — routes liste/vue/renommage/suppression | Étape 3 |
| 6 | ✅ **CODÉ + TESTÉ 2026-07-10** — `vault.js` — routes `request-import`/`approve`/`reject` | Étapes 3+5 |
| 7 | (hors ce plan) UI d'accès — voir "Hors scope" | Étape 6 |

---

## Étape 1 — plan détaillé (migration, pas encore exécutée)

**Numéro reconfirmé 2026-07-10** (P53 — un fichier `127_char_mutation_effects_view_subtypes.js` est
apparu depuis la dernière vérification, travail parallèle sans lien avec le Vault) : prochain numéro
libre = **128**. Fichier : `server/src/db/migrations/128_vaults.js`.

**Choix technique clé** : pour rendre `characters.campaign_id` nullable, ce plan utilise du SQL brut
(`ALTER COLUMN ... DROP NOT NULL`) plutôt que le générateur knex (`table.uuid('campaign_id').
nullable().alter()`), **par précaution, pas par habitude** : `campaign_id` a une contrainte de clé
étrangère existante (vers `campaigns`), et deux migrations de ce projet (`88_trade_offers_sell.js`,
`76c_drone_weapons_schema.js`) ont déjà rendu nullable une colonne FK de cette manière — jamais via
le générateur knex sur une colonne qui a une FK. Pas de précédent inverse trouvé dans ce projet, donc
pas de raison de s'écarter de ce qui est déjà éprouvé.

```js
// 128_vaults.js
// PLAN_VAULT.md Étape 1 — table `vaults` (une par compte) + `characters.vault_id` (FK nullable) +
// `characters.campaign_id` devient nullable. Invariant : un personnage a exactement un des deux
// (jamais les deux, jamais aucun), imposé par une contrainte CHECK SQL — pas seulement côté service.

export const up = async (knex) => {
  await knex.schema.createTable('vaults', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('user_id').notNullable().unique()
      .references('id').inTable('users').onDelete('CASCADE')
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })

  await knex.raw('ALTER TABLE characters ALTER COLUMN campaign_id DROP NOT NULL')

  await knex.schema.alterTable('characters', (table) => {
    table.uuid('vault_id').nullable()
      .references('id').inTable('vaults').onDelete('CASCADE')
  })

  await knex.raw(`
    ALTER TABLE characters
    ADD CONSTRAINT chk_characters_campaign_xor_vault
    CHECK ((campaign_id IS NULL) != (vault_id IS NULL))
  `)
}

export const down = async (knex) => {
  await knex.raw('ALTER TABLE characters DROP CONSTRAINT chk_characters_campaign_xor_vault')
  await knex.schema.alterTable('characters', (table) => {
    table.dropColumn('vault_id')
  })
  await knex.raw('ALTER TABLE characters ALTER COLUMN campaign_id SET NOT NULL')
  await knex.schema.dropTableIfExists('vaults')
}
```

**Validation par la recherche (2026-07-10)** : le motif "plusieurs FK nullables sur une même table +
une contrainte CHECK garantissant qu'une seule est remplie" est un motif de conception reconnu et
documenté, appelé **"exclusive arc"** (arc exclusif). Un article dédié à ce motif précisément
([Are Exclusive Arcs Evil?](https://waymondo.com/posts/are-exclusive-arcs-evil/)) compare
explicitement cette approche à l'alternative la plus répandue (association polymorphe à la Rails —
une colonne texte `type` + un seul `id`, sans vraie contrainte FK) et conclut que l'arc exclusif est
préférable **"quand l'ensemble des parents possibles est fini et stable"** — exactement notre cas
(`campaign_id`/`vault_id`, 2 possibilités, ne grossira jamais : les futurs types de compagnons
partagent la même colonne `type`, orthogonale à "où" vit le personnage). L'alternative polymorphe est
explicitement déconseillée ici : elle perd la contrainte FK réelle ("la base ne sait plus ce qu'est
une ligne référencée"), ce qui casserait la cohérence déjà exigée partout ailleurs dans ce projet
(migrations 93/98/126 — toujours de vraies FK, jamais de référence non typée).

**Divergence assumée avec le comportement existant** : `characters.user_id` (colonne séparée,
propriétaire) est `ON DELETE SET NULL` — supprimer un compte ne supprime pas ses personnages de
campagne, ils deviennent orphelins (repris par le MJ). `vault_id` est au contraire `ON DELETE
CASCADE` (`vaults.user_id` aussi) : supprimer un compte supprime réellement ses personnages en
Vault. **Différence voulue, pas un oubli** : un personnage de campagne a d'autres parties prenantes
(le MJ, la campagne) qui ont intérêt à ce qu'il persiste ; un Vault n'a par construction qu'un seul
propriétaire possible (Décision actée n°1) — rien ni personne d'autre n'y a un intérêt légitime une
fois le compte supprimé.

**Pourquoi l'ordre est important (`up`)** :
1. `vaults` doit exister avant d'ajouter la colonne `vault_id` (qui la référence en FK).
2. La contrainte `CHECK` est ajoutée **en dernier**, une fois les deux colonnes dans leur état
   final — à ce moment, toutes les lignes existantes ont `campaign_id` rempli et `vault_id` encore
   `NULL` (colonne tout juste créée, sans défaut) : la contrainte est donc automatiquement respectée
   par les données déjà en base, **aucun backfill nécessaire** (confirme le Piège P4).

**Ce qui change** : `vaults` (nouvelle table), `characters.campaign_id` (NOT NULL → nullable),
`characters.vault_id` (nouvelle colonne), + 1 contrainte CHECK sur `characters`.
**Ce qui NE change PAS** : aucune ligne existante n'est modifiée (toutes ont déjà `campaign_id`
rempli) ; aucune autre table ; aucun code applicatif (routes/services) — cette étape est purement
un changement de schéma, rien ne le lit ni ne l'écrit encore.

**✅ Codé et testé le 2026-07-10 — numéro final : `129_vaults.js`** (128 et 127 pris entre-temps par
du travail parallèle, reconfirmé juste avant écriture — P53). Auto-appliquée par nodemon à l'écriture
du fichier (serveur revenu sain, `/api/health` 200).

**Testé :**
- Schéma vérifié en base réelle : `vaults` (3 colonnes, toutes `NOT NULL`), `characters.campaign_id`/
  `vault_id` nullable, contrainte `chk_characters_campaign_xor_vault` présente avec la définition
  exacte attendue.
- **4 scénarios d'insertion réels, chacun dans une transaction annulée (jamais commitée)** : (A)
  `campaign_id`+`vault_id` tous les deux `NULL` → **rejeté** par la contrainte, comme attendu ; (B)
  les deux remplis → **rejeté**, comme attendu ; (C) `campaign_id` seul rempli → **accepté**
  (comportement actuel préservé) ; (D) `vault_id` seul rempli → **accepté** (nouveau cas). Confirmé
  qu'aucune donnée de test n'a persisté après coup (0 ligne résiduelle).
- **Round-trip `down`→`up` réel** (P52 — appel direct des fonctions du module, jamais la CLI knex) :
  `vaults` supprimée puis recréée, `campaign_id` redevenu `NOT NULL` puis re-nullable, contrainte
  CHECK re-vérifiée identique après coup. **73 personnages existants intacts avant/après** (aucune
  perte de données). Bookkeeping `knex_migrations` revérifié cohérent après le round-trip (une seule
  ligne, pas de doublon).
- P54 respecté : `knex_migrations` vérifiée AVANT tout appel manuel à `down()`/`up()` (déjà appliquée
  par nodemon, donc jamais un double `up()` involontaire).

**Non testé** : aucun code applicatif ne lit encore ce schéma (routes/services de l'Étape 3+,
volontairement pas encore écrits) — rien à tester côté fonctionnel/navigateur à ce stade.

## Étape 2 — plan détaillé (migration, codée et testée)

**Fichier : `server/src/db/migrations/130_vault_transfer_requests.js`** (129 pris par l'Étape 1,
reconfirmé juste avant écriture — P53).

**3 écarts volontaires par rapport au schéma esquissé plus haut dans ce plan** (mêmes colonnes, FK
affinées à la lumière des conventions déjà établies ailleurs dans le projet) :
1. `requested_by`/`reviewed_by` passent de `NOT NULL`/FK simple à **nullable + `ON DELETE SET
   NULL`** — ce sont des colonnes de piste d'audit ("qui a fait l'action"), pas de propriété
   ("à qui appartient la ligne", déjà porté par `vault_character_id`/`target_campaign_id`) — même
   logique que `characters.user_id` (migration 15). Un `CASCADE` ici aurait effacé l'historique
   d'une demande si le compte de son auteur est supprimé plus tard.
2. `created_character_id` : `ON DELETE SET NULL` rendu explicite — supprimer le clone créé plus tard
   ne doit pas effacer la trace de la demande d'origine.
3. **Ajout non prévu dans l'esquisse initiale** : un index unique partiel interdit plus d'une demande
   `'pending'` pour la même paire (personnage Vault, campagne cible) — empêche le spam de demandes en
   double, même motif que `uq_char_mut_no_sub` (migration 96) déjà utilisé dans ce projet.
4. `status` gagne une contrainte `CHECK (status IN ('pending','approved','rejected'))` — cohérent
   avec `chk_char_mutations_status`/`chk_char_mutations_source` (migration 96), jamais un simple
   commentaire sans garde-fou SQL réel.

**Testé :**
- Schéma vérifié en base réelle (9 colonnes, nullabilité conforme, contrainte CHECK et index partiel
  présents avec la définition exacte attendue).
- **4 scénarios réels, en transaction annulée** : (A) `status` invalide (`'whatever'`) → **rejeté** ;
  (B) 1ʳᵉ demande `pending` sur une paire → **acceptée** ; (C) 2ᵉ demande `pending` sur la **même**
  paire → **rejetée** (doublon détecté par l'index partiel) ; (D) demande `approved` sur la même
  paire → **acceptée** (statut différent, pas un doublon selon la règle voulue). 0 ligne résiduelle
  après coup.
- **Round-trip `down`→`up`** (P52/P54 respectés, appel direct des fonctions du module) : table,
  contrainte CHECK et index partiel tous correctement supprimés puis recréés à l'identique ;
  bookkeeping `knex_migrations` cohérent après coup (1 ligne, pas de doublon).

**Non testé** : aucun code applicatif ne lit/écrit encore cette table (Étape 3+) — rien de
fonctionnel à tester à ce stade. Le Piège P2 (revalider `campaign_members` à l'approbation, pas
seulement à la création) reste à implémenter dans `vaultService.js`, pas dans ce schéma.

---

## Étape 3 — plan détaillé (`vaultService.js`, codé et testé)

**Fichier : `server/src/services/vaultService.js`** (nouveau) + **une modification ciblée de
`creationService.js`** (`lockWizard(sheetId, trxOpt)` — ajout d'un 2ᵉ paramètre optionnel, pattern
trx-or-db déjà utilisé par `advantageService.addAdvantage`). Ce n'est pas un contournement : sans ce
changement, appeler `lockWizard` depuis la transaction de `cloneCharacterDeep` aurait tenté de lire
la ligne `char_sheet` fraîchement insérée **via une connexion différente, avant tout commit** — donc
invisible, `AppError 404` systématique. Rétrocompatible : le seul appelant existant
(`routes/creation.js:134`, `lockWizard(req.sheet.id)`) continue de fonctionner à l'identique
(`trxOpt` non fourni → utilise `db`).

**Contenu implémenté, conforme au design déjà validé plus haut dans ce plan** : `COMPANION_REGISTRY`
(Groupe A `pj`/`pnj` — deux listes distinctes selon que la table est keyée par `char_sheet_id` ou
directement par `character_id`, vérifié Étape 0 — vs Groupe B `drone`), `assertRegistryUpToDate`
(garde-fou par vraie contrainte FK, pas par nom de colonne — voir correctif Run à vide), `cloneRows`
(helper générique : omet toujours une éventuelle colonne `id` pour laisser la base en régénérer une,
sans effet sur les tables sans `id` séparé), `cloneCharacterDeep`, `getOrCreateVault`,
`listVaultCharacters`, `cloneToVault`, `requestImport`, `approveImport` (Piège P2), `rejectImport`.

**Testé — en 3 vagues, du plus sûr au plus réaliste :**

1. **Sandboxé (transaction toujours annulée, jamais commitée), sur un vrai personnage complet réel
   (73 personnages en base au départ, aucun jamais modifié)** :
   - Clone complet PJ → campagne : **les 14 tables du Groupe A comparées une par une, source vs
     clone, row count identique sur toutes** (`char_identity`, `char_archetype`, `char_attributes`
     ×8, `char_skills` ×13, `char_mutations` ×2, `char_careers`, `char_pc_ledger`, `char_advantages`,
     `char_inventory`, `character_macros`, etc.) ; `wizard_locked_at` posé sur la copie ;
     `creation_state` préservé ; original intact après coup (`campaign_id`/`vault_id` inchangés).
   - Clone PJ → Vault (Vault temporaire créé dans la même transaction, jamais persisté) :
     `campaign_id` null / `vault_id` rempli sur la copie, `wizard_locked_at` posé.
   - **Personnage non finalisé** (`creation_state` basculé à `'step3'` dans la transaction) →
     **rejeté** avec `AppError 400`, message clair — confirme le fail-fast du Piège P6 révisé.
   - **Drone endommagé** (`integrite_actuelle` et `damages` modifiés dans la transaction avant
     clonage) → clone **remis à neuf** (`integrite_actuelle = integrite_max`, `damages = {}`), tandis
     que le drone source reste endommagé après coup — confirme le Piège P7.
2. **Réel, avec nettoyage exact ensuite** (`getOrCreateVault`/`cloneToVault`/`requestImport` n'ont
   pas de variante transactionnelle externe, pas sandboxables) :
   - `getOrCreateVault` appelé deux fois → même Vault retourné, une seule ligne en base.
   - `cloneToVault` sur le personnage réel → copie créée avec `vault_id` correct ; **refusé (403)**
     pour un utilisateur qui n'est pas le propriétaire.
   - `requestImport` → **refusé (403)** si l'appelant n'est pas propriétaire du personnage Vault ;
     accepté et statut `'pending'` sinon ; **refusé (409)** sur une 2ᵉ demande en double vers la même
     campagne (index partiel de l'Étape 2).
   - `approveImport` → **refusé (403)** si l'appelant n'est pas MJ de la campagne cible ; accepté par
     le MJ réel (nouveau personnage créé en campagne, `created_character_id` renseigné,
     `status='approved'`) ; **refusé (400)** sur une 2ᵉ approbation de la même demande.
   - **Piège P2 vérifié en conditions réelles** : une demande simulée avec `requested_by` retiré de
     `campaign_members` **juste avant l'approbation** (mais après la création de la demande) est
     **rejetée** ("Le demandeur ne fait plus partie de cette campagne") — confirme que la
     revalidation a bien lieu à l'approbation, pas seulement à la création. Appartenance restaurée
     immédiatement après le test.
   - `rejectImport` → statut `'rejected'` confirmé en base.
   - **Nettoyage complet vérifié** : suppression des personnages/Vault/demandes créés pendant ces
     tests réels (cascade `ON DELETE` déjà en place, aucune table orpheline) — base revenue à 73
     personnages / 0 `vaults` / 0 `vault_transfer_requests`, identique à l'état de départ ; personnage
     source original confirmé intact (`visible=true`, `campaign_id`/`vault_id` inchangés).
3. `node --check` sur `vaultService.js` et `creationService.js` : 0 erreur. **Pas d'ESLint côté
   serveur dans ce projet** (seul `client/` a un `eslint.config.js` — vérifié, pas une omission).

**Non testé** : aucune route HTTP n'existe encore (Étapes 4-6) — tout ce qui précède est testé au
niveau service (appel direct des fonctions), pas via une requête réseau réelle ni un parcours
navigateur.

---

## Étapes 4-6 — plan détaillé (routes HTTP, codées et testées)

**Fichiers** : `server/src/routes/vault.js` (nouveau, monté sur `/api/vault` dans `index.js`) +
**une route ajoutée** dans `server/src/routes/character/char-sheet.js`
(`POST /:characterId/clone-to-vault`), conformément à l'architecture "deux familles de routes"
décidée plus haut dans ce plan.

**Défense en profondeur constatée en écrivant la route clone-to-vault** : elle réutilise le
`router.param('characterId')` existant de `char-sheet.js` (accès si propriétaire OU MJ de la
campagne), mais `cloneToVault()` (service, déjà testé Étape 3) applique sa propre règle plus stricte
(propriétaire uniquement) — un MJ qui peut consulter la fiche d'un joueur ne doit pas pouvoir la
faire atterrir dans **son propre** Vault. Les deux couches ne sont pas redondantes : le
`router.param` filtre l'accès à la fiche, le service filtre l'action précise "vers MON Vault".
Confirmé par un vrai test HTTP ci-dessous.

**Scope réduit assumé pour `GET /api/vault/characters/:id`** : renvoie `sheet`+`identity`+
`archetype`+`attributes`+`skills`, **pas** `settings`/`mutationEffects` comme `GET /char-sheet/
:characterId` — ces deux derniers dépendent d'une campagne, qu'un personnage en Vault n'a pas par
définition. Décision prise au codage (le plan initial laissait ce point ouvert, "à factoriser").

**Testé — via de vraies requêtes HTTP contre le serveur réel** (JWT signé localement avec le même
`JWT_SECRET` que l'application, envoyé en cookie `token=`, exactement le mécanisme réel — pas un
appel direct aux fonctions) :
- `POST /char-sheet/:id/clone-to-vault` sur un vrai personnage complet réel → **201**, personnage
  créé avec `vault_id` rempli, `campaign_id` null, `visible=false`, `type` préservé.
- `GET /vault/characters` → liste correcte ; `GET /vault/characters/:id` → fiche complète correcte.
- **Accès par un autre utilisateur** sur ce même personnage Vault → **403** (ownership vérifiée).
- `PATCH /vault/characters/:id` (renommage) → fonctionne.
- `POST /vault/characters/:id/request-import` : sans `targetCampaignId` → **400** ; avec →
  **201**, statut `pending` ; **2ᵉ demande identique** → **409** (doublon, index partiel Étape 2).
- `POST /vault/transfer-requests/:id/approve` → **200**, personnage créé en campagne,
  `created_character_id` renseigné.
- `POST /vault/transfer-requests/:id/reject` (sur une nouvelle demande, autorisée puisque la
  précédente n'est plus `pending`) → **200**, statut `rejected`.
- `DELETE /vault/characters/:id` → **200**, cascade confirmée (plus aucune trace du personnage ni
  de ses demandes de transfert).
- **Défense en profondeur vérifiée en HTTP réel** : le MJ d'une campagne, authentifié, tente
  `clone-to-vault` sur le personnage **d'un joueur** (pas le sien) → **403**, alors même que le
  `router.param` de `char-sheet.js` l'aurait laissé passer pour consulter cette fiche.
- Requête sans cookie d'authentification → **401**.
- **Nettoyage complet vérifié après coup** : base revenue à 73 personnages / 0 `vaults` / 0
  `vault_transfer_requests`, personnage source original confirmé intact.
- `node --check` sur `vault.js`, `char-sheet.js`, `index.js` : 0 erreur.

**Incident de test sans rapport avec le code livré** : la première tentative de test HTTP a échoué
avec des `400 Bad Request` vides et incompréhensibles — cause tracée à un détail de l'outillage de
test (le message d'information de `dotenv` s'écrit sur stdout, pas stderr, et polluait le jeton JWT
capturé dans le script bash), pas un bug de l'application. Confirmé en isolant la capture du jeton
(option `{ quiet: true }` de dotenv) — aucune ligne de code livré n'a été modifiée pour ce correctif,
c'était uniquement l'outillage de vérification.

**Non testé** : aucune UI (Étape 7, hors scope de ce plan) — tout est vérifié au niveau HTTP direct,
pas via un navigateur.

---

## Étape 7 — plan détaillé UI/UX (réflexion, aucun code écrit)

Rédigé par un passage dédié à la conception UI/UX (2026-07-10), après exploration du code client
réel (jamais de composant supposé sans vérification) : `App.jsx`, `DashboardPage.jsx`,
`WorkshopPage.jsx`, `Sidebar.jsx` (onglet Persos), `CharacterWindow.jsx`/`DroneWindow.jsx`,
`CampaignSettingsPage.jsx`/`SectionPlayers.jsx`, `index.css` (badges/boutons).

**Découverte utile en explorant** : la liste qui alimente `Sidebar.jsx`/`CharacterWindow.jsx`
(`routes/characters.js`) exclut déjà tout personnage dont le Wizard n'est pas verrouillé — un
personnage inaccessible dans ces fenêtres est donc **toujours déjà finalisé**. Conséquence directe :
si le bouton "Envoyer vers le Vault" vit dans `CharacterWindow`/`DroneWindow` (voir ci-dessous), le
cas "personnage non finalisé" (refusé côté serveur, Piège P6) **ne peut jamais se présenter dans
l'interface** — pas de message d'erreur ni de bouton grisé à prévoir, juste une conséquence naturelle
du bon emplacement.

**Décisions proposées, chacune appuyée sur un précédent réel du projet (pas de nouveau pattern
inventé sans raison) :**

1. **Accès — corrigé par Saar, meilleur que la proposition initiale** : le Dashboard a déjà une
   grille de cartes cliquables (`.campaign-grid`, `DashboardPage.jsx`) — une carte par campagne, plus
   une carte "rejoindre" et une carte "créer". Le Vault devient **une carte de plus dans cette même
   grille, en première position**, avec une illustration fixe et **non modifiable** (contrairement aux
   cartes de campagne, où le MJ peut changer l'image de couverture) — visible par tous. S'intègre dans
   un système déjà là, plus simple que d'inventer un bouton séparé dans l'en-tête.
   **Nom tranché avec Saar (2026-07-10) : "Coffre"** — retenu pour sa clarté immédiate (compris sans
   explication dans une carte de grille) plutôt que "Sas" (plus thématique Polaris — sas de
   décompression entre deux environnements, image plus juste du transit entre campagnes — mais jugé
   trop ambigu pour un premier contact). Le terme technique `vault`/`Vault` reste utilisé côté code
   (tables, routes, service — déjà en place, ne change pas), seul le libellé visible à l'écran est
   "Coffre" (clé i18n `dashboard.vaultCard`/etc., `fr.json`).
2. **Écran Vault** : liste (nom, badge type PJ/drone/futur compagnon, action Voir en lecture seule —
   réutilise `forceReadOnly` déjà supporté par `CharacterWindow.jsx` —, Renommer, Supprimer, Demander
   un transfert). Badge "En attente" à la place du bouton de transfert si une demande est déjà en
   cours (cohérent avec le refus serveur du doublon, Étape 2).
3. **Envoyer vers le Vault** : bouton dans l'onglet Paramètres de `CharacterWindow.jsx`/
   `DroneWindow.jsx`, à côté du bouton "Supprimer" déjà existant — visible seulement au propriétaire.
   Confirmation **pédagogique**, pas un simple oui/non : expliquer que c'est une copie, pas un
   déplacement (concept nouveau pour l'utilisateur).
4. **Demander un import** : depuis `VaultPage`, sélecteur de campagne cible (réutilise `GET
   /campaigns`, déjà utilisé par le Dashboard).
5. **Traitement MJ** : remplit l'onglet **"Joueurs" de `CampaignSettingsPage.jsx`**
   (`SectionPlayers.jsx`) — trouvé désactivé avec un texte placeholder littéral *"Gestion des
   joueurs — Phase 3"*, jamais construit. Emplacement le plus honnête plutôt qu'un nouvel onglet.
   **Vérifié 2026-07-10 (Saar ne reconnaissait pas ce texte)** : historique Git remonté, une seule
   ligne touche ce fichier depuis sa création (commit du 2026-07-05, Session 131 — création en bloc
   des 5 onglets de réglages). "Phase 3" est un texte de remplissage générique de ce commit, sans
   projet documenté ailleurs (recherché dans toute la doc — aucune autre mention concernant ce sujet
   précis). **Aucune collision — libre à réutiliser pour les demandes de transfert.**
6. **Pas de notification temps réel** — cohérent avec le plan technique (hors scope) : le MJ voit les
   demandes en attente au chargement de cet onglet, un rafraîchissement suffit pour une v1.

**Découpage en lots proposé** (ordre logique, à affiner avec Saar avant de coder — chaque lot
testable indépendamment) :
1. Voir/gérer son Vault (`VaultPage` + accès Dashboard, liste + renommage + suppression seuls)
2. Envoyer vers le Vault (bouton `CharacterWindow`/`DroneWindow`)
3. Demander un import (sélecteur de campagne + badge "en attente")
4. Traitement MJ (`SectionPlayers.jsx`)

**Nom retenu avec Saar : "Coffre"** — correction de trajectoire par rapport à la proposition initiale
"bouton Dashboard" : le Coffre est une **carte de plus dans la grille de campagnes existante**
(`.campaign-grid`), en première position, illustration fixe non modifiable (icône cadenas sur fond
dégradé, même motif visuel que les cartes "Créer"/"Rejoindre" déjà là). Onglet "Joueurs" de
`CampaignSettingsPage.jsx` confirmé libre pour le Lot 4 (historique Git remonté, aucun projet
documenté en collision).

### Lot 1 — codé et testé (voir/gérer son Coffre)

**Fichiers** : `client/src/pages/VaultPage.jsx` (nouveau), carte "Coffre" ajoutée dans
`DashboardPage.jsx` (première position de `.campaign-grid`), route `/vault` dans `App.jsx`, styles
`.vault-cover` dans `index.css`, section `vault.*` + `dashboard.vaultCard` dans `fr.json`.

**Testé — via un vrai navigateur** (Playwright piloté contre les serveurs déjà en cours, session
authentifiée par un cookie JWT réel, pas une simulation) :
- Capture d'écran du Dashboard : la carte "Coffre" apparaît bien en première position, avant les
  campagnes réelles, avec l'icône cadenas sur fond dégradé — visuellement distincte et cohérente
  avec le reste de la grille.
- Clic sur la carte → navigation correcte vers `/vault`.
- État vide affiché correctement quand le Coffre ne contient rien.
- Un vrai personnage cloné dans le Coffre (via la route déjà testée Étape 4) → apparaît
  correctement dans la liste avec son badge de type.
- **Renommage** testé en conditions réelles (remplissage du champ, `Enter`) → nom mis à jour à
  l'écran et persistant côté serveur.
- **Suppression** testée : modale de confirmation avec le texte d'avertissement prévu, confirmation
  → personnage disparu de la liste, retour à l'état vide.
- **Aucune erreur console** sur l'ensemble du parcours.
- `eslint` sur les fichiers touchés : 0 nouvelle erreur (les erreurs préexistantes de
  `DashboardPage.jsx` confirmées identiques avant/après via `git stash`).
- Nettoyage complet vérifié après coup (base revenue à 73 personnages / 0 `vaults`).

**Non testé** : Lots 2-4 (envoi vers le Coffre depuis une fenêtre de personnage, demande de
transfert, traitement MJ) — pas encore codés.

### Lot 2 — codé et testé (envoyer vers le Coffre)

**Fichiers** : `client/src/character/CharacterWindow.jsx` (bouton + handler, onglet Paramètres,
gaté sur `effectiveIsOwner`) et `client/src/character/DroneWindow.jsx` (même ajout — `isOwner`
n'était pas encore descendu en prop à `SettingsTab`, ajouté au passage), section `character.*`
étendue dans `fr.json` (`sendToVault`, `sendToVaultConfirm`, `sendToVaultSuccess`,
`sendToVaultError`).

**Écart volontaire par rapport à l'esquisse initiale** : le plan disait placer le bouton "à côté du
bouton Supprimer" en supposant qu'ils partageaient la même condition d'affichage. **Faux, vérifié en
lisant le code** : "Supprimer" est gaté sur `effectiveIsGm` (MJ uniquement), pas sur la propriété —
mon bouton a sa propre condition (`effectiveIsOwner`), positionnée juste au-dessus du bouton
Supprimer plutôt que "à côté".

**Testé — via un vrai navigateur, parcours complet réel** (session de jeu réelle, un vrai
personnage possédé par l'utilisateur test, pas une simulation) :
- Difficulté de test rencontrée et résolue : le premier personnage utilisé pour les tests
  précédents (Étapes 1-6) n'apparaît jamais dans la Sidebar/CharacterWindow réelle — trouvé en base
  qu'il n'a jamais été verrouillé (`wizard_locked_at` NULL malgré `creation_state='complete'`),
  invariant Session 139 qui cache tout personnage non verrouillé de la liste. Pas un bug du Lot 2 —
  reconfirmé que l'architecture protège bien ce cas (cf. Piège P6) ; changé de personnage de test
  pour un qui est réellement verrouillé.
- Ouverture d'un vrai personnage de campagne (Sidebar → Persos → clic) → onglet Paramètres → bouton
  "Envoyer vers le Coffre" visible.
- Clic → **vraie boîte de dialogue native interceptée**, texte pédagogique exact confirmé
  ("Une copie de ce personnage sera envoyée dans votre Coffre. Le personnage original reste ici,
  dans cette campagne — ce n'est pas un déplacement.").
- Confirmation → appel réel à `POST /char-sheet/:id/clone-to-vault` → message de succès affiché.
- **Vérifié en base réelle** : la copie existe bien avec `vault_id` renseigné ; le personnage
  original est resté inchangé (toujours dans sa campagne, `vault_id` null).
- Aucune erreur console sur tout le parcours.
- `eslint` : 0 nouvelle erreur sur les 2 fichiers (3 erreurs préexistantes de `DroneWindow.jsx`,
  sans rapport avec ce Lot, confirmées identiques avant/après via `git stash`).
- Nettoyage complet vérifié après coup.

**Non testé** : le parcours équivalent sur `DroneWindow.jsx` n'a pas été rejoué dans un vrai
navigateur (le code est structurellement identique à `CharacterWindow.jsx`, déjà validé, et la
logique de remise à neuf du drone — Piège P7 — était déjà testée au niveau service à l'Étape 3) —
sécurité obtenue par la relecture + le lint plutôt qu'un second clic réel, faute de temps.

### Lot 3 — codé et testé (demander un transfert)

**Fichiers** : `vaultService.js` (`listVaultCharacters` étendue — chaque personnage renvoie
désormais `hasPendingRequest`, calculé via une jointure sur `vault_transfer_requests` filtrée
`status='pending'`, plutôt que de laisser le client deviner), `VaultPage.jsx` (sélecteur de
campagne inline + badge), section `vault.*` étendue dans `fr.json`.

**Précision par rapport à l'esquisse** : un personnage peut, en théorie, avoir des demandes
`pending` vers plusieurs campagnes différentes en même temps (l'index partiel de l'Étape 2 autorise
ça). Décision prise au codage, pour rester simple en v1 : **dès qu'une seule demande est en
attente, le badge remplace le bouton** (pas de gestion de plusieurs demandes simultanées
visibles) — cohérent avec "chaque lot testable indépendamment, pas de sur-ingénierie prématurée".

**Testé — via un vrai navigateur, parcours réel complet** :
- Personnage réel placé dans le Coffre (route déjà testée), page `/vault` rechargée.
- Clic "Demander un transfert" → sélecteur affichant les vraies campagnes de l'utilisateur (2
  campagnes réelles listées correctement), bouton "Envoyer la demande" désactivé tant qu'aucune
  campagne n'est choisie.
- Sélection + envoi → **badge "En attente" affiché immédiatement**, bouton de demande disparu.
- **Vérifié en base réelle** : la ligne `vault_transfer_requests` existe avec `status='pending'`,
  `target_campaign_id` et `requested_by` corrects.
- Aucune erreur console. `eslint` : 0 erreur, 0 warning.
- Nettoyage complet vérifié après coup (y compris la demande, supprimée en cascade avec le
  personnage — comportement de l'Étape 2 confirmé une fois de plus en conditions réelles).

**Non testé** : l'approbation/le refus de cette demande côté MJ (Lot 4, pas encore codé) — vérifié
seulement que la demande existe correctement en base, pas son traitement complet de bout en bout
depuis l'interface.

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
- **P5** : `characters.type` et `visible` sur un clone Vault — `visible` doit être fixé
  explicitement (pas copié tel quel : un personnage en Vault n'a pas de carte, la colonne n'a pas de
  sens hors campagne). **Correction 2026-07-10 — ma confirmation précédente était fausse** :
  j'avais écrit "`type` fixé à `'pj'` en dur" en pensant qu'il n'y avait que 2 valeurs possibles.
  L'audit Étape 0 a trouvé une 3ᵉ valeur, `'drone'` (migration 71, `drone_sheet`) — un forçage en dur
  aurait silencieusement corrompu le type d'un drone cloné. **Règle corrigée : `type` est préservé
  tel quel depuis la source, jamais réécrit** — seule `visible` est neutralisée. Voir aussi la
  question ouverte sur le périmètre "drones" dans l'Étape 0 ci-dessus.
- **P6 (trouvé en relecture critique, 2026-07-10 ; affiné au Run à vide 2026-07-10)** :
  `routes/characters.js:74-79` **cache de la liste de personnages d'une campagne tout `char_sheet`
  dont `wizard_locked_at` est `NULL`** (invariant Session 139, *"ne jamais exposer un brouillon en
  cours"*). Un clone produit par `approveImport` sans ce champ posé serait **invisible dans la
  campagne cible sans aucune erreur**. **Décision initiale (dépassée)** : stamper systématiquement
  `wizard_locked_at` à la main, sans condition. **Révisée au Run à vide** : `creationService.js:632`
  a une fonction `lockWizard(sheetId)` déjà existante — **elle refuse explicitement** (`AppError
  400`) si `creation_state !== 'complete'`. La réutiliser telle quelle (au lieu d'écrire un
  contournement qui l'ignore) transforme ce garde-fou existant en validation utile : `cloneCharacterDeep`
  appelle `lockWizard(newSheetId)` pour le Groupe A, ce qui échoue proprement si la source n'était pas
  finalisée — cohérent avec la restriction ajoutée à la Décision 3 ci-dessus (un brouillon inachevé
  ne doit pas pouvoir rejoindre le Vault du tout). Pré-requis : `creation_state` doit être copié tel
  quel avec le reste de `char_sheet` (déjà le cas, colonne du Groupe A) avant l'appel à `lockWizard`.
  Vérification recommandée en amont de la transaction (fail-fast, message clair) plutôt que de laisser
  échouer au milieu du clonage.
- **P7 (Groupe B, trouvé en élargissant le périmètre aux compagnons, 2026-07-10)** :
  `drone_sheet.integrite_actuelle`/`damages` sont de l'état de combat courant, pas du "build" — un
  drone cloné avec ses dégâts de la bataille précédente serait incohérent avec l'idée de "modèle
  réutilisable" du Vault (le joueur qui exporte son drone vers une nouvelle campagne ne veut pas
  qu'il arrive déjà à moitié détruit). **Décision : `resetDroneIntegrity` (hook `onClone` du registre)
  remet `integrite_actuelle = integrite_max` et `damages = {}` sur toute copie produite**, même règle
  simple et sans cas particulier que P6 pour le Groupe A.

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
  ID inter-personnage caché trouvé, clone relationnel simple confirmé suffisant. Toujours aucun code
  écrit.
- **2026-07-10 (suite) — Étape 0 exécutée** : liste exhaustive réelle (16 tables à cloner dont 5
  absentes de la version précédente du plan — `char_pc_ledger`, `char_polaris`,
  `char_personal_advantages`, `character_macros`, la famille `drone_*` — + 3 à exclure). **Deux
  corrections issues de cet audit, pas de simples ajouts** : `char_creation_snapshot` n'existe plus
  (supprimée par la migration 102, la mention précédente pointait vers une table déjà morte) ; ma
  confirmation précédente du Piège P5 ("`type` fixé à `'pj'` en dur") était **fausse** —
  `characters.type` a une 3ᵉ valeur, `'drone'`, qu'un forçage en dur aurait silencieusement corrompue.
  Toujours aucun code écrit.
- **2026-07-10 (suite 2) — décision Saar sur le périmètre** : le Vault couvre PJ **et** compagnons —
  drones dès maintenant, exo-armures/vaisseaux à terme (aucun des deux n'existe encore en base,
  vérifié). Architecture retravaillée en conséquence : **registre `COMPANION_REGISTRY`** par
  `characters.type` (Groupe A `pj`/`pnj` = arbre `char_sheet`, Groupe B `drone` = `drone_sheet`/
  `drone_programs`/`drone_weapons`) plutôt qu'un cas spécial "drone" codé en dur — ajouter un futur
  type de compagnon devient une entrée de registre, jamais une réécriture de `cloneCharacterDeep`.
  Le garde-fou anti-dérive vérifie désormais l'union de toutes les entrées du registre, pas un seul
  groupe. Nouveau **Piège P7** : l'état de combat du drone (`integrite_actuelle`/`damages`) doit être
  remis à neuf à chaque clonage, sans quoi un compagnon exporté arriverait déjà endommagé. Toujours
  aucun code écrit — cette réécriture reste au niveau architecture/plan.
- **2026-07-10 (Étapes 1+2 codées, testées)** : migrations `129_vaults.js` (table `vaults` +
  `characters.vault_id` + `campaign_id` nullable + contrainte XOR) et
  `130_vault_transfer_requests.js` (+ `CHECK` de statut + index unique partiel anti-doublon, ajout
  non prévu dans l'esquisse initiale). Chaque migration testée en base réelle : scénarios
  d'insertion valides/invalides en transactions annulées, round-trip `down`/`up` byte-cohérent,
  aucune perte des 73 personnages existants. Détail dans les sections "Étape 1/2 — plan détaillé".
- **2026-07-10 — Run à vide (relecture libre, sans redémarrage serveur), 3 problèmes réels trouvés
  avant de coder l'Étape 3** : (1) le garde-fou anti-dérive tel que décrit ne cherchait que des
  colonnes nommées littéralement `character_id`/`char_sheet_id` — angle mort démontré par
  `vault_transfer_requests` (FK réelles vers `characters`, noms différents) qu'il aurait ratées ;
  corrigé pour chercher par contrainte FK réelle, pas par nom de colonne. (2) Cette même table,
  créée par l'Étape 2 de ce plan, manquait de la liste d'exclusion de l'Étape 0 — ajoutée, avec note
  que cette liste doit être revue à chaque table que ce plan ajoute lui-même. (3) Le plus important :
  `lockWizard()` (fonction déjà existante, jamais lue avant ce run à vide) **refuse explicitement un
  personnage non finalisé** — ma décision P6 ("stamper `wizard_locked_at` sans condition") l'aurait
  soit ignorée (réinventant la roue) soit se serait heurtée à elle si réutilisée telle quelle sans
  vérifier son comportement d'abord. Résolu en réutilisant `lockWizard()` sans modification (aucun
  contournement écrit) — ce qui a fait remonter une vraie question de produit : la Décision 3
  ("vers le Vault : libre") a été affinée pour exiger un personnage finalisé, pas seulement possédé,
  sans quoi un brouillon inachevé resterait bloqué indéfiniment dans le Vault. Toujours aucun code
  applicatif écrit (seulement les 2 migrations de schéma) — ce run à vide a corrigé le plan avant
  l'Étape 3, pas après.
- **2026-07-10 (suite 3) — plan détaillé de l'Étape 1 rédigé + relecture critique par la recherche**.
  Numéro de migration reconfirmé (128, pas 127 — un fichier est apparu entre-temps). Contenu exact de
  la migration écrit (table `vaults` + `characters.vault_id` + `campaign_id` nullable + CHECK),
  choix technique du SQL brut pour la nullabilité justifié par 2 précédents réels du projet (jamais
  le générateur knex sur une colonne avec FK). **Recherche demandée par Saar une 2ᵉ fois** : le motif
  utilisé (plusieurs FK nullables + CHECK) est un motif reconnu ("exclusive arc"), validé par une
  source dédiée comme le bon choix quand l'ensemble des parents possibles est fini et stable — c'est
  le cas ici. Aucun trou trouvé cette fois (contrairement aux 2 passes précédentes) — une divergence
  volontaire documentée (`ON DELETE CASCADE` sur le Vault vs `SET NULL` sur une campagne, justifiée
  par l'absence d'autre partie prenante sur un Vault). Toujours aucun code exécuté.
- **2026-07-10 (Étape 3 codée, testée) — `vaultService.js`**. Registre `COMPANION_REGISTRY`, garde-fou
  anti-dérive, clonage générique (`cloneRows`), les 7 fonctions de service, tous conformes au design
  déjà arrêté dans ce plan. Une modification ciblée de `creationService.lockWizard` (ajout `trxOpt`,
  pattern déjà établi ailleurs dans le projet, rétrocompatible) — nécessaire pour que le Piège P6
  fonctionne réellement en transaction, pas un contournement. **Testé en 3 vagues** : scénarios
  sandboxés (transaction toujours annulée) sur un vrai personnage complet et un vrai drone — toutes
  les tables du Groupe A comparées une à une (row count identique), rejet propre d'un personnage non
  finalisé, remise à neuf confirmée d'un drone endommagé ; puis scénarios réels avec nettoyage exact
  ensuite — chaîne complète `cloneToVault`→`requestImport`→`approveImport`/`rejectImport`, tous les
  refus attendus vérifiés (mauvais propriétaire, non-membre, non-MJ, doublon, déjà traité), **Piège
  P2 vérifié en conditions réelles** (demandeur retiré de la campagne entre la demande et
  l'approbation → rejeté). Base revenue à son état exact d'avant les tests (73 personnages, 0 Vault,
  0 demande, personnage source original intact). `node --check` 0 erreur ; pas d'ESLint côté serveur
  dans ce projet (vérifié, pas une omission). **Non testé** : aucune route HTTP (Étapes 4-6), rien
  testé via requête réseau ni navigateur.
- **2026-07-10 (Étapes 4-6 codées, testées) — routes HTTP `/api/vault/*` + `/api/char-sheet/
  :characterId/clone-to-vault`**. Avant de coder, vérification ciblée que le code existant de
  `char-sheet.js` ne suppose pas `campaign_id` toujours rempli (Étape 1 l'a rendu nullable) — son
  `router.param` échoue proprement (403, pas un crash) sur un personnage Vault, confirmé par lecture
  directe. **Testé pour de vrai en HTTP** (JWT signé localement, cookie réel, serveur réel, pas un
  appel direct aux fonctions) — parcours complet clone-to-vault→liste→détail→renommage→demande de
  transfert→approbation→refus→suppression, tous les refus attendus (mauvais propriétaire, doublon,
  pas de cookie), **défense en profondeur confirmée en conditions réelles** (un MJ authentifié ne
  peut pas vaulter le personnage d'un joueur, même si l'accès à sa fiche lui est ouvert par ailleurs).
  Nettoyage complet vérifié après coup, personnage source intact. Incident de test sans rapport avec
  le code livré (jeton JWT corrompu par une sortie stdout de `dotenv` dans le script bash de test) —
  isolé et corrigé côté outillage uniquement. **Les 6 étapes codées du plan (0 à 6) sont maintenant
  toutes faites et testées** ; seule l'Étape 7 (UI d'accès) reste, explicitement hors scope de ce
  plan (voir "Hors scope").
