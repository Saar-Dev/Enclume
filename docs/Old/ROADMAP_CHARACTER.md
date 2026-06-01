# ROADMAP — Domaine Character (sessions futures)
> Dernière mise à jour : 2026-05-02 — Session 45

---

## Comment utiliser ce document

En début de chaque session Character, uploader :
1. `journalChantier_FichePerso.md`
2. `CHARACTER.md`
3. Les fichiers source concernés par le chantier (listés dans chaque session)

---

## Session 1 ✅ — Architecture & migrations
SQL, routes API, CharacterWindow, CharacterSheet Modules 1-4. Aucun code client produit.

## Session 2 ✅ — Module 5 Compétences
`SkillsPanel.jsx`, route `GET /skills`, règles de visibilité 1-4 (MUTATION masqué en V1).

## Session 3 ✅ — Module 6 Avantages & Désavantages + corrections BDD
- Migration 40 : `char_advantages` + `linked_skill_id` sur `ref_mutations`
- 3 scripts SQL correctifs : parents fantômes, markers, prérequis Polaris
- `AdvantagesPanel.jsx` : mutations, Force Polaris, texte libre
- `SkillsPanel.jsx` : Règle 3 MUTATION active (PC9 levé), accordéon, guard CHC
- `CharacterSheet.jsx` : Bloc 6 monté, `charAdvantages` state + chargement séparé

## Session 4 ✅ — Corrections affichage compétences
- Migration 44 : correction encodage UTF-8 sur 12 lignes `ref_skills` (labels et familles corrompus)
- `SkillsPanel.jsx` : arborescence CHC — groupes structurels affichés comme sous-en-têtes visuels non-jouables dans le tableau, enfants indentés dessous

## Session 37 (VTT) ✅ — Chantier XP
- Migration 45 : `xp_total` + `xp_available` sur `char_sheet`
- `charStats.js` : fonctions XP ajoutées (`getCoutAugmentation`, `getCoutDeblocageX`, `getCoutTotal`)
- `char-sheet.js` : `assertOwnerOrGm` retourne `{ character, isGm }` ; routes `PUT /xp` (GM) + `POST /skills/buy`
- `CharacterSheet.jsx` : section Expérience, `xp_total` lecture seule, `xp_available` éditable GM, toggle Mode Progression
- `SkillsPanel.jsx` : mode Progression avec bouton `+{cout} PE` par compétence, achat immédiat
- `fr.json` : clés `character.xp.*`

---

## Session 38 ✅ — Correction visibilité compétences (X) en mode Progression
- `SkillsPanel.jsx` : compétences `(X)` non apprises visibles en mode Progression si prérequis SKILL_MIN satisfaits — déblocage via achat XP (3 PE). `progressionMode` ajouté dans deps `isVisible`.

## Session 45 ✅ — Documentation exhaustive domaine Character
- `CHARACTER.md` : §2 (12 routes), §3 (doublon supprimé), §4 (PUT /xp + POST /skills/buy), §5 (props SkillsPanel complètes, flux XP ajoutés), §6 (barème XP), §7 (CharacterWindow routes VTT, AdvantagesPanel badge list), §9 (PC22)
- `CHARACTER_FLUX.md` : assertOwnerOrGm retour corrigé, isVisible deps (progressionMode), flux XP ajoutés, onAdvantagesChange updater function, bug PC22 documenté
- `ROADMAP_CHARACTER.md` : UX10 libellé corrigé, PC22 ajouté

## Session 5 — Corrections restantes + intégration dev externe

### Prérequis
- [x] Sessions 1, 2, 3, 4 et Chantier XP (session 37) validés

### Fichiers à uploader
- `journalChantier_FichePerso.md`
- `CHARACTER.md`
- `SkillsPanel.jsx` version courante
- `AdvantagesPanel.jsx` version courante
- `CharacterSheet.jsx` version courante

### Chantier B — Mémorisation état accordéon

`collapsedFamilies` est un state React — remis à zéro à chaque rechargement.
Persister dans `localStorage` avec clé `enclume_skills_collapsed_{characterId}`.

### Chantier C — Fix toggle Force Polaris

Actuellement, toggler un pouvoir Polaris met à jour `charSkillsPolaris` local dans `AdvantagesPanel` mais pas `charSkills` dans `CharacterSheet`. SkillsPanel ne voit le changement qu'après F5. Fix : remonter le changement via callback `onCharSkillsChange` ou recharger `charSkills` depuis CharacterSheet après toggle.

### Chantier D — Intégration développeur externe

Voir section dédiée ci-dessous.

---

## Session 6 — Module 6 suite : mutations avancées

### Chantier
- Afficher les modificateurs d'attributs des mutations actives dans le calcul na
  (actuellement `char_advantages` stocke les mutations mais les `mod_*` de `ref_mutations` ne sont pas utilisés)
- À décider : les mod_* s'appliquent-ils automatiquement ou manuellement via le GM ?

---

## Session 7 — Module 7 : Malus global (TOTAL_MALUS)

### Prérequis
- [ ] Modules Armure et Blessures conçus

### Chantier
- Définir comment `TOTAL_MALUS` est calculé
- Remplacer `TOTAL_MALUS = 0` dans `calcNA()` par la valeur réelle
- Migrations armures/blessures

---

## Session future — Interface admin ref_skills / ref_genotypes

BDD master partagée — modifiable admin uniquement. Interface Dashboard à créer.
Numérotation migrations à partir de 46+.

---

## Intégration développeur externe

### Contexte
Le développeur des modules joueur (Bourse, Inventaire, Marchands, Crafting, Initiative, Combat) intègre ses modules HTML/JS dans Enclume. La fiche perso est sa "porte d'entrée".

### Pattern de migration Google Sheets → Enclume API

```js
// Ancien
fetch(`${WEBAPP_URL}?page=inventory&fid=${fid}`)

// Nouveau
fetch(`${API_URL}/api/char-sheet/${characterId}/inventory`, {
  credentials: 'include'
})
```

### Modules à intégrer (tables à créer, numérotation à partir de 46)
- Inventaire → `char_inventory`
- Bourse/Transactions → `char_transactions`
- Historique XP → `char_xp_log`

### Étapes
1. Analyser les appels Google Sheets existants dans chaque module
2. Mapper vers les tables PostgreSQL correspondantes
3. Créer migrations + routes
4. Adapter les modules HTML/JS (remplacer les fetch)

---

## Backlog UX

| # | Description | Complexité | Session |
|---|---|---|---|
| UX1 | Historique dépenses XP (remplace `pc_modifier` agrégé) | Moyenne | future |
| UX2 | Spécialisations compétences (colonne S) | Faible | future |
| UX3 | Export PDF de la fiche | Moyenne | future |
| UX4 | Mode lecture seule propre | Faible | future |
| UX5 | Champ texte libre "Instrument de musique" (notes sur char_skills) | Faible | 5 |
| UX6 | Validation valeurs saisies (base_level min/max) | Faible | future |
| UX7 | Plusieurs fiches par character | Haute | future |
| UX8 | Prérequis OU (Cryptographie : Informatique OU Maths) | Moyenne | future |
| UX9 | Mémorisation accordéon compétences (localStorage) | Faible | 5 |
| UX10 | Fix toggle Force Polaris — **PC22** : joueur reçoit 403 (PUT /skills GM uniquement). Fix : route dédiée owner+GM pour toggler is_learned sur pouvoirs Polaris | Faible | 5 |
| UX11 | Mise à jour temps réel compétences entre GM et joueur (WS CHAR_SKILLS_UPDATED) | Moyenne | future |