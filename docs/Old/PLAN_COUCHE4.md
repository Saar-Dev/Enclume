# PLAN_COUCHE4 — Wizard Création : Connexion Frontend → Backend
> Rédigé Session 129 — 2026-07-01
> Statut : **PLAN VALIDÉ — EN ATTENTE DE CODE**

---

## Contexte

COUCHE 1 (migrations 92-102) ✅ et COUCHE 2 (UI frontend mockée) ✅ sont terminées.
COUCHE 3 (backend step4 + step5) ✅ — clos partiel (non testé depuis client).
COUCHE 4 = connecter le frontend wizard au backend réel.

---

## Décision architecturale validée

Pattern **"Draft-First"** (Stripe PaymentIntent / Shopify DraftOrder) :
1. `POST /api/creation/start` → crée le dossier immédiatement → retourne `sheetId`
2. Chaque "Next" appelle son endpoint backend qui valide + persiste
3. `creation_state` progresse : `draft_step0 → draft_step1 → ... → complete`
4. `POST /api/creation/:sheetId/finalize` → `complete` → personnage visible dans la bibliothèque

Ce pattern correspond exactement à la state machine déjà en place dans le backend.

---

## Découpage en 4a + 4b

### COUCHE 4a (plan validé — à coder)

6 fichiers, tous lus dans cette session.

### COUCHE 4b (sprint séparé — après 4a)

- `CareersAllocator.jsx` : boutons +/- → handlers réels + `skillAllocations`
- Step4/Step5 frontend → backend
- `finalizeCreation` déclenchée depuis Step5

---

## Découvertes de lecture — schémas confirmés

### `ref_genotypes` (migration 33)
- `id TEXT PRIMARY KEY` — valeurs : 'HUMAIN', 'HYB_NAT', 'TEC_HYB', 'GEN_HYB'
- Pas de UUID → le frontend envoie `genotypeId: 'HUMAIN'` → c'est la PK ✅
- `pc_cost INTEGER defaultTo(0)` seedé par migration 97 : HUMAIN=0, HYB_NAT=5, GEN_HYB=5, TEC_HYB=5
- `has_deserter_option BOOLEAN defaultTo(false)` — true uniquement pour TEC_HYB
- Déserteur TEC_HYB = 4 PC (hardcodé frontend ligne 134 + backend)

### `char_archetype` (migration 36)
- Toutes colonnes nullable sauf `char_sheet_id` (PK)
- INSERT blank `{ char_sheet_id: sheet.id }` → fonctionne ✅
- `genotype_id TEXT` nullable FK → peut être NULL à la création

### `char_attributes` (migration 36)
- `base_level INT NOT NULL defaultTo(7)` → doit être fourni dans l'INSERT
- `pc_modifier INT defaultTo(0)` → nullable
- Pattern step1 : `UPDATE base_level = attributes[attrId]` pour chaque attribut

### `char_mutations` (migration 96)
- `id UUID PK defaultTo(gen_random_uuid())` → INSERT sans id ✅
- Constraint CHECK : `source IN ('chosen', 'random')` — 'none' interdit
- Quand method='none' → mutations=[] → aucun INSERT → constraint non déclenchée ✅
- Deux index partiels d'unicité (no_sub + with_sub)

### `char_identity` (migration 36)
- Toutes colonnes nullable (player_name, char_name, height, weight, etc.)
- UPSERT sur `char_sheet_id` PK avec `{ char_name, player_name }` ✅

### `char_pc_ledger` (migration 97)
- `char_sheet_id UUID PK` (singleton par personnage)
- `pc_total INT defaultTo(20)`, `pc_spent_step1..5 INT defaultTo(0)`

### `creation.js` (routes — guard pattern)
- `router.use(requireAuth)` global
- `router.param('sheetId', ...)` — injecte `req.sheet`, `req.character`, `req.isGm` — owner OR gm
- `POST /start` n'a pas de `:sheetId` → guard membership EXPLICITE dans le handler
- Pattern des handlers : thin (délèguent tout au service)

### `creationStore.js` actuel (62 lignes)
- Champs : step, step0Data..step5Data, getPcDispo(), setStep0Data..setStep5Data, resetCreation
- Pas de sheetId, campaignId, isStarting → à ajouter

### `WizardCreation.jsx` actuel (137 lignes)
- `mockAmbiance = 'INTERMEDIAIRE'` hardcodé (COUCHE 4b : lire campaign.ambiance)
- `mockIsFeminin = false` hardcodé
- Handlers actuels : purement locaux (setStepNData + setStep)
- Pas de useParams, pas d'appels API

