# PLAN_ADVANTAGESPANEL — Correction complète de `AdvantagesPanel.jsx` + Force Polaris (OPT-04)
> Session 141 (suite 9) — 2026-07-09
> Statut : **✅ CHANTIER CLOS** — Lots A/B/C/D faits et confirmés fonctionnels. Lot E transféré vers
> `docs/PLAN_MUTATION2.md` (avec la limite "effets mécaniques non appliqués" du Lot D). Plus
> d'action attendue sur ce document sauf nouvelle demande de Saar.

---

## Contexte

En travaillant sur l'option de campagne `polaris_latent` (OPT-04, `docs/OPTIONS_CAMPAGNE.md`),
Saar a proposé un plan élargi : créer 3 avantages `ref_advantages` liés à la Force Polaris,
dont un (`adv_0XX` "Force Polaris") destiné à débloquer l'accès aux compétences Polaris sur la
fiche personnage — via le composant `AdvantagesPanel.jsx`.

Saar a alors précisé que le gate historique (mutation `muta_029`) était **une erreur de
conception de sa part** — l'intention a toujours été qu'un avantage débloque la Force Polaris,
jamais une mutation.

## Diagnostic confirmé (root cause, `[VÉRIFIÉ]` en base réelle)

La migration `99_char_advantages_v2.js` (Session ancienne) a remplacé le schéma `char_advantages`
par le système V2 actuel (`advantage_id` + `snapshot_data`, catalogue fixe `ref_advantages`,
soft-delete `removed_at`). **`AdvantagesPanel.jsx` n'a jamais été mis à jour pour ce nouveau
schéma** — il est resté écrit pour un schéma antérieur (`type: 'MUTATION'|'OTHER'|'ATTR'`,
`muta_numero`, `label`, `level`), des champs qui n'existent dans aucune ligne réelle produite par
`getAdvantages()`/`addAdvantage()` (`server/src/services/advantageService.js`).

Vérifié par requête directe en base (`node -e`, 2026-07-08) : les 2 seules lignes `char_advantages`
actives ont `type: "advantage"` + `name` (jamais `muta_numero`/`label`), et **aucune** n'a
`acquired_during: 'campaign'` — cohérent avec un flux d'ajout en jeu qui échoue silencieusement
depuis cette migration (probablement jamais fonctionnel depuis).

Conséquences concrètes dans `client/src/character/AdvantagesPanel.jsx` :
- `hasMuta029` (gate "Force Polaris") : toujours `false` en pratique (aucune ligne n'a jamais
  `type === 'MUTATION'`).
- `handleAddMutation`/`handleAddOther` : postent `{type, muta_numero}`/`{type, label}` vers
  `POST /char-sheet/:id/advantages`, qui exige `advantage_id` (`char-sheet.js:570-572`) — échec
  systématique (400).
