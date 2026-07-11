# PLAN_SEXE — Option `feminin_bonus` + Sexe/Fécondité (Sexe/Step1, Step3, Step5)
> Session 137 — 2026-07-06
> Statut : ✅ implémenté et confirmé fonctionnel par Saar. Détail complet : `docs/JOURNAL6.md` "Session 137".

---

## Contexte

Item `41.` de `docs/EN_COURS.md` (options de campagne câblées une par une) désigne
`feminin_bonus` comme prochain sujet. Analyse initiale trop étroite ("juste débrancher le
sélecteur Sexe") — Saar a identifié que le sujet touche en réalité trois écrans du Wizard, car
le Sexe d'un personnage peut être choisi en Step1 puis altéré par une mutation en Step3
(Asexué/Androgyne/Autofécondation), ce qui rouvre la question de la Fécondité (Désavantage,
Step5).

**Découverte clé (lecture du code) : l'essentiel du schéma DB existe déjà, mais n'est câblé
nulle part.**
- `char_archetype.sex` (texte libre) et `char_archetype.is_fertile` (bool, défaut `false`)
  existent depuis la migration 36 — éditables à la main sur la fiche perso
  (`char-sheet.js:189-218`, `CharacterSheet.jsx:576-590`), jamais écrits par le Wizard.
- `ref_mutations.mod_sex` / `mod_fertility` existent déjà sur Androgyne/Asexué/Autofécondation
  (migration 95), agrégés dans `char_mutation_effects_view` (migration 109) — **vue jamais
  lue par aucun code serveur**, effet mort.
- `ref_advantages.adv_076 "Fécondité"` (désavantage, +3 PC, `is_unique`) existe (migration 92),
  listable en Step5, mais aucun code ne relie son achat à `is_fertile`.

**Règle officielle (`docs/Character/Creation/REGLE_CREATION.txt:292-296` et `:1312-1316`)** :
le bonus féminin (FOR base 5, +2 à répartir COO/PRE) est une règle **optionnelle** distincte du
choix de Sexe lui-même (qui importe surtout pour la Fécondité, indépendamment du bonus).

**Décision de portée (validée avec Saar)** : `feminin_bonus` ne gate QUE l'effet mécanique
(FOR-2 base, bonus COO/PRE). Le sélecteur Sexe reste **toujours visible**, quel que soit le
réglage — conforme à la règle LdB où le Sexe est une question d'identité/fécondité séparée.

**Aucune nouvelle migration nécessaire** — tout le schéma existe déjà.

---

## Décisions actées

1. **Valeurs canoniques de `char_archetype.sex`** : `'homme'` / `'femme'` (Step1), remplacées
   par `'androgyne'` / `'asexue'` (Step3, cohérent avec les valeurs déjà utilisées par
   `ref_mutations.mod_sex`). Le champ reste texte libre en base — un GM peut toujours le
   réécrire à la main après coup sur la fiche perso, sans contrainte enum ajoutée.
2. **Incompatibilité Fécondité × mutation stérilisante** : achat du désavantage `adv_076`
   bloqué si le personnage a déjà une mutation `mod_fertility = 'sterile'` (Asexué) — nouvelle
   contrainte dans le registre `advantageConstraints.js` (couvre à la fois Step5 et l'achat
   post-création via la fiche perso, un seul point de vérité, pas de duplication).
3. **Ordre des écritures = ordre des steps** : Step1 pose `sex` (identité de base) ; Step3
   l'écrase si une mutation `mod_sex` est choisie, et pose `is_fertile` si une mutation
   `mod_fertility` est choisie ; Step5 pose `is_fertile = true` si `adv_076` est acheté. Chaque
   étape écrase la précédente uniquement sur les champs concernés — pas de logique de
   priorité supplémentaire à coder, l'ordre naturel de `finalizeCreation` suffit.
4. **Androgyne ne touche pas la fécondité** : seul `mod_sex` est renseigné sur cette mutation
   dans `ref_mutations` (pas de `mod_fertility`) — `is_fertile` n'est pas altéré par Androgyne,
   conforme à la donnée déjà en base.

---

## Backend

**`server/src/services/creationService.js`**
- `startCreation()` (~L217-221) : ajouter `femininBonusEnabled: settings.feminin_bonus` au
  retour (même pattern que `ambiance`/`randomMutationsEnabled`).
- STEP 1 (~L234-253) :
  - L241 : `validateStep1(attributes, settings.ambiance, pc1 ?? 0, isFeminin1 ?? false)` →
    remplacer le dernier argument par `(isFeminin1 ?? false) && settings.feminin_bonus` — sans
    ça, la validation serveur du bonus (G3 base min, G4 cap) s'appliquerait même quand
    l'option est désactivée côté client, désynchro immédiate.
  - Après L247 (insert `char_identity`) : ajouter
    `await trx('char_archetype').where({ char_sheet_id: sheetId }).update({ sex: (isFeminin1 ?? false) ? 'femme' : 'homme' })`.
    (La ligne existe déjà à ce moment — créée à l'initialisation de la fiche, `char-sheet.js:127`.)
- STEP 3 (~L263-294) : dans la boucle d'insertion des mutations, accumuler les overrides
  Sexe/Fécondité à partir de `mutRef.mod_sex`/`mutRef.mod_fertility` (déjà fetché par mutation
  pour la validation d'existence, L272) :
  ```js
  let sexOverride = null
  let fertilityOverride = null // null = pas d'override, sinon true/false
  // ... dans la boucle, après `if (!mutRef) throw ...` :
  if (mutRef.mod_sex) sexOverride = mutRef.mod_sex
  if (mutRef.mod_fertility) fertilityOverride = mutRef.mod_fertility === 'self_fertile'
  // ... après la boucle, avant la ligne pc_spent_step3 :
  if (sexOverride || fertilityOverride !== null) {
    const archetypeUpdate = {}
    if (sexOverride) archetypeUpdate.sex = sexOverride
    if (fertilityOverride !== null) archetypeUpdate.is_fertile = fertilityOverride
    await trx('char_archetype').where({ char_sheet_id: sheetId }).update(archetypeUpdate)
  }
  ```
- STEP 5 (~L382-388) : **aucun changement** — l'effet mécanique de `adv_076` (poser
  `is_fertile = true`) est centralisé dans `advantageService.js` (ci-dessous), pas dupliqué
  ici, pour rester valable aussi hors Wizard (achat post-création via la fiche perso).

**`server/src/services/advantageService.js`**
- `addAdvantage()` (L27-70) : avant l'appel à `validateAdvantage` (L41), calculer si le
  personnage porte une mutation stérilisante :
  ```js
  const sterileMutation = await trx('char_mutations as cm')
    .join('ref_mutations as rm', 'rm.mutation_id', 'cm.mutation_id')
    .where({ 'cm.char_sheet_id': sheetId, 'cm.status': 'active', 'rm.mod_fertility': 'sterile' })
    .first()
  ```
  puis passer `!!sterileMutation` en 5ᵉ argument à `validateAdvantage(...)`.
  Après l'insert réussi (après L57, avant le bloc ledger) : si
  `advantageId === 'adv_076'`, `await trx('char_archetype').where({ char_sheet_id: sheetId }).update({ is_fertile: true })`.
- `removeAdvantage()` (L72-95) : ajouter `ca.advantage_id` au `.select(...)` de la requête
  L74-79. Après l'update L82-85 : si `charAdv.advantage_id === 'adv_076'`,
  `await trx('char_archetype').where({ char_sheet_id: sheetId }).update({ is_fertile: false })`
  (symétrie retrait).

**`server/src/services/advantageConstraints.js`**
- Nouvelle entrée dans `CONSTRAINTS` (après `sufficient_pc`, L40-49) :
  ```js
  not_if_sterile: {
    applies: (refAdv) => refAdv.advantage_id === 'adv_076',
    validate: (advantageId, currentAdvantages, refAdv, allRefAdvantages, ledger, isSterile) => !isSterile,
    message: () => `"Fécondité" incompatible avec une mutation stérilisante (Asexué) déjà acquise.`,
  },
  ```
- `validateAdvantage()` (L57-73) : ajouter le paramètre `isSterile = false`, le transmettre à
  `constraint.validate(advantageId, currentAdvantages, refAdv, allRefAdvantages, ledger, isSterile)`
  (L67).

---

## Frontend

**`client/src/stores/creationStore.js`**
- L22-23 : ajouter `femininBonusEnabled: null` à côté de `randomMutationsEnabled: null`.
- L48-50 (`startCreation`) : ajouter `femininBonusEnabled` à la déstructuration de
  `res.data` et au `set(...)`/retour.
- L76-77 (`resetCreation`) : ajouter `femininBonusEnabled: null`.

**`client/src/components/creation/WizardCreation.jsx`**
- L28-29 : ajouter `femininBonusEnabled` à la déstructuration du store.
- L41-42 : supprimer `const mockIsFeminin = false` (mock mort).
- L111-112 : remplacer `isFeminin={mockIsFeminin}` par `femininBonusEnabled={femininBonusEnabled}`.

**`client/src/components/creation/Step1Attributes.jsx`**
- L36 : `isFeminin: _deprecated` → `femininBonusEnabled` dans la signature de props (le nom
  `isFeminin` reste utilisé en interne pour l'état local du choix Sexe, aucune collision — le
  state local L41 s'appelle déjà `isFeminin`/`setIsFeminin`).
- L50 : `const base = (id === 'FOR' && initialData.isFeminin) ? 5 : 7` →
  `(id === 'FOR' && initialData.isFeminin && femininBonusEnabled) ? 5 : 7` (recalcul modPC
  initial depuis données sauvegardées).
- L67-69 (`handleSetFeminin`) : `const baseFOR = val ? 5 : 7` →
  `const baseFOR = (val && femininBonusEnabled) ? 5 : 7`.
- L74-76 (`baseAttrs`) : `(id === 'FOR' && isFeminin) ? 5 : 7` →
  `(id === 'FOR' && isFeminin && femininBonusEnabled) ? 5 : 7`.
- L86 : `calcTotalCost(attributs, isFeminin)` → `calcTotalCost(attributs, isFeminin && femininBonusEnabled)`.
- L116 (dans `handleModPC`) : même remplacement que L86.
- L30 (tooltip `ROW_TOOLTIPS.base`) : texte statique mentionnant l'exception féminine même
  quand l'option est désactivée → rendre conditionnel
  (`femininBonusEnabled ? "...( 5 en Force pour un personnage féminin)." : "Fixé à 7."`,
  calculé dans le composant au lieu d'une constante module-level).
- Le `<select>` Sexe (L185-196) et le payload `onNext` (L392-398, champ `isFeminin`)
  **ne changent pas** — le choix reste toujours visible et toujours transmis, que le bonus
  mécanique soit actif ou non.

**`shared/polarisUtils.js`** — **aucun changement.** `calcTotalCost`/`validateStep1` prennent
déjà un booléen `isFeminin` en paramètre ; c'est l'appelant (client + `creationService.js`)
qui doit désormais transmettre `isFeminin && femininBonusEnabled` au lieu du booléen brut.

---

## Ce qui ne change pas

- Aucune migration — tout le schéma (`char_archetype.sex/is_fertile`, `ref_mutations.mod_sex/mod_fertility`, `ref_advantages.adv_076`) existe déjà.
- `campaignSettingsService.js` — `feminin_bonus` déjà présent dans `SETTINGS_SCHEMA` (L6).
- `WizardReview.jsx` — n'affiche pas aujourd'hui le Sexe/la Fécondité choisis ; **hors scope
  de ce plan** (aucune donnée cachée au joueur, juste pas résumée à l'écran 6). Amélioration
  possible dans un second temps, à la demande.
- `char_mutation_effects_view` (`is_androgyne`/`is_asexue`/`is_sterile`/`is_self_fertile`) —
  reste non lue ; ce plan écrit directement `char_archetype` au moment du choix plutôt que de
  brancher cette vue, cohérent avec le pattern déjà utilisé pour les autres mutations
  numériques (jamais consommées non plus, dette distincte hors scope).
- Édition manuelle post-création de `sex`/`is_fertile` sur la fiche perso
  (`CharacterSheet.jsx:573-590`) — reste possible sans restriction, y compris pour corriger un
  cas que ce plan ne couvre pas (ex. cumul Androgyne + Asexué).

---

## Scénario de test (après implémentation)

1. **Option désactivée** : `feminin_bonus` OFF dans les options de campagne → Step1, choisir
   Femme → vérifier que la base FOR reste 7 (pas de -2) et qu'aucun bonus COO/PRE n'est
   proposé/validé ; finaliser → `char_archetype.sex = 'femme'` en base malgré tout.
2. **Option activée** : `feminin_bonus` ON → Step1, choisir Femme → base FOR = 5, bonus
   COO/PRE cappé à +2 cumulés (comportement actuel inchangé) ; finaliser → `sex = 'femme'`.
3. **Mutation Asexué en Step3** → finaliser → `char_archetype.sex = 'asexue'`,
   `is_fertile = false` (déjà le défaut, mais explicite).
4. **Mutation Autofécondation en Step3** → finaliser → `sex = 'asexue'`, `is_fertile = true`.
5. **Désavantage Fécondité en Step5** (sans mutation stérilisante) → finaliser → `is_fertile = true`.
6. **Cas de blocage** : mutation Asexué en Step3 + tentative d'achat Fécondité en Step5 →
   requête rejetée avec le message d'incompatibilité, PC non décomptés.
7. **Post-création** : sur une fiche déjà finalisée, ajouter le désavantage Fécondité depuis
   l'onglet campagne de la fiche perso → `is_fertile` passe à `true` ; le retirer → repasse à
   `false`. Vérifier aussi le blocage si la fiche a Asexué.
8. **Round-trip fiche perso** : vérifier que `sex`/`is_fertile` restent éditables librement à
   la main après coup (aucune contrainte enum ajoutée côté DB).