### `Step1Attributes.jsx` (339 lignes)
- `canNext = pointsRestants === 0` — pas de validation charName → à corriger
- Ligne 321 : `onNext({ pcSpent: pcAlloues })` — payload incomplet → à étendre
- `charName`, `playerName`, `attributs` sont tous dans le state local ✅

### `Step2Genotype.jsx`
- Ligne 128 : `onNext({ genotypeId: selected.id, isDeserter })` — `selected.id` = code TEXT ✅
- Format correct pour backend ✅

### `Step3Mutations.jsx`
- `onNext({ method, mutations: [{mutation_id: INT, subtype_id: INT|null}], pcSpent })`
- mutation_id = INTEGER (ref_mutations.mutation_id serial) ✅

### `App.jsx`
- Ligne 66 : `path="/creation"` → à changer en `path="/campaigns/:campaignId/creation"`
- Import `WizardCreationPage` ligne 13 — pas à changer

---

## Plan de code COUCHE 4a — 6 fichiers, lignes exactes

---

### Fichier 1 : `server/src/services/creationService.js`

**Zone** : appender APRÈS la ligne 369 (après `export async function getStep5RefData() { ... }`)

Mettre à jour le commentaire header (ligne 3) pour refléter la nouvelle state machine.

Ajouter à la fin du fichier :

