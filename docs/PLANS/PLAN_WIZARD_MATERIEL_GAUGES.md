# Wizard/Fiche — Jauges de Matériel & liste d'attente (wish-list)

> Statut : **codé et validé en navigateur par Saar (2026-08-12)**. Document temporaire
> (`docs/RegleDocumentaire.md` Règle 10) — reste ici tant que la fonctionnalité n'est pas « stable en
> jeu réel » (usage en partie, pas seulement cette validation de développement) ; à archiver ou
> fusionner dans un DOMAIN/SYSTEM une fois ce seuil atteint.
> Suite de `docs/Old/PLAN_WIZARD_MATERIEL.md` (Step6 "Matériel & Biens", codé et confirmé le
> 2026-07-24) — ce document ne répète pas ce qui y est déjà tranché (portée diffusion inventaire,
> notes narratives, marqueur `step6`), il couvre uniquement l'extension discutée avec Saar le
> 2026-08-12.
>
> **Validation 2026-08-12 (détail `docs/JOURNAL8.md`)** : 3 bugs bloquants trouvés au premier test
> réel et corrigés — `ownerUserId` jamais renvoyé par `startCreation` (flux normal du joueur), donc
> `canEdit` toujours faux pour un joueur sur son propre personnage ; `Step4Experience.jsx` sautait la
> sous-étape "Avantages & Revers" pour un brouillon repris avec carrières déjà choisies, empêchant
> tout Pro-Avantage "Matériel" d'être choisi donc toute jauge d'être semée ; bouton "Ajouter"
> (`InventoryPanel.jsx`) quasi invisible, remis en avant. Non testé dans cette passe : +/- MJ sur une
> jauge (code vérifié correct, pas de clic confirmé par Saar), `GaugesPanel.jsx` fiche permanente
> (seul le parcours Wizard Step6 a été confirmé).

---

## 0. Objectif et décisions actées (discussion Saar, 2026-08-12)

Constat de départ : sur Step6, le joueur n'a aujourd'hui **aucun droit** (`canEdit`/`isGm` valent
tous deux `isGmView` dans `StepMaterielEtBiens.jsx`) — il ne peut ni ajouter, ni même déplacer/
équiper ses propres objets. Saar veut un flux où le joueur construit librement une liste d'objets
souhaités, que le MJ valide ou refuse un par un, en échange de jauges qu'il gère lui-même.

Décisions actées, dans l'ordre où elles ont été discutées :

1. **Joueur** : mêmes droits que le MJ sur `InventoryPanel` (filtre catalogue existant, ajout
   libre). Construit son inventaire comme il veut.
2. **Deux champs à afficher, absents du formulaire actuel malgré leur existence en base** :
   `description` (catalogue `ref_equipment`) et `caliber` (armes, pour identifier la munition à
   apporter).
3. **MJ** : bouton "Validé" à côté de Supprimer, par item. Désaccord = suppression — pas de
   troisième état "refusé" (cohérent avec la décision déjà actée, suppression libre sans
   restriction, `PLAN_WIZARD_MATERIEL.md` §0 point 5 : *"le jeu de rôle se joue sur la
   confiance"*).
4. **Blocage** : si le joueur n'a proposé aucun objet, il peut continuer sans action MJ (comportement
   "jamais bloquant" préservé dans ce cas précis). S'il a proposé au moins un objet, il est bloqué
   tant qu'il en reste un non validé. Le MJ n'est lui jamais bloqué.
5. **Jauges (MATERIEL, BAR, ATELIER, CABINE, etc.)** : passent de "calculées en lecture seule
   à chaque rendu" à une vraie ressource de personnage. Valeur de départ = le total déjà affiché
   aujourd'hui (théorique, calculé depuis les avantages professionnels de l'étape 4). Une fois
   initialisée, entièrement gérée par le MJ (+/-), **indépendante** : ne se resynchronise jamais
   automatiquement, même si le joueur retouche l'étape 4 plus tard.
