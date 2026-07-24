Wizard — Matériel & Biens (MJ)

> Statut : **codé et confirmé fonctionnel par Saar (2026-07-24)**, y compris 4 correctifs post-livraison
> (noms de profession disparaissant au Récap Step4, bouton MJ absent sur Step6, placeholder, ajout à
> la fiche permanente — détail `docs/EN_COURS.md` Item 106). Suite explicite de
> `docs/PLAN_WIZARDCOLLAB.md §0.5` (Lot C, hors périmètre de ce document-là : "un outil MJ pour
> transformer les jauges d'Avantages Professionnels en effets concrets — chantier réel et voulu, mais
> responsabilité distincte, à documenter dans un PLAN séparé"). Document temporaire
> (`docs/RegleDocumentaire.md` Règle 10) — à archiver une fois confirmé stable en jeu réel.

---

## 0. Objectif et décisions (2026-07-24)

Donner au MJ un outil pour convertir les jauges d'Avantages Professionnels (MATERIEL, BAR, ATELIER,
CABINE, etc., déjà acquises en Step4) en objets d'inventaire concrets et en biens non matériels notés
en texte libre. Décompte **purement narratif** — aucune validation mécanique, le MJ juge seul de ce
qu'un objet "coûte" en jauge (décision Saar : "c'est le MJ qui décide si un pistolet mitrailleur coûte
1 point de MATERIEL ou 51").

**Emplacement — étape dédiée, pas une sous-étape (décision Saar validée après discussion)** :
nouveau `step === 6` "Matériel & Biens" dans `WizardCreation.jsx`, entre Step5 (Avantages) et l'écran
Review (actuel `step===6`, devient `step===7`). Raisons : Step5Advantages.jsx n'a aucune mécanique de
sous-étapes (contrairement à Step4) ; cet écran est piloté par le MJ, sans budget PC à faire respecter,
mismatch d'acteur avec les steps joueur existants. **Jamais bloquant** pour le joueur — "Suivant"/
"Terminer" toujours disponible, avec ou sans action MJ (décision Saar explicite).

**Verrouillage — décalé, pas supprimé.** `lockWizard` continue de se déclencher au bouton "Terminer"
de l'écran Review (désormais `step===7`) — insertion d'une étape supplémentaire avant, rien à changer
côté `reconcileCreation`/`lockWizard` eux-mêmes pour ce point précis.

**Architecture — pas de `step6Data`, pas de payload métier.** Contrairement aux steps 1-5
(client-primary, buffer Zustand + `reconcile`), les deux actions de cette étape (ajouter un objet,
ajouter une note) **écrivent immédiatement en base** via des endpoints déjà existants et déjà
autorisés (`POST /char-sheet/:characterId/inventory`, `.../advantage-notes`) — même modèle que
`InventoryPanel.jsx`/`AdvantagesPanel.jsx` sur la fiche permanente. Rien à wiper/réappliquer, rien à
verrouiller côté données pour ce step.

**Analyse à charge menée en 3 passes (2026-07-24) — corrections actées ci-dessous**, pas de simple
relecture cosmétique :

