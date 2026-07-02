# PLAN — Refonte Wizard Création : Architecture Client-Primary
> Session 130 — 2026-07-02 — Statut : PLAN VALIDÉ, PRÊT À CODER

---

## Problème

Le wizard de création est un FSM serveur-side strict : chaque étape est persistée immédiatement.
Navigation arrière = rollback + cascade null dans le store. Conséquence : impossible de prendre
un désavantage en étape 5 pour revenir dépenser les PC en étape 1.

---

## Solution : Architecture Client-Primary

Tout le state vit dans Zustand jusqu'au bouton "Finaliser". Un seul `POST /finalize` avec le
payload complet de toutes les étapes. Pattern identique à tout formulaire multi-pages professionnel
(react-hook-form + zustand, react-admin WizardForm, etc.).

---

## Fichiers à modifier — ordre d'implémentation

### Phase 1 — Backend

#### `server/src/db/migrations/102_wizard_client_primary.js` (NOUVEAU)
```js
export const up = async (knex) => {
  await knex.schema.dropTableIfExists('char_creation_snapshot')
}
export const down = async (knex) => {
  await knex.schema.createTable('char_creation_snapshot', table => {
    table.increments('id')
    table.integer('char_sheet_id').notNullable().references('id').inTable('char_sheet').onDelete('CASCADE')
    table.string('step').notNullable()
    table.jsonb('snapshot').notNullable()
    table.unique(['char_sheet_id', 'step'])
  })
}
```
Note : les brouillons `draft_*` existants restent (visibles GM seulement, non bloquants).

---

#### `server/src/services/creationService.js` (REWRITE PARTIELLE)

**SUPPRIMER** (plus exporté ni appelé) :
- `createSnapshot`, `restoreSnapshot`
- `getStateIndex`, `assertMinState`
- `validateAndPersistStep1`, `validateAndPersistStep2`, `validateAndPersistStep3`
- `validateAndPersistStep4`, `rollbackStep4`

**GARDER** (helpers appelés depuis `finalizeCreation`) :
- `resolveBackground`, `resolveStep4Backgrounds`, `getBackgroundSkillsToApply`, `upsertSkillBonus`
- `validateCareerPrerequisites`, `validateCareerGenotype`, `validateCareerAttributes`, `validateCareerEducation`

**GARDER** (exports) :
- `getStep4RefData`, `getStep4State`, `getStep5RefData`, `startCreation`