6. **Extension de portée actée avec Saar** : ces jauges sont RAW dépensées en cours de partie
   (`docs/REGLES/AVANTAGES PROFESSIONNELS.md` — ex. *"Pharmacie personnelle réduit d'1 point après
   usage"*), et `docs/ROADMAP.md:177` liste déjà *"Matériel → objets réels (conversion dans
   inventaire)"* comme dette non traitée. Plutôt qu'un gadget Step6-only à reprendre plus tard, la
   ressource devient permanente : visible et modifiable à la fois dans le Wizard (Step6) et sur la
   fiche de personnage définitive.

---

## 0bis. Recherches menées avant de figer ce plan (2026-08-12)

1. **`char_traits`/`gauge_delta` non réutilisable** — entièrement vidé et recalculé à chaque
   réconciliation de l'étape 4 (`creationService.js:921` puis `:1236`), aucune persistance
   incrémentale. Un ajustement MJ y serait silencieusement perdu au moindre retour du joueur sur
   l'étape 4. Écarté.
2. **`char_pc_ledger` écarté** — écrit en bloc par le même cycle de réconciliation Step1-5
   (migrations 97, 236), scope strictement PC. Mauvais candidat pour une donnée MJ post-création.
3. **Précédent de forme confirmé** : `char_attributes`/`char_skills` (migration 36) — lignes
   normalisées `(char_sheet_id, clé, valeur)`, PAS de jsonb. Patron à suivre pour la nouvelle table
   (cohérent avec l'usage déjà établi du projet pour "un ensemble de valeurs numériques nommées par
   personnage").
4. **Autorité MJ déjà standardisée** dans `char-sheet.js` — `router.param('characterId', ...)`
   résout `req.isGm` une fois pour toutes les routes, chaque handler mutant garde avec
   `if (!req.isGm) throw new AppError(403, ...)` (ex. lignes 679, 795, 1055). Nouvelle route à
   greffer sur le même router, même patron, aucune nouvelle authority à inventer.
5. **Rien n'auto-peuple `char_inventory` avant Step6** (vérifié : aucun insert dans
   `creationService.js`/`advantageService.js`) — la condition de blocage "tout item non validé
   bloque" est sûre, pas de faux-positif au premier accès à l'étape.
6. **`PRO_ADV_CATEGORY_RULE_KEYS` n'est pas exhaustif**, volontairement (catégories sans source RAW
   confirmée exclues, cf. commentaire en tête du fichier). Réutiliser le même repli déjà en place
   dans `StepMaterielEtBiens.jsx` (`PRO_ADV_CATEGORY_RULE_KEYS[raw] ?? raw`) pour la clé de
   catégorie des jauges — ne pas étendre ce fichier ici, hors périmètre.
7. **`isOwner` indisponible aujourd'hui** dans `StepMaterielEtBiens.jsx` — `ownerUserId`/`user.id`
   ne sont pas transmis depuis `WizardCreation.jsx` (appel du composant, lignes ~365-372). À
   ajouter.
8. **Emplacement fiche permanente** : onglet "Matériel" existant (`CharacterWindow.jsx:445-486`),
   déjà hôte d'`InventoryPanel`. Nouveau composant à insérer là, pas un nouvel onglet. Note
   historique à respecter : une grille 2 colonnes y a déjà été tentée et rejetée le 2026-08-05
   ("bloc trop massif, silhouette écrasée") — le nouveau bloc doit rester compact.
9. **Patron socket à suivre** : `SOLS_UPDATED` (`shared/events.js`, `useCharacterSocket.js:71-87`)
   — écrit directement dans `characterStore` sans refetch. Même patron pour le nouvel événement
   jauges.
