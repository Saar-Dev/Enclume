# CHARACTER_FLUX.md — Flux de données du domaine Character
> Complément technique de CHARACTER.md
> Dernière mise à jour : 2026-04-16 — Session 3

Ce document décrit les flux de données, les dépendances entre composants, et les chaînes de chargement. À lire quand on modifie un composant Character.

---

## Arbre des composants

```
SessionPage
  └── CharacterWindow
        ├── [onglet Fiche]  → CharacterSheet
        │     ├── SkillsPanel
        │     └── AdvantagesPanel
        ├── [onglet Bio]    → illustration + notes GM
        └── [onglet Params] → propriétaire, GLB, suppression
```

---

## Chargement au montage — CharacterSheet

```
CharacterSheet(characterId)
  │
  ├─ 1. Promise.all (en parallèle)
  │       ├── GET /api/char-ref/genotypes    → state genotypes
  │       └── GET /api/char-ref/skills       → state refSkills
  │
  ├─ 2. GET /api/char-sheet/:id
  │       → sheet, identity, archetype, attributes[], skills[]
  │       └── si sheet=null : POST puis rechargement
  │
  └─ 3. GET /api/char-sheet/:id/advantages   (appel séparé, non bloquant)
          → state charAdvantages
          └── erreur → charAdvantages = [] (AdvantagesPanel s'affiche vide)
```

**Ordre de rendu :** loading spinner → après étape 2 → affichage fiche. AdvantagesPanel reçoit `charAdvantages=[]` puis se met à jour quand l'étape 3 termine.

---

## Chargement au montage — AdvantagesPanel

```
AdvantagesPanel(characterId)
  │
  └─ useEffect([], [])     ← au montage, sans condition modale
       GET /api/char-ref/mutations  → state refMutations
       (PC16 : nécessaire pour enrichir POST advantages avec mutation_nom)
```