**RÉÉCRIRE** :
```js
export async function finalizeCreation(sheetId, { step1, step2, step3, step4, step5 }) {
  return db.transaction(async (trx) => {
    const sheet = await trx('char_sheet').where({ id: sheetId }).first()
    if (!sheet) throw new AppError(404, 'Fiche introuvable')

    // Récupérer character_id une fois
    const charRow = await trx('char_sheet as cs')
      .join('characters as c', 'c.id', 'cs.character_id')
      .where('cs.id', sheetId)
      .select('c.id as character_id')
      .first()

    // ── STEP 1 : attributs + identité ──────────────────────────────
    const { charName, playerName, attributes, pcSpent: pc1 } = step1
    if (!charName?.trim()) throw new AppError(400, 'Nom du personnage requis')
    await trx('characters').where({ id: charRow.character_id }).update({ name: charName.trim() })
    await trx('char_identity')
      .insert({ char_sheet_id: sheetId, char_name: charName.trim(), player_name: playerName ?? '' })
      .onConflict('char_sheet_id').merge(['char_name', 'player_name'])
    for (const [attrId, level] of Object.entries(attributes)) {
      await trx('char_attributes')
        .where({ char_sheet_id: sheetId, attr_id: attrId })
        .update({ base_level: level })
    }
    await trx('char_pc_ledger').where({ char_sheet_id: sheetId }).update({ pc_spent_step1: pc1 ?? 0 })

    // ── STEP 2 : génotype ──────────────────────────────────────────
    const { genotypeId, isDeserter = false } = step2
    const geno = await trx('ref_genotypes').where({ id: genotypeId }).first()
    if (!geno) throw new AppError(400, `Génotype inconnu : ${genotypeId}`)
    const pc2 = isDeserter ? 4 : (geno.pc_cost ?? 0)
    await trx('char_archetype').where({ char_sheet_id: sheetId }).update({ genotype_id: genotypeId })
    await trx('char_pc_ledger').where({ char_sheet_id: sheetId }).update({ pc_spent_step2: pc2 })

    // ── STEP 3 : mutations ─────────────────────────────────────────
    const { method: step3Method, mutations: step3Mutations, kept: step3Kept, pcSpent: pc3 } = step3
    await trx('char_mutations').where({ char_sheet_id: sheetId }).del()
    const mutationsToInsert = step3Method === 'random' ? (step3Kept ?? []) : (step3Mutations ?? [])
    for (const { mutation_id, subtype_id } of mutationsToInsert) {
      const mutRef = await trx('ref_mutations').where({ mutation_id }).first()
      if (!mutRef) throw new AppError(400, `Mutation inconnue : ${mutation_id}`)
      await trx('char_mutations').insert({
        char_sheet_id: sheetId, mutation_id,
        subtype_id: subtype_id ?? null,
        source: step3Method === 'random' ? 'random' : 'chosen',
        status: 'active', count: 1,
      })
    }
    await trx('char_pc_ledger').where({ char_sheet_id: sheetId }).update({ pc_spent_step3: pc3 ?? 0 })

    // ── STEP 4 : expérience ────────────────────────────────────────
    // step4.age = valeur slider (baseAge). Le serveur calcule finalAge.
    const { age: baseAge, originGeo, originSoc, training, higherEd, careers: careersData, pcSpent: pc4 } = step4
    if (!baseAge || baseAge < 16) throw new AppError(400, 'Âge de base invalide')
    if (!Array.isArray(careersData) || careersData.length === 0) throw new AppError(400, 'Au moins une carrière requise')

    // Backgrounds
    const bgRows = await resolveStep4Backgrounds(trx, { originGeo, originSoc, training, higherEd })
    const bgSkillsToApply = await getBackgroundSkillsToApply(trx, bgRows, [])
    for (const sk of bgSkillsToApply) await upsertSkillBonus(trx, sheetId, sk.skill_id, sk.bonus)

    // Carrières
    let totalSavings = 0, totalCareerYears = 0
    for (const career of careersData) {
      const refCareer = await trx('ref_careers').where({ id: career.career_id }).first()
      if (!refCareer) throw new AppError(400, `Carrière inconnue : ${career.career_id}`)
      const prereqCheck = await validateCareerPrerequisites(sheetId, career.career_id, trx)
      if (!prereqCheck.valide) throw new AppError(400, prereqCheck.erreur)
      const genoCheck = await validateCareerGenotype(sheetId, career.career_id, trx)
      if (!genoCheck.valide) throw new AppError(400, genoCheck.erreur)
      const attrCheck = await validateCareerAttributes(sheetId, career.career_id, trx)
      if (!attrCheck.valide) throw new AppError(400, attrCheck.erreur)
      const eduCheck = await validateCareerEducation(sheetId, career.career_id, trx)
      if (!eduCheck.valide) throw new AppError(400, eduCheck.erreur)

      const titles = await trx('ref_career_titles').where({ career_id: career.career_id }).orderBy('min_years')
      const title = titles.find(t => career.years >= t.min_years && (t.max_years === null || career.years <= t.max_years))
      let salary = 0
      if (title?.salary_per_year) salary = title.salary_per_year
      else if (title?.salary_formula) salary = evaluateSalaryFormula(title.salary_formula)
      const savings = salary * career.years
      totalSavings += savings
      totalCareerYears += career.years

      await trx('char_careers').insert({
        char_sheet_id: sheetId, career_id: career.career_id, years: career.years, savings,
        pro_advantages: JSON.stringify(career.proAdvantages || {}),
        random_picks: JSON.stringify(career.randomPicks || []),
        setbacks: JSON.stringify(career.setbacks || []),
      })
      for (const [skillId, targetMastery] of Object.entries(career.skillAllocations || {})) {
        const isLearned = (career.openedSkills || []).includes(skillId)
        await trx('char_skills')
          .insert({ char_sheet_id: sheetId, skill_id: skillId, mastery: targetMastery, is_learned: isLearned })
          .onConflict(['char_sheet_id', 'skill_id'])
          .merge({ mastery: targetMastery, is_learned: trx.raw('char_skills.is_learned OR ?', [isLearned]) })
      }
    }

    // finalAge = baseAge + higherEd.years_added + career years
    let higherEdYears = 0
    if (higherEd) {
      const heRow = await trx('ref_backgrounds').where({ type: 'higher_ed', code: higherEd }).first()
      higherEdYears = heRow?.years_added ?? 0
    }
    const finalAge = baseAge + higherEdYears + totalCareerYears

    const ageEffects = getAgeEffects(finalAge)
    for (const [attr, delta] of Object.entries(ageEffects)) {
      await trx('char_attributes').where({ char_sheet_id: sheetId, attr_id: attr }).increment('pc_modifier', delta)
    }
    await trx('char_archetype').where({ char_sheet_id: sheetId }).update({
      age: finalAge, origin_geo: originGeo, origin_soc: originSoc,
      training_base: training, higher_ed: higherEd || null,
    })
    await trx('char_pc_ledger').where({ char_sheet_id: sheetId }).update({ pc_spent_step4: pc4 ?? 0 })

    // ── STEP 5 : avantages ─────────────────────────────────────────
    // CRITIQUE : ledger (pc_spent_step1..4) doit être rempli AVANT cet appel
    const { advantages = [] } = step5
    for (const advantageId of advantages) {
      await addAdvantage(sheetId, advantageId, 'creation_step5', trx)
    }

    // ── FINALISATION ───────────────────────────────────────────────
    await trx('characters').where({ id: charRow.character_id }).update({ visible: true })
    await trx('char_sheet').where({ id: sheetId }).update({ creation_state: 'complete' })
    return { ok: true, characterId: charRow.character_id }
  })
}
```