10. **`caliber` : condition d'affichage trouvée dans le code existant, pas à deviner** —
    `inventoryService.js:157` documente déjà la convention : `caliber non null` = l'objet est une
    arme à munitions (utilisé pour la validation de compatibilité munition/arme, lignes 577-645).
    Afficher le champ `caliber` dès que `selectedRef.caliber != null`, aucun test sur
    `family`/`category` nécessaire.

---

## 1. Schéma (migration à créer — numéro exact vérifié au moment de coder, prochain libre après 240)

```js
// char_gauges — ressource de personnage, jamais touchée par le cycle de réconciliation Step1-5
exports.up = async knex => {
  await knex.schema.createTable('char_gauges', t => {
    t.uuid('char_sheet_id').notNullable().references('id').inTable('char_sheet').onDelete('CASCADE')
    t.text('category_key').notNullable()
    t.integer('value').notNullable().defaultTo(0)
    t.primary(['char_sheet_id', 'category_key'])
  })
  // Décision Saar 2026-08-12 (§10) : une jauge ne peut jamais devenir négative. Backstop DB en plus
  // du clamp serveur (§3) — même patron que chk_inventory_quantity (migration 50_char_inventory.js).
  await knex.raw(`
    ALTER TABLE char_gauges
      ADD CONSTRAINT chk_gauges_value_non_negative CHECK (value >= 0)
  `)

  // char_inventory — statut de validation MJ
  await knex.schema.alterTable('char_inventory', t => {
    t.boolean('validated_by_gm').notNullable().defaultTo(false)
  })
}
```

---

## 2. Serveur — seed idempotent des jauges (`creationService.js`)

Upsert `char_gauges` avec `ON CONFLICT (char_sheet_id, category_key) DO NOTHING`, **après** la
boucle carrières (pas dans chaque itération) : agrégé sur `careersData` en entier avant l'upsert,
même réduction que le total théorique déjà affiché côté client (`StepMaterielEtBiens.jsx`, `totals[key]
= (totals[key] ?? 0) + points`). N'écrit **que** les catégories jamais vues pour ce personnage — ne
touche jamais une ligne déjà présente. Garantit l'indépendance (décision §0 point 5) même si le
joueur ajoute une nouvelle carrière plus tard (nouvelle catégorie = nouvelle ligne insérée ;
catégorie déjà vue = inchangée, même si le total théorique a changé entretemps).

**Implémenté 2026-08-12** : deux corrections trouvées en codant, pas anticipées par le texte
ci-dessus au moment de l'écrire.
- **Agrégation obligatoire hors boucle** : un upsert par carrière (dans la boucle, un
  `ON CONFLICT DO NOTHING` par itération) aurait fait gagner la première carrière traitée et perdre
  silencieusement la suivante quand deux carrières contribuent à la même clé normalisée (ex.
  "Cache/Planque" + "Planque/Cache" chez deux métiers différents du même personnage, même règle LdB)
  — au lieu de les additionner comme le fait le total théorique. Toujours sommer sur `careersData`
  entier d'abord, upsert une seule fois ensuite.
- **`PRO_ADV_CATEGORY_RULE_KEYS` déplacé vers `shared/`** : la carte vivait dans
  `client/src/components/creation/proAdvCategoryRuleKeys.js`, inatteignable depuis le serveur.
  Déplacée en `shared/proAdvCategoryRuleKeys.js` (même patron que `shared/careerAdvantages.js`,
  déjà importé des deux côtés) — sans ça, `creationService.js` n'a aucun moyen d'appliquer la même
  normalisation que le client, et "Cache/Planque"/"Planque/Cache" sèderaient deux lignes `char_gauges`
  distinctes pour ce que le joueur voit comme une seule jauge. Les deux importeurs client
  (`StepMaterielEtBiens.jsx`, `ProAdvantagesAndSetbacks.jsx`) mis à jour en conséquence.

---

## 3. Serveur — routes (`char-sheet.js`, partagées Wizard + fiche permanente)