**Chargement différé (à l'ouverture de la modale) :**
```
openModal()
  └── useEffect([modalOpen])
        GET /api/char-ref/skills        → refSkillsPolaris (filtre parent=POUVOIRS_POLARIS)
        GET /api/char-sheet/:id         → charSkillsPolaris (état is_learned des pouvoirs)
```

---

## Flux de sauvegarde

### Attributs (CharacterSheet)
```
onChange(attrId, val)
  → attrsRef.current = newAttrs  (synchrone)
  → setAttrs(newAttrs)
  → clearTimeout + setTimeout 500ms
       PUT /attributes { attributes: [...] }
       → onSaved?.()  → ✓ dans CharacterWindow header
```

### Maîtrise compétence (SkillsPanel)
```
onChange(skillId, val)
  → localMasteryRef.current[skillId] = val  (synchrone)
  → setLocalMastery(...)
  → clearTimeout + setTimeout 500ms  (timer par skillId)
       PUT /skills { skills: [{ skill_id, mastery }] }
       → onSaved?.()
```

### Ajout mutation (AdvantagesPanel)
```
handleAddMutation(muta_numero)
  → POST /advantages { type:'MUTATION', muta_numero }
  → enrichit réponse avec refMutations local (mutation_nom, linked_skill_id)
  → onAdvantagesChange(newList)
       → CharacterSheet.setCharAdvantages(newList)
            → prop charAdvantages descendante vers SkillsPanel
                 → activeMutations recalculé (useMemo)
                      → isVisible() réévalue toutes les compétences
```

### Toggle pouvoir Polaris (AdvantagesPanel)
```
handleTogglePolaris(skillId)
  → PUT /skills { skills: [{ skill_id, is_learned: !current }] }
  → setCharSkillsPolaris(updated)  ← state LOCAL à AdvantagesPanel
  ⚠️ NE remonte PAS vers CharacterSheet.charSkills
     → SkillsPanel ne voit pas le changement immédiatement
     → Fix prévu Session 4 (UX10)
```

---

## Mémoïsation dans CharacterSheet

```
genotypeData = useMemo([genotypes, genotypeId])
getModGen    = useCallback([genotypeData])
naMap        = useMemo([attrs, getModGen])     ← recalculé si attrs ou génotype change
anMap        = useMemo([naMap])                ← passé à SkillsPanel
secondary    = useMemo([naMap])
```

**Règle :** `anMap` est passé à `SkillsPanel` — si `anMap` change, `SkillsPanel` recalcule tous les `calcBase`. Ne jamais casser la mémoïsation de `anMap`.

---

## Mémoïsation dans SkillsPanel

```
learnedSet      = useMemo([charSkills])
activeMutations = useMemo([charAdvantages])  ← Set des muta_numero actifs
calcBase        = useCallback([anMap])
calcTotal       = useCallback([calcBase, localMastery])
isVisible       = useCallback([refSkills, learnedSet, calcTotal, genotypeId, activeMutations])
families        = useMemo([refSkills])
```

**Chaîne de dépendance visibilité :**
`charAdvantages` → `activeMutations` → `isVisible` → `visibleSkills` (rendu)

---

## Refs miroirs — pattern synchrone (PC12)

Problème : dans un debounce setTimeout, les closures capturent la valeur de state au moment de la création du timer, pas au moment de l'exécution. Solution : ref miroir mise à jour synchroniquement dans onChange.

```js
// Pattern standard dans CharacterSheet et SkillsPanel
const myRef = useRef(initialValue)

onChange = (val) => {
  myRef.current = val          // synchrone — toujours la dernière valeur
  setState(val)                // asynchrone — déclenche re-rendu
  clearTimeout(timer.current)
  timer.current = setTimeout(() => {
    api.put('/route', { value: myRef.current })  // lit la ref, pas le state
  }, 500)
}
```

---

## Ownership — pattern commun à toutes les routes

```js
async function assertOwnerOrGm(characterId, userId) {
  const character = await db('characters').where({ id: characterId }).first()
  if (!character) throw new AppError(404, 'Character not found')
  const member = await db('campaign_members')
    .where({ campaign_id: character.campaign_id, user_id: userId }).first()
  if (!member) throw new AppError(403, 'Not a campaign member')
  const isOwner = character.user_id === userId
  const isGm = member.role === 'gm'
  if (!isOwner && !isGm) throw new AppError(403, 'Forbidden')
  return character
}
```

---

## Dépendances entre tables Character

```
characters (VTT)
  └── char_sheet  ←─────────────────────────────┐
        ├── char_identity                        │ ON DELETE CASCADE
        ├── char_archetype → ref_genotypes       │
        ├── char_attributes                      │
        ├── char_skills    → ref_skills          │
        │                    → ref_skill_requirements
        └── char_advantages → ref_mutations
```

**Cascade :** supprimer `characters` → supprime toute la fiche Polaris automatiquement.

---

## Points d'attention pour modifier un composant

### Modifier CharacterSheet
- Respecter l'ordre de déclaration : useState AVANT useCallback/useMemo qui les utilisent (P4)
- `attrsRef` et `chcRef` doivent être mis à jour synchroniquement DANS onChange ET au chargement API
- `charAdvantages` est chargé séparément — son absence ne bloque pas le rendu de la fiche

### Modifier SkillsPanel
- `charAdvantages` est une prop requise (peut être `[]` mais pas undefined)
- `isVisible` dépend de 5 valeurs mémoïsées — vérifier les deps si on ajoute une règle
- Guard CHC en tête de `isVisible` : ne jamais supprimer

### Modifier AdvantagesPanel
- `refMutations` chargé au montage (useEffect sans deps) — ne pas conditionner à modalOpen
- `handleAddMutation` doit enrichir la réponse POST avec `refMutations` local
- `onAdvantagesChange` est le seul canal de remontée vers CharacterSheet