---

#### `server/src/routes/creation.js` (MODIFY)

**SUPPRIMER** ces routes :
- `POST /:sheetId/step1`
- `POST /:sheetId/step2`
- `POST /:sheetId/step3`
- `POST /:sheetId/step4`
- `DELETE /:sheetId/step4`
- `POST /:sheetId/step5`

**MODIFIER** `POST /:sheetId/finalize` :
```js
router.post('/:sheetId/finalize', async (req, res, next) => {
  try {
    const { step1, step2, step3, step4, step5 } = req.body
    if (!step1 || !step2 || !step3 || !step4 || !step5) {
      return next(new AppError(400, 'Payload finalize incomplet'))
    }
    const result = await finalizeCreation(req.sheet.id, { step1, step2, step3, step4, step5 })
    res.json(result)
  } catch (err) { next(err) }
})
```

**MODIFIER** imports : retirer `validateAndPersistStep4`, `rollbackStep4`, `validateAndPersistStep1/2/3`, `addAdvantage`.
Ajouter `addAdvantage` à l'import de `creationService.js` (ou le passer en arg — non, il est importé directement dans `finalizeCreation`).

---

### Phase 2 — Store

#### `client/src/stores/creationStore.js` (MODIFY)

Changements ligne par ligne :
```js
// AJOUTER state
highestStep: 0,

// AJOUTER setter
setHighestStep: (n) => set(s => ({ highestStep: Math.max(s.highestStep, n) })),

// REMPLACER setters cascade par setters indépendants
setStep1Data: (data) => set({ step1Data: data }),
setStep2Data: (data) => set({ step2Data: data }),
setStep3Data: (data) => set({ step3Data: data }),
setStep4Data: (data) => set({ step4Data: data }),
setStep5Data: (data) => set({ step5Data: data }),

// MODIFIER getPcDispo — ajouter pcNet step5
getPcDispo: () => {
  const s = get()
  const genoCost = !s.step2Data ? 0
    : s.step2Data.genotypeId === 'HUMAIN' ? 0
    : s.step2Data.isDeserter ? 4 : 5
  return PC_TOTAL
    - (s.step1Data?.pcSpent ?? 0)
    - genoCost
    - (s.step3Data?.pcSpent ?? 0)
    - (s.step4Data?.pcSpent ?? 0)
    + (s.step5Data?.pcNet ?? 0)  // pcNet = pcGained_désavantages - pcSpent_avantages
},

// MODIFIER resetCreation — ajouter highestStep
resetCreation: () => set({
  step: 0, highestStep: 0,
  step0Data: null, step1Data: null, step2Data: null,
  step3Data: null, step4Data: null, step5Data: null,
  sheetId: null, characterId: null, campaignId: null,
  creationState: null, isStarting: false, startError: null,
}),
```

SUPPRIMER : `creationState`, `setCreationState` (plus utilisés).

---

### Phase 3 — WizardCreation.jsx

**Destructuring** — ajouter : `highestStep, setHighestStep, step1Data, step2Data, step3Data, step4Data, step5Data`
Supprimer : `creationState, setCreationState`

**Remplacer `navigateToStep`** :
```js
const navigateToStep = (target) => {
  if (target === step || target < 1 || target > highestStep) return
  setStepError(null)
  setStep(target)
}
```