- **Ajout trouvé en codant (2026-08-12), absent du texte initial** : `GET
  /char-sheet/:characterId/gauges` — sans elle, `characterStore.gaugesByCharId` ne se peuple jamais
  au premier chargement (`GAUGE_UPDATED` ne notifie que les changements ultérieurs, jamais l'état
  initial). Même précédent que `GET .../inventory` (`inventoryDataSync.js`/`useInventoryData.js`) —
  propre + owner ou MJ, retourne `{ gauges: [{category_key, value}] }`.
- `PATCH /char-sheet/:characterId/gauges/:categoryKey` `{ delta }` — MJ only, émet `GAUGE_UPDATED`.
  Décision Saar 2026-08-12 : une jauge ne peut pas descendre sous 0. Le service clampe le résultat à
  `Math.max(0, value + delta)` (jamais bloquant/erreur pour un MJ qui clique "-" en rab — cohérent
  avec la philosophie "jamais bloquant" déjà en place ailleurs dans ce chantier) ; le
  `CHECK (value >= 0)` en base (§1) reste le filet de sécurité contre une course entre deux écritures
  concurrentes, jamais le mécanisme normal.
- Item : ajout du champ `validated_by_gm` à l'update existant. **Dérivé serveur uniquement, jamais
  accepté du payload client tel quel** (analyse critique 2026-08-12 — sans ça un joueur s'auto-valide
  par un simple PUT, la route actuelle n'a aucune garde `isGm`, vérifié `char-sheet.js:1092`) :
  - `POST /:characterId/inventory` (`addItem`) : la route passe `req.isGm` au service, qui fixe
    `validated_by_gm = req.isGm` à l'insertion — un item inséré en contexte MJ part directement à
    `true`, jamais lu depuis `req.body`.
  - **Fusion de stack** (`inventoryService.js:372-378`, item déjà existant même équipement/
    container/slot) : sans règle explicite, un joueur peut ajouter une quantité arbitraire sur une
    ligne déjà validée une fois sans jamais repasser par le MJ (la fusion ne touchait pas
    `validated_by_gm`). Règle retenue : à la fusion, `validated_by_gm = req.isGm` — la ligne reflète
    toujours le rôle du dernier auteur, jamais un statut hérité d'un ajout précédent d'un autre rôle.
  - `PUT /:characterId/inventory/:itemId` : la route rejette `validated_by_gm` dans le payload si
    `!req.isGm` (403) — seul le MJ peut faire passer un item à `true`.
  - **Colonnes de lecture** (analyse critique 2026-08-12, 2e passe) : `getInventory` et
    `getItemWithRef` (`inventoryService.js:88-113` et `:195-230`) énumèrent leurs colonnes en dur
    (aucun `select('*')`) — `char_inventory.validated_by_gm` doit être ajouté aux deux listes, sinon
    le client ne reçoit jamais le champ et `pendingCount` (§4/§5) reste bloqué en permanence
    (`item.validated_by_gm` toujours `undefined`, donc toujours compté comme non validé). Vérifié en
    revanche que `ref_description` (ligne 229) et `ref_caliber` (lignes 118, 223) sont **déjà**
    sélectionnés dans les deux requêtes et déjà renvoyés par `GET /equipment` (`equipment.js:68`) —
    §4 point "Afficher description/caliber" est un pur ajout JSX (`ItemRow` + panneau de
    confirmation), aucune requête serveur à étendre pour ces deux champs.
- **Portée de diffusion `GAUGE_UPDATED`** (analyse critique 2026-08-12, 2e passe) : le précédent
  cité en §0bis point 9 (`SOLS_UPDATED`) ne couvre que l'écriture directe en store, pas la portée de
  diffusion — vérifié que `PUT .../sols` n'est jamais atteignable pendant le Wizard (aucun import
  `InventoryBanner`/`WeaponPanel` dans `client/src/components/creation/`), donc `SOLS_UPDATED`
  n'a jamais eu besoin du scoping wizard-brouillon. Les jauges, elles, sont éditées dès Step6 (§5,
  stepper dans `StepMaterielEtBiens`) — même situation que les 5 routes inventaire qui utilisent
  toutes `resolveInventoryBroadcastRoom(characterId, campaignId)` (`char-sheet.js:1047-1051`)
  précisément pour ne pas révéler l'existence d'un brouillon à toute la room de campagne
  (`PLAN_WIZARD_MATERIEL.md §2`). La route `PATCH .../gauges/:categoryKey` doit réutiliser le même
  helper, pas diffuser directement sur `req.character.campaign_id` comme le fait `PUT .../sols`.