```js
// ─── Start : création du brouillon ─────────────────────────────────────────

const ATTR_IDS_START = ['FOR', 'CON', 'COO', 'ADA', 'PER', 'INT', 'VOL', 'PRE']

export async function startCreation(campaignId, userId) {
  return db.transaction(async (trx) => {
    const [character] = await trx('characters')
      .insert({ campaign_id: campaignId, user_id: userId, name: 'Brouillon', type: 'pj', visible: false })
      .returning(['id'])

    const [sheet] = await trx('char_sheet')
      .insert({ character_id: character.id, creation_state: 'draft_step0' })
      .returning(['id'])

    await trx('char_pc_ledger').insert({ char_sheet_id: sheet.id, pc_total: 20 })
    await trx('char_archetype').insert({ char_sheet_id: sheet.id })
    await trx('char_attributes').insert(
      ATTR_IDS_START.map(attr_id => ({ char_sheet_id: sheet.id, attr_id, base_level: 7, pc_modifier: 0 }))
    )

    return { sheetId: sheet.id, characterId: character.id }
  })
}

// ─── Step 1 : attributs + identité ─────────────────────────────────────────

export async function validateAndPersistStep1(sheetId, data) {
  const { charName, playerName, attributes, pcSpent } = data
  if (!charName?.trim()) throw new AppError(400, 'Nom du personnage requis')
  if (!attributes || typeof attributes !== 'object') throw new AppError(400, 'Attributs requis')

  return db.transaction(async (trx) => {
    const sheet = await trx('char_sheet').where({ id: sheetId }).first()
    if (sheet.creation_state !== 'draft_step0')
      throw new AppError(400, `État invalide pour step1 : ${sheet.creation_state}`)

    const row = await trx('char_sheet as cs')
      .join('characters as c', 'c.id', 'cs.character_id')
      .where('cs.id', sheetId)
      .select('c.id as character_id')
      .first()

    await trx('characters').where({ id: row.character_id }).update({ name: charName.trim() })

    await trx('char_identity')
      .insert({ char_sheet_id: sheetId, char_name: charName.trim(), player_name: playerName ?? '' })
      .onConflict('char_sheet_id').merge(['char_name', 'player_name'])

    for (const [attrId, level] of Object.entries(attributes)) {
      await trx('char_attributes')
        .where({ char_sheet_id: sheetId, attr_id: attrId })
        .update({ base_level: level })
    }

    await trx('char_pc_ledger').where({ char_sheet_id: sheetId }).update({ pc_spent_step1: pcSpent ?? 0 })
    await trx('char_sheet').where({ id: sheetId }).update({ creation_state: 'draft_step1' })

    return { creation_state: 'draft_step1' }
  })
}

// ─── Step 2 : génotype ─────────────────────────────────────────────────────

export async function validateAndPersistStep2(sheetId, data) {
  const { genotypeId, isDeserter = false } = data

  return db.transaction(async (trx) => {
    const sheet = await trx('char_sheet').where({ id: sheetId }).first()
    if (sheet.creation_state !== 'draft_step1')
      throw new AppError(400, `État invalide pour step2 : ${sheet.creation_state}`)

    const geno = await trx('ref_genotypes').where({ id: genotypeId }).first()
    if (!geno) throw new AppError(400, `Génotype inconnu : ${genotypeId}`)
    if (isDeserter && !geno.has_deserter_option)
      throw new AppError(400, `Le génotype ${genotypeId} n'a pas d'option déserteur`)

    const pcCost = isDeserter ? 4 : (geno.pc_cost ?? 0)

    await trx('char_archetype').where({ char_sheet_id: sheetId }).update({ genotype_id: genotypeId })
    await trx('char_pc_ledger').where({ char_sheet_id: sheetId }).update({ pc_spent_step2: pcCost })
    await trx('char_sheet').where({ id: sheetId }).update({ creation_state: 'draft_step2' })

    return { creation_state: 'draft_step2', pcCost }
  })
}

// ─── Step 3 : mutations ────────────────────────────────────────────────────

export async function validateAndPersistStep3(sheetId, data) {
  const { method, mutations = [], pcSpent = 0 } = data
  if (!['chosen', 'random', 'none'].includes(method))
    throw new AppError(400, `Méthode de mutation invalide : ${method}`)

  return db.transaction(async (trx) => {
    const sheet = await trx('char_sheet').where({ id: sheetId }).first()
    if (sheet.creation_state !== 'draft_step2')
      throw new AppError(400, `État invalide pour step3 : ${sheet.creation_state}`)

    await trx('char_mutations').where({ char_sheet_id: sheetId }).del()

    for (const { mutation_id, subtype_id } of mutations) {
      const mutRef = await trx('ref_mutations').where({ mutation_id }).first()
      if (!mutRef) throw new AppError(400, `Mutation inconnue : ${mutation_id}`)
      await trx('char_mutations').insert({
        char_sheet_id: sheetId,
        mutation_id,
        subtype_id: subtype_id ?? null,
        source: method === 'random' ? 'random' : 'chosen',
        status: 'active',
        count: 1,
      })
    }

    await trx('char_pc_ledger').where({ char_sheet_id: sheetId }).update({ pc_spent_step3: pcSpent })
    await trx('char_sheet').where({ id: sheetId }).update({ creation_state: 'draft_step3' })

    return { creation_state: 'draft_step3' }
  })
}

// ─── Finalize ──────────────────────────────────────────────────────────────

export async function finalizeCreation(sheetId) {
  return db.transaction(async (trx) => {
    const sheet = await trx('char_sheet').where({ id: sheetId }).first()
    if (sheet.creation_state !== 'draft_step5')
      throw new AppError(400, `État invalide pour finalize : ${sheet.creation_state}`)

    await trx('characters').where({ id: sheet.character_id }).update({ visible: true })
    await trx('char_sheet').where({ id: sheetId }).update({ creation_state: 'complete' })

    return { ok: true, characterId: sheet.character_id }
  })
}
```

---

### Fichier 2 : `server/src/routes/creation.js`

**Zone A — ligne 27-28 : étendre l'import**

Remplacer :
```js
import {
  getStep4RefData, getStep4State, validateAndPersistStep4, rollbackStep4, getStep5RefData,
} from '../services/creationService.js'
```
Par :
```js
import {
  getStep4RefData, getStep4State, validateAndPersistStep4, rollbackStep4, getStep5RefData,
  startCreation, validateAndPersistStep1, validateAndPersistStep2,
  validateAndPersistStep3, finalizeCreation,
} from '../services/creationService.js'
```

**Zone B — après `router.param` (après ligne 58) : ajouter POST /start**

```js
// ─── Start ─────────────────────────────────────────────────────────────────

router.post('/start', async (req, res, next) => {
  try {
    const { campaignId } = req.body
    if (!campaignId) return next(new AppError(400, 'campaignId requis'))

    const member = await db('campaign_members')
      .where({ campaign_id: campaignId, user_id: req.user.id })
      .first()
    if (!member) return next(new AppError(403, "Vous n'êtes pas membre de cette campagne"))

    const result = await startCreation(campaignId, req.user.id)
    res.json(result)
  } catch (err) { next(err) }
})
```

**Zone C — après `router.delete('/:sheetId/step4')` (après ligne 88) : step1/2/3**