- Affichage de la liste : lit `adv.label`/`adv.mutation_nom` (jamais définis en V2, toujours
  `undefined`) au lieu de `adv.name`. Badge `MUT`/`ATR` basé sur `adv.type === 'MUTATION'`, jamais
  vrai en V2 (`type` vaut `'advantage'`/`'disadvantage'`). `adv.level` n'existe pas dans
  `char_advantages` (c'est `char_mutations.count`, une autre table).
- i18n (`fr.json` clé `advantages.*`) : `polarisRequired`/`typePolarisDisabled` référencent
  `muta_029` en dur, à réécrire quel que soit le lot.

Le toggle des pouvoirs Polaris eux-mêmes (`char_skills.is_learned`, route
`PUT /char-sheet/:id/skills/toggle-learned`, `refSkillsPolaris` = `ref_skills.parent ===
'POUVOIRS_POLARIS'`) **fonctionne correctement** et est indépendant de ce bug — seul le *gate*
pour y accéder est cassé.

---

## Découpage en 5 lots

### Lot A — Force Polaris (actif, lié à OPT-04) — 🔲 DÉTAILLÉ, PRÊT À CODER

**Fichiers à lire avant de coder (protocole standard)** : les 7 fichiers listés dans le tableau
ci-dessous, `docs/OPTIONS_CAMPAGNE.md` (OPT-04), `docs/Character/Creation/REGLE_CREATION.txt`
(section "POLARIS LATENT ET NON MAÎTRISÉ (RÈGLE AVANCÉE)"), `server/src/db/migrations/
92_ref_advantages.js` (pattern de seed existant, ex. `adv_076`/`adv_050`).

**⚠️ Non vérifié contre le LdB** : contrairement aux autres options de campagne câblées cette
session, "Force Polaris = avantage à 5 PC, toujours actif" est un house-rule assumé de Saar, pas
une règle retrouvée telle quelle dans `REGLE_CREATION.txt`/`REGLE_MUTATION.md`. Ne pas présenter
ce point comme "conforme RAW" dans le journal de session.

| # | Fichier | Changement |
|---|---|---|
| 1 | `server/src/db/migrations/123_ref_advantages_polaris.js` (NOUVEAU) | 3 lignes `ref_advantages` — voir détail ci-dessous |
| 2 | `server/src/services/creationService.js` | `getStep5RefData()` → `getStep5RefData(campaignId)`, filtre `adv_077`/`adv_078` |
| 3 | `server/src/routes/creation.js` (~ligne 106) | `getStep5RefData(req.character.campaign_id)` |
| 4 | `server/src/services/advantageConstraints.js` | +contrainte `polaris_option_enabled`, signature `validateAdvantage` +1 paramètre |
| 5 | `server/src/services/advantageService.js` | `addAdvantage()` : résout `campaignId`+`settings.polaris_latent`, les passe à `validateAdvantage` |
| 6 | `client/src/character/AdvantagesPanel.jsx` | `hasMuta029` → `hasForcePolaris` (teste `adv_079` uniquement), suppression `MUTA_POLARIS` (devient mort) |
| 7 | `client/src/locales/fr.json` (clé `advantages.*`) | `polarisRequired`/`typePolarisDisabled` réécrits sans `muta_029` |

**1 — Migration `123_ref_advantages_polaris.js`** — pattern `92_ref_advantages.js`, `up()` = un
seul `insert`, `down()` = `whereIn(['adv_077','adv_078','adv_079']).del()`. Les 3 lignes
partagent `family: 'Polaris'` et **`family_limit: 1` répété identique sur les 3** (la contrainte
`family_limit` lit ce champ sur la ligne achetée, pas une config globale — l'oublier sur une des
trois casserait l'exclusion mutuelle selon l'ordre d'achat) :
- `adv_077` "Polaris latent" — `type: 'advantage'`, `cost_pc: 3`, `is_unique: false`,
  `special_rule` narratif (MJ décide du réveil, jamais libérable volontairement).
- `adv_078` "Polaris non maîtrisé" — `cost_pc: 3`, `special_rule` narratif (2 pouvoirs tirés
  aléatoirement, pas d'accès à Maîtrise de la Force Polaris, activation incontrôlée uniquement).
- `adv_079` "Force Polaris" — `cost_pc: 5`, `special_rule` : "Débloque l'accès aux compétences
  Force Polaris sur la fiche personnage."
- Tous les autres champs `mod_*` à `null` (aucun effet mécanique automatisé — narratif/MJ,
  comme `adv_050` "Ennemi héréditaire").

**2 — `creationService.js`** — `getStep5RefData()` (actuellement `return db('ref_advantages')
.select('*').orderBy(['type','name'])`, aucun paramètre) devient :
```js
export async function getStep5RefData(campaignId) {
  const settings = await getCampaignSettings(db, campaignId)
  const rows = await db('ref_advantages').select('*').orderBy(['type', 'name'])
  if (settings.polaris_latent) return rows
  return rows.filter(r => !['adv_077', 'adv_078'].includes(r.advantage_id))
}
```
(`getCampaignSettings` déjà importé dans ce fichier.)

**3 — `routes/creation.js`** — route `GET /:sheetId/step5/ref` (ligne ~104-109) : remplacer
`const advantages = await getStep5RefData()` par `getStep5RefData(req.character.campaign_id)`
(`req.character` déjà résolu par le middleware `router.param('sheetId', ...)` plus haut dans ce
fichier — confirmé disposer de `.campaign_id`).

**4 — `advantageConstraints.js`** — nouvelle entrée dans `CONSTRAINTS`, **ciblée par ID explicite,
pas par `family`** (la famille `"Polaris"` est partagée avec `adv_079`, qui doit rester achetable
même option désactivée — filtrer par famille le bloquerait par erreur) :
```js
polaris_option_enabled: {
  applies: (refAdv) => ['adv_077', 'adv_078'].includes(refAdv.advantage_id),
  validate: (advantageId, currentAdvantages, refAdv, allRefAdvantages, ledger, isSterile, polarisLatentEnabled) =>
    polarisLatentEnabled,
  message: () => `Cette option n'est pas activée dans les réglages de cette campagne.`,
},
```
Signature `validateAdvantage(...)` (actuellement 5 paramètres, `isSterile = false` en dernier) :
ajouter un 6ᵉ paramètre `polarisLatentEnabled = false` — **défaut `false` volontaire** (pas `true`
comme on pourrait le calquer sur le pattern "fail-open" des options précédentes) : ce paramètre
gate un *achat*, pas une *restriction* — un oubli d'appel doit bloquer par défaut, pas autoriser,
cohérent avec le défaut réel du schéma (`polaris_latent: false`). Répercuter ce paramètre dans la
boucle `for (const [key, constraint] of Object.entries(CONSTRAINTS))` (déjà générique, aucun
changement de boucle nécessaire — seule la signature de la fonction change).

**5 — `advantageService.js`** — `addAdvantage()` : avant l'appel à `validateAdvantage`, résoudre
`campaignId` (join `characters`/`char_sheet` sur `sheetId`, pattern déjà utilisé dans
`creationService.js` STEP4/STEP1) puis `getCampaignSettings(trx, campaignId)` (import à ajouter :
`import { getCampaignSettings } from '../lib/campaignSettingsService.js'`). Passer
`settings.polaris_latent` en 6ᵉ argument à `validateAdvantage(...)`.

**6 — `AdvantagesPanel.jsx`** — ligne 40 `MUTA_POLARIS` : supprimer (devient mort). Lignes 68-71 :
```js
const hasForcePolaris = useMemo(
  () => charAdvantages.some(a => a.advantage_id === 'adv_079'),
  [charAdvantages]
)
```
Remplacer les 3 usages de `hasMuta029` (bouton disabled/onClick, `title`, texte `typePolarisSub`
vs `typePolarisDisabled`) par `hasForcePolaris`. **Rappel confirmé par Saar** : `adv_077`/`adv_078`
ne débloquent PAS l'accès — seul `adv_079` compte pour ce gate (erreur trouvée et corrigée dans
une itération précédente de ce plan, cf. historique de session).

**7 — i18n `fr.json`** — `polarisRequired` ("Requiert : Sensibilité au Polaris (muta_029)") et
`typePolarisDisabled` ("Nécessite muta_029") : reformuler sans référence à une mutation (ex.
"Requiert l'avantage Force Polaris" / "Nécessite l'avantage Force Polaris") — texte exact à
finaliser au moment du code, pas figé ici.

**Dépendance non résolue, documentée (pas à corriger dans ce lot)** : la "mutation" narrative
077/078 (3 PC) → 079 (5 PC) suppose de payer 2 PC de différence via `char_pc_ledger.
pc_postcreation`. Vérifié : cette colonne n'est **jamais écrite** nulle part dans `server/src`
(seul le défaut `0` à la migration 99) — aucune route GM ne permet de la créditer (contrairement
à `xp`, qui a sa route dédiée). La "mutation" pourrait donc être bloquée faute de PC disponibles,
sans solution actuelle. Construire une route de crédit PC serait un nouveau chantier séparé.

**Simplification RAW assumée (pas à corriger sans nouvelle demande de Saar)** : la RAW distingue
"non maîtrisé" (2 pouvoirs tirés aléatoirement, mais sans accès à la compétence "Maîtrise de la
Force Polaris" spécifiquement) — un état intermédiaire non modélisé par ce plan. `adv_077`/
`adv_078` ne donnent ici aucun accès du tout, par simplicité et sur confirmation explicite de Saar.

**Test suggéré avant de clore ce lot** : `node --check`/ESLint sur les fichiers serveur+client
touchés ; scénarios `node -e` sur `getStep5RefData` (avec/sans `polaris_latent`) et sur
`validateAdvantage` (achat `adv_077` avec option OFF → rejeté ; `adv_079` avec option OFF →
accepté) ; SR ; parcours navigateur (Wizard Step5 + fiche perso `AdvantagesPanel`, option ON/OFF).

### Lot B — Affichage de la liste — 🔲 À FAIRE (après Lot A, tâche séparée)

**Décision tranchée** : Lot A et Lot B restent deux tâches distinctes (règle CLAUDE.md "un seul
bug à la fois"), même si c'est le même fichier — ne pas les coder dans la même passe.

- `adv.label` → `adv.name`.
- Badge `MUT`/`ATR` (`adv.type === 'MUTATION'`) → à redéfinir sur `advantage`/`disadvantage` réels,
  ou retiré si plus pertinent une fois Lot C/D conçus.
- `adv.level` → retiré (n'existe pas dans ce schéma).

### Lot C — "Autres" (texte libre) — 🔲 À FAIRE, conception requise avant code

- Poste `{type:'OTHER', label}` vers un catalogue fixe (`ref_advantages`) qui n'a pas de notion
  de texte libre par instance.
- Décision à prendre avant tout plan détaillé : colonne `char_advantages.custom_label` (nullable,
  surcharge l'affichage) + une ligne catalogue générique (ex. `adv_080` "Autre — texte libre") ?
  Ou autre mécanisme ? — à trancher avec Saar en temps voulu.

### Lot D — "Mutations" ajoutées en jeu — ✅ CLOS (bookkeeping) — Session 141 (suite 9)

Périmètre confirmé avec Saar avant code : MJ uniquement (lecture seule pour le joueur), aucun coût
PC (octroi narratif, pas un achat), pas de sélection de sous-type/tirage aléatoire (le MJ gère la
nuance narrative lui-même).

- Migration 125 (`char_mutations.source` CHECK étendu avec `'campaign'`) + `mutationService.js`
  (NOUVEAU — `getMutations`/`addMutation`/`removeMutation`, upsert stackable mirrors STEP3, override
  sexe/fécondité, soft-delete via `status='removed'`) + 3 routes `/char-sheet/:characterId/mutations`
  (GET public, POST/DELETE `req.isGm` uniquement — middleware `router.param('characterId')` déjà
  existant, pas de nouvelle plomberie) + `AdvantagesPanel.jsx` (`charMutations` fetch dédié, 3ᵉ type
  dans `combinedEntries`, badge "MUT", bouton "Mutations" grisé si `!isGm`).
- Bug **MUT2** corrigé au passage (`ref.js` — `GET /char-ref/mutations` triait sur une colonne
  inexistante, `docs/BUGIDENTIFIE.md`).
- **Limite trouvée en testant, transférée vers `docs/PLAN_MUTATION2.md`** : ajouter une mutation
  n'applique aucun effet mécanique (attributs, résistances) — vérifié **également jamais fait par
  le Wizard**, gap architectural pré-existant bien plus large que ce lot (`calcNA` n'a même pas de
  paramètre pour un modificateur de mutation). Diagnostic complet + pistes non tranchées dans
  `docs/PLAN_MUTATION2.md`, session dédiée à venir — pas un blocage de clôture de ce lot.

### Lot E — `SkillsPanel.jsx` `activeMutations` (dette `[CS7]`) — ➡️ TRANSFÉRÉ

Décision Saar (Session 141 suite 9) : transféré intégralement vers **`docs/PLAN_MUTATION2.md`**
("Dette transférée") — même famille de problème que les effets de mutation jamais appliqués,
traité dans la même session dédiée future plutôt que dans ce plan.

---

## Ordre d'exécution (historique — chantier clos)

Lot A (Session 141 suite 6) → Lot B (suite 7) → Lot C (suite 9) → Lot D bookkeeping (suite 9,
même session — effets mécaniques transférés vers `docs/PLAN_MUTATION2.md`). Lot E transféré vers
le même document. Plus aucun lot actif ici.

## Ce qui ne change pas

Le toggle des pouvoirs Polaris (`char_skills`/`PUT /skills/toggle-learned`) — fonctionne déjà
correctement, aucun des 5 lots n'y touche. `removeAdvantage`/`DELETE /advantages/:id` —
fonctionne déjà correctement pour toute ligne existante (soft-delete par `id` réel).