**Supprimer** la fonction `callStep` entière.

**Remplacer `handleFinalize`** :
```js
const handleFinalize = async () => {
  setFinalizing(true)
  setStepError(null)
  try {
    await api.post(`/creation/${sheetId}/finalize`, {
      step1: step1Data, step2: step2Data, step3: step3Data,
      step4: step4Data, step5: step5Data,
    })
    resetCreation()
    navigate('/')
  } catch (err) {
    const msg = err.response?.data?.error?.message || `Erreur ${err.response?.status ?? 'réseau'}`
    setStepError(msg)
    setFinalizing(false)
  }
}
```

**Ajouter guard** :
```js
const canFinalize = !!step1Data && !!step2Data && !!step3Data && !!step4Data && !!step5Data
```

**Handlers step — template général** (répéter pour 1→5) :
```js
// Step 1 onNext
(data) => {
  setStep1Data(data)
  setHighestStep(2)
  setStep(2)
}
// Step 1 onPrev
() => { setStepError(null); setStep(0) }
```

**Supprimer** tous les `setStepNData(null)` dans `onPrev`.
**Supprimer** tout appel à `api.delete('/step4')`.
**Supprimer** `setCreationState('draft_step4')` dans step4 onNext.

**Remplacer** le render step6 :
```jsx
{step === 6 && (
  <div style={st.step6}>
    <div style={st.step6Sheet}>
      <WizardReview
        step1Data={step1Data} step2Data={step2Data} step3Data={step3Data}
        step4Data={step4Data} step5Data={step5Data} pcDispo={pcDispo}
      />
    </div>
    <div style={st.step6Nav}>
      <button className="btn btn-ghost" onClick={() => { setStepError(null); setStep(5) }}>
        ← {t('wizard.prev')}
      </button>
      <button className="btn btn-gold" onClick={handleFinalize} disabled={finalizing || !canFinalize}>
        {finalizing ? '…' : t('wizard.finalize')} →
      </button>
    </div>
  </div>
)}
```

**Remplacer import** : `CharacterSheet` → `WizardReview`.

---

### Phase 3b — WizardReview.jsx (NOUVEAU)

```jsx
// client/src/components/creation/WizardReview.jsx
import { useTranslation } from 'react-i18next'

const GENO_NAMES = {
  HUMAIN: 'Humain', HYB_NAT: 'Hybride naturel',
  GEN_HYB: 'Géno-hybride', TEC_HYB: 'Techno-hybride',
}

export default function WizardReview({ step1Data, step2Data, step3Data, step4Data, step5Data, pcDispo }) {
  const { t } = useTranslation('creation')
  // ... voir implémentation complète en Phase 3b
  // Sections : Attributs (step1), Génotype (step2), Mutations (step3),
  //            Expérience (step4.finalAge + origins + careers), Avantages (step5)
  // Pas d'appel réseau. Tout depuis les props.
}
```

Clé i18n à ajouter dans `creation.json` → `wizard.review_title: "Récapitulatif"`.

---

### Phase 4 — Step components (hydratation)

#### Step1Attributes.jsx
- AJOUTER prop : `initialData`
- `useState(initialData?.charName ?? '')`
- `useState(initialData?.playerName ?? '')`
- `useState(initialData?.pcSpent ?? 0)` → `pcAlloues`
- `useState(() => initialData?.attributes ? { ...initialData.attributes } : Object.fromEntries(ATTR_IDS.map(...)))`

#### Step2Genotype.jsx
- AJOUTER prop : `initialData`
- `useState(() => initialData?.genotypeId ? GENOTYPES.find(g => g.id === initialData.genotypeId) ?? null : null)`
- `useState(initialData?.isDeserter ?? false)`
- Note : si `selected !== null`, le composant s'ouvre directement sur la vue détail. ✓

#### Step3Mutations.jsx
- AJOUTER prop : `initialData`
- `method` : `useState(initialData?.method === 'none' ? 'chosen' : (initialData?.method ?? null))`
  — Raison : 'none' est soumis via `handleNone` direct, pas via méthode. Retour → montrer vue achat avec carte "Aucune mutation" visible.