```js
// ─── Step 1 ────────────────────────────────────────────────────────────────

router.post('/:sheetId/step1', async (req, res, next) => {
  try {
    const result = await validateAndPersistStep1(req.sheet.id, req.body)
    res.json(result)
  } catch (err) { next(err) }
})

// ─── Step 2 ────────────────────────────────────────────────────────────────

router.post('/:sheetId/step2', async (req, res, next) => {
  try {
    const result = await validateAndPersistStep2(req.sheet.id, req.body)
    res.json(result)
  } catch (err) { next(err) }
})

// ─── Step 3 ────────────────────────────────────────────────────────────────

router.post('/:sheetId/step3', async (req, res, next) => {
  try {
    const result = await validateAndPersistStep3(req.sheet.id, req.body)
    res.json(result)
  } catch (err) { next(err) }
})
```

**Zone D — après `router.post('/:sheetId/step5')` (après ligne 119) : finalize**

```js
// ─── Finalize ──────────────────────────────────────────────────────────────

router.post('/:sheetId/finalize', async (req, res, next) => {
  try {
    const result = await finalizeCreation(req.sheet.id)
    res.json(result)
  } catch (err) { next(err) }
})
```

---

### Fichier 3 : `client/src/stores/creationStore.js`

**Réécriture complète** (62 → ~90 lignes)

Champs ajoutés : `sheetId: null`, `characterId: null`, `campaignId: null`, `isStarting: false`, `startError: null`
Action ajoutée : `setCampaignId(id)` setter
Action async ajoutée : `startCreation(campaignId)` → `fetch('/api/creation/start', { POST, credentials:'include' })` → stocke sheetId + characterId ou startError
`resetCreation` étendu avec les 5 nouveaux champs

```js
import { create } from 'zustand'

const PC_TOTAL = 20

export const useCreationStore = create((set, get) => ({
  step: 0,
  step0Data: null,
  step1Data: null,
  step2Data: null,
  step3Data: null,
  step4Data: null,
  step5Data: null,

  sheetId: null,
  characterId: null,
  campaignId: null,
  isStarting: false,
  startError: null,

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
  },

  setStep: (step) => set({ step }),
  setCampaignId: (campaignId) => set({ campaignId }),

  startCreation: async (campaignId) => {
    set({ isStarting: true, startError: null })
    try {
      const res = await fetch('/api/creation/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ campaignId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || `Erreur ${res.status}`)
      }
      const { sheetId, characterId } = await res.json()
      set({ sheetId, characterId, isStarting: false })
      return { sheetId, characterId }
    } catch (err) {
      set({ startError: err.message, isStarting: false })
      throw err
    }
  },

  setStep0Data: (data) => set({ step0Data: data }),

  setStep1Data: (data) => set({
    step1Data: data,
    step2Data: null,
    step3Data: null,
    step4Data: null,
    step5Data: null,
  }),

  setStep2Data: (data) => set({
    step2Data: data,
    step3Data: null,
    step4Data: null,
    step5Data: null,
  }),

  setStep3Data: (data) => set({
    step3Data: data,
    step4Data: null,
    step5Data: null,
  }),

  setStep4Data: (data) => set({
    step4Data: data,
    step5Data: null,
  }),

  setStep5Data: (data) => set({ step5Data: data }),

  resetCreation: () => set({
    step: 0,
    step0Data: null, step1Data: null, step2Data: null,
    step3Data: null, step4Data: null, step5Data: null,
    sheetId: null, characterId: null, campaignId: null,
    isStarting: false, startError: null,
  }),
}))
```

---

### Fichier 4 : `client/src/components/creation/WizardCreation.jsx`

**Réécriture complète** (137 → ~170 lignes)

Changements :
- +`import { useEffect } from 'react'`
- +`import { useParams } from 'react-router-dom'`
- Destructuring store étendu : +`sheetId, isStarting, startError, startCreation, setCampaignId`
- `const { campaignId } = useParams()`
- `useEffect(() => { if (campaignId) setCampaignId(campaignId) }, [campaignId, setCampaignId])`
- Handler step0 → async : `if (isStarting) return` guard + `await startCreation(campaignId)` + setStep(1)
- Affichage `startError` si non null (au-dessus de Step0Method)
- Helper `callStep(endpoint, body)` : `fetch('/api/creation/${sheetId}/${endpoint}', { POST... })`
- Handlers step1/2/3 → async : `await callStep(...)` puis setStepNData + setStep