---

## 4. Client — `InventoryPanel.jsx`

- Afficher `description` (panneau de confirmation d'ajout + ligne d'objet dans la liste).
- Afficher `caliber` conditionné à `selectedRef.caliber != null` (§0bis point 10).
- Bouton "Validé" à côté de Supprimer — visible MJ only, seulement sur les items
  `validated_by_gm=false` (un item déjà validé affiche un badge statique, pas un bouton actionnable
  — pas la peine de faire re-cliquer le MJ sur ses propres ajouts).
- **Correction analyse critique 2026-08-12** : le bloc "Ajouter" (catalogue + recherche) est
  aujourd'hui gated sur `isGm` (`InventoryPanel.jsx:328`, `{isGm && (...)}`), pas `canEdit` — avec
  `canEdit = isGmView || isOwner` (§5) mais `isGm` inchangé, le joueur garderait `canEdit=true` /
  `isGm=false` et le bouton resterait invisible pour lui, contredisant la décision §0.1. Ce bloc doit
  passer sur `canEdit` ; seul le bouton "Validé" par item reste gated `isGm`.
- Pas de nouveau callback `onPendingCountChange` : `StepMaterielEtBiens.jsx` doit calculer
  `pendingCount` en appelant directement `useInventoryData(characterId)` (`useInventoryData.js` est
  déjà une façade store dédupliquée, relue par `InventoryPanel` via le même hook — même donnée, pas
  de second fetch, pas de callback impératif dupliquant un état déjà partagé par le store).

---

## 5. Client — `StepMaterielEtBiens.jsx`

- `canEdit = isGmView || isOwner` (nécessite `ownerUserId`/`user.id` transmis depuis
  `WizardCreation.jsx`, §0bis point 7). `isGm` reste `isGmView` seul.
- Stepper +/- par jauge, visible MJ only.
- `pendingCount = useInventoryData(characterId).items.filter(i => !i.validated_by_gm).length` (§4,
  même hook que `InventoryPanel`, pas de callback). "Suivant" du joueur désactivé si
  `pendingCount > 0` ; le MJ n'est jamais bloqué (comportement existant préservé pour lui).

---

## 6. Client — nouveau composant fiche permanente

- `client/src/character/GaugesPanel.jsx` (nom à confirmer) — affiche les jauges `char_gauges`,
  stepper MJ only, inséré dans l'onglet Matériel de `CharacterWindow.jsx` à côté d'`InventoryPanel`
  (§0bis point 8). Rester compact — pas de grille 2 colonnes.
- `characterStore.js` : nouvelle slice `gaugesByCharId` (`{ [charId]: { [categoryKey]: value } }`),
  `setGauges` (remplacement complet, premier chargement) + `setGauge` (écriture incrémentale MAJ/WS),
  même patron que `solsByCharId`/`setSols`.