- `selected` : `useState(initialData?.method === 'chosen' ? (initialData?.mutations ?? []) : [])`
- `d20Result` : `useState(initialData?.d20Result ?? null)`
- `kept` : `useState(initialData?.method === 'random' ? (initialData?.kept ?? []) : [])`
- `removed` : `useState(initialData?.method === 'random' ? (initialData?.removed ?? []) : [])`
- `pcAfterRemovals` : `useState(initialData?.method === 'random' ? pcDispo - (initialData?.pcSpent ?? 0) : pcDispo)`
- MODIFIER `handleSubmitRandom` → ajouter `d20Result` dans payload :
  ```js
  onNext?.({ method: 'random', kept, removed, d20Result, pcSpent: pcDispo - pcAfterRemovals })
  ```

#### Step4Experience.jsx
- AJOUTER prop : `initialData`
- `subStep` : `useState(initialData ? SUB_STEPS.SUMMARY : SUB_STEPS.AGE)`
- `age` : `useState(initialData?.age ?? 16)` ← base age (slider), PAS finalAge
- `originGeo` : `useState(initialData?.originGeo ?? null)` — idem pour originSoc, training, higherEd
- `geoName, geoNation, socNation` : hydratés depuis initialData
- `careers` : `useState(initialData?.careers ?? [])` — format stocké inclut `career_name`
- MODIFIER `buildPayload` :
  ```js
  age: age,           // slider value (baseAge) — pour hydratation
  finalAge,           // âge calculé — pour WizardReview et affichage récap
  career_name dans chaque career entry,
  ```

#### Step5Advantages.jsx
- AJOUTER prop : `initialData` (garder `sheetId` pour l'appel GET ref)
- `selected` : `useState(initialData?.advantages ?? [])`
- MODIFIER `handleNext` :
  ```js
  const handleNext = () => {
    const net = pcGained - pcSpent  // positif si désavantages > avantages
    onNext?.({ advantages: selected, pcNet: net })
  }
  ```

---

## Contraintes critiques (ne pas oublier)

1. **Ordre finalize** : step1→2→3→4 remplissent le ledger AVANT `addAdvantage` step5 qui lit le ledger.
2. **`addAdvantage` avec trxOpt** : appel `await addAdvantage(sheetId, id, 'creation_step5', trx)` ← `trx` comme 4e arg. ✓
3. **step3 random** : `step3.kept` (pas `step3.mutations`) pour le mode random dans `finalizeCreation`.
4. **step4.age** = valeur slider (base), serveur calcule `finalAge` = `baseAge + higherEdYears + careerYears`.
5. **`pc_postcreation`** existe dans migration 99, pas 97. `defaultTo(0)`. `sufficient_pc` : OK.
6. **`validateCareerAttributes`** lit `char_attributes` → les attributs step1 doivent être écrits AVANT step4.

---

## Shapes des données store (référence)

```js
step1Data: { charName, playerName, attributes: { FOR, CON, ... }, pcSpent }
step2Data: { genotypeId, isDeserter }
step3Data: {
  method: 'chosen' | 'random' | 'none',
  mutations: [...],           // mode chosen
  kept: [...], removed: [...], d20Result: N,  // mode random
  pcSpent,
}
step4Data: {
  age,          // slider baseAge (16-60)
  finalAge,     // calculé, pour affichage
  originGeo, originSoc, training, higherEd,
  geoName, geoNation, socNation,
  careers: [{ career_id, career_name, years, skillAllocations }],
  pcSpent,
}
step5Data: {
  advantages: [advantageId, ...],
  pcNet,  // pcGained_désavantages - pcSpent_avantages (positif = bonus PC)
}
```

---

## Scénario de test post-implémentation

1. Démarrer wizard → étape 1 → choisir attributs → Suivant
2. Étape 2 → choisir génotype HYB_NAT → Suivant
3. Étape 3 → acheter une mutation → Suivant
4. Étape 4 → compléter → Suivant
5. Étape 5 → prendre un désavantage (+2 PC) → vérifier que pcDispo augmente de 2 dans le header
6. **Cliquer dot step 1 dans le stepper** → vérifier que les attributs précédents sont pré-remplis
7. Changer un attribut (dépenser les 2 PC supplémentaires) → Suivant
8. Vérifier que step2/3/4/5 conservent leurs données
9. Naviguer jusqu'à step6 → vérifier le récap WizardReview
10. Finaliser → vérifier que le personnage apparaît dans la liste avec `visible: true`

---

## État d'avancement

- [x] Analyse complète (15 fichiers lus en session 130)
- [x] Plan documenté
- [x] Phase 1 : migration + finalizeCreation + routes (Session 130)
- [x] Phase 2 : store (Session 130)
- [x] Phase 3 : WizardCreation + WizardReview (Session 130)
- [x] Phase 4 : Step components (Session 130)
- [ ] Tests