```jsx
import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCreationStore } from '../../stores/creationStore'
import WizardHeader from './WizardHeader'
import Step0Method from './Step0Method'
import Step1Attributes from './Step1Attributes'
import Step2Genotype from './Step2Genotype'
import Step3Mutations from './Step3Mutations'
import Step4Experience from './Step4Experience'

export default function WizardCreation() {
  const { t } = useTranslation('creation')
  const { campaignId } = useParams()
  const {
    step, setStep,
    sheetId, isStarting, startError,
    startCreation, setCampaignId,
    setStep0Data, setStep1Data, setStep2Data, setStep3Data, setStep4Data,
    getPcDispo,
  } = useCreationStore()

  useEffect(() => {
    if (campaignId) setCampaignId(campaignId)
  }, [campaignId, setCampaignId])

  const pcDispo = getPcDispo()
  const mockAmbiance = 'INTERMEDIAIRE'
  const mockIsFeminin = false

  const callStep = async (endpoint, body) => {
    const res = await fetch(`/api/creation/${sheetId}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || `Erreur ${res.status}`)
    }
    return res.json()
  }

  if (step === 0) {
    return (
      <>
        {startError && (
          <div className="wiz-error">{startError}</div>
        )}
        <Step0Method
          onNext={async () => {
            if (isStarting) return
            setStep0Data({ method: 'point_buy' })
            try {
              await startCreation(campaignId)
              setStep(1)
            } catch { /* startError stocké dans le store */ }
          }}
        />
      </>
    )
  }

  return (
    <div className="wiz-shell">
      <WizardHeader
        step={step}
        totalSteps={5}
        pcDispo={pcDispo}
        infos={getInfos(step, mockAmbiance, t)}
      />

      <div style={st.body}>
        {step === 1 && (
          <Step1Attributes
            ambiance={mockAmbiance}
            isFeminin={mockIsFeminin}
            onPcChange={(n) => setStep1Data({ pcSpent: n })}
            onNext={async (data) => {
              await callStep('step1', data)
              setStep1Data(data)
              setStep(2)
            }}
            onPrev={() => {
              setStep1Data(null)
              setStep(0)
            }}
          />
        )}

        {step === 2 && (
          <Step2Genotype
            onNext={async (data) => {
              await callStep('step2', data)
              setStep2Data(data)
              setStep(3)
            }}
            onPrev={() => {
              setStep2Data(null)
              setStep(1)
            }}
          />
        )}

        {step === 3 && (
          <Step3Mutations
            pcDispo={pcDispo}
            onNext={async (data) => {
              await callStep('step3', data)
              setStep3Data(data)
              setStep(4)
            }}
            onPrev={() => {
              setStep3Data(null)
              setStep(2)
            }}
          />
        )}

        {step === 4 && (
          <Step4Experience
            pcDispo={pcDispo}
            onNext={(data) => {
              setStep4Data(data)
              setStep(5)
            }}
            onPrev={() => {
              setStep4Data(null)
              setStep(3)
            }}
          />
        )}

        {step === 5 && (
          <div style={st.placeholder}>
            <p style={st.placeholderText}>{t('step5.coming_soon')}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function getInfos(step, ambiance, t) {
  if (step === 1) return <span className="wiz-info-badge">{t('wizard.info_step1', { ambiance, pool: 38 })}</span>
  if (step === 2) return <span className="wiz-info-badge">{t('wizard.info_step2')}</span>
  if (step === 3) return <span className="wiz-info-badge">{t('wizard.info_step3')}</span>
  if (step === 4) return <span className="wiz-info-badge">{t('wizard.info_step4')}</span>
  if (step === 5) return <span className="wiz-info-badge">{t('wizard.info_step5')}</span>
  return null
}

const st = {
  body: { flex: 1, display: 'flex', flexDirection: 'column' },
  placeholder: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: '#5a5a7a', fontSize: '14px' },
}
```

**Note** : `wiz-error` → ajouter classe CSS dans `index.css` Section 10 avant de livrer.

---

### Fichier 5 : `client/src/components/creation/Step1Attributes.jsx`

**Zone A — ligne 100** : ajouter validation charName

Remplacer :
```js
const canNext = pointsRestants === 0
```
Par :
```js
const canNext = pointsRestants === 0 && charName.trim().length > 0
```

**Zone B — ligne 321** : étendre payload onNext

Remplacer :
```js
onClick={() => onNext({ pcSpent: pcAlloues })}
```
Par :
```js
onClick={() => onNext({ charName: charName.trim(), playerName: playerName.trim(), attributes: attributs, pcSpent: pcAlloues })}
```

---

### Fichier 6 : `client/src/App.jsx`

**Ligne 66** : changer le path

Remplacer :
```jsx
<Route path="/creation" element={
```
Par :
```jsx
<Route path="/campaigns/:campaignId/creation" element={
```

---

## Ce qui ne change PAS

- `Step2Genotype.jsx` — format `onNext({ genotypeId: selected.id, isDeserter })` ✅
- `Step3Mutations.jsx` — format `onNext({ method, mutations, pcSpent })` ✅
- `Step4Experience.jsx` — COUCHE 4b
- `WizardCreationPage.jsx` — wrapper pur (1 ligne)
- `index.js` — déjà monté `/api/creation`

---

## Classe CSS à ajouter

Dans `client/src/index.css` Section 10 (composants UI wizard), ajouter :
```css
/* Wizard — message d'erreur start */
.wiz-error {
  color: #e05c5c;
  font-size: 12px;
  padding: 8px 16px;
  background: rgba(224, 92, 92, 0.08);
  border-left: 3px solid #e05c5c;
  margin-bottom: 8px;
}
```

---

## Checklist de lecture — tous lus ✅

- [x] `server/src/services/creationService.js` — lignes 1-369 complètes
- [x] `server/src/routes/creation.js` — 122 lignes complètes
- [x] `client/src/stores/creationStore.js` — 67 lignes complètes
- [x] `client/src/components/creation/WizardCreation.jsx` — 137 lignes complètes
- [x] `client/src/components/creation/Step1Attributes.jsx` — 339 lignes complètes
- [x] `client/src/components/creation/Step2Genotype.jsx` — 580 lignes complètes
- [x] `client/src/components/creation/Step3Mutations.jsx` — lu session 129
- [x] `server/src/db/migrations/33_char_ref_genotypes.js` — complet
- [x] `server/src/db/migrations/36_char_sheet.js` — complet
- [x] `server/src/db/migrations/55_character_type.js` — complet
- [x] `server/src/db/migrations/96_char_creation_tables.js` — lignes 1-50 (char_mutations)
- [x] `server/src/db/migrations/97_char_creation_core.js` — complet
- [x] `client/src/App.jsx` — grep ligne 66 confirmé

---

## Séquence de livraison

1. `creationService.js` — appender les 5 fonctions
2. `creation.js` — import + 5 routes
3. SR (Serveur Redémarré) → confirmer 0 erreur
4. `creationStore.js` — réécriture complète
5. `WizardCreation.jsx` — réécriture complète
6. `Step1Attributes.jsx` — 2 lignes
7. `App.jsx` — 1 ligne
8. `index.css` — classe `.wiz-error`
9. Tester : naviguer `/campaigns/[uuid]/creation` → step0 → step1 → step2 → step3 → vérifier DB

---

## Points de vigilance actifs

**PV1** — `char_archetype` doit exister dès `start` (step4 fait UPDATE sans INSERT préalable) ← géré ✅

**PV2** — `char_pc_ledger` doit exister dès `start` (step4 AppError 500 si absent) ← géré ✅

**PV3** — `characters.type` defaultTo('pnj') — expliciter `type: 'pj'` dans start ← géré ✅

**PV4** — `career_id` UUID ≠ career code string — COUCHE 4b, pas COUCHE 4a

**PV5** — Ownership guard `/start` sans `:sheetId` — guard membership explicite dans le handler ← géré ✅

**PV6** — `char_creation_snapshot` attend `char_archetype` (step4 rollback) — row créée en start ✅

**PV7** (2026-07-05, migration 37-bis) — ✅ **corrigé**. `ARMES_SATELLITES` n'existe pas comme Compétence dans le LdB (le texte l'attribue explicitement à `TACTIQUE_COMBAT_TERRESTRE`). Migration 105 (`105_ref_skills_37bis.js`) supprime cette ligne de `ref_skills`. `docs/Character/Creation/migrations/93_seed_ref_careers_lot4a.cjs`, carrière `officier_militaire_surface`, référençait `skill_id: 'ARMES_SATELLITES'` — ligne retirée (le besoin est déjà couvert par `TACTIQUE_COMBAT_TERRESTRE`, présent dans `offMilCommonSkills`, pas de doublon à ajouter).