- **Trouvé en codant (2026-08-12), absent du texte initial** : deux fichiers de façade store
  nécessaires pour peupler `gaugesByCharId` au premier chargement (§3, `GET .../gauges`) — même
  patron que `inventoryDataSync.js`/`useInventoryData.js` :
  - `client/src/lib/gaugesDataSync.js` (création) — `populateGauges(characterId)`, dédup par
    characterId, appelable hors composant (handlers WS).
  - `client/src/lib/useGaugesData.js` (création) — façade React, fetch initial si absent, consommée
    par `GaugesPanel.jsx` ET `StepMaterielEtBiens.jsx` (`pendingCount`, §5, réutilise déjà
    `useInventoryData` — pas de rapport avec ce hook-ci, deux ressources distinctes).
- `useCharacterSocket.js` (fiche permanente) : handler `GAUGE_UPDATED` → `setGauge`, écriture
  directe sans refetch.
- **Trouvé en codant** : `useWizardInventorySync.js` (Wizard Step6) doit **aussi** écouter
  `GAUGE_UPDATED` — pas seulement `useCharacterSocket.js`. Les deux hooks sont indépendants
  (`useWizardInventorySync` couvre le Wizard, `useCharacterSocket` la fiche permanente, aucun des
  deux n'englobe l'autre) et les jauges sont éditables dès Step6 (§5) — sans ce handler, deux
  onglets Wizard ouverts en simultané (MJ + joueur) ne se synchroniseraient pas en direct sur les
  jauges alors qu'ils le font déjà sur l'inventaire/les sols.

---

## 7. `shared/events.js`

Nouvel événement : `GAUGE_UPDATED: 'gauge:updated'`.

---

## 8. Fichiers prévus (un à la fois, comme pour les chantiers précédents)

| Fichier | Nature | Détail |
|---|---|---|
| Migration NNN | Création | `char_gauges` + `char_inventory.validated_by_gm` |
| `shared/events.js` | Modification | `GAUGE_UPDATED` |
| `server/src/services/creationService.js` | Modification | Seed idempotent §2 |
| `server/src/routes/character/char-sheet.js` | Modification | Routes §3 |
| `client/src/stores/characterStore.js` | Modification | Slice jauges |
| `client/src/lib/gaugesDataSync.js` | Création | `populateGauges` (trouvé en codant, §6) |
| `client/src/lib/useGaugesData.js` | Création | Façade React (trouvé en codant, §6) |
| `client/src/lib/useCharacterSocket.js` | Modification | Handler `GAUGE_UPDATED` |
| `client/src/lib/useWizardInventorySync.js` | Modification | Handler `GAUGE_UPDATED` côté Wizard (trouvé en codant, §6) |
| `shared/proAdvCategoryRuleKeys.js` | Déplacement | Depuis `client/.../creation/`, réutilisé server (§2) |
| `client/src/character/InventoryPanel.jsx` | Modification | §4 |
| `client/src/components/creation/StepMaterielEtBiens.jsx` | Modification | §5 |
| `client/src/components/creation/WizardCreation.jsx` | Modification | Calcule `isOwner` (ownerUserId déjà dans creationStore, comparaison déjà faite ligne ~103) et le transmet — pas besoin de faire remonter `user.id` séparément |
| `client/src/character/GaugesPanel.jsx` | Création | §6 |
| `client/src/character/CharacterWindow.jsx` | Modification | Insertion `GaugesPanel` |
| `client/src/locales/creation.json` + `charSheet.json` | Modification | Nouvelles clés |

---

## 9. Hors périmètre

- Extension de `PRO_ADV_CATEGORY_RULE_KEYS` aux catégories sans source RAW confirmée.
- Statut "refusé" distinct de "supprimé".
- Toute mécanique de dépense automatique des jauges pendant une session (le MJ reste seul juge,
  ajustement manuel uniquement — cohérent avec `PLAN_WIZARD_MATERIEL.md` §0, *"décompte purement
  narratif"*).

---

## 10. Tranché

- Une jauge ne peut pas descendre sous 0 (décision Saar 2026-08-12). Clamp serveur dans la route
  `PATCH .../gauges/:categoryKey` (§3) + `CHECK (value >= 0)` en base (§1) en filet de sécurité.
