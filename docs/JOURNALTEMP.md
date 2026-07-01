# JOURNALTEMP — COUCHE 4b — Plan validé prêt à coder
> Session 129 — 2026-07-01 — Contenu périssable

## ÉTAT : Plan complet validé — en attente de reprise post-autocompact

## CONTEXTE

COUCHE 4a clos partiel : SR OK, start OK, steps 1-3 non testés depuis client.
COUCHE 4b = câblage complet step4 (données réelles + skillAllocations) + step5 (avantages) + finalize.

## CONFIRMATIONS CRITIQUES

- ref_background_skills : { id, background_id, skill_id, bonus, conditional, choice_group }
- Codes backgrounds DB = codes mock IDENTIQUES (navire_nomade, petite_station, etc.)
- ref_advantages.advantage_id = TEXT PK ('adv_001'), cost_pc signé
- char_pc_ledger a pc_gained_desavantages (migration 97 ligne 44)
- addAdvantage(sheetId, advantageId, 'creation_step5', trx) gère validation + ledger
- nationsList dans Step4Summary.jsx = dead code (BackgroundSelector importe depuis mockStep4Data.js)
- career_id backend = UUID — mock utilisait code string → CRITIQUE à corriger

## DÉCISION skillAllocations

Frontend stocke par carrière : { skill_id: deltaPoints } (points FROM cette carrière).
Payload builder calcule mastery cumulative avant envoi (bg_bonus + cumul deltas carrières).
Backend fait SET → chaque carrière reçoit la mastery absolue cumulée → correct.

## PLAN 7 FICHIERS

### F1 — server/src/services/creationService.js (getStep4RefData lignes 194-224)
+ db('ref_background_skills').select('*') dans Promise.all
+ bgMap (id → { ...bg, skills: [] }), attacher skills
+ byType pointe sur bgsWithSkills

### F2 — client/src/stores/creationStore.js
+ creationState: null
+ setCreationState: (s) => set({ creationState: s })
+ resetCreation : creationState: null

### F3 — client/src/components/creation/CareersAllocator.jsx
- Supprimer import careersList
- + prop careers (liste réelle)
- career.code → career.id partout
- + state skillAllocs: {} (reset sur select/years change)
- Boutons -/+ : setSkillAllocs avec guard budget (points_per_year * years)
- Afficher budget dépensé / total
- handleAdd → onAdd(career.id, career.name, career.titles, years, skillAllocs) + reset

### F4 — client/src/components/creation/Step4Summary.jsx
+ props selectedGeoItem, selectedSocItem, selectedTrainingItem, selectedHigherEdItem
- Remplacer geoOrigins.find(...)?.name → selectedGeoItem?.name etc.
- Ligne 61 : careersList.find(...)?.name → c.career_name
- Ligne 62 : career?.titles → c.titles (stocké dans selectedCareers)
- Supprimer lignes 105-fin : exports mock (dead code)

### F5 — client/src/components/creation/Step4Experience.jsx
- Supprimer import geoOrigins/socialOrigins/trainings/higherEds depuis mockStep4Data
- + state refData { loading, geoOrigins:[], socialOrigins:[], trainings:[], higherEds:[], careers:[] }
- + useEffect : api.get('/creation/${sheetId}/step4/ref') si sheetId
- refData.X remplace refs mock dans filtres + BackgroundSelector
- handleAddCareer(careerId, careerName, careerTitles, years, skillAllocations)
- careers={refData.careers} à CareersAllocator
- selectedGeoItem/selectedSocItem/selectedTrainingItem/selectedHigherEdItem à Step4Summary
- handleSubmit → buildPayload() avec cumul mastery

buildPayload():
  cumulMastery = {}
  Pour chaque bg (geo/soc/training/higherEd) : cumulMastery[skill] += bonus
  Pour chaque career : pour chaque [skillId, pts] de c.skillAllocations :
    cumulMastery[skillId] += pts; skillAllocations[skillId] = cumulMastery[skillId]
  return { age, originGeo, originSoc, training, higherEd, careers: careersPayload, appliedSkills: [], pcSpent: totalPC }

### F6 — client/src/components/creation/WizardCreation.jsx
+ import useNavigate, Step5Advantages
+ destructurer creationState, setCreationState, resetCreation
+ const navigate = useNavigate()

Step4 onNext → async : callStep('step4', data) + setCreationState('draft_step4') + setStep(5)
Step4 onPrev → async : si draft_step4 → DELETE /step4 + setCreationState('draft_step3')
Step5 : <Step5Advantages sheetId pcDispo
  onNext: callStep('step5') + api.post(finalize) + resetCreation() + navigate('/')
  onPrev: setStep(4)
/>

### F7 (NOUVEAU) — client/src/components/creation/Step5Advantages.jsx
Props : { sheetId, pcDispo, onNext, onPrev }
- useEffect → GET /creation/${sheetId}/step5/ref
- state selected: [] (advantage_id strings)
- PC restant = pcDispo - sum(cost_pc adv) + sum(|cost_pc| desadv)
- Toggle, disabled si cost_pc > pcRemaining
- 2 sections Avantages/Désavantages
- className="btn" pour boutons, i18n

## ORDRE LIVRAISON

1. creationService.js → SR (0 erreur)
2. creationStore.js
3. CareersAllocator.jsx
4. Step4Summary.jsx
5. Step4Experience.jsx
6. WizardCreation.jsx
7. Step5Advantages.jsx (nouveau)
8. fr.json clés step5
9. Test flux complet

## CE QUI NE CHANGE PAS

routes/creation.js, BackgroundSelector.jsx, AgeSelector.jsx, App.jsx, mockStep4Data.js