1. **Portée de diffusion `InventoryPanel`** — corrigée (§2).
2. **Rafraîchissement live de `InventoryPanel` dans le Wizard** — trou réel trouvé (`useCharacterSocket.js`
   n'est monté qu'à `SessionPage.jsx`, jamais dans l'arbre du Wizard ; `InventoryPanel.jsx` n'a aucun
   listener propre, dépend intégralement d'un `reloadKey` fourni par le parent) — corrigé (§4).
3. **Suivi MJ de la transition Step6→Review** — le canal éphémère `WIZARD_LIVE_UPDATE` (Lot A4) a un
   contrat précis (brouillon de champ, jamais persistant, jamais faisant autorité) ; y glisser un
   signal de navigation l'aurait détourné. Corrigé en réutilisant le pipeline `reconcile`/
   `WIZARD_STATE_SYNC` déjà construit et validé, avec un marqueur qui ne persiste rien (§3) — **et
   seulement au niveau de la route**, jamais dans `reconcileCreation` elle-même (fonction déjà massive
   et auditée, pas un endroit pour un cas qui ne persiste rien).
4. **Notes narratives vs possessions mélangées** — `char_advantage_notes` est aujourd'hui une liste
   générique partagée avec le "Autres" narratif d'`AdvantagesPanel.jsx`. Corrigé par une colonne
   discriminante plutôt qu'une table dupliquée (§5).
5. **Suppression des notes** — vérifié : `DELETE /advantage-notes/:id` n'a aucune garde `isGm`,
   n'importe qui avec accès en édition peut tout supprimer, aucune colonne d'auteur. Décision Saar,
   explicite : **ne pas restreindre** — "le jeu de rôle se joue sur la confiance."
6. **MJ hors-ligne qui rouvre après coup** — `loadExistingSheet` calcule `highestStep` par présence
   de données par step ; Step6 ne persistant rien, ce calcul à froid ne peut jamais détecter qu'il a
   été dépassé (fenêtre étroite mais réelle : joueur resté sur Review sans cliquer "Terminer", MJ
   recharge sa page pendant ce temps). Corrigé en réutilisant `char_sheet.creation_state` — colonne
   déjà existante, posée à `'draft_step0'` au départ et jamais mise à jour depuis (§3bis) — pas une
   donnée métier, un marqueur de progression, cohérent avec le principe "Step6 ne persiste rien de
   métier".
7. **Où vit le nouveau listener d'inventaire** — pas dans `WizardLockSync.jsx` (déjà 4 responsabilités :
   verrous, état durable, brouillon live, `emitLiveRef`) — nouveau composant dédié, même patron
   (composant sans rendu, monté sous `<SocketProvider>`), filtré par `characterId` (Socket.IO ne
   filtre pas côté client par room — le même socket reçoit aussi les événements de la room de
   campagne, toujours rejointe) — détail §4.

---

## 0bis. Recherche externe (2026-07-24, avant de figer le plan)

Vérification demandée par Saar : ne pas concevoir "de zéro" sans regarder comment des outils
professionnels du même domaine résolvent le même problème.

