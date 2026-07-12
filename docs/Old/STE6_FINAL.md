# STE6_FINAL — Fiche personnage consultable en permanence pendant le Wizard (fenêtre dédiée)
> Session 137 (suite) — 2026-07-06
> Statut : plan v3, révisé après 2 relectures critiques + 1 run à vide + 1 passe de recherche pro.
> Ce document remplace intégralement les versions précédentes du même fichier. Prêt pour
> exécution dans une nouvelle conversation.
>
> **Avant de coder, dans la nouvelle session : relire tous les fichiers cités (règle absolue
> CLAUDE.md — un résumé/plan ne remplace jamais la lecture). Les numéros de ligne cités dans ce
> document sont ceux constatés le 2026-07-06 — à revérifier, du code a pu bouger depuis
> (travail parallèle, migration 118 déjà vue non committée en est un exemple concret).

---

## 1. Objectif (reformulé après discussion)

Ce n'était pas "remplacer l'étape 6 par la fiche". C'est : **rendre la vraie fiche personnage
(les 4 onglets réels de `CharacterWindow.jsx`, utilisés en session de jeu) consultable à la
demande, en lecture seule, depuis n'importe quelle étape du Wizard à partir de la validation de
l'étape 1** — via une fenêtre escamotable, pas un écran figé. L'étape 6 garde son rôle propre :
poser explicitement "c'est la dernière étape", laisser le temps de tout relire et d'en discuter
(joueur/GM), avant de verrouiller.

## 2. Comment on y arrive (résumé du raisonnement, 3 passes de relecture)

**Passe 1 — contrainte technique de départ.** `CharacterSheet.jsx`/`ArmorWoundPanel.jsx`/
`WeaponPanel.jsx`/`InventoryPanel.jsx` sont DB-primary (lisent via API à partir de
`characterId`), alors que l'architecture wizard actuelle (COUCHE 5, Session 130) est
client-primary (rien en base avant "Terminer"). Donc : il faut persister *avant* d'afficher quoi
que ce soit de réel.

**Passe 2 — retravail (Saar : "on peut tout à fait retravailler une fiche personnage").**
Persister une fois ne suffit pas — il faut que la persistance soit **rejouable** sans dupliquer
ni corrompre les données à chaque aller-retour dans les étapes. Solution : généraliser le
pattern *reconciliation* (Kubernetes/Terraform — état désiré vs état réel, idempotent) déjà
présent dans le code pour `char_mutations`, à tous les blocs dérivés. Frontière de propriété
stricte type *cart → order* (e-commerce) : `char_sheet.wizard_locked_at` sépare "propriété
assistant" (rejouable) de "propriété runtime" (fiche réelle post-verrouillage).

**Passe 3 — présentation (Saar : pattern "Alt+Tab").** Recherche confirmée : *Command Palette*
(overlay global déclenché à la demande, dismissible) et *Drawer/side panel non-bloquant* (préféré
au modal dans les flows complexes) sont des patterns nommés, établis — et `CharacterWindow.jsx`
**est déjà** cette brique (fenêtre flottante, non-bloquante, jamais modale). Donc : zéro nouveau
composant d'affichage. Le vrai travail est de la rendre invocable depuis le Wizard, et de
généraliser `finalizeCreation` pour tolérer un état **partiel** (visible dès l'étape 1, pas
seulement une fois les 5 étapes complètes) — généralisation naturelle du même pattern de
reconciliation, pas un cas particulier.

**Découverte de la relecture critique la plus récente (celle qui suit) : un vrai conflit entre
"cacher le brouillon de tout le monde" et "le Wizard doit pouvoir lire son propre brouillon pour
peupler sa fenêtre" — détaillé en §8.3.

---

## 3. Décisions actées (toutes sessions confondues, 2026-07-06)

1. ✅ Persister avant d'afficher quoi que ce soit de réel (contrainte technique, non négociable).
2. ✅ Retour en arrière + retravail des étapes 1-5 doit rester possible et fonctionnel — pas de
   verrou tant que le joueur n'a pas explicitement cliqué "Terminer".