- **Foundry VTT** (VTT professionnel dominant du marché, doc officielle vérifiée
  [foundryvtt.com/article/items](https://foundryvtt.com/article/items/)) : octroi d'objet = glisser
  l'objet depuis le répertoire vers la fiche du personnage. **Aucune validation automatique de
  coût/budget documentée** — "système permissif laissant la validation complètement à l'appréciation
  du MJ." Les objets narratifs/possessions non standards passent par des types d'objets personnalisés
  du système installé, pas un mécanisme séparé. **Confirme directement** la décision Saar §0
  ("purement narratif, à l'appréciation du MJ") — ce n'est pas une simplification par manque de temps,
  c'est le modèle dominant du domaine.
- **Portée de diffusion scopée à l'état du document (brouillon vs publié)** : déjà établi et sourcé
  dans `PLAN_WIZARDCOLLAB.md §0` (Figma, Liveblocks, Notion, Yjs — granularité "une ressource = un
  canal dédié") — §2 de ce document applique le même principe déjà audité, pas une nouvelle recherche
  isolée à refaire.
- **Colonne discriminante pour deux entités de même forme** (§5) : patron relationnel standard
  ("single-table inheritance" / colonne de type), utilisé dans la plupart des ORM matures (Rails STI,
  Django proxy models) pour éviter de dupliquer une structure identique dans deux tables — pas une
  invention locale à ce projet.

---

## 1. Recap des jauges (lecture seule)

`step4Data.careers[].proAdvantages` est déjà dans le store (`getStep4State`, vérifié — renvoie
`proAdvantages: c.pro_advantages ?? {}` par carrière). Nouveau composant qui agrège ces valeurs par
catégorie (somme toutes carrières confondues) et les affiche — aucune écriture, aucune donnée serveur
supplémentaire.

**[À VÉRIFIER avant de coder ce composant précis, pas avant le reste du plan]** : source exacte des
libellés affichables des catégories (`ref_career_point_categories` — vérifier si un même nom de
catégorie désigne bien la même chose d'une carrière à l'autre, pas supposé).

Visible au joueur aussi (pas MJ-only) — transparence sur "combien de jauge le personnage a
théoriquement", cohérent avec la nature purement narrative du décompte (§0).

---

## 2. Portée de diffusion inventaire — correction à la source

`char-sheet.js` (routes inventaire : `addItem`, `updateItem`, delete, reload, quick-equip) diffuse
aujourd'hui toujours à `req.character.campaign_id` — contraire au principe déjà posé par
`PLAN_WIZARDCOLLAB.md §2.1` ("diffusion scopée par fiche, jamais la room de campagne", évite qu'un
membre de la campagne non impliqué apprenne qu'un brouillon existe).

**Correction, à la source, pas une rustine locale à ce chantier** : quand le personnage cible est
encore un brouillon actif (`char_sheet.wizard_locked_at IS NULL`), diffuser à `wizard:<sheetId>` au
lieu de `campaign_id` ; comportement inchangé (`campaign_id`) pour un personnage fini, en jeu réel.
Bénéfice général, pas spécifique à Step6 : corrige aussi tout futur outil qui toucherait l'inventaire
d'un brouillon.

Nécessite une résolution `char_sheet_id`/`wizard_locked_at` depuis `characterId` dans ces routes — un
lookup de plus par écriture, coût négligible (pas un chemin chaud).

---

## 3. Marqueur `step6` — réutilisation du pipeline reconcile/STATE_SYNC

**Uniquement dans `routes/creation.js`, jamais dans `creationService.js#reconcileCreation`.**

Au clic "Suivant" de Step6 (aucune donnée à soumettre), le client appelle `POST /:sheetId/reconcile`
avec `{ step6: true }`. La route :

```js
const { step1, step2, step3, step4, step5, step6, finalize } = req.body
const result = await reconcileCreation(sheetId, { step1, step2, step3, step4, step5, finalize }, isGm)
// step6 n'est JAMAIS passé à reconcileCreation — rien à y persister, la fonction reste ignorante
// de ce step (§0 point 3).
const updatedSteps = { ...étapes existantes... }
if (step6) updatedSteps.step6 = true
// + marqueur de progression (§3bis)
if (step6) await db('char_sheet').where({ id: sheetId }).update({ creation_state: 'step6_done' })
```

Diffusé via `WIZARD_STATE_SYNC` exactement comme les steps 1-5 (même mécanisme, aucun nouvel
événement). Côté client, `applyStateSync` (déjà dans `creationStore.js`) étend sa boucle de calcul de
`highestStep` :

```js
for (const key of ['step1', 'step2', 'step3', 'step4', 'step5', 'step6']) {
  if (steps[key]) hs = Math.max(hs, key === 'step6' ? 7 : Number(key.slice(4)) + 1)
}
```

### 3bis. `char_sheet.creation_state` — marqueur de progression pour la réouverture à froid

Colonne déjà existante (posée à `'draft_step0'` au démarrage, jamais mise à jour depuis). Mise à jour
à `'step6_done'` quand la route reconcile reçoit `step6` (ci-dessus). `getStep1State`… n'a pas besoin
de la lire (pas une donnée d'étape) — seul `loadExistingSheet` (store) et `GET /:sheetId/state`
(route, à étendre pour renvoyer `creationState`) s'en servent pour corriger l'heuristique
`highestStep` à froid :

```js
if (creationState === 'step6_done') highestStep = Math.max(highestStep, 7)
```

Pas une donnée métier (aucun impact sur ce qui est réellement affiché), purement un indice de
progression — cohérent avec le principe "Step6 ne persiste rien de métier" (§0).

---

## 4. Rafraîchissement live d'`InventoryPanel` dans le Wizard

`InventoryPanel.jsx` n'a aucun listener socket propre — il dépend d'un prop `reloadKey` fourni par le
parent. Dans la fiche permanente, ce `reloadKey` vient de `useCharacterSocket.js` (monté à
`SessionPage.jsx` uniquement) — absent de l'arbre du Wizard. Sans correction, ni le MJ ni le joueur ne
verraient un ajout d'objet apparaître sans rouvrir l'écran.

**Nouveau composant sans rendu, même patron que `WizardLockSync.jsx`** (monté sous
`<SocketProvider>`), responsabilité unique : écouter `WIZARD_LOCKS_SYNC`... non — écouter
`INVENTORY_ADDED`/`INVENTORY_UPDATED`/`INVENTORY_REMOVED`, **filtrer par `characterId`** (Socket.IO ne
filtre pas côté client par room — le même socket reçoit aussi les événements de la room de campagne,
toujours rejointe via `SESSION_JOIN` — un filtre défensif est nécessaire, même motif que le filtre
`sheetId` déjà en place dans `WizardLockSync.jsx`), incrémente un compteur local exposé comme
`reloadKey` à `InventoryPanel`.

Pas fusionné dans `WizardLockSync.jsx` (déjà 4 responsabilités : verrous, état durable, brouillon live,
`emitLiveRef`) — nouveau fichier dédié.

---

## 5. Notes narratives vs possessions — colonne discriminante

`char_advantage_notes` (migration 124) reste la seule table — ajout d'une colonne `category` (`TEXT`,
défaut `'narrative'`, nouvelle valeur `'possession'`). Patron standard (colonne discriminante) pour
deux entités de même forme (texte + horodatage) qui ne doivent pas se mélanger à l'affichage, plutôt
qu'une table/API dupliquée pour la même structure de donnée.

- `AdvantagesPanel.jsx` (fiche permanente, bloc "Autres") : filtre `category = 'narrative'`
  explicitement (comportement inchangé pour l'utilisateur, migration transparente).
- Nouveau composant Step6 : filtre `category = 'possession'`, réutilise
  `GET/POST/DELETE /char-sheet/:characterId/advantage-notes` (ajout du champ `category` au POST).

**Suppression — aucune restriction (décision Saar explicite)** : `canEdit` (joueur OU MJ) suffit,
comme aujourd'hui — pas de garde `isGm` ajoutée, pas de colonne auteur. "Le jeu de rôle se joue sur la
confiance."

---

## 6. Renumérotation

- `WizardHeader` : `totalSteps={6}` → `{7}`.
- `WizardCreation.jsx` : nouveau bloc `step === 6` (nouveau composant assemblant §1/§2-4/§5) ; l'actuel
  bloc `step === 6` (WizardReview + navigation Terminer) devient `step === 7`.
- `getInfos(step, ambiance, t)` (switch câblé en dur dans `WizardCreation.jsx`) — étendre, pas oublié
  cette fois (trou trouvé en 2e passe d'analyse).
- **À vérifier au moment du code, pas supposé couvert** : aucun autre "6" codé en dur (locales, CSS,
  autres switches sur `step`).
- `getPcDispo`/`getStepBudget` : **aucun changement** — Step6 n'a pas de PC, ces formules restent
  inchangées (vérifié, pas juste supposé).

---

## 7. Fichiers prévus (un à la fois, comme pour le Lot A4)

| Fichier | Nature | Détail |
|---|---|---|
| `server/src/routes/character/char-sheet.js` | Modification | Portée de diffusion inventaire conditionnelle (§2) |
| `server/src/routes/creation.js` | Modification | Marqueur `step6` dans reconcile (§3), `creation_state` dans `GET /:sheetId/state` (§3bis) |
| Migration NNN (impaire) | Création | `char_advantage_notes.category` (§5) + éventuel index |
| `server/src/services/advantageService.js` | Modification | `addAdvantageNote`/`getAdvantageNotes` acceptent/filtrent `category` |
| `client/src/stores/creationStore.js` | Modification | `applyStateSync` étendu à `step6` (§3) |
| `client/src/components/creation/WizardCreation.jsx` | Modification | Nouveau step 6, renumérotation, `getInfos` |
| `client/src/components/creation/WizardHeader.jsx` | Modification | `totalSteps` (valeur seulement) |
| `client/src/components/creation/StepMaterielEtBiens.jsx` | Création | Assemble récap (§1) + `InventoryPanel` + notes possessions |
| `client/src/components/creation/WizardInventorySync.jsx` | Création | Listener dédié, `reloadKey` (§4) |
| `client/src/components/creation/PossessionNotes.jsx` | Création | Extrait fin du bloc "Autres" d'`AdvantagesPanel.jsx`, filtré `category='possession'` |
| `client/src/character/AdvantagesPanel.jsx` | Modification | Filtre `category='narrative'` sur la liste existante |
| `client/src/locales/creation.json` | Modification | Nouvelles clés (titre step 6, etc.) |

## 8. Hors périmètre

- Aucun changement à l'enforcement des verrous (`enforceWizardLocks`) — Step6 n'a pas d'`optionKey`.
- Aucune validation mécanique du coût des objets/biens (narratif, tranché §0).
- Aucune restriction de suppression sur les notes (tranché §0 point 5).
- Aucun accès post-verrouillage — Step6 reste avant le lock (décalé, pas supprimé, §0).