3. ✅ Onglet MATERIEL vide à l'issue de la création (aucune étape wizard n'assigne d'équipement
   — dette CAR1/OPT-W1, hors scope).
4. ✅ Réutilisation stricte — `CharacterWindow.jsx` réutilisé **inchangé** dans sa logique
   (aucune extraction/duplication de JSX), juste rendu invocable + une prop honnête pour la
   lecture seule.
5. ✅ Fenêtre disponible dès la validation de l'étape 1, en permanence ensuite (persiste à
   travers toute navigation, y compris retour arrière) — lecture seule tant que
   `wizard_locked_at` est vide.
6. ✅ Étape 6 conservée : point d'arrêt délibéré, contenu = `WizardReview.jsx` (résumé rapide,
   inchangé) + bouton d'ouverture de la fenêtre (détail complet) + bouton "Terminer" (verrouille).
7. ✅ Principe général, rappelé explicitement (2026-07-06) : **aucun bricolage, même temporaire.
   La qualité de l'architecture prime sur le temps de développement.** Si une solution semble
   rapide mais pas la bonne, continuer à chercher — pas de pression de délai.

---

## 4. Pourquoi la lecture doit rester lecture seule pendant le Wizard (raisonnement, pas une opinion)

`reconcileCreation` (voir §6) reste un *reconciler* : à chaque nouvelle ouverture de la fenêtre,
il réécrit intégralement compétences/carrières/avantages/effets d'âge depuis l'état courant du
store Wizard. Si la fenêtre était éditable pendant ce temps (ex : monter une compétence à la main
via l'onglet FICHE), cette édition directe serait **silencieusement effacée** à la prochaine
ouverture — aucune erreur, juste une perte de données. Rendre la fenêtre lecture seule tant que
`wizard_locked_at` est vide élimine ce conflit à la racine, sans compromis : le retravail se fait
exclusivement via les étapes du Wizard (déjà robustes, déjà validées), jamais en éditant
directement la fiche pendant que le Wizard est encore souverain sur les données.

---

## 5. Migration 119 (NOUVEAU fichier)

> Revérifié `ls server/src/db/migrations/` au moment d'écrire ce document — dernier numéro
> utilisé : **118** (`118_fix_ref_mutations_organe_sensoriel_manquant.js`, non committé, travail
> parallèle distinct). **119** est le prochain numéro disponible (P53 : toujours revérifier,
> jamais se fier à un check précédent).

`server/src/db/migrations/119_char_sheet_wizard_lock.js` :
```js
export const up = async (knex) => {
  await knex.schema.alterTable('char_sheet', (table) => {
    table.timestamp('wizard_locked_at').nullable()
  })
}
export const down = async (knex) => {
  await knex.schema.alterTable('char_sheet', (table) => {
    table.dropColumn('wizard_locked_at')
  })
}
```
Round-trip `up`/`down`/`up` à tester par appel direct des fonctions exportées (jamais la CLI knex
— P52), en vérifiant `knex_migrations` avant tout rappel manuel (P54).

---

## 6. Backend — `server/src/services/creationService.js`

### 6.1 Renommage `finalizeCreation` → `reconcileCreation`

La fonction ne "finalise" plus rien à chaque appel — elle réconcilie l'état courant du Wizard
(complet ou partiel) dans la base. Garder le nom `finalizeCreation` alors qu'elle tourne dès
l'étape 1 serait trompeur pour toute lecture future. Un seul point d'appel à mettre à jour
(`routes/creation.js`).

### 6.2 Signature et blocs conditionnels

```js
export async function reconcileCreation(sheetId, { step1, step2, step3, step4, step5 }) {
  return db.transaction(async (trx) => {
    const sheet = await trx('char_sheet').where({ id: sheetId }).first()
    if (!sheet) throw new AppError(404, 'Fiche introuvable')
    if (sheet.wizard_locked_at) throw new AppError(400, "Cette fiche a quitté l'assistant de création — modifications via la fiche personnage uniquement")
    const characterId = sheet.character_id

    if (step1) { /* STEP 1 — bloc existant L236-256, inchangé */ }
    if (step2) { /* STEP 2 — bloc existant L258-264, inchangé */ }
    if (step3) { /* STEP 3 — bloc existant L266-307, + reset is_fertile (§6.3) */ }
    if (step4) { /* STEP 4 — bloc existant L309-393, + wipes (§6.4/6.5/6.6) */ }
    if (step5) { /* STEP 5 — bloc existant L395-401, + wipe (§6.7) */ }

    const isComplete = !!(step1 && step2 && step3 && step4 && step5)
    if (isComplete) {
      await trx('characters').where({ id: characterId }).update({ visible: true })
      await trx('char_sheet').where({ id: sheetId }).update({ creation_state: 'complete' })
    }

    return { ok: true, characterId, isComplete }
  })
}
```
Ce n'est pas un cas particulier ajouté après coup : un contrôleur de reconciliation (Kubernetes)
traite un spec partiel exactement comme un spec complet — il applique ce qui est décrit, rien de
plus. Les 5 blocs internes sont ceux qui existent déjà, simplement gardés par la présence de leur
étape. Comme chaque étape du Wizard valide déjà ses propres champs obligatoires avant d'autoriser
son "Suivant" (`step1Data` etc. ne sont jamais posés en store sans être internement valides), le
risque de jeter une erreur de validation surprise à l'ouverture de la fenêtre est le même qu'aujourd'hui — pas plus élevé.

Séquence possible garantie par la navigation (jamais de trou) : `{}` → `{step1}` →
`{step1,step2}` → … → `{step1..step5}`. Aucun état "step3 sans step2" n'est atteignable, donc
aucune garde supplémentaire de cohérence entre étapes n'est nécessaire.

### 6.3 STEP 3 — reset `is_fertile` avant réapplication

Juste avant le `.del()` de `char_mutations` (ligne existante) :
```js
await trx('char_archetype').where({ char_sheet_id: sheetId }).update({ is_fertile: false })
```
Base par défaut confirmée par `36_char_sheet.js:62` (`is_fertile.defaultTo(false)`) et
`docs/PLAN_SEXE.md`. Sans ce reset, retirer une mutation Autofécondation ou le désavantage
Fécondité lors d'un retravail laisserait `is_fertile` bloqué à `true`.

### 6.4 STEP 4 — wipe `char_skills` avant réapplication

Avant la résolution des backgrounds (première ligne du bloc STEP4) :
```js
await trx('char_skills').where({ char_sheet_id: sheetId }).del()
```
Sûr : pendant le Wizard (avant verrouillage), `char_skills` n'est écrit que par cette fonction
elle-même — vérifié (`Step5Advantages.jsx`/`Step4Experience.jsx`/`CareersAllocator.jsx` ne font
que des `GET` de référence, aucune écriture avant reconciliation). Corrige aussi le bug latent de
`is_learned` monotone (`OR ?`) qui resterait bloqué à `true` pour une compétence retirée au
retravail.

### 6.5 STEP 4 — wipe `char_careers` avant réapplication

Avant la boucle des carrières :
```js
await trx('char_careers').where({ char_sheet_id: sheetId }).del()
```
Vérifié (grep `char_careers` sur tout `server/`) : aucune table ne référence `char_careers.id`
en FK — suppression sûre, pas d'orphelin.

### 6.6 STEP 4 — effets d'âge : increment → set absolu

Remplacer la boucle `.increment('pc_modifier', delta)` par :
```js
const ageEffects = getAgeEffects(finalAge)
for (const attr of ATTR_IDS_START) {  // constante déjà déclarée en tête de fichier — réutilisée
  await trx('char_attributes')
    .where({ char_sheet_id: sheetId, attr_id: attr })
    .update({ pc_modifier: ageEffects[attr] ?? 0 })
}
```
Sans ça, rejouer la reconciliation avec un âge final différent cumulerait les malus au lieu de
les recalculer.

### 6.7 STEP 5 — wipe avantages + reset ledger avant réapplication

```js
const { advantages = [] } = step5
await trx('char_advantages').where({ char_sheet_id: sheetId }).del()
await trx('char_pc_ledger').where({ char_sheet_id: sheetId }).update({ pc_spent_step5: 0, pc_gained_desavantages: 0 })
for (const advantageId of advantages) {
  await addAdvantage(sheetId, advantageId, 'creation_step5', trx)
}
```
Suppression directe (pas `removeAdvantage`) : pendant le Wizard, `char_advantages` n'est écrit
que par cette boucle — la remise à zéro explicite du ledger remplace proprement la
décrémentation ligne-à-ligne. Vérifié (grep `adv_0\d\d` sur `server/src`) : `adv_076` est le
**seul** avantage à effet de bord spécial (`is_fertile`) dans `advantageService.js` — déjà géré
par le reset §6.3, aucun autre cas caché. `advantageService.js`/`advantageConstraints.js`
(travail Session 137 `PLAN_SEXE.md`) restent intacts, non touchés.

### 6.8 Nouvelle fonction — verrouillage

```js
export async function lockWizard(sheetId) {
  const sheet = await db('char_sheet').where({ id: sheetId }).first()
  if (!sheet) throw new AppError(404, 'Fiche introuvable')
  if (sheet.creation_state !== 'complete') throw new AppError(400, 'Personnage non finalisé — impossible de verrouiller')
  await db('char_sheet').where({ id: sheetId }).update({ wizard_locked_at: db.fn.now() })
  return { ok: true }
}
```

---

## 7. Backend — `server/src/routes/creation.js`

- Renommer la route `POST /:sheetId/finalize` → `POST /:sheetId/reconcile`, payload partiel
  autorisé (supprimer la garde `if (!step1 || !step2...) return next(AppError(400, ...))` —
  chaque champ est optionnel désormais) :
```js
router.post('/:sheetId/reconcile', async (req, res, next) => {
  try {
    const { step1, step2, step3, step4, step5 } = req.body
    const result = await reconcileCreation(req.sheet.id, { step1, step2, step3, step4, step5 })
    res.json(result)
  } catch (err) { next(err) }
})
```
- Nouvelle route verrouillage :
```js
router.post('/:sheetId/lock', async (req, res, next) => {
  try {
    const result = await lockWizard(req.sheet.id)
    res.json(result)
  } catch (err) { next(err) }
})
```
- **Nouvelle route preview** (nécessaire — voir §8.3, ne peut pas réutiliser
  `characters.js` list) :
```js
router.get('/:sheetId/preview', async (req, res, next) => {
  try {
    const character = await getCharacterPreview(req.character.id, req.isGm)
    res.json({ character, isGm: req.isGm })
  } catch (err) { next(err) }
})
```
- Import à jour : `reconcileCreation, lockWizard` remplacent `finalizeCreation` ; ajouter
  `getCharacterPreview` (nouvelle fonction, §8.3).

---

## 8. Backend — la faille trouvée en relecture, et son correctif

### 8.1 Le problème

`characters.js:67-74` doit changer pour fermer la fenêtre d'exposition identifiée en relecture
précédente : un GM peut voir/éditer un personnage `creation_state='complete'` **avant** que le
joueur ait cliqué "Terminer" (le GM n'est jamais filtré par `visible`, L77). Le correctif logique
est de gater sur `wizard_locked_at IS NULL` plutôt que `creation_state != 'complete'` :
```js
query.whereNotExists(function () {
  this.select(db.raw('1'))
    .from('char_sheet')
    .whereRaw('char_sheet.character_id = characters.id')
    .whereNull('char_sheet.wizard_locked_at')
})
```

**Invariant à documenter en commentaire à cet endroit précis (pas seulement dans ce plan)** :
`reconcileCreation` pose `characters.visible = true` dès que `isComplete` (§6.2), **indépendamment
du verrou** — un personnage peut donc être `visible=true` alors que le joueur navigue encore
librement dans les étapes 1-5. Ça ne fuit nulle part **uniquement parce que** ce filtre gate sur
`wizard_locked_at`, pas sur `visible` ni `creation_state`. Si ce filtre est un jour "corrigé" pour
regater sur `creation_state`/`visible` sans relire ce commentaire, la fenêtre d'exposition se
rouvre silencieusement (aucune erreur, juste un GM qui peut éditer un personnage encore en cours
de construction). Commentaire à poser dans `characters.js` au niveau du filtre ET dans
`reconcileCreation` au niveau du `if (isComplete)`.

### 8.2 Mais ce correctif casse autre chose (trouvé à cette relecture)

Ce filtre masquerait **aussi le brouillon à son propre créateur** — or c'est justement lui qui a
besoin de le récupérer pour peupler sa fenêtre de lecture pendant qu'il est encore dans le
Wizard, précisément *avant* le verrouillage. Réutiliser `GET /campaigns/:campaignId/characters`
pour peupler la fenêtre (comme envisagé dans une version précédente de ce plan) est donc
**incorrect** : "caché de tout le monde" et "le Wizard doit pouvoir lire son propre brouillon"
sont deux besoins différents qui ne peuvent pas partager le même filtre.

### 8.3 Correctif définitif

Ne pas passer par `characters.js` du tout pour peupler la fenêtre pendant le Wizard. Utiliser à
la place une route dédiée dans `creation.js` (§7, `GET /:sheetId/preview`), qui bénéficie déjà de
la garde d'ownership existante (`router.param('sheetId', ...)`, L31-54 : `isOwner ou GM de
cette fiche précise`, indépendante du filtre de liste générale). Nouvelle fonction dans
`creationService.js` :
```js
export async function getCharacterPreview(characterId, isGm) {
  const columns = [
    'characters.id', 'characters.name', 'characters.type', 'characters.color',
    'characters.visible', 'characters.glb_url', 'characters.portrait_url',
    'characters.user_id', 'characters.description', 'characters.created_at',
    'characters.updated_at', 'users.username as owner_username',
  ]
  if (isGm) columns.push('characters.gm_notes')
  return db('characters')
    .where({ 'characters.id': characterId })
    .leftJoin('users', 'characters.user_id', 'users.id')
    .select(columns)
    .first()
}
```
Reprend volontairement la même liste de colonnes que `characters.js:33-56` (moins la
sous-requête `worst_wound_severity`, non pertinente pendant la création — pas de blessures
possibles). C'est une duplication assumée et documentée (pas un bricolage caché) : fusionner ce
point avec la requête de liste générale de `characters.js` obligerait à retoucher une requête en
lot déjà stable pour un besoin ligne-à-ligne différent — risque disproportionné par rapport au
gain (une quinzaine de lignes de noms de colonnes).

---

## 9. Frontend — `client/src/character/CharacterWindow.jsx`

Reste le **même composant**, aucune extraction. Ajout d'une seule prop honnête : `forceReadOnly`
(boolean, défaut `false` — nommée ainsi, pas `readOnly`, pour ne pas se confondre avec l'attribut
JSX `readOnly={!canEdit}` déjà utilisé sur les `<input>` internes de `CharacterSheet.jsx`, portée
différente, même mot). Sites exacts à faire dépendre de `forceReadOnly` (énumération exhaustive,
remplace chaque usage direct de `isGm`/`isOwner` pour les calculs de permission — pas pour
l'affichage neutre comme `character.name`) :

- L69 : calculer `effectiveIsOwner = isOwner && !forceReadOnly` et l'utiliser partout ci-dessous à
  la place de `isOwner`.
- L284-286 : `canEditDescription`, `canUploadPortrait`, `canEditName` — chacun `&& !forceReadOnly`.
- L328 (bouton toggle visibilité, GM) : `isGm && !forceReadOnly`.
- L363-370 (`CharacterSheet`) : passer `isGm={isGm && !forceReadOnly}` et `isOwner={effectiveIsOwner}`
  — `CharacterSheet.jsx:412` calcule déjà `canEdit = isGm || isOwner`, donc les deux à `false`
  suffisent à tout verrouiller en cascade (attributs, compétences via `SkillsPanel`, avantages via
  `AdvantagesPanel` — à vérifier lors du codage que `SkillsPanel`/`AdvantagesPanel` respectent
  bien leur prop `canEdit` reçue, cf. point de vigilance §12).
- L375-392 (`ArmorWoundPanel`/`WeaponPanel`/`InventoryPanel`) : `canEdit={(isGm || isOwner) && !forceReadOnly}`.
- L417 (`AdvantagesPanel` — onglet FICHE) : même règle via `canEdit` de `CharacterSheet`.
- L502 (dropdown réassignation propriétaire, PARAMETRE, GM) : `isGm && !forceReadOnly`.
- L508 (upload GLB) : `(isGm || isOwner) && !forceReadOnly`.
- L519 (bouton suppression, GM) : `isGm && !forceReadOnly`.

Aucun changement à la logique métier elle-même — uniquement les gardes de permission.

---

## 10. Frontend — `client/src/components/creation/WizardCreation.jsx`

- Import `CharacterWindow`, `useCharacterStore`.
- État local : `peekOpen` (boolean), `peekCharacter`, `peekIsGm`.
- **`openPeek()`** (appelée par le bouton de la fenêtre, disponible dès que `step1Data` existe) :
  1. `POST /creation/:sheetId/reconcile` avec `{ step1, step2, step3, step4, step5 }` — chaque
     champ tel qu'il existe actuellement dans le store (`null` pour les étapes non atteintes).
  2. `GET /creation/:sheetId/preview` → `{ character, isGm }`.
  3. `useCharacterStore.setCharacters([character])` (peuple le store global pour que
     `CharacterWindow` fonctionne identiquement à la session de jeu — voir point de vigilance
     §12 sur la portée de ce store).
  4. `setPeekCharacter(character); setPeekIsGm(isGm); setPeekOpen(true)`.
  - Erreur (validation) : toast/`stepError`, ne pas ouvrir la fenêtre.
- Rendu (en dehors du switch d'étapes, toujours monté si `peekOpen`) :
```jsx
{peekOpen && (
  <CharacterWindow
    character={{ ...peekCharacter, _currentUserId: user.id }}
    isGm={peekIsGm}
    forceReadOnly
    onClose={() => setPeekOpen(false)}
  />
)}
```
  Le Wizard ferme systématiquement la fenêtre avant de naviguer ailleurs (via `onClose` ou au
  moment de `resetCreation()`) — aucun scénario où elle reste montée après le verrouillage. Donc
  `forceReadOnly` est toujours `true` sans condition dans ce contexte précis (pas de variable
  `isLocked` à calculer).
- **Anti-double-clic** : état local `peekLoading` (boolean) — `openPeek()` met `peekLoading=true`
  dès l'appel, `false` en `finally` ; le bouton d'ouverture est `disabled={peekLoading}` pendant
  l'attente. Sans ça, deux clics rapprochés avant la résolution du premier appel déclencheraient
  deux `reconcile` concurrents sur la même fiche (pas dangereux en soi — même ordre d'opérations
  dans les deux transactions, pas de deadlock possible — mais un état de chargement visible est la
  pratique normale, pas un détail cosmétique optionnel).
- Bouton d'ouverture : dans `WizardHeader.jsx`, visible dès l'étape 1 (affiché en permanence,
  grisé/désactivé tant que `step1Data` est `null` — meilleure découvrabilité qu'un bouton qui
  apparaît/disparaît, cohérent avec l'exigence d'affordance visible du pattern Command Palette) —
  passer `hasCharacter={!!step1Data}`, `onOpenPeek={openPeek}`, `peekLoading` en nouvelles props.
  Emplacement exact (à côté du bloc PC ou en position dédiée) et libellé précis à trancher au
  moment du codage — pas bloquant pour le reste du plan.
- **i18n** : nouvelle clé `creation.json` (ex. `wizard.open_sheet: "Voir ma fiche"`) à ajouter
  AVANT tout usage — aucune string UI hardcodée (convention `.claude/rules/conventions.md`).
- **CSS** : bouton en `className="btn"` ou variante existante (`.btn-ghost`, etc.) — jamais de
  `style=` visuel pour ce bouton, conforme Session 76.
- **Étape 6** : garder `<WizardReview>` inchangé + bouton "Voir ma fiche complète" (`onOpenPeek`,
  même mécanisme) + bouton "Terminer". **`handleTerminate` remplace l'actuel `handleFinalize`
  (à supprimer, pas à laisser en plus)** — même gestion d'erreur/chargement que l'existant
  (`finalizing`, `try/catch`, `stepError`), pas une version simplifiée :
```js
const handleTerminate = async () => {
  setFinalizing(true)
  setStepError(null)
  try {
    await api.post(`/creation/${sheetId}/reconcile`, {
      step1: step1Data, step2: step2Data, step3: step3Data,
      step4: step4Data, step5: step5Data,
    })
    await api.post(`/creation/${sheetId}/lock`)
    resetCreation()
    navigate('/')
  } catch (err) {
    const msg = err.response?.data?.error?.message
      || err.response?.data?.message
      || `Erreur ${err.response?.status ?? 'réseau'}`
    setStepError(msg)
    setFinalizing(false)
  }
}
```
  Toujours complet à ce stade (on ne peut pas atteindre l'étape 6 sans avoir validé 1-5) — le
  reconcile final garantit la fraîcheur même si le joueur n'a jamais ouvert la fenêtre de lecture
  pendant tout son parcours. Le bouton "Terminer" garde `disabled={finalizing}` (variable
  `finalizing` déjà existante, réutilisée telle quelle).
- **Import manquant** : `WizardCreation.jsx` n'importe pas `useAuthStore` aujourd'hui (vérifié à
  la lecture initiale du fichier) — nécessaire pour `user.id` dans le JSX de `CharacterWindow`
  (§10, bloc `peekOpen`). À ajouter : `import { useAuthStore } from '../../stores/authStore'`
  (chemin à confirmer au moment du codage) + destructurer `user` au même endroit que les autres
  hooks du composant.
- **Nettoyage** : la variable `canFinalize` (actuelle L44 de `WizardCreation.jsx`, calcul
  `!!step1Data?.charName && !!step2Data && ...`) devient redondante — l'étape 6 n'est atteignable
  qu'après validation complète des 5 étapes, donc "Terminer" y est toujours actionnable par
  construction. À supprimer, pas à laisser comme code mort.

## 11. Frontend — fichiers supprimés

- **Aucun.** `WizardReview.jsx` est conservé (contenu de l'étape 6). Pas de nouveau composant
  d'affichage créé.

---

## 12. Points de vigilance (cumulés des 3 relectures)

- **Store `characterStore` global réutilisé pour peupler la fenêtre pendant le Wizard** — même
  store que celui utilisé en session de jeu (`SessionPage`). Risque mineur documenté : si
  l'utilisateur enchaîne Wizard → session live dans le même onglet sans rechargement, un flash de
  données obsolètes est possible avant que `loadSession` n'écrase le store au montage — non
  bloquant, auto-corrigé, mais assumé plutôt que masqué.
- **`SkillsPanel.jsx`/`AdvantagesPanel.jsx`** — à vérifier lors du codage qu'ils respectent
  strictement leur prop `canEdit`/`isGm` reçue pour désactiver tout achat/toggle quand `false`
  (pattern déjà établi ailleurs dans le composant, mais jamais vérifié ligne à ligne pour ce cas
  précis).
- **Duplication assumée** entre `characters.js:33-56` et `getCharacterPreview` (§8.3) — liste de
  colonnes similaire, deux requêtes distinctes pour deux besoins distincts (liste en lot filtrée
  vs. lecture ligne-à-ligne avec garde d'ownership différente). Documenté, pas un oubli.
- **P53/P54** — migration 119 : tester round-trip par appel direct des fonctions exportées,
  vérifier `knex_migrations` avant tout rappel manuel de `up()`.
- Revalidation complète à chaque `reconcile` (y compris partiel) : mêmes erreurs de validation
  qu'aujourd'hui pour les blocs présents (carrière incompatible, PC insuffisants, etc.) — aucune
  régression attendue, à confirmer par les tests.
- **Run à vide (2026-07-06)** — vérifié et écarté : `docs/PLAN_WIZARD_REFACTOR.md` (Session 130,
  jamais lu avant cette passe) est le plan d'origine de l'architecture client-primary actuelle,
  aucun conflit avec ce plan — confirme juste la contrainte d'ordre STEP1 avant STEP4
  (`validateCareerAttributes` lit `char_attributes`), déjà respectée par l'ordre des blocs
  existant. `DashboardPage.jsx` ne référence `characters`/`creation_state` nulle part (grep) —
  la dette [WIZ-1] (`EN_COURS.md`) est indépendante de ce chantier, aucune action requise ici.

---

## 13. Ce qui ne change PAS

- `CharacterSheet.jsx`, `ArmorWoundPanel.jsx`, `WeaponPanel.jsx`, `InventoryPanel.jsx`,
  `SkillsPanel.jsx`, `AdvantagesPanel.jsx` — inchangés.
- `advantageService.js`, `advantageConstraints.js` — inchangés (travail PLAN_SEXE intact).
- Steps 1 à 5 du wizard (`Step1Attributes.jsx` … `Step5Advantages.jsx`) — inchangés, continuent
  à n'écrire que dans le store Zustand `creationStore.js`.
- `WizardReview.jsx`, `WizardHeader.jsx` (structure du stepper) — conservés, `WizardHeader.jsx`
  reçoit juste 2 nouvelles props pour le bouton peek.
- `char_mutations` (déjà idempotent) — inchangé.
- Onglet MATERIEL — vide à l'issue de la création (dette CAR1/OPT-W1, hors scope).

---

## 14. Sources (recherche du 2026-07-06)

- [The Principle of Reconciliation](https://www.chainguard.dev/unchained/the-principle-of-reconciliation)
- [Kubernetes Reconcile Loop Explained](https://www.golinuxcloud.com/kubernetes-reconcile-loop-explained/)
- [Understanding and Implementing the Reconciliation Loop Pattern](https://oneuptime.com/blog/post/2026-02-09-operator-reconciliation-loop/view)
- [Why Your Idempotency Implementation Is Silently Losing Data](https://dzone.com/articles/phantom-write-idempotency-data-loss)
- [Map Cart Data to Order Data | B2B Commerce Checkout](https://developer.salesforce.com/docs/commerce/salesforce-commerce/guide/b2b-b2c-comm-import-export-carttoorder.html)
- [Immutable Architecture Pattern - System Design](https://www.geeksforgeeks.org/system-design/immutable-architecture-pattern-system-design/)
- [Command Palette | UX Patterns for Developers](https://uxpatterns.dev/patterns/advanced/command-palette)
- [Designing Command Palettes](https://solomon.io/designing-command-palettes/)
- [Modal vs. Separate Page: UX Decision Tree — Smashing Magazine](https://www.smashingmagazine.com/2026/03/modal-separate-page-ux-decision-tree/)

---

## 15. Scénario de test proposé (après implémentation)

1. Étape 1 validée → bouton "Voir ma fiche" apparaît → ouverture → fiche en lecture seule,
   nom + attributs corrects, reste des onglets vide/par défaut.
2. Progression étape par étape avec réouvertures régulières de la fenêtre → chaque section se
   remplit (génotype étape 2, mutations étape 3, carrières/compétences étape 4, avantages étape
   5) sans doublon ni résidu d'un état antérieur.
3. Retour arrière (étape 5 → étape 2, changement de génotype) → ré-avance → réouverture de la
   fenêtre → reflète le nouveau génotype, PC ledger cohérent, pas de duplication carrières.
4. Tentative d'édition dans la fenêtre pendant le Wizard (avant "Terminer") → tous les champs en
   lecture seule, aucun bouton d'action actif.
5. Étape 6 : `WizardReview` affiché + bouton "Voir ma fiche complète" fonctionnel + "Terminer" →
   verrouille, fenêtre désormais éditable si rouverte en session de jeu réelle.
6. Tentative de re-reconciliation après verrouillage (rejeu API direct) → rejetée par
   `wizard_locked_at`, message explicite.
7. Un GM consulte la liste des personnages de la campagne pendant qu'un joueur est encore dans le
   Wizard (avant "Terminer") → le personnage n'apparaît pas dans sa liste (`characters.js` gate
   sur `wizard_locked_at`).
8. Round-trip migration 119 (`up`/`down`/`up`, appel direct des fonctions).
